/**
 * contractor-send-followups
 *
 * Send pending contractor followup emails using Resend.
 * Safe for concurrent/repeated runs — atomically claims followups before sending.
 *
 * POST (no body required — processes due followups up to MAX_BATCH_SIZE per run)
 *
 * Auth: require x-contractor-secret header matching CONTRACTOR_CRON_SECRET env var.
 *
 * Required env:
 *   RESEND_API_KEY             — Resend.com API key
 *   CONTRACTOR_CRON_SECRET     — Shared secret for server-to-server auth
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional env:
 *   RESEND_FROM_EMAIL    — Verified sender (default: noreply@windowman.app)
 *
 * Returns: { attempted, sent, failed }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-contractor-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BATCH_SIZE = 100;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Verify the shared secret header. Returns an error Response or null on success. */
function verifySecret(req: Request): Response | null {
  const cronSecret = Deno.env.get("CONTRACTOR_CRON_SECRET");
  if (!cronSecret) {
    console.error("[contractor-send-followups] CONTRACTOR_CRON_SECRET not set");
    return json({ error: "Server configuration error" }, 500);
  }
  const provided = req.headers.get("x-contractor-secret");
  if (!provided || provided !== cronSecret) {
    return json({ error: "Unauthorized" }, 401);
  }
  return null;
}

// ── Email template builders ──────────────────────────────────────────────────

interface LeadInfo {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string;
}

interface FollowupRow {
  id: string;
  contractor_lead_id: string;
  followup_type: string;
  scheduled_for: string;
  payload: Record<string, unknown>;
}

function formatEventTime(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return iso;
  }
}

