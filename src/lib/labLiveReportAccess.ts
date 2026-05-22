/**
 * Lab-only report-access transport helpers for DevReportPreview source=live.
 * No React, no storage, no route params, no PII logging.
 */

import { rawFullRowToV2ReportSource } from "@/components/forensic-report/adapters/reportAccessAdapter.source";
import type { AnalysisFlag } from "@/hooks/useAnalysisData";
import {
  fetchAnalysisFull,
  fetchAnalysisPreview,
} from "@/services/reportService";
import type { RawFullRow, RawPreviewRow, ServiceResult } from "@/types/serviceResults";
import type { V2ReportModuleSource } from "@/types/v2ReportTransport";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type LabLiveRequestState =
  | "idle"
  | "loading"
  | "success-preview"
  | "success-full-authorized"
  | "locked"
  | "error";

export type LabLiveFetchMeta = {
  authorized: boolean | "unknown";
  locked: boolean | "unknown";
  reason: string | null;
  code: string | null;
};

export type LabLivePreviewShellProps = {
  analysisId: string | null;
  grade: string;
  confidenceScore: number;
  flagRedCount: number;
  flagAmberCount: number;
  flagClearCount: number;
  pricePerOpeningBand: "low" | "market" | "high" | "extreme" | null;
  totalOpenings: number | null;
};

export type LabLiveFullShellProps = {
  analysisId: string | null;
  grade: string;
  confidenceScore: number;
  flagRedCount: number;
  flagAmberCount: number;
  flagClearCount: number;
  overpaymentLow: number | undefined;
  overpaymentHigh: number | undefined;
  pricePerOpening: number | undefined;
  pricePerOpeningBand: "low" | "market" | "high" | "extreme" | null;
  marketLow: number | undefined;
  marketHigh: number | undefined;
  totalContractPrice: number | undefined;
  totalOpenings: number | undefined;
  flags: AnalysisFlag[];
  codeJurisdiction: string | null;
  executiveSummaryTeaser: string | null;
};

export const LAB_LIVE_TRANSFORMER_NAME = "rawFullRowToV2ReportSource";

export function isValidScanSessionId(value: string | null): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function fetchLabLivePreview(scanSessionId: string) {
  return fetchAnalysisPreview(scanSessionId);
}

export function fetchLabLiveFull(scanSessionId: string, phoneE164: string) {
  return fetchAnalysisFull(scanSessionId, phoneE164);
}

export function rawFullRowToV2ReportModuleSource(row: RawFullRow): V2ReportModuleSource {
  const curated = rawFullRowToV2ReportSource(row);
  return {
    ...curated,
    analysis_id: row.analysis_id ?? null,
    document_type: row.document_type ?? null,
    rubric_version: row.rubric_version ?? null,
  };
}

export function classifyPreviewFetchResult(
  result: ServiceResult<RawPreviewRow | null>,
): { state: LabLiveRequestState; meta: LabLiveFetchMeta; row: RawPreviewRow | null } {
  if (!result.ok) {
    return {
      state: "error",
      meta: {
        authorized: "unknown",
        locked: "unknown",
        reason: result.message,
        code: result.code,
      },
      row: null,
    };
  }

  if (!result.data) {
    return {
      state: "error",
      meta: {
        authorized: "unknown",
        locked: "unknown",
        reason: "Preview transport returned no row.",
        code: "empty",
      },
      row: null,
    };
  }

  return {
    state: "success-preview",
    meta: {
      authorized: "unknown",
      locked: "unknown",
      reason: null,
      code: null,
    },
    row: result.data,
  };
}

export function classifyFullFetchResult(
  result: ServiceResult<RawFullRow | null>,
): {
  state: LabLiveRequestState;
  meta: LabLiveFetchMeta;
  row: RawFullRow | null;
  moduleSource: V2ReportModuleSource | null;
} {
  if (!result.ok) {
    const isUnauthorized = result.code === "unauthorized";
    return {
      state: isUnauthorized ? "locked" : "error",
      meta: {
        authorized: false,
        locked: isUnauthorized ? true : "unknown",
        reason: isUnauthorized ? "unauthorized" : result.message,
        code: result.code,
      },
      row: null,
      moduleSource: null,
    };
  }

  if (!result.data) {
    return {
      state: "error",
      meta: {
        authorized: "unknown",
        locked: "unknown",
        reason: "Full transport returned no authorized row.",
        code: "empty",
      },
      row: null,
      moduleSource: null,
    };
  }

  return {
    state: "success-full-authorized",
    meta: {
      authorized: true,
      locked: false,
      reason: null,
      code: null,
    },
    row: result.data,
    moduleSource: rawFullRowToV2ReportModuleSource(result.data),
  };
}

