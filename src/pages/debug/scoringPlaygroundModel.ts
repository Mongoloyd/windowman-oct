import {
  classifyScanGate,
  normalizeClassification,
  type ScanGateDecision,
} from "../../../supabase/functions/scan-quote/classificationGate.ts";
import {
  computeGrade,
  GRADE_RANK,
  letterGrade,
  PILLAR_WEIGHTS,
  RUBRIC_VERSION,
  type ExtractionResult,
  type GradeResult,
  type LineItem,
  type PillarScores,
} from "../../../supabase/functions/scan-quote/scoring.ts";
import {
  computeGradeWithTrace,
  type GradeTrace,
  type HardCapEvaluation,
} from "../../../supabase/functions/scan-quote/scoringDiagnostics.ts";
import {
  SCENARIO_FIXTURES,
  type ScenarioFixture,
} from "@/test/createMockQuote";

export type WeightKey = "safety" | "install" | "price" | "finePrint" | "warranty";
export type ExperimentalWeights = Record<WeightKey, number>;

export interface ExperimentResult {
  weightedAverage: number;
  uncappedGrade: string;
  finalGrade: string;
  appliedCaps: string[];
}

export type ExperimentState =
  | { kind: "ready"; result: ExperimentResult }
  | { kind: "invalid_weights"; weightSum: number }
  | { kind: "diagnostic_drift" }
  | { kind: "terminal" };

export type PlaygroundOutcome =
  | {
      kind: "terminal";
      gate: Exclude<ScanGateDecision, { action: "continue" }>;
      experiment: ExperimentState;
    }
  | {
      kind: "scored";
      canonical: GradeResult;
      trace: GradeTrace;
      experiment: ExperimentState;
    };

export interface ExportEnvelope {
  schema: "windowman.scoring-playground.v1";
  rubricVersion: string;
  fixture: ExtractionResult;
  experimentalWeights: ExperimentalWeights;
}

export const DEFAULT_EXPERIMENTAL_WEIGHTS: ExperimentalWeights = {
  safety: Math.round(PILLAR_WEIGHTS.safety * 100),
  install: Math.round(PILLAR_WEIGHTS.install * 100),
  price: Math.round(PILLAR_WEIGHTS.price * 100),
  finePrint: Math.round(PILLAR_WEIGHTS.finePrint * 100),
  warranty: Math.round(PILLAR_WEIGHTS.warranty * 100),
};

const QUICK_PRESET_KEYS = [
  "gradeA",
  "mixedPillars",
  "cornerCutting",
  "invalidDocument",
  "lowConfidence",
] as const;

export const QUICK_PRESETS: ScenarioFixture[] = QUICK_PRESET_KEYS.map((key) => {
  const fixture = SCENARIO_FIXTURES.find((candidate) => candidate.key === key);
  if (!fixture) throw new Error(`Missing canonical scoring fixture: ${key}`);
  return fixture;
});

const PROTECTED_ENVELOPE_KEYS = new Set([
  "full_json",
  "preview_json",
  "lead_id",
  "leadId",
  "session_id",
  "sessionId",
  "scan_session_id",
  "scanSessionId",
  "phone",
  "phone_e164",
  "email",
  "access_token",
  "refresh_token",
]);