function contractorName(lead: LeadInfo): string {
  const parts = [lead.first_name, lead.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "there";
}

function buildEmailContent(
  followup: FollowupRow,
  lead: LeadInfo
): { subject: string; html: string; text: string } {
  const name = contractorName(lead);
  const company = lead.company_name ? ` (${lead.company_name})` : "";
  const eventStart = (followup.payload?.calendly_event_start as string | null) ?? null;
  const eventTime = formatEventTime(eventStart);

  switch (followup.followup_type) {
    case "confirmation_email": {
      const subject = "You're booked — WindowMan contractor walkthrough";
      const html = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="font-size:20px;margin-bottom:8px">You're booked, ${name}${company}.</h2>
  <p>Your WindowMan contractor walkthrough is confirmed.</p>
  ${eventTime ? `<p><strong>When:</strong> ${eventTime}</p>` : ""}
  <p>We'll cover territory availability, lead quality, and what working with WindowMan looks like in practice.</p>
  <p>If anything changes, reply to this email.</p>
  <p style="margin-top:32px;color:#555;font-size:13px">— The WindowMan Team</p>
</div>`.trim();
      const text = [
        `You're booked, ${name}${company}.`,
        "",
        "Your WindowMan contractor walkthrough is confirmed.",
        eventTime ? `When: ${eventTime}` : null,
        "",
        "We'll cover territory availability, lead quality, and what working with WindowMan looks like in practice.",
        "",
        "If anything changes, reply to this email.",
        "",
        "— The WindowMan Team",
      ]
        .filter(Boolean)
        .join("\n");
      return { subject, html, text };
    }

    case "reminder_24h": {
      const subject = "Reminder: your WindowMan walkthrough is tomorrow";
      const html = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="font-size:20px;margin-bottom:8px">See you tomorrow, ${name}${company}.</h2>
  <p>Just a reminder — your WindowMan contractor walkthrough is tomorrow.</p>
  ${eventTime ? `<p><strong>When:</strong> ${eventTime}</p>` : ""}
  <p>No prep needed. We'll walk you through everything.</p>
  <p style="margin-top:32px;color:#555;font-size:13px">— The WindowMan Team</p>
</div>`.trim();
      const text = [
        `See you tomorrow, ${name}${company}.`,
        "",
        "Just a reminder — your WindowMan contractor walkthrough is tomorrow.",
        eventTime ? `When: ${eventTime}` : null,
        "",
        "No prep needed. We'll walk you through everything.",
        "",
        "— The WindowMan Team",
      ]
        .filter(Boolean)
        .join("\n");
      return { subject, html, text };
    }

    case "reminder_1h": {
      const subject = "Starting soon — your WindowMan walkthrough";
      const html = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="font-size:20px;margin-bottom:8px">Starting in about an hour, ${name}${company}.</h2>
  <p>Your WindowMan contractor walkthrough is coming up.</p>
  ${eventTime ? `<p><strong>When:</strong> ${eventTime}</p>` : ""}
  <p>See you shortly.</p>
  <p style="margin-top:32px;color:#555;font-size:13px">— The WindowMan Team</p>
</div>`.trim();
      const text = [
        `Starting in about an hour, ${name}${company}.`,
        "",
        "Your WindowMan contractor walkthrough is coming up.",
        eventTime ? `When: ${eventTime}` : null,
        "",
        "See you shortly.",
        "",
        "— The WindowMan Team",
      ]
        .filter(Boolean)
        .join("\n");
      return { subject, html, text };
    }

    case "no_show_followup": {
      const subject = "Still want access to your territory?";
      const html = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="font-size:20px;margin-bottom:8px">Hey ${name}${company},</h2>
  <p>We missed you at your scheduled WindowMan walkthrough.</p>
  <p>Territory slots in your area are limited. If you're still interested, reply to this email and we'll find a new time.</p>
  <p style="margin-top:32px;color:#555;font-size:13px">— The WindowMan Team</p>
</div>`.trim();
      const text = [
        `Hey ${name}${company},`,
        "",
        "We missed you at your scheduled WindowMan walkthrough.",
        "",
        "Territory slots in your area are limited. If you're still interested, reply to this email and we'll find a new time.",
        "",
        "— The WindowMan Team",
      ].join("\n");
      return { subject, html, text };
    }

    case "post_call_followup": {
      const subject = "Next steps for your WindowMan territory";
      const html = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="font-size:20px;margin-bottom:8px">Great talking with you, ${name}${company}.</h2>
  <p>Here's what happens next:</p>
  <ol style="padding-left:20px;line-height:1.8">
    <li>We finalize your territory assignment</li>
    <li>You receive your first verified homeowner leads</li>
    <li>You close at your own pace — no pressure quotas</li>
  </ol>
  <p>Questions? Reply to this email and we'll get back to you fast.</p>
  <p style="margin-top:32px;color:#555;font-size:13px">— The WindowMan Team</p>
</div>`.trim();
      const text = [
        `Great talking with you, ${name}${company}.`,
        "",
        "Here's what happens next:",
        "1. We finalize your territory assignment",
        "2. You receive your first verified homeowner leads",
        "3. You close at your own pace — no pressure quotas",
        "",
        "Questions? Reply to this email and we'll get back to you fast.",
        "",
        "— The WindowMan Team",
      ].join("\n");
      return { subject, html, text };
    }

    default: {
      const subject = "A note from WindowMan";
      const html = `<p>Hi ${name}${company}, thanks for connecting with WindowMan.</p>`;
      const text = `Hi ${name}${company}, thanks for connecting with WindowMan.`;
      return { subject, html, text };
    }
  }
}

// ── Resend send helper ────────────────────────────────────────────────────────

