import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { normalizePayload } from "../_shared/facebook-normalizer.ts";
import {
  buildTrustedImportPayload,
  extractMetaLeadgenEvents,
  type FetchLike,
  fetchMetaGraphLead,
  isMetaWebhookTestMode,
  type JsonRecord,
  type MetaGraphLeadResult,
  type MetaLeadgenEvent,
  resolveMetaVerification,
  verifyMetaWebhookSignature,
} from "./metaWebhook.ts";

export { normalizePayload };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-import-secret, x-hub-signature-256",
};

const MAX_REQUEST_BYTES = 1_000_000;
const META_GRAPH_FETCH_CONCURRENCY = 3;
const SOURCE = "facebook_lead_ads";

type FunctionSupabaseClient = ReturnType<typeof createClient>;
type EnvReader = (name: string) => string | undefined;
type ImportPayload = (
  supabase: FunctionSupabaseClient,
  body: JsonRecord,
  now: Date,
) => Promise<Response>;

export type FacebookLeadAdHandlerDependencies = {
  env?: EnvReader;
  fetchImpl?: FetchLike;
  importPayload?: ImportPayload;
  now?: () => Date;
  supabase?: FunctionSupabaseClient;
};

function jsonResponse(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function authOk(req: Request, env: EnvReader): boolean {
  const expected = env("FACEBOOK_LEAD_AD_IMPORT_SECRET");
  if (!expected) return false;
  const importSecret = req.headers.get("x-import-secret");
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  return importSecret === expected || bearer === expected;
}

async function importLeadPayload(
  supabase: FunctionSupabaseClient,
  body: JsonRecord,
  clock: Date,
): Promise<Response> {
  const normalized = normalizePayload(body);
  if (!normalized.ok) {
    return jsonResponse({ success: false, error: normalized.error }, 400);
  }

  const payload = normalized.payload;
  const now = clock.toISOString();

  try {
    const { data: existingAttribution, error: attributionLookupError } =
      await supabase
        .from("lead_attribution_details")
        .select("id, lead_id")
        .eq("source_platform", payload.sourcePlatform)
        .eq("platform_lead_id", payload.platformLeadId)
        .maybeSingle();

    if (attributionLookupError) throw attributionLookupError;

    let leadId = existingAttribution?.lead_id as string | undefined;
    let deduped = Boolean(leadId);

    if (!leadId) {
      if (payload.email) {
        const { data: leadByEmail, error } = await supabase
          .from("leads")
          .select("id")
          .eq("email", payload.email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        leadId = leadByEmail?.id as string | undefined;
      }

      if (!leadId && payload.phoneE164) {
        const { data: leadByPhone, error } = await supabase
          .from("leads")
          .select("id")
          .eq("phone_e164", payload.phoneE164)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        leadId = leadByPhone?.id as string | undefined;
      }
    }
    deduped = Boolean(existingAttribution?.lead_id);

    const leadPatch: JsonRecord = {
      source: SOURCE,
      lead_source: SOURCE,
      client_slug: payload.clientSlug,
      updated_at: now,
    };

    const optionalLeadFields: JsonRecord = {
      first_name: payload.firstName,
      last_name: payload.lastName,
      email: payload.email,
      phone_e164: payload.phoneE164,
      county: payload.county,
      fbclid: payload.fbclid,
      gclid: payload.gclid,
      fbc: payload.fbc,
      fbp: payload.fbp,
      utm_source: payload.utmSource,
      utm_medium: payload.utmMedium,
      utm_campaign: payload.utmCampaign,
      utm_term: payload.utmTerm,
      utm_content: payload.utmContent,
      landing_page_url: payload.landingPageUrl,
      first_page_path: payload.firstPagePath,
      initial_referrer: payload.initialReferrer,
    };

    for (const [key, value] of Object.entries(optionalLeadFields)) {
      if (value !== null && value !== undefined) leadPatch[key] = value;
    }

    if (leadId) {
      const { error } = await supabase
        .from("leads")
        .update(leadPatch)
        .eq("id", leadId);
      if (error) throw error;
    } else {
      const { data: insertedLead, error } = await supabase
        .from("leads")
        .insert({
          ...leadPatch,
          phone_verified: false,
          session_id: `fbla_${payload.platformLeadId}`,
          status: "new",
          created_at: now,
        })
        .select("id")
        .single();
      if (error) throw error;
      leadId = insertedLead.id as string;
    }

    const attributionRow = {
      lead_id: leadId,
      source_platform: payload.sourcePlatform,
      source_channel: payload.sourceChannel,
      source_detail: payload.sourceDetail,
      campaign_id: payload.campaignId,
      campaign_name: payload.campaignName,
      adset_id: payload.adsetId,
      adset_name: payload.adsetName,
      ad_id: payload.adId,
      ad_name: payload.adName,
      form_id: payload.formId,
      platform_lead_id: payload.platformLeadId,
      platform_created_time: payload.platformCreatedTime,
      fbclid: payload.fbclid,
      gclid: payload.gclid,
      fbc: payload.fbc,
      fbp: payload.fbp,
      utm_source: payload.utmSource,
      utm_medium: payload.utmMedium,
      utm_campaign: payload.utmCampaign,
      utm_term: payload.utmTerm,
      utm_content: payload.utmContent,
      landing_page_url: payload.landingPageUrl,
      first_page_path: payload.firstPagePath,
      initial_referrer: payload.initialReferrer,
      import_source: "import-facebook-lead-ad",
      imported_at: now,
      raw_payload: payload.rawPayload,
      updated_at: now,
    };

    let attributionId = existingAttribution?.id as string | undefined;

    if (attributionId) {
      const { data: updatedAttribution, error } = await supabase
        .from("lead_attribution_details")
        .update(attributionRow)
        .eq("id", attributionId)
        .select("id")
        .single();
      if (error) throw error;
      attributionId = updatedAttribution.id as string;
    } else {
      const { data: insertedAttribution, error } = await supabase
        .from("lead_attribution_details")
        .insert(attributionRow)
        .select("id")
        .single();
      if (error) throw error;
      attributionId = insertedAttribution.id as string;
    }

    await supabase.from("event_logs").insert({
      event_name: deduped
        ? "facebook_lead_ad_import_deduped"
        : "facebook_lead_ad_imported",
      flow_type: SOURCE,
      route: "import-facebook-lead-ad",
      lead_id: leadId,
      session_id: `fbla_${payload.platformLeadId}`,
      metadata: {
        platform_lead_id: payload.platformLeadId,
        source_platform: payload.sourcePlatform,
        source_channel: payload.sourceChannel,
        campaign_id: payload.campaignId,
        campaign_name: payload.campaignName,
        adset_id: payload.adsetId,
        adset_name: payload.adsetName,
        ad_id: payload.adId,
        ad_name: payload.adName,
        form_id: payload.formId,
        reused: deduped,
        phone_verified: false,
        imported_at: now,
      },
    });

    return jsonResponse({
      success: true,
      lead_id: leadId,
      attribution_id: attributionId,
      reused: deduped,
    });
  } catch (err) {
    console.error("[FB_LEAD_AD_IMPORT:ERROR]", err);
    try {
      await supabase.from("event_logs").insert({
        event_name: "facebook_lead_ad_import_failed",
        flow_type: SOURCE,
        route: "import-facebook-lead-ad",
        metadata: {
          platform_lead_id: payload.platformLeadId,
          error: err instanceof Error ? err.message : String(err),
          imported_at: now,
        },
      });
    } catch (_logErr) {
      // Best-effort audit logging must never hide the import failure response.
    }

    return jsonResponse({ success: false, error: "import_failed" }, 500);
  }
}

function parseJsonObject(
  rawBytes: Uint8Array,
): { ok: true; body: JsonRecord } | {
  ok: false;
  error: "invalid_json" | "payload_must_be_object";
} {
  let rawBody: unknown;
  try {
    rawBody = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(rawBytes),
    );
  } catch (_error) {
    return { ok: false, error: "invalid_json" };
  }

  const body = asRecord(rawBody);
  return body
    ? { ok: true, body }
    : { ok: false, error: "payload_must_be_object" };
}

function resolveSupabaseClient(
  dependencies: FacebookLeadAdHandlerDependencies,
  env: EnvReader,
): FunctionSupabaseClient | null {
  if (dependencies.supabase) return dependencies.supabase;

  const supabaseUrl = env("SUPABASE_URL");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey);
}

