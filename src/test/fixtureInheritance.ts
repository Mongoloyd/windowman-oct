/**
 * Fixture inheritance diagnostics — browser-safe pure analyzer.
 *
 * Diffs each scenario's merged extraction against BASE_PASSING_EXTRACTION /
 * BASE_PASSING_LINE_ITEM to recover overridden vs. silently inherited fields,
 * and flags inherited fields that materially affect the rubric.
 *
 * No Node APIs. No I/O. Safe to import from Vite/browser bundles AND from
 * Bun-run scripts.
 */

import {
  BASE_PASSING_EXTRACTION,
  BASE_PASSING_LINE_ITEM,
  type ExtractionResult,
  type LineItem,
  SCENARIO_FIXTURES,
} from "./createMockQuote";

export const RISKY_INHERITED_FIELDS: readonly string[] = [
  // Safety
  "hvhz_zone",
  "opening_level_glass_specs_present",
  "manufacturer_install_compliance_stated",
  "code_compliance_install_statement_present",
  // Install / scope
  "opening_schedule_present",
  "opening_schedule_product_assignments_present",
  "opening_schedule_room_labels_present",
  "opening_schedule_dimensions_complete",
  "anchoring_method_text",
  "waterproofing_method_text",
  "buck_treatment_method_text",
  "sealant_specified",
  "anchor_spacing_specified",
  "fastener_type_specified",
  "wall_repair_scope",
  "stucco_repair_included",
  "drywall_repair_included",
  "paint_touchup_included",
  "debris_removal_included",
  "permit_fees_itemized",
  "engineering_mentioned",
  "engineering_fees_included",
  // Price / payment
  "payment_schedule_text",
  "deposit_percent",
  "subject_to_remeasure_present",
  "final_payment_before_inspection",
  "remeasure_price_adjustment_cap_present",
  // Fine print
  "cancellation_policy",
  "terms_conditions_present",
  "completion_timeline_text",
  "insurance_proof_mentioned",
  "licensing_proof_mentioned",
  "lead_paint_disclosure_present",
  "written_change_order_required",
  "homeowner_approval_required_for_change_orders",
  "unilateral_price_adjustment_allowed",
  "substrate_condition_clause_present",
  "rot_unit_pricing_present",
  "buck_replacement_unit_pricing_present",
  // Warranty
  "warranty",
  "warranty_execution_details_present",
  "warranty_service_provider_type",
  "warranty_service_provider_name",
  "leak_callback_sla_days",
  "labor_service_sla_days",
  "callback_process_text",
];

export const RISKY_INHERITED_LINE_ITEM_FIELDS: readonly string[] = [
  "dp_rating",
  "noa_number",
  "brand",
  "series",
  "glass_makeup_type",
  "glass_low_e_present",
  "glass_argon_present",
  "glass_spec_complete",
  "glass_package_text",
  "unit_price",
  "total_price",
  "opening_location",
  "opening_tag",
  "product_assignment_text",
];

export interface InheritanceReport {
  key: string;
  label: string;
  expectedGrade: string | null;
  overridden: string[];
  inherited: string[];
  riskyInherited: string[];
  lineItemReports: Array<{
    index: number;
    description: string;
    overridden: string[];
    inherited: string[];
    riskyInherited: string[];
  }>;
}

function shallowDiff<T extends Record<string, unknown>>(
  base: T,
  merged: T,
): { overridden: string[]; inherited: string[] } {
  const overridden: string[] = [];
  const inherited: string[] = [];
  const allKeys = new Set([...Object.keys(base), ...Object.keys(merged)]);

  for (const k of allKeys) {
    const inBase = Object.prototype.hasOwnProperty.call(base, k);
    const inMerged = Object.prototype.hasOwnProperty.call(merged, k);

    if (!inBase && inMerged) {
      overridden.push(k);
      continue;
    }
    if (inBase && !inMerged) {
      overridden.push(`${k} (cleared)`);
      continue;
    }

    const a = JSON.stringify((base as any)[k]);
    const b = JSON.stringify((merged as any)[k]);
    if (a === b) inherited.push(k);
    else overridden.push(k);
  }

  return { overridden: overridden.sort(), inherited: inherited.sort() };
}

function analyzeLineItem(
  item: LineItem,
  index: number,
): InheritanceReport["lineItemReports"][number] {
  const { overridden, inherited } = shallowDiff(
    BASE_PASSING_LINE_ITEM as unknown as Record<string, unknown>,
    item as unknown as Record<string, unknown>,
  );
  const riskyInherited = inherited.filter((f) =>
    RISKY_INHERITED_LINE_ITEM_FIELDS.includes(f),
  );
  return {
    index,
    description: item.description ?? "(no description)",
    overridden,
    inherited,
    riskyInherited,
  };
}

export function analyzeFixtureInheritance(fx: {
  key: string;
  label: string;
  expectedGrade: string | null;
  extraction: ExtractionResult;
}): InheritanceReport {
  const { overridden, inherited } = shallowDiff(
    BASE_PASSING_EXTRACTION as unknown as Record<string, unknown>,
    fx.extraction as unknown as Record<string, unknown>,
  );
  const riskyInherited = inherited.filter((f) =>
    RISKY_INHERITED_FIELDS.includes(f),
  );

  const lineItemReports = (fx.extraction.line_items ?? []).map((item, i) =>
    analyzeLineItem(item, i),
  );

  return {
    key: fx.key,
    label: fx.label,
    expectedGrade: fx.expectedGrade,
    overridden,
    inherited,
    riskyInherited,
    lineItemReports,
  };
}

export function buildAllInheritanceReports(): InheritanceReport[] {
  return (SCENARIO_FIXTURES as any[])
    .filter((f) => f.extraction)
    .map((f) => analyzeFixtureInheritance(f));
}
