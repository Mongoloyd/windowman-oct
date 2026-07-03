import { describe, expect, it } from "vitest";
import type { AnalysisData } from "@/hooks/useAnalysisData";
import { buildFullData } from "@/hooks/useAnalysisData";
import type { RawFullRow } from "@/types/serviceResults";
import {
  computeOverpaymentRange,
  isPlaceholderCounty,
  mapAnalysisDataToForensicShellProps,
  readConfidencePercent,
  readFiniteNumber,
  readOpeningCountSource,
  readOptionalString,
  resolveCodeJurisdiction,
  resolveMarketBenchmark,
  resolveOpeningCount,
  resolvePricePerOpening,
} from "@/lib/productionV2ReportHarness";

function baseAnalysisData(overrides: Partial<AnalysisData> = {}): AnalysisData {
  return {
    analysisId: "test-analysis",
    grade: "C",
    flags: [],
    flagCount: 0,
    flagRedCount: 0,
    flagAmberCount: 0,
    contractorName: null,
    confidenceScore: 0.9,
    pillarScores: [],
    documentType: "estimate",
    pageCount: 4,
    openingCount: 14,
    lineItemCount: 3,
    qualityBand: null,
    hasWarranty: null,
    hasPermits: null,
    analysisStatus: "complete",
    warnings: [],
    missingItems: [],
    summary: null,
    topWarning: null,
    topMissingItem: null,
    pricePerOpening: null,
    pricePerOpeningBand: null,
    paymentRiskDetected: false,
    scopeGapDetected: false,
    summaryTeaser: null,
    missingItemsCount: 0,
    ...overrides,
  };
}

describe("resolveMarketBenchmark", () => {
  it("maps benchmark_price_per_opening_low/high to marketLow/marketHigh", () => {
    const result = resolveMarketBenchmark({
      benchmark_price_per_opening_low: 1700,
      benchmark_price_per_opening_high: 2400,
    });
    expect(result.marketLow).toBe(1700);
    expect(result.marketHigh).toBe(2400);
  });

  it("does not read legacy benchmark_low/high aliases", () => {
    const result = resolveMarketBenchmark({
      benchmark_low: 1700,
      benchmark_high: 2400,
    });
    expect(result.marketLow).toBeNull();
    expect(result.marketHigh).toBeNull();
  });
});

describe("computeOverpaymentRange", () => {
  it("calculates rounded overpayment from contract, openings, and benchmarks", () => {
    const result = computeOverpaymentRange(51800, 14, 1700, 2400);
    expect(result).toEqual({ overpaymentLow: 18200, overpaymentHigh: 28000 });
  });

  it("returns null when opening count is zero", () => {
    expect(computeOverpaymentRange(51800, 0, 1700, 2400)).toBeNull();
  });

  it("returns null when any input is non-finite", () => {
    expect(computeOverpaymentRange(Number.NaN, 14, 1700, 2400)).toBeNull();
    expect(computeOverpaymentRange(51800, 14, Number.NaN, 2400)).toBeNull();
  });
});

describe("resolvePricePerOpening", () => {
  it("falls back to installed_price_per_opening when analysisData.pricePerOpening is null", () => {
    const data = baseAnalysisData();
    const derivedMetrics = {
      per_opening: { installed_price_per_opening: 1375 },
      unit_pricing: { blended_avg_unit_price: 999 },
    };
    expect(resolvePricePerOpening(data, derivedMetrics)).toBe(1375);
  });

  it("does not use blended_avg_unit_price", () => {
    const data = baseAnalysisData();
    const derivedMetrics = {
      unit_pricing: { blended_avg_unit_price: 999 },
    };
    expect(resolvePricePerOpening(data, derivedMetrics)).toBeNull();
  });
});

describe("resolveOpeningCount", () => {
  it("prefers proof opening count over derived counts", () => {
    const data = baseAnalysisData({ openingCount: 14 });
    const derivedMetrics = { counts: { total_openings: 10 } };
    expect(resolveOpeningCount(data, derivedMetrics)).toBe(14);
  });

  it("falls back to derived_metrics.counts.total_openings", () => {
    const data = baseAnalysisData({ openingCount: null });
    const derivedMetrics = { counts: { total_openings: 10 } };
    expect(resolveOpeningCount(data, derivedMetrics)).toBe(10);
  });
});

describe("resolveCodeJurisdiction", () => {
  it("prefers county_benchmark.county_label", () => {
    expect(
      resolveCodeJurisdiction({ county_label: "Broward County" }, "your county"),
    ).toBe("Broward County");
  });

  it("rejects placeholder county case-insensitively", () => {
    expect(isPlaceholderCounty("your county")).toBe(true);
    expect(isPlaceholderCounty("Your County")).toBe(true);
    expect(isPlaceholderCounty(" YOUR COUNTY ")).toBe(true);
    expect(resolveCodeJurisdiction(null, "your county")).toBeNull();
  });

  it("uses non-placeholder county intake when benchmark label missing", () => {
    expect(resolveCodeJurisdiction(null, "Palm Beach County")).toBe("Palm Beach County");
  });
});

