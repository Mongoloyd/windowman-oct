/**
 * submit-diagnosis-intake — Phase 2 hinge persistence.
 *
 * Persists a completed post-report diagnosis intake row, writes a canonical
 * `diagnosis_completed` lead event, and stamps the lead's funnel state.
 *
 * Service-role writer. No JWT required (frontend invokes with anon key).
 *
 * IDENTITY AUTHORITY (server-derived):
 *   The browser sends only `scan_session_id`. It MUST NOT send or rely on the
 *   canonical `lead_id` — that value lives behind a service-role-only RPC and
 *   is resolved HERE, privately, from `scan_sessions.lead_id`.
 *
 *   A legacy client-supplied `lead_id` is accepted only as OPTIONAL, UNTRUSTED
 *   input: absent → ignored; equal to the server value → allowed; different →
 *   the request is rejected before any writes.
 *
 * ELIGIBILITY (fail-closed):
 *   A session may submit a diagnosis intake only when it satisfies the SAME
 *   durable, session-bound authorization the verified-reveal path enforces in
 *   `public.get_analysis_full`
 *   (supabase/migrations/20260428120000_restore_get_analysis_full_strict_scan_binding.sql):
 *     - a `phone_verifications` row bound to THIS scan_session_id with
 *       status = 'verified' and lead_id = scan_sessions.lead_id, AND
 *     - leads.phone_verified = true (stamped by verify-otp on OTP success).
 *   Diagnosis is reachable only after a successful reveal, so legitimate users
 *   provably satisfy this. Possessing a UUID alone is never sufficient.
 *
 * The HTTP/Deno.serve path is import-safe: the server is only started under
 * `if (import.meta.main)`, so importing this module (e.g. from index_test.ts)
 * does not bind a port. DB access for lead-authority resolution is behind the
 * `DiagnosisLeadFetcher` seam so it can be unit-tested with an injected stub
 * (matching the pattern used by start-upload-scan-session).
 */

import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SubmitBody {
  lead_id?: unknown;
  scan_session_id?: unknown;
  analysis_id?: unknown;
  report_grade?: unknown;
  primary_diagnosis?: unknown;
  secondary_clarifiers?: unknown;
  other_text?: unknown;
  window_intelligence?: unknown;
  counter_offer?: unknown;
  top_insights_snapshot?: unknown;
  confidence?: unknown;
  prescription_path?: unknown;
  attribution_snapshot?: unknown;
}

export const isUuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

const isStr = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0;

const asObj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

/**
 * Generic, PII-free error messages. Failure responses must never leak lead
 * identity, name, phone, county, or eligibility-field values.
 */
export const INVALID_CONTEXT_ERROR = "Invalid report context";
export const NOT_VERIFIED_ERROR = "Report not verified for this session";

// ── Lead-authority DI seam ──────────────────────────────────────────────────
// Narrow database access needed to derive the canonical lead_id and evaluate
// the established eligibility rule. Injected so it can be stubbed in tests.

/** Minimal scan-session row: only the canonical lead pointer is needed. */
export interface ScanSessionLeadRow {
  lead_id: string | null;
}

/** Minimal lead row: only the durable verification flag is needed. */
export interface LeadEligibilityRow {
  phone_verified: boolean | null;
}

export interface DiagnosisLeadFetcher {
  /** Resolve scan_sessions.lead_id. Returns null when the session is unknown. */
  getScanSessionLead(scanSessionId: string): Promise<ScanSessionLeadRow | null>;
  /** Load the lead's durable verification flag. Returns null when absent. */
  getLeadEligibility(leadId: string): Promise<LeadEligibilityRow | null>;
  /**
   * True iff a verified phone_verifications row is bound to BOTH this
   * scan_session_id and this lead_id (mirrors get_analysis_full's strict
   * session binding). This prevents cross-session unlock.
   */
  hasVerifiedSessionBinding(
    scanSessionId: string,
    leadId: string,
  ): Promise<boolean>;
}

export type DiagnosisLeadResolution =
  | { ok: true; leadId: string }
  | { ok: false; status: number; error: string };

/**
 * Derive and authorize the canonical lead for a diagnosis submission.
 *
 * The canonical lead_id is taken ONLY from scan_sessions.lead_id. A legacy,
 * untrusted client-supplied lead_id may accompany the request but is never
 * used for writes — it is only checked for conflict:
 *   absent  → continue with the server-derived value;
 *   equal   → continue;
 *   differs → reject before any writes.
 *
 * Fails closed (no leadId returned) when the session is unknown, has no lead,
 * the lead is missing, or the established session-bound eligibility rule is
 * not satisfied.
 */
