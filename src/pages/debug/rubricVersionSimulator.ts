import {
  classifyScanGate,
  normalizeClassification,
} from "../../../supabase/functions/scan-quote/classificationGate.ts";
import {
  GRADE_RANK,
  letterGrade,
  RUBRIC_VERSION,
  type ExtractionResult,
  type GradeResult,
  type PillarScores,
} from "../../../supabase/functions/scan-quote/scoring.ts";
import {
  computeGradeWithTrace,
  type GradeTrace,
  type HardCapEvaluation,
} from "../../../supabase/functions/scan-quote/scoringDiagnostics.ts";
import type { ExperimentalWeights } from "./scoringPlaygroundModel";
import {
  fingerprintExtraction,
  type GoldenFixture,
  type GoldenScoredExpectation,
} from "./fixtures/goldenFixtures";

export type CanonicalRubricFn = (extraction: ExtractionResult) => GradeResult;
export type DiagnosticsFn = (extraction: ExtractionResult) => GradeTrace;
export type HardCapSettings = Readonly<Record<string, boolean>>;

export interface ExperimentalRubricConfig {
  weights: ExperimentalWeights;
  enabledHardCaps: HardCapSettings;
}

export type SimulatorUnavailableReason =
  | "terminal"
  | "invalid_weights"
  | "diagnostic_drift"
  | "baseline_drift";

export interface ExperimentalRubricResult {
  weightedScore: number;
  uncappedGrade: string;
  finalGrade: string;
  triggeredHardCaps: string[];
  effectiveHardCaps: string[];
}

export type ExperimentalRun =
  | { kind: "ready"; result: ExperimentalRubricResult }
  | {
      kind: "unavailable";
      reason: SimulatorUnavailableReason;
      weightSum?: number;
    };

export interface GoldenIntegrity {
  pass: boolean;
  rubricVersionMatches: boolean;
  inputFingerprintMatches: boolean;
  classificationMatches: boolean;
  canonicalOutputMatches: boolean;
  diagnosticsParity: boolean;
  issues: string[];
}

export type ObservedCanonicalResult =
  | {
      kind: "terminal";
      terminalOutcome: "invalid_document" | "needs_better_upload";
    }
  | {
      kind: "scored";
      result: GradeResult;
      trace: GradeTrace;
      triggeredHardCaps: string[];
    };

export interface FixtureDelta {
  gradeFrom: string | null;
  gradeTo: string | null;
  scoreDelta: number | null;
  newlyTriggeredHardCaps: string[];
  clearedHardCaps: string[];
}

export interface FixtureRubricComparison {
  fixture: GoldenFixture;
  canonical: ObservedCanonicalResult;
  goldenIntegrity: GoldenIntegrity;
  experimental: ExperimentalRun;
  regressionPass: boolean;
  experimentalGradeMatches: boolean;
  delta: FixtureDelta;
}

export interface RubricComparisonSuite {
  rubricVersion: string;
  comparisons: FixtureRubricComparison[];
  summary: {
    total: number;
    goldenIntegrityPasses: number;
    experimentalPasses: number;
    regressions: number;
    unavailable: number;
  };
}

const PILLAR_KEYS = ["safety", "install", "price", "finePrint", "warranty"] as const;

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function pillarScoresEqual(left: PillarScores, right: PillarScores): boolean {
  return PILLAR_KEYS.every((key) => left[key] === right[key]);
}

function validateWeights(weights: ExperimentalWeights): { valid: boolean; sum: number } {
  const values = PILLAR_KEYS.map((key) => weights[key]);
  const validValues = values.every(
    (value) => Number.isFinite(value) && Number.isInteger(value) && value >= 0 && value <= 100,
  );
  const sum = values.reduce((total, value) => total + value, 0);
  return { valid: validValues && sum === 100, sum };
}

function expectedGrade(expectation: GoldenFixture["expected_results"]): string | null {
  return expectation.kind === "scored" ? expectation.baselineGrade : null;
}

function expectedScore(expectation: GoldenFixture["expected_results"]): number | null {
  return expectation.kind === "scored" ? expectation.weightedScore : null;
}

function expectedHardCaps(expectation: GoldenFixture["expected_results"]): readonly string[] {
  return expectation.kind === "scored" ? expectation.triggeredHardCaps : [];
}

