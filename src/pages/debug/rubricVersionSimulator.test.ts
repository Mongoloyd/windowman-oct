import { describe, expect, it, vi } from "vitest";
import {
  computeGrade,
  RUBRIC_VERSION,
  type ExtractionResult,
  type PillarScores,
} from "../../../supabase/functions/scan-quote/scoring.ts";
import {
  computeGradeWithTrace,
  type HardCapEvaluation,
} from "../../../supabase/functions/scan-quote/scoringDiagnostics.ts";
import { getPresetExtraction } from "./scoringPlaygroundModel";
import {
  GOLDEN_FIXTURES,
  fingerprintExtraction,
  type GoldenFixture,
} from "./fixtures/goldenFixtures";
import {
  compareRubricVersions,
  createDefaultHardCapSettings,
  runExperimentalRubric,
  type ExperimentalRubricConfig,
} from "./rubricVersionSimulator";

const defaultConfig: ExperimentalRubricConfig = {
  weights: { safety: 25, install: 20, price: 20, finePrint: 20, warranty: 15 },
  enabledHardCaps: createDefaultHardCapSettings(GOLDEN_FIXTURES),
};

function cloneGolden(fixture: GoldenFixture): GoldenFixture {
  return structuredClone(fixture);
}

describe("golden fixture regression contract", () => {
  it("matches all pinned rubric 1.6.0 expectations exactly", () => {
    const suite = compareRubricVersions(GOLDEN_FIXTURES, computeGrade, defaultConfig);

    expect(suite.rubricVersion).toBe("1.6.0");
    expect(suite.summary).toEqual({
      total: 14,
      goldenIntegrityPasses: 14,
      experimentalPasses: 12,
      regressions: 0,
      unavailable: 2,
    });
    for (const comparison of suite.comparisons) {
      expect(comparison.goldenIntegrity).toMatchObject({
        pass: true,
        rubricVersionMatches: true,
        inputFingerprintMatches: true,
        classificationMatches: true,
        canonicalOutputMatches: true,
        diagnosticsParity: true,
      });
      if (comparison.fixture.expected_results.kind === "scored") {
        expect(comparison.regressionPass).toBe(true);
      } else {
        expect(comparison.experimental).toEqual({ kind: "unavailable", reason: "terminal" });
      }
    }
  });

  it("keeps both checked-in terminal gates out of scoring and diagnostics", () => {
    const terminals = GOLDEN_FIXTURES.filter(
      (fixture) => fixture.expected_results.kind === "terminal",
    );
    const scorer = vi.fn<(value: ExtractionResult) => ReturnType<typeof computeGrade>>(computeGrade);
    const diagnostics = vi.fn(computeGradeWithTrace);

    const suite = compareRubricVersions(terminals, scorer, defaultConfig, diagnostics);

    expect(terminals.map((fixture) => fixture.expected_results)).toEqual([
      { kind: "terminal", terminalOutcome: "invalid_document" },
      { kind: "terminal", terminalOutcome: "needs_better_upload" },
    ]);
    expect(scorer).not.toHaveBeenCalled();
    expect(diagnostics).not.toHaveBeenCalled();
    expect(suite.summary).toEqual({
      total: 2,
      goldenIntegrityPasses: 2,
      experimentalPasses: 0,
      regressions: 0,
      unavailable: 2,
    });
  });

  it("reports rubric, fixture-input, classification, and expected-output drift without auto-accepting", () => {
    const rubricDrift = cloneGolden(GOLDEN_FIXTURES[0]);
    rubricDrift.provenance.capturedRubricVersion = "future-unapproved";
    expect(
      compareRubricVersions([rubricDrift], computeGrade, defaultConfig).comparisons[0]
        .goldenIntegrity.issues,
    ).toContain("rubric_version_drift");

    const inputDrift = cloneGolden(GOLDEN_FIXTURES[0]);
    inputDrift.extraction.contractor_name = "Changed synthetic fixture";
    expect(
      compareRubricVersions([inputDrift], computeGrade, defaultConfig).comparisons[0]
        .goldenIntegrity.issues,
    ).toContain("fixture_input_drift");

    const classificationDrift = cloneGolden(GOLDEN_FIXTURES[0]);
    classificationDrift.expected_results = {
      kind: "terminal",
      terminalOutcome: "invalid_document",
    };
    expect(
      compareRubricVersions([classificationDrift], computeGrade, defaultConfig).comparisons[0]
        .goldenIntegrity.issues,
    ).toContain("classification_drift");
    expect(
      compareRubricVersions([classificationDrift], computeGrade, defaultConfig).comparisons[0]
        .goldenIntegrity.issues,
    ).not.toContain("diagnostic_parity_drift");

    const outputDrift = cloneGolden(GOLDEN_FIXTURES[0]);
    if (outputDrift.expected_results.kind !== "scored") throw new Error("Expected scored golden");
    outputDrift.expected_results.weightedScore = 99.99;
    expect(
      compareRubricVersions([outputDrift], computeGrade, defaultConfig).comparisons[0]
        .goldenIntegrity.issues,
    ).toContain("canonical_output_drift");
  });

  it("keeps terminal classification terminal and never invokes the rubric scorer", () => {
    const extraction = getPresetExtraction("invalidDocument");
    const terminal: GoldenFixture = {
      id: "terminal-proof",
      label: "Terminal proof",
      description: "Synthetic non-quote",
      category: "terminal",
      provenance: {
        sourceFixtureKey: "invalidDocument",
        capturedRubricVersion: RUBRIC_VERSION,
        capturedAtCommit: "test-only",
        inputFingerprint: fingerprintExtraction(extraction),
      },
      extraction,
      expected_results: { kind: "terminal", terminalOutcome: "invalid_document" },
    };
    const scorer = vi.fn<(value: ExtractionResult) => ReturnType<typeof computeGrade>>(computeGrade);

    const comparison = compareRubricVersions([terminal], scorer, defaultConfig).comparisons[0];

    expect(scorer).not.toHaveBeenCalled();
    expect(comparison.canonical).toEqual({ kind: "terminal", terminalOutcome: "invalid_document" });
    expect(comparison.experimental).toEqual({ kind: "unavailable", reason: "terminal" });
    expect(comparison.goldenIntegrity.pass).toBe(true);
  });

  it("suppresses experiments when diagnostics parity is false", () => {
    const diagnosticDrift = (extraction: ExtractionResult) => ({
      ...computeGradeWithTrace(extraction),
      parityOk: false,
    });

    const comparison = compareRubricVersions(
      [GOLDEN_FIXTURES[0]],
      computeGrade,
      defaultConfig,
      diagnosticDrift,
    ).comparisons[0];

    expect(comparison.goldenIntegrity.issues).toContain("diagnostic_parity_drift");
    expect(comparison.experimental).toEqual({
      kind: "unavailable",
      reason: "diagnostic_drift",
    });
  });

  it("fails regressions when the experimental final grade drifts", () => {
    const gradeDrift = cloneGolden(GOLDEN_FIXTURES[0]);
    if (gradeDrift.expected_results.kind !== "scored") throw new Error("Expected scored golden");
    gradeDrift.expected_results.baselineGrade = "B";

    const scorer = vi.fn<(value: ExtractionResult) => ReturnType<typeof computeGrade>>(() => ({
      weightedAverage: 100,
      letterGrade: "B",
      hardCapApplied: null,
      pillarScores: {
        safety: 100,
        install: 100,
        price: 100,
        finePrint: 100,
        warranty: 100,
      },
    }));

    const comparison = compareRubricVersions([gradeDrift], scorer, defaultConfig).comparisons[0];

    expect(comparison.goldenIntegrity.pass).toBe(true);
    expect(comparison.experimental).toMatchObject({
      kind: "ready",
      result: { weightedScore: 100, finalGrade: "A", triggeredHardCaps: [] },
    });
    expect(comparison.experimentalGradeMatches).toBe(false);
    expect(comparison.regressionPass).toBe(false);
  });
});

