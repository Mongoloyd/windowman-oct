import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  fingerprintExtraction,
  GOLDEN_FIXTURES,
  type GoldenFixture,
} from "./goldenFixtures";

const EXPANSION_COMMIT = "0b4fe5a97b5203c19da5b66ae37e7fc8f7d57e83";

function fixtureById(id: string): GoldenFixture {
  const fixture = GOLDEN_FIXTURES.find((candidate) => candidate.id === id);
  if (!fixture) throw new Error(`Missing golden fixture: ${id}`);
  return fixture;
}

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
    return keys;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      keys.add(key);
      collectKeys(child, keys);
    }
  }
  return keys;
}

describe("expanded golden fixture corpus", () => {
  it("contains fourteen uniquely identified, fingerprint-bound fixtures", () => {
    expect(GOLDEN_FIXTURES).toHaveLength(14);
    expect(new Set(GOLDEN_FIXTURES.map((fixture) => fixture.id)).size).toBe(14);

    for (const fixture of GOLDEN_FIXTURES) {
      expect(fixture.provenance.capturedRubricVersion).toBe("1.6.0");
      expect(fingerprintExtraction(fixture.extraction)).toBe(
        fixture.provenance.inputFingerprint,
      );
      if (fixture.expected_results.kind === "scored") {
        expect(Number.isInteger(fixture.expected_results.weightedScore * 100)).toBe(true);
        expect(Object.keys(fixture.expected_results.pillarBreakdown).sort()).toEqual([
          "finePrint",
          "install",
          "price",
          "safety",
          "warranty",
        ]);
      }
    }
  });

  it("pins the two terminal gates and every required behavior family", () => {
    expect(fixtureById("invalid-document-gate").expected_results).toEqual({
      kind: "terminal",
      terminalOutcome: "invalid_document",
    });
    expect(fixtureById("low-confidence-gate").expected_results).toEqual({
      kind: "terminal",
      terminalOutcome: "needs_better_upload",
    });

    expect(fixtureById("contradictory-impact-evidence").expected_results).toMatchObject({
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
    });
    expect(fixtureById("payment-control-trap").expected_results).toMatchObject({
      kind: "scored",
      baselineGrade: "D",
      triggeredHardCaps: ["unilateral_price_adjustment", "remeasure_without_approval"],
      hardCapApplied: "unilateral_price_adjustment",
    });
    expect(fixtureById("installation-method-ambiguity").expected_results).toMatchObject({
      kind: "scored",
      baselineGrade: "C",
      triggeredHardCaps: ["install_method_unverified"],
    });
    expect(fixtureById("warranty-exclusions").expected_results).toMatchObject({
      kind: "scored",
      baselineGrade: "A",
      weightedScore: 96.25,
      pillarBreakdown: { warranty: 75 },
    });
  });

  it("pins exact grade and safety-cap boundaries on both sides", () => {
    expect(fixtureById("grade-a-threshold-exact").expected_results).toMatchObject({
      kind: "scored",
      baselineGrade: "A",
      weightedScore: 88,
    });
    expect(fixtureById("grade-a-threshold-below").expected_results).toMatchObject({
      kind: "scored",
      baselineGrade: "B",
      weightedScore: 87.25,
    });
    expect(fixtureById("safety-cap-floor").expected_results).toMatchObject({
      kind: "scored",
      baselineGrade: "B",
      pillarBreakdown: { safety: 40 },
      triggeredHardCaps: [],
    });
    expect(fixtureById("safety-cap-trigger").expected_results).toMatchObject({
      kind: "scored",
      baselineGrade: "D",
      pillarBreakdown: { safety: 35 },
      triggeredHardCaps: ["critical_safety"],
      hardCapApplied: "critical_safety",
    });
  });

  it("keeps every expansion fixture tied to the reviewed merged base", () => {
    const expansionIds = [
      "invalid-document-gate",
      "low-confidence-gate",
      "contradictory-impact-evidence",
      "payment-control-trap",
      "installation-method-ambiguity",
      "warranty-exclusions",
      "grade-a-threshold-exact",
      "grade-a-threshold-below",
      "safety-cap-floor",
      "safety-cap-trigger",
    ];

    for (const id of expansionIds) {
      expect(fixtureById(id).provenance.capturedAtCommit).toBe(EXPANSION_COMMIT);
    }
  });

  it("contains no identity, authorization, persisted-report, or credential fields", () => {
    const forbiddenKeys = new Set([
      "access_token",
      "address",
      "auth",
      "contact_session_id",
      "email",
      "full_json",
      "lead_id",
      "password",
      "phone",
      "refresh_token",
      "report_id",
      "scan_session_id",
      "session_id",
      "token",
      "user_id",
    ]);
    const corpusKeys = collectKeys(GOLDEN_FIXTURES);
    for (const key of forbiddenKeys) expect(corpusKeys.has(key)).toBe(false);

    const serialized = JSON.stringify(GOLDEN_FIXTURES);
    expect(serialized).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    expect(serialized).not.toMatch(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  });

  it("does not generate expectations from the scorer or stale scenario grades", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/pages/debug/fixtures/goldenFixtures.ts"),
      "utf8",
    );
    expect(source).not.toContain("computeGrade");
    expect(source).not.toContain("expectedGrade");
  });
});
