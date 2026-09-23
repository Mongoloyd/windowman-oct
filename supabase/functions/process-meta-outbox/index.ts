import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { authorizeMetaWorker } from "../_shared/metaLeadAdsAuth.ts";
import { createGhlAdapter } from "../_shared/metaLeadAdsGhl.ts";
import { sendMetaQualifiedSignal } from "../_shared/metaLeadAdsFeedback.ts";

type EnvReader = (key: string) => string | undefined;
function makeServiceClient(url: string, key: string) {
  return createClient(url, key);
}
type Supabase = ReturnType<typeof makeServiceClient>;
type Job = {
  id: string;
  qualification_id: string;
  lead_id: string;
  job_kind: "ghl_contact" | "meta_qualified";
  event_id: string;
  location_id: string | null;
  lease_token: string;
};
type Delivery =
  | { ok: true; status: number; contactId?: string }
  | { ok: false; code: string; status: number | null; retryable: boolean };
type LeadRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_e164: string | null;
  is_test: boolean;
  funnel_stage: string | null;
  client_slug: string;
};
type QualificationRow = {
  id: string;
  lead_id: string;
  attribution_id: string;
  platform_lead_id: string;
  form_id: string;
  client_slug: string;
  location_id: string;
  qualified_at: string;
};
type DestinationRow = {
  form_id: string;
  client_slug: string;
  location_id: string;
  active: boolean;
  approved_at: string | null;
};
type AttributionRow = {
  id: string;
  lead_id: string;
  platform_lead_id: string;
  source_platform: string;
};
type OutboxDependencies = {
  supabase?: Supabase;
  deliverJob?: typeof deliver;
};

async function latestConsent(
  supabase: Supabase,
  leadId: string,
  purpose: string,
  formId: string,
  platformLeadId: string,
): Promise<boolean> {
  const { data, error } = await supabase.from("lead_consent_events")
    .select("decision").eq("lead_id", leadId).eq("purpose", purpose)
    .eq("source", "meta_lead_ads")
    .contains("metadata", { form_id: formId, platform_lead_id: platformLeadId })
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .limit(1).maybeSingle();
  if (error) throw new Error("consent_lookup_failed");
  return data?.decision === "granted";
}

