/**
 * dev-report-unlock — Bypass phone verification for dev/design work.
 *
 * Accepts { scan_session_id, dev_secret } and returns the same columns
 * as get_analysis_full, but without requiring a phone_verifications row.
 *
 * Protected by DEV_BYPASS_SECRET — production callers cannot guess it,
 * and the VITE_ counterpart is never bundled in production builds.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { scan_session_id, dev_secret } = await req.json();

    // ── Validate secret ───────────────────────────────────────────────────
    const expectedSecret = Deno.env.get("DEV_BYPASS_SECRET");
    if (!expectedSecret || dev_secret !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!scan_session_id || typeof scan_session_id !== "string") {
      return new Response(
        JSON.stringify({ error: "scan_session_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── Query analyses directly via service role ──────────────────────────
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: row, error: dbErr } = await supabaseAdmin
      .from("analyses")
      .select(
        "grade, flags, full_json, proof_of_read, preview_json, confidence_score, document_type, rubric_version",
      )
      .eq("scan_session_id", scan_session_id)
      .eq("analysis_status", "complete")
      .limit(1)
      .maybeSingle();

    if (dbErr) {
      console.error("[dev-report-unlock] DB error:", dbErr);
      return new Response(
        JSON.stringify({ error: "Database error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!row) {
      return new Response(
        JSON.stringify({
          error: "No complete analysis found for this scan session",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Return same shape as get_analysis_full RPC
    return new Response(JSON.stringify(row), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[dev-report-unlock] exception:", message);
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
