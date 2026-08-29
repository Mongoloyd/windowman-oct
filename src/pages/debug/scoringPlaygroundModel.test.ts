import { describe, expect, it } from "vitest";
import { computeGrade } from "../../../supabase/functions/scan-quote/scoring.ts";
import {
  buildExportEnvelope,
  calculateExperiment,
  DEFAULT_EXPERIMENTAL_WEIGHTS,
  evaluatePlayground,
  getPresetExtraction,
  parseImportedExtraction,
  QUICK_PRESETS,
  sanitizeImportedExtraction,
} from "./scoringPlaygroundModel";

describe("canonical scoring playground model", () => {
  it("keeps every quick preset on the canonical classification and scoring path", () => {
    for (const preset of QUICK_PRESETS) {
      const extraction = getPresetExtraction(preset.key);
      const outcome = evaluatePlayground(extraction, DEFAULT_EXPERIMENTAL_WEIGHTS);

      if (preset.expectedTerminal) {
        expect(outcome.kind, preset.key).toBe("terminal");
        if (outcome.kind === "terminal") {
          expect(outcome.gate.analysisStatus).toBe(preset.expectedTerminal);
        }
      } else {
        expect(outcome.kind, preset.key).toBe("scored");
        if (outcome.kind === "scored") {
          expect(outcome.canonical).toEqual(computeGrade(extraction));
          expect(outcome.trace.parityOk).toBe(true);
        }
      }
    }
  });

  it("never changes the canonical result when experimental weights move", () => {
    const extraction = getPresetExtraction("gradeA");
    const baseline = evaluatePlayground(extraction, DEFAULT_EXPERIMENTAL_WEIGHTS);
    const changed = evaluatePlayground(extraction, {
      safety: 50,
      install: 10,
      price: 10,
      finePrint: 10,
      warranty: 20,
    });

    expect(baseline.kind).toBe("scored");
    expect(changed.kind).toBe("scored");
    if (baseline.kind === "scored" && changed.kind === "scored") {
      expect(changed.canonical).toEqual(baseline.canonical);
      expect(changed.experiment.kind).toBe("ready");
    }
  });

  it("suppresses the experiment unless weights total exactly 100 percent", () => {
    const outcome = evaluatePlayground(getPresetExtraction("gradeA"), {
      ...DEFAULT_EXPERIMENTAL_WEIGHTS,
      safety: 24,
    });

    expect(outcome.kind).toBe("scored");
    if (outcome.kind === "scored") {
      expect(outcome.experiment).toEqual({ kind: "invalid_weights", weightSum: 99 });
    }
  });

  it("applies already-evaluated caps to an experimental grade in order", () => {
    const result = calculateExperiment(
      { safety: 100, install: 100, price: 100, finePrint: 100, warranty: 100 },
      [
        {
          cap: "first_cap",
          applied: true,
          reason: "fixture",
          resultingMaxGrade: "C",
        },
        {
          cap: "second_cap",
          applied: true,
          reason: "fixture",
          resultingMaxGrade: "D",
        },
      ],
      DEFAULT_EXPERIMENTAL_WEIGHTS,
    );

    expect(result.weightedAverage).toBe(100);
    expect(result.uncappedGrade).toBe("A");
    expect(result.finalGrade).toBe("D");
    expect(result.appliedCaps).toEqual(["first_cap", "second_cap"]);
  });

  it("sanitizes extraction fixtures and drops unknown fields", () => {
    const fixture = sanitizeImportedExtraction({
      document_type: "impact_window_quote",
      is_window_door_related: true,
      confidence: 0.9,
      line_items: [{ description: "Impact window", unknown: "drop me" }],
      terms_conditions_present: true,
      unrelated: "drop me",
    });

    expect(fixture.terms_conditions_present).toBe(true);
    expect(fixture).not.toHaveProperty("unrelated");
    expect(fixture.line_items[0]).not.toHaveProperty("unknown");
  });

  it("rejects malformed JSON and persisted report or identity envelopes", () => {
    expect(() => parseImportedExtraction("not json")).toThrow("not valid JSON");
    expect(() =>
      sanitizeImportedExtraction({
        document_type: "impact_window_quote",
        is_window_door_related: true,
        confidence: 0.9,
        line_items: [],
        full_json: { protected: true },
      }),
    ).toThrow("not accepted");
    expect(() =>
      sanitizeImportedExtraction({
        document_type: "impact_window_quote",
        is_window_door_related: true,
        confidence: 0.9,
        line_items: [],
        sessionId: "protected",
      }),
    ).toThrow("not accepted");
  });

  it("builds an explicitly versioned, sanitized experiment envelope", () => {
    const fixture = getPresetExtraction("gradeA") as ReturnType<typeof getPresetExtraction> & {
      ignored?: string;
    };
    fixture.ignored = "drop me";

    const envelope = buildExportEnvelope(fixture, DEFAULT_EXPERIMENTAL_WEIGHTS);
    expect(envelope.schema).toBe("windowman.scoring-playground.v1");
    expect(envelope.rubricVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(envelope.fixture).not.toHaveProperty("ignored");
    expect(envelope.experimentalWeights).toEqual(DEFAULT_EXPERIMENTAL_WEIGHTS);
  });
});
