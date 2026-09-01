import { describe, expect, it } from "vitest";
import { buildCallSummary, containsForbiddenLanguage } from "./callSummary";
import { evaluateOracleConfidence } from "./confidence";
import {
  evaluateQuoteEligibility,
  evaluateSoldEligibility,
} from "./eligibility";
import { broadenCohort } from "./fallback";
import {
  FIXTURE_ORACLE_CONFIDENCE_POLICY,
  SYNTHETIC_DATA_BANNER,
} from "./fixtures.testPolicy";
import {
  SYNTHETIC_ORACLE_NOW_MS,
  SYNTHETIC_ORACLE_OBSERVATIONS,
} from "./fixtures";
import { runOracleQuery } from "./queryEngine";
import {
  average,
  buildDistribution,
  median,
  percentile,
  quotedToSoldDeltaPct,
  resolveCanonicalPpo,
} from "./statistics";

describe("windowOracle statistics", () => {
  it("computes median for odd and even N; outliers do not dominate median", () => {
    expect(median([1, 2, 3])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    const withOutlier = [1500, 1700, 1850, 1950, 4000];
    expect(median(withOutlier)).toBe(1850);
    expect(average(withOutlier)).toBe(2200);
  });

  it("excludes nulls and computes percentiles deterministically", () => {
    const dist = buildDistribution([null, 100, 200, 300, undefined, 400]);
    expect(dist.sampleCount).toBe(4);
    expect(dist.min).toBe(100);
    expect(dist.max).toBe(400);
    expect(dist.median).toBe(250);
    expect(percentile([100, 200, 300, 400], 25)).toBe(175);
  });

  it("resolves canonical PPO with installed → contract precedence and sanity bound", () => {
    expect(
      resolveCanonicalPpo({ installedPpo: 1900, contractPpo: 2000 }).metric,
    ).toBe("installed_price_per_opening");
    expect(
      resolveCanonicalPpo({ installedPpo: null, contractPpo: 1800 }).ppo,
    ).toBe(1800);
    expect(
      resolveCanonicalPpo({ installedPpo: 50000, contractPpo: 1800 }).ppo,
    ).toBe(1800);
    expect(
      resolveCanonicalPpo({ installedPpo: 0, contractPpo: -1 }).ppo,
    ).toBeNull();
  });

  it("computes quoted-to-sold delta percent", () => {
    expect(quotedToSoldDeltaPct(2000, 1850)).toBe(-7.5);
  });
});

describe("windowOracle confidence", () => {
  const emptyDist = buildDistribution([]);

  it("marks thin cohorts INSUFFICIENT", () => {
    const result = evaluateOracleConfidence(
      {
        sampleCount: 3,
        distribution: buildDistribution([1000, 1100, 1200]),
        geographyLevel: "zip",
        trustedPct: 1,
        fallbackCount: 0,
        mixedProductCategories: false,
      },
      FIXTURE_ORACLE_CONFIDENCE_POLICY,
    );
    expect(result.level).toBe("INSUFFICIENT");
  });

  it("does not label 3 samples HIGH", () => {
    const result = evaluateOracleConfidence(
      {
        sampleCount: 3,
        distribution: emptyDist,
        geographyLevel: "zip",
        trustedPct: 1,
        fallbackCount: 0,
        mixedProductCategories: false,
      },
      FIXTURE_ORACLE_CONFIDENCE_POLICY,
    );
    expect(result.level).not.toBe("HIGH");
  });

  it("flags high-price outliers when average >> median", () => {
    const dist = buildDistribution([1500, 1700, 1850, 1950, 4000]);
    const result = evaluateOracleConfidence(
      {
        sampleCount: dist.sampleCount,
        distribution: dist,
        geographyLevel: "zip",
        trustedPct: 1,
        fallbackCount: 0,
        mixedProductCategories: false,
      },
      FIXTURE_ORACLE_CONFIDENCE_POLICY,
    );
    expect(result.highPriceOutliersPresent).toBe(true);
  });
});

describe("windowOracle eligibility", () => {
  it("excludes manual review, duplicate, and invalid PPO quotes", () => {
    expect(
      evaluateQuoteEligibility({
        analysisComplete: true,
        documentUsable: true,
        quoteTotal: 20000,
        openingCount: 10,
        ppo: 2000,
        hasGeography: true,
        approvedForIndex: true,
        manualReviewRequired: true,
        duplicateSuspected: false,
        anomalyStatus: "safe",
        impossibleValuesDetected: false,
      }).decision,
    ).toBe("EXCLUDE");

    expect(
      evaluateQuoteEligibility({
        analysisComplete: true,
        documentUsable: true,
        quoteTotal: 20000,
        openingCount: 10,
        ppo: 2000,
        hasGeography: true,
        approvedForIndex: true,
        manualReviewRequired: false,
        duplicateSuspected: true,
        anomalyStatus: "safe",
        impossibleValuesDetected: false,
      }).decision,
    ).toBe("EXCLUDE");

    expect(
      evaluateQuoteEligibility({
        analysisComplete: true,
        documentUsable: true,
        quoteTotal: 20000,
        openingCount: 10,
        ppo: null,
        hasGeography: true,
        approvedForIndex: true,
        manualReviewRequired: false,
        duplicateSuspected: false,
        anomalyStatus: "safe",
        impossibleValuesDetected: false,
      }).decision,
    ).toBe("EXCLUDE");
  });

  it("requires verified sold + comparable scope", () => {
    expect(
      evaluateSoldEligibility({
        outcomeVerified: false,
        finalSoldValue: 20000,
        openingCount: 10,
        soldScopeComparable: true,
        hasCanonicalProjectLink: true,
      }).decision,
    ).toBe("EXCLUDE");

    expect(
      evaluateSoldEligibility({
        outcomeVerified: true,
        finalSoldValue: 20000,
        openingCount: 10,
        soldScopeComparable: false,
        hasCanonicalProjectLink: true,
      }).decision,
    ).toBe("EXCLUDE");
  });
});

describe("windowOracle fallback", () => {
  it("records explicit ZIP → county broadening", () => {
    const plan = broadenCohort({
      pool: SYNTHETIC_ORACLE_OBSERVATIONS.filter((o) => o.provenance === "QUOTED"),
      request: {
        geography: { zip: "00022", county: "Synthetic Region C" },
        product: { brand: "PGT", series: "WinGuard", type: "single_hung", width: 36, height: 60 },
        provenance: "QUOTED",
        dateRangeMonths: 24,
      },
      minSamples: 5,
      nowMs: SYNTHETIC_ORACLE_NOW_MS,
    });

    expect(plan.exactMatchCount).toBeLessThan(5);
    expect(plan.fallbacksApplied.some((f) => f.code === "ZIP_TO_COUNTY")).toBe(
      true,
    );
    expect(plan.fallbacksApplied.length).toBeGreaterThan(0);
  });
});

describe("windowOracle queryEngine provenance", () => {
  it("never silently mixes QUOTED with VERIFIED_SOLD in primary ppo", () => {
    const quoted = runOracleQuery({
      observations: SYNTHETIC_ORACLE_OBSERVATIONS,
      request: {
        geography: { zip: "00001", county: "Synthetic Region A" },
        provenance: "QUOTED",
        dateRangeMonths: 24,
        homeownerPpo: 2710,
      },
      policy: FIXTURE_ORACLE_CONFIDENCE_POLICY,
      nowMs: SYNTHETIC_ORACLE_NOW_MS,
    });

    expect(quoted.provenance.verifiedSold).toBe(0);
    expect(quoted.sampleCount).toBe(quoted.provenance.quoted);
    expect(quoted.wording.marketScopeLabel).toContain("quoted");

    const compare = runOracleQuery({
      observations: SYNTHETIC_ORACLE_OBSERVATIONS,
      request: {
        geography: { county: "Synthetic Region A" },
        provenance: "COMPARE",
        dateRangeMonths: 24,
      },
      policy: FIXTURE_ORACLE_CONFIDENCE_POLICY,
      nowMs: SYNTHETIC_ORACLE_NOW_MS,
    });

    expect(compare.quotedPpo).not.toBeNull();
    expect(compare.verifiedSoldPpo).not.toBeNull();
    expect(compare.provenance.quoted).toBeGreaterThan(0);
    expect(compare.provenance.verifiedSold).toBeGreaterThan(0);
    // Primary remains quoted in COMPARE mode
    expect(compare.sampleCount).toBe(compare.quotedPpo!.sampleCount);
  });

  it("builds call summary with approved language only", () => {
    const result = runOracleQuery({
      observations: SYNTHETIC_ORACLE_OBSERVATIONS,
      request: {
        geography: { zip: "00001", county: "Synthetic Region A" },
        provenance: "QUOTED",
        dateRangeMonths: 24,
        homeownerPpo: 3500,
      },
      policy: FIXTURE_ORACLE_CONFIDENCE_POLICY,
      nowMs: SYNTHETIC_ORACLE_NOW_MS,
    });

    expect(result.callSummary).not.toBeNull();
    expect(result.callSummary!.scriptLines.length).toBeGreaterThan(0);
    if (result.callSummary!.approvedInterpretation) {
      expect(
        containsForbiddenLanguage(result.callSummary!.approvedInterpretation),
      ).toBe(false);
    }
  });

  it("exposes synthetic banner constant for UI", () => {
    expect(SYNTHETIC_DATA_BANNER).toContain("SYNTHETIC");
    expect(SYNTHETIC_ORACLE_OBSERVATIONS.length).toBeGreaterThanOrEqual(50);
  });
});

describe("windowOracle callSummary", () => {
  it("positions homeowner above P75", () => {
    const dist = buildDistribution([1000, 1500, 2000, 2500, 3000]);
    const confidence = evaluateOracleConfidence(
      {
        sampleCount: dist.sampleCount,
        distribution: dist,
        geographyLevel: "zip",
        trustedPct: 1,
        fallbackCount: 0,
        mixedProductCategories: false,
      },
      FIXTURE_ORACLE_CONFIDENCE_POLICY,
    );
    const summary = buildCallSummary({
      confidence,
      ppo: dist,
      homeownerPpo: 4000,
      provenanceLabel: "quoted",
    });
    expect(summary.position).toBe("ABOVE_P75");
  });
});