function createConcurrencyLimiter(limit: number) {
  let activeCount = 0;
  const queue: Array<() => void> = [];

  const runNext = () => {
    if (activeCount >= limit) return;
    const next = queue.shift();
    if (!next) return;
    activeCount += 1;
    next();
  };

  return function limitTask<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        task().then(resolve, reject).finally(() => {
          activeCount -= 1;
          runNext();
        });
      });
      runNext();
    });
  };
}

async function recordMetaWebhookReceipts(
  supabase: FunctionSupabaseClient,
  events: MetaLeadgenEvent[],
  rawPayload: JsonRecord,
  testMode: boolean,
  receivedAt: string,
): Promise<boolean> {
  for (const event of events) {
    const { error } = await supabase.from("event_logs").insert({
      event_name: "facebook_leadgen_webhook_received",
      flow_type: SOURCE,
      route: "import-facebook-lead-ad",
      session_id: `fbla_${event.leadgenId}`,
      metadata: {
        provider: "meta",
        leadgen_id: event.leadgenId,
        page_id: event.pageId,
        form_id: event.formId,
        ad_id: event.adId,
        platform_created_time: event.createdTime,
        test_mode: testMode,
        received_at: receivedAt,
        raw_payload: rawPayload,
      },
    });

    if (error) {
      console.error(
        "[FB_LEAD_AD_WEBHOOK:RECEIPT_FAILED]",
        event.leadgenId,
      );
      return false;
    }
  }

  return true;
}

