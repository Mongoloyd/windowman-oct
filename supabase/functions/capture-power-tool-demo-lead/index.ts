// supabase/functions/capture-power-tool-demo-lead/index.ts
//
// PowerToolDemo / no-quote progressive lead capture.
// Separate from capture-truth-gate-lead (quote-holder TruthGate path).
//
// Hard rules:
//   - Service-role writer only; verify_jwt = false.
//   - source must be exactly "power-tool-demo".
//   - Source-scoped lookups: session_id + source (never session-only RPC).
//   - Never elevate phone_verified or unlock report on this path.
//   - No PII in logs. Generic errors to client.

import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { normalizePhone } from "../_shared/normalizePhone.ts";
import { emitLeadActivity } from "../_shared/emitLeadActivity.ts";

const FUNCTION_NAME = "capture-power-tool-demo-lead";
const SOURCE = "power-tool-demo";
const GENERIC_ERROR =
  "We could not save that yet. Please try again.";
const MAX_PAYLOAD_BYTES = 8 * 1024;

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

const FREE_TEXT_KEYS = new Set([
  "comment",
  "note",
  "message",
  "textarea",
  "raw_text",
]);

const INTAKE_STATUS_OPTIONS = new Set([
  "Just researching options",
  "Ready to get estimates soon",
  "Already have a quote to check",
  "Emergency replacement needed",
]);

const INTAKE_PROPERTY_OPTIONS = new Set([
  "Single-Family Home",
  "Condo / Apartment",
  "Townhouse",
  "Commercial / Business",
]);

const INTAKE_SCOPE_OPTIONS = new Set([
  "1 to 5 Openings",
  "6 to 10 Openings",
  "11 to 15 Openings",
  "16+ Openings",
]);

const INTAKE_LOGISTICS_OPTIONS = new Set([
  "1st Floor Only — No HOA",
  "Multi-Story Installation",
  "HOA Approval Required",
  "Multi-Story + HOA Required",
]);

const INTAKE_TIMELINE_OPTIONS = new Set([
  "Hurricane Protection / Immediate",
  "Lower Insurance / 1-3 Months",
  "Replacing Old Windows / Planning Ahead",
  "New Construction / Just Researching",
]);

type Action = "create" | "update_zip" | "update_phone" | "update_intake";

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
  has_intake?: boolean;
  quote_holder_shortcut?: boolean;
  http_status?: number;
}

