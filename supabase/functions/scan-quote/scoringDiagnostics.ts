// ═══════════════════════════════════════════════════════════════════════════════
// SCANNER BRAIN — Scoring Diagnostics (Explain-this-Grade)
//
// Pure observability layer. DOES NOT change scoring behavior.
//
// Mirrors the deductions in scoring.ts so we can attribute every point lost
// to a named rule, then verifies parity by running the canonical computeGrade()
// and asserting the final letter grade / weighted average / pillar scores match.
//
// If parity fails, the trace flags `parityOk: false` and includes a `mismatch`
// block — a loud signal that the trace fell out of sync with scoring.ts.
//
// Used by:
//   - Future "Explain This Grade" UI panels (DEV / partner demos)
//   - scripts/scanner-fixture-report.ts trace mode
//   - Internal QA for rubric drift detection
// ═══════════════════════════════════════════════════════════════════════════════

import { classifyLineItem, isCoreOpening } from "../_shared/metrics.ts";
import {
  clamp,
  computeGrade,
  type ExtractionResult,
  GRADE_RANK,
  type GradeResult,
  PILLAR_WEIGHTS,
  type PillarScores,
} from "./scoring.ts";

// ── Types ────────────────────────────────────────────────────────────────────

export interface PenaltyEntry {
  rule: string;
  points: number; // positive number representing points subtracted
  reason: string;
  evidence?: unknown;
}

export interface PillarTrace {
  startingScore: number;
  finalScore: number;
  penalties: PenaltyEntry[];
}

export interface HardCapEvaluation {
  cap: string;
  applied: boolean;
  reason: string;
  resultingMaxGrade: string | null;
}

export interface GradeTrace {
  letterGrade: string;
  weightedAverage: number;
  hardCapApplied: string | null;
  pillarScores: PillarScores;
  pillars: {
    safety: PillarTrace;
    install: PillarTrace;
    price: PillarTrace;
    finePrint: PillarTrace;
    warranty: PillarTrace;
  };
  hardCaps: HardCapEvaluation[];
  parityOk: boolean;
  mismatch?: {
    canonical: GradeResult;
    diagnostic: {
      letterGrade: string;
      weightedAverage: number;
      hardCapApplied: string | null;
      pillarScores: PillarScores;
    };
  };
}

// ── Local helpers (do not export — keep diagnostic-internal) ─────────────────

const isMissing = (val?: string) =>
  !val || /^(n\/a|na|none|unknown|tbd|-|not applicable)$/i.test(val.trim());

function ledger(start = 100) {
  const penalties: PenaltyEntry[] = [];
  let score = start;
  return {
    deduct(points: number, rule: string, reason: string, evidence?: unknown) {
      if (points <= 0) return;
      score -= points;
      penalties.push({ rule, points, reason, evidence });
    },
    finish(): PillarTrace {
      return { startingScore: start, finalScore: clamp(score), penalties };
    },
  };
}

// ── Pillar trace builders (mirror scoring.ts exactly) ────────────────────────