async function deliver(
  supabase: Supabase,
  job: Job,
  env: EnvReader,
): Promise<Delivery> {
  const [leadResult, qualificationResult] = await Promise.all([
    supabase.from("leads")
      .select(
        "id,first_name,last_name,email,phone_e164,is_test,funnel_stage,client_slug",
      )
      .eq("id", job.lead_id).maybeSingle(),
    supabase.from("meta_qualification_events")
      .select(
        "id,lead_id,attribution_id,platform_lead_id,form_id,client_slug,location_id,qualified_at",
      )
      .eq("id", job.qualification_id).maybeSingle(),
  ]);
  if (leadResult.error || qualificationResult.error) {
    return {
      ok: false,
      code: "delivery_context_lookup_failed",
      status: null,
      retryable: true,
    };
  }
  const lead = leadResult.data as LeadRow | null;
  const qualification = qualificationResult.data as QualificationRow | null;
  if (
    !lead || !qualification || lead.is_test ||
    lead.funnel_stage !== "qualified" ||
    qualification.lead_id !== lead.id
  ) {
    return {
      ok: false,
      code: "delivery_no_longer_eligible",
      status: null,
      retryable: false,
    };
  }
  const [destinationResult, attributionResult, inboxResult] = await Promise.all(
    [
      supabase.from("meta_form_destinations")
        .select("form_id,client_slug,location_id,active,approved_at")
        .eq("form_id", qualification.form_id).maybeSingle(),
      supabase.from("lead_attribution_details")
        .select("id,lead_id,platform_lead_id,source_platform")
        .eq("id", qualification.attribution_id).maybeSingle(),
      supabase.from("meta_lead_inbox")
        .select("lead_id,attribution_id,is_test,status")
        .eq("platform_lead_id", qualification.platform_lead_id).maybeSingle(),
    ],
  );
  if (destinationResult.error || attributionResult.error || inboxResult.error) {
    return {
      ok: false,
      code: "destination_lookup_failed",
      status: null,
      retryable: true,
    };
  }
  const destination = destinationResult.data as DestinationRow | null;
  const attribution = attributionResult.data as AttributionRow | null;
  const inbox = inboxResult.data as {
    lead_id: string;
    attribution_id: string;
    is_test: boolean;
    status: string;
  } | null;
  if (
    !destination?.active || !destination.approved_at ||
    destination.client_slug !== qualification.client_slug ||
    destination.location_id !== qualification.location_id ||
    !["direct", destination.client_slug].includes(lead.client_slug) ||
    !attribution || attribution.lead_id !== lead.id ||
    attribution.platform_lead_id !== qualification.platform_lead_id ||
    !["meta", "facebook"].includes(attribution.source_platform) ||
    !inbox || inbox.status !== "done" || inbox.is_test ||
    inbox.lead_id !== lead.id ||
    inbox.attribution_id !== qualification.attribution_id
  ) {
    return {
      ok: false,
      code: "destination_or_attribution_changed",
      status: null,
      retryable: false,
    };
  }

  if (job.job_kind === "ghl_contact") {
    if (
      job.location_id !== destination.location_id ||
      env("GHL_LOCATION_ID") !== destination.location_id
    ) {
      return {
        ok: false,
        code: "ghl_location_not_approved",
        status: null,
        retryable: false,
      };
    }
    const [marketing, sharing] = await Promise.all([
      latestConsent(
        supabase,
        lead.id,
        "marketing_communications",
        qualification.form_id,
        qualification.platform_lead_id,
      ),
      latestConsent(
        supabase,
        lead.id,
        "contractor_sharing",
        qualification.form_id,
        qualification.platform_lead_id,
      ),
    ]);
    if (!marketing || !sharing) {
      return {
        ok: false,
        code: "ghl_consent_missing",
        status: null,
        retryable: false,
      };
    }
    const result = await createGhlAdapter(
      env("GHL_PRIVATE_INTEGRATION_TOKEN") ?? "",
    )
      .upsertQualifiedContact(destination.location_id, {
        firstName: lead.first_name,
        lastName: lead.last_name,
        email: lead.email,
        phone: lead.phone_e164,
      });
    return result.ok
      ? { ok: true, status: result.status, contactId: result.contactId }
      : {
        ok: false,
        code: result.code,
        status: result.status,
        retryable: result.retryable,
      };
  }

  if (
    !(await latestConsent(
      supabase,
      lead.id,
      "advertising_measurement",
      qualification.form_id,
      qualification.platform_lead_id,
    ))
  ) {
    return {
      ok: false,
      code: "meta_consent_missing",
      status: null,
      retryable: false,
    };
  }
  const feedback = await sendMetaQualifiedSignal(supabase, {
    clientSlug: qualification.client_slug,
    eventId: job.event_id,
    qualifiedAt: qualification.qualified_at,
    platformLeadId: qualification.platform_lead_id,
    email: lead.email,
    phone: lead.phone_e164,
  }, {
    apiVersion: env("META_GRAPH_API_VERSION") ?? "",
    testEventCode: env("META_CRM_TEST_EVENT_CODE"),
    liveEnabled: env("META_CRM_LIVE_SEND_ENABLED") === "true",
  });
  return feedback;
}

