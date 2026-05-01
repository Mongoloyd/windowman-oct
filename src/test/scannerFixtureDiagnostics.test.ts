/**
 * Scanner Fixture Diagnostics — focused unit tests
 *
 * Documents and asserts the current deterministic rubric (v1.6.0) behavior
 * for the four scenarios that were previously flagged as mismatches in the
 * Dev Quote Generator audit:
 *
 *   - gradeC          (expected C)
 *   - cornerCutting   (expected D, calibrated 2026-05-01)
 *   - overpaymentTrap (expected B)
 *   - finePrintTrap   (expected C)
 *
 * These tests use the REAL fixture extractions and the REAL computeGrade()
 * engine. They do not mock anything, do not touch Supabase / Twilio / Gemini
 * / edge functions, and do not modify production scoring or fixture values.
 *
 * If a future rubric change shifts these numbers, this file will fail loudly
 * — making rubric drift visible at PR time.
 */

import { describe, it, expect } from "vitest";

import { SCENARIO_FIXTURES } from "./createMockQuote";
import {
  computeGrade,
  type ExtractionResult,
} from "../../supabase/functions/scan-quote/scoring.ts";

// ── helpers ────────────────────────────────────────────────────────────────

function getFixtureExtraction(key: string): ExtractionResult {
  const fx = SCENARIO_FIXTURES.find((f: any) => f.key === key) as any;
  if (!fx) throw new Error(`Fixture not found: ${key}`);
  if (!fx.extraction) throw new Error(`Fixture has no extraction: ${key}`);
  return fx.extraction as ExtractionResult;
}

function pillarScore(result: any, name: string): number | null {
  const p = result.pillars ?? result.pillarScores ?? {};
  const v = p[name];
  if (v == null) return null;
  return typeof v === "object" ? (v.score ?? null) : v;
}

function hardCapList(result: any): string[] {
  const raw = result.hardCapApplied;
  if (raw == null) return [];
  return Array.isArray(raw) ? raw : String(raw).split(",").map((s) => s.trim());
}

// ── tests ──────────────────────────────────────────────────────────────────

describe("Scanner fixture diagnostics — deterministic rubric snapshot", () => {
  it("gradeC: caps at C via ambiguous_opening_scope, weighted ~75", () => {
    const result: any = computeGrade(getFixtureExtraction("gradeC"));

    expect(result.letterGrade).toBe("C");
    expect(result.weightedAverage).toBeGreaterThanOrEqual(70);
    expect(result.weightedAverage).toBeLessThanOrEqual(80);
    expect(hardCapList(result)).toContain("ambiguous_opening_scope");

    expect(pillarScore(result, "safety")).toBe(55);
    expect(pillarScore(result, "install")).toBe(80);
    expect(pillarScore(result, "price")).toBe(95);
    expect(pillarScore(result, "finePrint")).toBe(65);
    expect(pillarScore(result, "warranty")).toBe(90);
  });

  it("cornerCutting: lands at D with no hard cap (rubric-design D-floor)", () => {
    const result: any = computeGrade(getFixtureExtraction("cornerCutting"));

    expect(result.letterGrade).toBe("D");
    expect(result.weightedAverage).toBeGreaterThanOrEqual(30);
    expect(result.weightedAverage).toBeLessThanOrEqual(45);
    expect(hardCapList(result)).toEqual([]);

    expect(pillarScore(result, "safety")).toBe(0);
    expect(pillarScore(result, "install")).toBe(0);
    expect(pillarScore(result, "price")).toBe(90);
    expect(pillarScore(result, "finePrint")).toBe(50);
    expect(pillarScore(result, "warranty")).toBe(60);
  });

  it("overpaymentTrap: weighted average lands in B band (no hard cap)", () => {
    const result: any = computeGrade(getFixtureExtraction("overpaymentTrap"));

    expect(result.letterGrade).toBe("B");
    expect(result.weightedAverage).toBeGreaterThanOrEqual(80);
    expect(result.weightedAverage).toBeLessThan(88); // below A threshold
    expect(hardCapList(result)).toEqual([]);

    expect(pillarScore(result, "safety")).toBe(80);
    expect(pillarScore(result, "install")).toBe(100);
    expect(pillarScore(result, "price")).toBe(95);
    expect(pillarScore(result, "finePrint")).toBe(60);
    expect(pillarScore(result, "warranty")).toBe(100);
  });

  it("finePrintTrap: caps at C via substrate_open_checkbook", () => {
    const result: any = computeGrade(getFixtureExtraction("finePrintTrap"));

    expect(result.letterGrade).toBe("C");
    expect(result.weightedAverage).toBeGreaterThanOrEqual(70);
    expect(result.weightedAverage).toBeLessThanOrEqual(85);
    expect(hardCapList(result)).toContain("substrate_open_checkbook");

    expect(pillarScore(result, "safety")).toBe(100);
    expect(pillarScore(result, "install")).toBe(90);
    expect(pillarScore(result, "price")).toBe(80);
    expect(pillarScore(result, "finePrint")).toBe(45);
    expect(pillarScore(result, "warranty")).toBe(80);
  });
});