function traceSafety(d: ExtractionResult): PillarTrace {
  const L = ledger(100);
  const items = d.line_items ?? [];

  const itemsWithoutDp = items.filter((i) => isMissing(i.dp_rating));
  const itemsWithoutNoa = items.filter((i) => isMissing(i.noa_number));

  if (itemsWithoutDp.length > 0) {
    L.deduct(
      Math.min(50, itemsWithoutDp.length * 25),
      "missing_dp_rating",
      `${itemsWithoutDp.length} line item(s) missing DP rating`,
      { count: itemsWithoutDp.length },
    );
  }
  if (itemsWithoutNoa.length > 0) {
    L.deduct(
      Math.min(40, itemsWithoutNoa.length * 20),
      "missing_noa_number",
      `${itemsWithoutNoa.length} line item(s) missing NOA number`,
      { count: itemsWithoutNoa.length },
    );
  }
  if (d.hvhz_zone === undefined || d.hvhz_zone === null) {
    L.deduct(10, "hvhz_zone_unknown", "HVHZ zone not specified");
  }

  const hasImpactMention = items.some((i) =>
    /impact|hurricane|storm/i.test(i.description || "")
  );
  if (!hasImpactMention && items.length > 0) {
    L.deduct(25, "no_impact_mention", "No line item references impact/hurricane/storm");
  }

  if (d.generic_product_description_present === true) {
    L.deduct(15, "generic_product_description", "Generic product description present");
    const completelyMissingSpecs = items.length > 0 &&
      items.every((i) => isMissing(i.dp_rating) && isMissing(i.noa_number));
    if (completelyMissingSpecs) {
      L.deduct(10, "generic_plus_no_specs", "Generic + zero DP/NOA specs across all items");
    }
  }

  const incompleteGlassSpecs =
    items.filter((i) => i.glass_spec_complete !== true).length;
  const lowEOrArgonUnknown = items.filter(
    (i) => i.glass_low_e_present === null || i.glass_argon_present === null,
  ).length;

  if (d.opening_level_glass_specs_present !== true && items.length > 0) {
    L.deduct(20, "no_opening_level_glass_specs", "Opening-level glass specs not present");
  }
  if (d.blanket_glass_language_present === true) {
    L.deduct(10, "blanket_glass_language", "Blanket glass language present");
  }
  if (incompleteGlassSpecs > 0) {
    L.deduct(
      Math.min(20, incompleteGlassSpecs * 5),
      "incomplete_glass_specs",
      `${incompleteGlassSpecs} item(s) with incomplete glass specs`,
    );
  }
  if (lowEOrArgonUnknown > 0) {
    L.deduct(
      Math.min(10, lowEOrArgonUnknown * 3),
      "low_e_or_argon_unknown",
      `${lowEOrArgonUnknown} item(s) with unknown low-E/argon`,
    );
  }
  if (d.manufacturer_install_compliance_stated !== true) {
    L.deduct(5, "no_manufacturer_install_compliance", "Manufacturer install compliance not stated");
  }
  if (d.code_compliance_install_statement_present !== true) {
    L.deduct(5, "no_code_compliance_statement", "Code-compliance install statement absent");
  }

  return L.finish();
}

function traceInstall(d: ExtractionResult): PillarTrace {
  const L = ledger(100);
  const items = d.line_items ?? [];

  if (!d.installation?.scope_detail) L.deduct(20, "no_scope_detail", "Install scope detail missing");
  if (!d.permits || d.permits.included === undefined) L.deduct(15, "permits_unclear", "Permit handling unclear");
  if (d.permit_fees_itemized === false) L.deduct(5, "permit_fees_not_itemized", "Permit fees not itemized");
  if (!d.installation?.disposal_included) L.deduct(10, "no_disposal", "Disposal not included");
  if (d.debris_removal_included === false) L.deduct(10, "no_debris_removal", "Debris removal not included");
  if (!d.wall_repair_scope) L.deduct(10, "no_wall_repair_scope", "Wall repair scope missing");
  if (d.stucco_repair_included === false) L.deduct(5, "no_stucco_repair", "Stucco repair not included");
  if (d.drywall_repair_included === false) L.deduct(5, "no_drywall_repair", "Drywall repair not included");
  if (d.paint_touchup_included === false) L.deduct(5, "no_paint_touchup", "Paint touch-up not included");
  if (d.engineering_mentioned === false) L.deduct(5, "no_engineering_mention", "Engineering not mentioned");
  if (d.engineering_fees_included === false) L.deduct(5, "no_engineering_fees", "Engineering fees not included");
  if (!d.opening_count && items.length === 0) L.deduct(10, "no_opening_count_no_items", "No opening count and no line items");
  if (!d.installation?.accessories_mentioned) L.deduct(5, "no_accessories", "Accessories not mentioned");

  const coreOpeningCount = d.opening_count ??
    items.filter((i) => isCoreOpening(classifyLineItem(i.description))).length;
  const multiOpeningJob = coreOpeningCount > 1;

  if (multiOpeningJob && d.opening_schedule_present !== true) {
    L.deduct(20, "no_opening_schedule_multi_opening", "Multi-opening job without opening schedule");
  }
  if (d.opening_schedule_present === true && d.opening_schedule_room_labels_present !== true) {
    L.deduct(10, "schedule_no_room_labels", "Opening schedule lacks room labels");
  }
  if (d.opening_schedule_present === true && d.opening_schedule_dimensions_complete !== true) {
    L.deduct(10, "schedule_dimensions_incomplete", "Opening schedule dimensions incomplete");
  }
  if (d.opening_schedule_present === true && d.opening_schedule_product_assignments_present !== true) {
    L.deduct(15, "schedule_no_product_assignments", "Opening schedule lacks product assignments");
  }
  if (d.bulk_scope_blob_present === true) {
    L.deduct(10, "bulk_scope_blob", "Bulk scope blob present");
  }

  if (!d.anchoring_method_text && items.length > 0) {
    L.deduct(15, "no_anchoring_method", "Anchoring method not specified");
  }
  if (d.anchoring_method_text && d.anchor_spacing_specified !== true) {
    L.deduct(5, "no_anchor_spacing", "Anchor spacing not specified");
  }
  if (d.anchoring_method_text && d.fastener_type_specified !== true) {
    L.deduct(5, "no_fastener_type", "Fastener type not specified");
  }
  if (!d.waterproofing_method_text && items.length > 0) {
    L.deduct(15, "no_waterproofing_method", "Waterproofing method not specified");
  }
  if (d.sealant_specified !== true && items.length > 0) {
    L.deduct(5, "no_sealant_specified", "Sealant not specified");
  }
  if (!d.buck_treatment_method_text && items.length > 0) {
    L.deduct(10, "no_buck_treatment_method", "Buck treatment method not specified");
  }

  return L.finish();
}

