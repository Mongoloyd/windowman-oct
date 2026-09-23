import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { authorizeMetaWorker } from "../_shared/metaLeadAdsAuth.ts";
import {
  type ApprovedFacebookMapping,
  isFacebookCanonicalMappingKey,
  normalizePayload,
} from "../_shared/facebook-normalizer.ts";
import {
  buildTrustedImportPayload,
  extractMetaLeadgenEvents,
  fetchMetaGraphLead,
  type JsonRecord,
  type MetaLeadgenEvent,
} from "../import-facebook-lead-ad/metaWebhook.ts";

export type InboxRow = {
  id: string;
  platform_lead_id: string;
  page_id: string | null;
  form_id: string | null;
  ad_id: string | null;
  platform_created_time: string | null;
  graph_payload: JsonRecord | null;
  is_test: boolean;
  lease_token: string;
  received_at: string;
};

type EnvReader = (key: string) => string | undefined;
function makeServiceClient(url: string, key: string) {
  return createClient(url, key);
}
type Supabase = ReturnType<typeof makeServiceClient>;

type ReceiptRow = {
  id: string;
  body_base64: string;
  lease_token: string;
};

type ReceiptIssue = {
  code:
    | "invalid_json"
    | "invalid_envelope"
    | "invalid_entry"
    | "invalid_change"
    | "invalid_leadgen_id"
    | "invalid_identifier";
  entry_index: number | null;
  change_index: number | null;
};

function validId(value: unknown): boolean {
  return (typeof value === "string" || typeof value === "number") &&
    String(value).trim().length >= 1 && String(value).trim().length <= 255;
}

