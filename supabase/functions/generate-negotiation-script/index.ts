/**
 * generate-negotiation-script — AI-powered consumer advocacy tool.
 *
 * Takes the full extraction from a completed, verified analysis and sends it
 * to Gemini with a forensic consumer-advocacy prompt. Returns a structured
 * 5-point negotiation script the homeowner can use word-for-word.
 *
 * Auth gate: requires phone verification (checks via get_analysis_full RPC).
 * Caches result in analyses.negotiation_script to avoid duplicate Gemini calls.
 *
 * POST { scan_session_id, phone_e164 }
 * Returns { success: true, script: NegotiationScript }
 *
 * Required secrets: GEMINI_API_KEY
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

// ═══════════════════════════════════════════════════════════════════════════
// GEMINI SYSTEM PROMPT — Consumer Advocacy Negotiation Script Generator
// ═══════════════════════════════════════════════════════════════════════════

const NEGOTIATION_PROMPT =
  `You are a consumer protection advocate specializing in Florida impact window and door installations. You have 20 years of experience helping homeowners negotiate fair prices and proper scope on hurricane protection projects.

A homeowner just had their contractor's quote analyzed by WindowMan's AI scanner. Based on the SPECIFIC issues found in their quote, generate a personalized negotiation script they can use word-for-word when they call their contractor back.

CRITICAL RULES:
1. Be assertive but professional — the homeowner should sound informed, not hostile or confrontational.
2. Reference SPECIFIC findings from their quote — use exact dollar amounts, missing items, brand names, DP ratings, NOA numbers where available.
3. Give EXACT PHRASES the homeowner can say — not suggestions, but word-for-word scripts.
4. Include a "leverage point" for each issue — explain WHY this gives negotiating power (code requirement, industry standard, competitor comparison).
5. Estimate dollar impact where possible — even approximate ranges help the homeowner anchor the negotiation.
6. The opening statement should establish credibility without being aggressive.
7. The closing statement should create urgency without burning bridges.

Return ONLY valid JSON matching this exact schema — no markdown, no explanation:
{
  "opening_statement": "The exact first sentence to say when calling the contractor. Should reference that they had the quote reviewed.",
  "talking_points": [
    {
      "issue": "One-line description of the problem found",
      "what_to_say": "Exact words to use with the contractor (2-3 sentences)",
      "leverage": "Why this gives negotiating power (code, standard, or market fact)",
      "expected_savings": "Dollar range this could save, or 'scope correction' if not price-related"
    }
  ],
  "closing_power_statement": "The final 2 sentences that put the homeowner in control. Should reference getting competing quotes.",
  "confidence_level": "strong" | "moderate" | "limited",
  "confidence_note": "One sentence about the overall negotiating position based on the findings.",
  "estimated_total_savings_range": "Combined dollar range across all talking points"
}

Generate 3-5 talking points, prioritized by dollar impact (highest first). If fewer than 3 real issues exist, that's fine — never pad with generic advice.`;

// ═══════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { scan_session_id, phone_e164 } = await req.json();

    if (!scan_session_id || !phone_e164) {
      return json(
        { error: "scan_session_id and phone_e164 are required" },
        400,
      );
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      console.error(
        "[generate-negotiation-script] GEMINI_API_KEY not configured",
      );
      return json({ error: "AI service not configured" }, 500);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── 1. Auth gate: verify phone is verified for this session ──────────
    const { data: authCheck } = await supabase.rpc("get_analysis_full", {
      p_scan_session_id: scan_session_id,
      p_phone_e164: phone_e164,
    });

    if (!authCheck || authCheck.length === 0) {
      return json(
        { error: "Not authorized. Phone verification required." },
        403,
      );
    }

    // ── 2. Get analysis with full_json ───────────────────────────────────
    const { data: analysis } = await supabase
      .from("analyses")
      .select(
        "id, full_json, negotiation_script, negotiation_script_generated_at, grade, flags",
      )
      .eq("scan_session_id", scan_session_id)
      .eq("analysis_status", "complete")
      .maybeSingle();

    if (!analysis?.full_json) {
      return json({ error: "No completed analysis found" }, 400);
    }

    // ── 3. Idempotency: return cached script if already generated ────────
    if (analysis.negotiation_script) {
      console.log(
        `[generate-negotiation-script] Returning cached script for session ${scan_session_id}`,
      );
      return json({
        success: true,
        script: analysis.negotiation_script,
        cached: true,
      });
    }

    // ── 4. Get lead context for richer script ───────────────────────────
    const { data: session } = await supabase
      .from("scan_sessions")
      .select("lead_id")
      .eq("id", scan_session_id)
      .maybeSingle();

    let leadContext = "";
    if (session?.lead_id) {
      const { data: lead } = await supabase
        .from("leads")
        .select("first_name, county, project_type, window_count, quote_range")
        .eq("id", session.lead_id)
        .maybeSingle();

      if (lead) {
        leadContext = `\n\nHOMEOWNER CONTEXT:\n- Name: ${
          lead.first_name || "Homeowner"
        }\n- County: ${lead.county || "Florida"}\n- Project: ${
          lead.project_type || "Unknown"
        }\n- Window count: ${lead.window_count || "Unknown"}\n- Quote range: ${
          lead.quote_range || "Unknown"
        }`;
      }
    }

    // ── 5. Build Gemini payload ──────────────────────────────────────────
    const fullJson = analysis.full_json as Record<string, unknown>;
    const extraction = fullJson.extraction as
      | Record<string, unknown>
      | undefined;
    const flags = fullJson.flags as Array<Record<string, unknown>> | undefined;
    const pillarScores = fullJson.pillar_scores as
      | Record<string, unknown>
      | undefined;
    const derivedMetrics = fullJson.derived_metrics as
      | Record<string, unknown>
      | undefined;

    const quoteData = [
      `QUOTE ANALYSIS RESULTS:`,
      `Grade: ${analysis.grade || "Unknown"}`,
      `Rubric version: ${fullJson.rubric_version || "Unknown"}`,
      ``,
      `PILLAR SCORES:`,
      pillarScores ? JSON.stringify(pillarScores, null, 2) : "Not available",
      ``,
      `FLAGS FOUND (${Array.isArray(flags) ? flags.length : 0}):`,
      Array.isArray(flags)
        // deno-lint-ignore no-explicit-any
        ? flags.map((f: any) => `- [${f.severity}] ${f.flag}: ${f.detail}`)
          .join("\n")
        : "None",
      ``,
      `EXTRACTION SUMMARY:`,
      extraction
        ? [
          `Contractor: ${extraction.contractor_name || "Not specified"}`,
          `Total quoted: $${extraction.total_quoted_price || "Unknown"}`,
          `Opening count: ${extraction.opening_count || "Unknown"}`,
          `Warranty: ${
            extraction.warranty
              ? JSON.stringify(extraction.warranty)
              : "Not specified"
          }`,
          `Permits: ${
            extraction.permits
              ? JSON.stringify(extraction.permits)
              : "Not specified"
          }`,
          `Cancellation policy: ${
            extraction.cancellation_policy || "Not specified"
          }`,
        ].join("\n")
        : "Not available",
      ``,
      derivedMetrics
        ? [
          `DERIVED FINANCIAL METRICS:`,
          `Contract total: $${
            // deno-lint-ignore no-explicit-any
            (derivedMetrics.totals as any)?.contract_total || "Unknown"}`,
          `Price per opening: $${
            // deno-lint-ignore no-explicit-any
            (derivedMetrics.per_opening as any)?.installed_price_per_opening ||
            "Unknown"}`,
          `Install cost share: ${
            // deno-lint-ignore no-explicit-any
            (derivedMetrics.shares as any)?.install_cost_share_pct ||
            "Unknown"}%`,
          // deno-lint-ignore no-explicit-any
          (derivedMetrics.county_benchmark as any)?.comparison_available
            ? `County benchmark: $${
              // deno-lint-ignore no-explicit-any
              (derivedMetrics.county_benchmark as any)
                ?.benchmark_price_per_opening_avg
              // deno-lint-ignore no-explicit-any
            }/opening avg (${(derivedMetrics.county_benchmark as any)?.status})`
            : "County benchmark: Not available",
        ].join("\n")
        : "",
      leadContext,
    ]
      .filter(Boolean)
      .join("\n");

    // ── 6. Call Gemini ───────────────────────────────────────────────────
    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;

    const geminiResp = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: NEGOTIATION_PROMPT },
              { text: quoteData },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      console.error(
        "[generate-negotiation-script] Gemini API error:",
        geminiResp.status,
        errText,
      );
      return json({ error: "AI generation failed" }, 502);
    }

    const geminiJson = await geminiResp.json();
    const rawText = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      console.error("[generate-negotiation-script] Empty Gemini response");
      return json({ error: "AI returned empty response" }, 502);
    }

    // ── 7. Parse JSON response ──────────────────────────────────────────
    let cleanJson = rawText.trim();
    if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/^```(?:json)?\s*/, "").replace(
        /\s*```$/,
        "",
      );
    }

    let script: Record<string, unknown>;
    try {
      script = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.error(
        "[generate-negotiation-script] JSON parse failed:",
        parseErr,
        "Raw:",
        cleanJson.slice(0, 500),
      );
      return json({ error: "AI response was not parseable" }, 502);
    }

    // ── 8. Cache in analyses table ──────────────────────────────────────
    const now = new Date().toISOString();
    await supabase
      .from("analyses")
      .update({
        negotiation_script: script,
        negotiation_script_generated_at: now,
      })
      .eq("id", analysis.id);

    // ── 9. Log event ────────────────────────────────────────────────────
    await supabase.from("event_logs").insert({
      event_name: "negotiation_script_generated",
      session_id: scan_session_id,
      route: "/report",
      metadata: {
        grade: analysis.grade,
        talking_point_count: Array.isArray(script.talking_points)
          ? script.talking_points.length
          : 0,
        confidence_level: script.confidence_level || "unknown",
        timestamp: now,
      },
    });

    console.log(
      `[generate-negotiation-script] Generated script for session ${scan_session_id}`,
      {
        grade: analysis.grade,
        talkingPoints: Array.isArray(script.talking_points)
          ? script.talking_points.length
          : 0,
      },
    );

    return json({
      success: true,
      script,
      cached: false,
    });
  } catch (err) {
    console.error("[generate-negotiation-script] unhandled error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
