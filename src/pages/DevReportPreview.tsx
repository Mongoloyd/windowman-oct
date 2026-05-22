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
 *   ?source=adapter     → adapter-derived ledger + matrix props (full + v3 only)
 *   (no params)      → legacy TruthReportClassic (rollback target)
 */

import { useState } from "react";
import { useSearchParams, useLocation, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import TruthReportClassic from "@/components/TruthReportClassic";
import type { SuggestedMatch } from "@/components/TruthReportClassic";
import type { AnalysisFlag, PillarScore } from "@/hooks/useAnalysisData";
import ForensicAuditReport from "@/components/forensic-report/ForensicAuditReport";
import PreviewUnlockSlot from "@/components/forensic-report/PreviewUnlockSlot";
import QuoteMathLedger from "@/components/forensic-report/QuoteMathLedger";
import {
  LEDGER_FIXTURE_FULL_DETECTION,
  LEDGER_FIXTURE_PARTIAL_DETECTION,
  LEDGER_FIXTURE_EMPTY,
} from "@/components/forensic-report/QuoteMathLedger.fixtures";
import type { QuoteMathLedgerProps } from "@/components/forensic-report/QuoteMathLedger.types";
import ChangeOrderDefenseMatrix from "@/components/forensic-report/ChangeOrderDefenseMatrix";
import {
  FIX_CHANGE_ORDER_HIGH_RISK,
  FIX_CHANGE_ORDER_PROTECTED_STATE,
  FIX_CHANGE_ORDER_UNKNOWN_STATE,
} from "@/components/forensic-report/ChangeOrderDefenseMatrix.fixtures";
import type { ChangeOrderDefenseMatrixProps } from "@/components/forensic-report/ChangeOrderDefenseMatrix.types";
import { mapFullReportToQuoteMathLedgerProps } from "@/components/forensic-report/adapters/quoteMathLedgerAdapter";
import { mapFullReportToChangeOrderDefenseMatrixProps } from "@/components/forensic-report/adapters/changeOrderDefenseAdapter";
import { MOCK_AUTHORIZED_FULL_REPORT_SOURCE } from "@/components/forensic-report/adapters/reportV2Adapter.fixtures";
import ScopeGapChecklist from "@/components/forensic-report/ScopeGapChecklist";
import {
  FIX_SCOPE_PROTECTED,
  FIX_SCOPE_GAPS,
  FIX_SCOPE_EXCLUDED,
} from "@/components/forensic-report/ScopeGapChecklist.fixtures";
import type { ScopeGapChecklistProps } from "@/components/forensic-report/ScopeGapChecklist.types";

type LabMode = "preview" | "full" | "unauthorized";
type LabPillarStatus = "pass" | "warn" | "fail";

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

interface LabPreviewJson {
  grade: string;
  flag_count: number;
  has_permits: boolean;
  top_warning: string;
  has_warranty: boolean;
  quality_band: "good" | "fair" | "poor";
  summary_teaser: string;
  hard_cap_applied: number | null;
  top_missing_item: string;
  scope_gap_detected: boolean;
  missing_items_count: number;
  opening_count_bucket: string;
  payment_risk_detected: boolean;
  price_per_opening_band: "low" | "market" | "high" | "extreme";
  pillar_scores: LabPillarScores;
}

interface LabProofOfRead {
  page_count: number;
  document_type: string;
  opening_count: number;
  contractor_name: string;
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
  unit_pricing: {
    window_avg_unit_price: number;
    door_avg_unit_price: number;
    blended_avg_unit_price: number;
  };
  county_benchmark: {
    county: string;
    market_position: string;
    benchmark_low: number;
    benchmark_high: number;
  };
}

interface LabFullJson {
  derived_metrics: LabDerivedMetrics;
  extraction: {
    line_items: LabLineItem[];
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
          blended_avg_unit_price: 1375,
        },
        county_benchmark: {
          county: "Broward",
          market_position: "below_documented_market_range_due_to_missing_scope",
          benchmark_low: 1700,
          benchmark_high: 2400,
        },
      },
      extraction: {
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
): { redirectTo: string } | { accessMode: LabMode } | { classic: true } {
  const base = getLabReportPreviewBase(pathname);
  const v = params.get("v");
  if (v === "classic") return { classic: true };

  const validMode = parseLabMode(params.get("mode"));
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

function computeOverpaymentRange(
  contractTotal: number,
  openingCount: number,
  benchmarkLow: number,
  benchmarkHigh: number,
): { overpaymentLow: number; overpaymentHigh: number } {
  const totalLow = openingCount * benchmarkLow;
  const totalHigh = openingCount * benchmarkHigh;
  const overpaymentLow = Math.max(0, contractTotal - totalHigh);
  const overpaymentHigh = Math.max(0, contractTotal - totalLow);
  return { overpaymentLow, overpaymentHigh };
}

function normalizeConfidenceScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value >= 0 && value <= 1) return Math.round(value * 100);
  return value;
}