async function logMetaGraphFailure(
  supabase: FunctionSupabaseClient,
  event: MetaLeadgenEvent,
  error: string,
  upstreamStatus: number | null,
  failedAt: string,
): Promise<void> {
  try {
    await supabase.from("event_logs").insert({
      event_name: "facebook_leadgen_graph_fetch_failed",
      flow_type: SOURCE,
      route: "import-facebook-lead-ad",
      session_id: `fbla_${event.leadgenId}`,
      metadata: {
        provider: "meta",
        leadgen_id: event.leadgenId,
        page_id: event.pageId,
        form_id: event.formId,
        error,
        upstream_status: upstreamStatus,
        failed_at: failedAt,
      },
    });
  } catch (_error) {
    // The durable pre-fetch receipt already exists; this diagnostic is best effort.
  }
}

async function handleNativeMetaWebhook(
  rawBytes: Uint8Array,
  signatureHeader: string,
  appSecret: string,
  dependencies: FacebookLeadAdHandlerDependencies,
  env: EnvReader,
  now: Date,
): Promise<Response> {
  const signatureValid = await verifyMetaWebhookSignature(
    rawBytes,
    signatureHeader,
    appSecret,
  );
  if (!signatureValid) {
    return jsonResponse({ success: false, error: "unauthorized" }, 401);
  }

  const parsed = parseJsonObject(rawBytes);
  if (!parsed.ok) {
    return jsonResponse({ success: false, error: parsed.error }, 400);
  }

  const events = extractMetaLeadgenEvents(parsed.body);
  const testMode = isMetaWebhookTestMode(env("META_WEBHOOK_TEST_MODE"));
  if (events.length === 0) {
    return jsonResponse({
      success: true,
      received: 0,
      ignored: true,
      test_mode: testMode,
    });
  }

  const supabase = resolveSupabaseClient(dependencies, env);
  if (!supabase) {
    return jsonResponse(
      { success: false, error: "server_not_configured" },
      500,
    );
  }

  const receivedAt = now.toISOString();
  const receiptsStored = await recordMetaWebhookReceipts(
    supabase,
    events,
    parsed.body,
    testMode,
    receivedAt,
  );
  if (!receiptsStored) {
    return jsonResponse(
      { success: false, error: "webhook_receipt_failed" },
      500,
    );
  }

  const accessToken = env("META_PAGE_ACCESS_TOKEN");
  const apiVersion = env("META_GRAPH_API_VERSION");
  if (!accessToken || !apiVersion) {
    return jsonResponse(
      { success: false, error: "meta_graph_not_configured" },
      503,
    );
  }

  const limitMetaGraphFetch = createConcurrencyLimiter(
    META_GRAPH_FETCH_CONCURRENCY,
  );
  const graphRequests = events.map((event) =>
    limitMetaGraphFetch(async (): Promise<{
      event: MetaLeadgenEvent;
      graphResult: MetaGraphLeadResult;
    }> => ({
      event,
      graphResult: await fetchMetaGraphLead(event.leadgenId, {
        accessToken,
        apiVersion,
        fetchImpl: dependencies.fetchImpl,
      }),
    }))
  );

  let importedCount = 0;
  const importPayload = dependencies.importPayload ?? importLeadPayload;

  for (const graphRequest of graphRequests) {
    const { event, graphResult } = await graphRequest;

    if (!graphResult.ok) {
      await logMetaGraphFailure(
        supabase,
        event,
        graphResult.error,
        graphResult.upstreamStatus,
        now.toISOString(),
      );
      const status = graphResult.error === "meta_graph_invalid_config"
        ? 503
        : 502;
      return jsonResponse(
        { success: false, error: graphResult.error },
        status,
      );
    }

    const trustedPayload = buildTrustedImportPayload(
      graphResult.lead,
      event,
      testMode,
    );
    const importResponse = await importPayload(supabase, trustedPayload, now);
    if (!importResponse.ok) return importResponse;

    let resultBody: unknown;
    try {
      resultBody = await importResponse.json();
    } catch (_error) {
      return jsonResponse(
        { success: false, error: "invalid_import_response" },
        500,
      );
    }
    if (!asRecord(resultBody)) {
      return jsonResponse(
        { success: false, error: "invalid_import_response" },
        500,
      );
    }
    importedCount += 1;
  }

  return testMode
    ? jsonResponse({
      success: true,
      received: events.length,
      imported: importedCount,
      test_mode: true,
      downstream_actions: "suppressed",
    })
    : jsonResponse({ success: true });
}