async function processLane(
  supabase: Supabase,
  kind: Job["job_kind"],
  env: EnvReader,
  deliverJob: typeof deliver,
): Promise<{
  claimed: number;
  delivered: number;
  failed: number;
  unavailable: boolean;
  recoveryPending: boolean;
}> {
  const { data, error } = await supabase.rpc("meta_claim_integration_outbox", {
    p_job_kind: kind,
    p_limit: 10,
  });
  if (error) {
    return {
      claimed: 0,
      delivered: 0,
      failed: 0,
      unavailable: true,
      recoveryPending: false,
    };
  }
  const jobs = (data ?? []) as Job[];
  const outcomes = await Promise.allSettled(jobs.map(async (job) => {
    let result: Delivery;
    try {
      result = await deliverJob(supabase, job, env);
    } catch (_error) {
      result = {
        ok: false,
        code: "delivery_exception",
        status: null,
        retryable: true,
      };
    }
    if (result.ok) {
      const { error: completionError } = await supabase.rpc(
        "meta_complete_integration_outbox",
        {
          p_id: job.id,
          p_lease_token: job.lease_token,
          p_http_status: result.status,
          p_contact_id: result.contactId ?? null,
        },
      );
      if (completionError) throw new Error("outbox_completion_unconfirmed");
      return true;
    }
    const { error: failureError } = await supabase.rpc(
      "meta_fail_integration_outbox",
      {
        p_id: job.id,
        p_lease_token: job.lease_token,
        p_error_code: result.code,
        p_http_status: result.status,
        p_retryable: result.retryable,
      },
    );
    if (failureError) throw new Error("outbox_failure_unconfirmed");
    return false;
  }));
  return {
    claimed: jobs.length,
    delivered:
      outcomes.filter((outcome) =>
        outcome.status === "fulfilled" && outcome.value
      ).length,
    failed:
      outcomes.filter((outcome) =>
        outcome.status === "fulfilled" && !outcome.value
      ).length,
    unavailable: false,
    recoveryPending: outcomes.some((outcome) => outcome.status === "rejected"),
  };
}

export async function handleProcessMetaOutboxRequest(
  request: Request,
  env: EnvReader = (key) => Deno.env.get(key),
  dependencies: OutboxDependencies = {},
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("method_not_allowed", { status: 405 });
  }
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const url = env("SUPABASE_URL");
  if (!authorizeMetaWorker(request, env("META_WORKER_SECRET"))) {
    return new Response("unauthorized", { status: 401 });
  }
  if (!url || !serviceRoleKey) {
    return new Response("not_configured", { status: 503 });
  }
  const supabase = dependencies.supabase ??
    makeServiceClient(url, serviceRoleKey);
  const kinds: Job["job_kind"][] = [];
  if (
    env("META_GHL_DELIVERY_ENABLED") === "true" &&
    env("GHL_PRIVATE_INTEGRATION_TOKEN") && env("GHL_LOCATION_ID")
  ) {
    kinds.push("ghl_contact");
  }
  if (
    env("META_CRM_FEEDBACK_ENABLED") === "true" &&
    (env("META_CRM_TEST_EVENT_CODE") ||
      env("META_CRM_LIVE_SEND_ENABLED") === "true")
  ) {
    kinds.push("meta_qualified");
  }
  const lanes = await Promise.allSettled(
    kinds.map((kind) =>
      processLane(supabase, kind, env, dependencies.deliverJob ?? deliver)
    ),
  );
  const results = lanes.map((lane) =>
    lane.status === "fulfilled" ? lane.value : {
      claimed: 0,
      delivered: 0,
      failed: 0,
      unavailable: true,
      recoveryPending: false,
    }
  );
  const unavailableLanes = kinds.filter((_, index) =>
    results[index].unavailable
  );
  const recoveryPending = results.some((result) => result.recoveryPending);
  const status = unavailableLanes.length > 0 || recoveryPending ? 503 : 200;
  return Response.json({
    claimed: results.reduce((count, result) => count + result.claimed, 0),
    delivered: results.reduce((count, result) => count + result.delivered, 0),
    failed: results.reduce((count, result) => count + result.failed, 0),
    unavailable_lanes: unavailableLanes,
    recovery_pending: recoveryPending,
    paused: kinds.length === 0,
  }, { status });
}

if (import.meta.main) {
  Deno.serve((request) => handleProcessMetaOutboxRequest(request));
}
