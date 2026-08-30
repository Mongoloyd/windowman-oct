/**
 * DevReportPreview — Internal/admin-lab report preview surface.
 * Routes: /dev/report-preview (dev), /sandbox/report-preview (dev),
 * /visual/report-preview (visual lab, not DEV-gated), /admin/lab/report-preview (admin).
 *
 * Query params:
 *   ?v=v3            → render the ForensicAuditReport lab shell
 *   ?mode=preview    → preview-safe report-access fixture
 *   ?mode=full       → authorized full report-access fixture
 *   ?mode=unauthorized → unauthorized full envelope fixture (locked state only)
 *   ?ledger=full|partial|empty → QuoteMathLedger fixture (full + v3 only)
 *   ?matrix=high|protected|unknown → ChangeOrderDefenseMatrix fixture (full + v3 only)
 *   ?scope=protected|gaps|excluded → ScopeGapChecklist fixture (full + v3 only; default gaps)
 *   ?scenario=typical|disaster|perfect|missing-data|price-warning|long-name
 *     → sanitized preview-only Bento visual states
 *   ?source=adapter     → adapter-derived ledger, matrix, and ScopeGap props (full + v3 only)
 *   ?source=live        → staging report-access smoke test (requires scan_session_id)
 *   (no params)      → dark ForensicAuditReport v3 preview (canonical)
 *   ?v=classic       → normalized to v3 (classic white report deprecated; retained in repo only)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useLocation, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import type { SuggestedMatch } from "@/types/truthReportTypes";
import type { AnalysisFlag, PillarScore } from "@/hooks/useAnalysisData";
import ForensicAuditReport from "@/components/forensic-report/ForensicAuditReport";
import PreviewUnlockSlot from "@/components/forensic-report/PreviewUnlockSlot";
import QuoteMathLedger from "@/components/forensic-report/QuoteMathLedger";
import {
  LEDGER_FIXTURE_FULL_DETECTION,
  LEDGER_FIXTURE_PARTIAL_DETECTION,
  LEDGER_FIXTURE_EMPTY,
} from "@/components/forensic-report/QuoteMathLedger.fixtures";
import ChangeOrderDefenseMatrix from "@/components/forensic-report/ChangeOrderDefenseMatrix";
import {
  FIX_CHANGE_ORDER_HIGH_RISK,
  FIX_CHANGE_ORDER_PROTECTED_STATE,
  FIX_CHANGE_ORDER_UNKNOWN_STATE,
} from "@/components/forensic-report/ChangeOrderDefenseMatrix.fixtures";
import { MOCK_AUTHORIZED_FULL_REPORT_SOURCE } from "@/components/forensic-report/adapters/reportV2Adapter.fixtures";
import ScopeGapChecklist from "@/components/forensic-report/ScopeGapChecklist";
import {
  FIX_SCOPE_PROTECTED,
  FIX_SCOPE_GAPS,
  FIX_SCOPE_EXCLUDED,
} from "@/components/forensic-report/ScopeGapChecklist.fixtures";
import ForensicLabSectionDivider from "@/components/forensic-report/ForensicLabSectionDivider";
import ContractorQuoteIdentityCard from "@/components/forensic-report/ContractorQuoteIdentityCard";
import ContractorQuestionPacket from "@/components/forensic-report/ContractorQuestionPacket";
import NextActionCard from "@/components/forensic-report/NextActionCard";
import CodeComplianceProofSection from "@/components/forensic-report/CodeComplianceProofSection";
import FinancialIntegritySection from "@/components/forensic-report/FinancialIntegritySection";
import WarrantyFinePrintSection from "@/components/forensic-report/WarrantyFinePrintSection";
import { useV2ReportModules } from "@/hooks/useV2ReportModules";
import type { V2ReportModulesResult } from "@/hooks/useV2ReportModules";
import LabLiveReportAccessPanel, {
  LabLiveMissingSessionPanel,
  LabLiveTransportDiagnosticStrip,
  type LabLiveDiagnosticProps,
} from "@/components/forensic-report/LabLiveReportAccessPanel";
import {
  classifyFullFetchResult,
  classifyPreviewFetchResult,
  countDerivedModuleProps,
  fetchLabLiveFull,
  fetchLabLivePreview,
  isValidScanSessionId,
  mapLiveFullRowToShellProps,
  mapLivePreviewRowToShellProps,
  type LabLiveFetchMeta,
  type LabLiveFullShellProps,
  type LabLiveRequestState,
} from "@/lib/labLiveReportAccess";
import {
  computeOverpaymentRange,
  readConfidencePercent,
  readFiniteNumber,
  readOpeningCountSource,
  readOptionalString,
  readPositiveFiniteNumber,
  resolveCodeJurisdiction,
  resolveMarketBenchmark,
} from "@/lib/productionV2ReportHarness";
import OpeningMixSummary from "@/components/forensic-report/OpeningMixSummary";
import {
  mapOpeningMixFromDerivedMetrics,
  mapWindZoneFromHvhz,
} from "@/lib/mapPropertyContext";
import type { RawFullRow, RawPreviewRow } from "@/types/serviceResults";
import type { V2ReportModuleSource, V2ReportSourceMode } from "@/types/v2ReportTransport";

type LabMode = "preview" | "full" | "unauthorized";
type LabPillarStatus = "pass" | "warn" | "fail" | "pending";

interface LabPillarScore {
  status: LabPillarStatus;
  score: number;
  feedback: string[];
}

interface LabPillarScores {
  price_fairness: LabPillarScore;
  safety_code: LabPillarScore;
  install_scope: LabPillarScore;
  fine_print: LabPillarScore;
  warranty: LabPillarScore;
}

const PREVIEW_PILLAR_DEFS = [
  { key: "safety_code", label: "Safety & Code" },
  { key: "install_scope", label: "Installation Scope" },
  { key: "price_fairness", label: "Price Clarity" },
  { key: "fine_print", label: "Fine Print" },
  { key: "warranty", label: "Warranty Coverage" },
] as const;

function isLabPillarStatus(value: unknown): value is LabPillarStatus {
  return value === "pass" || value === "warn" || value === "fail" || value === "pending";
}

function mapPreviewPillarScores(scores: unknown): PillarScore[] {
  const raw =
    scores !== null && typeof scores === "object" && !Array.isArray(scores)
      ? (scores as Record<string, unknown>)
      : {};

  return PREVIEW_PILLAR_DEFS.map((definition) => {
    const entry = raw[definition.key];
    const candidate =
      entry !== null && typeof entry === "object" && !Array.isArray(entry)
        ? (entry as { status?: unknown })
        : null;
    const status = isLabPillarStatus(candidate?.status)
      ? candidate.status
      : "pending";

    return { ...definition, score: null, status };
  });
}

function readOptionalBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

interface LabPreviewJson {
  grade: string;
  flag_count: number;
  has_permits: boolean | null;
  top_warning: string;
  has_warranty: boolean | null;
  quality_band: "good" | "fair" | "poor";
  summary_teaser: string;
  hard_cap_applied: number | null;
  top_missing_item: string;
  scope_gap_detected: boolean;
  missing_items_count: number;
  opening_count_bucket: string;
  payment_risk_detected: boolean;
  price_per_opening_band: "low" | "market" | "high" | "extreme" | null;
  pillar_scores: LabPillarScores;
}

interface LabProofOfRead {
  page_count: number;
  document_type: string;
  opening_count: number;
  contractor_name: string | null;
  line_item_count: number;
}

interface LabPreviewData {
  analysis_id: string;
  grade: string;
  flag_count: number;
  flag_red_count: number;
  flag_amber_count: number;
  proof_of_read: LabProofOfRead;
  preview_json: LabPreviewJson;
  confidence_score: number;
  document_type: string;
  rubric_version: string;
}

interface LabPreviewReportAccessResponse {
  ok: true;
  mode: "preview";
  data: LabPreviewData;
}

type LabFlagSeverity = "red" | "amber";

interface LabFullFlag {
  id: string;
  severity: LabFlagSeverity;
  title?: string;
  summary?: string;
  category: string;
  evidence?: unknown;
}

interface LabLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface LabDerivedMetrics {
  totals: {
    contract_total: number;
    discount_subtotal: number;
    install_like_subtotal: number;
    accessory_subtotal: number;
  };
  unit_pricing?: {
    window_avg_unit_price: number;
    door_avg_unit_price: number;
  };
  per_opening?: {
    installed_price_per_opening: number;
    contract_price_per_opening?: number;
  };
  county_benchmark: {
    county_label: string;
    benchmark_price_per_opening_low: number;
    benchmark_price_per_opening_high: number;
    market_position?: string;
    source_label?: string;
    updated_at?: string;
  };
  counts?: {
    total_openings?: number;
    opening_count_source?: string;
    window_openings?: number;
    door_openings?: number;
  };
  diagnostics?: {
    quote_math_confidence?: number;
  };
}

interface LabFullJson {
  derived_metrics: LabDerivedMetrics;
  extraction: {
    line_items: LabLineItem[];
    hvhz_zone?: boolean | null;
  };
}

interface LabFullData {
  analysis_id: string;
  grade: string;
  flags: LabFullFlag[];
  preview_json: LabPreviewJson;
  proof_of_read: LabProofOfRead;
  full_json: LabFullJson;
  confidence_score: number;
  document_type: string;
  rubric_version: string;
}

interface LabFullReportAccessResponse {
  ok: true;
  mode: "full";
  authorized: true;
  data: LabFullData;
}

interface LabUnauthorizedFullResponse {
  ok: true;
  mode: "full";
  authorized: false;
  locked: true;
  reason: "unauthorized";
}

type LabReportAccessFixture =
  | LabPreviewReportAccessResponse
  | LabFullReportAccessResponse
  | LabUnauthorizedFullResponse;

const MOCK_CLASSIC_FLAGS: AnalysisFlag[] = [
  {
    id: 1,
    label: "Hidden Fees Not Disclosed",
    severity: "red",
    pillar: "fine_print",
    detail:
      "Your quote excludes disposal fees ($300-$500), stucco patching ($1,200-$2,400), and permit costs ($800-$1,500). That's up to $4,400 in costs you won't see until it's too late.",
    tip: null,
  },
  {
    id: 2,
    label: "No Per-Unit Line Items",
    severity: "red",
    pillar: "price_fairness",
    detail:
      "A single lump sum of $22,000 with zero per-window pricing. Without line items, there's no way to verify what you're actually paying for each opening.",
    tip: null,
  },
  {
    id: 3,
    label: "Missing Code Language",
    severity: "red",
    pillar: "safety_code",
    detail:
      "No Florida Building Code reference anywhere in the contract. In Broward County's HVHZ zone, this is a permit rejection waiting to happen.",
    tip: null,
  },
  {
    id: 4,
    label: "Warranty duration unclear",
    severity: "amber",
    pillar: "warranty",
    detail: "Warranty mentioned but no specific duration or coverage details.",
    tip: null,
  },
];

const MOCK_CLASSIC_PILLARS: PillarScore[] = [
  { key: "safety_code", label: "Safety & Code", score: 25, status: "fail" },
  { key: "install_scope", label: "Install & Scope", score: 40, status: "warn" },
  { key: "price_fairness", label: "Price Fairness", score: 55, status: "warn" },
  { key: "fine_print", label: "Fine Print", score: 30, status: "fail" },
  { key: "warranty", label: "Warranty", score: 45, status: "warn" },
];

const MOCK_MATCH: SuggestedMatch = {
  confidence: "high",
  reasons: ["county_specialist", "project_type_fit", "vetted_contractor"],
  contractor_alias: "WM-TEST01",
};

const sharedPreviewJson: LabPreviewJson = {
  grade: "F",
  flag_count: 18,
  has_permits: false,
  top_warning: "RED FLAG: No proof of impact compliance was found.",
  has_warranty: false,
  quality_band: "poor",
  summary_teaser: "No proof of impact compliance was found in the quote preview.",
  hard_cap_applied: null,
  top_missing_item: "NOA/FL product approval numbers for all windows and doors",
  scope_gap_detected: true,
  missing_items_count: 18,
  opening_count_bucket: "11-20",
  payment_risk_detected: false,
  price_per_opening_band: "low",
  pillar_scores: {
    price_fairness: {
      status: "pass",
      score: 82,
      feedback: [
        "Price appears low relative to scope, but missing compliance data reduces confidence.",
      ],
    },
    safety_code: {
      status: "fail",
      score: 34,
      feedback: ["Missing NOA/FL approval numbers.", "Missing DP ratings."],
    },
    install_scope: {
      status: "fail",
      score: 41,
      feedback: ["Install method and fastening details are not clearly specified."],
    },
    fine_print: {
      status: "fail",
      score: 29,
      feedback: ["Permit responsibility and exclusions are not clear."],
    },
    warranty: {
      status: "warn",
      score: 62,
      feedback: ["Warranty is referenced but labor and transfer terms are unclear."],
    },
  },
};

const sharedProofOfRead: LabProofOfRead = {
  page_count: 1,
  document_type: "estimate",
  opening_count: 14,
  contractor_name: "BrightView Window",
  line_item_count: 3,
};

const mockPreviewReportAccessResponse: LabPreviewReportAccessResponse = {
  ok: true,
  mode: "preview",
  data: {
    analysis_id: "mock-analysis-windowman-v2",
    grade: "F",
    flag_count: 18,
    flag_red_count: 9,
    flag_amber_count: 9,
    proof_of_read: sharedProofOfRead,
    preview_json: sharedPreviewJson,
    confidence_score: 0.9,
    document_type: "estimate",
    rubric_version: "1.6.0",
  },
};

type PreviewEdgeScenario =
  | "typical"
  | "disaster"
  | "perfect"
  | "missing-data"
  | "price-warning"
  | "long-name";

interface PreviewScenarioDefinition {
  contractorName: string | null;
  statuses: Record<keyof LabPillarScores, LabPillarStatus>;
  priceBand: LabPreviewJson["price_per_opening_band"];
  hasWarranty: boolean | null;
  hasPermits: boolean | null;
  redCount: number;
  amberCount: number;
}

const PREVIEW_EDGE_SCENARIOS: Readonly<Record<PreviewEdgeScenario, PreviewScenarioDefinition>> = {
  typical: {
    contractorName: "BrightView Window",
    statuses: {
      safety_code: "fail",
      install_scope: "pass",
      price_fairness: "warn",
      fine_print: "pass",
      warranty: "pass",
    },
    priceBand: "market",
    hasWarranty: true,
    hasPermits: true,
    redCount: 9,
    amberCount: 9,
  },
  disaster: {
    contractorName: "BrightView Window",
    statuses: {
      safety_code: "fail",
      install_scope: "fail",
      price_fairness: "warn",
      fine_print: "fail",
      warranty: "fail",
    },
    priceBand: "high",
    hasWarranty: false,
    hasPermits: false,
    redCount: 4,
    amberCount: 1,
  },
  perfect: {
    contractorName: "BrightView Window",
    statuses: {
      safety_code: "pass",
      install_scope: "pass",
      price_fairness: "pass",
      fine_print: "pass",
      warranty: "pass",
    },
    priceBand: "low",
    hasWarranty: true,
    hasPermits: true,
    redCount: 0,
    amberCount: 0,
  },
  "missing-data": {
    contractorName: null,
    statuses: {
      safety_code: "pending",
      install_scope: "pending",
      price_fairness: "pending",
      fine_print: "pending",
      warranty: "pending",
    },
    priceBand: null,
    hasWarranty: null,
    hasPermits: null,
    redCount: 0,
    amberCount: 0,
  },
  "price-warning": {
    contractorName: "BrightView Window",
    statuses: {
      safety_code: "pass",
      install_scope: "pass",
      price_fairness: "fail",
      fine_print: "pass",
      warranty: "pass",
    },
    priceBand: "high",
    hasWarranty: true,
    hasPermits: true,
    redCount: 1,
    amberCount: 0,
  },
  "long-name": {
    contractorName:
      "Southeast Florida Architectural Impact Window and Coastal Door Specialists Incorporated",
    statuses: {
      safety_code: "warn",
      install_scope: "pass",
      price_fairness: "pass",
      fine_print: "fail",
      warranty: "warn",
    },
    priceBand: "market",
    hasWarranty: true,
    hasPermits: false,
    redCount: 1,
    amberCount: 2,
  },
};

function parsePreviewEdgeScenario(value: string | null): PreviewEdgeScenario | null {
  return value != null && Object.prototype.hasOwnProperty.call(PREVIEW_EDGE_SCENARIOS, value)
    ? (value as PreviewEdgeScenario)
    : null;
}

function applyPillarStatuses(
  source: LabPillarScores,
  statuses: PreviewScenarioDefinition["statuses"],
): LabPillarScores {
  return {
    safety_code: { ...source.safety_code, status: statuses.safety_code },
    install_scope: { ...source.install_scope, status: statuses.install_scope },
    price_fairness: { ...source.price_fairness, status: statuses.price_fairness },
    fine_print: { ...source.fine_print, status: statuses.fine_print },
    warranty: { ...source.warranty, status: statuses.warranty },
  };
}

function applyPreviewEdgeScenario(
  fixture: LabPreviewReportAccessResponse,
  scenarioValue: string | null,
): LabPreviewReportAccessResponse {
  const scenarioKey = parsePreviewEdgeScenario(scenarioValue);
  if (scenarioKey == null) return fixture;

  const scenario = PREVIEW_EDGE_SCENARIOS[scenarioKey];
  const flagCount = scenario.redCount + scenario.amberCount;
  return {
    ...fixture,
    data: {
      ...fixture.data,
      flag_count: flagCount,
      flag_red_count: scenario.redCount,
      flag_amber_count: scenario.amberCount,
      proof_of_read: {
        ...fixture.data.proof_of_read,
        contractor_name: scenario.contractorName,
      },
      preview_json: {
        ...fixture.data.preview_json,
        flag_count: flagCount,
        has_warranty: scenario.hasWarranty,
        has_permits: scenario.hasPermits,
        price_per_opening_band: scenario.priceBand,
        pillar_scores: applyPillarStatuses(
          fixture.data.preview_json.pillar_scores,
          scenario.statuses,
        ),
      },
    },
  };
}

const mockFullReportAccessResponse: LabFullReportAccessResponse = {
  ok: true,
  mode: "full",
  authorized: true,
  data: {
    analysis_id: "mock-analysis-windowman-v2",
    grade: "F",
    flags: [
      {
        id: "flag-missing-dp",
        severity: "red",
        title: "Missing DP Rating",
        summary:
          "The quote does not document design pressure ratings for the proposed openings.",
        category: "Safety & Code Match",
        evidence: [
          "No DP rating found near line items.",
          "No engineering approval reference detected.",
        ],
      },
      {
        id: "flag-missing-noa",
        severity: "red",
        title: "Missing NOA Number",
        summary: "No Florida product approval or NOA numbers were found.",
        category: "Safety & Code Match",
        evidence: ["No NOA/FL approval reference found in extracted text."],
      },
      {
        id: "flag-permit-unclear",
        severity: "amber",
        title: "Permit Responsibility Unclear",
        summary: "The quote does not clearly assign permit responsibility.",
        category: "Fine Print Transparency",
        evidence: ["Permit language missing or ambiguous."],
      },
    ],
    preview_json: sharedPreviewJson,
    proof_of_read: sharedProofOfRead,
    full_json: {
      derived_metrics: {
        totals: {
          contract_total: 51800,
          discount_subtotal: 0,
          install_like_subtotal: 8500,
          accessory_subtotal: 1800,
        },
        unit_pricing: {
          window_avg_unit_price: 1250,
          door_avg_unit_price: 2200,
        },
        per_opening: {
          installed_price_per_opening: 1375,
          contract_price_per_opening: 1375,
        },
        county_benchmark: {
          county_label: "Broward County",
          market_position: "below_documented_market_range_due_to_missing_scope",
          benchmark_price_per_opening_low: 1700,
          benchmark_price_per_opening_high: 2400,
          source_label: "Broward benchmark index",
          updated_at: "2026-01-08",
        },
        counts: {
          total_openings: 14,
          window_openings: 10,
          door_openings: 4,
          opening_count_source: "extracted_header",
        },
        diagnostics: {
          quote_math_confidence: 86,
        },
      },
      extraction: {
        hvhz_zone: true,
        line_items: [
          {
            description: "Impact Window 32x54",
            quantity: 10,
            unit_price: 1250,
            total_price: 12500,
          },
          {
            description: "Impact Horizontal Roller Window",
            quantity: 4,
            unit_price: 1325,
            total_price: 5300,
          },
          {
            description: "Impact Entry Door",
            quantity: 1,
            unit_price: 2200,
            total_price: 2200,
          },
        ],
      },
    },
    confidence_score: 0.9,
    document_type: "estimate",
    rubric_version: "1.6.0",
  },
};

const mockUnauthorizedFullResponse: LabUnauthorizedFullResponse = {
  ok: true,
  mode: "full",
  authorized: false,
  locked: true,
  reason: "unauthorized",
};

function parseLabMode(modeParam: string | null): LabMode | null {
  if (modeParam === "preview" || modeParam === "full" || modeParam === "unauthorized") {
    return modeParam;
  }
  return null;
}

function isLabReportPreviewPath(pathname: string): boolean {
  return (
    pathname.startsWith("/visual/report-preview") ||
    pathname.startsWith("/sandbox/report-preview") ||
    pathname.startsWith("/dev/report-preview") ||
    pathname.includes("lab/report-preview")
  );
}

function getLabReportPreviewBase(pathname: string): string {
  if (pathname.startsWith("/visual/report-preview")) return "/visual/report-preview";
  if (pathname.startsWith("/sandbox/report-preview")) return "/sandbox/report-preview";
  if (pathname.startsWith("/dev/report-preview")) return "/dev/report-preview";
  if (pathname.includes("lab/report-preview")) {
    const idx = pathname.indexOf("lab/report-preview");
    return pathname.slice(0, idx + "lab/report-preview".length);
  }
  return pathname;
}

function normalizeLabPreviewParams(
  pathname: string,
  params: URLSearchParams,
): { redirectTo: string } | { accessMode: LabMode } {
  const base = getLabReportPreviewBase(pathname);
  const v = params.get("v");
  const validMode = parseLabMode(params.get("mode"));

  // Classic report is deprecated and retained only as rollback/dev reference. Dark forensic V3 is canonical.
  if (v === "classic") {
    return { redirectTo: `${base}?v=v3&mode=${validMode ?? "preview"}` };
  }
  if (v !== "v3") {
    return { redirectTo: `${base}?v=v3&mode=${validMode ?? "preview"}` };
  }
  if (!validMode) {
    return { redirectTo: `${base}?v=v3&mode=preview` };
  }
  return { accessMode: validMode };
}

function getLabReportFixture(mode: "preview"): LabPreviewReportAccessResponse;
function getLabReportFixture(mode: "full"): LabFullReportAccessResponse;
function getLabReportFixture(mode: "unauthorized"): LabUnauthorizedFullResponse;
function getLabReportFixture(mode: LabMode): LabReportAccessFixture {
  if (mode === "full") return mockFullReportAccessResponse;
  if (mode === "unauthorized") return mockUnauthorizedFullResponse;
  return mockPreviewReportAccessResponse;
}

function isPreviewFixture(
  fixture: LabReportAccessFixture,
): fixture is LabPreviewReportAccessResponse {
  return fixture.mode === "preview";
}

function isFullFixture(
  fixture: LabReportAccessFixture,
): fixture is LabFullReportAccessResponse {
  return fixture.mode === "full" && fixture.authorized === true;
}

function isUnauthorizedFixture(
  fixture: LabReportAccessFixture,
): fixture is LabUnauthorizedFullResponse {
  return (
    fixture.mode === "full" &&
    fixture.authorized === false &&
    fixture.locked === true &&
    fixture.reason === "unauthorized"
  );
}

function mapCategoryToPillar(category: string): AnalysisFlag["pillar"] {
  if (category === "Safety & Code Match") return "safety_code";
  if (category === "Fine Print Transparency") return "fine_print";
  if (category === "Install & Scope Clarity") return "install_scope";
  if (category === "Price Fairness") return "price_fairness";
  if (category === "Warranty Value") return "warranty";
  return null;
}

function mapFullFlagsToAnalysisFlags(flags: LabFullFlag[]): AnalysisFlag[] {
  return flags.map((flag, index) => ({
    id: index + 1,
    label: flag.title ?? `Finding ${index + 1}`,
    severity: flag.severity,
    pillar: mapCategoryToPillar(flag.category),
    detail: flag.summary ?? "No summary text provided in this lab fixture.",
    tip:
      Array.isArray(flag.evidence) &&
      flag.evidence.length > 0 &&
      flag.evidence.every((entry) => typeof entry === "string")
        ? flag.evidence.join(" ")
        : flag.summary ?? "No supporting evidence text provided in this lab fixture.",
  }));
}

function normalizeConfidenceScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value >= 0 && value <= 1) return Math.round(value * 100);
  return value;
}

function getLedgerFixture(ledgerParam: string | null) {
  if (ledgerParam === "partial") return LEDGER_FIXTURE_PARTIAL_DETECTION;
  if (ledgerParam === "empty") return LEDGER_FIXTURE_EMPTY;
  return LEDGER_FIXTURE_FULL_DETECTION;
}

function getMatrixFixture(matrixParam: string | null) {
  if (matrixParam === "protected") return FIX_CHANGE_ORDER_PROTECTED_STATE;
  if (matrixParam === "unknown") return FIX_CHANGE_ORDER_UNKNOWN_STATE;
  return FIX_CHANGE_ORDER_HIGH_RISK;
}

function getScopeFixture(scopeParam: string | null) {
  if (scopeParam === "protected") return FIX_SCOPE_PROTECTED;
  if (scopeParam === "excluded") return FIX_SCOPE_EXCLUDED;
  return FIX_SCOPE_GAPS;
}

function LabPreviewBanner({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="fixed top-0 inset-x-0 z-50 h-7 flex items-center justify-center text-[11px] font-mono uppercase tracking-wider text-amber-200 border-b border-amber-500/30 backdrop-blur bg-[#3068e8]/[0.21]"
    >
      {label}
    </div>
  );
}

const INITIAL_LIVE_FETCH_META: LabLiveFetchMeta = {
  authorized: "unknown",
  locked: "unknown",
  reason: null,
  code: null,
};

function buildFullV3EvidenceStack(
  v2Modules: V2ReportModulesResult,
  scopeAdapterNull: boolean,
) {
  return (
    <>
      {v2Modules.contractorIdentityProps ? (
        <ContractorQuoteIdentityCard {...v2Modules.contractorIdentityProps} />
      ) : null}
      <ForensicLabSectionDivider index={1} eyebrow="Evidence" label="Quote Math Ledger" />
      {v2Modules.quoteMathLedgerProps ? (
        <QuoteMathLedger {...v2Modules.quoteMathLedgerProps} suppressFooterChecklist />
      ) : null}
      <ForensicLabSectionDivider index={2} eyebrow="Evidence" label="Code & Compliance Proof" />
      {v2Modules.codeComplianceProps ? (
        <CodeComplianceProofSection {...v2Modules.codeComplianceProps} />
      ) : null}
      <ForensicLabSectionDivider index={3} eyebrow="Evidence" label="Change-Order Defense" />
      {v2Modules.changeOrderDefenseProps ? (
        <ChangeOrderDefenseMatrix {...v2Modules.changeOrderDefenseProps} suppressFooterChecklist />
      ) : null}
      <ForensicLabSectionDivider index={4} eyebrow="Evidence" label="Scope Gap Checklist" />
      {scopeAdapterNull ? (
        <section
          role="status"
          className="rounded-lg border border-amber-500/40 bg-amber-950/20 p-5 text-sm text-amber-200/90 leading-relaxed"
        >
          ScopeGap adapter returned null for this lab source. Check extraction / v2_source scope_gap
          slices — fixture ScopeGap props were not substituted.
        </section>
      ) : v2Modules.scopeGapChecklistProps ? (
        <ScopeGapChecklist {...v2Modules.scopeGapChecklistProps} suppressFooterChecklist />
      ) : null}
      <ForensicLabSectionDivider index={5} eyebrow="Evidence" label="Financial Integrity" />
      {v2Modules.financialIntegrityProps ? (
        <FinancialIntegritySection {...v2Modules.financialIntegrityProps} />
      ) : null}
      <ForensicLabSectionDivider index={6} eyebrow="Evidence" label="Warranty & Fine Print" />
      {v2Modules.warrantyFinePrintProps ? (
        <WarrantyFinePrintSection {...v2Modules.warrantyFinePrintProps} />
      ) : null}
      <ForensicLabSectionDivider eyebrow="Better Quote" label="Questions to Get a Better Quote" />
      <ContractorQuestionPacket
        changeOrderRisks={v2Modules.changeOrderDefenseProps?.risks}
        scopeGapPhases={v2Modules.scopeGapChecklistProps?.phases}
        quoteMathLineItems={v2Modules.quoteMathLedgerProps?.lineItems}
      />
      <ForensicLabSectionDivider eyebrow="Next Step" label="Recommended Action" />
      <NextActionCard />
    </>
  );
}

function composeFullEvidenceStack(
  v2Modules: V2ReportModulesResult,
  scopeAdapterNull: boolean,
  openingMix: { windows: number; doors: number; sourceLabel: "derived" } | null,
) {
  return (
    <>
      {openingMix ? (
        <OpeningMixSummary
          windows={openingMix.windows}
          doors={openingMix.doors}
          sourceLabel={openingMix.sourceLabel}
        />
      ) : null}
      {buildFullV3EvidenceStack(v2Modules, scopeAdapterNull)}
    </>
  );
}

function readHvhzZoneFromFullJson(
  fullJson: Record<string, unknown> | null | undefined,
): boolean | null | undefined {
  if (!fullJson || typeof fullJson !== "object") return undefined;
  const extraction = fullJson.extraction;
  if (!extraction || typeof extraction !== "object" || Array.isArray(extraction)) {
    return undefined;
  }
  const hvhz = (extraction as Record<string, unknown>).hvhz_zone;
  return typeof hvhz === "boolean" ? hvhz : undefined;
}

function readDerivedMetricsFromFullJson(
  fullJson: Record<string, unknown> | null | undefined,
): unknown {
  if (!fullJson || typeof fullJson !== "object") return null;
  const derivedMetrics = fullJson.derived_metrics;
  if (!derivedMetrics || typeof derivedMetrics !== "object" || Array.isArray(derivedMetrics)) {
    return null;
  }
  return derivedMetrics;
}

function LabUnauthorizedPanel() {
  const fixture = getLabReportFixture("unauthorized");
  if (!isUnauthorizedFixture(fixture)) {
    return null;
  }

  return (
    <section className="mx-auto max-w-3xl rounded-2xl border border-amber-500/40 bg-slate-950/80 p-8 text-center text-slate-100 shadow-xl">
      <p className="text-xs font-mono uppercase tracking-[0.2em] text-amber-300">
        Report Access · Locked
      </p>
      <h1 className="mt-3 text-2xl font-bold">Unauthorized Full Reveal</h1>
      <p className="mt-4 text-sm text-slate-300 leading-relaxed">
        This lab mode simulates the report-access unauthorized envelope. No full payload,
        no forensic details, and no full flags are available until server-side authorization
        succeeds.
      </p>
      <div className="mt-6 inline-flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 whitespace-normal break-words rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-2 text-xs text-slate-300">
        {`ok:${fixture.ok} mode:${fixture.mode} authorized:${fixture.authorized} locked:${fixture.locked} reason:${fixture.reason}`}
      </div>
    </section>
  );
}

export default function DevReportPreview() {
  const [params] = useSearchParams();
  const location = useLocation();
  const [introRequested, setIntroRequested] = useState(false);
  const [reportCallRequested, setReportCallRequested] = useState(false);
  const [phoneE164, setPhoneE164] = useState("");
  const [liveRequestState, setLiveRequestState] = useState<LabLiveRequestState>("idle");
  const [liveFetchMeta, setLiveFetchMeta] = useState<LabLiveFetchMeta>(INITIAL_LIVE_FETCH_META);
  const [livePreviewRow, setLivePreviewRow] = useState<RawPreviewRow | null>(null);
  const [liveFullShell, setLiveFullShell] = useState<LabLiveFullShellProps | null>(null);
  const [liveFullRow, setLiveFullRow] = useState<RawFullRow | null>(null);
  const [liveModuleSource, setLiveModuleSource] = useState<V2ReportModuleSource | null>(null);
  const liveRequestIdRef = useRef(0);

  const isVisualLabPreview = location.pathname.startsWith("/visual/report-preview");
  const isLabPreview = isLabReportPreviewPath(location.pathname);

  const isFullV3ForModules = params.get("v") === "v3";
  const parsedModeForModules = parseLabMode(params.get("mode"));
  const isLiveSource = isFullV3ForModules && params.get("source") === "live";
  const scanSessionId = params.get("scan_session_id");
  const liveMode: "preview" | "full" =
    parsedModeForModules === "full" ? "full" : "preview";
  const useAdapterSource = isFullV3ForModules && params.get("source") === "adapter";
  const moduleSourceMode: V2ReportSourceMode = isLiveSource
    ? "live"
    : useAdapterSource
      ? "adapter"
      : "fixture";

  useEffect(() => {
    if (!isLiveSource) return;

    liveRequestIdRef.current += 1;
    setLiveRequestState("idle");
    setLiveFetchMeta(INITIAL_LIVE_FETCH_META);
    setLivePreviewRow(null);
    setLiveFullShell(null);
    setLiveFullRow(null);
    setLiveModuleSource(null);
    setPhoneE164("");
  }, [isLiveSource, scanSessionId, parsedModeForModules]);

  useEffect(() => {
    if (!isLiveSource || liveMode !== "preview") return;
    if (!isValidScanSessionId(scanSessionId)) return;

    let cancelled = false;
    const requestId = ++liveRequestIdRef.current;
    setLiveRequestState("loading");
    setLivePreviewRow(null);
    setLiveModuleSource(null);

    void fetchLabLivePreview(scanSessionId).then((result) => {
      if (cancelled || requestId !== liveRequestIdRef.current) return;
      const classified = classifyPreviewFetchResult(result);
      setLiveFetchMeta(classified.meta);
      setLiveRequestState(classified.state);
      setLivePreviewRow(classified.row);
    });

    return () => {
      cancelled = true;
    };
  }, [isLiveSource, liveMode, scanSessionId]);

  const handleLiveFullFetch = useCallback(async () => {
    if (!isValidScanSessionId(scanSessionId)) return;
    const phone = phoneE164.trim();
    if (!phone) return;

    const requestId = ++liveRequestIdRef.current;
    setLiveRequestState("loading");
    setLiveModuleSource(null);
    setLiveFullShell(null);
    setLiveFullRow(null);

    const result = await fetchLabLiveFull(scanSessionId, phone);
    if (requestId !== liveRequestIdRef.current) return;

    const classified = classifyFullFetchResult(result);
    setLiveFetchMeta(classified.meta);
    setLiveRequestState(classified.state);
    setLiveModuleSource(classified.moduleSource);
    setLiveFullRow(classified.row);
    setLiveFullShell(classified.row ? mapLiveFullRowToShellProps(classified.row) : null);
  }, [scanSessionId, phoneE164]);

  const v2ModuleSource = useMemo((): V2ReportModuleSource | null => {
    if (isLiveSource) {
      return liveModuleSource;
    }

    if (!isFullV3ForModules || parsedModeForModules !== "full") {
      return null;
    }

    const data = mockFullReportAccessResponse.data;
    return {
      proof_of_read: data.proof_of_read as unknown as Record<string, unknown>,
      confidence_score: data.confidence_score,
      full_json: MOCK_AUTHORIZED_FULL_REPORT_SOURCE.full_json,
      lab_sections: MOCK_AUTHORIZED_FULL_REPORT_SOURCE.lab_sections,
      analysis_id: data.analysis_id,
      document_type: data.document_type,
      rubric_version: data.rubric_version,
    };
  }, [isLiveSource, liveModuleSource, isFullV3ForModules, parsedModeForModules]);

  const v2LabModuleOverrides = useMemo(() => {
    if (
      isLiveSource ||
      !isFullV3ForModules ||
      parsedModeForModules !== "full" ||
      moduleSourceMode !== "fixture"
    ) {
      return undefined;
    }

    return {
      quoteMathLedgerProps: getLedgerFixture(params.get("ledger")),
      changeOrderDefenseProps: getMatrixFixture(params.get("matrix")),
      scopeGapChecklistProps: getScopeFixture(params.get("scope")),
    };
  }, [isLiveSource, isFullV3ForModules, parsedModeForModules, moduleSourceMode, params]);

  const v2AccessLevel =
    isLiveSource && liveRequestState === "success-full-authorized" && liveModuleSource
      ? "full"
      : isFullV3ForModules && parsedModeForModules === "full" && !isLiveSource
        ? "full"
        : "preview";

  const v2Modules = useV2ReportModules(v2ModuleSource, {
    accessLevel: v2AccessLevel,
    sourceMode: moduleSourceMode,
    labModuleOverrides: v2LabModuleOverrides,
  });

  const liveDiagnostic = useMemo((): LabLiveDiagnosticProps => {
    return {
      mode: liveMode,
      scanSessionIdPresent: isValidScanSessionId(scanSessionId),
      requestState: liveRequestState,
      fetchMeta: liveFetchMeta,
      v2SourceVersion: liveModuleSource?.v2_source_version ?? null,
      v2SourcePresent: liveModuleSource?.v2_source != null,
      moduleSourceReady: liveModuleSource != null,
      modulePropsDerived: countDerivedModuleProps(v2Modules),
      transportPath: liveMode,
    };
  }, [
    liveMode,
    scanSessionId,
    liveRequestState,
    liveFetchMeta,
    liveModuleSource,
    v2Modules,
  ]);

  const renderLiveLabReport = () => {
    if (!isValidScanSessionId(scanSessionId)) {
      return (
        <>
          <LabLiveTransportDiagnosticStrip diagnostic={liveDiagnostic} />
          <LabLiveMissingSessionPanel />
        </>
      );
    }

    const panel = (
      <LabLiveReportAccessPanel
        mode={liveMode}
        requestState={liveRequestState}
        fetchMeta={liveFetchMeta}
        phoneValue={phoneE164}
        onPhoneChange={setPhoneE164}
        onFetchFull={() => {
          void handleLiveFullFetch();
        }}
        fetchDisabled={liveRequestState === "loading"}
        diagnostic={liveDiagnostic}
      />
    );

    if (liveMode === "preview") {
      if (liveRequestState === "success-preview" && livePreviewRow) {
        const shell = mapLivePreviewRowToShellProps(livePreviewRow);
        return (
          <>
            {panel}
            <ForensicAuditReport
              accessLevel="preview"
              analysisId={shell.analysisId}
              grade={shell.grade}
              contractorName={readOptionalString(livePreviewRow.proof_of_read?.contractor_name)}
              documentType={readOptionalString(livePreviewRow.proof_of_read?.document_type)}
              pageCount={readFiniteNumber(livePreviewRow.proof_of_read?.page_count)}
              lineItemCount={readFiniteNumber(livePreviewRow.proof_of_read?.line_item_count)}
              confidenceScore={shell.confidenceScore}
              signalsExtracted={null}
              signalsTotal={null}
              flagRedCount={shell.flagRedCount}
              flagAmberCount={shell.flagAmberCount}
              flagClearCount={shell.flagClearCount}
              overpaymentLow={null}
              overpaymentHigh={null}
              overpaymentBasis={null}
              pricePerOpening={null}
              pricePerOpeningBand={shell.pricePerOpeningBand}
              pillarScores={mapPreviewPillarScores(livePreviewRow.preview_json?.pillar_scores)}
              hasWarranty={readOptionalBoolean(livePreviewRow.preview_json?.has_warranty)}
              hasPermits={readOptionalBoolean(livePreviewRow.preview_json?.has_permits)}
              marketLow={null}
              marketHigh={null}
              totalContractPrice={null}
              totalOpenings={shell.totalOpenings}
              unlockSlot={<PreviewUnlockSlot />}
            />
          </>
        );
      }

      return panel;
    }

    if (
      liveRequestState === "success-full-authorized" &&
      liveFullShell &&
      liveModuleSource
    ) {
      const scopeAdapterNull =
        moduleSourceMode === "live" && v2Modules.scopeGapChecklistProps === null;
      const liveFullJson = liveFullRow?.full_json ?? null;
      const windZoneMapped = mapWindZoneFromHvhz(readHvhzZoneFromFullJson(liveFullJson));
      const openingMix = mapOpeningMixFromDerivedMetrics(
        readDerivedMetricsFromFullJson(liveFullJson),
      );
      const codeJurisdiction = liveFullShell.codeJurisdiction;

      return (
        <>
          {panel}
          <ForensicAuditReport
            accessLevel="full"
            analysisId={liveFullShell.analysisId}
            grade={liveFullShell.grade}
            confidenceScore={liveFullShell.confidenceScore}
            signalsExtracted={null}
            signalsTotal={null}
            flagRedCount={liveFullShell.flagRedCount}
            flagAmberCount={liveFullShell.flagAmberCount}
            flagClearCount={liveFullShell.flagClearCount}
            overpaymentLow={liveFullShell.overpaymentLow}
            overpaymentHigh={liveFullShell.overpaymentHigh}
            overpaymentBasis={null}
            pricePerOpening={liveFullShell.pricePerOpening}
            pricePerOpeningBand={liveFullShell.pricePerOpeningBand}
            marketLow={liveFullShell.marketLow}
            marketHigh={liveFullShell.marketHigh}
            totalContractPrice={liveFullShell.totalContractPrice}
            totalOpenings={liveFullShell.totalOpenings}
            flags={liveFullShell.flags}
            homeownerName={null}
            propertyAddress={null}
            propertyType={null}
            windZone={windZoneMapped?.value ?? null}
            windZoneSourceLabel={windZoneMapped ? "quote_visible" : null}
            codeJurisdiction={codeJurisdiction}
            codeJurisdictionSourceLabel={codeJurisdiction ? "benchmark_reference" : null}
            executiveSummaryTeaser={liveFullShell.executiveSummaryTeaser}
            fullEvidenceStack={composeFullEvidenceStack(v2Modules, scopeAdapterNull, openingMix)}
            suppressBuiltInNextAction
          />
        </>
      );
    }

    return panel;
  };

  const renderForensicReport = (mode: LabMode) => {
    if (mode === "unauthorized") {
      return <LabUnauthorizedPanel />;
    }

    if (mode === "preview") {
      const fixture = applyPreviewEdgeScenario(
        getLabReportFixture("preview"),
        params.get("scenario"),
      );
      if (!isPreviewFixture(fixture)) {
        return null;
      }

      const clearCount = Math.max(
        0,
        fixture.data.flag_count - fixture.data.flag_red_count - fixture.data.flag_amber_count,
      );
      const confidenceScore = normalizeConfidenceScore(fixture.data.confidence_score);
      return (
        <ForensicAuditReport
          accessLevel="preview"
          analysisId={fixture.data.analysis_id}
          grade={fixture.data.grade}
          contractorName={fixture.data.proof_of_read.contractor_name}
          documentType={fixture.data.proof_of_read.document_type}
          pageCount={fixture.data.proof_of_read.page_count}
          lineItemCount={fixture.data.proof_of_read.line_item_count}
          confidenceScore={confidenceScore}
          signalsExtracted={null}
          signalsTotal={null}
          flagRedCount={fixture.data.flag_red_count}
          flagAmberCount={fixture.data.flag_amber_count}
          flagClearCount={clearCount}
          overpaymentLow={null}
          overpaymentHigh={null}
          overpaymentBasis={null}
          pricePerOpening={null}
          pricePerOpeningBand={fixture.data.preview_json.price_per_opening_band}
          pillarScores={mapPreviewPillarScores(fixture.data.preview_json.pillar_scores)}
          hasWarranty={fixture.data.preview_json.has_warranty}
          hasPermits={fixture.data.preview_json.has_permits}
          marketLow={null}
          marketHigh={null}
          totalContractPrice={null}
          totalOpenings={fixture.data.proof_of_read.opening_count}
          unlockSlot={<PreviewUnlockSlot />}
        />
      );
    }

    const fixture = getLabReportFixture("full");
    if (!isFullFixture(fixture)) {
      return null;
    }

    const previewData = fixture.data.preview_json;
    const fullData = fixture.data.full_json;
    const proofOfRead = fixture.data.proof_of_read;
    const derivedMetrics = fullData?.derived_metrics;
    const totals = derivedMetrics?.totals;
    const countyBenchmark = derivedMetrics?.county_benchmark;
    const perOpening = derivedMetrics?.per_opening;
    const flags = Array.isArray(fixture.data.flags) ? fixture.data.flags : [];

    const redFlags = flags.filter((flag) => flag.severity === "red");
    const amberFlags = flags.filter((flag) => flag.severity === "amber");

    const clearCount = Math.max(
      0,
      previewData.flag_count - redFlags.length - amberFlags.length,
    );

    const contractTotal = readFiniteNumber(totals?.contract_total) ?? undefined;
    const { marketLow: benchmarkLow, marketHigh: benchmarkHigh } = resolveMarketBenchmark(
      countyBenchmark ?? null,
    );
    const openingCount =
      readPositiveFiniteNumber(proofOfRead?.opening_count) ?? undefined;
    const pricePerOpening =
      readFiniteNumber(perOpening?.installed_price_per_opening) ??
      readFiniteNumber(perOpening?.contract_price_per_opening) ??
      undefined;

    const overpayment =
      contractTotal != null &&
      openingCount != null &&
      benchmarkLow != null &&
      benchmarkHigh != null
        ? computeOverpaymentRange(contractTotal, openingCount, benchmarkLow, benchmarkHigh)
        : undefined;
    const confidenceScore = normalizeConfidenceScore(fixture.data.confidence_score);
    const isFullV3 = params.get("v") === "v3";
    const scopeAdapterNull = useAdapterSource && v2Modules.scopeGapChecklistProps === null;

    const windZoneMapped = mapWindZoneFromHvhz(fullData?.extraction?.hvhz_zone);
    const openingMix = mapOpeningMixFromDerivedMetrics(derivedMetrics);
    const codeJurisdiction = resolveCodeJurisdiction(countyBenchmark ?? null, "your county");

    const fullEvidenceStack = isFullV3
      ? composeFullEvidenceStack(v2Modules, scopeAdapterNull, openingMix)
      : undefined;

    const counts = derivedMetrics?.counts as Record<string, unknown> | undefined;
    const diagnostics = derivedMetrics?.diagnostics as Record<string, unknown> | undefined;

    return (
      <ForensicAuditReport
        accessLevel="full"
        analysisId={fixture.data.analysis_id}
        grade={fixture.data.grade}
        confidenceScore={confidenceScore}
        signalsExtracted={null}
        signalsTotal={null}
        flagRedCount={redFlags.length}
        flagAmberCount={amberFlags.length}
        flagClearCount={clearCount}
        overpaymentLow={overpayment?.overpaymentLow ?? undefined}
        overpaymentHigh={overpayment?.overpaymentHigh ?? undefined}
        overpaymentBasis={null}
        pricePerOpening={pricePerOpening}
        pricePerOpeningBand={previewData.price_per_opening_band}
        marketLow={benchmarkLow ?? undefined}
        marketHigh={benchmarkHigh ?? undefined}
        totalContractPrice={contractTotal}
        totalOpenings={openingCount}
        flags={mapFullFlagsToAnalysisFlags(flags)}
        homeownerName={null}
        propertyAddress={null}
        propertyType={null}
        windZone={windZoneMapped?.value ?? null}
        windZoneSourceLabel={windZoneMapped ? "quote_visible" : null}
        codeJurisdiction={codeJurisdiction}
        codeJurisdictionSourceLabel={codeJurisdiction ? "benchmark_reference" : null}
        executiveSummaryTeaser={previewData.summary_teaser}
        openingCountSource={readOpeningCountSource(counts?.opening_count_source)}
        quoteMathConfidence={readConfidencePercent(diagnostics?.quote_math_confidence)}
        benchmarkSourceLabel={readOptionalString(countyBenchmark?.source_label)}
        benchmarkUpdatedAt={readOptionalString(countyBenchmark?.updated_at)}
        fullEvidenceStack={fullEvidenceStack}
        suppressBuiltInNextAction={isFullV3}
      />
    );
  };

  if (isLabPreview) {
    const normalized = normalizeLabPreviewParams(location.pathname, params);
    if ("redirectTo" in normalized) {
      return <Navigate to={normalized.redirectTo} replace />;
    }

    if (params.get("source") === "live") {
      const liveReport = renderLiveLabReport();
      const liveBanner = isVisualLabPreview
        ? "VISUAL LAB · LIVE STAGING TRANSPORT · NOT PRODUCTION FLOW"
        : "LAB · LIVE STAGING TRANSPORT · NOT PRODUCTION FLOW";

      if (isVisualLabPreview) {
        return (
          <>
            <Helmet>
              <title>Visual Lab · Live Report Preview</title>
              <meta name="robots" content="noindex,nofollow" />
            </Helmet>
            <LabPreviewBanner label={liveBanner} />
            <div className="pt-7">{liveReport}</div>
          </>
        );
      }

      return (
        <>
          <Helmet>
            <title>Sandbox · Live Report Preview</title>
            <meta name="robots" content="noindex,nofollow" />
          </Helmet>
          <LabPreviewBanner label={liveBanner} />
          <div className="pt-7">{liveReport}</div>
        </>
      );
    }

    const report = renderForensicReport(normalized.accessMode);

    if (isVisualLabPreview) {
      return (
        <>
          <Helmet>
            <title>Visual Lab · Report Preview</title>
            <meta name="robots" content="noindex,nofollow" />
          </Helmet>
          <LabPreviewBanner label="VISUAL LAB · MOCK DATA · NOT PRODUCTION FLOW" />
          <div className="pt-7">{report}</div>
        </>
      );
    }

    return (
      <>
        <Helmet>
          <title>Sandbox · Report Preview</title>
          <meta name="robots" content="noindex,nofollow" />
        </Helmet>
        <LabPreviewBanner label="Sandbox Preview" />
        <div className="pt-7">{report}</div>
      </>
    );
  }

  // Classic report is deprecated and retained only as rollback/dev reference. Dark forensic V3 is canonical.
  if (params.get("v") === "classic") {
    const mode = parseLabMode(params.get("mode")) ?? "preview";
    return <Navigate to={`?v=v3&mode=${mode}`} replace />;
  }

  if (params.get("v") === "v3") {
    const mode = parseLabMode(params.get("mode")) ?? "preview";
    return renderForensicReport(mode);
  }

  return <Navigate to="?v=v3&mode=preview" replace />;
}