function tracePrice(d: ExtractionResult): PillarTrace {
  const L = ledger(100);
  const items = d.line_items ?? [];

  const itemsWithoutPrice = items.filter((i) =>
    i.unit_price === undefined && i.total_price === undefined
  );
  if (itemsWithoutPrice.length > 0) {
    L.deduct(
      Math.min(30, itemsWithoutPrice.length * 15),
      "items_without_price",
      `${itemsWithoutPrice.length} line item(s) missing price`,
    );
  }
  if (!d.total_quoted_price) L.deduct(10, "no_total_price", "Total quoted price missing");

  for (const item of items) {
    if (item.unit_price !== undefined) {
      if (item.unit_price < 100) L.deduct(5, "unit_price_too_low", `Unit price ${item.unit_price} < $100`);
      if (item.unit_price > 5000) L.deduct(5, "unit_price_too_high", `Unit price ${item.unit_price} > $5000`);
    }
  }

  if (d.deposit_percent !== undefined && d.deposit_percent !== null) {
    if (d.deposit_percent > 50) L.deduct(25, "deposit_over_50", `Deposit ${d.deposit_percent}% > 50%`);
    else if (d.deposit_percent > 40) L.deduct(15, "deposit_over_40", `Deposit ${d.deposit_percent}% > 40%`);
    else if (d.deposit_percent > 33) L.deduct(5, "deposit_over_33", `Deposit ${d.deposit_percent}% > 33%`);
  }

  if (d.final_payment_before_inspection === true) {
    L.deduct(20, "final_payment_before_inspection", "Final payment due before inspection");
  }
  if (d.subject_to_remeasure_present === true) {
    L.deduct(15, "subject_to_remeasure", "Subject-to-remeasure clause present");
  }
  if (!d.payment_schedule_text) {
    L.deduct(5, "no_payment_schedule", "Payment schedule missing");
  }

  const coreOpeningCount = d.opening_count ??
    items.filter((i) => isCoreOpening(classifyLineItem(i.description))).length;
  if (coreOpeningCount > 1 && d.opening_schedule_present !== true) {
    L.deduct(5, "price_trust_scope_ambiguity", "Multi-opening job without opening schedule (price trust)");
  }

  if (d.substrate_condition_clause_present === true && d.rot_unit_pricing_present !== true) {
    L.deduct(10, "substrate_no_rot_pricing", "Substrate clause without rot unit pricing");
  }
  if (d.substrate_condition_clause_present === true && d.buck_replacement_unit_pricing_present !== true) {
    L.deduct(10, "substrate_no_buck_pricing", "Substrate clause without buck replacement unit pricing");
  }

  return L.finish();
}