export async function resolveDiagnosisLeadAuthority(
  fetcher: DiagnosisLeadFetcher,
  input: { scanSessionId: string; clientLeadId?: string | null },
): Promise<DiagnosisLeadResolution> {
  const scan = await fetcher.getScanSessionLead(input.scanSessionId);
  if (!scan) {
    return { ok: false, status: 400, error: INVALID_CONTEXT_ERROR };
  }

  const canonicalLeadId =
    typeof scan.lead_id === "string" && scan.lead_id.length > 0
      ? scan.lead_id
      : null;
  if (!canonicalLeadId) {
    return { ok: false, status: 400, error: INVALID_CONTEXT_ERROR };
  }

  // Untrusted legacy compatibility: a conflicting client lead_id is rejected
  // BEFORE any eligibility lookups or writes.
  if (
    input.clientLeadId !== undefined &&
    input.clientLeadId !== null &&
    input.clientLeadId !== canonicalLeadId
  ) {
    return { ok: false, status: 400, error: INVALID_CONTEXT_ERROR };
  }

  const lead = await fetcher.getLeadEligibility(canonicalLeadId);
  if (!lead) {
    return { ok: false, status: 400, error: INVALID_CONTEXT_ERROR };
  }
  if (lead.phone_verified !== true) {
    return { ok: false, status: 403, error: NOT_VERIFIED_ERROR };
  }

  const bound = await fetcher.hasVerifiedSessionBinding(
    input.scanSessionId,
    canonicalLeadId,
  );
  if (!bound) {
    return { ok: false, status: 403, error: NOT_VERIFIED_ERROR };
  }

  return { ok: true, leadId: canonicalLeadId };
}

/** Successful response body. Pinned so tests guard the response contract. */
export function buildSuccessBody(
  diagnosisIntakeId: string,
  eventId: string | null,
): { success: true; diagnosis_intake_id: string; event_id: string | null } {
  return {
    success: true,
    diagnosis_intake_id: diagnosisIntakeId,
    event_id: eventId,
  };
}