const PERSISTED_STAGES = new Set<string>([
  "power_tool_demo_create_failed",
  "power_tool_demo_create_succeeded",
  "power_tool_demo_create_reused",
  "power_tool_demo_update_zip_failed",
  "power_tool_demo_update_zip_succeeded",
  "power_tool_demo_update_phone_failed",
  "power_tool_demo_update_phone_succeeded",
  "power_tool_demo_update_intake_failed",
  "power_tool_demo_update_intake_succeeded",
  "power_tool_demo_validation_failed",
  "power_tool_demo_unexpected_error",
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
  return jsonResponse(
    { success: false, code, message: GENERIC_ERROR },
    status,
  );
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

function asSafeJsonObject(
  v: unknown,
): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function audit(
  admin: SupabaseClient | null,
  evt: Omit<AuditEvent, "ts" | "fn">,
): void {
  const fullEvt: AuditEvent = {
    ...evt,
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
    admin
      .from("event_logs")
      .insert({
        event_name: evt.stage,
        session_id: evt.session_id_prefix
          ? `${evt.session_id_prefix}…`
          : null,
        route: "/",
        metadata: fullEvt as unknown as Record<string, unknown>,
      })
      .then(({ error }) => {
        if (error) {
          console.warn(`[${FUNCTION_NAME}:audit] event_logs insert failed`, {
            stage: evt.stage,
            code: error.code,
          });
        }
      });
  }
}

function hasRejectedFreeText(body: Record<string, unknown>): boolean {
  for (const key of FREE_TEXT_KEYS) {
    const val = body[key];
    if (typeof val === "string" && val.trim().length > 0) return true;
  }
  return false;
}

function parseAction(v: unknown): Action | null {
  if (
    v === "create" || v === "update_zip" || v === "update_phone" ||
    v === "update_intake"
  ) {
    return v;
  }
  return null;
}

interface BaseContext {
  action: Action;
  session_id: string;
  source: typeof SOURCE;
  client_slug: string;
  lead_id: string | null;
}

function parseBase(
  body: Record<string, unknown>,
):
  | { ok: true; ctx: BaseContext }
  | { ok: false; code: string } {
  const action = parseAction(body.action);
  if (!action) return { ok: false, code: "invalid_action" };

  const session_id = asRequiredString(body.session_id, 100);
  if (!session_id) return { ok: false, code: "invalid_session_id" };

  const sourceRaw = asRequiredString(body.source, 64);
  if (sourceRaw !== SOURCE) return { ok: false, code: "invalid_source" };

  const lead_id_raw = asNullableString(body.lead_id, 64);
  const lead_id = lead_id_raw && UUID_RE.test(lead_id_raw)
    ? lead_id_raw
    : null;

  if (lead_id_raw && !lead_id) {
    return { ok: false, code: "invalid_lead_id" };
  }

  if (hasRejectedFreeText(body)) {
    return { ok: false, code: "free_text_not_allowed" };
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

async function findDemoLead(
  admin: SupabaseClient,
  sessionId: string,
  leadId: string | null,
) {
  let query = admin
    .from("leads")
    .select(
      "id, session_id, source, client_slug, qualification_answers_json, email, phone_e164",
    )
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

async function handleCreate(
  admin: SupabaseClient,
  ctx: BaseContext,
  body: Record<string, unknown>,
): Promise<Response> {
  audit(admin, {
    stage: "power_tool_demo_create_started",
    status: "started",
    action: "create",
    session_id_prefix: sessionIdPrefix(ctx.session_id),
    client_slug: ctx.client_slug,
  });

  const first_name = asRequiredString(body.first_name, 100);
  if (!first_name || first_name.length < 2) {
    audit(admin, {
      stage: "power_tool_demo_validation_failed",
      status: "failed",
      action: "create",
      session_id_prefix: sessionIdPrefix(ctx.session_id),
      error_code: "invalid_first_name",
    });
    return fail("invalid_first_name");
  }

  const rawEmail = asRequiredString(body.email, 255);
  const email = rawEmail ? rawEmail.toLowerCase() : null;
  if (!email || !EMAIL_RE.test(email)) {
    audit(admin, {
      stage: "power_tool_demo_validation_failed",
      status: "failed",
      action: "create",
      session_id_prefix: sessionIdPrefix(ctx.session_id),
      error_code: "invalid_email",
      has_email: false,
    });
    return fail("invalid_email");
  }

  const query_params = asSafeJsonObject(body.query_params);
  const attribution = asSafeJsonObject(body.attribution);

  const { data: existing, error: lookupErr } = await findDemoLead(
    admin,
    ctx.session_id,
    null,
  );

  if (lookupErr) {
    audit(admin, {
      stage: "power_tool_demo_create_failed",
      status: "failed",
      action: "create",
      session_id_prefix: sessionIdPrefix(ctx.session_id),
      error_code: lookupErr.code || "lookup_failed",
    });
    return fail("lookup_failed", 500);
  }

  if (existing?.id) {
    audit(admin, {
      stage: "power_tool_demo_create_reused",
      status: "reused",
      action: "create",
      session_id_prefix: sessionIdPrefix(ctx.session_id),
      lead_id: existing.id,
      client_slug: ctx.client_slug,
      has_email: true,
    });
    return successResponse(
      existing.id,
      existing.session_id ?? ctx.session_id,
      "demo_created",
      true,
    );
  }

  const nowIso = new Date().toISOString();
  const insertRow: Record<string, unknown> = {
    session_id: ctx.session_id,
    source: SOURCE,
    lead_source: SOURCE,
    client_slug: ctx.client_slug,
    first_name,
    email,
    status: "new",
    funnel_stage: "demo_created",
    phone_verified: false,
    phone_verified_at: null,
    report_unlocked_at: null,
    qualification_answers_json: { origin: "power_tool_demo" },
    utm_source: asNullableString(body.utm_source, 255),
    utm_medium: asNullableString(body.utm_medium, 255),
    utm_campaign: asNullableString(body.utm_campaign, 255),
    utm_term: asNullableString(body.utm_term, 255),
    utm_content: asNullableString(body.utm_content, 255),
    fbclid: asNullableString(body.fbclid, 500),
    gclid: asNullableString(body.gclid, 500),
    fbc: asNullableString(body.fbc, 500),
    fbp: asNullableString(body.fbp, 500),
    landing_page_url: asNullableString(body.landing_page_url, 1000),
    first_page_path: asNullableString(body.first_page_path, 500),
    initial_referrer: asNullableString(body.initial_referrer, 1000),
    query_params: query_params ?? {},
    attribution: attribution ?? {},
    updated_at: nowIso,
  };

  const { data, error } = await admin
    .from("leads")
    .insert(insertRow)
    .select("id, session_id")
    .single();

  if (error || !data?.id) {
    audit(admin, {
      stage: "power_tool_demo_create_failed",
      status: "failed",
      action: "create",
      session_id_prefix: sessionIdPrefix(ctx.session_id),
      error_code: error?.code || "insert_failed",
      has_email: true,
      client_slug: ctx.client_slug,
    });
    return fail("insert_failed", 500);
  }

  audit(admin, {
    stage: "power_tool_demo_create_succeeded",
    status: "succeeded",
    action: "create",
    session_id_prefix: sessionIdPrefix(ctx.session_id),
    lead_id: data.id,
    has_email: true,
    client_slug: ctx.client_slug,
  });

  return successResponse(data.id, data.session_id ?? ctx.session_id, "demo_created");
}

async function handleUpdateZip(
  admin: SupabaseClient,
  ctx: BaseContext,
  body: Record<string, unknown>,
): Promise<Response> {
  const zip_code = asRequiredString(body.zip_code, 5);
  if (!zip_code || !ZIP_RE.test(zip_code)) {
    audit(admin, {
      stage: "power_tool_demo_validation_failed",
      status: "failed",
      action: "update_zip",
      session_id_prefix: sessionIdPrefix(ctx.session_id),
      error_code: "invalid_zip",
    });
    return fail("invalid_zip");
  }

  const { data: lead, error: lookupErr } = await findDemoLead(
    admin,
    ctx.session_id,
    ctx.lead_id,
  );

  if (lookupErr || !lead?.id) {
    audit(admin, {
      stage: "power_tool_demo_update_zip_failed",
      status: "failed",
      action: "update_zip",
      session_id_prefix: sessionIdPrefix(ctx.session_id),
      lead_id: ctx.lead_id,
      error_code: lookupErr?.code || "lead_not_found",
      has_zip: true,
    });
    return fail("lead_not_found", lookupErr ? 500 : 404);
  }

  const { error: updateErr } = await admin
    .from("leads")
    .update({
      zip: zip_code,
      funnel_stage: "demo_zip",
      updated_at: new Date().toISOString(),
    })
    .eq("id", lead.id)
    .eq("session_id", ctx.session_id)
    .eq("source", SOURCE);

  if (updateErr) {
    audit(admin, {
      stage: "power_tool_demo_update_zip_failed",
      status: "failed",
      action: "update_zip",
      session_id_prefix: sessionIdPrefix(ctx.session_id),
      lead_id: lead.id,
      error_code: updateErr.code || "update_failed",
      has_zip: true,
    });
    return fail("update_failed", 500);
  }

  audit(admin, {
    stage: "power_tool_demo_update_zip_succeeded",
    status: "succeeded",
    action: "update_zip",
    session_id_prefix: sessionIdPrefix(ctx.session_id),
    lead_id: lead.id,
    has_zip: true,
  });

  return successResponse(lead.id, ctx.session_id, "demo_zip");
}

async function handleUpdatePhone(
  admin: SupabaseClient,
  ctx: BaseContext,
  body: Record<string, unknown>,
): Promise<Response> {
  const phoneRaw = asRequiredString(body.phone, 40);
  if (!phoneRaw) {
    audit(admin, {
      stage: "power_tool_demo_validation_failed",
      status: "failed",
      action: "update_phone",
      session_id_prefix: sessionIdPrefix(ctx.session_id),
      error_code: "invalid_phone",
      has_phone: false,
    });
    return fail("invalid_phone");
  }

  const phone_e164 = normalizePhone(phoneRaw);
  if (!/^\+1\d{10}$/.test(phone_e164)) {
    audit(admin, {
      stage: "power_tool_demo_validation_failed",
      status: "failed",
      action: "update_phone",
      session_id_prefix: sessionIdPrefix(ctx.session_id),
      error_code: "invalid_phone",
      has_phone: true,
    });
    return fail("invalid_phone");
  }

  const { data: lead, error: lookupErr } = await findDemoLead(
    admin,
    ctx.session_id,
    ctx.lead_id,
  );

  if (lookupErr || !lead?.id) {
    audit(admin, {
      stage: "power_tool_demo_update_phone_failed",
      status: "failed",
      action: "update_phone",
      session_id_prefix: sessionIdPrefix(ctx.session_id),
      lead_id: ctx.lead_id,
      error_code: lookupErr?.code || "lead_not_found",
      has_phone: true,
    });
    return fail("lead_not_found", lookupErr ? 500 : 404);
  }

  const { error: updateErr } = await admin
    .from("leads")
    .update({
      phone_e164,
      funnel_stage: "demo_phone",
      updated_at: new Date().toISOString(),
    })
    .eq("id", lead.id)
    .eq("session_id", ctx.session_id)
    .eq("source", SOURCE);

  if (updateErr) {
    audit(admin, {
      stage: "power_tool_demo_update_phone_failed",
      status: "failed",
      action: "update_phone",
      session_id_prefix: sessionIdPrefix(ctx.session_id),
      lead_id: lead.id,
      error_code: updateErr.code || "update_failed",
      has_phone: true,
    });
    return fail("update_failed", 500);
  }

  audit(admin, {
    stage: "power_tool_demo_update_phone_succeeded",
    status: "succeeded",
    action: "update_phone",
    session_id_prefix: sessionIdPrefix(ctx.session_id),
    lead_id: lead.id,
    has_phone: true,
  });

  return successResponse(lead.id, ctx.session_id, "demo_phone");
}

function validateIntakeField(
  value: unknown,
  allowed: Set<string>,
): string | null {
  const s = asNullableString(value, 200);
  if (!s) return null;
  return allowed.has(s) ? s : "__INVALID__";
}

async function handleUpdateIntake(
  admin: SupabaseClient,
  ctx: BaseContext,
  body: Record<string, unknown>,
): Promise<Response> {
  const quote_holder_shortcut = body.quote_holder_shortcut === true;

  const intake_status = validateIntakeField(
    body.intake_status,
    INTAKE_STATUS_OPTIONS,
  );
  const intake_property = validateIntakeField(
    body.intake_property,
    INTAKE_PROPERTY_OPTIONS,
  );
  const intake_scope = validateIntakeField(body.intake_scope, INTAKE_SCOPE_OPTIONS);
  const intake_logistics = validateIntakeField(
    body.intake_logistics,
    INTAKE_LOGISTICS_OPTIONS,
  );
  const intake_timeline = validateIntakeField(
    body.intake_timeline,
    INTAKE_TIMELINE_OPTIONS,
  );

  const invalidFields = [
    intake_status,
    intake_property,
    intake_scope,
    intake_logistics,
    intake_timeline,
  ].some((v) => v === "__INVALID__");

  if (invalidFields) {
    audit(admin, {
      stage: "power_tool_demo_validation_failed",
      status: "failed",
      action: "update_intake",
      session_id_prefix: sessionIdPrefix(ctx.session_id),
      error_code: "invalid_intake_option",
      has_intake: true,
      quote_holder_shortcut,
    });
    return fail("invalid_intake_option");
  }

  if (quote_holder_shortcut) {
    if (
      intake_status !== "Already have a quote to check" ||
      intake_property || intake_scope || intake_logistics || intake_timeline
    ) {
      audit(admin, {
        stage: "power_tool_demo_validation_failed",
        status: "failed",
        action: "update_intake",
        session_id_prefix: sessionIdPrefix(ctx.session_id),
        error_code: "invalid_shortcut_intake",
        quote_holder_shortcut: true,
        has_intake: true,
      });
      return fail("invalid_shortcut_intake");
    }
  } else {
    const hasAny = intake_status || intake_property || intake_scope ||
      intake_logistics || intake_timeline;
    if (!hasAny) {
      audit(admin, {
        stage: "power_tool_demo_validation_failed",
        status: "failed",
        action: "update_intake",
        session_id_prefix: sessionIdPrefix(ctx.session_id),
        error_code: "missing_intake_fields",
        has_intake: false,
      });
      return fail("missing_intake_fields");
    }
  }

  const answersJson = asSafeJsonObject(body.intake_answers_json);
  if (answersJson) {
    for (const [key, val] of Object.entries(answersJson)) {
      if (typeof val !== "string") continue;
      const trimmed = val.trim();
      if (!trimmed) continue;
      if (key === "status" && !INTAKE_STATUS_OPTIONS.has(trimmed)) {
        return fail("invalid_intake_option");
      }
      if (key === "property" && !INTAKE_PROPERTY_OPTIONS.has(trimmed)) {
        return fail("invalid_intake_option");
      }
      if (key === "scope" && !INTAKE_SCOPE_OPTIONS.has(trimmed)) {
        return fail("invalid_intake_option");
      }
      if (key === "logistics" && !INTAKE_LOGISTICS_OPTIONS.has(trimmed)) {
        return fail("invalid_intake_option");
      }
      if (key === "timeline" && !INTAKE_TIMELINE_OPTIONS.has(trimmed)) {
        return fail("invalid_intake_option");
      }
    }
  }

  const { data: lead, error: lookupErr } = await findDemoLead(
    admin,
    ctx.session_id,
    ctx.lead_id,
  );

  if (lookupErr || !lead?.id) {
    audit(admin, {
      stage: "power_tool_demo_update_intake_failed",
      status: "failed",
      action: "update_intake",
      session_id_prefix: sessionIdPrefix(ctx.session_id),
      lead_id: ctx.lead_id,
      error_code: lookupErr?.code || "lead_not_found",
      has_intake: true,
      quote_holder_shortcut,
    });
    return fail("lead_not_found", lookupErr ? 500 : 404);
  }

  const existingQa = asSafeJsonObject(lead.qualification_answers_json) ?? {};
  const mergedAnswers = {
    ...(asSafeJsonObject(existingQa.intake_answers_json) ?? {}),
    ...(answersJson ?? {}),
  };

  if (intake_status) mergedAnswers.status = intake_status;
  if (intake_property) mergedAnswers.property = intake_property;
  if (intake_scope) mergedAnswers.scope = intake_scope;
  if (intake_logistics) mergedAnswers.logistics = intake_logistics;
  if (intake_timeline) mergedAnswers.timeline = intake_timeline;

  const qualification_answers_json: Record<string, unknown> = {
    ...existingQa,
    origin: "power_tool_demo",
    quote_holder_shortcut,
  };

  if (intake_status) {
    qualification_answers_json.intake_status = intake_status;
  }
  if (intake_property) {
    qualification_answers_json.intake_property = intake_property;
  }
  if (intake_scope) qualification_answers_json.intake_scope = intake_scope;
  if (intake_logistics) {
    qualification_answers_json.intake_logistics = intake_logistics;
  }
  if (intake_timeline) {
    qualification_answers_json.intake_timeline = intake_timeline;
  }
  if (Object.keys(mergedAnswers).length > 0) {
    qualification_answers_json.intake_answers_json = mergedAnswers;
  }

  const funnel_stage = quote_holder_shortcut
    ? "demo_quote_holder_shortcut"
    : "demo_intake_complete";

  const { error: updateErr } = await admin
    .from("leads")
    .update({
      qualification_answers_json,
      funnel_stage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", lead.id)
    .eq("session_id", ctx.session_id)
    .eq("source", SOURCE);

  if (updateErr) {
    audit(admin, {
      stage: "power_tool_demo_update_intake_failed",
      status: "failed",
      action: "update_intake",
      session_id_prefix: sessionIdPrefix(ctx.session_id),
      lead_id: lead.id,
      error_code: updateErr.code || "update_failed",
      has_intake: true,
      quote_holder_shortcut,
    });
    return fail("update_failed", 500);
  }

  audit(admin, {
    stage: "power_tool_demo_update_intake_succeeded",
    status: "succeeded",
    action: "update_intake",
    session_id_prefix: sessionIdPrefix(ctx.session_id),
    lead_id: lead.id,
    has_intake: true,
    quote_holder_shortcut,
  });

  await emitLeadActivity({
    supabaseAdmin: admin,
    leadId: lead.id,
    eventName: "power_demo_submitted",
    metadata: {
      funnel_stage,
      quote_holder_shortcut,
    },
    contact: {
      email: (lead as { email?: string | null }).email ?? null,
      phone_e164: (lead as { phone_e164?: string | null }).phone_e164 ?? null,
    },
  });

  return successResponse(lead.id, ctx.session_id, funnel_stage);
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

  const rawText = await req.text();
  if (rawText.length > MAX_PAYLOAD_BYTES) {
    audit(null, {
      stage: "power_tool_demo_validation_failed",
      status: "failed",
      error_code: "payload_too_large",
    });
    return fail("payload_too_large");
  }

  let bodyJson: unknown;
  try {
    bodyJson = rawText ? JSON.parse(rawText) : null;
  } catch {
    audit(null, {
      stage: "power_tool_demo_validation_failed",
      status: "failed",
      error_code: "invalid_json",
    });
    return fail("invalid_json");
  }

  if (!bodyJson || typeof bodyJson !== "object" || Array.isArray(bodyJson)) {
    audit(null, {
      stage: "power_tool_demo_validation_failed",
      status: "failed",
      error_code: "invalid_body",
    });
    return fail("invalid_body");
  }

  const body = bodyJson as Record<string, unknown>;
  const base = parseBase(body);
  if (!base.ok) {
    audit(null, {
      stage: "power_tool_demo_validation_failed",
      status: "failed",
      error_code: base.code,
    });
    return fail(base.code);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error(`[${FUNCTION_NAME}] missing service-role env`);
    audit(null, {
      stage: "power_tool_demo_unexpected_error",
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
      case "update_zip":
        return await handleUpdateZip(admin, base.ctx, body);
      case "update_phone":
        return await handleUpdatePhone(admin, base.ctx, body);
      case "update_intake":
        return await handleUpdateIntake(admin, base.ctx, body);
      default:
        return fail("invalid_action");
    }
  } catch (err) {
    console.error(`[${FUNCTION_NAME}] unexpected error`, {
      action: base.ctx.action,
      error_code: "unexpected_error",
    });
    audit(admin, {
      stage: "power_tool_demo_unexpected_error",
      status: "failed",
      action: base.ctx.action,
      session_id_prefix: sessionIdPrefix(base.ctx.session_id),
      error_code: "unexpected_error",
    });
    return fail("unexpected_error", 500);
  }
});
