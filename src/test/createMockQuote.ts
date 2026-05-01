import sampleQuoteUrl from "./sample-quote.png";

let cachedBlob: Blob | null = null;

async function getSampleQuoteBlob(): Promise<Blob> {
  if (cachedBlob) return cachedBlob;
  const res = await fetch(sampleQuoteUrl);
  cachedBlob = await res.blob();
  return cachedBlob;
}

// ══════════════════════════════════════════════════════════════════════════════
// ExtractionResult — mirrors supabase/functions/scan-quote/scoring.ts v1.6.0
// Keep in sync whenever scoring.ts ExtractionResult changes.
// ══════════════════════════════════════════════════════════════════════════════

export interface LineItem {
  description: string;
  quantity?: number;
  unit_price?: number;
  total_price?: number;
  brand?: string;
  series?: string;
  dp_rating?: string;
  noa_number?: string;
  dimensions?: string;
  // ── Glass package fields ──────────────────────────────────────────────────
  glass_package_text?: string | null;
  glass_makeup_type?:
    | "monolithic_laminated"
    | "insulated_laminated"
    | "laminated"
    | "insulated"
    | "tempered"
    | "unknown"
    | null;
  glass_low_e_present?: boolean | null;
  glass_argon_present?: boolean | null;
  glass_tint_text?: string | null;
  glass_spec_complete?: boolean | null;
  // ── Opening scope fields ──────────────────────────────────────────────────
  opening_location?: string | null;
  opening_tag?: string | null;
  product_assignment_text?: string | null;
}

export interface ExtractionResult {
  document_type: string;
  is_window_door_related: boolean;
  confidence: number;
  page_count?: number;
  line_items: LineItem[];
  warranty?: {
    labor_years?: number;
    manufacturer_years?: number;
    transferable?: boolean;
    details?: string;
  };
  permits?: {
    included?: boolean;
    responsible_party?: string;
    details?: string;
  };
  installation?: {
    scope_detail?: string;
    disposal_included?: boolean;
    accessories_mentioned?: boolean;
  };
  cancellation_policy?: string;
  total_quoted_price?: number;
  opening_count?: number;
  contractor_name?: string;
  hvhz_zone?: boolean;
  price_fairness?: string;
  markup_estimate?: string;
  negotiation_leverage?: string;
  // ── Payment-trap fields ───────────────────────────────────────────────────
  subject_to_remeasure_present?: boolean;
  subject_to_remeasure_text?: string;
  deposit_percent?: number;
  deposit_amount?: number;
  final_payment_before_inspection?: boolean;
  payment_schedule_text?: string;
  // ── Fine-print / terms fields ─────────────────────────────────────────────
  terms_conditions_present?: boolean;
  // ── Scope-gap fields ──────────────────────────────────────────────────────
  wall_repair_scope?: string;
  stucco_repair_included?: boolean;
  drywall_repair_included?: boolean;
  paint_touchup_included?: boolean;
  debris_removal_included?: boolean;
  engineering_mentioned?: boolean;
  engineering_fees_included?: boolean;
  permit_fees_itemized?: boolean;
  // ── Trust-signal fields ───────────────────────────────────────────────────
  insurance_proof_mentioned?: boolean;
  licensing_proof_mentioned?: boolean;
  completion_timeline_text?: string;
  lead_paint_disclosure_present?: boolean;
  // ── Product-quality fields ────────────────────────────────────────────────
  generic_product_description_present?: boolean;
  // ── Glass package fields ──────────────────────────────────────────────────
  opening_level_glass_specs_present?: boolean | null;
  blanket_glass_language_present?: boolean | null;
  mixed_glass_package_visibility?: boolean | null;
  // ── Opening scope fields ──────────────────────────────────────────────────
  opening_schedule_present?: boolean | null;
  opening_schedule_room_labels_present?: boolean | null;
  opening_schedule_dimensions_complete?: boolean | null;
  opening_schedule_product_assignments_present?: boolean | null;
  bulk_scope_blob_present?: boolean | null;
  // ── Change-order / substrate fields ──────────────────────────────────────
  change_order_policy_text?: string | null;
  written_change_order_required?: boolean | null;
  homeowner_approval_required_for_change_orders?: boolean | null;
  unilateral_price_adjustment_allowed?: boolean | null;
  substrate_condition_clause_present?: boolean | null;
  rot_unit_pricing_present?: boolean | null;
  buck_replacement_unit_pricing_present?: boolean | null;
  substrate_allowance_text?: string | null;
  remeasure_price_adjustment_cap_present?: boolean | null;
  // ── Installation method / anchoring fields ────────────────────────────────
  anchoring_method_text?: string | null;
  anchor_spacing_specified?: boolean | null;
  fastener_type_specified?: boolean | null;
  waterproofing_method_text?: string | null;
  sealant_specified?: boolean | null;
  buck_treatment_method_text?: string | null;
  manufacturer_install_compliance_stated?: boolean | null;
  code_compliance_install_statement_present?: boolean | null;
  // ── Warranty execution fields ─────────────────────────────────────────────
  warranty_execution_details_present?: boolean | null;
  warranty_service_provider_type?: "contractor" | "manufacturer" | "third_party" | "unknown" | null;
  warranty_service_provider_name?: string | null;
  leak_callback_sla_days?: number | null;
  labor_service_sla_days?: number | null;
  callback_process_text?: string | null;
  post_install_stucco_excluded?: boolean | null;
  post_install_paint_excluded?: boolean | null;
  water_intrusion_damage_excluded?: boolean | null;
  contractor_address_text?: string;
  state_jurisdiction_mismatch?: boolean;
}

