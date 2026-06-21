// supabase/functions/capture-arbitrage-lead/index.ts
//
// ArbitrageEngine progressive lead capture.
// Isolated from capture-truth-gate-lead (quote-holder TruthGate path) and
// capture-power-tool-demo-lead (no-quote demo path).
//
// Hard rules:
//   - Service-role writer only; verify_jwt = false.
//   - source must be exactly "arbitrage-engine".
//   - Source-scoped lookups: session_id + source (never session-only RPC).
//   - Never elevate phone_verified or unlock report on this path.
//   - Never call scanner / OTP / reveal / CAPI / private storage functions.
//   - No PII in logs. Generic errors to client.
//   - external_id and event_id live ONLY inside qualification_answers_json.arbitrage.
//
// This file does not import or modify the PowerTool/TruthGate functions; it
// only mirrors their safe structural patterns.

import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { normalizePhone } from "../_shared/normalizePhone.ts";

const FUNCTION_NAME = "capture-arbitrage-lead";
const SOURCE = "arbitrage-engine";
const GENERIC_ERROR = "We could not save that yet. Please try again.";
const MAX_PAYLOAD_BYTES = 8 * 1024;

// Consent evidence. CONSENT_COPY mirrors the exact current ArbitrageEngine
// contact-step checkbox copy. If the UI copy changes, update this constant in
// lockstep so the stored consent_text_hash remains meaningful.
const CONSENT_VERSION = "arb_contact_v1";
const CONSENT_COPY =
  "I agree to receive automated texts/calls for my quote audit. Consent is not a condition of purchase.";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^\S+@\S+\.\S+$/;
const ZIP_RE = /^\d{5}$/;

const SCOPE_TO_WINDOW_COUNT: Record<string, number> = {
  "1-5": 3,
  "6-10": 8,
  "11-15": 13,
  "15+": 20,
};

const INSTALLER_PREFERENCE_OPTIONS = new Set(["premium", "value"]);
const HAS_ESTIMATE_OPTIONS = new Set(["Yes", "No"]);
const NUM_ESTIMATES_OPTIONS = new Set(["1", "2+"]);
const DEAL_BREAKER_OPTIONS = new Set([
  "Price",
  "Company Reputation",
  "Timing",
  "Financing",
  "Other",
]);
const CALL_INTENT_OPTIONS = new Set(["Yes", "No"]);
const TIMEFRAME_OPTIONS = new Set(["1 Month", "2-3 Months", "Just Researching"]);

// Attribution scalar columns that exist on public.leads and may be promoted
// from the attribution object when present. Strictly additive / null-safe.
const ATTRIBUTION_SCALAR_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "fbc",
  "fbp",
  "landing_page_url",
  "first_page_path",
  "initial_referrer",
] as const;

type ArbAction =
  | "create"
  | "update_identity"
  | "update_call_intent"
  | "update_timeframe";

type AuditStatus = "started" | "succeeded" | "failed" | "reused" | "skipped";

interface AuditEvent {
  ts: string;
  fn: string;
  stage: string;
  status: AuditStatus;
  action?: string;
  session_id_prefix?: string | null;
  lead_id?: string | null;
  source?: string;
  client_slug?: string;
  error_code?: string | null;
  has_email?: boolean;
  has_phone?: boolean;
  has_zip?: boolean;
  has_consent?: boolean;
  reused?: boolean;
  http_status?: number;
}

const PERSISTED_STAGES = new Set<string>([
  "arbitrage_create_failed",
  "arbitrage_create_succeeded",
  "arbitrage_create_reused",
  "arbitrage_update_identity_failed",
  "arbitrage_update_identity_succeeded",
  "arbitrage_update_call_intent_failed",
  "arbitrage_update_call_intent_succeeded",
  "arbitrage_update_timeframe_failed",
  "arbitrage_update_timeframe_succeeded",
  "arbitrage_validation_failed",
  "arbitrage_unexpected_error",
]);

function sessionIdPrefix(sessionId: string | null | undefined): string | null {
  if (!sessionId || typeof sessionId !== "string") return null;
  return sessionId.slice(0, 8);
}

