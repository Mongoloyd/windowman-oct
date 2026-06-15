// supabase/functions/capture-truth-gate-lead/index.ts
//
// TruthGate front-door lead capture.
//
// Why this exists
//   Direct browser INSERT into public.leads is RLS-fragile because the same
//   browser session can be either anonymous OR carry an authenticated
//   admin/operator JWT (Supabase JS persists the session in localStorage).
//   The leads/event_logs anon-only insert policies reject the authenticated
//   request with 42501, which surfaces as the orange "Something went wrong"
//   button in TruthGateFlow. This edge function performs the insert with the
//   service role so the front door works in both states without weakening
//   public RLS or exposing service credentials to the client.
//
// Hard rules respected
//   - Service-role key never leaves this function.
//   - Public RLS posture for `leads` is unchanged.
//   - OTP / verified-state columns are forced to safe defaults — this path
//     can never elevate a lead to phone_verified.
//   - No PII is logged. Audit events log structured non-PII metadata only.
//
// Audit logging
//   Every meaningful stage emits a structured `audit()` event with timestamp,
//   stage, status, session_id, lead_id (when known), error_code/message
//   (when applicable), and safe boolean flags (has_phone, has_client_slug).
//   Telemetry/audit insert failures NEVER block funnel success.
//
// Contract
//   Method: POST
//   Body  : strict shape (see CapturePayload). Unknown keys are ignored.
//   Resp  : { success, lead_id, session_id } on 200
//           { success: false, code, message, details? } on 4xx/5xx

import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  hasAttributionPayload,
  mergeAttribution,
  mergeQueryParams,
  promoteLeadScalarFields,
  sanitizeAttributionInput,
  sanitizeQueryParamsInput,
} from "../_shared/attributionMerge.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { persistCanonicalEvent } from "../_shared/tracking/canonicalBridge.ts";

const FUNCTION_NAME = "capture-truth-gate-lead";

const CANONICAL_LEAD_CAPTURED_ENABLED =
  Deno.env.get("CANONICAL_LEAD_CAPTURED_ENABLED") === "true";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EMAIL_RE = /^\S+@\S+\.\S+$/;

const LEAD_SCALAR_SELECT =
  "attribution, query_params, client_slug, utm_source, utm_medium, utm_campaign, utm_term, utm_content, fbclid, gclid, fbc, fbp, ttclid, msclkid, wbraid, gbraid, landing_page_url, first_page_path, initial_referrer";

async function mergeExistingLeadAttribution(
  admin: SupabaseClient,
  leadId: string,
  sanitizedAttribution: Record<string, unknown>,
  sanitizedQueryParams: Record<string, string | string[]>,
): Promise<void> {
  if (!hasAttributionPayload(sanitizedAttribution, sanitizedQueryParams)) {
    return;
  }

  const { data: existing, error } = await admin
    .from("leads")
    .select(LEAD_SCALAR_SELECT)
    .eq("id", leadId)
    .maybeSingle();

  if (error) {
    console.warn(`[${FUNCTION_NAME}] lead attribution fetch failed`, {
      code: error.code,
      message: error.message,
    });
    return;
  }

  const mergedAttribution = mergeAttribution(
    existing?.attribution,
    sanitizedAttribution,
  );
  const mergedQueryParams = mergeQueryParams(
    existing?.query_params,
    sanitizedQueryParams,
  );
  const promoted = promoteLeadScalarFields(
    mergedAttribution,
    (existing ?? {}) as Record<string, unknown>,
  );

  const updateRow: Record<string, unknown> = {
    attribution: mergedAttribution,
    query_params: mergedQueryParams,
    ...promoted,
  };

  const { error: updateErr } = await admin
    .from("leads")
    .update(updateRow)
    .eq("id", leadId);

  if (updateErr) {
    console.warn(`[${FUNCTION_NAME}] lead attribution merge failed`, {
      code: updateErr.code,
      message: updateErr.message,
    });
  }
}

interface LeadCapturedCanonicalParams {
  leadId: string;
  sessionId: string;
  email: string;
  phoneE164: string | null;
  clientSlug: string | null;
  landingPageUrl: string | null;
  firstPagePath: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  source: string;
  attribution: Record<string, unknown>;
}

