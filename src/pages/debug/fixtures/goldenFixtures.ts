import type {
  ExtractionResult,
  PillarScores,
} from "../../../../supabase/functions/scan-quote/scoring.ts";
import { SCENARIO_FIXTURES } from "@/test/createMockQuote";

export interface GoldenFixtureProvenance {
  sourceFixtureKey: string;
  capturedRubricVersion: string;
  capturedAtCommit: string;
  inputFingerprint: `fnv1a32:${string}`;
}

export interface GoldenScoredExpectation {
  kind: "scored";
  baselineGrade: string;
  weightedScore: number;
  triggeredHardCaps: readonly string[];
  hardCapApplied: string | null;
  pillarBreakdown: PillarScores;
}

export interface GoldenTerminalExpectation {
  kind: "terminal";
  terminalOutcome: "invalid_document" | "needs_better_upload";
}

export type GoldenExpectedResult =
  | GoldenScoredExpectation
  | GoldenTerminalExpectation;

export type GoldenFixtureCategory =
  | "control"
  | "terminal"
  | "evidence"
  | "contract"
  | "boundary";

export interface GoldenFixture {
  id: string;
  label: string;
  description: string;
  category: GoldenFixtureCategory;
  provenance: GoldenFixtureProvenance;
  extraction: ExtractionResult;
  expected_results: GoldenExpectedResult;
}

const CAPTURED_AT_COMMIT = "aafaf960c67690688faffef0cef1d39660649dd5";
const EXPANSION_CAPTURED_AT_COMMIT = "0b4fe5a97b5203c19da5b66ae37e7fc8f7d57e83";
const CAPTURED_RUBRIC_VERSION = "1.6.0";

