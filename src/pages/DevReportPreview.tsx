/**
 * DevReportPreview — Internal/admin-lab report preview surface.
 * Routes: /dev/report-preview (dev), /sandbox/report-preview (dev),
 * /visual/report-preview (visual lab, not DEV-gated), /admin/lab/report-preview (admin).
 *
 * Query params:
 *   ?v=v3            → render the new ForensicAuditReport shell (Phase 1)
 *   ?mode=preview    → preview/locked access level
 *   ?mode=full       → full reveal
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

const MOCK_FLAGS: AnalysisFlag[] = [
  { id: 1, label: "Hidden Fees Not Disclosed", severity: "red", pillar: "fine_print", detail: "Your quote excludes disposal fees ($300–$500), stucco patching ($1,200–$2,400), and permit costs ($800–$1,500). That's up to $4,400 in costs you won't see until it's too late.", tip: null },
  { id: 2, label: "No Per-Unit Line Items", severity: "red", pillar: "price_fairness", detail: "A single lump sum of $22,000 with zero per-window pricing. Without line items, there's no way to verify what you're actually paying for each opening.", tip: null },
  { id: 3, label: "Missing Code Language", severity: "red", pillar: "safety_code", detail: "No Florida Building Code reference anywhere in the contract. In Broward County's HVHZ zone, this is a permit rejection waiting to happen.", tip: null },
  { id: 4, label: "Warranty duration unclear", severity: "amber", pillar: "warranty", detail: "Warranty mentioned but no specific duration or coverage details.", tip: null },
];

const MOCK_PILLARS: PillarScore[] = [
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

type LabAccessMode = "preview" | "full";

function parseLabMode(modeParam: string | null): LabAccessMode | null {
  if (modeParam === "preview" || modeParam === "full") return modeParam;
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
): { redirectTo: string } | { accessMode: LabAccessMode } | { classic: true } {
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

export default function DevReportPreview() {
  const [params] = useSearchParams();
  const location = useLocation();
  const [introRequested, setIntroRequested] = useState(false);
  const [reportCallRequested, setReportCallRequested] = useState(false);

  const isVisualLabPreview = location.pathname.startsWith("/visual/report-preview");
  const isSandboxPreview = location.pathname.startsWith("/sandbox/report-preview");
  const isLabPreview = isLabReportPreviewPath(location.pathname);

  const renderForensicReport = (mode: LabAccessMode) => (
    <ForensicAuditReport
      accessLevel={mode}
      analysisId="abcd-1234-ef56-7829"
      grade="D-"
      confidenceScore={78}
      signalsExtracted={31}
      signalsTotal={37}
      flagRedCount={4}
      flagAmberCount={3}
      flagClearCount={24}
      overpaymentLow={3400}
      overpaymentHigh={4200}
      overpaymentBasis="Based on Central Florida Impact Window Index, DP 50, single-hung"
      pricePerOpening={1833}
      pricePerOpeningBand="high"
      marketLow={1120}
      marketHigh={1350}
      totalContractPrice={22000}
      totalOpenings={12}
      flags={MOCK_FLAGS}
      homeownerName="Maria Gonzalez"
      propertyAddress="4521 NW 18th Ct, Coconut Creek, FL 33073"
      propertyType="Single Family"
      windZone="HVHZ"
      codeJurisdiction="Broward County"
      unlockSlot={mode === "preview" ? <PreviewUnlockSlot /> : undefined}
    />
  );

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
              flags={MOCK_FLAGS}
              pillarScores={MOCK_PILLARS}
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

    const mode = normalized.accessMode;
    const report = renderForensicReport(mode);

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
        flags={MOCK_FLAGS}
        pillarScores={MOCK_PILLARS}
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
    const mode = params.get("mode") === "preview" ? "preview" : "full";
    return renderForensicReport(mode);
  }

  return (
    <TruthReportClassic
      grade="D"
      flags={MOCK_FLAGS}
      pillarScores={MOCK_PILLARS}
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
