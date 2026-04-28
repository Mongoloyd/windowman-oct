// deno-lint-ignore no-import-prefix
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ──────────────────────────────────────────────────────────────────────────────
// CORS CONFIGURATION
// ──────────────────────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ──────────────────────────────────────────────────────────────────────────────
// BUSINESS LOGIC: PRIORITY SCORE COMPUTATION
// ──────────────────────────────────────────────────────────────────────────────
/**
 * Computes contractor opportunity priority score (0-100)
 * Higher scores = higher conversion probability + revenue potential
 *
 * Scoring Algorithm:
 * - Grade weight: F=40, D=30, C=20, B=10, A=5
 * - Critical flags: 8 points each (max 40)
 * - Warning flags: 3 points each (max 15)
 * - Window count tiers: 4+ (6pts), 8+ (12pts), 15+ (20pts)
 * - Quote value tiers: $8K+ (5pts), $15K+ (10pts), $30K+ (15pts)
 * - High confidence bonus: 5pts for confidence ≥ 80%
 */
function computePriorityScore(params: {
  grade: string | null;
  flagCount: number;
  redFlagCount: number;
  amberFlagCount: number;
  windowCount: number | null;
  quoteRange: string | null;
  confidenceScore: number | null;
}): number {
  let score = 0;

  // Grade-based baseline
  const gradeMap: Record<string, number> = { F: 40, D: 30, C: 20, B: 10, A: 5 };
  score += gradeMap[params.grade || "C"] ?? 15;

  // Flag severity weighting
  score += Math.min(params.redFlagCount * 8, 40);
  score += Math.min(params.amberFlagCount * 3, 15);

  // Project scale weighting
  if (params.windowCount) {
    if (params.windowCount >= 15) score += 20;
    else if (params.windowCount >= 8) score += 12;
    else if (params.windowCount >= 4) score += 6;
  }

  // Revenue potential weighting
  if (params.quoteRange) {
    const match = params.quoteRange.match(/[\d,]+/g);
    if (match) {
      const maxVal = Math.max(
        ...match.map((s) => parseInt(s.replace(/,/g, ""), 10)),
      );
      if (maxVal >= 30000) score += 15;
      else if (maxVal >= 15000) score += 10;
      else if (maxVal >= 8000) score += 5;
    }
  }

  // Confidence bonus
  if (params.confidenceScore && params.confidenceScore >= 80) score += 5;

  return Math.min(score, 100);
}

// ──────────────────────────────────────────────────────────────────────────────
// LEGACY TEXT BRIEF BUILDER
// ──────────────────────────────────────────────────────────────────────────────
/**
 * Generates human-readable contractor brief text + structured JSON
 * Used for email delivery and CRM integration
 *
 * Output Format:
 * - briefJson: Structured data for programmatic consumption
 * - briefText: Plain-text summary for email/SMS
 * - Metadata: Flag counts, scope gaps, warranty concerns
 */
