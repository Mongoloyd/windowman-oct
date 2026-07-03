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
  | "openingCountSource"
  | "quoteMathConfidence"
  | "benchmarkSourceLabel"
  | "benchmarkUpdatedAt"
>;

const OPENING_COUNT_SOURCES = new Set(["extracted_header", "inferred_from_lines"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeConfidencePercent(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const pct = value >= 0 && value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

/** Trim non-empty string or null. */
export function readOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Allowed opening-count provenance values only. */
export function readOpeningCountSource(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return OPENING_COUNT_SOURCES.has(normalized) ? normalized : null;
}

/** Clamp confidence to 0–100 integer (supports 0–1 fractional input). */
export function readConfidencePercent(value: unknown): number | null {
  const num = readFiniteNumber(value);
  return normalizeConfidencePercent(num);
}

/** Strict finite numeric read — rejects NaN, Infinity, and non-numeric strings. */
export function readFiniteNumber(value: unknown): number | null {
  if (value == null) return null;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  return num;
}

/** Positive finite count — used for opening counts where zero/negative is invalid. */
export function readPositiveFiniteNumber(value: unknown): number | null {
  const num = readFiniteNumber(value);
  if (num === null || num <= 0) return null;
  return num;
}

export function isPlaceholderCounty(county: string): boolean {
  return county.trim().toLowerCase() === "your county";
}

export function resolveOpeningCount(
  analysisData: AnalysisData,
  derivedMetrics: Record<string, unknown> | null,
): number | null {
  const fromProof = readPositiveFiniteNumber(analysisData.openingCount);
  if (fromProof !== null) return fromProof;

  const counts =
    derivedMetrics && isRecord(derivedMetrics.counts) ? derivedMetrics.counts : null;
  return readPositiveFiniteNumber(counts?.total_openings);
}

export function resolveMarketBenchmark(countyBenchmark: Record<string, unknown> | null): {
  marketLow: number | null;
  marketHigh: number | null;
} {
  if (!countyBenchmark) return { marketLow: null, marketHigh: null };
  return {
    marketLow: readFiniteNumber(countyBenchmark.benchmark_price_per_opening_low),
    marketHigh: readFiniteNumber(countyBenchmark.benchmark_price_per_opening_high),
  };
}

export function resolvePricePerOpening(
  analysisData: AnalysisData,
  derivedMetrics: Record<string, unknown> | null,
): number | null {
  const primary = readFiniteNumber(analysisData.pricePerOpening);
  if (primary !== null) return primary;

  const perOpening =
    derivedMetrics && isRecord(derivedMetrics.per_opening) ? derivedMetrics.per_opening : null;
  const installed = readFiniteNumber(perOpening?.installed_price_per_opening);
  if (installed !== null) return installed;

  const contract = readFiniteNumber(perOpening?.contract_price_per_opening);
  if (contract !== null) return contract;

  return null;
}

export function resolveCodeJurisdiction(
  countyBenchmark: Record<string, unknown> | null,
  county: string,
): string | null {
  const label =
    countyBenchmark && typeof countyBenchmark.county_label === "string"
      ? countyBenchmark.county_label.trim()
      : null;
  if (label) return label;

  const trimmedCounty = county.trim();
  if (trimmedCounty && !isPlaceholderCounty(trimmedCounty)) {
    return trimmedCounty;
  }

  return null;
}

export function computeOverpaymentRange(
  contractTotal: number,
  openingCount: number,
  marketLow: number,
  marketHigh: number,
): { overpaymentLow: number; overpaymentHigh: number } | null {
  const contract = readFiniteNumber(contractTotal);
  const openings = readPositiveFiniteNumber(openingCount);
  const low = readFiniteNumber(marketLow);
  const high = readFiniteNumber(marketHigh);
  if (contract === null || openings === null || low === null || high === null) {
    return null;
  }

  return {
    overpaymentLow: Math.round(Math.max(0, contract - openings * high)),
    overpaymentHigh: Math.round(Math.max(0, contract - openings * low)),
  };
}

export function toProductionV2ModuleSource(
  v2ReportSource: V2ReportSource,
  analysisData: AnalysisData,
): V2ReportModuleSource {
  const rawConfidence = v2ReportSource.confidence_score ?? analysisData.confidenceScore;
  return {
    ...v2ReportSource,
    analysis_id: analysisData.analysisId,
    document_type: analysisData.documentType,
    rubric_version: null,
    confidence_score: normalizeConfidencePercent(rawConfidence),
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
  const counts = derivedMetrics && isRecord(derivedMetrics.counts) ? derivedMetrics.counts : null;
  const diagnostics =
    derivedMetrics && isRecord(derivedMetrics.diagnostics) ? derivedMetrics.diagnostics : null;
  const countyBenchmark =
    derivedMetrics && isRecord(derivedMetrics.county_benchmark)
      ? derivedMetrics.county_benchmark
      : null;

  const contractTotal = readFiniteNumber(totals?.contract_total);
  const { marketLow, marketHigh } = resolveMarketBenchmark(countyBenchmark);
  const openingCount = resolveOpeningCount(analysisData, derivedMetrics);
  const pricePerOpening = resolvePricePerOpening(analysisData, derivedMetrics);

  const overpayment =
    contractTotal !== null && openingCount !== null && marketLow !== null && marketHigh !== null
      ? computeOverpaymentRange(contractTotal, openingCount, marketLow, marketHigh)
      : null;

  const codeJurisdiction = resolveCodeJurisdiction(countyBenchmark, county);

  const flagClearCount = Math.max(
    0,
    analysisData.flagCount - analysisData.flagRedCount - analysisData.flagAmberCount,
  );

  const hasPositiveOverpayment =
    overpayment != null &&
    (overpayment.overpaymentLow > 0 || overpayment.overpaymentHigh > 0);

  return {
    analysisId: analysisData.analysisId,
    grade: analysisData.grade,
    confidenceScore: normalizeConfidencePercent(analysisData.confidenceScore),
    flagRedCount: analysisData.flagRedCount,
    flagAmberCount: analysisData.flagAmberCount,
    flagClearCount,
    overpaymentLow: hasPositiveOverpayment ? overpayment!.overpaymentLow : null,
    overpaymentHigh: hasPositiveOverpayment ? overpayment!.overpaymentHigh : null,
    pricePerOpening,
    pricePerOpeningBand: analysisData.pricePerOpeningBand,
    marketLow,
    marketHigh,
    totalContractPrice: contractTotal,
    totalOpenings: openingCount,
    flags: analysisData.flags,
    codeJurisdiction,
    executiveSummaryTeaser: analysisData.summaryTeaser ?? null,
    openingCountSource: readOpeningCountSource(counts?.opening_count_source),
    quoteMathConfidence: readConfidencePercent(diagnostics?.quote_math_confidence),
    benchmarkSourceLabel: readOptionalString(countyBenchmark?.source_label),
    benchmarkUpdatedAt: readOptionalString(countyBenchmark?.updated_at),
  };
}
