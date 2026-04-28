/**
 * voice-followup — Phase 3.4A CTA-aware outbound voice follow-up webhook.
 *
 * Fires a webhook to phonecall.bot with homeowner context based on CTA intent.
 * Persists webhook state on the contractor_opportunity.
 *
 * Required secrets: PHONECALL_BOT_WEBHOOK_URL (optional — gracefully skips if not set)
 */

import {
  corsHeaders,
  validateAdminRequestWithRole,
} from "../_shared/adminAuth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require operator or super_admin role
    const validation = await validateAdminRequestWithRole(req, [
      "super_admin",
      "operator",
    ]);
    if (!validation.ok) return validation.response;

    const { supabaseAdmin: supabase } = validation;

    const {
      scan_session_id,
      phone_e164,
      call_intent,
      cta_source,
      opportunity_id,
    } = await req.json();

    if (!scan_session_id || !phone_e164 || !call_intent) {
      return new Response(
        JSON.stringify({
          error: "scan_session_id, phone_e164, and call_intent required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const now = new Date().toISOString();

    // ── 1. Gather context from DB ────────────────────────────────────────
    const { data: session } = await supabase
      .from("scan_sessions")
      .select("lead_id")
      .eq("id", scan_session_id)
      .maybeSingle();

    if (!session?.lead_id) {
      return new Response(
        JSON.stringify({ error: "Session not linked to a lead" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: lead } = await supabase
      .from("leads")
      .select("id, first_name, county, project_type, window_count, quote_range")
      .eq("id", session.lead_id)
      .maybeSingle();

    const { data: analysis } = await supabase
      .from("analyses")
      .select("grade, flags, confidence_score")
      .eq("scan_session_id", scan_session_id)
      .eq("analysis_status", "complete")
      .maybeSingle();

    // Get opportunity for suggested match info
    const { data: opp } = await supabase
      .from("contractor_opportunities")
      .select(
        "id, suggested_contractor_id, suggested_match_confidence, flag_count, red_flag_count",
      )
      .eq("scan_session_id", scan_session_id)
      .maybeSingle();

    const flags = Array.isArray(analysis?.flags) ? analysis.flags : [];
    const majorFlags = flags
      // deno-lint-ignore no-explicit-any
      .filter((f: any) => f.severity === "Critical" || f.severity === "High")
      .slice(0, 5)
      // deno-lint-ignore no-explicit-any
      .map((f: any) => f.title || f.name || "Unknown");

    // ── 2. Build webhook payload (phonecall.bot format) ─────────────────
    const payload = {
      to: phone_e164,
      info: {
        lead_id: lead?.id || session.lead_id,
        scan_session_id,
        opportunity_id: opportunity_id || opp?.id || null,
        first_name: lead?.first_name || null,
        cta_source: cta_source || call_intent,
        call_intent,
        county: lead?.county || null,
        project_type: lead?.project_type || null,
        window_count: lead?.window_count || null,
        quote_range: lead?.quote_range || null,
        grade: analysis?.grade || null,
        flag_count: opp?.flag_count || flags.length,
        critical_flag_count: opp?.red_flag_count || majorFlags.length,
        major_flags: majorFlags,
        suggested_match_confidence: opp?.suggested_match_confidence || null,
        suggested_contractor_id: opp?.suggested_contractor_id || null,
      },
    };

    console.log("[voice-followup] payload built", {
      call_intent,
      phone: phone_e164.slice(0, 4) + "****",
      hasOpp: !!opp,
    });

    // ── 3. Update opportunity with call intent ───────────────────────────
    const oppId = opportunity_id || opp?.id;
    if (oppId) {
      await supabase
        .from("contractor_opportunities")
        .update({
          last_call_intent: call_intent,
          last_call_requested_at: now,
          last_call_webhook_status: "queued",
          cta_source: cta_source || call_intent,
        })
        .eq("id", oppId);
    }

    // ── 4. Fire webhook to phonecall.bot ─────────────────────────────────
    const webhookUrl = Deno.env.get("PHONECALL_BOT_WEBHOOK_URL");
    let webhookStatus = "queued";
    let webhookError: string | null = null;

    if (webhookUrl) {
      try {
        const resp = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (resp.ok) {
          webhookStatus = "sent";
          console.log("[voice-followup] webhook sent successfully");
        } else {
          webhookStatus = "failed";
          webhookError = `HTTP ${resp.status}: ${await resp.text().catch(() =>
            "unknown"
          )}`;
          console.error("[voice-followup] webhook failed", webhookError);
        }
      } catch (err) {
        webhookStatus = "failed";
        webhookError = err instanceof Error ? err.message : "Unknown error";
        console.error("[voice-followup] webhook error", webhookError);
      }

      // Update webhook status on opportunity
      if (oppId) {
        await supabase
          .from("contractor_opportunities")
          .update({
            last_call_webhook_status: webhookStatus,
            last_call_webhook_error: webhookError,
          })
          .eq("id", oppId);
      }
    } else {
      console.log(
        "[voice-followup] PHONECALL_BOT_WEBHOOK_URL not set — skipping webhook fire",
      );
      webhookStatus = "queued"; // stays queued for manual processing
    }

    // ── 5. Log events ────────────────────────────────────────────────────
    const eventName = webhookStatus === "failed"
      ? "voice_followup_failed"
      : "voice_followup_queued";

    await supabase.from("event_logs").insert({
      event_name: eventName,
      session_id: scan_session_id,
      route: "/report",
      metadata: {
        call_intent,
        cta_source,
        opportunity_id: oppId,
        webhook_status: webhookStatus,
        webhook_error: webhookError,
        timestamp: now,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        webhook_status: webhookStatus,
        opportunity_id: oppId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[voice-followup] unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