function buildBrief(params: {
  grade: string | null;
  confidenceScore: number | null;
  county: string | null;
  projectType: string | null;
  windowCount: number | null;
  quoteRange: string | null;
  flags: unknown[];
  rubricVersion: string | null;
  fullJson: Record<string, unknown> | null;
}) {
  // deno-lint-ignore no-explicit-any
  const flagSummary = (params.flags || []).map((f: any) => ({
    title: f.title || f.name || "Unnamed flag",
    severity: f.severity || "Medium",
  }));

  const redFlags = flagSummary.filter(
    (f) => f.severity === "Critical" || f.severity === "High",
  );
  const amberFlags = flagSummary.filter((f) => f.severity === "Medium");

  // Scope gap detection
  const scopeGapKeywords = ["missing", "not specified", "unclear", "absent"];
  const majorScopeGaps = flagSummary
    .filter((f) =>
      scopeGapKeywords.some((kw) => f.title.toLowerCase().includes(kw))
    )
    .map((f) => f.title)
    .slice(0, 5);

  // Warranty concern extraction
  const warrantyFlags = flagSummary
    .filter((f) => f.title.toLowerCase().includes("warranty"))
    .map((f) => f.title);

  // Pricing posture classification
  const pricingPosture = params.grade === "F" || params.grade === "D"
    ? "significantly_above_market"
    : params.grade === "C"
    ? "above_market"
    : params.grade === "B"
    ? "market_rate"
    : "competitive";

  // Window count bucketing
  let windowCountBucket: string | null = null;
  if (params.windowCount) {
    if (params.windowCount <= 4) windowCountBucket = "1-4";
    else if (params.windowCount <= 8) windowCountBucket = "5-8";
    else if (params.windowCount <= 15) windowCountBucket = "9-15";
    else windowCountBucket = "16+";
  }

  // Structured JSON output
  const briefJson = {
    grade: params.grade,
    confidence_score: params.confidenceScore,
    county: params.county,
    project_type: params.projectType,
    window_count: params.windowCount,
    window_count_bucket: windowCountBucket,
    quote_range: params.quoteRange,
    flag_count: flagSummary.length,
    red_flag_count: redFlags.length,
    amber_flag_count: amberFlags.length,
    flag_summary: flagSummary.slice(0, 10),
    pricing_posture: pricingPosture,
    major_scope_gaps: majorScopeGaps,
    warranty_concerns: warrantyFlags,
    rubric_version: params.rubricVersion,
    generated_at: new Date().toISOString(),
  };

  // Plain-text summary
  const lines = [
    `WINDOWMAN CONTRACTOR BRIEF`,
    `Generated: ${new Date().toISOString().split("T")[0]}`,
    ``,
    `Grade: ${params.grade || "—"} | Confidence: ${
      params.confidenceScore ?? "—"
    }%`,
    `County: ${params.county || "—"} | Project: ${params.projectType || "—"}`,
    `Windows: ${params.windowCount ?? "—"} (${
      windowCountBucket || "—"
    }) | Quote Range: ${params.quoteRange || "—"}`,
    `Pricing Posture: ${pricingPosture.replace(/_/g, " ")}`,
    ``,
    `FLAGS: ${flagSummary.length} total (${redFlags.length} red, ${amberFlags.length} amber)`,
    ...flagSummary.slice(0, 8).map(
      (f) => `  [${f.severity}] ${f.title}`,
    ),
    ``,
    majorScopeGaps.length > 0
      ? `SCOPE GAPS: ${majorScopeGaps.join("; ")}`
      : `SCOPE GAPS: none identified`,
    warrantyFlags.length > 0
      ? `WARRANTY: ${warrantyFlags.join("; ")}`
      : `WARRANTY: no issues flagged`,
    ``,
    `— This brief contains no homeowner PII. —`,
  ];

  return {
    briefJson,
    briefText: lines.join("\n"),
    flagCount: flagSummary.length,
    redFlagCount: redFlags.length,
    amberFlagCount: amberFlags.length,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// CONTRACTOR MATCHING ENGINE
// ──────────────────────────────────────────────────────────────────────────────
interface ContractorRow {
  id: string;
  company_name: string;
  status: string;
  is_vetted: boolean;
  service_counties: string[];
  project_types: string[];
  min_window_count: number | null;
  max_window_count: number | null;
  accepts_low_grade_leads: boolean;
}

interface MatchCandidate {
  contractor_id: string;
  score: number;
  reasons: string[];
}

/**
 * Single-client match logic — guarantees a match for every lead.
 * Baseline 50pts + bonuses only (no penalties).
 *
 * Scoring: Baseline 50 | Vetted +20 | County match +30 | D/F grade +20
 * Confidence: high (≥70) or medium (all others)
 */
function computeSuggestedMatch(params: {
  contractors: ContractorRow[];
  county: string | null;
  grade: string | null;
}): {
  topCandidate: MatchCandidate | null;
  topThree: MatchCandidate[];
  confidence: "high" | "medium" | "low";
} {
  const candidates: MatchCandidate[] = [];

  for (const c of params.contractors) {
    if (c.status !== "active") continue;

    let score = 50; // High baseline — single client always enters pool
    const reasons: string[] = ["primary_market_partner"];

    if (c.is_vetted) {
      score += 20;
      reasons.push("vetted_contractor");
    }

    // Geography: bonuses only, no penalties
    if (
      params.county && c.service_counties.some(
        (sc) => sc.toLowerCase() === params.county!.toLowerCase(),
      )
    ) {
      score += 30;
      reasons.push("county_specialist");
    } else {
      reasons.push("regional_service_coverage");
    }

    // High-opportunity leads (D/F grades) get a bonus
    if (params.grade === "F" || params.grade === "D") {
      score += 20;
      reasons.push("target_vulnerability_specialist");
    }

    candidates.push({ contractor_id: c.id, score, reasons });
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  const topThree = candidates.slice(0, 3);
  const topCandidate = topThree[0] || null;

  // Confidence: high (≥70) or medium (everything else)
  let confidence: "high" | "medium" | "low" = "medium";
  if (topCandidate && topCandidate.score >= 70) {
    confidence = "high";
  }

  console.log(
    "[MATCH_FORENSIC]",
    JSON.stringify({
      finalScore: topCandidate?.score ?? null,
      matchReasons: topCandidate?.reasons ?? [],
      confidence,
      contractorId: topCandidate?.contractor_id ?? null,
      candidateCount: candidates.length,
      allScores: candidates.map((c) => ({
        id: c.contractor_id,
        score: c.score,
      })),
    }),
  );

  return { topCandidate, topThree, confidence };
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN REQUEST HANDLER
// ──────────────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { scan_session_id, phone_e164: rawPhone, cta_source } = await req
      .json();
    const phone_e164 = typeof rawPhone === "string" ? rawPhone.trim() : "";

    console.log("[generate-contractor-brief] invoked", {
      scan_session_id,
      phone_e164: phone_e164 ? `${phone_e164.slice(0, 4)}****` : "(empty)",
      cta_source: cta_source || "intro_request",
    });

    // ── STEP 1: Input Validation ────────────────────────────────────────────
    if (!scan_session_id || !phone_e164) {
      return new Response(
        JSON.stringify({
          error: "scan_session_id and phone_e164 are required.",
        }),
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

    // ── STEP 2: Phone Verification Gate ─────────────────────────────────────
    const { data: authCheck } = await supabase.rpc("get_analysis_full", {
      p_scan_session_id: scan_session_id,
      p_phone_e164: phone_e164,
    });

    if (!authCheck || authCheck.length === 0) {
      console.error("[generate-contractor-brief] authorization failed", {
        scan_session_id,
      });
      return new Response(
        JSON.stringify({
          error: "Not authorized. Phone verification required.",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const analysis = authCheck[0];

    // ── STEP 3: Lead Context Retrieval ──────────────────────────────────────
    const { data: session } = await supabase
      .from("scan_sessions")
      .select("lead_id")
      .eq("id", scan_session_id)
      .maybeSingle();

    if (!session?.lead_id) {
      console.error("[generate-contractor-brief] no lead_id on scan_session");
      return new Response(
        JSON.stringify({ error: "Session not linked to a lead." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: lead } = await supabase
      .from("leads")
      .select("county, window_count, project_type, quote_range, first_name")
      .eq("id", session.lead_id)
      .maybeSingle();

    // ── STEP 4: Analysis Record Verification ────────────────────────────────
    const { data: analysisRow } = await supabase
      .from("analyses")
      .select("id")
      .eq("scan_session_id", scan_session_id)
      .eq("analysis_status", "complete")
      .maybeSingle();

    if (!analysisRow) {
      return new Response(
        JSON.stringify({ error: "No completed analysis found." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── STEP 5: Brief Generation ────────────────────────────────────────────
    const flags = Array.isArray(analysis.flags) ? analysis.flags : [];

    const brief = buildBrief({
      grade: analysis.grade,
      confidenceScore: analysis.confidence_score,
      county: lead?.county || null,
      projectType: lead?.project_type || null,
      windowCount: lead?.window_count || null,
      quoteRange: lead?.quote_range || null,
      flags,
      rubricVersion: analysis.rubric_version,
      fullJson: analysis.full_json as Record<string, unknown> | null,
    });

    const priorityScore = computePriorityScore({
      grade: analysis.grade,
      flagCount: brief.flagCount,
      redFlagCount: brief.redFlagCount,
      amberFlagCount: brief.amberFlagCount,
      windowCount: lead?.window_count || null,
      quoteRange: lead?.quote_range || null,
      confidenceScore: analysis.confidence_score,
    });

    console.log("[generate-contractor-brief] brief built", {
      grade: analysis.grade,
      flagCount: brief.flagCount,
      priorityScore,
    });

    // ── STEP 6: Cache Brief in Analysis Record ──────────────────────────────
    const now = new Date().toISOString();

    await supabase
      .from("analyses")
      .update({
        contractor_brief: brief.briefText,
        contractor_brief_json: brief.briefJson,
        contractor_brief_generated_at: now,
      })
      .eq("id", analysisRow.id);

    // ── STEP 7: Contractor Matching ─────────────────────────────────────────
    const { data: allContractors } = await supabase
      .from("contractors")
      .select(
        "id, company_name, status, is_vetted, service_counties, project_types, min_window_count, max_window_count, accepts_low_grade_leads",
      )
      .eq("status", "active");

    const matchResult = computeSuggestedMatch({
      contractors: (allContractors || []) as ContractorRow[],
      county: lead?.county || null,
      grade: analysis.grade,
    });

    const suggestedMatchSnapshot = matchResult.topCandidate
      ? {
        confidence: matchResult.confidence,
        generated_at: now,
        reason_count: matchResult.topCandidate.reasons.length,
      }
      : null;

    const suggestedTopCandidates = matchResult.topThree.map((c) => ({
      contractor_id: c.contractor_id,
      score: c.score,
      reasons: c.reasons,
    }));

    console.log("[generate-contractor-brief] match computed", {
      topCandidate: matchResult.topCandidate?.contractor_id || null,
      confidence: matchResult.confidence,
      candidateCount: matchResult.topThree.length,
    });

    // ── STEP 8: Idempotency Check ───────────────────────────────────────────
    const { data: existingOpp } = await supabase
      .from("contractor_opportunities")
      .select(
        "id, suggested_match_snapshot, suggested_match_confidence, suggested_match_reasons, suggested_contractor_id",
      )
      .eq("scan_session_id", scan_session_id)
      .maybeSingle();

    if (existingOpp) {
      console.log(
        "[generate-contractor-brief] idempotent hit — returning existing opportunity",
        {
          opportunityId: existingOpp.id,
        },
      );

      const existingMatch = existingOpp.suggested_contractor_id
        ? {
          confidence: existingOpp.suggested_match_confidence || "low",
          reasons: (existingOpp.suggested_match_reasons as string[]) || [],
          contractor_alias: `WM-${
            existingOpp.suggested_contractor_id.slice(0, 6).toUpperCase()
          }`,
        }
        : null;

      return new Response(
        JSON.stringify({
          success: true,
          opportunity_id: existingOpp.id,
          analysis_id: analysisRow.id,
          status: "brief_ready",
          suggested_match: existingMatch,
          idempotent: true,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── STEP 9: Opportunity Record Creation ─────────────────────────────────
    const matchFields = {
      suggested_contractor_id: matchResult.topCandidate?.contractor_id || null,
      suggested_match_generated_at: now,
      suggested_match_confidence: matchResult.confidence,
      suggested_match_reasons: matchResult.topCandidate?.reasons || null,
      suggested_match_snapshot: suggestedMatchSnapshot,
      suggested_match_top_candidates: suggestedTopCandidates,
      cta_source: cta_source || "intro_request",
    };

    const { data: newOpp, error: insertErr } = await supabase
      .from("contractor_opportunities")
      .insert({
        lead_id: session.lead_id,
        scan_session_id,
        analysis_id: analysisRow.id,
        status: "brief_ready",
        intro_requested_at: now,
        brief_generated_at: now,
        brief_version: "1.0",
        brief_json: brief.briefJson,
        brief_text: brief.briefText,
        county: lead?.county || null,
        project_type: lead?.project_type || null,
        window_count: lead?.window_count || null,
        quote_range: lead?.quote_range || null,
        grade: analysis.grade,
        flag_count: brief.flagCount,
        red_flag_count: brief.redFlagCount,
        amber_flag_count: brief.amberFlagCount,
        priority_score: priorityScore,
        ...matchFields,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error(
        "[generate-contractor-brief] opportunity insert failed",
        insertErr,
      );
      return new Response(
        JSON.stringify({ error: "Failed to create opportunity." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const opportunityId = newOpp!.id;

    // ── STEP 10: Event Logging ──────────────────────────────────────────────
    await supabase.from("event_logs").insert({
      event_name: "contractor_brief_generated",
      session_id: scan_session_id,
      route: "/",
      metadata: {
        opportunity_id: opportunityId,
        analysis_id: analysisRow.id,
        grade: analysis.grade,
        priority_score: priorityScore,
        flag_count: brief.flagCount,
        timestamp: now,
      },
    });

    if (matchResult.topCandidate) {
      await supabase.from("event_logs").insert({
        event_name: "suggested_match_generated",
        session_id: scan_session_id,
        route: "/",
        metadata: {
          opportunity_id: opportunityId,
          suggested_contractor_id: matchResult.topCandidate.contractor_id,
          confidence: matchResult.confidence,
          score: matchResult.topCandidate.score,
          reason_count: matchResult.topCandidate.reasons.length,
          candidate_count: matchResult.topThree.length,
          timestamp: now,
        },
      });
    } else {
      await supabase.from("event_logs").insert({
        event_name: "suggested_match_unavailable",
        session_id: scan_session_id,
        route: "/",
        metadata: {
          opportunity_id: opportunityId,
          contractor_count: allContractors?.length || 0,
          timestamp: now,
        },
      });
    }

    console.log("[generate-contractor-brief] complete", {
      opportunityId,
      analysisId: analysisRow.id,
      status: "brief_ready",
      suggestedContractor: matchResult.topCandidate?.contractor_id || null,
    });

    // ── STEP 11: Success Response ───────────────────────────────────────────
    return new Response(
      JSON.stringify({
        success: true,
        opportunity_id: opportunityId,
        analysis_id: analysisRow.id,
        status: "brief_ready",
        suggested_match: matchResult.topCandidate
          ? {
            confidence: matchResult.confidence,
            reasons: matchResult.topCandidate.reasons,
            contractor_alias: `WM-${
              matchResult.topCandidate.contractor_id.slice(0, 6).toUpperCase()
            }`,
          }
          : null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[generate-contractor-brief] unhandled exception:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