function buildIntegrity(
  fixture: GoldenFixture,
  canonical: ObservedCanonicalResult,
): GoldenIntegrity {
  const rubricVersionMatches = fixture.provenance.capturedRubricVersion === RUBRIC_VERSION;
  const inputFingerprintMatches =
    fixture.provenance.inputFingerprint === fingerprintExtraction(fixture.extraction);
  const classificationMatches =
    fixture.expected_results.kind === canonical.kind &&
    (fixture.expected_results.kind !== "terminal" ||
      (canonical.kind === "terminal" &&
        fixture.expected_results.terminalOutcome === canonical.terminalOutcome));

  let canonicalOutputMatches = false;
  let diagnosticsParity = true;
  if (fixture.expected_results.kind === "scored" && canonical.kind === "scored") {
    const expected = fixture.expected_results;
    canonicalOutputMatches =
      canonical.result.letterGrade === expected.baselineGrade &&
      canonical.result.weightedAverage === expected.weightedScore &&
      canonical.result.hardCapApplied === expected.hardCapApplied &&
      pillarScoresEqual(canonical.result.pillarScores, expected.pillarBreakdown) &&
      arraysEqual(canonical.triggeredHardCaps, expected.triggeredHardCaps);
    diagnosticsParity = canonical.trace.parityOk;
  } else if (fixture.expected_results.kind === "terminal" && canonical.kind === "terminal") {
    canonicalOutputMatches = fixture.expected_results.terminalOutcome === canonical.terminalOutcome;
  }

  const issues: string[] = [];
  if (!rubricVersionMatches) issues.push("rubric_version_drift");
  if (!inputFingerprintMatches) issues.push("fixture_input_drift");
  if (!classificationMatches) issues.push("classification_drift");
  if (!canonicalOutputMatches) issues.push("canonical_output_drift");
  if (!diagnosticsParity) issues.push("diagnostic_parity_drift");

  return {
    pass: issues.length === 0,
    rubricVersionMatches,
    inputFingerprintMatches,
    classificationMatches,
    canonicalOutputMatches,
    diagnosticsParity,
    issues,
  };
}

export function runExperimentalRubric(
  pillarScores: PillarScores,
  hardCaps: readonly HardCapEvaluation[],
  config: ExperimentalRubricConfig,
): ExperimentalRun {
  const weights = validateWeights(config.weights);
  if (!weights.valid) {
    return { kind: "unavailable", reason: "invalid_weights", weightSum: weights.sum };
  }

  const weightedSum = PILLAR_KEYS.reduce(
    (sum, key) => sum + pillarScores[key] * (config.weights[key] / 100),
    0,
  );
  const weightedScore = Math.round(weightedSum * 100) / 100;
  const uncappedGrade = letterGrade(weightedScore);
  let finalGrade = uncappedGrade;
  const triggeredHardCaps: string[] = [];
  const effectiveHardCaps: string[] = [];

  for (const hardCap of hardCaps) {
    if (!hardCap.applied || config.enabledHardCaps[hardCap.cap] === false) continue;
    triggeredHardCaps.push(hardCap.cap);
    const ceiling = hardCap.resultingMaxGrade;
    if (!ceiling) continue;
    if ((GRADE_RANK[finalGrade] ?? 0) > (GRADE_RANK[ceiling] ?? 0)) {
      finalGrade = ceiling;
      effectiveHardCaps.push(hardCap.cap);
    }
  }

  return {
    kind: "ready",
    result: {
      weightedScore,
      uncappedGrade,
      finalGrade,
      triggeredHardCaps,
      effectiveHardCaps,
    },
  };
}

function observeCanonical(
  fixture: GoldenFixture,
  canonicalRubricFn: CanonicalRubricFn,
  diagnosticsFn: DiagnosticsFn,
): ObservedCanonicalResult {
  const gate = classifyScanGate(normalizeClassification(fixture.extraction));
  if (gate.action === "terminate") {
    return { kind: "terminal", terminalOutcome: gate.analysisStatus };
  }

  const result = canonicalRubricFn(fixture.extraction);
  const trace = diagnosticsFn(fixture.extraction);
  return {
    kind: "scored",
    result,
    trace,
    triggeredHardCaps: trace.hardCaps.filter((cap) => cap.applied).map((cap) => cap.cap),
  };
}