function pickAttributionString(
  attribution: Record<string, unknown>,
  key: string,
  maxLen = 500,
): string | undefined {
  const val = attribution[key];
  if (typeof val !== "string") return undefined;
  const trimmed = val.trim();
  return trimmed ? trimmed.slice(0, maxLen) : undefined;
}

function buildLeadCapturedAttributionMetadata(
  params: LeadCapturedCanonicalParams,
): Record<string, unknown> {
  const attr = params.attribution;

  return {
    intake_source: params.source,
    utm_source: params.utmSource ?? pickAttributionString(attr, "utm_source", 255),
    utm_medium: params.utmMedium ?? pickAttributionString(attr, "utm_medium", 255),
    utm_campaign: params.utmCampaign ?? pickAttributionString(attr, "utm_campaign", 255),
    utm_content: params.utmContent ?? pickAttributionString(attr, "utm_content", 255),
    utm_term: params.utmTerm ?? pickAttributionString(attr, "utm_term", 255),
    wm_intent: pickAttributionString(attr, "wm_intent", 32),
    ndclid: pickAttributionString(attr, "ndclid"),
    nd_lead_id: pickAttributionString(attr, "nd_lead_id"),
    nd_form_id: pickAttributionString(attr, "nd_form_id"),
    nd_ad_id: pickAttributionString(attr, "nd_ad_id"),
    nd_ad_group_id: pickAttributionString(attr, "nd_ad_group_id"),
    nd_campaign_id: pickAttributionString(attr, "nd_campaign_id"),
    landing_page_url:
      params.landingPageUrl ?? pickAttributionString(attr, "landing_page_url", 1000),
    current_page_url: pickAttributionString(attr, "current_page_url", 1000),
    landing_path: params.firstPagePath ?? pickAttributionString(attr, "landing_page", 500),
    referrer: pickAttributionString(attr, "referrer", 1000),
    has_phone: !!params.phoneE164,
  };
}

/**
 * Preserve site-wide attribution fields not yet in attributionMerge allowlist.
 */
function preserveSiteWideAttributionFields(
  sanitized: Record<string, unknown>,
  raw: unknown,
): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return sanitized;
  }

  const src = raw as Record<string, unknown>;
  const out = { ...sanitized };

  const currentPageUrl = asNullableString(src.current_page_url, 1000);
  if (currentPageUrl) out.current_page_url = currentPageUrl;

  if (typeof src.first_touch_at === "number" && Number.isFinite(src.first_touch_at)) {
    out.first_touch_at = Math.trunc(src.first_touch_at);
  }
  if (typeof src.latest_touch_at === "number" && Number.isFinite(src.latest_touch_at)) {
    out.latest_touch_at = Math.trunc(src.latest_touch_at);
  }

  return out;
}

/**
 * Fail-closed canonical lead_captured scaffold. No-op while
 * CANONICAL_LEAD_CAPTURED_ENABLED is false. Non-fatal when enabled later.
 */
async function maybePersistLeadCapturedCanonical(
  admin: SupabaseClient,
  params: LeadCapturedCanonicalParams,
): Promise<void> {
  if (!CANONICAL_LEAD_CAPTURED_ENABLED) {
    return;
  }

  const journeyRoute = params.firstPagePath ?? params.landingPageUrl ?? "/";

  try {
    await persistCanonicalEvent(admin, {
      eventId:
        `wmc_lead_captured_lead-${params.leadId}_session-${params.sessionId}`,
      eventName: "lead_captured",
      leadId: params.leadId,
      clientSlug: params.clientSlug ?? undefined,
      payload: {
        identity: {
          leadId: params.leadId,
          email: params.email,
          phone: params.phoneE164 ?? undefined,
        },
        journey: {
          route: journeyRoute,
          flow: "public",
          sessionId: params.sessionId,
        },
        source: {
          sourceSystem: "edge_function",
          utmSource: params.utmSource ?? undefined,
          utmMedium: params.utmMedium ?? undefined,
          utmCampaign: params.utmCampaign ?? undefined,
          referrer: pickAttributionString(params.attribution, "referrer", 1000),
        },
        metadata: buildLeadCapturedAttributionMetadata(params),
      },
    });
  } catch (err) {
    console.warn(
      `[${FUNCTION_NAME}] lead_captured canonical scaffold failed (non-fatal)`,
      {
        lead_id: params.leadId,
        session_id: params.sessionId,
        message: err instanceof Error ? err.message : String(err),
      },
    );
  }
}

