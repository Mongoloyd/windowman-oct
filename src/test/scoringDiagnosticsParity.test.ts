/**
 * Parity test: computeGradeWithTrace() must match computeGrade() exactly
 * across every SCENARIO_FIXTURE.
 *
 * If this fails, scoringDiagnostics.ts has drifted from scoring.ts.
 */

import { describe, it, expect } from "vitest";
import { SCENARIO_FIXTURES } from "./createMockQuote";
import { computeGrade } from "../../supabase/functions/scan-quote/scoring.ts";
import { computeGradeWithTrace } from "../../supabase/functions/scan-quote/scoringDiagnostics.ts";

describe("scoringDiagnostics parity vs canonical computeGrade()", () => {
  for (const fx of SCENARIO_FIXTURES as any[]) {
    if (!fx.extraction) continue;

    it(`[${fx.key}] trace matches computeGrade()`, () => {
      const canonical = computeGrade(fx.extraction);
      const trace = computeGradeWithTrace(fx.extraction);

      expect(trace.parityOk, `Parity failed: ${JSON.stringify(trace.mismatch)}`).toBe(true);
      expect(trace.letterGrade).toBe(canonical.letterGrade);
      expect(trace.weightedAverage).toBe(canonical.weightedAverage);
      expect(trace.hardCapApplied).toBe(canonical.hardCapApplied);
      expect(trace.pillarScores).toEqual(canonical.pillarScores);

      // Trace structure sanity
      for (const pillar of ["safety", "install", "price", "finePrint", "warranty"] as const) {
        expect(trace.pillars[pillar].startingScore).toBe(100);
        expect(trace.pillars[pillar].finalScore).toBe(canonical.pillarScores[pillar]);
        expect(Array.isArray(trace.pillars[pillar].penalties)).toBe(true);
      }
      expect(Array.isArray(trace.hardCaps)).toBe(true);
      expect(trace.hardCaps.length).toBeGreaterThan(0);
    });
  }
});