/** Build a `DiagnosisLeadFetcher` backed by a service-role Supabase client. */
function createSupabaseLeadFetcher(
  supabase: SupabaseClient,
): DiagnosisLeadFetcher {
  return {
    async getScanSessionLead(scanSessionId) {
      const { data, error } = await supabase
        .from("scan_sessions")
        .select("id, lead_id")
        .eq("id", scanSessionId)
        .maybeSingle();
      if (error) throw error;
      return data ? { lead_id: data.lead_id as string | null } : null;
    },
    async getLeadEligibility(leadId) {
      const { data, error } = await supabase
        .from("leads")
        .select("id, phone_verified")
        .eq("id", leadId)
        .maybeSingle();
      if (error) throw error;
      return data
        ? { phone_verified: data.phone_verified as boolean | null }
        : null;
    },
    async hasVerifiedSessionBinding(scanSessionId, leadId) {
      const { data, error } = await supabase
        .from("phone_verifications")
        .select("id")
        .eq("scan_session_id", scanSessionId)
        .eq("lead_id", leadId)
        .eq("status", "verified")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  };
}

async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: SubmitBody;
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Validation ────────────────────────────────────────────────────────────
  // scan_session_id is the ONLY identity input the browser is trusted to send.
  if (!isUuid(body.scan_session_id)) {
    return new Response(
      JSON.stringify({ error: "scan_session_id must be a uuid" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
  // lead_id is OPTIONAL + UNTRUSTED legacy input. If present it must at least be
  // uuid-shaped; its value is only used for the conflict check, never for writes.
  if (
    body.lead_id !== undefined && body.lead_id !== null &&
    !isUuid(body.lead_id)
  ) {
    return new Response(
      JSON.stringify({ error: "lead_id must be a uuid when provided" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
  if (
    body.analysis_id !== undefined && body.analysis_id !== null &&
    !isUuid(body.analysis_id)
  ) {
    return new Response(
      JSON.stringify({ error: "analysis_id must be a uuid when provided" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
  if (!isStr(body.report_grade)) {
    return new Response(JSON.stringify({ error: "report_grade is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!isStr(body.primary_diagnosis)) {
    return new Response(
      JSON.stringify({ error: "primary_diagnosis is required" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const scan_session_id = body.scan_session_id as string;
  const client_lead_id = isUuid(body.lead_id) ? (body.lead_id as string) : null;
  const analysis_id = isUuid(body.analysis_id)
    ? (body.analysis_id as string)
    : null;

  // ── Derive + authorize the canonical lead (service-role authority) ────────
  let lead_id: string;
  try {
    const resolution = await resolveDiagnosisLeadAuthority(
      createSupabaseLeadFetcher(supabase),
      { scanSessionId: scan_session_id, clientLeadId: client_lead_id },
    );
    if (!resolution.ok) {
      return new Response(JSON.stringify({ error: resolution.error }), {
        status: resolution.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    lead_id = resolution.leadId;
  } catch (e) {
    console.error(
      "[submit-diagnosis-intake] lead-authority resolution threw:",
      e,
    );
    return new Response(
      JSON.stringify({ error: "Failed to validate report context" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // ── Optional analysis relationship validation (repo-truth FK) ─────────────
  // analyses.scan_session_id → scan_sessions.id
  if (analysis_id) {
    try {
      const { data: analysisRow, error: analysisErr } = await supabase
        .from("analyses")
        .select("id, scan_session_id")
        .eq("id", analysis_id)
        .maybeSingle();
      if (analysisErr) {
        console.error(
          "[submit-diagnosis-intake] analysis lookup failed:",
          analysisErr,
        );
        return new Response(
          JSON.stringify({ error: "Failed to validate report context" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      if (!analysisRow || analysisRow.scan_session_id !== scan_session_id) {
        return new Response(
          JSON.stringify({ error: INVALID_CONTEXT_ERROR }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    } catch (e) {
      console.error(
        "[submit-diagnosis-intake] analysis validation threw:",
        e,
      );
      return new Response(
        JSON.stringify({ error: "Failed to validate report context" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  }

  const report_grade = (body.report_grade as string).trim();
  const primary_diagnosis = (body.primary_diagnosis as string).trim();
  const other_text = isStr(body.other_text)
    ? (body.other_text as string).trim()
    : null;
  const confidence = isStr(body.confidence)
    ? (body.confidence as string).trim()
    : null;
  const prescription_path = isStr(body.prescription_path)
    ? (body.prescription_path as string).trim()
    : null;

  try {
    // 1. Insert diagnosis_intakes row ─────────────────────────────────────
    const { data: intakeRow, error: intakeError } = await supabase
      .from("diagnosis_intakes")
      .insert({
        lead_id,
        scan_session_id,
        analysis_id,
        report_grade,
        source: "post_report_diagnostic_intake",
        primary_diagnosis,
        secondary_clarifiers: asObj(body.secondary_clarifiers),
        other_text,
        window_intelligence: asObj(body.window_intelligence),
        counter_offer: asObj(body.counter_offer),
        top_insights_snapshot: asObj(body.top_insights_snapshot),
        confidence,
        prescription_path,
        attribution_snapshot: asObj(body.attribution_snapshot),
        status: "completed",
      })
      .select("id")
      .single();

    if (intakeError || !intakeRow) {
      console.error(
        "[submit-diagnosis-intake] insert intake failed:",
        intakeError,
      );
      return new Response(
        JSON.stringify({ error: "Failed to submit diagnosis" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const diagnosis_intake_id = intakeRow.id as string;

    // 2. Insert canonical lead_events row ────────────────────────────────
    let event_id: string | null = null;
    try {
      const { data: eventRow, error: eventError } = await supabase
        .from("lead_events")
        .insert({
          lead_id,
          scan_session_id,
          analysis_id,
          event_name: "diagnosis_completed",
          event_source: "submit-diagnosis-intake",
          status: "completed",
          metadata: {
            diagnosis_intake_id,
            primary_diagnosis,
            prescription_path,
            confidence,
            report_grade,
          },
        })
        .select("id")
        .single();

      if (eventError) {
        console.warn(
          "[submit-diagnosis-intake] lead_events insert failed:",
          eventError,
        );
      } else if (eventRow) {
        event_id = eventRow.id as string;
      }
    } catch (e) {
      console.warn("[submit-diagnosis-intake] lead_events insert threw:", e);
    }

    // 3. Update leads funnel state ───────────────────────────────────────
    const { error: leadUpdateError } = await supabase
      .from("leads")
      .update({
        funnel_stage: "diagnosis_completed",
        diagnosis_completed_at: new Date().toISOString(),
      })
      .eq("id", lead_id);

    if (leadUpdateError) {
      console.warn(
        "[submit-diagnosis-intake] leads funnel update failed:",
        leadUpdateError,
      );
    }

    return new Response(
      JSON.stringify(buildSuccessBody(diagnosis_intake_id, event_id)),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("[submit-diagnosis-intake] unhandled error:", e);
    return new Response(
      JSON.stringify({ error: "Failed to submit diagnosis" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}

if (import.meta.main) {
  Deno.serve(handleRequest);
}