function compareFixture(
  fixture: GoldenFixture,
  canonicalRubricFn: CanonicalRubricFn,
  config: ExperimentalRubricConfig,
  diagnosticsFn: DiagnosticsFn,
): FixtureRubricComparison {
  const canonical = observeCanonical(fixture, canonicalRubricFn, diagnosticsFn);
  const goldenIntegrity = buildIntegrity(fixture, canonical);

  let experimental: ExperimentalRun;
  if (canonical.kind === "terminal") {
    experimental = { kind: "unavailable", reason: "terminal" };
  } else if (!canonical.trace.parityOk) {
    experimental = { kind: "unavailable", reason: "diagnostic_drift" };
  } else if (!goldenIntegrity.pass) {
    experimental = { kind: "unavailable", reason: "baseline_drift" };
  } else {
    experimental = runExperimentalRubric(
      canonical.trace.pillarScores,
      canonical.trace.hardCaps,
      config,
    );
  }

  const expectedCaps = expectedHardCaps(fixture.expected_results);
  const experimentResult = experimental.kind === "ready" ? experimental.result : null;
  const experimentalGradeMatches =
    experimentResult !== null && experimentResult.finalGrade === expectedGrade(fixture.expected_results);
  const regressionPass =
    experimentResult !== null &&
    experimentResult.weightedScore === expectedScore(fixture.expected_results) &&
    arraysEqual(experimentResult.triggeredHardCaps, expectedCaps) &&
    experimentalGradeMatches;

  const experimentCaps = experimentResult?.triggeredHardCaps ?? [];
  return {
    fixture,
    canonical,
    goldenIntegrity,
    experimental,
    regressionPass,
    experimentalGradeMatches,
    delta: {
      gradeFrom: expectedGrade(fixture.expected_results),
      gradeTo: experimentResult?.finalGrade ?? null,
      scoreDelta:
        experimentResult && fixture.expected_results.kind === "scored"
          ? Math.round((experimentResult.weightedScore - fixture.expected_results.weightedScore) * 100) /
            100
          : null,
      newlyTriggeredHardCaps: experimentCaps.filter((cap) => !expectedCaps.includes(cap)),
      clearedHardCaps: expectedCaps.filter((cap) => !experimentCaps.includes(cap)),
    },
  };
}

export function compareRubricVersions(
  fixtures: readonly GoldenFixture[],
  canonicalRubricFn: CanonicalRubricFn,
  experimentalConfig: ExperimentalRubricConfig,
  diagnosticsFn: DiagnosticsFn = computeGradeWithTrace,
): RubricComparisonSuite {
  const comparisons = fixtures.map((fixture) =>
    compareFixture(fixture, canonicalRubricFn, experimentalConfig, diagnosticsFn),
  );
  const experimentalPasses = comparisons.filter((comparison) => comparison.regressionPass).length;

  return {
    rubricVersion: RUBRIC_VERSION,
    comparisons,
    summary: {
      total: comparisons.length,
      goldenIntegrityPasses: comparisons.filter((comparison) => comparison.goldenIntegrity.pass)
        .length,
      experimentalPasses,
      regressions: comparisons.filter(
        (comparison) =>
          comparison.experimental.kind === "ready" &&
          !comparison.regressionPass,
      ).length,
      unavailable: comparisons.filter((comparison) => comparison.experimental.kind === "unavailable")
        .length,
    },
  };
}

export function collectCanonicalHardCaps(fixtures: readonly GoldenFixture[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const fixture of fixtures) {
    const gate = classifyScanGate(normalizeClassification(fixture.extraction));
    if (gate.action === "terminate") continue;
    for (const hardCap of computeGradeWithTrace(fixture.extraction).hardCaps) {
      if (seen.has(hardCap.cap)) continue;
      seen.add(hardCap.cap);
      ordered.push(hardCap.cap);
    }
  }
  return ordered;
}

export function createDefaultHardCapSettings(
  fixtures: readonly GoldenFixture[],
): HardCapSettings {
  return Object.fromEntries(collectCanonicalHardCaps(fixtures).map((cap) => [cap, true]));
}

export function isScoredExpectation(
  expectation: GoldenFixture["expected_results"],
): expectation is GoldenScoredExpectation {
  return expectation.kind === "scored";
}