// ══════════════════════════════════════════════════════════════════════════════
// Scenario builders
// ══════════════════════════════════════════════════════════════════════════════

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const BASE_PASSING_LINE_ITEM: LineItem = {
  description: "PGT WinGuard Impact Single Hung Window",
  quantity: 1,
  unit_price: 1850,
  total_price: 1850,
  brand: "PGT",
  series: "WinGuard",
  dp_rating: "DP50",
  noa_number: "NOA 17-0501.06",
  dimensions: "36x60",
  opening_location: "Living Room",
  opening_tag: "W1",
  product_assignment_text: "PGT WinGuard SH 36x60",
  glass_package_text: "Insulated laminated Low-E Argon",
  glass_makeup_type: "insulated_laminated",
  glass_low_e_present: true,
  glass_argon_present: true,
  glass_tint_text: "clear",
  glass_spec_complete: true,
};

export const BASE_PASSING_EXTRACTION: ExtractionResult = {
  document_type: "impact_window_quote",
  is_window_door_related: true,
  confidence: 0.95,
  page_count: 3,
  contractor_name: "Elite Impact Windows LLC",
  opening_count: 4,
  total_quoted_price: 18400,
  hvhz_zone: true,
  cancellation_policy: "Full refund within 3 business days of signing. 15% restocking fee after materials ordered.",
  opening_level_glass_specs_present: true,
  blanket_glass_language_present: false,
  mixed_glass_package_visibility: false,
  opening_schedule_present: true,
  opening_schedule_room_labels_present: true,
  opening_schedule_dimensions_complete: true,
  opening_schedule_product_assignments_present: true,
  bulk_scope_blob_present: false,
  terms_conditions_present: true,
  written_change_order_required: true,
  homeowner_approval_required_for_change_orders: true,
  unilateral_price_adjustment_allowed: false,
  substrate_condition_clause_present: false,
  rot_unit_pricing_present: true,
  buck_replacement_unit_pricing_present: true,
  subject_to_remeasure_present: false,
  final_payment_before_inspection: false,
  remeasure_price_adjustment_cap_present: true,
  payment_schedule_text: "30% deposit, 40% on material delivery, 30% on completion",
  deposit_percent: 30,
  generic_product_description_present: false,
  anchoring_method_text: "Tapcon concrete anchors per manufacturer spec",
  anchor_spacing_specified: true,
  fastener_type_specified: true,
  waterproofing_method_text: "Sealant and flashing tape per FBC",
  sealant_specified: true,
  buck_treatment_method_text: "Pressure-treated 2x4 buck with moisture barrier",
  manufacturer_install_compliance_stated: true,
  code_compliance_install_statement_present: true,
  warranty_execution_details_present: true,
  warranty_service_provider_type: "contractor",
  warranty_service_provider_name: "Elite Impact Windows LLC",
  leak_callback_sla_days: 5,
  labor_service_sla_days: 5,
  callback_process_text: "Call office within 48 hours — technician dispatched within 5 business days",
  post_install_stucco_excluded: false,
  post_install_paint_excluded: false,
  water_intrusion_damage_excluded: false,
  wall_repair_scope: "Stucco patch and interior trim replacement included",
  stucco_repair_included: true,
  drywall_repair_included: true,
  paint_touchup_included: true,
  debris_removal_included: true,
  engineering_mentioned: true,
  engineering_fees_included: true,
  permit_fees_itemized: true,
  insurance_proof_mentioned: true,
  licensing_proof_mentioned: true,
  completion_timeline_text: "6-8 weeks from permit approval",
  lead_paint_disclosure_present: true,
  line_items: [
    BASE_PASSING_LINE_ITEM,
    {
      ...BASE_PASSING_LINE_ITEM,
      description: "PGT WinGuard Impact Horizontal Roller",
      opening_location: "Master Bedroom",
      opening_tag: "W2",
      product_assignment_text: "PGT WinGuard HR 72x48",
      dimensions: "72x48",
      quantity: 1,
      unit_price: 2200,
      total_price: 2200,
    },
    {
      ...BASE_PASSING_LINE_ITEM,
      description: "CGI Sentinel Impact Sliding Glass Door",
      brand: "CGI",
      series: "Sentinel",
      noa_number: "NOA 18-0312.02",
      opening_location: "Back Patio",
      opening_tag: "D1",
      product_assignment_text: "CGI Sentinel SGD 96x80",
      dimensions: "96x80",
      quantity: 1,
      unit_price: 4500,
      total_price: 4500,
    },
  ],
  warranty: {
    labor_years: 5,
    manufacturer_years: 25,
    transferable: true,
    details: "Manufacturer: limited lifetime on glass seal. Labor: 5-year full coverage including callbacks.",
  },
  permits: {
    included: true,
    responsible_party: "contractor",
    details: "All building permits and final inspection included in quoted price.",
  },
  installation: {
    scope_detail:
      "Full removal of existing windows, installation of new impact units, stucco patching, interior/exterior caulking, foam insulation, and final cleanup.",
    disposal_included: true,
    accessories_mentioned: true,
  },
};

