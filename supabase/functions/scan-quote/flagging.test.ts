import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { detectFlags } from "./flagging.ts";
import { BASE_GOOD_QUOTE } from "./fixtures.ts";
import type { ExtractionResult } from "./scoring.ts";

function makeQuote(
  overrides: Partial<ExtractionResult> = {},
): ExtractionResult {
  const base = structuredClone(BASE_GOOD_QUOTE) as ExtractionResult;
  return {
    ...base,
    ...overrides,
    line_items: overrides.line_items ?? base.line_items,
    permits: overrides.permits ?? base.permits,
    installation: overrides.installation ?? base.installation,
    warranty: overrides.warranty ?? base.warranty,
  };
}

function hasFlag(flags: { flag: string }[], name: string): boolean {
  return flags.some((f) => f.flag === name);
}

// ── Area 1: Glass ─────────────────────────────────────────────────────────

Deno.test("Area 1: blanket_glass_no_per_opening_detail", () => {
  const flags = detectFlags(makeQuote({
    opening_level_glass_specs_present: false,
    blanket_glass_language_present: true,
  }));
  assert(hasFlag(flags, "blanket_glass_no_per_opening_detail"));
});

Deno.test("Area 1: glass_package_unverifiable", () => {
  const flags = detectFlags(makeQuote({
    opening_level_glass_specs_present: false,
    generic_product_description_present: true,
  }));
  assert(hasFlag(flags, "glass_package_unverifiable"));
});

Deno.test("Area 1: incomplete_glass_specs", () => {
  const items = structuredClone(BASE_GOOD_QUOTE.line_items);
  items[0] = { ...items[0], glass_spec_complete: false };
  const flags = detectFlags(makeQuote({ line_items: items }));
  assert(hasFlag(flags, "incomplete_glass_specs"));
});

Deno.test("Area 1: mixed_glass_visibility", () => {
  const flags = detectFlags(
    makeQuote({ mixed_glass_package_visibility: true }),
  );
  assert(hasFlag(flags, "mixed_glass_visibility"));
});

// ── Area 2: Opening Schedule ──────────────────────────────────────────────

Deno.test("Area 2: opening_schedule_missing", () => {
  const flags = detectFlags(makeQuote({ opening_schedule_present: false }));
  assert(hasFlag(flags, "opening_schedule_missing"));
});

Deno.test("Area 2: opening_product_assignments_missing", () => {
  const flags = detectFlags(makeQuote({
    opening_schedule_present: true,
    opening_schedule_product_assignments_present: false,
  }));
  assert(hasFlag(flags, "opening_product_assignments_missing"));
});

Deno.test("Area 2: bulk_scope_no_schedule", () => {
  const flags = detectFlags(makeQuote({
    bulk_scope_blob_present: true,
    opening_schedule_present: false,
  }));
  assert(hasFlag(flags, "bulk_scope_no_schedule"));
});

Deno.test("Area 2: opening_dimensions_incomplete", () => {
  const flags = detectFlags(makeQuote({
    opening_schedule_present: true,
    opening_schedule_dimensions_complete: false,
  }));
  assert(hasFlag(flags, "opening_dimensions_incomplete"));
});

// ── Area 3: Change-order / Substrate ──────────────────────────────────────

Deno.test("Area 3: unilateral_price_adjustment", () => {
  const flags = detectFlags(
    makeQuote({ unilateral_price_adjustment_allowed: true }),
  );
  assert(hasFlag(flags, "unilateral_price_adjustment"));
});

Deno.test("Area 3: substrate_clause_no_change_order", () => {
  const flags = detectFlags(makeQuote({
    substrate_condition_clause_present: true,
    written_change_order_required: false,
  }));
  assert(hasFlag(flags, "substrate_clause_no_change_order"));
});

Deno.test("Area 3: no_homeowner_approval_for_changes", () => {
  const flags = detectFlags(makeQuote({
    homeowner_approval_required_for_change_orders: false,
  }));
  assert(hasFlag(flags, "no_homeowner_approval_for_changes"));
});

Deno.test("Area 3: substrate_open_checkbook", () => {
  const flags = detectFlags(makeQuote({
    substrate_condition_clause_present: true,
    rot_unit_pricing_present: false,
    buck_replacement_unit_pricing_present: false,
  }));
  assert(hasFlag(flags, "substrate_open_checkbook"));
});

Deno.test("Area 3: remeasure_no_price_cap", () => {
  const flags = detectFlags(makeQuote({
    subject_to_remeasure_present: true,
    remeasure_price_adjustment_cap_present: false,
  }));
  assert(hasFlag(flags, "remeasure_no_price_cap"));
});

// ── Area 4: Install Method ────────────────────────────────────────────────

Deno.test("Area 4: anchoring_method_missing", () => {
  const flags = detectFlags(makeQuote({ anchoring_method_text: null }));
  assert(hasFlag(flags, "anchoring_method_missing"));
});