const TOP_LEVEL_KEYS = new Set([
  "document_type",
  "is_window_door_related",
  "confidence",
  "page_count",
  "line_items",
  "warranty",
  "permits",
  "installation",
  "cancellation_policy",
  "total_quoted_price",
  "opening_count",
  "contractor_name",
  "hvhz_zone",
  "price_fairness",
  "markup_estimate",
  "negotiation_leverage",
  "subject_to_remeasure_present",
  "subject_to_remeasure_text",
  "deposit_percent",
  "deposit_amount",
  "final_payment_before_inspection",
  "payment_schedule_text",
  "terms_conditions_present",
  "wall_repair_scope",
  "stucco_repair_included",
  "drywall_repair_included",
  "paint_touchup_included",
  "debris_removal_included",
  "engineering_mentioned",
  "engineering_fees_included",
  "permit_fees_itemized",
  "insurance_proof_mentioned",
  "licensing_proof_mentioned",
  "completion_timeline_text",
  "lead_paint_disclosure_present",
  "generic_product_description_present",
  "opening_level_glass_specs_present",
  "blanket_glass_language_present",
  "mixed_glass_package_visibility",
  "opening_schedule_present",
  "opening_schedule_room_labels_present",
  "opening_schedule_dimensions_complete",
  "opening_schedule_product_assignments_present",
  "bulk_scope_blob_present",
  "change_order_policy_text",
  "written_change_order_required",
  "homeowner_approval_required_for_change_orders",
  "unilateral_price_adjustment_allowed",
  "substrate_condition_clause_present",
  "rot_unit_pricing_present",
  "buck_replacement_unit_pricing_present",
  "substrate_allowance_text",
  "remeasure_price_adjustment_cap_present",
  "anchoring_method_text",
  "anchor_spacing_specified",
  "fastener_type_specified",
  "waterproofing_method_text",
  "sealant_specified",
  "buck_treatment_method_text",
  "manufacturer_install_compliance_stated",
  "code_compliance_install_statement_present",
  "warranty_execution_details_present",
  "warranty_service_provider_type",
  "warranty_service_provider_name",
  "leak_callback_sla_days",
  "labor_service_sla_days",
  "callback_process_text",
  "post_install_stucco_excluded",
  "post_install_paint_excluded",
  "water_intrusion_damage_excluded",
  "contractor_address_text",
  "state_jurisdiction_mismatch",
]);

const LINE_ITEM_KEYS = new Set([
  "description",
  "quantity",
  "unit_price",
  "total_price",
  "brand",
  "series",
  "dp_rating",
  "noa_number",
  "dimensions",
  "glass_package_text",
  "glass_makeup_type",
  "glass_low_e_present",
  "glass_argon_present",
  "glass_tint_text",
  "glass_spec_complete",
  "opening_location",
  "opening_tag",
  "product_assignment_text",
]);