export function deepMerge<T>(base: T, override: DeepPartial<T> = {}): T {
  const result = structuredClone(base) as T;

  const mergeInto = (target: unknown, source: unknown) => {
    if (!isObject(target) || !isObject(source)) return;

    for (const [key, value] of Object.entries(source)) {
      // Guard against prototype pollution
      if (key === "__proto__" || key === "prototype" || key === "constructor") {
        continue;
      }

      // Allow explicit undefined to delete/clear base fields
      if (value === undefined) {
        delete (target as Record<string, unknown>)[key];
        continue;
      }

      if (Array.isArray(value)) {
        (target as Record<string, unknown>)[key] = structuredClone(value);
      } else if (isObject(value)) {
        const existing = (target as Record<string, unknown>)[key];
        if (!isObject(existing)) {
          (target as Record<string, unknown>)[key] = {};
        }
        mergeInto((target as Record<string, unknown>)[key], value);
      } else {
        (target as Record<string, unknown>)[key] = value;
      }
    }
  };

  mergeInto(result, override);
  return result;
}

export function makeExtraction(
  overrides: DeepPartial<ExtractionResult> = {},
  lineItemOverrides?: Array<DeepPartial<LineItem>>,
): ExtractionResult {
  const extraction = deepMerge(BASE_PASSING_EXTRACTION, overrides);

  if (lineItemOverrides) {
    extraction.line_items = lineItemOverrides.map((itemOverride) => deepMerge(BASE_PASSING_LINE_ITEM, itemOverride));
  }

  return extraction;
}