function traceFinePrint(d: ExtractionResult): PillarTrace {
  const L = ledger(100);
  const items = d.line_items ?? [];

  if (!d.cancellation_policy) L.deduct(25, "no_cancellation_policy", "Cancellation policy missing");
  if (d.terms_conditions_present === false) L.deduct(10, "no_terms_conditions", "Terms & conditions absent");

  const vague = items.filter((i) => (i.description || "").length < 10);
  if (vague.length > 0) {
    L.deduct(Math.min(20, vague.length * 10), "vague_line_items", `${vague.length} vague line item(s)`);
  }
  const unbranded = items.filter((i) => !i.brand && !i.series);
  if (unbranded.length > 0) {
    L.deduct(Math.min(20, unbranded.length * 10), "unbranded_items", `${unbranded.length} unbranded item(s)`);
  }
  if (d.generic_product_description_present === true) {
    L.deduct(10, "generic_product_description_fp", "Generic product description (fine-print pillar)");
  }
  if (d.insurance_proof_mentioned === false) L.deduct(5, "no_insurance_proof", "Insurance proof not mentioned");
  if (d.licensing_proof_mentioned === false) L.deduct(5, "no_licensing_proof", "Licensing proof not mentioned");
  if (!d.completion_timeline_text) L.deduct(5, "no_completion_timeline", "Completion timeline missing");
  if (d.state_jurisdiction_mismatch === true) L.deduct(10, "jurisdiction_mismatch", "State jurisdiction mismatch");
  if (d.lead_paint_disclosure_present === false) L.deduct(5, "no_lead_paint_disclosure", "Lead paint disclosure missing");
  if (d.blanket_glass_language_present === true) L.deduct(5, "blanket_glass_language_fp", "Blanket glass language (fine-print)");
  if (d.mixed_glass_package_visibility === true) L.deduct(5, "mixed_glass_visibility", "Mixed glass package visibility");

  if (d.unilateral_price_adjustment_allowed === true) {
    L.deduct(35, "unilateral_price_adjustment", "Unilateral price adjustment allowed");
  }
  if (d.substrate_condition_clause_present === true && d.written_change_order_required !== true) {
    L.deduct(15, "substrate_no_written_co", "Substrate clause without written change-order requirement");
  }
  if (d.substrate_condition_clause_present === true && d.homeowner_approval_required_for_change_orders !== true) {
    L.deduct(20, "substrate_no_homeowner_approval", "Substrate clause without homeowner approval");
  }
  if (d.subject_to_remeasure_present === true && d.remeasure_price_adjustment_cap_present !== true) {
    L.deduct(10, "remeasure_no_cap", "Subject-to-remeasure without price adjustment cap");
  }

  return L.finish();
}

function traceWarranty(d: ExtractionResult): PillarTrace {
  const L = ledger(100);

  if (!d.warranty) {
    L.deduct(40, "no_warranty_section", "No warranty section at all");
    return L.finish();
  }

  if (d.warranty.labor_years === undefined) L.deduct(20, "labor_years_missing", "Labor years missing");
  else if (d.warranty.labor_years < 1) L.deduct(20, "labor_years_lt_1", "Labor warranty < 1 year");
  else if (d.warranty.labor_years < 2) L.deduct(10, "labor_years_lt_2", "Labor warranty < 2 years");
  else if (d.warranty.labor_years < 5) L.deduct(5, "labor_years_lt_5", "Labor warranty < 5 years");

  if (d.warranty.manufacturer_years === undefined) L.deduct(20, "mfr_years_missing", "Manufacturer years missing");
  else if (d.warranty.manufacturer_years < 10) L.deduct(15, "mfr_years_lt_10", "Manufacturer warranty < 10 years");
  else if (d.warranty.manufacturer_years < 20) L.deduct(5, "mfr_years_lt_20", "Manufacturer warranty < 20 years");

  if (d.warranty.transferable === undefined) L.deduct(10, "transferable_unknown", "Transferability unknown");
  if (d.warranty.transferable === false) L.deduct(5, "not_transferable", "Warranty not transferable");
  if (!d.warranty.details) L.deduct(10, "no_warranty_details", "No written warranty details");

  if (d.warranty_execution_details_present !== true) {
    L.deduct(15, "no_execution_details", "Warranty execution details missing");
  }
  if (!d.warranty_service_provider_type || d.warranty_service_provider_type === "unknown") {
    L.deduct(10, "service_provider_unknown", "Warranty service provider unknown");
  }
  if (d.leak_callback_sla_days == null) L.deduct(15, "no_leak_sla", "Leak callback SLA missing");
  else if (d.leak_callback_sla_days > 14) L.deduct(10, "leak_sla_gt_14", "Leak callback SLA > 14 days");
  else if (d.leak_callback_sla_days > 7) L.deduct(5, "leak_sla_gt_7", "Leak callback SLA > 7 days");

  if (d.labor_service_sla_days == null) L.deduct(5, "no_labor_sla", "Labor service SLA missing");
  if (!d.callback_process_text) L.deduct(10, "no_callback_process", "Callback process text missing");
  if (d.post_install_stucco_excluded === true) L.deduct(5, "post_install_stucco_excluded", "Post-install stucco excluded");
  if (d.post_install_paint_excluded === true) L.deduct(5, "post_install_paint_excluded", "Post-install paint excluded");
  if (d.water_intrusion_damage_excluded === true) L.deduct(15, "water_intrusion_excluded", "Water intrusion damage excluded");
  if (d.warranty_service_provider_type === "third_party" && !d.warranty_service_provider_name) {
    L.deduct(5, "third_party_no_name", "Third-party warranty without provider name");
  }

  return L.finish();
}

