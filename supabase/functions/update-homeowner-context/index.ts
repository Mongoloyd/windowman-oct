/**
 * ═══════════════════════════════════════════════════════════════════════════
 * update-homeowner-context — Phase 10
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Public homeowner-side endpoint that captures the optional Human Context
 * fields (property_type_detail, hoa_or_condo_complexity, handoff_consent_status).
 *
 * Security model (mirrors submit-diagnosis-intake):
 *   - Validates that scan_session_id ↔ lead_id binding is real.
 *   - Validates enum values server-side.
 *   - Only writes to the 3 Phase 10 columns on `leads`.
 *   - Cannot leak any data — only an ack is returned.
 *   - Never touches phone_verified, full_json, or any other gating field.
 *
 * verify_jwt is FALSE (homeowner is unauthenticated at this point — same
 * pattern as submit-diagnosis-intake).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  persistConsentBatch,
  validateConsentRequest,
  validateHandoffContractorConsentConsistency,
  type ParsedConsentRequest,
} from "../_shared/consentCapture.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_PROPERTY = new Set([
  "single_family",
  "condo",
  "townhouse_villa",
  "high_rise",
  "multifamily_investment",
]);
const ALLOWED_HOA = new Set([
  "none",
  "hoa_simple",
  "hoa_complex",
  "high_rise_engineering",
  "unknown",
]);
const ALLOWED_CONSENT = new Set([
  "accepted_today",
  "accepted_tomorrow",
  "text_or_email_first",
  "report_only",
  "unknown",
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const lead_id = typeof body.lead_id === "string" ? body.lead_id : "";
  const scan_session_id = typeof body.scan_session_id === "string"
    ? body.scan_session_id
    : "";
  const property_type_detail = typeof body.property_type_detail === "string"
    ? body.property_type_detail
    : null;
  const hoa_or_condo_complexity =
    typeof body.hoa_or_condo_complexity === "string"
      ? body.hoa_or_condo_complexity
      : null;
  const handoff_consent_status = typeof body.handoff_consent_status === "string"
    ? body.handoff_consent_status
    : null;
  const consentRaw = body.consent;

  if (!UUID_RE.test(lead_id)) {
    return json(400, { error: "invalid_lead_id" });
  }
  if (!UUID_RE.test(scan_session_id)) {
    return json(400, { error: "invalid_scan_session_id" });
  }
  if (
    !property_type_detail && !hoa_or_condo_complexity && !handoff_consent_status &&
    !consentRaw
  ) {
    return json(400, { error: "no_fields_provided" });
  }
  if (
    property_type_detail !== null && !ALLOWED_PROPERTY.has(property_type_detail)
  ) {
    return json(400, { error: "invalid_property_type_detail" });
  }
  if (
    hoa_or_condo_complexity !== null &&
    !ALLOWED_HOA.has(hoa_or_condo_complexity)
  ) {
    return json(400, { error: "invalid_hoa_or_condo_complexity" });
  }
  if (
    handoff_consent_status !== null &&
    !ALLOWED_CONSENT.has(handoff_consent_status)
  ) {
    return json(400, { error: "invalid_handoff_consent_status" });
  }

  let parsedConsent: ParsedConsentRequest | null = null;
  if (consentRaw) {
    const consentParsed = validateConsentRequest(consentRaw, "homeowner-context");
    if (!consentParsed.ok) {
      return json(400, {
        error: consentParsed.code,
        message: consentParsed.message,
      });
    }
    parsedConsent = consentParsed.consent;
  }

  const consistency = validateHandoffContractorConsentConsistency(
    handoff_consent_status,
    parsedConsent,
  );
  if (!consistency.ok) {
    return json(400, {
      error: consistency.code,
      message: consistency.message,
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: session, error: sessionError } = await admin
    .from("scan_sessions")
    .select("id, lead_id")
    .eq("id", scan_session_id)
    .maybeSingle();

  if (sessionError) {
    console.error(
      "[update-homeowner-context] session lookup failed",
      sessionError,
    );
    return json(500, { error: "session_lookup_failed" });
  }
  if (!session || session.lead_id !== lead_id) {
    return json(403, { error: "scan_session_lead_mismatch" });
  }

  if (parsedConsent) {
    const consentPersist = await persistConsentBatch(admin, {
      leadId: lead_id,
      sessionId: scan_session_id,
      consent: parsedConsent,
    });
    if (!consentPersist.ok) {
      return json(500, {
        error: consentPersist.code,
        message: consentPersist.message,
      });
    }
  }

  const hasLeadFieldUpdates = !!(
    property_type_detail ||
    hoa_or_condo_complexity ||
    handoff_consent_status
  );

  if (hasLeadFieldUpdates) {
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (property_type_detail) {
      update.property_type_detail = property_type_detail;
    }
    if (hoa_or_condo_complexity) {
      update.hoa_or_condo_complexity = hoa_or_condo_complexity;
    }
    if (handoff_consent_status) {
      update.handoff_consent_status = handoff_consent_status;
    }

    const { error: updateError } = await admin
      .from("leads")
      .update(update)
      .eq("id", lead_id);

    if (updateError) {
      console.error("[update-homeowner-context] update failed", updateError);
      return json(500, {
        error: "update_failed",
        message:
          "Context could not be saved. Consent may already have been recorded.",
      });
    }
  }

  if (hasLeadFieldUpdates) {
    try {
      await admin.from("lead_events").insert({
        lead_id,
        scan_session_id,
        event_name: "human_context_captured",
        event_source: "homeowner_post_report",
        metadata: {
          property_type_detail,
          hoa_or_condo_complexity,
          handoff_consent_status,
        },
      });
    } catch (e) {
      console.warn(
        "[update-homeowner-context] audit insert failed (non-fatal)",
        e,
      );
    }
  }

  return json(200, { ok: true });
});
