/**
 * send-contractor-handoff — Sends a branded lead dossier email to the contractor via Resend.
 *
 * POST { lead_id: string }
 *
 * Auth: validateAdminRequestWithRole (super_admin | operator)
 * Required secrets: RESEND_API_KEY, CONTRACTOR_EMAIL, CONTRACTOR_NAME
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { validateAdminRequestWithRole } from "../_shared/adminAuth.ts";

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

function gradeColorHex(grade: string): string {
  if (grade === "A" || grade === "B") return "#10B981";
  if (grade === "C") return "#F59E0B";
  return "#DC2626";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ──
    const authResult = await validateAdminRequestWithRole(req, [
      "super_admin",
      "operator",
    ]);
    if (!authResult.ok) return authResult.response;

    const body = await req.json();
    const { lead_id } = body;

    if (!lead_id) {
      return json({ success: false, error: "lead_id required" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Step 1: Fetch lead ──
    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .select(`
        id, first_name, last_name, city, zip,
        grade, flag_count, latest_analysis_id,
        latest_opportunity_id, latest_scan_session_id
      `)
      .eq("id", lead_id)
      .single();

    if (leadError || !lead) {
      console.error("[send-contractor-handoff] Lead not found:", leadError);
      return json({ success: false, error: "Lead not found" }, 404);
    }

    if (!lead.latest_scan_session_id || !lead.latest_analysis_id) {
      return json({
        success: false,
        error: "Lead missing scan session or analysis data",
      }, 400);
    }

    const homeownerName =
      [lead.first_name, lead.last_name].filter(Boolean).join(" ") ||
      "Homeowner";

    // ── Step 2: Fetch analysis ──
    const { data: analysis } = await supabaseAdmin
      .from("analyses")
      .select("full_json")
      .eq("id", lead.latest_analysis_id)
      .single();

    const fullJson = analysis?.full_json as Record<string, unknown> | null;
    const pillarScores = (fullJson?.pillar_scores as
      | Record<string, { grade?: string; score?: number; summary?: string }>
      | null) ?? null;
    const allFlags = (fullJson?.flags as
      | Array<
        {
          severity: string;
          description?: string;
          flag?: string;
          detail?: string;
        }
      >
      | null) ?? [];
    const topFlags = allFlags
      .filter((f) => f.severity === "High" || f.severity === "Critical")
      .slice(0, 3);

    // ── Step 3: Upsert contractor_opportunities ──
    let opportunityId: string;
    let dbSuccess = true;

    try {
      const { data: existing } = await supabaseAdmin
        .from("contractor_opportunities")
        .select("id")
        .eq("lead_id", lead_id)
        .maybeSingle();

      if (existing) {
        await supabaseAdmin
          .from("contractor_opportunities")
          .update({
            status: "sent_to_contractor",
            sent_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        opportunityId = existing.id;
      } else {
        const { data: newOpp, error: insertError } = await supabaseAdmin
          .from("contractor_opportunities")
          .insert({
            lead_id: lead_id,
            scan_session_id: lead.latest_scan_session_id,
            analysis_id: lead.latest_analysis_id,
            status: "sent_to_contractor",
            sent_at: new Date().toISOString(),
            grade: lead.grade,
            flag_count: lead.flag_count ?? 0,
          })
          .select("id")
          .single();

        if (insertError || !newOpp) {
          console.error(
            "[send-contractor-handoff] DB insert failed:",
            insertError,
          );
          dbSuccess = false;
          opportunityId = "";
        } else {
          opportunityId = newOpp.id;
        }
      }

      // Update lead.latest_opportunity_id
      if (dbSuccess && opportunityId) {
        await supabaseAdmin
          .from("leads")
          .update({ latest_opportunity_id: opportunityId })
          .eq("id", lead_id);
      }
    } catch (dbErr) {
      console.error("[send-contractor-handoff] DB error:", dbErr);
      dbSuccess = false;
      opportunityId = "";
    }

    if (!dbSuccess) {
      return json({ success: false, error: "Database write failed" }, 500);
    }

    // ── Step 4: Send email via Resend ──
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const contractorEmail = Deno.env.get("CONTRACTOR_EMAIL");
    const contractorName = Deno.env.get("CONTRACTOR_NAME") || "Contractor";

    if (!resendKey || !contractorEmail) {
      console.warn(
        "[send-contractor-handoff] Email config missing — skipping send",
      );
      return json({
        success: true,
        opportunity_id: opportunityId,
        warning:
          "Record created but email not configured — add RESEND_API_KEY and CONTRACTOR_EMAIL secrets",
      });
    }

    const gColor = gradeColorHex(lead.grade || "F");
    const location = [lead.city, lead.zip].filter(Boolean).join(", ") ||
      "Florida";

    // Pillar rows
    const pillarConfig = [
      { key: "safety", label: "Safety & Code" },
      { key: "install", label: "Install & Scope" },
      { key: "price", label: "Price Fairness" },
      { key: "finePrint", label: "Fine Print" },
      { key: "fine_print", label: "Fine Print" },
      { key: "warranty", label: "Warranty Value" },
    ];

    let pillarRowsHtml = "";
    if (pillarScores) {
      const seen = new Set<string>();
      for (const { key, label } of pillarConfig) {
        if (seen.has(label)) continue;
        const val = pillarScores[key];
        if (!val) continue;
        seen.add(label);
        const grade = val.grade ||
          (val.score != null
            ? (val.score >= 80
              ? "A"
              : val.score >= 65
              ? "B"
              : val.score >= 50
              ? "C"
              : val.score >= 35
              ? "D"
              : "F")
            : "—");
        const summary = val.summary || "";
        pillarRowsHtml += `<tr>
          <td style="padding:8px 12px;font-size:14px;color:#C8DEFF;border-bottom:1px solid #1E293B;">${label}</td>
          <td style="padding:8px 12px;font-size:14px;font-weight:700;color:${
          gradeColorHex(grade)
        };text-align:center;border-bottom:1px solid #1E293B;">${grade}</td>
          <td style="padding:8px 12px;font-size:12px;color:#94A3B8;border-bottom:1px solid #1E293B;">${summary}</td>
        </tr>`;
      }
    }

    // Red flags
    let flagsHtml = "";
    if (topFlags.length > 0) {
      flagsHtml = topFlags
        .map((f) =>
          `<div style="padding:6px 0;font-size:14px;color:#FCA5A5;">🚩 ${
            f.flag || f.description || "Issue detected"
          }</div>`
        )
        .join("");
    } else {
      flagsHtml =
        `<div style="padding:6px 0;font-size:14px;color:#6EE7B7;">✓ No critical flags detected</div>`;
    }

    const subject = `WindowMan Verified Lead — ${homeownerName}, ${location}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0A0E14;font-family:'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0E14;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111418;border:1px solid #2E3A50;">

<!-- Header Banner -->
<tr><td style="padding:28px 32px 20px;background:#0F1F35;border-bottom:1px solid #1E293B;">
  <div style="font-size:11px;letter-spacing:0.12em;color:#C8952A;font-weight:700;text-transform:uppercase;margin-bottom:4px;">WINDOWMAN TRUTH ENGINE</div>
  <div style="font-size:20px;font-weight:900;color:#FFFFFF;text-transform:uppercase;">Verified Lead Report</div>
</td></tr>

<!-- Homeowner Section -->
<tr><td style="padding:24px 32px 16px;">
  <div style="font-size:11px;letter-spacing:0.08em;color:#64748B;text-transform:uppercase;margin-bottom:8px;">HOMEOWNER</div>
  <div style="font-size:18px;font-weight:700;color:#FFFFFF;">${homeownerName}</div>
  <div style="font-size:14px;color:#94A3B8;margin-top:4px;">${location}</div>
</td></tr>

<!-- Grade Section -->
<tr><td style="padding:16px 32px;text-align:center;">
  <div style="font-size:11px;letter-spacing:0.1em;color:#64748B;text-transform:uppercase;margin-bottom:12px;">OVERALL GRADE</div>
  <div style="display:inline-block;width:72px;height:72px;line-height:72px;font-size:42px;font-weight:900;color:${gColor};background:${gColor}15;border:2px solid ${gColor}40;text-align:center;">${
      lead.grade || "?"
    }</div>
  <div style="font-size:14px;color:#94A3B8;margin-top:12px;">${
      lead.flag_count ?? 0
    } flagged issue${(lead.flag_count ?? 0) !== 1 ? "s" : ""}</div>
</td></tr>

<!-- Pillar Summary -->
${
      pillarRowsHtml
        ? `<tr><td style="padding:0 32px 20px;">
  <div style="font-size:10px;letter-spacing:0.1em;color:#64748B;text-transform:uppercase;margin-bottom:8px;">PILLAR BREAKDOWN</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0E14;border:1px solid #1E293B;">
    ${pillarRowsHtml}
  </table>
</td></tr>`
        : ""
    }

<!-- Red Flags -->
<tr><td style="padding:0 32px 20px;">
  <div style="font-size:10px;letter-spacing:0.1em;color:#64748B;text-transform:uppercase;margin-bottom:8px;">TOP FLAGS</div>
  <div style="background:#0A0E14;border:1px solid #1E293B;padding:12px 16px;">
    ${flagsHtml}
  </div>
</td></tr>

<!-- CTA Footer -->
<tr><td style="padding:24px 32px;border-top:1px solid #1E293B;">
  <p style="font-size:14px;color:#C8DEFF;line-height:1.6;margin:0;">
    This lead has been pre-qualified by the WindowMan Truth Engine. Contact WindowMan to receive full contact details and unlock this lead.
  </p>
  <p style="font-size:13px;color:#64748B;margin-top:12px;">Prepared for <strong style="color:#C8952A;">${contractorName}</strong></p>
</td></tr>

<!-- Footer -->
<tr><td style="padding:16px 32px;border-top:1px solid #1E293B;text-align:center;">
  <p style="font-size:11px;color:#475569;margin:0;">WindowMan — AI-Powered Quote Intelligence</p>
  <p style="font-size:10px;color:#334155;margin:4px 0 0;">Homeowner contact details are gated until contractor engagement is confirmed.</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

    let emailSuccess = true;
    let emailWarning: string | undefined;

    try {
      const resendResp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "WindowMan <no-reply@windowman.app>",
          to: [contractorEmail],
          subject,
          html,
        }),
      });

      const resendData = await resendResp.json();

      if (!resendResp.ok) {
        console.error("[send-contractor-handoff] Resend error:", resendData);
        emailSuccess = false;
        emailWarning = "Record created but email failed — check Resend config";
      } else {
        console.log("[send-contractor-handoff] Email sent:", resendData.id);
      }
    } catch (emailErr) {
      console.error("[send-contractor-handoff] Email send error:", emailErr);
      emailSuccess = false;
      emailWarning = "Record created but email failed — network error";
    }

    // ── Step 5: Log event ──
    await supabaseAdmin.from("lead_events").insert({
      lead_id,
      event_name: "contractor_handoff_sent",
      event_source: "admin",
      opportunity_id: opportunityId,
      metadata: {
        contractor_name: contractorName,
        email_sent: emailSuccess,
        timestamp: new Date().toISOString(),
      },
    });

    // ── Return ──
    if (emailSuccess) {
      return json({ success: true, opportunity_id: opportunityId });
    }
    return json({
      success: true,
      opportunity_id: opportunityId,
      warning: emailWarning,
    });
  } catch (err) {
    console.error("[send-contractor-handoff] Unhandled error:", err);
    return json({
      success: false,
      error: err instanceof Error ? err.message : "Internal server error",
    }, 500);
  }
});
