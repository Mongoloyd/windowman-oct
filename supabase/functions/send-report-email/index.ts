/**
 * send-report-email — Sends the WindowMan Snapshot Receipt email via Resend.
 *
 * Arc 4 scope:
 *   Operationally supports ONE email type: "full".
 *   Triggered automatically on first true full report unlock (post-OTP).
 *   Preview reminder emails remain INACTIVE — preview branch is rejected.
 *
 * Snapshot Receipt content (NEVER the full report body):
 *   - Headline confirming the report is ready
 *   - Grade / verdict band
 *   - Savings / overcharge signal (if safely available)
 *   - Top 2 red flags (severity Critical/High)
 *   - Single CTA → /estimate (vetted second-opinion request page)
 *
 * Idempotency lives on `leads`:
 *   - snapshot_email_status: 'not_sent' | 'sent' | 'failed' | 'suppressed'
 *   - snapshot_email_sent_at: timestamptz of first successful send
 *   - snapshot_email_last_error: last provider error
 *
 * POST { scan_session_id: string, email_type: "full" }
 *
 * Required secrets:
 *   RESEND_API_KEY     — Resend.com API key
 *   REPORT_FROM_EMAIL  — Verified sender (e.g. reports@windowman.app)
 *   REPORT_BASE_URL    — App URL for the /estimate CTA (e.g. https://wmmvp.lovable.app)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Strict input validation ──────────────────────────────────────────────────
function isUuid(s: unknown): s is string {
  return typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

// ── Visual helpers ───────────────────────────────────────────────────────────
function gradeColor(grade: string): string {
  if (grade === "A" || grade === "B") return "#10B981";
  if (grade === "C") return "#F59E0B";
  return "#DC2626";
}

function gradeEmoji(grade: string): string {
  if (grade === "A" || grade === "B") return "\u2705";
  if (grade === "C") return "\u26A0\uFE0F";
  return "\uD83D\uDEA8";
}

function gradeVerdictBand(grade: string): string {
  if (grade === "A") return "Strong quote — within fair market range.";
  if (grade === "B") return "Solid quote with minor gaps worth fixing.";
  if (grade === "C") return "Quote has real problems. Worth a second look before signing.";
  if (grade === "D") return "Quote scored well below market standards.";
  if (grade === "F") return "High-risk quote. We strongly recommend a second opinion.";
  return "Your WindowMan quote analysis is ready.";
}

function formatUSD(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type FlagLike = {
  flag?: unknown;
  detail?: unknown;
  severity?: unknown;
  area?: unknown;
};

function pickTopRedFlags(flags: FlagLike[]): { headline: string; detail: string }[] {
  const RED = new Set(["Critical", "High"]);
  const reds = flags.filter((f) => typeof f.severity === "string" && RED.has(f.severity as string));
  return reds.slice(0, 2).map((f) => {
    const headline =
      typeof f.flag === "string" && f.flag.trim()
        ? f.flag.trim()
        : typeof f.area === "string" && f.area.trim()
          ? f.area.trim()
          : "Critical issue found";
    const detail = typeof f.detail === "string" ? f.detail.trim() : "";
    return { headline, detail };
  });
}

// ── Snapshot Receipt template ────────────────────────────────────────────────
function buildSnapshotReceiptEmail(params: {
  firstName: string;
  grade: string;
  verdict: string;
  county: string;
  savingsLow: number | null;
  savingsHigh: number | null;
  topRedFlags: { headline: string; detail: string }[];
  estimateUrl: string;
}): { subject: string; html: string } {
  const {
    firstName,
    grade,
    verdict,
    county,
    savingsLow,
    savingsHigh,
    topRedFlags,
    estimateUrl,
  } = params;
  const gColor = gradeColor(grade);
  const emoji = gradeEmoji(grade);

  const subject = `${emoji} Your WindowMan Report is Ready — Grade ${grade}`;

  const savingsBlock =
    savingsLow !== null && savingsHigh !== null && savingsHigh > 0
      ? `<tr><td style="padding:0 32px 20px;">
           <div style="background:#0A0E14;border:1px solid #1E293B;padding:14px 16px;">
             <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;letter-spacing:0.12em;color:#A0B8D8;font-weight:600;text-transform:uppercase;margin-bottom:4px;">Estimated Overcharge Range</div>
             <div style="font-size:18px;font-weight:800;color:#FFFFFF;">${formatUSD(savingsLow)} – ${formatUSD(savingsHigh)}</div>
             <div style="font-size:12px;color:#A0B8D8;margin-top:4px;">vs. fair market range for ${county || "your area"}</div>
           </div>
         </td></tr>`
      : "";

  const redFlagBlock = topRedFlags.length
    ? `<tr><td style="padding:0 32px 24px;">
         <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;letter-spacing:0.12em;color:#A0B8D8;font-weight:600;text-transform:uppercase;margin-bottom:8px;">Top Red Flags</div>
         ${topRedFlags
           .map(
             (f) => `
           <div style="background:#0A0E14;border-left:3px solid #DC2626;padding:12px 14px;margin-bottom:8px;">
             <div style="font-size:14px;font-weight:700;color:#FFFFFF;margin-bottom:4px;">${escapeHtml(f.headline)}</div>
             ${f.detail ? `<div style="font-size:13px;color:#C8DEFF;line-height:1.5;">${escapeHtml(f.detail)}</div>` : ""}
           </div>`,
           )
           .join("")}
       </td></tr>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0A0E14;font-family:'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0E14;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#111418;border:1px solid #2E3A50;">

<!-- Header -->
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #1E293B;">
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;letter-spacing:0.12em;color:#49A5FF;font-weight:700;text-transform:uppercase;margin-bottom:4px;">WINDOWMAN SNAPSHOT RECEIPT</div>
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:22px;font-weight:900;color:#FFFFFF;text-transform:uppercase;">Your Report Is Ready</div>
</td></tr>

<!-- Grade + Verdict -->
<tr><td style="padding:28px 32px;text-align:center;">
  <div style="display:inline-block;width:84px;height:84px;line-height:84px;font-size:48px;font-weight:900;color:${gColor};background:${gColor}15;border:2px solid ${gColor}40;text-align:center;">${escapeHtml(grade)}</div>
  <div style="font-size:15px;color:#FFFFFF;margin-top:14px;font-weight:600;">${escapeHtml(verdict)}</div>
  ${county ? `<div style="font-size:12px;color:#64748B;margin-top:6px;">${escapeHtml(county)} County market comparison</div>` : ""}
</td></tr>

${savingsBlock}
${redFlagBlock}

<!-- Greeting -->
<tr><td style="padding:0 32px 18px;">
  <p style="font-size:15px;color:#C8DEFF;line-height:1.65;margin:0;">
    Hi ${escapeHtml(firstName)},<br><br>
    We finished analyzing your impact window quote. The findings above are a <strong style="color:#FFFFFF;">snapshot receipt</strong> — a record of what we found. The full breakdown stays in your secure report.
  </p>
</td></tr>

<!-- CTA: /estimate -->
<tr><td style="padding:0 32px 14px;text-align:center;">
  <a href="${estimateUrl}" style="display:inline-block;padding:16px 36px;background:linear-gradient(135deg,#C8952A,#E2B04A);color:#0D0D0D;font-size:16px;font-weight:800;text-decoration:none;text-transform:uppercase;letter-spacing:0.04em;">Get a Vetted Second Opinion</a>
</td></tr>
<tr><td style="padding:0 32px 32px;text-align:center;">
  <p style="font-size:12px;color:#A0B8D8;margin:0;line-height:1.5;">
    Based on what your scan found, WindowMan can help you get a cleaner, same-scope estimate from a vetted contractor — so you have something honest to compare against.
  </p>
</td></tr>

<!-- Footer -->
<tr><td style="padding:20px 32px;border-top:1px solid #1E293B;text-align:center;">
  <p style="font-size:11px;color:#475569;margin:0;">WindowMan — Free AI Quote Scanner for Impact Windows</p>
  <p style="font-size:10px;color:#334155;margin:4px 0 0;">No contractor will be contacted without your permission.</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject, html };
}

// ── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const scan_session_id = (body as Record<string, unknown>).scan_session_id;
    const email_type = (body as Record<string, unknown>).email_type;

    // ── Strict validation ──
    if (!isUuid(scan_session_id)) {
      return json({ error: "scan_session_id must be a valid UUID" }, 400);
    }

    // Arc 4: only "full" Snapshot Receipts are operational. Preview is dormant.
    if (email_type !== "full") {
      return json(
        {
          success: false,
          skipped: true,
          reason: "email_type_inactive",
          message: 'Only email_type="full" is active in this phase.',
        },
        200,
      );
    }

    // ── Config readiness ──
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("REPORT_FROM_EMAIL");
    const baseUrl = (Deno.env.get("REPORT_BASE_URL") || "").replace(/\/+$/, "");

    if (!resendKey || !fromEmail || !baseUrl) {
      console.error("[send-report-email] missing config", {
        has_resend_key: !!resendKey,
        has_from_email: !!fromEmail,
        has_base_url: !!baseUrl,
      });
      return json(
        {
          success: false,
          skipped: true,
          reason: "email_not_configured",
        },
        200,
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Resolve session → lead
    const { data: session, error: sessionErr } = await supabase
      .from("scan_sessions")
      .select("lead_id")
      .eq("id", scan_session_id as string)
      .maybeSingle();

    if (sessionErr || !session?.lead_id) {
      return json({ error: "Session not found or no lead linked" }, 404);
    }

    // 2. Server-authoritative gating: only send when full unlock is real
    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select(
        "first_name, email, county, phone_verified, phone_verified_at, snapshot_email_status, snapshot_email_sent_at, estimated_savings_low, estimated_savings_high",
      )
      .eq("id", session.lead_id)
      .maybeSingle();

    if (leadErr || !lead) {
      return json({ error: "Lead not found" }, 404);
    }

    if (!lead.email) {
      return json(
        { success: false, skipped: true, reason: "no_email_on_lead" },
        200,
      );
    }

    if (!lead.phone_verified || !lead.phone_verified_at) {
      // Defense in depth — frontend invokes this on unlock, but never trust the client.
      return json(
        { success: false, skipped: true, reason: "not_verified" },
        200,
      );
    }

    // 3. Idempotency — narrow status model
    if (lead.snapshot_email_status === "sent") {
      return json({
        success: true,
        already_sent: true,
        sent_at: lead.snapshot_email_sent_at,
      });
    }

    // 4. Get analysis (must be complete)
    const { data: analysis, error: analysisErr } = await supabase
      .from("analyses")
      .select("grade, flags, analysis_status")
      .eq("scan_session_id", scan_session_id as string)
      .eq("analysis_status", "complete")
      .maybeSingle();

    if (analysisErr || !analysis) {
      return json({ error: "No completed analysis found" }, 400);
    }

    const grade = (analysis.grade as string | null) || "?";
    const flags: FlagLike[] = Array.isArray(analysis.flags)
      ? (analysis.flags as FlagLike[])
      : [];
    const topRedFlags = pickTopRedFlags(flags);

    // 5. Build email
    const estimateUrl = `${baseUrl}/estimate?session=${encodeURIComponent(scan_session_id as string)}`;
    const { subject, html } = buildSnapshotReceiptEmail({
      firstName: (lead.first_name as string) || "there",
      grade,
      verdict: gradeVerdictBand(grade),
      county: (lead.county as string) || "",
      savingsLow:
        typeof lead.estimated_savings_low === "number"
          ? (lead.estimated_savings_low as number)
          : null,
      savingsHigh:
        typeof lead.estimated_savings_high === "number"
          ? (lead.estimated_savings_high as number)
          : null,
      topRedFlags,
      estimateUrl,
    });

    // 6. Send via Resend
    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [lead.email],
        subject,
        html,
      }),
    });

    const resendData = await resendResp.json().catch(() => ({}));

    if (!resendResp.ok) {
      // Persist failure but DO NOT throw — caller (frontend) must not block unlock.
      const errMsg =
        typeof (resendData as Record<string, unknown>)?.message === "string"
          ? ((resendData as Record<string, unknown>).message as string).slice(0, 500)
          : `provider_status_${resendResp.status}`;

      await supabase
        .from("leads")
        .update({
          snapshot_email_status: "failed",
          snapshot_email_last_error: errMsg,
        })
        .eq("id", session.lead_id);

      console.error("[send-report-email] Resend error:", resendData);
      return json(
        { success: false, error: "Email delivery failed", details: resendData },
        502,
      );
    }

    // 7. Mark sent (atomic narrow state)
    const now = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from("leads")
      .update({
        snapshot_email_status: "sent",
        snapshot_email_sent_at: now,
        snapshot_email_last_error: null,
        // Keep legacy mirrors so existing dashboards/triggers stay coherent.
        report_email_sent_at: now,
        report_email_type: "full",
      })
      .eq("id", session.lead_id);

    if (updateErr) {
      console.error("[send-report-email] mark-sent failed:", updateErr);
      // Email did go out — return success but log the persistence drift.
    }

    // 8. Append to event_logs (operational telemetry only)
    await supabase.from("event_logs").insert({
      event_name: "snapshot_receipt_sent",
      session_id: scan_session_id as string,
      route: "/",
      metadata: {
        email_type: "full",
        grade,
        red_flag_count: topRedFlags.length,
        resend_id: (resendData as Record<string, unknown>)?.id ?? null,
        timestamp: now,
      },
    });

    console.log(
      `[send-report-email] Sent Snapshot Receipt for session ${scan_session_id}`,
    );

    return json({
      success: true,
      email_type: "full",
      resend_id: (resendData as Record<string, unknown>)?.id ?? null,
    });
  } catch (err) {
    console.error("[send-report-email] unhandled error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