function normalizeClientSlug(input: unknown): string {
  if (typeof input !== "string") return "direct";
  const trimmed = input.trim().slice(0, 100);
  return trimmed || "direct";
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(code: string, status = 400): Response {
  return jsonResponse({ success: false, code, message: GENERIC_ERROR }, status);
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

function asSafeJsonObject(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function audit(
  admin: SupabaseClient | null,
  evt: Omit<AuditEvent, "ts" | "fn"> & { session_id?: string | null },
): Promise<void> {
  const { session_id: _sid, ...rest } = evt as Record<string, unknown> & {
    session_id?: string | null;
  };
  const fullEvt: AuditEvent = {
    ...(rest as Omit<AuditEvent, "ts" | "fn">),
    ts: new Date().toISOString(),
    fn: FUNCTION_NAME,
    source: SOURCE,
  };

  if (evt.status === "failed") {
    console.error(`[${FUNCTION_NAME}:audit]`, fullEvt);
  } else if (evt.status === "skipped") {
    console.warn(`[${FUNCTION_NAME}:audit]`, fullEvt);
  } else {
    console.info(`[${FUNCTION_NAME}:audit]`, fullEvt);
  }

  if (admin && PERSISTED_STAGES.has(evt.stage)) {
    const { error } = await admin
      .from("event_logs")
      .insert({
        event_name: evt.stage,
        session_id: evt.session_id_prefix ? `${evt.session_id_prefix}…` : null,
        route: "/about",
        metadata: fullEvt as unknown as Record<string, unknown>,
      });
    if (error) {
      console.warn(`[${FUNCTION_NAME}:audit] event_logs insert failed`, {
        stage: evt.stage,
        code: error.code,
      });
    }
  }
}

interface BaseContext {
  action: ArbAction;
  session_id: string;
  source: typeof SOURCE;
  client_slug: string;
  lead_id: string | null;
}

function parseAction(v: unknown): ArbAction | null {
  if (
    v === "create" ||
    v === "update_identity" ||
    v === "update_call_intent" ||
    v === "update_timeframe"
  ) {
    return v;
  }
  return null;
}

function parseBase(
  body: Record<string, unknown>,
): { ok: true; ctx: BaseContext } | { ok: false; code: string } {
  const action = parseAction(body.action);
  if (!action) return { ok: false, code: "invalid_action" };

  const session_id = asRequiredString(body.session_id, 64);
  if (!session_id || !UUID_RE.test(session_id)) {
    return { ok: false, code: "invalid_session_id" };
  }

  const sourceRaw = asRequiredString(body.source, 64);
  if (sourceRaw !== SOURCE) return { ok: false, code: "invalid_source" };

  const lead_id_raw = asNullableString(body.lead_id, 64);
  const lead_id = lead_id_raw && UUID_RE.test(lead_id_raw) ? lead_id_raw : null;
  if (lead_id_raw && !lead_id) {
    return { ok: false, code: "invalid_lead_id" };
  }

  return {
    ok: true,
    ctx: {
      action,
      session_id,
      source: SOURCE,
      client_slug: normalizeClientSlug(body.client_slug),
      lead_id,
    },
  };
}

async function findArbitrageLead(
  admin: SupabaseClient,
  sessionId: string,
  leadId: string | null,
) {
  let query = admin
    .from("leads")
    .select("id, session_id, source, client_slug, qualification_answers_json")
    .eq("session_id", sessionId)
    .eq("source", SOURCE);

  if (leadId) {
    query = query.eq("id", leadId);
  }

  return query.maybeSingle();
}

function successResponse(
  leadId: string,
  sessionId: string,
  stage: string,
  reused = false,
): Response {
  return jsonResponse(
    {
      success: true,
      lead_id: leadId,
      session_id: sessionId,
      source: SOURCE,
      stage,
      reused,
    },
    200,
  );
}

/** Build the qualification_answers_json.arbitrage sub-object from intake. */
function buildArbitrageIntake(
  body: Record<string, unknown>,
): { ok: true; intake: Record<string, unknown>; scope: string } | { ok: false; code: string } {
  const intakeRaw = asSafeJsonObject(body.intake) ?? {};

  const scope = asNullableString(intakeRaw.scope, 16);
  if (!scope || !(scope in SCOPE_TO_WINDOW_COUNT)) {
    return { ok: false, code: "invalid_intake_option" };
  }

  const intake: Record<string, unknown> = { scope };

  const installerPreference = asNullableString(intakeRaw.installerPreference, 32);
  if (installerPreference) {
    if (!INSTALLER_PREFERENCE_OPTIONS.has(installerPreference)) {
      return { ok: false, code: "invalid_intake_option" };
    }
    intake.installer_preference = installerPreference;
  }

  const hasEstimate = asNullableString(intakeRaw.hasEstimate, 8);
  if (hasEstimate) {
    if (!HAS_ESTIMATE_OPTIONS.has(hasEstimate)) {
      return { ok: false, code: "invalid_intake_option" };
    }
    intake.has_estimate = hasEstimate;
  }

  const numEstimates = asNullableString(intakeRaw.numEstimates, 8);
  if (numEstimates) {
    if (!NUM_ESTIMATES_OPTIONS.has(numEstimates)) {
      return { ok: false, code: "invalid_intake_option" };
    }
    intake.num_estimates = numEstimates;
  }

  const dealBreaker = asNullableString(intakeRaw.dealBreaker, 64);
  if (dealBreaker) {
    if (!DEAL_BREAKER_OPTIONS.has(dealBreaker)) {
      return { ok: false, code: "invalid_intake_option" };
    }
    intake.deal_breaker = dealBreaker;
  }

  // external_id + event_id are persisted ONLY inside the arbitrage sub-object.
  const externalId = asNullableString(body.external_id, 100);
  if (externalId) intake.external_id = externalId;

  const eventId = asNullableString(body.event_id, 64);
  if (eventId) {
    if (!UUID_RE.test(eventId)) {
      return { ok: false, code: "invalid_event_id" };
    }
    intake.event_id = eventId;
  }

  return { ok: true, intake, scope };
}

function promoteAttributionScalars(
  attribution: Record<string, unknown> | null,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!attribution) return out;
  for (const key of ATTRIBUTION_SCALAR_KEYS) {
    const val = asNullableString(attribution[key], 1000);
    if (val) out[key] = val;
  }
  return out;
}

async function handleCreate(
  admin: SupabaseClient,
  ctx: BaseContext,
  body: Record<string, unknown>,
): Promise<Response> {
  await audit(admin, {
    stage: "arbitrage_create_started",
    status: "started",
    action: "create",
    session_id: ctx.session_id,
    session_id_prefix: sessionIdPrefix(ctx.session_id),
    client_slug: ctx.client_slug,
  });

  // ZIP
  const zip = asRequiredString(body.zip, 5);
  if (!zip || !ZIP_RE.test(zip)) {
    await audit(admin, {
      stage: "arbitrage_validation_failed",
      status: "failed",
      action: "create",
      session_id: ctx.session_id,
      session_id_prefix: sessionIdPrefix(ctx.session_id),
      error_code: "invalid_zip",
    });
    return fail("invalid_zip");
  }

  // Phone (E.164 US)
  const phoneRaw = asRequiredString(body.phone_e164, 40);
  const phone_e164 = phoneRaw ? normalizePhone(phoneRaw) : "";
  if (!/^\+1\d{10}$/.test(phone_e164)) {
    await audit(admin, {
      stage: "arbitrage_validation_failed",
      status: "failed",
      action: "create",
      session_id: ctx.session_id,
      session_id_prefix: sessionIdPrefix(ctx.session_id),
      error_code: "invalid_phone",
    });
    return fail("invalid_phone");
  }

  // Consent required before phone is stored.
  if (body.hasConsent !== true) {
    await audit(admin, {
      stage: "arbitrage_validation_failed",
      status: "failed",
      action: "create",
      session_id: ctx.session_id,
      session_id_prefix: sessionIdPrefix(ctx.session_id),
      error_code: "consent_required",
    });
    return fail("consent_required");
  }

  // Intake (scope required + valid)
  const intakeResult = buildArbitrageIntake(body);
  if (!intakeResult.ok) {
    await audit(admin, {
      stage: "arbitrage_validation_failed",
      status: "failed",
      action: "create",
      session_id: ctx.session_id,
      session_id_prefix: sessionIdPrefix(ctx.session_id),
      error_code: intakeResult.code,
    });
    return fail(intakeResult.code);
  }

  const windowCount = SCOPE_TO_WINDOW_COUNT[intakeResult.scope];

  // Lookup-before-insert (source-scoped).
  const { data: existing, error: lookupErr } = await findArbitrageLead(
    admin,
    ctx.session_id,
    null,
  );

  if (lookupErr) {
    await audit(admin, {
      stage: "arbitrage_create_failed",
      status: "failed",
      action: "create",
      session_id: ctx.session_id,
      session_id_prefix: sessionIdPrefix(ctx.session_id),
      error_code: lookupErr.code || "lookup_failed",
    });
    return fail("lookup_failed", 500);
  }

  if (existing?.id) {
    await audit(admin, {
      stage: "arbitrage_create_reused",
      status: "reused",
      action: "create",
      session_id: ctx.session_id,
      session_id_prefix: sessionIdPrefix(ctx.session_id),
      lead_id: existing.id,
      client_slug: ctx.client_slug,
      reused: true,
    });
    return successResponse(
      existing.id,
      existing.session_id ?? ctx.session_id,
      "arb_contact",
      true,
    );
  }

  // Consent evidence (server-stamped).
  const route = asNullableString(body.route, 200) ?? "/about";
  const consent_text_hash = await sha256Hex(CONSENT_COPY);
  const consent = {
    accepted: true,
    accepted_at: new Date().toISOString(),
    consent_version: CONSENT_VERSION,
    consent_text_hash,
    route,
    source: SOURCE,
    phone_e164,
    session_id: ctx.session_id,
  };

  const attribution = asSafeJsonObject(body.attribution);
  const promotedScalars = promoteAttributionScalars(attribution);

  const qualification_answers_json: Record<string, unknown> = {
    origin: "arbitrage_engine",
    arbitrage: intakeResult.intake,
    consent,
  };

  const nowIso = new Date().toISOString();
  const insertRow: Record<string, unknown> = {
    session_id: ctx.session_id,
    source: SOURCE,
    lead_source: SOURCE,
    client_slug: ctx.client_slug,
    zip,
    phone_e164,
    window_count: windowCount,
    status: "new",
    funnel_stage: "arb_contact",
    phone_verified: false,
    phone_verified_at: null,
    report_unlocked_at: null,
    qualification_answers_json,
    attribution: attribution ?? {},
    ...promotedScalars,
    updated_at: nowIso,
  };

  const { data, error } = await admin
    .from("leads")
    .insert(insertRow)
    .select("id, session_id")
    .single();

  if (error || !data?.id) {
    await audit(admin, {
      stage: "arbitrage_create_failed",
      status: "failed",
      action: "create",
      session_id: ctx.session_id,
      session_id_prefix: sessionIdPrefix(ctx.session_id),
      error_code: error?.code || "insert_failed",
      has_phone: true,
      has_zip: true,
      has_consent: true,
      client_slug: ctx.client_slug,
    });
    return fail("insert_failed", 500);
  }

  await audit(admin, {
    stage: "arbitrage_create_succeeded",
    status: "succeeded",
    action: "create",
    session_id: ctx.session_id,
    session_id_prefix: sessionIdPrefix(ctx.session_id),
    lead_id: data.id,
    has_phone: true,
    has_zip: true,
    has_consent: true,
    client_slug: ctx.client_slug,
  });

  return successResponse(data.id, data.session_id ?? ctx.session_id, "arb_contact");
}

async function handleUpdateIdentity(
  admin: SupabaseClient,
  ctx: BaseContext,
  body: Record<string, unknown>,
): Promise<Response> {
  const nameRaw = asRequiredString(body.name, 100);
  if (!nameRaw || nameRaw.length < 2) {
    await audit(admin, {
      stage: "arbitrage_validation_failed",
      status: "failed",
      action: "update_identity",
      session_id: ctx.session_id,
      session_id_prefix: sessionIdPrefix(ctx.session_id),
      error_code: "invalid_first_name",
    });
    return fail("invalid_first_name");
  }
  const first_name = nameRaw.split(/\s+/)[0].slice(0, 100);

  const rawEmail = asRequiredString(body.email, 255);
  const email = rawEmail ? rawEmail.toLowerCase() : null;
  if (!email || !EMAIL_RE.test(email)) {
    await audit(admin, {
      stage: "arbitrage_validation_failed",
      status: "failed",
      action: "update_identity",
      session_id: ctx.session_id,
      session_id_prefix: sessionIdPrefix(ctx.session_id),
      error_code: "invalid_email",
    });
    return fail("invalid_email");
  }

  const { data: lead, error: lookupErr } = await findArbitrageLead(
    admin,
    ctx.session_id,
    ctx.lead_id,
  );

  if (lookupErr || !lead?.id) {
    await audit(admin, {
      stage: "arbitrage_update_identity_failed",
      status: "failed",
      action: "update_identity",
      session_id: ctx.session_id,
      session_id_prefix: sessionIdPrefix(ctx.session_id),
      lead_id: ctx.lead_id,
      error_code: lookupErr?.code || "lead_not_found",
    });
    return fail("lead_not_found", lookupErr ? 500 : 404);
  }

  const { error: updateErr } = await admin
    .from("leads")
    .update({
      first_name,
      email,
      funnel_stage: "arb_identity",
      updated_at: new Date().toISOString(),
    })
    .eq("id", lead.id)
    .eq("session_id", ctx.session_id)
    .eq("source", SOURCE);

  if (updateErr) {
    await audit(admin, {
      stage: "arbitrage_update_identity_failed",
      status: "failed",
      action: "update_identity",
      session_id: ctx.session_id,
      session_id_prefix: sessionIdPrefix(ctx.session_id),
      lead_id: lead.id,
      error_code: updateErr.code || "update_failed",
    });
    return fail("update_failed", 500);
  }

  await audit(admin, {
    stage: "arbitrage_update_identity_succeeded",
    status: "succeeded",
    action: "update_identity",
    session_id: ctx.session_id,
    session_id_prefix: sessionIdPrefix(ctx.session_id),
    lead_id: lead.id,
    has_email: true,
  });

  return successResponse(lead.id, ctx.session_id, "arb_identity");
}

async function mergeArbitrageAnswer(
  admin: SupabaseClient,
  ctx: BaseContext,
  patch: Record<string, unknown>,
  funnelStage: string,
  failStage: string,
  successStage: string,
  action: ArbAction,
): Promise<Response> {
  const { data: lead, error: lookupErr } = await findArbitrageLead(
    admin,
    ctx.session_id,
    ctx.lead_id,
  );

  if (lookupErr || !lead?.id) {
    await audit(admin, {
      stage: failStage,
      status: "failed",
      action,
      session_id: ctx.session_id,
      session_id_prefix: sessionIdPrefix(ctx.session_id),
      lead_id: ctx.lead_id,
      error_code: lookupErr?.code || "lead_not_found",
    });
    return fail("lead_not_found", lookupErr ? 500 : 404);
  }

  const existingQa = asSafeJsonObject(lead.qualification_answers_json) ?? {};
  const existingArbitrage = asSafeJsonObject(existingQa.arbitrage) ?? {};
  const qualification_answers_json: Record<string, unknown> = {
    ...existingQa,
    arbitrage: { ...existingArbitrage, ...patch },
  };

  const { error: updateErr } = await admin
    .from("leads")
    .update({
      qualification_answers_json,
      funnel_stage: funnelStage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", lead.id)
    .eq("session_id", ctx.session_id)
    .eq("source", SOURCE);

  if (updateErr) {
    await audit(admin, {
      stage: failStage,
      status: "failed",
      action,
      session_id: ctx.session_id,
      session_id_prefix: sessionIdPrefix(ctx.session_id),
      lead_id: lead.id,
      error_code: updateErr.code || "update_failed",
    });
    return fail("update_failed", 500);
  }

  await audit(admin, {
    stage: successStage,
    status: "succeeded",
    action,
    session_id: ctx.session_id,
    session_id_prefix: sessionIdPrefix(ctx.session_id),
    lead_id: lead.id,
  });

  return successResponse(lead.id, ctx.session_id, funnelStage);
}

async function handleUpdateCallIntent(
  admin: SupabaseClient,
  ctx: BaseContext,
  body: Record<string, unknown>,
): Promise<Response> {
  const callIntent = asRequiredString(body.call_intent, 8);
  if (!callIntent || !CALL_INTENT_OPTIONS.has(callIntent)) {
    await audit(admin, {
      stage: "arbitrage_validation_failed",
      status: "failed",
      action: "update_call_intent",
      session_id: ctx.session_id,
      session_id_prefix: sessionIdPrefix(ctx.session_id),
      error_code: "invalid_call_intent",
    });
    return fail("invalid_call_intent");
  }

  return mergeArbitrageAnswer(
    admin,
    ctx,
    { call_intent: callIntent },
    "arb_call_intent",
    "arbitrage_update_call_intent_failed",
    "arbitrage_update_call_intent_succeeded",
    "update_call_intent",
  );
}

async function handleUpdateTimeframe(
  admin: SupabaseClient,
  ctx: BaseContext,
  body: Record<string, unknown>,
): Promise<Response> {
  const timeframe = asRequiredString(body.timeframe, 32);
  if (!timeframe || !TIMEFRAME_OPTIONS.has(timeframe)) {
    await audit(admin, {
      stage: "arbitrage_validation_failed",
      status: "failed",
      action: "update_timeframe",
      session_id: ctx.session_id,
      session_id_prefix: sessionIdPrefix(ctx.session_id),
      error_code: "invalid_timeframe",
    });
    return fail("invalid_timeframe");
  }

  return mergeArbitrageAnswer(
    admin,
    ctx,
    { timeframe },
    "arb_complete",
    "arbitrage_update_timeframe_failed",
    "arbitrage_update_timeframe_succeeded",
    "update_timeframe",
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { success: false, code: "method_not_allowed", message: GENERIC_ERROR },
      405,
    );
  }

  // Backend feature flag — safe/off by default. No DB writes when disabled.
  const progressiveEnabled =
    Deno.env.get("ARBITRAGE_PROGRESSIVE_CAPTURE_ENABLED") === "true";
  if (!progressiveEnabled) {
    return jsonResponse(
      {
        success: false,
        code: "feature_disabled",
        message: "This capture path is temporarily unavailable.",
      },
      200,
    );
  }

  const rawText = await req.text();
  if (rawText.length > MAX_PAYLOAD_BYTES) {
    await audit(null, {
      stage: "arbitrage_validation_failed",
      status: "failed",
      error_code: "payload_too_large",
    });
    return fail("payload_too_large");
  }

  let bodyJson: unknown;
  try {
    bodyJson = rawText ? JSON.parse(rawText) : null;
  } catch {
    await audit(null, {
      stage: "arbitrage_validation_failed",
      status: "failed",
      error_code: "invalid_json",
    });
    return fail("invalid_json");
  }

  if (!bodyJson || typeof bodyJson !== "object" || Array.isArray(bodyJson)) {
    await audit(null, {
      stage: "arbitrage_validation_failed",
      status: "failed",
      error_code: "invalid_body",
    });
    return fail("invalid_body");
  }

  const body = bodyJson as Record<string, unknown>;
  const base = parseBase(body);
  if (!base.ok) {
    await audit(null, {
      stage: "arbitrage_validation_failed",
      status: "failed",
      error_code: base.code,
    });
    return fail(base.code);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error(`[${FUNCTION_NAME}] missing service-role env`);
    await audit(null, {
      stage: "arbitrage_unexpected_error",
      status: "failed",
      error_code: "server_misconfigured",
    });
    return fail("server_misconfigured", 500);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  try {
    switch (base.ctx.action) {
      case "create":
        return await handleCreate(admin, base.ctx, body);
      case "update_identity":
        return await handleUpdateIdentity(admin, base.ctx, body);
      case "update_call_intent":
        return await handleUpdateCallIntent(admin, base.ctx, body);
      case "update_timeframe":
        return await handleUpdateTimeframe(admin, base.ctx, body);
      default:
        return fail("invalid_action");
    }
  } catch (err) {
    console.error(`[${FUNCTION_NAME}] unexpected error`, {
      action: base.ctx.action,
      error_code: "unexpected_error",
    });
    await audit(admin, {
      stage: "arbitrage_unexpected_error",
      status: "failed",
      action: base.ctx.action,
      session_id: base.ctx.session_id,
      session_id_prefix: sessionIdPrefix(base.ctx.session_id),
      error_code: "unexpected_error",
    });
    return fail("unexpected_error", 500);
  }
});
