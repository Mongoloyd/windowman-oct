import type { ExtractionResult, GradeResult } from "./scoring.ts";

export interface CompiledReportOutput {
  warnings: string[];
  missing_items: string[];
  summary: string;
  top_warning: string | null;
  top_missing_item: string | null;
  price_per_opening: number | null;
  price_per_opening_band: "low" | "market" | "high" | "extreme" | null;
  summary_teaser: string | null;
  payment_risk_detected: boolean;
  scope_gap_detected: boolean;
}

type FlagLike = {
  flag?: string;
  severity?: string;
  pillar?: string;
  detail?: string;
};

function hasFlag(
  flags: FlagLike[] | null | undefined,
  flagName: string,
): boolean {
  return Array.isArray(flags) && flags.some((f) => f?.flag === flagName);
}

function resolvePricePerOpening(
  derivedMetrics: Record<string, unknown> | null | undefined,
): number | null {
  const perOpening =
    (derivedMetrics?.per_opening as Record<string, unknown> | undefined)
      ?.installed_price_per_opening;
  return typeof perOpening === "number" && Number.isFinite(perOpening)
    ? perOpening
    : null;
}

function resolvePricePerOpeningBand(
  derivedMetrics: Record<string, unknown> | null | undefined,
): "low" | "market" | "high" | "extreme" | null {
  const value = resolvePricePerOpening(derivedMetrics);
  if (value === null) return null;
  if (value < 800) return "low";
  if (value <= 1500) return "market";
  if (value <= 2000) return "high";
  return "extreme";
}

export function buildWarnings(
  extraction: ExtractionResult,
  flags: FlagLike[] | null | undefined,
): string[] {
  const warnings: string[] = [];

  if (extraction?.subject_to_remeasure_present === true) {
    warnings.push(
      'RED FLAG: "Subject to remeasure" language may allow the contractor to raise the price after signing.',
    );
  }

  if (
    typeof extraction?.deposit_percent === "number" &&
    Number.isFinite(extraction.deposit_percent) &&
    extraction.deposit_percent > 40
  ) {
    warnings.push(
      `High risk: Deposit requirement is unusually high at ${extraction.deposit_percent}%.`,
    );
  }

  if (extraction?.final_payment_before_inspection === true) {
    warnings.push(
      "High risk: Final payment appears due before inspection or final sign-off.",
    );
  }

  if (
    hasFlag(flags, "missing_noa_number") || hasFlag(flags, "missing_dp_rating")
  ) {
    warnings.push(
      "RED FLAG: No proof of impact compliance was found (missing NOA/FL approval numbers or DP ratings).",
    );
  }

  if (extraction?.state_jurisdiction_mismatch === true) {
    warnings.push(
      "High risk: Contractor address or jurisdiction appears inconsistent with the Florida project context.",
    );
  }

  if (extraction?.generic_product_description_present === true) {
    warnings.push(
      "High risk: Product description is too generic to verify the exact impact-rated product being sold.",
    );
  }

  if (extraction?.terms_conditions_present === false) {
    warnings.push(
      "Caution: No terms and conditions section was found in the quote.",
    );
  }

  if (!extraction?.cancellation_policy) {
    warnings.push(
      "Caution: No cancellation policy or right-to-cancel language was found.",
    );
  }

  // ── Area 1-5 Forensic Warnings ──────────────────────────────────────────
  if (hasFlag(flags, "unilateral_price_adjustment")) {
    warnings.push(
      "🚨 CRITICAL: Quote gives the contractor unilateral power to raise pricing after you sign.",
    );
  }
  if (hasFlag(flags, "no_homeowner_approval_for_changes")) {
    warnings.push(
      "🚨 CRITICAL: Extra charges may not require your explicit approval before work proceeds.",
    );
  }
  if (hasFlag(flags, "water_intrusion_excluded")) {
    warnings.push(
      "🚨 CRITICAL: Water intrusion damage appears excluded from warranty coverage.",
    );
  }

  if (hasFlag(flags, "blanket_glass_no_per_opening_detail")) {
    warnings.push(
      "RED FLAG: Quote describes impact glass in general terms, but does not show which opening gets which glass package.",
    );
  }
  if (hasFlag(flags, "glass_package_unverifiable")) {
    warnings.push(
      "RED FLAG: The glass package cannot be verified opening by opening, which increases downgrade risk.",
    );
  }
  if (hasFlag(flags, "opening_schedule_missing")) {
    warnings.push(
      "RED FLAG: No room-by-room opening schedule was found in the quote.",
    );
  }
  if (hasFlag(flags, "opening_product_assignments_missing")) {
    warnings.push(
      "RED FLAG: The quote does not clearly assign a specific product to each opening.",
    );
  }
  if (hasFlag(flags, "bulk_scope_no_schedule")) {
    warnings.push(
      "RED FLAG: Scope is described in bulk rather than opening by opening, which creates ambiguity about what is actually included.",
    );
  }
  if (hasFlag(flags, "substrate_clause_no_change_order")) {
    warnings.push(
      "RED FLAG: Hidden rot or substrate work may be billed without a clear written change-order process.",
    );
  }
  if (hasFlag(flags, "substrate_open_checkbook")) {
    warnings.push(
      "RED FLAG: Rot, buck, or substrate costs appear open-ended because no clear unit pricing was found.",
    );
  }
  if (hasFlag(flags, "remeasure_no_price_cap")) {
    warnings.push(
      "RED FLAG: The remeasure clause does not show a clear cap on possible price increases.",
    );
  }
  if (hasFlag(flags, "anchoring_method_missing")) {
    warnings.push("RED FLAG: Anchoring method is not specified.");
  }
  if (hasFlag(flags, "waterproofing_method_missing")) {
    warnings.push(
      "RED FLAG: Waterproofing or sealant method is not specified, increasing water-intrusion risk.",
    );
  }
  if (hasFlag(flags, "warranty_execution_missing")) {
    warnings.push(
      "RED FLAG: Warranty exists, but the service process is not clearly explained.",
    );
  }
  if (hasFlag(flags, "leak_callback_sla_missing")) {
    warnings.push("RED FLAG: No leak callback response timeline was found.");
  }

  if (hasFlag(flags, "incomplete_glass_specs")) {
    warnings.push(
      "Caution: Some openings are missing complete glass details such as Low-E, Argon, or glass makeup.",
    );
  }
  if (hasFlag(flags, "mixed_glass_visibility")) {
    warnings.push(
      "Caution: Glass specifications appear inconsistent across openings, making apples-to-apples review harder.",
    );
  }
  if (hasFlag(flags, "opening_dimensions_incomplete")) {
    warnings.push(
      "Caution: Some opening dimensions appear incomplete or missing from the schedule.",
    );
  }
  if (hasFlag(flags, "anchor_spacing_unspecified")) {
    warnings.push("Caution: Anchor or fastener spacing is not specified.");
  }
  if (hasFlag(flags, "install_compliance_unverified")) {
    warnings.push(
      "Caution: The quote does not clearly state manufacturer-install or code-compliance methods.",
    );
  }
  if (hasFlag(flags, "warranty_service_provider_unspecified")) {
    warnings.push(
      "Caution: The quote does not clearly say who will actually perform warranty service.",
    );
  }
  if (hasFlag(flags, "callback_process_missing")) {
    warnings.push(
      "Caution: The process for requesting warranty service is not clearly described.",
    );
  }
  if (hasFlag(flags, "finish_exclusions_present")) {
    warnings.push(
      "Caution: The warranty appears to exclude some finish repairs such as stucco or paint touch-up.",
    );
  }

  return warnings;
}