async function sendEmail(
  resendApiKey: string,
  from: string,
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return { ok: false, error: `Resend ${res.status}: ${errBody}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Authenticate
  const authErr = verifySecret(req);
  if (authErr) return authErr;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[contractor-send-followups] Missing Supabase env vars");
    return json({ error: "Server configuration error" }, 500);
  }

  if (!resendApiKey) {
    console.error("[contractor-send-followups] Missing RESEND_API_KEY");
    return json({ error: "Email service not configured" }, 500);
  }

  const fromEmail =
    Deno.env.get("RESEND_FROM_EMAIL") ?? "noreply@windowman.app";

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 1. Atomically claim a bounded batch of pending followups due now.
  //    Updating status to 'sending' before processing prevents concurrent
  //    workers from selecting the same rows and sending duplicate emails.
  const now = new Date().toISOString();
  const { data: followups, error: fetchErr } = await supabase
    .from("contractor_followups")
    .update({ status: "sending" })
    .eq("status", "pending")
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true })
    .order("id", { ascending: true })
    .limit(MAX_BATCH_SIZE)
    .select("id, contractor_lead_id, followup_type, scheduled_for, payload");

  if (fetchErr) {
    console.error("[contractor-send-followups] claim followups error:", fetchErr);
    return json({ error: "Failed to claim followups" }, 500);
  }

  if (!followups || followups.length === 0) {
    return json({ attempted: 0, sent: 0, failed: 0 });
  }

  const followupRows = followups as FollowupRow[];

  // 2. Batch-fetch all unique leads in a single query (avoids N+1)
  const leadIds = [...new Set(followupRows.map((f) => f.contractor_lead_id))];
  const leadById = new Map<string, LeadInfo>();

  const { data: leads, error: leadsErr } = await supabase
    .from("contractor_leads")
    .select("id, first_name, last_name, company_name, email")
    .in("id", leadIds);

  if (leadsErr) {
    console.error("[contractor-send-followups] batch lead fetch error:", leadsErr);
    // Mark all claimed followups as failed — we can't proceed without lead data
    await supabase
      .from("contractor_followups")
      .update({ status: "failed" })
      .in("id", followupRows.map((f) => f.id));
    return json({ error: "Failed to fetch leads" }, 500);
  }

  for (const lead of (leads ?? []) as LeadInfo[]) {
    leadById.set(lead.id, lead);
  }

  let attempted = 0;
  let sent = 0;
  let failed = 0;

  for (const followup of followupRows) {
    attempted++;

    // 3. Get corresponding lead from prefetched results
    const leadInfo = leadById.get(followup.contractor_lead_id);

    if (!leadInfo) {
      console.error(
        `[contractor-send-followups] lead not found for followup ${followup.id}`
      );
      await markFollowup(supabase, followup.id, "failed");
      failed++;
      continue;
    }

    const { subject, html, text } = buildEmailContent(followup, leadInfo);

    // 4. Send email
    const result = await sendEmail(
      resendApiKey,
      fromEmail,
      leadInfo.email,
      subject,
      html,
      text
    );

    if (result.ok) {
      await markFollowup(supabase, followup.id, "sent");
      sent++;

      // 5. Log activity
      await supabase.from("contractor_activity_log").insert({
        contractor_lead_id: followup.contractor_lead_id,
        activity_type: "followup_sent",
        activity_data: {
          followup_id: followup.id,
          followup_type: followup.followup_type,
          recipient: leadInfo.email,
          subject,
          result: "sent",
        },
      });
    } else {
      console.error(
        `[contractor-send-followups] send failed for ${followup.id}:`,
        result.error
      );
      await markFollowup(supabase, followup.id, "failed");
      failed++;

      // Log failure
      await supabase.from("contractor_activity_log").insert({
        contractor_lead_id: followup.contractor_lead_id,
        activity_type: "followup_sent",
        activity_data: {
          followup_id: followup.id,
          followup_type: followup.followup_type,
          recipient: leadInfo.email,
          subject,
          result: "failed",
          error: result.error,
        },
      });
    }
  }

  return json({ attempted, sent, failed });
});

// ── Helper: update followup status ───────────────────────────────────────────

async function markFollowup(
  supabase: ReturnType<typeof createClient>,
  followupId: string,
  status: "sent" | "failed"
): Promise<void> {
  const update: Record<string, unknown> = { status };
  if (status === "sent") {
    update.sent_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("contractor_followups")
    .update(update)
    .eq("id", followupId);

  if (error) {
    console.error(
      `[contractor-send-followups] markFollowup error for ${followupId}:`,
      error
    );
  }
}