export async function handleImportFacebookLeadAdRequest(
  req: Request,
  dependencies: FacebookLeadAdHandlerDependencies = {},
): Promise<Response> {
  const env = dependencies.env ?? ((name: string) => Deno.env.get(name));
  const now = dependencies.now?.() ?? new Date();

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "GET") {
    const verification = resolveMetaVerification(
      new URL(req.url),
      env("META_WEBHOOK_VERIFY_TOKEN"),
    );
    if (!verification.ok) {
      const status = verification.error === "not_configured" ? 503 : 403;
      return jsonResponse(
        { success: false, error: `meta_webhook_${verification.error}` },
        status,
      );
    }

    return new Response(verification.challenge, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "method_not_allowed" }, 405);
  }

  const trustedImportAuthorized = authOk(req, env);
  const signatureHeader = req.headers.get("x-hub-signature-256");
  if (!trustedImportAuthorized && !signatureHeader) {
    return jsonResponse({ success: false, error: "unauthorized" }, 401);
  }

  const appSecret = env("META_APP_SECRET");
  if (!trustedImportAuthorized && !appSecret) {
    return jsonResponse(
      { success: false, error: "meta_webhook_not_configured" },
      503,
    );
  }

  const contentLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return jsonResponse({ success: false, error: "payload_too_large" }, 413);
  }

  const rawBytes = new Uint8Array(await req.arrayBuffer());
  if (rawBytes.byteLength > MAX_REQUEST_BYTES) {
    return jsonResponse({ success: false, error: "payload_too_large" }, 413);
  }

  if (!trustedImportAuthorized) {
    return handleNativeMetaWebhook(
      rawBytes,
      signatureHeader!,
      appSecret!,
      dependencies,
      env,
      now,
    );
  }

  const parsed = parseJsonObject(rawBytes);
  if (!parsed.ok) {
    return jsonResponse({ success: false, error: parsed.error }, 400);
  }

  const supabase = resolveSupabaseClient(dependencies, env);
  if (!supabase) {
    return jsonResponse(
      { success: false, error: "server_not_configured" },
      500,
    );
  }

  return (dependencies.importPayload ?? importLeadPayload)(
    supabase,
    parsed.body,
    now,
  );
}

if (import.meta.main) {
  Deno.serve((req) => handleImportFacebookLeadAdRequest(req));
}