export function parseSignedReceipt(bodyBase64: string): {
  events: Array<Record<string, unknown>>;
  issues: ReceiptIssue[];
  issueCount: number;
} {
  const events: Array<Record<string, unknown>> = [];
  const issues: ReceiptIssue[] = [];
  let issueCount = 0;
  const issue = (
    code: ReceiptIssue["code"],
    entryIndex: number | null,
    changeIndex: number | null,
  ) => {
    issueCount += 1;
    if (issues.length < 100) {
      issues.push({ code, entry_index: entryIndex, change_index: changeIndex });
    }
  };
  let payload: unknown;
  try {
    const binary = atob(bodyBase64);
    const bytes = Uint8Array.from(
      binary,
      (character) => character.charCodeAt(0),
    );
    payload = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
  } catch (_error) {
    issue("invalid_json", null, null);
    return { events, issues, issueCount };
  }
  const root = asRecord(payload);
  if (root?.object !== "page" || !Array.isArray(root.entry)) {
    issue("invalid_envelope", null, null);
    return { events, issues, issueCount };
  }
  root.entry.forEach((rawEntry, entryIndex) => {
    const entry = asRecord(rawEntry);
    if (!entry || !Array.isArray(entry.changes)) {
      issue("invalid_entry", entryIndex, null);
      return;
    }
    entry.changes.forEach((rawChange, changeIndex) => {
      const change = asRecord(rawChange);
      if (!change) {
        issue("invalid_change", entryIndex, changeIndex);
        return;
      }
      if (change.field !== "leadgen") return;
      const value = asRecord(change.value);
      if (!value || !validId(value.leadgen_id)) {
        issue("invalid_leadgen_id", entryIndex, changeIndex);
        return;
      }
      const pageId = value.page_id ?? entry.id;
      if (
        [pageId, value.form_id, value.ad_id].some((id) =>
          id !== null && id !== undefined && !validId(id)
        )
      ) {
        issue("invalid_identifier", entryIndex, changeIndex);
        return;
      }
      const extracted = extractMetaLeadgenEvents({
        object: "page",
        entry: [{ id: entry.id, changes: [change] }],
      })[0];
      if (!extracted) {
        issue("invalid_change", entryIndex, changeIndex);
        return;
      }
      events.push({
        leadgen_id: extracted.leadgenId,
        page_id: extracted.pageId,
        form_id: extracted.formId,
        ad_id: extracted.adId,
        created_time: extracted.createdTime,
        entry_index: entryIndex,
        change_index: changeIndex,
      });
    });
  });
  return { events, issues, issueCount };
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function approvedMappings(value: unknown): ApprovedFacebookMapping[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap<ApprovedFacebookMapping>((entry) => {
    const mapping = asRecord(entry);
    if (!mapping || typeof mapping.question_label !== "string") return [];
    if (mapping.mapping_action === "ignore") {
      return [{
        question_label: mapping.question_label,
        mapping_action: "ignore" as const,
        canonical_key: null,
      }];
    }
    if (
      mapping.mapping_action === "map" &&
      isFacebookCanonicalMappingKey(mapping.canonical_key)
    ) {
      return [{
        question_label: mapping.question_label,
        mapping_action: "map" as const,
        canonical_key: mapping.canonical_key,
      }];
    }
    return [];
  });
}

function consentEvidence(
  lead: JsonRecord,
  rules: Array<{
    purpose: string;
    question_label: string;
    granted_values: string[];
    declined_values: string[];
    approved_at: string;
  }>,
  receivedAt: string,
) {
  const fields = Array.isArray(lead.field_data) ? lead.field_data : [];
  return rules.flatMap((rule) => {
    if (Date.parse(rule.approved_at) > Date.parse(receivedAt)) return [];
    const matches = fields.map(asRecord).filter((field) => {
      const label = field?.question_label ?? field?.label ?? field?.question ??
        field?.name;
      return typeof label === "string" &&
        label.trim().toLowerCase() === rule.question_label.trim().toLowerCase();
    });
    if (matches.length !== 1) return [];
    const values = matches[0]?.values;
    if (
      !Array.isArray(values) || values.length !== 1 ||
      typeof values[0] !== "string"
    ) return [];
    const answer = values[0].trim();
    const allowed = [...rule.granted_values, ...rule.declined_values].some(
      (value) => value.trim().toLowerCase() === answer.toLowerCase(),
    );
    return allowed
      ? [{
        purpose: rule.purpose,
        question_label: rule.question_label,
        answer_value: answer,
      }]
      : [];
  });
}

export async function prepareMetaLeadCompletion(
  supabase: Supabase,
  row: InboxRow,
  lead: JsonRecord,
): Promise<
  | { ok: false; retryable: boolean; code: string }
  | {
    ok: true;
    leadInput: JsonRecord;
    attributionInput: JsonRecord;
    revisionId: number | null;
    consentRows: ReturnType<typeof consentEvidence>;
  }
> {
  if (String(lead.id ?? row.platform_lead_id) !== row.platform_lead_id) {
    return { ok: false, retryable: false, code: "graph_lead_id_mismatch" };
  }
  const event: MetaLeadgenEvent = {
    leadgenId: row.platform_lead_id,
    pageId: row.page_id,
    formId: row.form_id,
    adId: row.ad_id,
    createdTime: row.platform_created_time,
  };
  const trustedPayload = buildTrustedImportPayload(lead, event, row.is_test);
  const formId = String(trustedPayload.form_id ?? "").trim();
  if (row.form_id && formId !== row.form_id) {
    return { ok: false, retryable: false, code: "graph_form_id_mismatch" };
  }
  let revisionId: number | null = null;
  let mappings: ApprovedFacebookMapping[] = [];
  let consentRows: ReturnType<typeof consentEvidence> = [];
  if (formId) {
    const [revision, consent] = await Promise.all([
      supabase.from("meta_form_mapping_revisions")
        .select("id,mappings").eq("form_id", formId)
        .order("id", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("meta_form_consent_rules")
        .select(
          "purpose,question_label,granted_values,declined_values,approved_at",
        )
        .eq("form_id", formId),
    ]);
    if (revision.error || consent.error) {
      return { ok: false, retryable: true, code: "form_config_lookup_failed" };
    }
    if (revision.data) {
      revisionId = revision.data.id as number;
      mappings = approvedMappings(revision.data.mappings);
    }
    consentRows = consentEvidence(
      lead,
      (consent.data ?? []) as Array<{
        purpose: string;
        question_label: string;
        granted_values: string[];
        declined_values: string[];
        approved_at: string;
      }>,
      row.received_at,
    );
  }
  const normalized = normalizePayload(trustedPayload, mappings);
  if (!normalized.ok) {
    return { ok: false, retryable: false, code: normalized.error };
  }
  const value = normalized.payload;
  const customAnswers = Object.fromEntries(
    Object.entries({
      city: value.city,
      project_type: value.projectType,
      property_type: value.propertyType,
      property_type_detail: value.propertyTypeDetail,
      quote_range: value.quoteRange,
      qualification_openings: value.qualificationOpenings,
    }).filter(([, answer]) => answer !== null),
  );
  return {
    ok: true,
    revisionId,
    consentRows,
    leadInput: {
      session_id: `fbla_${value.platformLeadId}`,
      first_name: value.firstName,
      last_name: value.lastName,
      email: value.email,
      phone_e164: value.phoneE164,
      county: value.county,
      zip: value.zip,
      qualification_answers_json: {
        native_lead: { custom_answers: customAnswers },
      },
    },
    attributionInput: {
      source_platform: "meta",
      source_channel: value.sourceChannel,
      source_detail: value.sourceDetail,
      platform_lead_id: value.platformLeadId,
      platform_created_time: value.platformCreatedTime,
      campaign_id: value.campaignId,
      campaign_name: value.campaignName,
      adset_id: value.adsetId,
      adset_name: value.adsetName,
      ad_id: value.adId,
      ad_name: value.adName,
      form_id: value.formId,
      fbclid: value.fbclid,
      gclid: value.gclid,
      fbc: value.fbc,
      fbp: value.fbp,
      utm_source: value.utmSource,
      utm_medium: value.utmMedium,
      utm_campaign: value.utmCampaign,
      utm_term: value.utmTerm,
      utm_content: value.utmContent,
      landing_page_url: value.landingPageUrl,
      first_page_path: value.firstPagePath,
      initial_referrer: value.initialReferrer,
      raw_payload: {
        meta_lead_inbox_id: row.id,
        mapping_revision_id: revisionId,
      },
    },
  };
}

async function processRow(
  supabase: Supabase,
  row: InboxRow,
  env: EnvReader,
): Promise<{ ok: boolean; retryable: boolean; code: string }> {
  let lead = asRecord(row.graph_payload);
  if (!lead) {
    const graph = await fetchMetaGraphLead(row.platform_lead_id, {
      accessToken: env("META_PAGE_ACCESS_TOKEN") ?? "",
      apiVersion: env("META_GRAPH_API_VERSION") ?? "",
    });
    if (!graph.ok) {
      return {
        ok: false,
        retryable: graph.error === "meta_graph_unavailable" ||
          graph.error === "meta_graph_invalid_config" ||
          graph.upstreamStatus === 429 ||
          (graph.upstreamStatus ?? 0) >= 500,
        code: graph.error,
      };
    }
    lead = graph.lead;
  }
  const prepared = await prepareMetaLeadCompletion(supabase, row, lead);
  if (!prepared.ok) return prepared;
  const { error } = await supabase.rpc("meta_complete_lead_inbox", {
    p_id: row.id,
    p_lease_token: row.lease_token,
    p_lead: prepared.leadInput,
    p_attribution: prepared.attributionInput,
    p_mapping_revision_id: prepared.revisionId,
    p_consents: prepared.consentRows,
    p_graph_payload: lead,
  });
  if (error) {
    return {
      ok: false,
      retryable: error.code !== "22023" && error.code !== "23505",
      code: error.code ?? "lead_persistence_failed",
    };
  }
  return { ok: true, retryable: false, code: "ok" };
}

export async function handleProcessMetaLeadRequest(
  request: Request,
  env: EnvReader = (key) => Deno.env.get(key),
  suppliedClient?: Supabase,
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
  const supabase = suppliedClient ?? makeServiceClient(url, serviceRoleKey);
  const rawClaim = await supabase.rpc("meta_claim_webhook_receipts", {
    p_limit: 10,
  });
  if (rawClaim.error) {
    return new Response("receipt_claim_failed", { status: 503 });
  }
  const receipts = (rawClaim.data ?? []) as ReceiptRow[];
  let receiptRecoveryPending = false;
  const receiptOutcomes = await Promise.allSettled(
    receipts.map(async (receipt) => {
      try {
        const parsed = parseSignedReceipt(receipt.body_base64);
        const completed = await supabase.rpc("meta_complete_webhook_receipt", {
          p_id: receipt.id,
          p_lease_token: receipt.lease_token,
          p_events: parsed.events,
          p_issues: parsed.issues,
          p_issue_count: parsed.issueCount,
        });
        if (completed.error) throw new Error("receipt_completion_failed");
      } catch (_error) {
        const failed = await supabase.rpc("meta_fail_webhook_receipt", {
          p_id: receipt.id,
          p_lease_token: receipt.lease_token,
          p_error_code: "receipt_processing_failed",
          p_retryable: true,
        });
        if (failed.error) receiptRecoveryPending = true;
      }
    }),
  );
  if (receiptOutcomes.some((outcome) => outcome.status === "rejected")) {
    receiptRecoveryPending = true;
  }
  const { data, error } = await supabase.rpc("meta_claim_lead_inbox", {
    p_limit: 10,
  });
  if (error) return new Response("claim_failed", { status: 503 });
  const rows = (data ?? []) as InboxRow[];
  const outcomes = await Promise.allSettled(rows.map(async (row) => {
    let result: { ok: boolean; retryable: boolean; code: string };
    try {
      result = await processRow(supabase, row, env);
    } catch (_error) {
      result = { ok: false, retryable: true, code: "worker_exception" };
    }
    if (result.ok) {
      return true;
    }
    const failed = await supabase.rpc("meta_fail_lead_inbox", {
      p_id: row.id,
      p_lease_token: row.lease_token,
      p_error_code: result.code,
      p_retryable: result.retryable,
    });
    if (failed.error) receiptRecoveryPending = true;
    return false;
  }));
  const succeeded =
    outcomes.filter((outcome) =>
      outcome.status === "fulfilled" && outcome.value
    ).length;
  const failed =
    outcomes.filter((outcome) =>
      outcome.status === "fulfilled" && !outcome.value
    ).length;
  if (outcomes.some((outcome) => outcome.status === "rejected")) {
    receiptRecoveryPending = true;
  }
  if (receiptRecoveryPending) {
    return new Response("recovery_pending", { status: 503 });
  }
  return Response.json({
    receipts_claimed: receipts.length,
    claimed: rows.length,
    succeeded,
    failed,
  });
}

if (import.meta.main) {
  Deno.serve((request) => handleProcessMetaLeadRequest(request));
}
