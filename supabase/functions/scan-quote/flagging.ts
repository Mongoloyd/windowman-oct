import type { ExtractionResult } from "./scoring.ts";

export interface Flag {
  flag: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  pillar: string;
  detail: string;
}

export function detectFlags(data: ExtractionResult): Flag[] {
  const flags: Flag[] = [];
  const items = data.line_items;

  // Safety flags
  const noDp = items.filter((i) => !i.dp_rating);
  if (noDp.length > 0) {
    flags.push({
      flag: "missing_dp_rating",
      severity: "High",
      pillar: "safety",
      detail: `${noDp.length} item(s) missing DP rating`,
    });
  }
  const noNoa = items.filter((i) => !i.noa_number);
  if (noNoa.length > 0) {
    flags.push({
      flag: "missing_noa_number",
      severity: "Medium",
      pillar: "safety",
      detail: `${noNoa.length} item(s) missing NOA number`,
    });
  }

  // Install flags
  if (!data.permits || data.permits.included === undefined) {
    flags.push({
      flag: "no_permits_mentioned",
      severity: "High",
      pillar: "install",
      detail: "No permit responsibility stated",
    });
  }
  if (!data.installation?.scope_detail) {
    flags.push({
      flag: "vague_install_scope",
      severity: "Medium",
      pillar: "install",
      detail: "Installation scope is vague or missing",
    });
  }

  // Price flags
  const noPrice = items.filter((i) =>
    i.unit_price === undefined && i.total_price === undefined
  );
  if (noPrice.length > 0) {
    flags.push({
      flag: "missing_line_item_pricing",
      severity: "High",
      pillar: "price",
      detail: `${noPrice.length} item(s) missing pricing`,
    });
  }

  // Fine print flags
  if (!data.cancellation_policy) {
    flags.push({
      flag: "no_cancellation_policy",
      severity: "Medium",
      pillar: "finePrint",
      detail: "No cancellation policy found",
    });
  }
  const unbranded = items.filter((i) => !i.brand && !i.series);
  if (unbranded.length > 0) {
    flags.push({
      flag: "unspecified_brand",
      severity: "Medium",
      pillar: "finePrint",
      detail: `${unbranded.length} item(s) with unspecified brand/series`,
    });
  }

  // Warranty flags
  if (!data.warranty) {
    flags.push({
      flag: "no_warranty_section",
      severity: "High",
      pillar: "warranty",
      detail: "No warranty information found",
    });
  }

  // ── Payment-trap flags ───────────────────────────────────────────────────
  if (data.subject_to_remeasure_present) {
    flags.push({
      flag: "subject_to_remeasure_clause",
      severity: "Critical",
      pillar: "finePrint",
      detail:
        "Quote includes subject-to-remeasure language that may allow price increases after signing",
    });
  }
  if (typeof data.deposit_percent === "number" && data.deposit_percent > 40) {
    flags.push({
      flag: "deposit_over_40_percent",
      severity: data.deposit_percent > 50 ? "Critical" : "High",
      pillar: "price",
      detail: `Deposit requirement is ${data.deposit_percent}% upfront`,
    });
  }
  if (data.final_payment_before_inspection === true) {
    flags.push({
      flag: "payment_before_inspection",
      severity: "High",
      pillar: "finePrint",
      detail: "Final payment appears due before inspection or final approval",
    });
  }
  if (data.terms_conditions_present === false) {
    flags.push({
      flag: "terms_conditions_missing",
      severity: "Medium",
      pillar: "finePrint",
      detail: "No terms and conditions section was found",
    });
  }

  // ── Scope-gap flags ──────────────────────────────────────────────────────
  if (!data.wall_repair_scope) {
    flags.push({
      flag: "wall_repair_scope_missing",
      severity: "Medium",
      pillar: "install",
      detail: "Wall repair scope is missing or unclear",
    });
  }
  if (data.debris_removal_included !== true) {
    flags.push({
      flag: "debris_removal_missing",
      severity: "Medium",
      pillar: "install",
      detail: "Debris removal/disposal is not clearly included",
    });
  }
  if (data.engineering_mentioned === false) {
    flags.push({
      flag: "engineering_not_mentioned",
      severity: "Medium",
      pillar: "install",
      detail: "No engineering scope or engineering fees were identified",
    });
  }
  if (data.permit_fees_itemized === false) {
    flags.push({
      flag: "permit_fees_unclear",
      severity: "Medium",
      pillar: "install",
      detail:
        "Permit responsibility may be mentioned, but permit fees are not itemized clearly",
    });
  }

  // ── Trust-signal flags ───────────────────────────────────────────────────
  if (
    data.insurance_proof_mentioned !== true ||
    data.licensing_proof_mentioned !== true
  ) {
    flags.push({
      flag: "insurance_licensing_not_shown",
      severity: "Medium",
      pillar: "finePrint",
      detail:
        "Proof of insurance and licensing was not clearly shown in the quote",
    });
  }
  if (!data.completion_timeline_text) {
    flags.push({
      flag: "completion_timeline_missing",
      severity: "Medium",
      pillar: "install",
      detail: "No project completion timeline was identified",
    });
  }
  if (data.generic_product_description_present === true) {
    flags.push({
      flag: "generic_product_description",
      severity: "High",
      pillar: "finePrint",
      detail:
        "Product description is too generic to verify the exact impact-rated model",
    });
  }
  if (data.state_jurisdiction_mismatch === true) {
    flags.push({
      flag: "state_jurisdiction_mismatch",
      severity: "High",
      pillar: "safety",
      detail:
        "Contractor address/jurisdiction appears inconsistent with the Florida project context",
    });
  }

  // ── Area 1: Glass-package ambiguity flags ────────────────────────────────
  if (
    data.opening_level_glass_specs_present === false &&
    data.blanket_glass_language_present === true
  ) {
    flags.push({
      flag: "blanket_glass_no_per_opening_detail",
      severity: "High",
      pillar: "safety",
      detail:
        "Quote uses blanket glass language without per-opening glass specifications",
    });
  }
  if (
    data.generic_product_description_present === true &&
    data.opening_level_glass_specs_present !== true
  ) {
    flags.push({
      flag: "glass_package_unverifiable",
      severity: "High",
      pillar: "safety",
      detail:
        "Generic product description with no opening-level glass details makes glass package unverifiable",
    });
  }
  const itemsWithIncompleteGlass = items.filter((i) =>
    i.glass_spec_complete === false
  );
  if (itemsWithIncompleteGlass.length > 0) {
    flags.push({
      flag: "incomplete_glass_specs",
      severity: "Medium",
      pillar: "safety",
      detail:
        `${itemsWithIncompleteGlass.length} opening(s) have incomplete glass specifications`,
    });
  }
  if (data.mixed_glass_package_visibility === true) {
    flags.push({
      flag: "mixed_glass_visibility",
      severity: "Medium",
      pillar: "safety",
      detail:
        "Some openings have glass specs while others do not — inconsistent visibility",
    });
  }

  // ── Area 2: Opening-schedule ambiguity flags ─────────────────────────────
  if (data.opening_schedule_present === false) {
    flags.push({
      flag: "opening_schedule_missing",
      severity: "High",
      pillar: "install",
      detail: "No opening-by-opening schedule found in the quote",
    });
  }
  if (
    data.opening_schedule_present === true &&
    data.opening_schedule_product_assignments_present === false
  ) {
    flags.push({
      flag: "opening_product_assignments_missing",
      severity: "Medium",
      pillar: "install",
      detail:
        "Opening schedule exists but does not assign specific products to each opening",
    });
  }
  if (
    data.bulk_scope_blob_present === true &&
    data.opening_schedule_present !== true
  ) {
    flags.push({
      flag: "bulk_scope_no_schedule",
      severity: "High",
      pillar: "install",
      detail:
        "Scope is described in bulk without an opening-by-opening breakdown",
    });
  }
  if (
    data.opening_schedule_present === true &&
    data.opening_schedule_dimensions_complete === false
  ) {
    flags.push({
      flag: "opening_dimensions_incomplete",
      severity: "Medium",
      pillar: "install",
      detail:
        "Opening schedule exists but dimensions are incomplete for some openings",
    });
  }

  // ── Area 3: Fine-print / change-order flags ──────────────────────────────
  if (data.unilateral_price_adjustment_allowed === true) {
    flags.push({
      flag: "unilateral_price_adjustment",
      severity: "Critical",
      pillar: "finePrint",
      detail:
        "Contract allows the contractor to adjust price unilaterally without homeowner approval",
    });
  }
  if (
    data.substrate_condition_clause_present === true &&
    data.written_change_order_required !== true
  ) {
    flags.push({
      flag: "substrate_clause_no_change_order",
      severity: "High",
      pillar: "finePrint",
      detail:
        "Substrate condition clause exists but no written change-order process is required",
    });
  }
  if (data.homeowner_approval_required_for_change_orders === false) {
    flags.push({
      flag: "no_homeowner_approval_for_changes",
      severity: "High",
      pillar: "finePrint",
      detail: "Change orders do not require explicit homeowner approval",
    });
  }
  if (
    data.substrate_condition_clause_present === true &&
    data.rot_unit_pricing_present !== true &&
    data.buck_replacement_unit_pricing_present !== true
  ) {
    flags.push({
      flag: "substrate_open_checkbook",
      severity: "High",
      pillar: "price",
      detail:
        "Substrate condition clause without unit pricing creates open-ended cost exposure",
    });
  }
  if (
    data.remeasure_price_adjustment_cap_present === false &&
    data.subject_to_remeasure_present === true
  ) {
    flags.push({
      flag: "remeasure_no_price_cap",
      severity: "High",
      pillar: "finePrint",
      detail: "Remeasure clause has no stated cap on price adjustments",
    });
  }

  // ── Area 4: Install method flags ─────────────────────────────────────────
  if (!data.anchoring_method_text) {
    flags.push({
      flag: "anchoring_method_missing",
      severity: "High",
      pillar: "install",
      detail: "No anchoring method specified for window/door installation",
    });
  }
  if (!data.waterproofing_method_text) {
    flags.push({
      flag: "waterproofing_method_missing",
      severity: "High",
      pillar: "install",
      detail: "No waterproofing or sealant method specified",
    });
  }
  if (data.anchor_spacing_specified !== true) {
    flags.push({
      flag: "anchor_spacing_unspecified",
      severity: "Medium",
      pillar: "install",
      detail: "Anchor/fastener spacing is not specified",
    });
  }
  if (
    data.manufacturer_install_compliance_stated !== true &&
    data.code_compliance_install_statement_present !== true
  ) {
    flags.push({
      flag: "install_compliance_unverified",
      severity: "Medium",
      pillar: "install",
      detail:
        "No statement of manufacturer install compliance or local code compliance",
    });
  }

  // ── Area 5: Warranty execution flags ─────────────────────────────────────
  if (data.warranty && data.warranty_execution_details_present !== true) {
    flags.push({
      flag: "warranty_execution_missing",
      severity: "Medium",
      pillar: "warranty",
      detail:
        "Warranty exists but execution details (who services, how to file) are missing",
    });
  }
  if (
    data.warranty &&
    (!data.warranty_service_provider_type ||
      data.warranty_service_provider_type === "unknown")
  ) {
    flags.push({
      flag: "warranty_service_provider_unspecified",
      severity: "Medium",
      pillar: "warranty",
      detail: "Warranty service provider type is not specified",
    });
  }
  if (data.warranty && data.leak_callback_sla_days == null) {
    flags.push({
      flag: "leak_callback_sla_missing",
      severity: "High",
      pillar: "warranty",
      detail: "No leak callback SLA timeline specified in warranty",
    });
  }
  if (data.warranty && !data.callback_process_text) {
    flags.push({
      flag: "callback_process_missing",
      severity: "Medium",
      pillar: "warranty",
      detail: "Warranty callback process is not described",
    });
  }
  if (
    data.post_install_stucco_excluded === true ||
    data.post_install_paint_excluded === true
  ) {
    flags.push({
      flag: "finish_exclusions_present",
      severity: "Low",
      pillar: "warranty",
      detail:
        "Warranty excludes post-install stucco and/or paint touch-up damage",
    });
  }
  if (data.water_intrusion_damage_excluded === true) {
    flags.push({
      flag: "water_intrusion_excluded",
      severity: "High",
      pillar: "warranty",
      detail:
        "Warranty excludes water intrusion damage — a critical coverage gap",
    });
  }

  return flags;
}