describe("mapAnalysisDataToForensicShellProps", () => {
  it("populates market range and money-at-risk when backend keys exist", () => {
    const props = mapAnalysisDataToForensicShellProps(
      baseAnalysisData({
        derivedMetrics: {
          totals: { contract_total: 51800 },
          county_benchmark: {
            county_label: "Broward County",
            benchmark_price_per_opening_low: 1700,
            benchmark_price_per_opening_high: 2400,
          },
          per_opening: { installed_price_per_opening: 1375 },
        },
      }),
      "your county",
    );

    expect(props.marketLow).toBe(1700);
    expect(props.marketHigh).toBe(2400);
    expect(props.overpaymentLow).toBe(18200);
    expect(props.overpaymentHigh).toBe(28000);
    expect(props.pricePerOpening).toBe(1375);
    expect(props.codeJurisdiction).toBe("Broward County");
  });

  it("returns null overpayment when benchmark data is missing", () => {
    const props = mapAnalysisDataToForensicShellProps(
      baseAnalysisData({
        derivedMetrics: {
          totals: { contract_total: 51800 },
        },
      }),
      "your county",
    );

    expect(props.marketLow).toBeNull();
    expect(props.overpaymentLow).toBeNull();
    expect(props.overpaymentHigh).toBeNull();
  });

  it("maps derived metadata fields when present", () => {
    const props = mapAnalysisDataToForensicShellProps(
      baseAnalysisData({
        derivedMetrics: {
          counts: { opening_count_source: "extracted_header" },
          diagnostics: { quote_math_confidence: 86.4 },
          county_benchmark: {
            source_label: "  Broward benchmark index  ",
            updated_at: " 2026-01-08 ",
          },
        },
      }),
      "your county",
    );

    expect(props.openingCountSource).toBe("extracted_header");
    expect(props.quoteMathConfidence).toBe(86);
    expect(props.benchmarkSourceLabel).toBe("Broward benchmark index");
    expect(props.benchmarkUpdatedAt).toBe("2026-01-08");
  });

  it("returns null metadata when derivedMetrics is missing", () => {
    const props = mapAnalysisDataToForensicShellProps(baseAnalysisData(), "your county");

    expect(props.openingCountSource).toBeNull();
    expect(props.quoteMathConfidence).toBeNull();
    expect(props.benchmarkSourceLabel).toBeNull();
    expect(props.benchmarkUpdatedAt).toBeNull();
  });
});

describe("readOpeningCountSource", () => {
  it('maps "extracted_header" correctly', () => {
    expect(readOpeningCountSource("extracted_header")).toBe("extracted_header");
  });

  it('maps "inferred_from_lines" correctly', () => {
    expect(readOpeningCountSource("inferred_from_lines")).toBe("inferred_from_lines");
  });

  it('maps "unknown" or invalid values to null', () => {
    expect(readOpeningCountSource("unknown")).toBeNull();
    expect(readOpeningCountSource("")).toBeNull();
    expect(readOpeningCountSource(null)).toBeNull();
    expect(readOpeningCountSource(42)).toBeNull();
  });
});

describe("readConfidencePercent", () => {
  it("clamps and rounds to 0–100", () => {
    expect(readConfidencePercent(86.4)).toBe(86);
    expect(readConfidencePercent(150)).toBe(100);
    expect(readConfidencePercent(-5)).toBe(0);
    expect(readConfidencePercent(0.86)).toBe(86);
  });

  it("returns null for missing or invalid values", () => {
    expect(readConfidencePercent(null)).toBeNull();
    expect(readConfidencePercent(Number.NaN)).toBeNull();
  });
});

describe("readOptionalString", () => {
  it("trims empty strings to null", () => {
    expect(readOptionalString("  hello  ")).toBe("hello");
    expect(readOptionalString("   ")).toBeNull();
    expect(readOptionalString("")).toBeNull();
  });
});

describe("readFiniteNumber", () => {
  it("rejects NaN and Infinity", () => {
    expect(readFiniteNumber(Number.NaN)).toBeNull();
    expect(readFiniteNumber(Number.POSITIVE_INFINITY)).toBeNull();
    expect(readFiniteNumber("not-a-number")).toBeNull();
  });
});

describe("buildFullData summaryTeaser", () => {
  it("fills summaryTeaser from full_json.summary after full unlock", () => {
    const row: RawFullRow = {
      analysis_id: "a1",
      grade: "C",
      flags: [],
      full_json: {
        summary: "Full report summary text.",
        derived_metrics: null,
      },
      proof_of_read: { opening_count: 14 },
      preview_json: { summary_teaser: "Preview teaser" },
      confidence_score: 0.9,
      document_type: "estimate",
      rubric_version: "v1",
    };

    expect(buildFullData(row).summaryTeaser).toBe("Full report summary text.");
  });

  it("falls back to full_json.top_warning then preview_json.summary_teaser", () => {
    const row: RawFullRow = {
      analysis_id: "a1",
      grade: "C",
      flags: [],
      full_json: {
        top_warning: "Critical payment risk detected.",
      },
      proof_of_read: { opening_count: 14 },
      preview_json: { summary_teaser: "Preview teaser" },
      confidence_score: 0.9,
      document_type: "estimate",
      rubric_version: "v1",
    };

    expect(buildFullData(row).summaryTeaser).toBe("Critical payment risk detected.");
  });
});
