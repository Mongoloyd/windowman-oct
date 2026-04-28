/**
 * request-callback — Public-facing callback request bridge.
 *
 * Allows verified homeowners to request a voice callback without admin auth.
 * Security: Looks up lead from scan_session_id, validates phone_verified.
 *
 * Inputs: { scan_session_id, call_intent, cta_source? }
 */

// deno-lint-ignore no-import-prefix
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { scan_session_id, call_intent, cta_source } = await req.json();

    if (!scan_session_id || !call_intent) {
      return new Response(
        JSON.stringify({
          error: "scan_session_id and call_intent are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const validIntents = [
      "contractor_intro",
      "report_explainer",
      "general_callback",
    ];
    if (!validIntents.includes(call_intent)) {
      return new Response(
        JSON.stringify({ error: "Invalid call_intent" }),
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

    // ── Look up session → lead ───────────────────────────────────────────
    const { data: session } = await supabase
      .from("scan_sessions")
      .select("id, lead_id")
      .eq("id", scan_session_id)
      .maybeSingle();

    if (!session?.lead_id) {
      return new Response(
        JSON.stringify({ error: "Session not found or not linked to a lead" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: lead } = await supabase
      .from("leads")
      .select(
        "id, phone_e164, phone_verified, first_name, county, project_type, window_count, quote_range",
      )
      .eq("id", session.lead_id)
      .maybeSingle();

    if (!lead) {
      return new Response(
        JSON.stringify({ error: "Lead not found" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!lead.phone_verified) {
      return new Response(
        JSON.stringify({ error: "Phone not verified" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!lead.phone_e164) {
      return new Response(
        JSON.stringify({ error: "No phone on file" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── Get analysis + opportunity context ────────────────────────────────
    const { data: analysis } = await supabase
      .from("analyses")
      .select("grade, flags, confidence_score")
      .eq("scan_session_id", scan_session_id)
      .eq("analysis_status", "complete")
      .maybeSingle();

    const flags = Array.isArray(analysis?.flags) ? analysis.flags : [];
    const majorFlags = flags
      // deno-lint-ignore no-explicit-any
      .filter((f: any) => f.severity === "Critical" || f.severity === "High")
      .slice(0, 5)
      // deno-lint-ignore no-explicit-any
      .map((f: any) => f.title || f.name || "Unknown");

    const { data: opp } = await supabase
      .from("contractor_opportunities")
      .select("id, flag_count, red_flag_count")
      .eq("scan_session_id", scan_session_id)
      .maybeSingle();

    const now = new Date().toISOString();

    // ── Insert voice_followups row ───────────────────────────────────────
    const { data: followup, error: followupErr } = await supabase
      .from("voice_followups")
      .insert({
        lead_id: lead.id,
        scan_session_id,
        opportunity_id: opp?.id || null,
        phone_e164: lead.phone_e164,
        call_intent,
        cta_source: cta_source || call_intent,
        status: "queued",
        payload_json: {
          to: lead.phone_e164,
          info: {
            lead_id: lead.id,
            scan_session_id,
            first_name: lead.first_name,
            call_intent,
            county: lead.county,
            project_type: lead.project_type,
            window_count: lead.window_count,
            quote_range: lead.quote_range,
            grade: analysis?.grade || null,
            flag_count: opp?.flag_count || flags.length,
            critical_flag_count: opp?.red_flag_count || majorFlags.length,
            major_flags: majorFlags,
          },
        },
      })
      .select("id")
      .single();

    if (followupErr) {
      console.error("[request-callback] insert failed:", followupErr);
      return new Response(
        JSON.stringify({ error: "Failed to queue callback" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("[request-callback] queued", {
      followup_id: followup.id,
      call_intent,
      phone: lead.phone_e164.slice(0, 4) + "****",
    });

    // ── Update opportunity ───────────────────────────────────────────────
    if (opp?.id) {
      await supabase
        .from("contractor_opportunities")
        .update({
          last_call_intent: call_intent,
          last_call_requested_at: now,
          last_call_webhook_status: "queued",
          cta_source: cta_source || call_intent,
        })
        .eq("id", opp.id);
    }

    // ── Fire webhook ─────────────────────────────────────────────────────
    const webhookUrl = Deno.env.get("PHONECALL_BOT_WEBHOOK_URL");
    let webhookStatus = "queued";

    if (webhookUrl) {
      try {
        const resp = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: lead.phone_e164,
            info: {
              lead_id: lead.id,
              scan_session_id,
              followup_id: followup.id,
              first_name: lead.first_name,
              call_intent,
              county: lead.county,
              grade: analysis?.grade || null,
              major_flags: majorFlags,
            },
          }),
        });

        webhookStatus = resp.ok ? "sent" : "failed";
        await resp.text(); // consume body

        await supabase
          .from("voice_followups")
          .update({ status: webhookStatus })
          .eq("id", followup.id);

        if (opp?.id) {
          await supabase
            .from("contractor_opportunities")
            .update({ last_call_webhook_status: webhookStatus })
            .eq("id", opp.id);
        }
      } catch (err) {
        console.error("[request-callback] webhook error", err);
        webhookStatus = "failed";
      }
    } else {
      console.log(
        "[request-callback] PHONECALL_BOT_WEBHOOK_URL not set — skipping",
      );
    }

    // ── Audit trail ──────────────────────────────────────────────────────
    await supabase.from("lead_events").insert({
      lead_id: lead.id,
      scan_session_id,
      event_name: "voice_followup_queued",
      event_source: "edge_function",
      voice_followup_id: followup.id,
      metadata: {
        call_intent,
        cta_source,
        webhook_status: webhookStatus,
        timestamp: now,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        followup_id: followup.id,
        webhook_status: webhookStatus,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[request-callback] unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