interface CapturePayload {
  session_id: string;
  first_name: string;
  email: string;
  phone_e164: string | null;
  county: string | null;
  project_type: string | null;
  window_count: number | null;
  quote_range: string | null;
  source: string;

  client_slug: string | null;

  // Attribution (all optional; null-safe)
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  fbclid: string | null;
  gclid: string | null;
  fbc: string | null;
  fbp: string | null;
  landing_page_url: string | null;
  first_page_path: string | null;
  initial_referrer: string | null;

  attribution: Record<string, unknown>;
  query_params: Record<string, string | string[]>;
}

type AuditStatus = "started" | "succeeded" | "failed" | "reused" | "skipped";

interface AuditEvent {
  ts: string;
  fn: string;
  stage: string;
  status: AuditStatus;
  session_id?: string | null;
  lead_id?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  has_phone?: boolean;
  has_client_slug?: boolean;
  http_status?: number;
}

/**
 * Stages that are persisted to `event_logs`. All other stages remain
 * console-only. This keeps the persisted audit trail focused on outcomes
 * and failures, not internal step-by-step noise.
 */
const PERSISTED_STAGES = new Set<string>([
  "validation_failed",
  "lead_insert_failed",
  "lead_insert_succeeded",
  "lead_reused",
  "unexpected_error",
  "response_sent",
]);

/**
 * Emit a structured audit event. Always console-logged at the appropriate
 * level. Persists to `event_logs` only for summary/failure stages
 * (see PERSISTED_STAGES). Persistence failures NEVER block funnel success.
 *
 * Strictly non-PII: never accepts raw email, phone, name, or file content.
 */
function audit(
  admin: SupabaseClient | null,
  evt: Omit<AuditEvent, "ts" | "fn">,
): void {
  const fullEvt: AuditEvent = {
    ...evt,
    ts: new Date().toISOString(),
    fn: FUNCTION_NAME,
  };

  if (evt.status === "failed") {
    console.error(`[${FUNCTION_NAME}:audit]`, fullEvt);
  } else if (evt.status === "skipped") {
    console.warn(`[${FUNCTION_NAME}:audit]`, fullEvt);
  } else {
    console.info(`[${FUNCTION_NAME}:audit]`, fullEvt);
  }

  // Persist only summary / failure / validation stages. Best-effort.
  if (admin && PERSISTED_STAGES.has(evt.stage)) {
    admin
      .from("event_logs")
      .insert({
        event_name: "truthgate_capture_audit",
        session_id: evt.session_id ?? null,
        route: "/",
        metadata: fullEvt as unknown as Record<string, unknown>,
      })
      .then(({ error }) => {
        if (error) {
          console.warn(`[${FUNCTION_NAME}:audit] event_logs insert failed`, {
            stage: evt.stage,
            code: error.code,
            message: error.message,
          });
        }
      });
  }
}

function jsonResponse(
  body: unknown,
  status: number,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asNullableString(v: unknown, max = 500): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, max);
}

function asRequiredString(v: unknown, max = 500): string | null {
  const s = asNullableString(v, max);
  return s && s.length > 0 ? s : null;
}

function asNullableInt(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
    return Math.trunc(Number(v));
  }
  return null;
}

function normalizeIntentValue(value: string): string {
  return value.trim().toLowerCase().replace(/-/g, "_");
}

function hasNoQuoteIntent(
  attribution: Record<string, unknown> | null | undefined,
  queryParams: Record<string, string | string[]> | null | undefined,
): boolean {
  const intents: string[] = [];

  if (typeof attribution?.wm_intent === "string") {
    intents.push(attribution.wm_intent);
  }

  const queryIntent = queryParams?.wm_intent;
  if (typeof queryIntent === "string") {
    intents.push(queryIntent);
  } else if (Array.isArray(queryIntent)) {
    for (const value of queryIntent) {
      if (typeof value === "string") {
        intents.push(value);
      }
    }
  }

  return intents.map(normalizeIntentValue).includes("no_quote");
}

