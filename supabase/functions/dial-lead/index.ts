/**
 * dial-lead — P3a: One-click autodial from CRM Desk.
 *
 * Admin-auth gated (operator / super_admin).
 * Input:  { lead_id }
 * Output: { success, followup_id, webhook_status }
 *
 * 1. Looks up lead metadata (phone, name, county, canonical analysis context)
 * 2. Inserts a voice_followups row BEFORE firing webhook (audit-first)
 * 3. Fires PHONECALL_BOT_WEBHOOK_URL (graceful skip if unset)
 * 4. Updates followup status based on webhook result
 * 5. Bumps lead.deal_status → "attempted" ONLY when currently new/null
 * 6. Logs voice_followup_queued to lead_events
 */

import {
  corsHeaders,
  validateAdminRequestWithRole,
} from "../_shared/adminAuth.ts";
import {
  buildDialLeadWebhookAnalysisFields,
  httpStatusForDialLeadContextFailure,
  loadDialLeadAnalysisContext,
} from "./dialLeadAnalysisContext.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const validation = await validateAdminRequestWithRole(req, [
      "super_admin",
      "operator",
    ]);
    if (!validation.ok) return validation.response;

    const { supabaseAdmin: supabase } = validation;

    const body = await req.json();
    const lead_id: string | undefined = body.lead_id;

    if (!lead_id) {
      return new Response(
        JSON.stringify({ error: "lead_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── 1. Look up lead ──────────────────────────────────────────────────
    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select(
        "id, phone_e164, first_name, county, latest_analysis_id, deal_status, project_type, window_count, quote_range",
      )
      .eq("id", lead_id)
      .maybeSingle();

    if (leadErr || !lead) {
      return new Response(
        JSON.stringify({ error: "Lead not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!lead.phone_e164) {
      return new Response(
        JSON.stringify({ error: "Lead has no phone number" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── 2. Resolve canonical analysis context (optional) ─────────────────
    const analysisContextResult = await loadDialLeadAnalysisContext(
      supabase,
      lead.id,
      lead.latest_analysis_id,
    );
    if (!analysisContextResult.ok) {
      return new Response(
        JSON.stringify({ error: analysisContextResult.errorMessage }),
        {
          status: httpStatusForDialLeadContextFailure(
            analysisContextResult.kind,
          ),
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const analysisFields = buildDialLeadWebhookAnalysisFields(
      analysisContextResult.context,
    );

    const now = new Date().toISOString();
    const call_intent = "operator_outbound";

    // ── 3. Build webhook payload (mirrors voice-followup shape) ──────────
    const webhookPayload = {
      to: lead.phone_e164,
      info: {
        lead_id: lead.id,
        scan_session_id: analysisFields.scan_session_id,
        first_name: lead.first_name || null,
        cta_source: "crm_autodial",
        call_intent,
        county: lead.county || null,
        project_type: lead.project_type || null,
        window_count: lead.window_count || null,
        quote_range: lead.quote_range || null,
        grade: analysisFields.grade,
        flag_count: analysisFields.flag_count,
      },
    };

    // ── 4. INSERT voice_followups BEFORE webhook (audit-first) ───────────
    const { data: followup, error: insertErr } = await supabase
      .from("voice_followups")
      .insert({
        lead_id: lead.id,
        phone_e164: lead.phone_e164,
        call_intent,
        status: "queued",
        provider: "phonecall_bot",
        scan_session_id: analysisFields.scan_session_id,
        cta_source: "crm_autodial",
        payload_json: webhookPayload,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("[dial-lead] voice_followups insert failed", {
        stage: "voice_followups_insert",
        lead_id: lead.id,
      });
      return new Response(
        JSON.stringify({ error: "Failed to queue call" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── 5. Fire webhook (mirrors voice-followup pattern) ─────────────────
    const webhookUrl = Deno.env.get("PHONECALL_BOT_WEBHOOK_URL");
    let webhookStatus = "queued";

    if (webhookUrl) {
      try {
        const resp = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(webhookPayload),
        });

        if (resp.ok) {
          webhookStatus = "sent";
          console.log("[dial-lead] webhook sent", {
            lead_id: lead.id,
            followup_id: followup.id,
          });
        } else {
          webhookStatus = "failed";
          console.error("[dial-lead] webhook failed", {
            stage: "webhook_response",
            lead_id: lead.id,
            followup_id: followup.id,
            http_status: resp.status,
          });
        }
      } catch {
        webhookStatus = "failed";
        console.error("[dial-lead] webhook request failed", {
          stage: "webhook_fetch",
          lead_id: lead.id,
          followup_id: followup.id,
        });
      }

      // Update followup status based on webhook result
      await supabase
        .from("voice_followups")
        .update({ status: webhookStatus === "sent" ? "in_progress" : "failed" })
        .eq("id", followup.id);
    } else {
      console.log(
        "[dial-lead] PHONECALL_BOT_WEBHOOK_URL not set — skipping webhook fire",
      );
    }

    // ── 6. Bump deal_status ONLY if null or 'new' (.in() guard) ──────────
    if (!lead.deal_status || lead.deal_status === "new") {
      await supabase
        .from("leads")
        .update({ deal_status: "attempted" })
        .eq("id", lead.id)
        .in("deal_status", ["new"]);

      // Separate update for NULL — .in() doesn't match NULL
      if (!lead.deal_status) {
        await supabase
          .from("leads")
          .update({ deal_status: "attempted" })
          .eq("id", lead.id)
          .is("deal_status", null);
      }
    }

    // ── 7. Log to lead_events (canonical event table) ────────────────────
    await supabase.from("lead_events").insert({
      lead_id: lead.id,
      event_name: "voice_followup_queued",
      event_source: "dial-lead",
      voice_followup_id: followup.id,
      metadata: {
        call_intent,
        webhook_status: webhookStatus,
        cta_source: "crm_autodial",
        timestamp: now,
      },
    });

    console.log("[dial-lead] success", {
      lead_id: lead.id,
      followup_id: followup.id,
      webhook_status: webhookStatus,
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
  } catch {
    console.error("[dial-lead] unhandled error", { stage: "unhandled" });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