function normalizeConfidenceScore(value: number | null): number {
  if (value == null || !Number.isFinite(value)) return 0;
  if (value >= 0 && value <= 1) return Math.round(value * 100);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mapSeverity(value: unknown): "red" | "amber" {
  return value === "amber" ? "amber" : "red";
}

function normalizePillarKey(value: unknown): AnalysisFlag["pillar"] {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase().replace(/\s+/g, "_");
  if (normalized === "safety_code" || normalized === "safety_&_code_match") return "safety_code";
  if (normalized === "fine_print" || normalized === "fine_print_transparency") return "fine_print";
  if (normalized === "install_scope" || normalized === "install_&_scope_clarity") return "install_scope";
  if (normalized === "price_fairness") return "price_fairness";
  if (normalized === "warranty" || normalized === "warranty_value") return "warranty";
  return null;
}

function mapCategoryToPillar(category: string): AnalysisFlag["pillar"] {
  if (category === "Safety & Code Match") return "safety_code";
  if (category === "Fine Print Transparency") return "fine_print";
  if (category === "Install & Scope Clarity") return "install_scope";
  if (category === "Price Fairness") return "price_fairness";
  if (category === "Warranty Value") return "warranty";
  return null;
}

function humanize(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function mapLiveFlags(raw: unknown): AnalysisFlag[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry, index) => {
    if (!isRecord(entry)) {
      return {
        id: index + 1,
        severity: "red" as const,
        label: `Finding ${index + 1}`,
        detail: "",
        tip: null,
        pillar: null,
      };
    }

    const category = asString(entry.category) ?? "";
    const pillar =
      mapCategoryToPillar(category) ??
      normalizePillarKey(entry.pillar) ??
      null;

    return {
      id: index + 1,
      severity: mapSeverity(entry.severity),
      label: asString(entry.title) ?? asString(entry.flag) ?? humanize(asString(entry.label) ?? `Finding ${index + 1}`),
      detail: asString(entry.summary) ?? asString(entry.detail) ?? "",
      tip: asString(entry.tip),
      pillar,
    };
  });
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

function readPricePerOpeningBand(
  previewJson: Record<string, unknown> | null,
): "low" | "market" | "high" | "extreme" | null {
  const band = previewJson?.price_per_opening_band;
  if (band === "low" || band === "market" || band === "high" || band === "extreme") {
    return band;
  }
  return null;
}

export function mapLivePreviewRowToShellProps(row: RawPreviewRow): LabLivePreviewShellProps {
  const proofOfRead = isRecord(row.proof_of_read) ? row.proof_of_read : null;
  const previewJson = isRecord(row.preview_json) ? row.preview_json : null;
  const openingCount =
    proofOfRead && typeof proofOfRead.opening_count === "number"
      ? proofOfRead.opening_count
      : null;

  return {
    analysisId: row.analysis_id ?? null,
    grade: row.grade,
    confidenceScore: normalizeConfidenceScore(row.confidence_score),
    flagRedCount: row.flag_red_count ?? 0,
    flagAmberCount: row.flag_amber_count ?? 0,
    flagClearCount: Math.max(
      0,
      (row.flag_count ?? 0) - (row.flag_red_count ?? 0) - (row.flag_amber_count ?? 0),
    ),
    pricePerOpeningBand: readPricePerOpeningBand(previewJson),
    totalOpenings: openingCount,
  };
}

export function mapLiveFullRowToShellProps(row: RawFullRow): LabLiveFullShellProps {
  const proofOfRead = isRecord(row.proof_of_read) ? row.proof_of_read : null;
  const previewJson = isRecord(row.preview_json) ? row.preview_json : null;
  const fullJson = isRecord(row.full_json) ? row.full_json : null;
  const derivedMetrics = isRecord(fullJson?.derived_metrics) ? fullJson.derived_metrics : null;
  const totals = isRecord(derivedMetrics?.totals) ? derivedMetrics.totals : null;
  const unitPricing = isRecord(derivedMetrics?.unit_pricing) ? derivedMetrics.unit_pricing : null;
  const countyBenchmark = isRecord(derivedMetrics?.county_benchmark)
    ? derivedMetrics.county_benchmark
    : null;

  const flags = mapLiveFlags(row.flags);
  const redFlags = flags.filter((flag) => flag.severity === "red");
  const amberFlags = flags.filter((flag) => flag.severity === "amber");

  const contractTotal =
    totals && typeof totals.contract_total === "number" ? totals.contract_total : undefined;
  const benchmarkLow =
    countyBenchmark && typeof countyBenchmark.benchmark_low === "number"
      ? countyBenchmark.benchmark_low
      : undefined;
  const benchmarkHigh =
    countyBenchmark && typeof countyBenchmark.benchmark_high === "number"
      ? countyBenchmark.benchmark_high
      : undefined;
  const openingCount =
    proofOfRead && typeof proofOfRead.opening_count === "number"
      ? proofOfRead.opening_count
      : undefined;
  const pricePerOpening =
    unitPricing && typeof unitPricing.blended_avg_unit_price === "number"
      ? unitPricing.blended_avg_unit_price
      : undefined;

  const overpayment =
    contractTotal != null &&
    openingCount != null &&
    benchmarkLow != null &&
    benchmarkHigh != null
      ? computeOverpaymentRange(contractTotal, openingCount, benchmarkLow, benchmarkHigh)
      : undefined;

  const previewFlagCount =
    previewJson && typeof previewJson.flag_count === "number" ? previewJson.flag_count : null;

  return {
    analysisId: row.analysis_id ?? null,
    grade: row.grade,
    confidenceScore: normalizeConfidenceScore(row.confidence_score),
    flagRedCount: redFlags.length,
    flagAmberCount: amberFlags.length,
    flagClearCount: Math.max(
      0,
      (previewFlagCount ?? flags.length) - redFlags.length - amberFlags.length,
    ),
    overpaymentLow: overpayment?.overpaymentLow,
    overpaymentHigh: overpayment?.overpaymentHigh,
    pricePerOpening,
    pricePerOpeningBand: readPricePerOpeningBand(previewJson),
    marketLow: benchmarkLow,
    marketHigh: benchmarkHigh,
    totalContractPrice: contractTotal,
    totalOpenings: openingCount,
    flags,
    codeJurisdiction:
      countyBenchmark && typeof countyBenchmark.county === "string"
        ? countyBenchmark.county
        : null,
    executiveSummaryTeaser:
      previewJson && typeof previewJson.summary_teaser === "string"
        ? previewJson.summary_teaser
        : null,
  };
}

export function countDerivedModuleProps(
  modules: Record<string, unknown> | null | undefined,
): number {
  if (!modules) return 0;
  return Object.values(modules).filter((value) => value != null).length;
}
