/**
 * lead-reactivation — Cold lead drip engine.
 *
 * Triggered by pg_cron every 4 hours. Finds leads that:
 *   - status = 'new'
 *   - phone_verified = false
 *   - created between 24 and 48 hours ago
 *   - reactivation_email_sent_at IS NULL
 *
 * Sends a personalized "Your report is waiting" email via Resend,
 * then stamps reactivation_email_sent_at to prevent duplicate sends.
 *
 * POST { trigger: "cron" }
 * Returns { success, processed, skipped, errors }
 *
 * Required secrets: RESEND_API_KEY, REPORT_FROM_EMAIL, REPORT_BASE_URL
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Reactivation email template ──────────────────────────────────────────
function buildReactivationEmail(params: {
  firstName: string;
  grade: string;
  flagCount: number;
  redFlagCount: number;
  county: string;
  deepLink: string;
}): { subject: string; html: string } {
  const { firstName, grade, flagCount, redFlagCount, county, deepLink } =
    params;

  const gradeColor = grade === "A" || grade === "B"
    ? "#10B981"
    : grade === "C"
    ? "#F59E0B"
    : "#DC2626";
  const urgencyLine = grade === "D" || grade === "F"
    ? `<strong style="color:#DC2626;">Your quote scored a ${grade} — significantly below market standards.</strong> We strongly recommend reviewing the findings before signing.`
    : grade === "C"
    ? `Your quote scored a ${grade} — there are items worth reviewing before you commit.`
    : `Your quote scored a ${grade} — looking good, but we found ${flagCount} item${
      flagCount !== 1 ? "s" : ""
    } to review.`;

  const subject =
    `\u23F0 ${firstName}, your WindowMan report is still waiting — Grade: ${grade}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0A0E14;font-family:'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0E14;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#111418;border:1px solid #2E3A50;">

<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #1E293B;">
  <div style="font-size:11px;letter-spacing:0.12em;color:#49A5FF;font-weight:700;text-transform:uppercase;margin-bottom:4px;">WINDOWMAN QUOTE SCANNER</div>
  <div style="font-size:22px;font-weight:900;color:#FFFFFF;text-transform:uppercase;">Your Report Is Waiting</div>
</td></tr>

<tr><td style="padding:28px 32px;text-align:center;">
  <div style="font-size:11px;letter-spacing:0.12em;color:#A0B8D8;font-weight:600;text-transform:uppercase;margin-bottom:12px;">YOUR QUOTE GRADE</div>
  <div style="display:inline-block;width:72px;height:72px;line-height:72px;font-size:44px;font-weight:900;color:${gradeColor};background:${gradeColor}15;border:2px solid ${gradeColor}40;text-align:center;">${grade}</div>
  <div style="font-size:14px;color:#A0B8D8;margin-top:12px;">
    ${flagCount} issue${flagCount !== 1 ? "s" : ""} found${
    redFlagCount > 0
      ? ` — <span style="color:#DC2626;font-weight:700;">${redFlagCount} critical</span>`
      : ""
  }
  </div>
  ${
    county
      ? `<div style="font-size:13px;color:#64748B;margin-top:6px;">${county} County</div>`
      : ""
  }
</td></tr>

<tr><td style="padding:0 32px 24px;">
  <p style="font-size:15px;color:#C8DEFF;line-height:1.65;margin:0;">
    Hi ${firstName},<br><br>
    You uploaded your impact window quote ${
    county ? `for your ${county} County project ` : ""
  }yesterday, and our AI finished the analysis — but you haven't seen the results yet.<br><br>
    ${urgencyLine}<br><br>
    Your full report includes detailed findings, red flag explanations, and actionable next steps. It takes 30 seconds to unlock.
  </p>
</td></tr>

<tr><td style="padding:0 32px 32px;text-align:center;">
  <a href="${deepLink}" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#C8952A,#E2B04A);color:#0D0D0D;font-size:16px;font-weight:800;text-decoration:none;text-transform:uppercase;letter-spacing:0.04em;">Unlock My Report →</a>
  <p style="font-size:12px;color:#64748B;margin-top:12px;">This link will take you directly to your results.</p>
</td></tr>

<tr><td style="padding:20px 32px;border-top:1px solid #1E293B;text-align:center;">
  <p style="font-size:11px;color:#475569;margin:0;">WindowMan — Free AI Quote Scanner for Impact Windows</p>
  <p style="font-size:10px;color:#334155;margin:4px 0 0;">You received this because you uploaded a quote for analysis. No spam, ever.</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject, html };
}

// ── Main handler ─────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("REPORT_FROM_EMAIL") ||
      "WindowMan <onboarding@resend.dev>";
    const baseUrl = Deno.env.get("REPORT_BASE_URL") ||
      "https://wmmvp.lovable.app";

    if (!resendKey) {
      console.warn(
        "[lead-reactivation] RESEND_API_KEY not configured — skipping run",
      );
      return json({
        success: false,
        skipped: true,
        reason: "email_not_configured",
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Query cold leads ──────────────────────────────────────────────
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      .toISOString();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000)
      .toISOString();

    const { data: coldLeads, error: queryErr } = await supabase
      .from("leads")
      .select("id, session_id, first_name, email, county, created_at")
      .eq("status", "new")
      .eq("phone_verified", false)
      .is("reactivation_email_sent_at", null)
      .lte("created_at", twentyFourHoursAgo)
      .gte("created_at", fortyEightHoursAgo)
      .limit(50);

    if (queryErr) {
      console.error("[lead-reactivation] query failed:", queryErr);
      return json({ error: "Failed to query cold leads" }, 500);
    }

    if (!coldLeads || coldLeads.length === 0) {
      console.log("[lead-reactivation] No cold leads found in 24-48h window");
      return json({
        success: true,
        processed: 0,
        message: "No cold leads to reactivate",
      });
    }

    console.log(
      `[lead-reactivation] Found ${coldLeads.length} cold leads to reactivate`,
    );

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const lead of coldLeads) {
      try {
        // Get the scan session for this lead
        const { data: sessions } = await supabase
          .from("scan_sessions")
          .select("id")
          .eq("lead_id", lead.id)
          .order("created_at", { ascending: false })
          .limit(1);

        const scanSessionId = sessions?.[0]?.id;
        if (!scanSessionId) {
          console.log(
            `[lead-reactivation] Lead ${
              lead.id.slice(0, 8)
            } has no scan session — skipping`,
          );
          skipped++;
          continue;
        }

        // Get analysis data for this session
        const { data: analysis } = await supabase
          .from("analyses")
          .select("grade, flags, analysis_status")
          .eq("scan_session_id", scanSessionId)
          .eq("analysis_status", "complete")
          .maybeSingle();

        if (!analysis) {
          console.log(
            `[lead-reactivation] No completed analysis for lead ${
              lead.id.slice(0, 8)
            } — skipping`,
          );
          skipped++;
          continue;
        }

        const flags = Array.isArray(analysis.flags) ? analysis.flags : [];
        // deno-lint-ignore no-explicit-any
        const redFlags = flags.filter((f: any) =>
          f.severity === "Critical" || f.severity === "High"
        );
        const deepLink = `${baseUrl}/?session=${scanSessionId}`;

        const { subject, html } = buildReactivationEmail({
          firstName: lead.first_name || "there",
          grade: analysis.grade || "?",
          flagCount: flags.length,
          redFlagCount: redFlags.length,
          county: lead.county || "",
          deepLink,
        });

        // Send via Resend
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

        const resendData = await resendResp.json();

        if (!resendResp.ok) {
          console.error(
            `[lead-reactivation] Resend failed for ${
              lead.email.slice(0, 3)
            }***:`,
            resendData,
          );
          errors++;
          continue;
        }

        // Stamp reactivation_email_sent_at (idempotency)
        const stamp = new Date().toISOString();
        await supabase
          .from("leads")
          .update({ reactivation_email_sent_at: stamp })
          .eq("id", lead.id);

        // Log event
        await supabase.from("event_logs").insert({
          event_name: "lead_reactivation_sent",
          session_id: scanSessionId,
          route: "/cron",
          metadata: {
            lead_id: lead.id,
            grade: analysis.grade,
            flag_count: flags.length,
            resend_id: resendData.id,
            timestamp: stamp,
          },
        });

        processed++;
        console.log(
          `[lead-reactivation] Sent to ${
            lead.email.slice(0, 3)
          }*** (grade: ${analysis.grade}, ${flags.length} flags)`,
        );
      } catch (leadErr) {
        console.error(
          `[lead-reactivation] Error processing lead ${lead.id.slice(0, 8)}:`,
          leadErr,
        );
        errors++;
      }
    }

    // Log summary event
    await supabase.from("event_logs").insert({
      event_name: "lead_reactivation_batch_complete",
      route: "/cron",
      metadata: {
        total_candidates: coldLeads.length,
        processed,
        skipped,
        errors,
        timestamp: new Date().toISOString(),
      },
    });

    console.log(
      `[lead-reactivation] Batch complete: ${processed} sent, ${skipped} skipped, ${errors} errors`,
    );

    return json({
      success: true,
      processed,
      skipped,
      errors,
      total_candidates: coldLeads.length,
    });
  } catch (err) {
    console.error("[lead-reactivation] unhandled error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