export function buildMissingItems(
  extraction: ExtractionResult,
  flags: FlagLike[] | null | undefined,
): string[] {
  const missing: string[] = [];

  if (hasFlag(flags, "missing_noa_number")) {
    missing.push("NOA/FL product approval numbers for all windows and doors");
  }

  if (hasFlag(flags, "missing_dp_rating")) {
    missing.push("Design Pressure (DP) ratings for all windows and doors");
  }

  if (
    !Array.isArray(extraction?.line_items) ||
    extraction.line_items.some((item) => !item?.brand && !item?.series)
  ) {
    missing.push("Specific manufacturer, product line, and series");
  }

  if (!extraction?.wall_repair_scope) {
    missing.push("Detailed wall repair scope (stucco / drywall / paint)");
  }

  if (extraction?.debris_removal_included !== true) {
    missing.push("Debris removal and disposal clearly listed");
  }

  if (extraction?.permit_fees_itemized !== true) {
    missing.push("Permit responsibility and permit fees itemized");
  }

  if (extraction?.engineering_mentioned !== true) {
    missing.push("Engineering scope or engineering fees");
  }

  if (!extraction?.warranty) {
    missing.push("Warranty details for labor and materials");
  }

  if (!extraction?.payment_schedule_text) {
    missing.push("Payment schedule and deposit requirements");
  }

  if (!extraction?.cancellation_policy) {
    missing.push("Cancellation policy / right-to-cancel language");
  }

  if (extraction?.terms_conditions_present !== true) {
    missing.push("Terms and conditions section");
  }

  if (
    extraction?.insurance_proof_mentioned !== true ||
    extraction?.licensing_proof_mentioned !== true
  ) {
    missing.push("Proof of insurance and licensing");
  }

  if (!extraction?.completion_timeline_text) {
    missing.push("Project completion timeline");
  }

  // ── Area 1-5 Missing Items ──────────────────────────────────────────────
  if (hasFlag(flags, "blanket_glass_no_per_opening_detail")) {
    missing.push("Opening-by-opening glass package schedule");
  }
  if (hasFlag(flags, "glass_package_unverifiable")) {
    missing.push(
      "Per-opening glass package details (Low-E, Argon, makeup type, tint)",
    );
  }
  if (hasFlag(flags, "incomplete_glass_specs")) {
    missing.push("Complete glass specifications for every opening");
  }
  if (hasFlag(flags, "opening_schedule_missing")) {
    missing.push("Room-by-room opening schedule");
  }
  if (hasFlag(flags, "opening_product_assignments_missing")) {
    missing.push("Product assignment for each opening");
  }
  if (hasFlag(flags, "bulk_scope_no_schedule")) {
    missing.push("Opening-by-opening breakdown instead of bulk scope language");
  }
  if (hasFlag(flags, "opening_dimensions_incomplete")) {
    missing.push("Complete opening dimensions for each scheduled opening");
  }
  if (hasFlag(flags, "substrate_clause_no_change_order")) {
    missing.push("Written change-order requirement before extra charges");
  }
  if (hasFlag(flags, "no_homeowner_approval_for_changes")) {
    missing.push(
      "Explicit homeowner approval requirement before additional work or charges",
    );
  }
  if (hasFlag(flags, "substrate_open_checkbook")) {
    missing.push(
      "Unit pricing for rot, buck replacement, or substrate repairs",
    );
  }
  if (hasFlag(flags, "remeasure_no_price_cap")) {
    missing.push("Clear cap or formula for any remeasure-based price change");
  }
  if (hasFlag(flags, "anchoring_method_missing")) {
    missing.push("Anchoring method details");
  }
  if (hasFlag(flags, "waterproofing_method_missing")) {
    missing.push("Waterproofing and sealant method details");
  }
  if (hasFlag(flags, "anchor_spacing_unspecified")) {
    missing.push("Anchor / fastener spacing details");
  }
  if (hasFlag(flags, "install_compliance_unverified")) {
    missing.push("Statement of manufacturer-install or code-compliance method");
  }
  if (hasFlag(flags, "warranty_execution_missing")) {
    missing.push(
      "Warranty execution details (who services it, how claims work, and expected response)",
    );
  }
  if (hasFlag(flags, "warranty_service_provider_unspecified")) {
    missing.push("Named warranty service provider");
  }
  if (hasFlag(flags, "leak_callback_sla_missing")) {
    missing.push("Leak callback response timeline");
  }
  if (hasFlag(flags, "callback_process_missing")) {
    missing.push("Warranty callback / service request process");
  }
  if (hasFlag(flags, "water_intrusion_excluded")) {
    missing.push(
      "Clear written statement confirming whether water intrusion damage is covered",
    );
  }

  return missing;
}

