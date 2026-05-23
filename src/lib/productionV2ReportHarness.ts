import type { ForensicAuditReportProps } from "@/components/forensic-report/ForensicAuditReport";
import type { V2ReportSource } from "@/components/forensic-report/adapters/reportAccessAdapter.types";
import type { AnalysisData } from "@/hooks/useAnalysisData";
import type { V2ReportModuleSource } from "@/types/v2ReportTransport";

export type ProductionForensicShellProps = Pick<
  ForensicAuditReportProps,
  | "analysisId"
  | "grade"
  | "confidenceScore"
  | "flagRedCount"
  | "flagAmberCount"
  | "flagClearCount"
  | "overpaymentLow"
  | "overpaymentHigh"
  | "pricePerOpening"
  | "pricePerOpeningBand"
  | "marketLow"
  | "marketHigh"
  | "totalContractPrice"
  | "totalOpenings"
  | "flags"
  | "codeJurisdiction"
  | "executiveSummaryTeaser"
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function computeOverpaymentRange(
  contractTotal: number,
  openingCount: number,
  benchmarkLow: number,
  benchmarkHigh: number,
): { overpaymentLow: number; overpaymentHigh: number } {
  const totalLow = openingCount * benchmarkLow;
  const totalHigh = openingCount * benchmarkHigh;
  return {
    overpaymentLow: Math.max(0, contractTotal - totalHigh),
    overpaymentHigh: Math.max(0, contractTotal - totalLow),
  };
}

export function toProductionV2ModuleSource(
  v2ReportSource: V2ReportSource,
  analysisData: AnalysisData,
): V2ReportModuleSource {
  return {
    ...v2ReportSource,
    analysis_id: analysisData.analysisId,
    document_type: analysisData.documentType,
    rubric_version: null,
  };
}

export function mapAnalysisDataToForensicShellProps(
  analysisData: AnalysisData,
  county: string,
): ProductionForensicShellProps {
  const derivedMetrics = isRecord(analysisData.derivedMetrics)
    ? analysisData.derivedMetrics
    : null;
  const totals = derivedMetrics && isRecord(derivedMetrics.totals) ? derivedMetrics.totals : null;
  const unitPricing =
    derivedMetrics && isRecord(derivedMetrics.unit_pricing) ? derivedMetrics.unit_pricing : null;
  const countyBenchmark =
    derivedMetrics && isRecord(derivedMetrics.county_benchmark)
      ? derivedMetrics.county_benchmark
      : null;

  const contractTotal =
    totals && typeof totals.contract_total === "number" ? totals.contract_total : null;
  const benchmarkLow =
    countyBenchmark && typeof countyBenchmark.benchmark_low === "number"
      ? countyBenchmark.benchmark_low
      : null;
  const benchmarkHigh =
    countyBenchmark && typeof countyBenchmark.benchmark_high === "number"
      ? countyBenchmark.benchmark_high
      : null;
  const openingCount = analysisData.openingCount;
  const pricePerOpening =
    analysisData.pricePerOpening ??
    (unitPricing && typeof unitPricing.blended_avg_unit_price === "number"
      ? unitPricing.blended_avg_unit_price
      : null);

  const overpayment =
    contractTotal != null &&
    openingCount != null &&
    benchmarkLow != null &&
    benchmarkHigh != null
      ? computeOverpaymentRange(contractTotal, openingCount, benchmarkLow, benchmarkHigh)
      : null;

  const benchmarkCounty =
    countyBenchmark && typeof countyBenchmark.county === "string"
      ? countyBenchmark.county
      : null;
  const codeJurisdiction =
    benchmarkCounty ?? (county !== "Your County" ? county : null);

  const flagClearCount = Math.max(
    0,
    analysisData.flagCount - analysisData.flagRedCount - analysisData.flagAmberCount,
  );

  return {
    analysisId: analysisData.analysisId,
    grade: analysisData.grade,
    confidenceScore: analysisData.confidenceScore,
    flagRedCount: analysisData.flagRedCount,
    flagAmberCount: analysisData.flagAmberCount,
    flagClearCount,
    overpaymentLow: overpayment?.overpaymentLow ?? null,
    overpaymentHigh: overpayment?.overpaymentHigh ?? null,
    pricePerOpening,
    pricePerOpeningBand: analysisData.pricePerOpeningBand,
    marketLow: benchmarkLow,
    marketHigh: benchmarkHigh,
    totalContractPrice: contractTotal,
    totalOpenings: openingCount,
    flags: analysisData.flags,
    codeJurisdiction,
    executiveSummaryTeaser: analysisData.summaryTeaser ?? null,
  };
}