function getLedgerFixture(ledgerParam: string | null): QuoteMathLedgerProps {
  if (ledgerParam === "partial") return LEDGER_FIXTURE_PARTIAL_DETECTION;
  if (ledgerParam === "empty") return LEDGER_FIXTURE_EMPTY;
  return LEDGER_FIXTURE_FULL_DETECTION;
}

function getMatrixFixture(matrixParam: string | null): ChangeOrderDefenseMatrixProps {
  if (matrixParam === "protected") return FIX_CHANGE_ORDER_PROTECTED_STATE;
  if (matrixParam === "unknown") return FIX_CHANGE_ORDER_UNKNOWN_STATE;
  return FIX_CHANGE_ORDER_HIGH_RISK;
}

function getScopeFixture(scopeParam: string | null): ScopeGapChecklistProps {
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

  const isVisualLabPreview = location.pathname.startsWith("/visual/report-preview");
  const isLabPreview = isLabReportPreviewPath(location.pathname);

  const renderForensicReport = (mode: LabMode) => {
    if (mode === "unauthorized") {
      return <LabUnauthorizedPanel />;
    }

    if (mode === "preview") {
      const fixture = getLabReportFixture("preview");
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
    const unitPricing = derivedMetrics?.unit_pricing;
    const countyBenchmark = derivedMetrics?.county_benchmark;
    const flags = Array.isArray(fixture.data.flags) ? fixture.data.flags : [];

    const redFlags = flags.filter((flag) => flag.severity === "red");
    const amberFlags = flags.filter((flag) => flag.severity === "amber");

    const clearCount = Math.max(
      0,
      previewData.flag_count - redFlags.length - amberFlags.length,
    );

    const contractTotal =
      totals && typeof totals.contract_total === "number"
        ? totals.contract_total
        : undefined;
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
        ? computeOverpaymentRange(
            contractTotal,
            openingCount,
            benchmarkLow,
            benchmarkHigh,
          )
        : undefined;
    const confidenceScore = normalizeConfidenceScore(fixture.data.confidence_score);
    const isFullV3 = params.get("v") === "v3";
    const useAdapterSource = isFullV3 && params.get("source") === "adapter";

    let ledgerProps: QuoteMathLedgerProps;
    let matrixProps: ChangeOrderDefenseMatrixProps;
    const scopeProps = getScopeFixture(params.get("scope"));

    if (useAdapterSource) {
      ledgerProps =
        mapFullReportToQuoteMathLedgerProps(MOCK_AUTHORIZED_FULL_REPORT_SOURCE) ??
        LEDGER_FIXTURE_EMPTY;
      matrixProps =
        mapFullReportToChangeOrderDefenseMatrixProps(MOCK_AUTHORIZED_FULL_REPORT_SOURCE) ??
        FIX_CHANGE_ORDER_UNKNOWN_STATE;
    } else {
      ledgerProps = getLedgerFixture(params.get("ledger"));
      matrixProps = getMatrixFixture(params.get("matrix"));
    }

    return (
      <>
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
          overpaymentLow={overpayment?.overpaymentLow}
          overpaymentHigh={overpayment?.overpaymentHigh}
          overpaymentBasis={null}
          pricePerOpening={pricePerOpening}
          pricePerOpeningBand={previewData.price_per_opening_band}
          marketLow={benchmarkLow}
          marketHigh={benchmarkHigh}
          totalContractPrice={contractTotal}
          totalOpenings={openingCount}
          flags={mapFullFlagsToAnalysisFlags(flags)}
          homeownerName={null}
          propertyAddress={null}
          propertyType={null}
          windZone={null}
          codeJurisdiction={
            countyBenchmark && typeof countyBenchmark.county === "string"
              ? countyBenchmark.county
              : null
          }
        />
        {isFullV3 ? (
          <>
            <div
              className="my-8 border-t border-[hsl(var(--fr-border))]"
              role="separator"
              aria-hidden
            />
            <QuoteMathLedger {...ledgerProps} />
            <div
              className="mt-8 border-t border-[hsl(var(--fr-border))]"
              role="separator"
              aria-hidden
            />
            <ChangeOrderDefenseMatrix {...matrixProps} />
            <div
              className="mt-8 border-t border-[hsl(var(--fr-border))]"
              role="separator"
              aria-hidden
            />
            <ScopeGapChecklist {...scopeProps} />
          </>
        ) : null}
      </>
    );
  };

  if (isLabPreview) {
    const normalized = normalizeLabPreviewParams(location.pathname, params);
    if ("redirectTo" in normalized) {
      return <Navigate to={normalized.redirectTo} replace />;
    }

    if ("classic" in normalized) {
      return (
        <>
          <Helmet>
            <title>Lab · Report Preview (Classic)</title>
            <meta name="robots" content="noindex,nofollow" />
          </Helmet>
          <LabPreviewBanner label="LAB PREVIEW · CLASSIC ROLLBACK" />
          <div className="pt-7">
            <TruthReportClassic
              grade="D"
              flags={MOCK_CLASSIC_FLAGS}
              pillarScores={MOCK_CLASSIC_PILLARS}
              contractorName="Sample Contractor LLC"
              county="Broward"
              confidenceScore={82}
              documentType="contractor_quote"
              accessLevel="full"
              qualityBand="poor"
              hasWarranty={true}
              hasPermits={false}
              pageCount={3}
              lineItemCount={8}
              flagCount={5}
              flagRedCount={3}
              flagAmberCount={2}
              onContractorMatchClick={() => setIntroRequested(true)}
              onReportHelpCall={() => setReportCallRequested(true)}
              onSecondScan={() => window.location.assign("/")}
              introRequested={introRequested}
              reportCallRequested={reportCallRequested}
              suggestedMatch={introRequested ? MOCK_MATCH : null}
            />
          </div>
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

  if (params.get("v") === "classic") {
    return (
      <TruthReportClassic
        grade="D"
        flags={MOCK_CLASSIC_FLAGS}
        pillarScores={MOCK_CLASSIC_PILLARS}
        contractorName="Sample Contractor LLC"
        county="Broward"
        confidenceScore={82}
        documentType="contractor_quote"
        accessLevel="full"
        qualityBand="poor"
        hasWarranty={true}
        hasPermits={false}
        pageCount={3}
        lineItemCount={8}
        flagCount={5}
        flagRedCount={3}
        flagAmberCount={2}
        onContractorMatchClick={() => setIntroRequested(true)}
        onReportHelpCall={() => setReportCallRequested(true)}
        onSecondScan={() => window.location.assign("/")}
        introRequested={introRequested}
        reportCallRequested={reportCallRequested}
        suggestedMatch={introRequested ? MOCK_MATCH : null}
      />
    );
  }

  if (params.get("v") === "v3") {
    const mode = parseLabMode(params.get("mode")) ?? "preview";
    return renderForensicReport(mode);
  }

  return (
    <TruthReportClassic
      grade="D"
      flags={MOCK_CLASSIC_FLAGS}
      pillarScores={MOCK_CLASSIC_PILLARS}
      contractorName="Sample Contractor LLC"
      county="Broward"
      confidenceScore={82}
      documentType="contractor_quote"
      accessLevel="full"
      qualityBand="poor"
      hasWarranty={true}
      hasPermits={false}
      pageCount={3}
      lineItemCount={8}
      flagCount={5}
      flagRedCount={3}
      flagAmberCount={2}
      onContractorMatchClick={() => setIntroRequested(true)}
      onReportHelpCall={() => setReportCallRequested(true)}
      onSecondScan={() => window.location.assign("/")}
      introRequested={introRequested}
      reportCallRequested={reportCallRequested}
      suggestedMatch={introRequested ? MOCK_MATCH : null}
    />
  );
}