describe("hypothetical rubric calculation", () => {
  const pillars: PillarScores = {
    safety: 87,
    install: 74,
    price: 63,
    finePrint: 91,
    warranty: 56,
  };

  it("matches canonical single-rounding semantics and rejects invalid weights", () => {
    const result = runExperimentalRubric(pillars, [], defaultConfig);
    expect(result).toMatchObject({
      kind: "ready",
      result: { weightedScore: 75.75, finalGrade: "B" },
    });

    expect(
      runExperimentalRubric(pillars, [], {
        ...defaultConfig,
        weights: { ...defaultConfig.weights, warranty: 14 },
      }),
    ).toEqual({ kind: "unavailable", reason: "invalid_weights", weightSum: 99 });
  });

  it("preserves cap order, ignores untriggered caps, and lets toggles only suppress", () => {
    const caps: HardCapEvaluation[] = [
      { cap: "max_c", applied: true, reason: "test", resultingMaxGrade: "C" },
      { cap: "untriggered", applied: false, reason: "test", resultingMaxGrade: "F" },
      { cap: "max_d", applied: true, reason: "test", resultingMaxGrade: "D" },
    ];
    const perfect: PillarScores = {
      safety: 100,
      install: 100,
      price: 100,
      finePrint: 100,
      warranty: 100,
    };

    const allEnabled = runExperimentalRubric(perfect, caps, {
      ...defaultConfig,
      enabledHardCaps: { max_c: true, untriggered: true, max_d: true },
    });
    expect(allEnabled).toMatchObject({
      kind: "ready",
      result: {
        finalGrade: "D",
        triggeredHardCaps: ["max_c", "max_d"],
        effectiveHardCaps: ["max_c", "max_d"],
      },
    });

    const suppressed = runExperimentalRubric(perfect, caps, {
      ...defaultConfig,
      enabledHardCaps: { max_c: true, untriggered: true, max_d: false },
    });
    expect(suppressed).toMatchObject({
      kind: "ready",
      result: { finalGrade: "C", triggeredHardCaps: ["max_c"] },
    });
  });

  it("changes only the hypothetical result when a real triggered cap is disabled", () => {
    const settings = { ...defaultConfig.enabledHardCaps, no_warranty_section: false };
    const suite = compareRubricVersions(GOLDEN_FIXTURES, computeGrade, {
      ...defaultConfig,
      enabledHardCaps: settings,
    });
    const missingWarranty = suite.comparisons.find(
      (comparison) => comparison.fixture.id === "missing-warranty",
    );

    expect(missingWarranty?.canonical).toMatchObject({
      kind: "scored",
      result: { letterGrade: "C", weightedAverage: 94 },
    });
    expect(missingWarranty?.experimental).toMatchObject({
      kind: "ready",
      result: { finalGrade: "A", weightedScore: 94, triggeredHardCaps: [] },
    });
    expect(missingWarranty?.regressionPass).toBe(false);
    expect(missingWarranty?.delta.clearedHardCaps).toEqual(["no_warranty_section"]);
  });
});
