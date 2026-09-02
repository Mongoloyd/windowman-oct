import type { FullReportSummarySource } from "./types.ts";

const BASE_ANALYSIS_ID =
  "fixture-analysis-00000000-0000-4000-8000-000000000001";

/** A — Mixed: one strength, two concerns */
export function buildFixtureMixedSource(): FullReportSummarySource {
  return {
    analysis_id: BASE_ANALYSIS_ID,
    rubric_version: "rubric_v2",
    grade: "C",
    has_warranty: true,
    has_permits: false,
    contractor_name_present: true,
    summary:
      "This Grade C quote needs clarification in several areas before it can be considered safe to sign.",
    flags: [
      {
        flag: "subject_to_remeasure_clause",
        severity: "Critical",
        pillar: "finePrint",
        detail:
          "Quote includes subject-to-remeasure language that may allow price increases after signing",
      },
      {
        flag: "missing_dp_rating",
        severity: "High",
        pillar: "safety",
        detail: "3 item(s) missing DP rating",
      },
      {
        flag: "finish_exclusions_present",
        severity: "Low",
        pillar: "warranty",
        detail:
          "Warranty excludes post-install stucco and/or paint touch-up damage",
      },
    ],
    missing_items: [
      "Design Pressure (DP) ratings for all windows and doors",
      "Written change-order requirement before extra charges",
    ],
    warnings: [
      'RED FLAG: "Subject to remeasure" language may allow the contractor to raise the price after signing.',
    ],
    flag_red_count: 2,
    flag_amber_count: 0,
  };
}

/** B — Mostly clean: no red findings, one minor clarification */
export function buildFixtureMostlyCleanSource(): FullReportSummarySource {
  return {
    analysis_id: `${BASE_ANALYSIS_ID}-clean`,
    rubric_version: "rubric_v2",
    grade: "B",
    has_warranty: true,
    has_permits: true,
    contractor_name_present: true,
    summary:
      "This Grade B quote needs clarification in several areas before it can be considered safe to sign.",
    flags: [
      {
        flag: "finish_exclusions_present",
        severity: "Low",
        pillar: "warranty",
        detail:
          "Warranty excludes post-install stucco and/or paint touch-up damage",
      },
      {
        flag: "callback_process_missing",
        severity: "Medium",
        pillar: "warranty",
        detail: "Warranty callback process is not described",
      },
    ],
    missing_items: ["Warranty callback / service request process"],
    warnings: [
      "Caution: The process for requesting warranty service is not clearly described.",
    ],
    flag_red_count: 0,
    flag_amber_count: 1,
  };
}

/** C — Problematic: multiple high-severity findings */
export function buildFixtureProblematicSource(): FullReportSummarySource {
  return {
    analysis_id: `${BASE_ANALYSIS_ID}-problematic`,
    rubric_version: "rubric_v2",
    grade: "D",
    has_warranty: false,
    has_permits: false,
    contractor_name_present: true,
    summary:
      "This quote shows multiple high-risk issues, including contract traps and missing technical proof that should be resolved before signing.",
    flags: [
      {
        flag: "unilateral_price_adjustment",
        severity: "Critical",
        pillar: "finePrint",
        detail: "Contractor may raise price unilaterally after signing",
      },
      {
        flag: "water_intrusion_excluded",
        severity: "High",
        pillar: "warranty",
        detail:
          "Warranty excludes water intrusion damage — a critical coverage gap",
      },
      {
        flag: "deposit_over_40_percent",
        severity: "Critical",
        pillar: "price",
        detail: "Deposit requirement is 55% upfront",
      },
      {
        flag: "opening_schedule_missing",
        severity: "High",
        pillar: "install",
        detail: "No room-by-room opening schedule found",
      },
      {
        flag: "missing_noa_number",
        severity: "Medium",
        pillar: "safety",
        detail: "4 item(s) missing NOA number",
      },
      {
        flag: "substrate_open_checkbook",
        severity: "High",
        pillar: "install",
        detail: "Rot/substrate costs appear open-ended",
      },
    ],
    missing_items: [
      "NOA/FL product approval numbers for all windows and doors",
      "Room-by-room opening schedule",
      "Unit pricing for rot, buck replacement, or substrate repairs",
      "Clear written statement confirming whether water intrusion damage is covered",
    ],
    warnings: [
      "🚨 CRITICAL: Quote gives the contractor unilateral power to raise pricing after you sign.",
      "🚨 CRITICAL: Water intrusion damage appears excluded from warranty coverage.",
    ],
    flag_red_count: 4,
    flag_amber_count: 1,
  };
}

/** D — Sparse: insufficient detailed facts */
export function buildFixtureSparseSource(): FullReportSummarySource {
  return {
    analysis_id: `${BASE_ANALYSIS_ID}-sparse`,
    rubric_version: "rubric_v2",
    grade: "C",
    has_warranty: null,
    has_permits: null,
    contractor_name_present: false,
    summary: null,
    flags: [],
    missing_items: [],
    warnings: [],
    flag_red_count: 0,
    flag_amber_count: 0,
  };
}

/** E — Missing contractor identity */
export function buildFixtureMissingContractorSource(): FullReportSummarySource {
  return {
    analysis_id: `${BASE_ANALYSIS_ID}-no-contractor`,
    rubric_version: "rubric_v2",
    grade: "C",
    has_warranty: true,
    has_permits: false,
    contractor_name_present: false,
    summary:
      "This Grade C quote needs clarification in several areas before it can be considered safe to sign.",
    flags: [
      {
        flag: "unspecified_brand",
        severity: "Medium",
        pillar: "finePrint",
        detail: "2 item(s) with unspecified brand/series",
      },
      {
        flag: "vague_install_scope",
        severity: "Medium",
        pillar: "install",
        detail: "Installation scope is vague or missing",
      },
    ],
    missing_items: ["Specific manufacturer, product line, and series"],
    warnings: [
      "High risk: Product description is too generic to verify the exact impact-rated product being sold.",
    ],
    flag_red_count: 0,
    flag_amber_count: 2,
  };
}