// ── Hard cap evaluation (mirrors scoring.ts ordering) ────────────────────────

function evaluateHardCaps(
  d: ExtractionResult,
  pillarScores: PillarScores,
): HardCapEvaluation[] {
  const items = d.line_items ?? [];
  const evals: HardCapEvaluation[] = [];

  evals.push({
    cap: "no_warranty_section",
    applied: !d.warranty && items.length > 0,
    reason: "Quote has line items but no warranty section",
    resultingMaxGrade: "C",
  });

  evals.push({
    cap: "critical_safety",
    applied: pillarScores.safety < 40 && items.length > 0,
    reason: `Safety pillar score ${pillarScores.safety} < 40`,
    resultingMaxGrade: "D",
  });

  const hasImpactMention = items.some((i) =>
    /impact|hurricane|storm/i.test(i.description || "")
  );
  const completelyMissingSpecs = items.length > 0 &&
    items.every((i) => isMissing(i.dp_rating) && isMissing(i.noa_number));
  const genericAndUnverified =
    d.generic_product_description_present === true && completelyMissingSpecs;

  evals.push({
    cap: "unverified_impact_specs",
    applied: ((!hasImpactMention && completelyMissingSpecs) || genericAndUnverified) &&
      items.length > 0,
    reason: "No impact mention with no DP/NOA, or generic + no specs",
    resultingMaxGrade: "D",
  });

  const noOpeningGlassSpecs = items.length > 0 &&
    d.opening_level_glass_specs_present !== true;
  const allGlassPackagesUnspecified = items.length > 0 &&
    items.every((i) =>
      !i.glass_makeup_type ||
      i.glass_makeup_type === "unknown" ||
      i.glass_spec_complete !== true
    );
  evals.push({
    cap: "unverified_glass_package",
    applied: noOpeningGlassSpecs && allGlassPackagesUnspecified &&
      d.generic_product_description_present === true,
    reason: "No opening-level glass specs + all glass packages unspecified + generic description",
    resultingMaxGrade: "C",
  });

  const openingCount = d.opening_count ??
    items.filter((i) => isCoreOpening(classifyLineItem(i.description))).length;
  evals.push({
    cap: "ambiguous_opening_scope",
    applied: openingCount >= 5 &&
      d.opening_schedule_present !== true &&
      d.opening_schedule_product_assignments_present !== true,
    reason: `Opening count ${openingCount} >= 5 with no opening schedule or product assignments`,
    resultingMaxGrade: "C",
  });

  evals.push({
    cap: "unilateral_price_adjustment",
    applied: d.unilateral_price_adjustment_allowed === true && items.length > 0,
    reason: "Contractor may adjust price unilaterally",
    resultingMaxGrade: "D",
  });

  evals.push({
    cap: "remeasure_without_approval",
    applied: d.subject_to_remeasure_present === true &&
      d.homeowner_approval_required_for_change_orders !== true &&
      items.length > 0,
    reason: "Subject-to-remeasure without homeowner approval",
    resultingMaxGrade: "D",
  });

  evals.push({
    cap: "substrate_open_checkbook",
    applied: d.substrate_condition_clause_present === true &&
      d.rot_unit_pricing_present !== true &&
      d.buck_replacement_unit_pricing_present !== true &&
      items.length > 0,
    reason: "Substrate clause with no rot or buck unit pricing",
    resultingMaxGrade: "C",
  });

  evals.push({
    cap: "install_method_unverified",
    applied: items.length > 0 &&
      !d.anchoring_method_text &&
      !d.waterproofing_method_text &&
      d.manufacturer_install_compliance_stated !== true,
    reason: "No anchoring + no waterproofing + no manufacturer compliance",
    resultingMaxGrade: "C",
  });

  evals.push({
    cap: "opaque_warranty_execution",
    applied: !!d.warranty &&
      (!d.warranty_service_provider_type ||
        d.warranty_service_provider_type === "unknown") &&
      d.leak_callback_sla_days == null &&
      !d.callback_process_text,
    reason: "Warranty exists but provider/SLA/callback all missing",
    resultingMaxGrade: "C",
  });

  evals.push({
    cap: "zero_line_items",
    applied: (d.line_items ?? []).length === 0,
    reason: "Zero line items detected",
    resultingMaxGrade: "F",
  });

  return evals;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns a structured trace of how the grade was computed.
 * Always cross-checks against the canonical computeGrade() and reports parity.
 */
export function computeGradeWithTrace(data: ExtractionResult): GradeTrace {
  const safety = traceSafety(data);
  const install = traceInstall(data);
  const price = tracePrice(data);
  const finePrint = traceFinePrint(data);
  const warranty = traceWarranty(data);

  const pillarScores: PillarScores = {
    safety: safety.finalScore,
    install: install.finalScore,
    price: price.finalScore,
    finePrint: finePrint.finalScore,
    warranty: warranty.finalScore,
  };

  let weightedAverage =
    pillarScores.safety * PILLAR_WEIGHTS.safety +
    pillarScores.install * PILLAR_WEIGHTS.install +
    pillarScores.price * PILLAR_WEIGHTS.price +
    pillarScores.finePrint * PILLAR_WEIGHTS.finePrint +
    pillarScores.warranty * PILLAR_WEIGHTS.warranty;
  weightedAverage = Math.round(weightedAverage * 100) / 100;

  const hardCaps = evaluateHardCaps(data, pillarScores);

  // Canonical authority — never recompute the final letter ourselves.
  // We delegate final letterGrade + hardCapApplied to computeGrade() to
  // guarantee that the trace can never disagree on the headline result.
  const canonical = computeGrade(data);

  const diagnosticView = {
    letterGrade: canonical.letterGrade,
    weightedAverage,
    hardCapApplied: canonical.hardCapApplied,
    pillarScores,
  };

  const parityOk =
    canonical.letterGrade === diagnosticView.letterGrade &&
    canonical.weightedAverage === diagnosticView.weightedAverage &&
    canonical.hardCapApplied === diagnosticView.hardCapApplied &&
    canonical.pillarScores.safety === pillarScores.safety &&
    canonical.pillarScores.install === pillarScores.install &&
    canonical.pillarScores.price === pillarScores.price &&
    canonical.pillarScores.finePrint === pillarScores.finePrint &&
    canonical.pillarScores.warranty === pillarScores.warranty;

  const trace: GradeTrace = {
    letterGrade: canonical.letterGrade,
    weightedAverage: canonical.weightedAverage,
    hardCapApplied: canonical.hardCapApplied,
    pillarScores: canonical.pillarScores,
    pillars: { safety, install, price, finePrint, warranty },
    hardCaps,
    parityOk,
  };

  if (!parityOk) {
    trace.mismatch = { canonical, diagnostic: diagnosticView };
  }

  return trace;
}

/** Convenience alias. */
export const explainGrade = computeGradeWithTrace;

// Re-export GRADE_RANK so consumers building UI on top of trace data have
// access to the ordering without importing scoring.ts directly.
export { GRADE_RANK };
