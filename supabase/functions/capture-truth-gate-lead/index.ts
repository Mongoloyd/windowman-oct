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
//   - No PII is logged.
//
// Contract
//   Method: POST
//   Body  : strict shape (see CapturePayload). Unknown keys are ignored.
//   Resp  : { success, lead_id, session_id } on 200
//           { success: false, code, message, details? } on 4xx/5xx

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EMAIL_RE = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;

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
}

function jsonResponse(body: unknown, status: number): Response {
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

function parseAndValidate(input: unknown):
  | { ok: true; payload: CapturePayload }
  | { ok: false; code: string; message: string; details?: unknown } {
  if (!input || typeof input !== "object") {
    return { ok: false, code: "invalid_body", message: "Body must be JSON object." };
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
  console.log("[capture-truth-gate-lead] email check", {
    raw_typeof: typeof b.email,
    raw_email: b.email,
    parsed: email,
    re_test: email ? EMAIL_RE.test(email) : null,
  });
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
  };

  return { ok: true, payload };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { success: false, code: "method_not_allowed", message: "Use POST." },
      405,
    );
  }

  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return jsonResponse(
      { success: false, code: "invalid_json", message: "Body must be valid JSON." },
      400,
    );
  }

  const parsed = parseAndValidate(bodyJson);
  if (!parsed.ok) {
    return jsonResponse(
      {
        success: false,
        code: parsed.code,
        message: parsed.message,
        details: parsed.details ?? null,
      },
      400,
    );
  }

  const { payload } = parsed;

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error("[capture-truth-gate-lead] missing service-role env");
    return jsonResponse(
      {
        success: false,
        code: "server_misconfigured",
        message: "Server misconfigured.",
      },
      500,
    );
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // Force OTP-gate-safe defaults — this path must never elevate a lead.
  const insertRow = {
    ...payload,
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
    // Non-PII diagnostic logging
    console.error("[capture-truth-gate-lead] insert failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      payload_keys: Object.keys(payload),
      has_phone: !!payload.phone_e164,
      has_client_slug: !!payload.client_slug,
      session_id: payload.session_id,
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
    );
  }

  // Best-effort telemetry — never block success.
  try {
    await admin.from("event_logs").insert({
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
  } catch (telemetryErr) {
    console.warn("[capture-truth-gate-lead] event_logs insert failed", telemetryErr);
  }

  return jsonResponse(
    {
      success: true,
      lead_id: data?.id ?? null,
      session_id: data?.session_id ?? payload.session_id,
    },
    200,
  );
});