export function buildSummary(
  gradeResult: GradeResult,
  warnings: string[],
  missingItems: string[],
  priceBand: "low" | "market" | "high" | "extreme" | null,
): string {
  if (warnings.length >= 3) {
    return "This quote shows multiple high-risk issues, including contract traps and missing technical proof that should be resolved before signing.";
  }

  if (priceBand === "extreme") {
    return "This quote appears materially overpriced for the visible scope and should be renegotiated before you move forward.";
  }

  if (missingItems.length >= 6) {
    return "This quote is missing several key scope, compliance, and contract details that should be added before you consider signing.";
  }

  return `This Grade ${
    gradeResult?.letterGrade ?? "?"
  } quote needs clarification in several areas before it can be considered safe to sign.`;
}

export function compileReportOutput(
  extraction: ExtractionResult,
  gradeResult: GradeResult,
  flags: FlagLike[] | null | undefined,
  derivedMetrics: Record<string, unknown> | null | undefined,
): CompiledReportOutput {
  const warnings = buildWarnings(extraction, flags);
  const missing_items = buildMissingItems(extraction, flags);
  const price_per_opening = resolvePricePerOpening(derivedMetrics);
  const price_per_opening_band = resolvePricePerOpeningBand(derivedMetrics);
  const summary = buildSummary(
    gradeResult,
    warnings,
    missing_items,
    price_per_opening_band,
  );

  return {
    warnings,
    missing_items,
    summary,
    top_warning: warnings.length > 0 ? warnings[0] : null,
    top_missing_item: missing_items.length > 0 ? missing_items[0] : null,
    price_per_opening,
    price_per_opening_band,
    summary_teaser: warnings.length > 0 ? warnings[0] : summary,
    payment_risk_detected: extraction?.subject_to_remeasure_present === true ||
      extraction?.final_payment_before_inspection === true ||
      (typeof extraction?.deposit_percent === "number" &&
        Number.isFinite(extraction.deposit_percent) &&
        extraction.deposit_percent > 40),
    scope_gap_detected: !extraction?.wall_repair_scope ||
      extraction?.debris_removal_included !== true ||
      extraction?.engineering_mentioned !== true,
  };
}