function stableSerialize(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function fingerprintExtraction(
  extraction: ExtractionResult,
): `fnv1a32:${string}` {
  let hash = 0x811c9dc5;
  for (const character of stableSerialize(extraction)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a32:${hash.toString(16).padStart(8, "0")}`;
}

function cloneScenarioExtraction(key: string): ExtractionResult {
  const fixture = SCENARIO_FIXTURES.find((candidate) => candidate.key === key);
  if (!fixture) throw new Error(`Missing canonical scenario fixture: ${key}`);
  return structuredClone(fixture.extraction) as ExtractionResult;
}

function buildUnverifiedImpactEvidenceFixture(): ExtractionResult {
  const extraction = cloneScenarioExtraction("gradeA");
  const lineItem = structuredClone(extraction.line_items[0]);
  lineItem.description = "Standard annealed single hung window";
  delete lineItem.dp_rating;
  delete lineItem.noa_number;
  extraction.line_items = [lineItem];
  return extraction;
}

function buildPriceAmbiguityFixture(): ExtractionResult {
  const extraction = cloneScenarioExtraction("gradeA");
  delete extraction.total_quoted_price;
  delete extraction.payment_schedule_text;
  extraction.line_items = extraction.line_items.map((lineItem) => {
    const copy = { ...lineItem };
    delete copy.unit_price;
    delete copy.total_price;
    return copy;
  });
  return extraction;
}

function buildInstallationMethodAmbiguityFixture(): ExtractionResult {
  const extraction = cloneScenarioExtraction("gradeA");
  delete extraction.anchoring_method_text;
  delete extraction.waterproofing_method_text;
  delete extraction.buck_treatment_method_text;
  extraction.sealant_specified = false;
  extraction.manufacturer_install_compliance_stated = false;
  extraction.code_compliance_install_statement_present = false;
  return extraction;
}

function buildWarrantyExclusionsFixture(): ExtractionResult {
  const extraction = cloneScenarioExtraction("gradeA");
  extraction.post_install_stucco_excluded = true;
  extraction.post_install_paint_excluded = true;
  extraction.water_intrusion_damage_excluded = true;
  return extraction;
}

function buildGradeAThresholdFixture(): ExtractionResult {
  const extraction = cloneScenarioExtraction("gradeA");
  delete extraction.cancellation_policy;
  extraction.deposit_percent = 45;
  if (extraction.installation) delete extraction.installation.scope_detail;
  return extraction;
}

function buildGradeABelowThresholdFixture(): ExtractionResult {
  const extraction = buildGradeAThresholdFixture();
  if (extraction.warranty) extraction.warranty.transferable = false;
  return extraction;
}

function buildSafetyCapFloorFixture(): ExtractionResult {
  const extraction = cloneScenarioExtraction("gradeA");
  delete extraction.hvhz_zone;
  extraction.line_items = extraction.line_items.map((lineItem, index) => {
    const copy = { ...lineItem };
    if (index < 2) delete copy.dp_rating;
    return copy;
  });
  return extraction;
}

function buildSafetyCapTriggeredFixture(): ExtractionResult {
  const extraction = buildSafetyCapFloorFixture();
  extraction.code_compliance_install_statement_present = false;
  return extraction;
}

const gradeA = cloneScenarioExtraction("gradeA");
const missingWarranty = cloneScenarioExtraction("missingWarranty");
const unverifiedImpactEvidence = buildUnverifiedImpactEvidenceFixture();
const priceAmbiguity = buildPriceAmbiguityFixture();
const invalidDocument = cloneScenarioExtraction("invalidDocument");
const lowConfidence = cloneScenarioExtraction("lowConfidence");
const contradictoryImpactEvidence = cloneScenarioExtraction("lipstickOnAPig_NonImpact");
const paymentControlTrap = cloneScenarioExtraction("inspectionTrap");
const installationMethodAmbiguity = buildInstallationMethodAmbiguityFixture();
const warrantyExclusions = buildWarrantyExclusionsFixture();
const gradeAThreshold = buildGradeAThresholdFixture();
const gradeABelowThreshold = buildGradeABelowThresholdFixture();
const safetyCapFloor = buildSafetyCapFloorFixture();
const safetyCapTriggered = buildSafetyCapTriggeredFixture();

/**
 * Human-reviewed, pinned expectations for rubric 1.6.0.
 *
 * These values must never be regenerated automatically. A change to an input
 * fingerprint or expected result is a source-reviewed rubric decision.
 */
export const GOLDEN_FIXTURES: readonly GoldenFixture[] = [
  {
    id: "grade-a",
    label: "Grade A Control",
    description: "Complete synthetic quote with all five pillars intact.",
    category: "control",
    provenance: {
      sourceFixtureKey: "gradeA",
      capturedRubricVersion: CAPTURED_RUBRIC_VERSION,
      capturedAtCommit: CAPTURED_AT_COMMIT,
      inputFingerprint: "fnv1a32:578272c0",
    },
    extraction: gradeA,
    expected_results: {
      kind: "scored",
      baselineGrade: "A",
      weightedScore: 100,
      triggeredHardCaps: [],
      hardCapApplied: null,
      pillarBreakdown: {
        safety: 100,
        install: 100,
        price: 100,
        finePrint: 100,
        warranty: 100,
      },
    },
  },
  {
    id: "missing-warranty",
    label: "Missing Warranty",
    description: "Strong quote evidence with no warranty section; the C ceiling is canonical.",
    category: "contract",
    provenance: {
      sourceFixtureKey: "missingWarranty",
      capturedRubricVersion: CAPTURED_RUBRIC_VERSION,
      capturedAtCommit: CAPTURED_AT_COMMIT,
      inputFingerprint: "fnv1a32:f2f1e597",
    },
    extraction: missingWarranty,
    expected_results: {
      kind: "scored",
      baselineGrade: "C",
      weightedScore: 94,
      triggeredHardCaps: ["no_warranty_section"],
      hardCapApplied: "no_warranty_section",
      pillarBreakdown: {
        safety: 100,
        install: 100,
        price: 100,
        finePrint: 100,
        warranty: 60,
      },
    },
  },
  {
    id: "unverified-impact-evidence",
    label: "Unverified Impact Evidence",
    description:
      "A strong synthetic quote whose only product line lacks impact language, DP, and NOA evidence.",
    category: "evidence",
    provenance: {
      sourceFixtureKey: "gradeA",
      capturedRubricVersion: CAPTURED_RUBRIC_VERSION,
      capturedAtCommit: CAPTURED_AT_COMMIT,
      inputFingerprint: "fnv1a32:30d76d39",
    },
    extraction: unverifiedImpactEvidence,
    expected_results: {
      kind: "scored",
      baselineGrade: "D",
      weightedScore: 82.5,
      triggeredHardCaps: ["critical_safety", "unverified_impact_specs"],
      hardCapApplied: "critical_safety",
      pillarBreakdown: {
        safety: 30,
        install: 100,
        price: 100,
        finePrint: 100,
        warranty: 100,
      },
    },
  },
  {
    id: "price-ambiguity",
    label: "Price Ambiguity",
    description:
      "Complete scope and safety evidence with line-item prices, total, and payment schedule withheld.",
    category: "contract",
    provenance: {
      sourceFixtureKey: "gradeA",
      capturedRubricVersion: CAPTURED_RUBRIC_VERSION,
      capturedAtCommit: CAPTURED_AT_COMMIT,
      inputFingerprint: "fnv1a32:c3615fd4",
    },
    extraction: priceAmbiguity,
    expected_results: {
      kind: "scored",
      baselineGrade: "A",
      weightedScore: 91,
      triggeredHardCaps: [],
      hardCapApplied: null,
      pillarBreakdown: {
        safety: 100,
        install: 100,
        price: 55,
        finePrint: 100,
        warranty: 100,
      },
    },
  },
  {
    id: "invalid-document-gate",
    label: "Invalid Document Gate",
    description: "A synthetic kitchen estimate is rejected before deterministic scoring begins.",
    category: "terminal",
    provenance: {
      sourceFixtureKey: "invalidDocument",
      capturedRubricVersion: CAPTURED_RUBRIC_VERSION,
      capturedAtCommit: EXPANSION_CAPTURED_AT_COMMIT,
      inputFingerprint: "fnv1a32:59f70624",
    },
    extraction: invalidDocument,
    expected_results: {
      kind: "terminal",
      terminalOutcome: "invalid_document",
    },
  },
  {
    id: "low-confidence-gate",
    label: "Low Confidence Gate",
    description: "A synthetic unreadable quote is routed to needs_better_upload before scoring.",
    category: "terminal",
    provenance: {
      sourceFixtureKey: "lowConfidence",
      capturedRubricVersion: CAPTURED_RUBRIC_VERSION,
      capturedAtCommit: EXPANSION_CAPTURED_AT_COMMIT,
      inputFingerprint: "fnv1a32:67af5c0f",
    },
    extraction: lowConfidence,
    expected_results: {
      kind: "terminal",
      terminalOutcome: "needs_better_upload",
    },
  },
  {
    id: "contradictory-impact-evidence",
    label: "Contradictory Product Evidence",
    description:
      "The quote is labeled impact while its only product line states standard annealed glass and omits DP and NOA evidence.",
    category: "evidence",
    provenance: {
      sourceFixtureKey: "lipstickOnAPig_NonImpact",
      capturedRubricVersion: CAPTURED_RUBRIC_VERSION,
      capturedAtCommit: EXPANSION_CAPTURED_AT_COMMIT,
      inputFingerprint: "fnv1a32:a283fc44",
    },
    extraction: contradictoryImpactEvidence,
    expected_results: {
      kind: "scored",
      baselineGrade: "D",
      weightedScore: 46.25,
      triggeredHardCaps: [
        "critical_safety",
        "unverified_impact_specs",
        "install_method_unverified",
        "opaque_warranty_execution",
      ],
      hardCapApplied: null,
      pillarBreakdown: {
        safety: 0,
        install: 40,
        price: 95,
        finePrint: 70,
        warranty: 35,
      },
    },
  },
  {
    id: "payment-control-trap",
    label: "Unilateral Price Control",
    description:
      "Final payment precedes inspection and uncapped remeasurement can change price without homeowner approval.",
    category: "contract",
    provenance: {
      sourceFixtureKey: "inspectionTrap",
      capturedRubricVersion: CAPTURED_RUBRIC_VERSION,
      capturedAtCommit: EXPANSION_CAPTURED_AT_COMMIT,
      inputFingerprint: "fnv1a32:51adc3c2",
    },
    extraction: paymentControlTrap,
    expected_results: {
      kind: "scored",
      baselineGrade: "D",
      weightedScore: 84,
      triggeredHardCaps: ["unilateral_price_adjustment", "remeasure_without_approval"],
      hardCapApplied: "unilateral_price_adjustment",
      pillarBreakdown: {
        safety: 100,
        install: 100,
        price: 65,
        finePrint: 55,
        warranty: 100,
      },
    },
  },
  {
    id: "installation-method-ambiguity",
    label: "Installation Method Ambiguity",
    description:
      "Anchoring, waterproofing, buck treatment, sealant, and installation-compliance evidence are absent.",
    category: "evidence",
    provenance: {
      sourceFixtureKey: "gradeA + route-local installation-method omissions",
      capturedRubricVersion: CAPTURED_RUBRIC_VERSION,
      capturedAtCommit: EXPANSION_CAPTURED_AT_COMMIT,
      inputFingerprint: "fnv1a32:41021bc8",
    },
    extraction: installationMethodAmbiguity,
    expected_results: {
      kind: "scored",
      baselineGrade: "C",
      weightedScore: 88.5,
      triggeredHardCaps: ["install_method_unverified"],
      hardCapApplied: "install_method_unverified",
      pillarBreakdown: {
        safety: 90,
        install: 55,
        price: 100,
        finePrint: 100,
        warranty: 100,
      },
    },
  },
  {
    id: "warranty-exclusions",
    label: "Warranty Exclusions",
    description:
      "The written warranty excludes post-install stucco, paint, and water-intrusion damage.",
    category: "contract",
    provenance: {
      sourceFixtureKey: "gradeA + route-local warranty exclusions",
      capturedRubricVersion: CAPTURED_RUBRIC_VERSION,
      capturedAtCommit: EXPANSION_CAPTURED_AT_COMMIT,
      inputFingerprint: "fnv1a32:92387a39",
    },
    extraction: warrantyExclusions,
    expected_results: {
      kind: "scored",
      baselineGrade: "A",
      weightedScore: 96.25,
      triggeredHardCaps: [],
      hardCapApplied: null,
      pillarBreakdown: {
        safety: 100,
        install: 100,
        price: 100,
        finePrint: 100,
        warranty: 75,
      },
    },
  },
  {
    id: "grade-a-threshold-exact",
    label: "A Threshold — Exact",
    description: "A synthetic deduction mix lands exactly on the canonical A threshold of 88.00.",
    category: "boundary",
    provenance: {
      sourceFixtureKey: "gradeA + route-local exact-threshold deductions",
      capturedRubricVersion: CAPTURED_RUBRIC_VERSION,
      capturedAtCommit: EXPANSION_CAPTURED_AT_COMMIT,
      inputFingerprint: "fnv1a32:d075de2d",
    },
    extraction: gradeAThreshold,
    expected_results: {
      kind: "scored",
      baselineGrade: "A",
      weightedScore: 88,
      triggeredHardCaps: [],
      hardCapApplied: null,
      pillarBreakdown: {
        safety: 100,
        install: 80,
        price: 85,
        finePrint: 75,
        warranty: 100,
      },
    },
  },
  {
    id: "grade-a-threshold-below",
    label: "A Threshold — Below",
    description: "One additional warranty deduction yields 87.25 and keeps the canonical result at B.",
    category: "boundary",
    provenance: {
      sourceFixtureKey: "gradeA + route-local below-threshold deductions",
      capturedRubricVersion: CAPTURED_RUBRIC_VERSION,
      capturedAtCommit: EXPANSION_CAPTURED_AT_COMMIT,
      inputFingerprint: "fnv1a32:1a7ff74c",
    },
    extraction: gradeABelowThreshold,
    expected_results: {
      kind: "scored",
      baselineGrade: "B",
      weightedScore: 87.25,
      triggeredHardCaps: [],
      hardCapApplied: null,
      pillarBreakdown: {
        safety: 100,
        install: 80,
        price: 85,
        finePrint: 75,
        warranty: 95,
      },
    },
  },
  {
    id: "safety-cap-floor",
    label: "Safety Cap — Floor",
    description: "Safety is exactly 40, so the critical-safety predicate remains off and the score stays B.",
    category: "boundary",
    provenance: {
      sourceFixtureKey: "gradeA + route-local safety score 40 recipe",
      capturedRubricVersion: CAPTURED_RUBRIC_VERSION,
      capturedAtCommit: EXPANSION_CAPTURED_AT_COMMIT,
      inputFingerprint: "fnv1a32:5229a26b",
    },
    extraction: safetyCapFloor,
    expected_results: {
      kind: "scored",
      baselineGrade: "B",
      weightedScore: 85,
      triggeredHardCaps: [],
      hardCapApplied: null,
      pillarBreakdown: {
        safety: 40,
        install: 100,
        price: 100,
        finePrint: 100,
        warranty: 100,
      },
    },
  },
  {
    id: "safety-cap-trigger",
    label: "Safety Cap — Trigger",
    description: "Safety falls to 35, activating the canonical critical-safety D ceiling.",
    category: "boundary",
    provenance: {
      sourceFixtureKey: "gradeA + route-local safety score 35 recipe",
      capturedRubricVersion: CAPTURED_RUBRIC_VERSION,
      capturedAtCommit: EXPANSION_CAPTURED_AT_COMMIT,
      inputFingerprint: "fnv1a32:9e3a42b4",
    },
    extraction: safetyCapTriggered,
    expected_results: {
      kind: "scored",
      baselineGrade: "D",
      weightedScore: 83.75,
      triggeredHardCaps: ["critical_safety"],
      hardCapApplied: "critical_safety",
      pillarBreakdown: {
        safety: 35,
        install: 100,
        price: 100,
        finePrint: 100,
        warranty: 100,
      },
    },
  },
];
