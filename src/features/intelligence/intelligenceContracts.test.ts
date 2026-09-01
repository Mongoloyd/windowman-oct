import { describe, expect, it } from "vitest";
import { INTERNAL_INTELLIGENCE_FIXTURE, PUBLIC_ORACLE_FIXTURE } from "./fixtures";
import { INTELLIGENCE_INSIGHTS } from "./insightRegistry";

describe("WindowMan intelligence contracts", () => {
  it("registers exactly fifteen stable, unique insight concepts", () => {
    expect(INTELLIGENCE_INSIGHTS).toHaveLength(15);
    expect(new Set(INTELLIGENCE_INSIGHTS.map((insight) => insight.id)).size).toBe(15);
    expect(INTELLIGENCE_INSIGHTS.map((insight) => insight.number)).toEqual(
      Array.from({ length: 15 }, (_, index) => index + 1),
    );
  });

  it("uses integer cents for every fixture distribution amount", () => {
    const distributions = [
      INTERNAL_INTELLIGENCE_FIXTURE.quoted,
      INTERNAL_INTELLIGENCE_FIXTURE.verifiedAccepted,
      INTERNAL_INTELLIGENCE_FIXTURE.verifiedFinal,
    ];

    for (const distribution of distributions) {
      for (const key of ["lowCents", "p25Cents", "medianCents", "p75Cents", "highCents"] as const) {
        expect(Number.isInteger(distribution[key])).toBe(true);
        expect(distribution[key]).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the public projection free of founder-only contractor intelligence", () => {
    expect(PUBLIC_ORACLE_FIXTURE.modules.some((module) => module.id === "contractor_discipline")).toBe(false);

    const serialized = JSON.stringify(PUBLIC_ORACLE_FIXTURE).toLowerCase();
    for (const forbiddenKey of ["lead_id", "quote_id", "analysis_id", "full_json", "filename", "storage_path", "homeowner_name", "contractor_name"]) {
      expect(serialized).not.toContain(forbiddenKey);
    }
  });

  it("keeps quoted, verified accepted, and verified final evidence separately addressable", () => {
    expect(INTERNAL_INTELLIGENCE_FIXTURE.quoted.sampleSize).toBe(200);
    expect(INTERNAL_INTELLIGENCE_FIXTURE.verifiedAccepted.sampleSize).toBe(68);
    expect(INTERNAL_INTELLIGENCE_FIXTURE.verifiedFinal.sampleSize).toBe(31);
    expect(INTERNAL_INTELLIGENCE_FIXTURE.evidence.outcomeKnownCount).toBeGreaterThanOrEqual(
      INTERNAL_INTELLIGENCE_FIXTURE.evidence.verifiedAcceptedCount,
    );
  });
});
