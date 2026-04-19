/**
 * submit-diagnosis-intake — Phase 2 hinge persistence.
 *
 * Persists a completed post-report diagnosis intake row, writes a canonical
 * `diagnosis_completed` lead event, and stamps the lead's funnel state.
 *
 * Service-role writer. No JWT required (frontend invokes with anon key).
 * The frontend never invents identity here — it MUST pass the same
 * lead_id + scan_session_id from the unlocked-report router-state handoff.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

const isUuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

const isStr = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0;

const asObj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

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
  if (body.analysis_id !== undefined && body.analysis_id !== null && !isUuid(body.analysis_id)) {
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

  const lead_id = body.lead_id as string;
  const scan_session_id = body.scan_session_id as string;
  const analysis_id = isUuid(body.analysis_id) ? (body.analysis_id as string) : null;
  const report_grade = (body.report_grade as string).trim();
  const primary_diagnosis = (body.primary_diagnosis as string).trim();
  const other_text = isStr(body.other_text) ? (body.other_text as string).trim() : null;
  const confidence = isStr(body.confidence) ? (body.confidence as string).trim() : null;
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
      console.error("[submit-diagnosis-intake] insert intake failed:", intakeError);
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
        console.warn("[submit-diagnosis-intake] lead_events insert failed:", eventError);
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
      JSON.stringify({
        success: true,
        diagnosis_intake_id,
        event_id,
      }),
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
});