const WARRANTY_KEYS = new Set([
  "labor_years",
  "manufacturer_years",
  "transferable",
  "details",
]);
const PERMIT_KEYS = new Set(["included", "responsible_party", "details"]);
const INSTALLATION_KEYS = new Set([
  "scope_detail",
  "disposal_included",
  "accessories_mentioned",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isSafePrimitive(value: unknown): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function copyAllowedPrimitives(
  source: Record<string, unknown>,
  allowedKeys: Set<string>,
): Record<string, string | number | boolean | null> {
  const target: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(source)) {
    if (allowedKeys.has(key) && isSafePrimitive(value)) target[key] = value;
  }
  return target;
}

function sanitizeLineItem(value: unknown): LineItem | null {
  if (!isPlainObject(value) || typeof value.description !== "string") return null;
  return copyAllowedPrimitives(value, LINE_ITEM_KEYS) as unknown as LineItem;
}

export function cloneExtraction(extraction: ExtractionResult): ExtractionResult {
  return structuredClone(extraction);
}

export function getPresetExtraction(key: string): ExtractionResult {
  const fixture = QUICK_PRESETS.find((candidate) => candidate.key === key);
  if (!fixture) throw new Error(`Unknown quick preset: ${key}`);
  return cloneExtraction(fixture.extraction as ExtractionResult);
}

export function getWeightSum(weights: ExperimentalWeights): number {
  return Object.values(weights).reduce((sum, value) => sum + value, 0);
}

function applyExperimentCaps(
  initialGrade: string,
  hardCaps: HardCapEvaluation[],
): { grade: string; appliedCaps: string[] } {
  let grade = initialGrade;
  const appliedCaps: string[] = [];

  for (const cap of hardCaps) {
    const ceiling = cap.resultingMaxGrade;
    if (!cap.applied || !ceiling) continue;
    if ((GRADE_RANK[grade] ?? 0) > (GRADE_RANK[ceiling] ?? 0)) {
      grade = ceiling;
      appliedCaps.push(cap.cap);
    }
  }

  return { grade, appliedCaps };
}

export function calculateExperiment(
  pillarScores: PillarScores,
  hardCaps: HardCapEvaluation[],
  weights: ExperimentalWeights,
): ExperimentResult {
  const weightedPoints =
    pillarScores.safety * weights.safety +
    pillarScores.install * weights.install +
    pillarScores.price * weights.price +
    pillarScores.finePrint * weights.finePrint +
    pillarScores.warranty * weights.warranty;
  const weightedAverage = Math.round(weightedPoints) / 100;
  const uncappedGrade = letterGrade(weightedAverage);
  const capped = applyExperimentCaps(uncappedGrade, hardCaps);

  return {
    weightedAverage,
    uncappedGrade,
    finalGrade: capped.grade,
    appliedCaps: capped.appliedCaps,
  };
}

export function evaluatePlayground(
  extraction: ExtractionResult,
  weights: ExperimentalWeights,
): PlaygroundOutcome {
  const gate = classifyScanGate(normalizeClassification(extraction));
  if (gate.action === "terminate") {
    return { kind: "terminal", gate, experiment: { kind: "terminal" } };
  }

  const canonical = computeGrade(extraction);
  const trace = computeGradeWithTrace(extraction);
  const weightSum = getWeightSum(weights);

  let experiment: ExperimentState;
  if (!trace.parityOk) experiment = { kind: "diagnostic_drift" };
  else if (weightSum !== 100) experiment = { kind: "invalid_weights", weightSum };
  else {
    experiment = {
      kind: "ready",
      result: calculateExperiment(trace.pillarScores, trace.hardCaps, weights),
    };
  }

  return { kind: "scored", canonical, trace, experiment };
}

export function sanitizeImportedExtraction(raw: unknown): ExtractionResult {
  if (!isPlainObject(raw)) throw new Error("Paste a JSON object containing one extraction fixture.");

  const blockedKey = Object.keys(raw).find((key) => PROTECTED_ENVELOPE_KEYS.has(key));
  if (blockedKey) {
    throw new Error("Persisted report, identity, and session payloads are not accepted here.");
  }

  if (
    typeof raw.document_type !== "string" ||
    typeof raw.is_window_door_related !== "boolean" ||
    typeof raw.confidence !== "number" ||
    !Number.isFinite(raw.confidence) ||
    raw.confidence < 0 ||
    raw.confidence > 1 ||
    !Array.isArray(raw.line_items)
  ) {
    throw new Error(
      "Fixture requires document_type, is_window_door_related, confidence from 0 to 1, and line_items.",
    );
  }

  const lineItems = raw.line_items.map(sanitizeLineItem);
  if (lineItems.some((item) => item === null)) {
    throw new Error("Every line item requires a string description.");
  }

  const sanitized = copyAllowedPrimitives(raw, TOP_LEVEL_KEYS) as Record<string, unknown>;
  sanitized.line_items = lineItems as LineItem[];

  if (isPlainObject(raw.warranty)) {
    sanitized.warranty = copyAllowedPrimitives(raw.warranty, WARRANTY_KEYS);
  }
  if (isPlainObject(raw.permits)) {
    sanitized.permits = copyAllowedPrimitives(raw.permits, PERMIT_KEYS);
  }
  if (isPlainObject(raw.installation)) {
    sanitized.installation = copyAllowedPrimitives(raw.installation, INSTALLATION_KEYS);
  }

  return sanitized as unknown as ExtractionResult;
}

export function parseImportedExtraction(json: string): ExtractionResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("That is not valid JSON.");
  }
  return sanitizeImportedExtraction(parsed);
}

export function buildExportEnvelope(
  extraction: ExtractionResult,
  weights: ExperimentalWeights,
): ExportEnvelope {
  return {
    schema: "windowman.scoring-playground.v1",
    rubricVersion: RUBRIC_VERSION,
    fixture: sanitizeImportedExtraction(extraction),
    experimentalWeights: { ...weights },
  };
}
