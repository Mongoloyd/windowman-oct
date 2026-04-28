/**
 * compare-quotes — Multi-quote side-by-side comparison engine.
 *
 * Accepts 2+ scan_session_ids, verifies auth for each, pulls full_json
 * extractions, and sends them to Gemini for a structured comparison.
 *
 * Auth: requires phone_e164 + at least one verified session.
 * Caches: stores result in quote_comparisons table.
 *
 * POST { scan_session_ids: string[], phone_e164: string }
 * Returns { success, comparison: ComparisonResult }
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

const COMPARISON_PROMPT =
  `You are an expert consumer advocate specializing in Florida impact window and door installations. A homeowner is comparing multiple contractor quotes for the same project.

You will receive the full AI extraction data for 2 or more quotes. Analyze them side-by-side and produce a clear, actionable comparison.

RULES:
1. Compare on these dimensions: total price, price per opening, brand/series quality, DP ratings, NOA compliance, warranty coverage, permit inclusion, installation scope, and red flags.
2. Be specific — use actual numbers from the extractions, not generic advice.
3. Identify which quote is the best VALUE (not just cheapest), considering quality and protection.
4. Flag any quote that is missing critical items the others include.
5. If one quote has significantly more red flags, call it out clearly.
6. Give a final recommendation that a non-technical homeowner can understand.

Return ONLY valid JSON matching this exact schema — no markdown, no explanation:
{
  "quotes": [
    {
      "label": "Quote A (Contractor Name or 'Quote 1')",
      "contractor_name": "string or null",
      "total_price": number or null,
      "price_per_opening": number or null,
      "opening_count": number or null,
      "grade": "A-F",
      "flag_count": number,
      "red_flag_count": number,
      "has_warranty": boolean,
      "warranty_summary": "string",
      "has_permits": boolean,
      "brand_quality": "premium" | "mid-range" | "budget" | "unspecified",
      "strengths": ["string"],
      "weaknesses": ["string"]
    }
  ],
  "dimensions": [
    {
      "category": "Price" | "Safety" | "Warranty" | "Installation" | "Transparency",
      "winner": "Quote A label",
      "summary": "One sentence explaining why this quote wins on this dimension",
      "difference": "Dollar or percentage difference, or qualitative gap"
    }
  ],
  "red_flag_warnings": [
    "Any critical issues that only appear in one quote but not others"
  ],
  "recommendation": {
    "best_value": "Quote label",
    "reasoning": "2-3 sentence plain-English explanation of why this is the best choice",
    "savings_if_switched": "Dollar estimate if the homeowner switches from the worst to the best quote",
    "caveats": "Any important caveats about the recommendation"
  },
  "homeowner_summary": "A 2-3 sentence plain-English summary a non-technical person can text to their spouse."
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { scan_session_ids, phone_e164 } = await req.json();

    if (!Array.isArray(scan_session_ids) || scan_session_ids.length < 2) {
      return json({ error: "At least 2 scan_session_ids are required" }, 400);
    }
    if (!phone_e164) {
      return json({ error: "phone_e164 is required for authorization" }, 400);
    }
    if (scan_session_ids.length > 5) {
      return json({ error: "Maximum 5 quotes can be compared at once" }, 400);
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return json({ error: "AI service not configured" }, 500);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── 1. Verify auth for at least one session ───────────────────────
    let authorized = false;
    for (const sid of scan_session_ids) {
      const { data } = await supabase.rpc("get_analysis_full", {
        p_scan_session_id: sid,
        p_phone_e164: phone_e164,
      });
      if (data && data.length > 0) {
        authorized = true;
        break;
      }
    }

    if (!authorized) {
      return json(
        { error: "Not authorized. Phone verification required." },
        403,
      );
    }

    // ── 2. Check cache ────────────────────────────────────────────────
    const sortedIds = [...scan_session_ids].sort();
    const { data: cached } = await supabase
      .from("quote_comparisons")
      .select("comparison_json")
      .contains("scan_session_ids", sortedIds)
      .maybeSingle();

    if (cached?.comparison_json) {
      console.log("[compare-quotes] Returning cached comparison");
      return json({
        success: true,
        comparison: cached.comparison_json,
        cached: true,
      });
    }

    // ── 3. Fetch all analyses ─────────────────────────────────────────
    const { data: analyses, error: fetchErr } = await supabase
      .from("analyses")
      .select("scan_session_id, grade, flags, full_json, analysis_status")
      .in("scan_session_id", scan_session_ids)
      .eq("analysis_status", "complete");

    if (fetchErr || !analyses || analyses.length < 2) {
      return json({
        error: `Need at least 2 completed analyses. Found ${
          analyses?.length || 0
        }.`,
      }, 400);
    }

    // ── 4. Build Gemini payload ───────────────────────────────────────
    const quoteDataBlocks = analyses.map((a, i) => {
      const fullJson = a.full_json as Record<string, unknown>;
      const extraction = fullJson?.extraction as
        | Record<string, unknown>
        | undefined;
      const derivedMetrics = fullJson?.derived_metrics as
        | Record<string, unknown>
        | undefined;
      const perOpening = derivedMetrics?.per_opening as
        | Record<string, unknown>
        | undefined;
      const flags = fullJson?.flags as
        | Array<Record<string, unknown>>
        | undefined;
      const pillarScores = fullJson?.pillar_scores as
        | Record<string, unknown>
        | undefined;

      return [
        `\n=== QUOTE ${String.fromCharCode(65 + i)} (session: ${
          a.scan_session_id.slice(0, 8)
        }...) ===`,
        `Grade: ${a.grade}`,
        `Contractor: ${extraction?.contractor_name || "Not specified"}`,
        `Total Price: $${extraction?.total_quoted_price || "Unknown"}`,
        `Opening Count: ${extraction?.opening_count || "Unknown"}`,
        `Price Per Opening (installed): $${
          perOpening?.installed_price_per_opening || "Unknown"
        }`,
        `Price Per Opening (contract): $${
          perOpening?.contract_price_per_opening || "Unknown"
        }`,
        ``,
        `Pillar Scores: ${pillarScores ? JSON.stringify(pillarScores) : "N/A"}`,
        ``,
        `Warranty: ${
          extraction?.warranty
            ? JSON.stringify(extraction.warranty)
            : "Not specified"
        }`,
        `Permits: ${
          extraction?.permits
            ? JSON.stringify(extraction.permits)
            : "Not specified"
        }`,
        `Installation: ${
          extraction?.installation
            ? JSON.stringify(extraction.installation)
            : "Not specified"
        }`,
        `Cancellation Policy: ${
          extraction?.cancellation_policy || "Not specified"
        }`,
        ``,
        `Flags (${Array.isArray(flags) ? flags.length : 0}):`,
        Array.isArray(flags)
          // deno-lint-ignore no-explicit-any
          ? flags.map((f: any) => `  - [${f.severity}] ${f.flag}: ${f.detail}`)
            .join("\n")
          : "  None",
        ``,
        `Line Items (${
          Array.isArray(extraction?.line_items)
            ? (extraction.line_items as unknown[]).length
            : 0
        }):`,
        Array.isArray(extraction?.line_items)
          ? (extraction.line_items as Array<Record<string, unknown>>).slice(
            0,
            15,
            // deno-lint-ignore no-explicit-any
          ).map((li: any) =>
            `  - ${li.description || "Unknown"} | qty:${
              li.quantity || "?"
            } | unit:$${li.unit_price || "?"} | total:$${
              li.total_price || "?"
            } | brand:${li.brand || "?"} | DP:${li.dp_rating || "?"}`
          ).join("\n")
          : "  None extracted",
      ].join("\n");
    });

    const fullPayload =
      `HOMEOWNER QUOTE COMPARISON REQUEST\n\nThe homeowner has ${analyses.length} quotes to compare for the same project.\n${
        quoteDataBlocks.join("\n")
      }`;

    // ── 5. Call Gemini ─────────────────────────────────────────────────
    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;

    const geminiResp = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: COMPARISON_PROMPT },
            { text: fullPayload },
          ],
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 3072,
        },
      }),
    });

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      console.error(
        "[compare-quotes] Gemini API error:",
        geminiResp.status,
        errText,
      );
      return json({ error: "AI comparison failed" }, 502);
    }

    const geminiJson = await geminiResp.json();
    const rawText = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      console.error("[compare-quotes] Empty Gemini response");
      return json({ error: "AI returned empty response" }, 502);
    }

    // ── 6. Parse response ──────────────────────────────────────────────
    let cleanJson = rawText.trim();
    if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/^```(?:json)?\s*/, "").replace(
        /\s*```$/,
        "",
      );
    }

    let comparison: Record<string, unknown>;
    try {
      comparison = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.error(
        "[compare-quotes] JSON parse failed:",
        parseErr,
        "Raw:",
        cleanJson.slice(0, 500),
      );
      return json({ error: "AI response was not parseable" }, 502);
    }

    // ── 7. Resolve lead_id for caching ───────────────────────────────
    let leadId: string | null = null;
    const { data: firstSession } = await supabase
      .from("scan_sessions")
      .select("lead_id")
      .eq("id", scan_session_ids[0])
      .maybeSingle();
    leadId = firstSession?.lead_id || null;

    // ── 8. Cache comparison ───────────────────────────────────────────
    await supabase.from("quote_comparisons").insert({
      lead_id: leadId,
      scan_session_ids: sortedIds,
      comparison_json: comparison,
      analysis_count: analyses.length,
    });

    // ── 9. Log event ──────────────────────────────────────────────────
    const now = new Date().toISOString();
    await supabase.from("event_logs").insert({
      event_name: "quotes_compared",
      session_id: scan_session_ids[0],
      route: "/report",
      metadata: {
        analysis_count: analyses.length,
        grades: analyses.map((a) => a.grade),
        // deno-lint-ignore no-explicit-any
        best_value: (comparison.recommendation as any)?.best_value || null,
        timestamp: now,
      },
    });

    console.log(`[compare-quotes] Compared ${analyses.length} quotes`, {
      grades: analyses.map((a) => a.grade),
      // deno-lint-ignore no-explicit-any
      bestValue: (comparison.recommendation as any)?.best_value,
    });

    return json({ success: true, comparison, cached: false });
  } catch (err) {
    console.error("[compare-quotes] unhandled error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