/**
 * Paid no_quote leads must complete organic quiz UI steps to reach the form.
 * Nullify project-scope quiz scalars before insert so CPL/ROI reporting is not
 * polluted by dummy answers. County is preserved (geo/routing). Attribution and
 * query_params (including wm_intent) are untouched.
 */
function scrubNoQuoteOrganicFields(payload: CapturePayload): void {
  if (!hasNoQuoteIntent(payload.attribution, payload.query_params)) return;

  payload.window_count = null;
  payload.project_type = null;
  payload.quote_range = null;
}

function parseAndValidate(input: unknown):
  | { ok: true; payload: CapturePayload }
  | { ok: false; code: string; message: string; details?: unknown } {
  if (!input || typeof input !== "object") {
    return {
      ok: false,
      code: "invalid_body",
      message: "Body must be JSON object.",
    };
  }

  const b = input as Record<string, unknown>;

  const session_id = asRequiredString(b.session_id, 64);
  if (!session_id || !UUID_RE.test(session_id)) {
    return {
      ok: false,
      code: "invalid_session_id",
      message: "session_id must be a valid UUID.",
    };
  }

  const first_name = asRequiredString(b.first_name, 100);
  if (!first_name || first_name.length < 2) {
    return {
      ok: false,
      code: "invalid_first_name",
      message: "first_name is required (2+ chars).",
    };
  }

  const rawEmail = asRequiredString(b.email, 255);
  const email = rawEmail ? rawEmail.toLowerCase() : null;
  if (!email || !EMAIL_RE.test(email)) {
    return {
      ok: false,
      code: "invalid_email",
      message: "A valid email is required.",
    };
  }

  // phone_e164 is optional. If present, must look like +1XXXXXXXXXX.
  let phone_e164 = asNullableString(b.phone_e164, 32);
  if (phone_e164 && !/^\+\d{10,15}$/.test(phone_e164)) {
    // Don't fail the whole submit on a malformed optional phone — just drop it.
    phone_e164 = null;
  }

  const source = asRequiredString(b.source, 64) ?? "truth-gate";

  const sanitizedAttribution = preserveSiteWideAttributionFields(
    sanitizeAttributionInput(b.attribution),
    b.attribution,
  );
  const sanitizedQueryParams = sanitizeQueryParamsInput(b.query_params);

  const payload: CapturePayload = {
    session_id,
    first_name,
    email,
    phone_e164,
    county: asNullableString(b.county, 100),
    project_type: asNullableString(b.project_type, 100),
    window_count: asNullableInt(b.window_count),
    quote_range: asNullableString(b.quote_range, 50),
    source,

    client_slug: asNullableString(b.client_slug, 100),

    utm_source: asNullableString(b.utm_source, 255),
    utm_medium: asNullableString(b.utm_medium, 255),
    utm_campaign: asNullableString(b.utm_campaign, 255),
    utm_term: asNullableString(b.utm_term, 255),
    utm_content: asNullableString(b.utm_content, 255),
    fbclid: asNullableString(b.fbclid, 500),
    gclid: asNullableString(b.gclid, 500),
    fbc: asNullableString(b.fbc, 500),
    fbp: asNullableString(b.fbp, 500),
    landing_page_url: asNullableString(b.landing_page_url, 1000),
    first_page_path: asNullableString(b.first_page_path, 500),
    initial_referrer: asNullableString(b.initial_referrer, 1000),

    attribution: sanitizedAttribution,
    query_params: sanitizedQueryParams,
  };

  return { ok: true, payload };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }

  const corsHeaders = getCorsHeaders(req);

  // request_received audit (no admin client yet — console-only)
  audit(null, { stage: "request_received", status: "started" });

  if (req.method !== "POST") {
    return jsonResponse(
      { success: false, code: "method_not_allowed", message: "Use POST." },
      405,
      corsHeaders,
    );
  }

  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    audit(null, {
      stage: "validation_failed",
      status: "failed",
      error_code: "invalid_json",
      error_message: "Body must be valid JSON.",
    });
    return jsonResponse(
      {
        success: false,
        code: "invalid_json",
        message: "Body must be valid JSON.",
      },
      400,
      corsHeaders,
    );
  }

  const parsed = parseAndValidate(bodyJson);
  if (!parsed.ok) {
    audit(null, {
      stage: "validation_failed",
      status: "failed",
      error_code: parsed.code,
      error_message: parsed.message,
    });
    return jsonResponse(
      {
        success: false,
        code: parsed.code,
        message: parsed.message,
        details: parsed.details ?? null,
      },
      400,
      corsHeaders,
    );
  }

  const { payload } = parsed;
  scrubNoQuoteOrganicFields(payload);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error(`[${FUNCTION_NAME}] missing service-role env`);
    audit(null, {
      stage: "lead_insert_failed",
      status: "failed",
      session_id: payload.session_id,
      error_code: "server_misconfigured",
      error_message: "Service credentials missing.",
    });
    return jsonResponse(
      {
        success: false,
        code: "server_misconfigured",
        message: "Server misconfigured.",
      },
      500,
      corsHeaders,
    );
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  audit(admin, {
    stage: "lead_insert_started",
    status: "started",
    session_id: payload.session_id,
    has_phone: !!payload.phone_e164,
    has_client_slug: !!payload.client_slug,
  });

  // ── Idempotency: lookup existing lead bound to this session_id ───────────
  // If found, reuse it. Do not insert a duplicate. Do not update OTP /
  // verified state. Do not overwrite PII in this pass.
  try {
    const { data: existing, error: lookupErr } = await admin.rpc(
      "get_lead_by_session",
      { p_session_id: payload.session_id },
    );

    if (lookupErr) {
      // Lookup failure is non-fatal — fall through to insert. Postgres unique
      // constraints (if any) will still protect against true duplicates.
      console.warn(`[${FUNCTION_NAME}] session lookup failed`, {
        code: lookupErr.code,
        message: lookupErr.message,
      });
    } else if (
      Array.isArray(existing) && existing.length > 0 && existing[0]?.id
    ) {
      const reusedLeadId = existing[0].id as string;
      await mergeExistingLeadAttribution(
        admin,
        reusedLeadId,
        parsed.payload.attribution,
        parsed.payload.query_params,
      );
      await maybePersistLeadCapturedCanonical(admin, {
        leadId: reusedLeadId,
        sessionId: payload.session_id,
        email: payload.email,
        phoneE164: payload.phone_e164,
        clientSlug: payload.client_slug,
        landingPageUrl: payload.landing_page_url,
        firstPagePath: payload.first_page_path,
        utmSource: payload.utm_source,
        utmMedium: payload.utm_medium,
        utmCampaign: payload.utm_campaign,
        utmContent: payload.utm_content,
        utmTerm: payload.utm_term,
        source: payload.source,
        attribution: payload.attribution,
      });
      audit(admin, {
        stage: "lead_reused",
        status: "reused",
        session_id: payload.session_id,
        lead_id: reusedLeadId,
        has_phone: !!payload.phone_e164,
        has_client_slug: !!payload.client_slug,
      });
      audit(admin, {
        stage: "response_sent",
        status: "succeeded",
        session_id: payload.session_id,
        lead_id: reusedLeadId,
        http_status: 200,
      });
      return jsonResponse(
        {
          success: true,
          lead_id: reusedLeadId,
          session_id: payload.session_id,
          reused: true,
        },
        200,
        corsHeaders,
      );
    }
  } catch (e) {
    // Non-fatal — proceed to insert path.
    console.warn(`[${FUNCTION_NAME}] session lookup threw`, String(e));
  }

  // Force OTP-gate-safe defaults — this path must never elevate a lead.
  const promotedFromAttribution = promoteLeadScalarFields(
    payload.attribution,
    {
      utm_source: payload.utm_source,
      utm_medium: payload.utm_medium,
      utm_campaign: payload.utm_campaign,
      utm_term: payload.utm_term,
      utm_content: payload.utm_content,
      fbclid: payload.fbclid,
      gclid: payload.gclid,
      fbc: payload.fbc,
      fbp: payload.fbp,
      landing_page_url: payload.landing_page_url,
      first_page_path: payload.first_page_path,
      initial_referrer: payload.initial_referrer,
      client_slug: payload.client_slug,
    },
  );

  const insertRow = {
    ...payload,
    ...promotedFromAttribution,
    utm_source: payload.utm_source ?? promotedFromAttribution.utm_source ?? null,
    utm_medium: payload.utm_medium ?? promotedFromAttribution.utm_medium ?? null,
    utm_campaign:
      payload.utm_campaign ?? promotedFromAttribution.utm_campaign ?? null,
    utm_term: payload.utm_term ?? promotedFromAttribution.utm_term ?? null,
    utm_content:
      payload.utm_content ?? promotedFromAttribution.utm_content ?? null,
    fbclid: payload.fbclid ?? promotedFromAttribution.fbclid ?? null,
    gclid: payload.gclid ?? promotedFromAttribution.gclid ?? null,
    fbc: payload.fbc ?? promotedFromAttribution.fbc ?? null,
    fbp: payload.fbp ?? promotedFromAttribution.fbp ?? null,
    landing_page_url:
      payload.landing_page_url ?? promotedFromAttribution.landing_page_url ??
      null,
    first_page_path:
      payload.first_page_path ?? promotedFromAttribution.first_page_path ??
      null,
    initial_referrer:
      payload.initial_referrer ?? promotedFromAttribution.initial_referrer ??
      null,
    client_slug:
      payload.client_slug ?? promotedFromAttribution.client_slug ?? null,
    status: "new",
    phone_verified: false,
    phone_verified_at: null,
    otp_state: null,
    otp_failure_count: 0,
    otp_locked_until: null,
    last_otp_verified_at: null,
    report_unlocked_at: null,
  };

  const { data, error } = await admin
    .from("leads")
    .insert(insertRow)
    .select("id, session_id")
    .single();

  if (error) {
    audit(admin, {
      stage: "lead_insert_failed",
      status: "failed",
      session_id: payload.session_id,
      error_code: error.code || "insert_failed",
      error_message: error.message || "Lead insert failed.",
      has_phone: !!payload.phone_e164,
      has_client_slug: !!payload.client_slug,
    });

    return jsonResponse(
      {
        success: false,
        code: error.code || "insert_failed",
        message: error.message || "Lead insert failed.",
        details: error.details ?? null,
        hint: error.hint ?? null,
      },
      500,
      corsHeaders,
    );
  }

  audit(admin, {
    stage: "lead_insert_succeeded",
    status: "succeeded",
    session_id: payload.session_id,
    lead_id: data?.id ?? null,
    has_phone: !!payload.phone_e164,
    has_client_slug: !!payload.client_slug,
  });

  if (data?.id) {
    await maybePersistLeadCapturedCanonical(admin, {
      leadId: data.id,
      sessionId: payload.session_id,
      email: payload.email,
      phoneE164: payload.phone_e164,
      clientSlug: payload.client_slug,
      landingPageUrl: payload.landing_page_url,
      firstPagePath: payload.first_page_path,
      utmSource: payload.utm_source,
      utmMedium: payload.utm_medium,
      utmCampaign: payload.utm_campaign,
      utmContent: payload.utm_content,
      utmTerm: payload.utm_term,
      source: payload.source,
      attribution: payload.attribution,
    });
  }

  // Best-effort business telemetry — never block success.
  try {
    const { error: telemetryErr } = await admin.from("event_logs").insert({
      event_name: payload.phone_e164
        ? "lead_captured_with_phone"
        : "lead_captured_no_phone",
      session_id: payload.session_id,
      route: "/",
      metadata: {
        lead_id: data?.id ?? null,
        county: payload.county,
        has_phone: !!payload.phone_e164,
        client_slug: payload.client_slug,
        source: payload.source,
        timestamp: new Date().toISOString(),
      },
    });
    if (telemetryErr) {
      audit(admin, {
        stage: "telemetry_failed",
        status: "skipped",
        session_id: payload.session_id,
        lead_id: data?.id ?? null,
        error_code: telemetryErr.code,
        error_message: telemetryErr.message,
      });
    }
  } catch (telemetryErr) {
    audit(admin, {
      stage: "telemetry_failed",
      status: "skipped",
      session_id: payload.session_id,
      lead_id: data?.id ?? null,
      error_message: String(telemetryErr),
    });
  }

  audit(admin, {
    stage: "response_sent",
    status: "succeeded",
    session_id: payload.session_id,
    lead_id: data?.id ?? null,
    http_status: 200,
  });

  return jsonResponse(
    {
      success: true,
      lead_id: data?.id ?? null,
      session_id: data?.session_id ?? payload.session_id,
    },
    200,
    corsHeaders,
  );
});
