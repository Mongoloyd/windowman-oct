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

export interface GoldenFixture {
  id: string;
  label: string;
  description: string;
  provenance: GoldenFixtureProvenance;
  extraction: ExtractionResult;
  expected_results: GoldenExpectedResult;
}

const CAPTURED_AT_COMMIT = "aafaf960c67690688faffef0cef1d39660649dd5";
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

const gradeA = cloneScenarioExtraction("gradeA");
const missingWarranty = cloneScenarioExtraction("missingWarranty");
const unverifiedImpactEvidence = buildUnverifiedImpactEvidenceFixture();
const priceAmbiguity = buildPriceAmbiguityFixture();

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
];