Deno.test("Area 4: waterproofing_method_missing", () => {
  const flags = detectFlags(makeQuote({ waterproofing_method_text: null }));
  assert(hasFlag(flags, "waterproofing_method_missing"));
});

Deno.test("Area 4: anchor_spacing_unspecified", () => {
  const flags = detectFlags(makeQuote({ anchor_spacing_specified: false }));
  assert(hasFlag(flags, "anchor_spacing_unspecified"));
});

Deno.test("Area 4: install_compliance_unverified", () => {
  const flags = detectFlags(makeQuote({
    manufacturer_install_compliance_stated: false,
    code_compliance_install_statement_present: false,
  }));
  assert(hasFlag(flags, "install_compliance_unverified"));
});

// ── Area 5: Warranty Execution ────────────────────────────────────────────

Deno.test("Area 5: warranty_execution_missing", () => {
  const flags = detectFlags(
    makeQuote({ warranty_execution_details_present: false }),
  );
  assert(hasFlag(flags, "warranty_execution_missing"));
});

Deno.test("Area 5: warranty_service_provider_unspecified", () => {
  const flags = detectFlags(
    makeQuote({ warranty_service_provider_type: "unknown" }),
  );
  assert(hasFlag(flags, "warranty_service_provider_unspecified"));
});

Deno.test("Area 5: leak_callback_sla_missing", () => {
  const flags = detectFlags(makeQuote({ leak_callback_sla_days: null }));
  assert(hasFlag(flags, "leak_callback_sla_missing"));
});

Deno.test("Area 5: callback_process_missing", () => {
  const flags = detectFlags(makeQuote({ callback_process_text: null }));
  assert(hasFlag(flags, "callback_process_missing"));
});

Deno.test("Area 5: finish_exclusions_present", () => {
  const flags = detectFlags(makeQuote({ post_install_stucco_excluded: true }));
  assert(hasFlag(flags, "finish_exclusions_present"));
});

Deno.test("Area 5: water_intrusion_excluded", () => {
  const flags = detectFlags(
    makeQuote({ water_intrusion_damage_excluded: true }),
  );
  assert(hasFlag(flags, "water_intrusion_excluded"));
});

// ── Negative Controls ─────────────────────────────────────────────────────

const AREA_1_5_FLAGS = [
  "blanket_glass_no_per_opening_detail",
  "glass_package_unverifiable",
  "incomplete_glass_specs",
  "mixed_glass_visibility",
  "opening_schedule_missing",
  "opening_product_assignments_missing",
  "bulk_scope_no_schedule",
  "opening_dimensions_incomplete",
  "unilateral_price_adjustment",
  "substrate_clause_no_change_order",
  "no_homeowner_approval_for_changes",
  "substrate_open_checkbook",
  "remeasure_no_price_cap",
  "anchoring_method_missing",
  "waterproofing_method_missing",
  "anchor_spacing_unspecified",
  "install_compliance_unverified",
  "warranty_execution_missing",
  "warranty_service_provider_unspecified",
  "leak_callback_sla_missing",
  "callback_process_missing",
  "finish_exclusions_present",
  "water_intrusion_excluded",
];

Deno.test("Negative: clean baseline emits no Area 1-5 flags", () => {
  const flags = detectFlags(makeQuote());
  for (const name of AREA_1_5_FLAGS) {
    assertEquals(hasFlag(flags, name), false, `Unexpected flag: ${name}`);
  }
});

Deno.test("Negative: good schedule does not emit schedule flags", () => {
  const flags = detectFlags(makeQuote({
    opening_schedule_present: true,
    opening_schedule_product_assignments_present: true,
  }));
  assertEquals(hasFlag(flags, "opening_schedule_missing"), false);
  assertEquals(hasFlag(flags, "opening_product_assignments_missing"), false);
});

Deno.test("Negative: good change-order controls do not emit change-order flags", () => {
  const flags = detectFlags(makeQuote({
    substrate_condition_clause_present: true,
    written_change_order_required: true,
    homeowner_approval_required_for_change_orders: true,
    remeasure_price_adjustment_cap_present: true,
  }));
  assertEquals(hasFlag(flags, "unilateral_price_adjustment"), false);
  assertEquals(hasFlag(flags, "substrate_clause_no_change_order"), false);
  assertEquals(hasFlag(flags, "no_homeowner_approval_for_changes"), false);
  assertEquals(hasFlag(flags, "remeasure_no_price_cap"), false);
});

Deno.test("Negative: good warranty execution does not emit warranty flags", () => {
  const flags = detectFlags(makeQuote({
    warranty_execution_details_present: true,
    warranty_service_provider_type: "contractor",
    leak_callback_sla_days: 7,
    callback_process_text: "Call office for dispatch",
  }));
  assertEquals(hasFlag(flags, "warranty_execution_missing"), false);
  assertEquals(hasFlag(flags, "warranty_service_provider_unspecified"), false);
  assertEquals(hasFlag(flags, "leak_callback_sla_missing"), false);
  assertEquals(hasFlag(flags, "callback_process_missing"), false);
});
