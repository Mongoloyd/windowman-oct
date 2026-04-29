/**
 * DevReportPreview — Internal/admin-lab report preview surface.
 * Routes: /dev/report-preview in development, /admin/lab/report-preview behind AdminAuthGate.
 *
 * Renders TruthReportClassic with hardcoded mock data including post-click match card state.
 * No OTP, no upload, no Supabase calls needed.
 */

import { useState } from "react";
import TruthReportClassic from "@/components/TruthReportClassic";
import type { SuggestedMatch } from "@/components/TruthReportClassic";
import type { AnalysisFlag, PillarScore } from "@/hooks/useAnalysisData";

const MOCK_FLAGS: AnalysisFlag[] = [
  { id: 1, label: "Missing NOA documentation", severity: "red", pillar: "safety_code", detail: "No Florida product approval or NOA numbers listed for any windows.", tip: null },
  { id: 2, label: "No cancellation clause", severity: "red", pillar: "fine_print", detail: "Contract has no cancellation or rescission language.", tip: null },
  { id: 3, label: "Vague disposal terms", severity: "red", pillar: "install_scope", detail: "No mention of debris removal or old window disposal.", tip: null },
  { id: 4, label: "Warranty duration unclear", severity: "amber", pillar: "warranty", detail: "Warranty mentioned but no specific duration or coverage details.", tip: null },
  { id: 5, label: "Per-unit pricing not itemized", severity: "amber", pillar: "price_fairness", detail: "Total price given but no per-opening breakdown.", tip: null },
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

export default function DevReportPreview() {
  const [introRequested, setIntroRequested] = useState(false);
  const [reportCallRequested, setReportCallRequested] = useState(false);

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