export interface ScenarioFixture {
  key: string;
  label: string;
  description: string;
  extraction: ExtractionResult;
  expectedGrade: string | null; // null = terminal state (invalid_document, needs_better_upload)
  expectedTerminal?: "invalid_document" | "needs_better_upload";
}

function makeScenario(
  key: ScenarioFixture["key"],
  label: ScenarioFixture["label"],
  description: ScenarioFixture["description"],
  expectedGrade: ScenarioFixture["expectedGrade"],
  extractionOverrides: DeepPartial<ExtractionResult> = {},
  lineItemOverrides?: Array<DeepPartial<LineItem>>,
  expectedTerminal?: ScenarioFixture["expectedTerminal"],
): ScenarioFixture {
  return {
    key,
    label,
    description,
    expectedGrade,
    expectedTerminal,
    extraction: makeExtraction(extractionOverrides, lineItemOverrides),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO FIXTURES — deterministic extraction payloads
// Calibrated against scoring.ts RUBRIC_VERSION = "1.6.0"
// Thresholds: A≥88, B≥70, C≥52, D≥37, else F
// ══════════════════════════════════════════════════════════════════════════════

export const SCENARIO_FIXTURES: ScenarioFixture[] = [
  makeScenario("gradeA", "Grade A", "Complete quote: all specs, warranty, permits, install scope — all v1.6.0 fields satisfied", "A"),

  // Intentional B-level failures: missing NOA numbers, no cancellation policy, no disposal.
  makeScenario(
    "gradeB",
    "Grade B",
    "Good quote — missing NOA numbers, no cancellation policy, no disposal",
    "B",
    {
      confidence: 0.88,
      page_count: 2,
      contractor_name: "Sunshine Windows Inc",
      opening_count: 3,
      total_quoted_price: 12600,
      cancellation_policy: undefined,
      warranty: {
        labor_years: 2,
        manufacturer_years: 20,
        transferable: true,
        details: "Written manufacturer and labor warranty provided at installation.",
      },
      installation: {
        scope_detail: "Remove and replace all specified openings. Caulk and seal.",
        accessories_mentioned: true,
        disposal_included: false, // Explicitly false to trigger disposal deduction
      },
      callback_process_text: "Call our service line — technician dispatched within 7 business days",
      leak_callback_sla_days: 7,
      labor_service_sla_days: 5,
      wall_repair_scope: "Caulk and sealant around all openings",
      completion_timeline_text: "8-10 weeks from permit approval",
    },
    [
      {
        description: "PGT WinGuard Impact Single Hung Window",
        quantity: 2,
        unit_price: 1700,
        total_price: 3400,
        noa_number: undefined,
      },
      {
        description: "Impact Sliding Glass Door - hurricane rated",
        brand: "CGI",
        series: "Sentinel",
        dimensions: "72x80",
        opening_location: "Back Patio",
        opening_tag: "D1",
        product_assignment_text: "CGI Sentinel SGD 72x80",
        quantity: 1,
        unit_price: 4200,
        total_price: 4200,
        noa_number: undefined,
      },
    ],
  ),

  // Intentional C-level trigger: opening_count >= 5 + missing opening schedule.
  makeScenario(
    "gradeC",
    "Grade C",
    "Multiple missing specs, vague install scope — ambiguous_opening_scope hard cap fires",
    "C",
    {
      confidence: 0.78,
      page_count: 1,
      contractor_name: "Budget Windows FL",
      opening_count: 5,
      total_quoted_price: 8500,
      cancellation_policy: undefined,
      opening_schedule_present: undefined,
      opening_schedule_room_labels_present: undefined,
      opening_schedule_dimensions_complete: undefined,
      opening_schedule_product_assignments_present: undefined,
      anchoring_method_text: "Standard anchors per spec",
      waterproofing_method_text: "Caulk and foam",
      warranty: {
        manufacturer_years: 10,
        details: "See manufacturer documentation.",
      },
      installation: { scope_detail: "Install windows per specification" },
      warranty_service_provider_type: "manufacturer",
      warranty_service_provider_name: undefined,
      leak_callback_sla_days: 14,
      callback_process_text: "Contact manufacturer for warranty service",
    },
    [
      {
        // Keep DP/NOA so safety doesn't crater below 40 (which would trip the
        // critical_safety D-cap and mask the intended ambiguous_opening_scope C-cap).
        description: "Impact single hung window",
        quantity: 3,
        unit_price: 950,
        total_price: 2850,
        dp_rating: "DP40",
        noa_number: "NOA 17-0501.06",
        glass_makeup_type: "laminated",
        glass_argon_present: false,
      },
      {
        description: "Impact horizontal roller",
        quantity: 2,
        unit_price: 1100,
        total_price: 2200,
        brand: undefined,
        series: undefined,
        dp_rating: undefined,
        noa_number: undefined,
        dimensions: "60x36",
        glass_makeup_type: "laminated",
        glass_argon_present: false,
      },
    ],
  ),

  // No changes needed from original — kept intentionally hand-crafted.
  {
    key: "gradeD",
    label: "Grade D",
    description: "No NOA, no DP, no permits, short descriptions, sparse warranty — critical_safety D-cap",
    expectedGrade: "F",
    extraction: {
      document_type: "impact_window_quote",
      is_window_door_related: true,
      confidence: 0.72,
      page_count: 1,
      contractor_name: "J&R Windows",
      total_quoted_price: 6000,
      line_items: [
        { description: "Window", quantity: 4, unit_price: 750, total_price: 3000 },
        { description: "Slider", quantity: 1, unit_price: 1500, total_price: 1500 },
      ],
      warranty: { details: "1 year labor" },
    },
  },

  // Zero line items → zero_line_items hard cap → F.
  makeScenario(
    "gradeF",
    "Grade F",
    "Zero line items — triggers hard cap to F",
    "F",
    {
      confidence: 0.65,
      page_count: 1,
      contractor_name: "Unknown Contractor",
      total_quoted_price: 15000,
    },
    [],
  ),

  makeScenario(
    "mixedPillars",
    "Mixed Pillars",
    "A-grade safety (all DP/NOA) but weak warranty and sparse install — expected B",
    "B",
    {
      confidence: 0.9,
      page_count: 2,
      contractor_name: "ProTech Windows",
      opening_count: 3,
      total_quoted_price: 14000,
      cancellation_policy: "No refunds after 48 hours.",
      warranty: {
        details: "Contact manufacturer for warranty terms.",
        labor_years: 1,
        manufacturer_years: 10,
        transferable: false,
      },
      callback_process_text: "Call office for warranty service",
      leak_callback_sla_days: 7,
      labor_service_sla_days: 7,
      // Degrade install pillar to match "sparse install" description
      anchoring_method_text: undefined,
      waterproofing_method_text: undefined,
      buck_treatment_method_text: undefined,
      sealant_specified: undefined,
      opening_schedule_present: undefined,
      opening_schedule_room_labels_present: undefined,
      opening_schedule_dimensions_complete: undefined,
      opening_schedule_product_assignments_present: undefined,
      installation: {
        scope_detail: "Install windows per specification",
        disposal_included: false,
        accessories_mentioned: false,
      },
    },
    [
      {
        description: "PGT WinGuard Impact Single Hung",
        quantity: 2,
        unit_price: 1800,
        total_price: 3600,
      },
      {
        description: "CGI Sentinel Impact Slider - hurricane",
        brand: "CGI",
        series: "Sentinel",
        noa_number: "NOA 18-0312.02",
        dimensions: "72x80",
        opening_location: "Back Patio",
        opening_tag: "D1",
        product_assignment_text: "CGI Sentinel SGD 72x80",
        quantity: 1,
        unit_price: 4500,
        total_price: 4500,
      },
    ],
  ),

  // ── The Inspection Trap ───────────────────────────────────────────────────
  // Forensic Audit Case: Premium-looking quote with predatory payment terms.
  // This scenario isolates legal/payment risk while keeping specs strong.
  makeScenario(
    "inspectionTrap",
    "The Inspection Trap",
    "Excellent specs and branding, but predatory legal terms require final payment before inspection and allow uncapped remeasure-based price increases.",
    "D",
    {
      confidence: 0.98,
      final_payment_before_inspection: true,
      payment_schedule_text:
        "50% deposit at signing. Remaining balance due upon installation completion and before municipal final inspection approval.",
      unilateral_price_adjustment_allowed: true,
      subject_to_remeasure_present: true,
      subject_to_remeasure_text:
        "Final contract price is subject to change after field remeasure at contractor discretion.",
      remeasure_price_adjustment_cap_present: false,
      change_order_policy_text:
        "Contractor may revise price based on site conditions, measurements, and material variances without a stated cap.",
      written_change_order_required: false,
      homeowner_approval_required_for_change_orders: false,
    },
  ),

  // v1.6.0 caps "impact-labeled + spec-less" quotes at D, not F.
  // F is reserved for zero_line_items or !hasImpactMention + completelyMissingSpecs.
  // Descriptions here say "Impact" so hasImpactMention=true; safety craters → critical_safety D-cap.
  {
    key: "cornerCutting",
    label: "Corner-Cutting",
    description: "$150/unit, no brand/series, no DP — critical_safety D-cap from missing specs",
    expectedGrade: "D",
    extraction: {
      document_type: "impact_window_quote",
      is_window_door_related: true,
      confidence: 0.7,
      page_count: 1,
      contractor_name: "Discount Fenestration",
      total_quoted_price: 3000,
      line_items: [
        { description: "Impact window", quantity: 5, unit_price: 150, total_price: 750 },
        { description: "Impact slider", quantity: 2, unit_price: 150, total_price: 300 },
      ],
    },
  },

  makeScenario(
    "overpaymentTrap",
    "Overpayment Trap",
    "Premium pricing, one item missing NOA, no cancellation — expected B",
    "B",
    {
      confidence: 0.92,
      page_count: 2,
      contractor_name: "Premium Impact Solutions",
      opening_count: 5,
      total_quoted_price: 22000,
      cancellation_policy: undefined,
      // Add narrow gaps so the inherited base doesn't keep this in A-territory.
      terms_conditions_present: false,
      completion_timeline_text: undefined,
      payment_schedule_text: "33% deposit, 33% delivery, 34% completion",
      deposit_percent: 33,
      callback_process_text: "Call our warranty line for all service requests",
      leak_callback_sla_days: 7,
      labor_service_sla_days: 5,
      warranty: {
        labor_years: 10,
        manufacturer_years: 25,
        transferable: true,
        details: "Full lifetime manufacturer warranty. 10-year labor coverage.",
      },
      permits: { included: true, responsible_party: "contractor", details: "Permits and inspection included." },
      installation: {
        scope_detail: "Full removal, install, caulk, foam, stucco patch, trim, cleanup.",
        disposal_included: true,
        accessories_mentioned: true,
      },
    },
    [
      {
        description: "PGT WinGuard Impact Single Hung - Hurricane rated",
        quantity: 4,
        unit_price: 2200,
        total_price: 8800,
        opening_location: "Various Bedrooms",
        opening_tag: "W1-W4",
      },
      {
        description: "PGT WinGuard Impact Sliding Door - Hurricane rated",
        dimensions: "72x80",
        opening_location: "Back Patio",
        opening_tag: "D1",
        product_assignment_text: "PGT WinGuard SGD 72x80",
        quantity: 1,
        unit_price: 5200,
        total_price: 5200,
        noa_number: undefined,
      },
    ],
  ),

  // Kept hand-crafted to preserve intentionally sparse scope language.
  {
    key: "vagueScope",
    label: "Vague Scope",
    description: "Descriptions <10 chars, no brand, no install detail — unverified_impact_specs D-cap",
    expectedGrade: "F",
    extraction: {
      document_type: "impact_window_quote",
      is_window_door_related: true,
      confidence: 0.68,
      page_count: 1,
      contractor_name: "Quick Fix LLC",
      total_quoted_price: 7500,
      line_items: [
        { description: "Window", quantity: 3, unit_price: 800, total_price: 2400 },
        { description: "Door", quantity: 1, unit_price: 2000, total_price: 2000 },
        { description: "Screen", quantity: 2, unit_price: 300, total_price: 600 },
      ],
    },
  },

  makeScenario(
    "missingWarranty",
    "Missing Warranty",
    "Decent specs but no warranty section — no_warranty_section C-cap fires",
    "C",
    {
      confidence: 0.82,
      page_count: 2,
      contractor_name: "SunShield Windows",
      opening_count: 3,
      total_quoted_price: 11000,
      warranty: undefined,
    },
    [
      {
        description: "PGT WinGuard Impact Single Hung - hurricane",
        quantity: 2,
        unit_price: 1600,
        total_price: 3200,
      },
      {
        description: "Impact Sliding Glass Door - storm rated",
        brand: "CGI",
        series: "Sentinel",
        dp_rating: "DP45",
        noa_number: "NOA 18-0312.02",
        dimensions: "72x80",
        opening_location: "Back Patio",
        opening_tag: "D1",
        product_assignment_text: "CGI Sentinel SGD 72x80",
        quantity: 1,
        unit_price: 3800,
        total_price: 3800,
      },
    ],
  ),

  makeScenario(
    "finePrintTrap",
    "Fine Print Trap",
    "No cancellation, unbranded items — finePrint pillar failures drive grade to C",
    "C",
    {
      confidence: 0.75,
      page_count: 1,
      contractor_name: "AllStar Construction",
      total_quoted_price: 9000,
      cancellation_policy: undefined,
      // Trigger the substrate_open_checkbook C-cap deterministically — matches the
      // "fine print trap" narrative without changing the rubric.
      terms_conditions_present: false,
      substrate_condition_clause_present: true,
      rot_unit_pricing_present: undefined,
      buck_replacement_unit_pricing_present: undefined,
      permits: { included: true, responsible_party: "homeowner" },
      installation: {
        scope_detail: "Standard installation per manufacturer specs.",
        disposal_included: false,
      },
      warranty: { labor_years: 1, manufacturer_years: 10 },
      warranty_service_provider_name: undefined,
      warranty_service_provider_type: "contractor",
      leak_callback_sla_days: 14,
      callback_process_text: "Call office for warranty service",
    },
    [
      {
        description: "Impact rated window unit",
        quantity: 3,
        unit_price: 1200,
        total_price: 3600,
        brand: undefined,
        series: undefined,
        glass_makeup_type: "laminated",
        glass_argon_present: false,
      },
      {
        description: "Impact rated slider",
        quantity: 1,
        unit_price: 2500,
        total_price: 2500,
        brand: undefined,
        series: undefined,
        glass_makeup_type: "laminated",
        glass_argon_present: false,
      },
    ],
  ),

  makeScenario(
    "insuranceSensitive",
    "Insurance-Sensitive",
    "No HVHZ, no NOA numbers — ambiguous_opening_scope C-cap from 6 openings + no schedule",
    "C",
    {
      confidence: 0.8,
      page_count: 2,
      contractor_name: "Coastal Guard Windows",
      opening_count: 6,
      total_quoted_price: 16000,
      hvhz_zone: undefined,
      cancellation_policy: "50% deposit non-refundable.",
      opening_schedule_present: undefined,
      opening_schedule_room_labels_present: undefined,
      opening_schedule_dimensions_complete: undefined,
      opening_schedule_product_assignments_present: undefined,
      warranty: {
        labor_years: 3,
        manufacturer_years: 15,
        transferable: false,
        details: "Limited manufacturer warranty.",
      },
      leak_callback_sla_days: 14,
      callback_process_text: "Contact us for warranty service",
      permits: { included: true, responsible_party: "contractor", details: "Permit fees included." },
      installation: {
        scope_detail: "Full removal and replacement. Caulk and seal. Disposal of old windows.",
        disposal_included: true,
        accessories_mentioned: true,
      },
    },
    [
      {
        description: "Impact single hung window - hurricane protection",
        quantity: 4,
        unit_price: 1400,
        total_price: 5600,
        brand: "ECO",
        series: "StormMax",
        dp_rating: "DP40",
        noa_number: undefined,
        glass_makeup_type: "laminated",
        glass_argon_present: false,
      },
      {
        description: "Impact sliding glass door - hurricane protection",
        quantity: 2,
        unit_price: 3200,
        total_price: 6400,
        brand: "ECO",
        series: "StormMax",
        dp_rating: "DP40",
        noa_number: undefined,
        glass_makeup_type: "laminated",
        glass_argon_present: false,
      },
    ],
  ),

  {
    key: "invalidDocument",
    label: "Invalid Document",
    description: "Not a window/door quote — triggers invalid_document gate",
    expectedGrade: null,
    expectedTerminal: "invalid_document",
    extraction: {
      document_type: "general_contractor_estimate",
      is_window_door_related: false,
      confidence: 0.9,
      line_items: [
        {
          description: "Kitchen remodel - cabinets and countertops",
          quantity: 1,
          unit_price: 15000,
          total_price: 15000,
        },
      ],
    },
  },

  // Kept hand-crafted to preserve exact non-impact fatal flaw semantics.
  {
    key: "lipstickOnAPig_NonImpact",
    label: "Lipstick on a Pig",
    description: "Perfect quote but non-impact standard glass — unverified_impact_specs D-cap fires",
    expectedGrade: "D",
    extraction: {
      document_type: "impact_window_quote",
      is_window_door_related: true,
      confidence: 0.95,
      total_quoted_price: 24500,
      contractor_name: "Premium Illusions LLC",
      line_items: [
        {
          description: "PGT WinGuard Single Hung - Standard Annealed Glass",
          quantity: 12,
          unit_price: 1800,
          total_price: 21600,
          brand: "PGT",
          series: "WinGuard",
        },
      ],
      warranty: {
        labor_years: 10,
        manufacturer_years: 25,
        details: "Full lifetime manufacturer warranty.",
      },
      permits: { included: true, responsible_party: "contractor" },
      installation: { scope_detail: "Full removal and install", disposal_included: true },
    },
  },

  {
    key: "lowConfidence",
    label: "Low Confidence",
    description: "Confidence 0.2 — triggers needs_better_upload gate",
    expectedGrade: null,
    expectedTerminal: "needs_better_upload",
    extraction: {
      document_type: "impact_window_quote",
      is_window_door_related: true,
      confidence: 0.2,
      line_items: [{ description: "Blurry text - possibly window", quantity: 1 }],
    },
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// Legacy mock quote creator (still used for storage upload testing)
// ══════════════════════════════════════════════════════════════════════════════

export function createMockQuote(overrides: Record<string, unknown> = {}) {
  const id = globalThis.crypto.randomUUID();

  const baseData = {
    contractor_name: `Test Contractor ${id.slice(0, 4)}`,
    price_per_window: Math.floor(Math.random() * 400) + 300,
    warranty_length: Math.random() > 0.5 ? "Lifetime" : "10 years",
    missing_specs: [] as string[],
    address: "123 Test Lane",
    city: "Pompano Beach",
    state: "FL",
    zip: "33062",
    ...overrides,
  };

  const fallbackBytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49,
    0x44, 0x41, 0x54, 0x78, 0x9c, 0x62, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0xe5, 0x27, 0xde, 0xfc, 0x00, 0x00, 0x00,
    0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
  const file = new File([fallbackBytes], `mock-quote-${id.slice(0, 8)}.png`, { type: "image/png" });

  return {
    id,
    file,
    extracted: baseData,
    getFile: async (): Promise<File> => {
      const blob = await getSampleQuoteBlob();
      return new File([blob], `sample-quote-${id.slice(0, 8)}.png`, { type: "image/png" });
    },
  };
}
