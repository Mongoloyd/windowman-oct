/**
 * persist-diagnosis-start — Server-side persistence of `diagnosis_started`.
 *
 * Replaces the previous direct browser writes from PostScanReportSwitcher
 * into `leads` + `lead_events`. Validates record relationships against repo
 * truth before stamping any state.
 *
 * Service-role writer. No JWT required (called fire-and-forget from the
 * unlocked-report primary CTA). MUST NEVER block diagnosis navigation —
 * the frontend treats this call as best-effort.
 *
 * Validation contract:
 *   - lead_id, scan_session_id required (uuid)
 *   - scan_sessions.lead_id MUST equal lead_id
 *   - if analysis_id provided: analyses.scan_session_id MUST equal scan_session_id
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface StartBody {
  lead_id?: unknown;
  scan_session_id?: unknown;
  analysis_id?: unknown;
  grade?: unknown;
  county?: unknown;
  source?: unknown;
}

const isUuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

const isStr = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: StartBody;
  try {
    body = (await req.json()) as StartBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!isUuid(body.lead_id)) {
    return new Response(JSON.stringify({ error: "lead_id must be a uuid" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!isUuid(body.scan_session_id)) {
    return new Response(
      JSON.stringify({ error: "scan_session_id must be a uuid" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
  const analysisIdProvided =
    body.analysis_id !== undefined && body.analysis_id !== null;
  if (analysisIdProvided && !isUuid(body.analysis_id)) {
    return new Response(
      JSON.stringify({ error: "analysis_id must be a uuid when provided" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const lead_id = body.lead_id as string;
  const scan_session_id = body.scan_session_id as string;
  const analysis_id = analysisIdProvided ? (body.analysis_id as string) : null;
  const grade = isStr(body.grade) ? (body.grade as string).trim() : null;
  const county = isStr(body.county) ? (body.county as string).trim() : null;
  const source = isStr(body.source)
    ? (body.source as string).trim()
    : "unlocked_report_primary_cta";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── Relationship validation (repo-truth FKs) ──────────────────────────
  // scan_sessions.lead_id → leads.id
  const { data: scanRow, error: scanErr } = await supabase
    .from("scan_sessions")
    .select("id, lead_id")
    .eq("id", scan_session_id)
    .maybeSingle();

  if (scanErr) {
    console.error("[persist-diagnosis-start] scan lookup failed:", scanErr);
    return new Response(
      JSON.stringify({ error: "Failed to validate report context" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
  if (!scanRow || scanRow.lead_id !== lead_id) {
    return new Response(
      JSON.stringify({ error: "Invalid report context" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // If analysis_id is provided, it must belong to the same scan_session.
  if (analysis_id) {
    const { data: analysisRow, error: analysisErr } = await supabase
      .from("analyses")
      .select("id, scan_session_id")
      .eq("id", analysis_id)
      .maybeSingle();

    if (analysisErr) {
      console.error(
        "[persist-diagnosis-start] analysis lookup failed:",
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
        JSON.stringify({ error: "Invalid report context" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  }

  // ── Stamp lead funnel state ──────────────────────────────────────────
  const { error: leadUpdateErr } = await supabase
    .from("leads")
    .update({
      funnel_stage: "diagnosis_started",
      diagnosis_started_at: new Date().toISOString(),
    })
    .eq("id", lead_id);

  if (leadUpdateErr) {
    console.warn(
      "[persist-diagnosis-start] leads update failed:",
      leadUpdateErr,
    );
  }

  // ── Canonical lead_events row ────────────────────────────────────────
  let event_id: string | null = null;
  try {
    const { data: eventRow, error: eventErr } = await supabase
      .from("lead_events")
      .insert({
        lead_id,
        scan_session_id,
        analysis_id,
        event_name: "diagnosis_started",
        event_source: source,
        status: "started",
        metadata: { grade, county },
      })
      .select("id")
      .single();
    if (eventErr) {
      console.warn(
        "[persist-diagnosis-start] lead_events insert failed:",
        eventErr,
      );
    } else if (eventRow) {
      event_id = eventRow.id as string;
    }
  } catch (e) {
    console.warn("[persist-diagnosis-start] lead_events insert threw:", e);
  }

  return new Response(
    JSON.stringify({ success: true, event_id }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
