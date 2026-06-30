import { useCallback, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { AnalysisData } from "@/hooks/useAnalysisData";
import { useV2ReportModules } from "@/hooks/useV2ReportModules";
import type { V2ReportSource } from "@/components/forensic-report/adapters/reportAccessAdapter.types";
import ChangeOrderDefenseMatrix from "@/components/forensic-report/ChangeOrderDefenseMatrix";
import CodeComplianceProofSection from "@/components/forensic-report/CodeComplianceProofSection";
import ContractorQuoteIdentityCard from "@/components/forensic-report/ContractorQuoteIdentityCard";
import FinancialIntegritySection from "@/components/forensic-report/FinancialIntegritySection";
import ForensicAuditReport from "@/components/forensic-report/ForensicAuditReport";
import { ForensicDiagnosisCtaContext } from "@/components/forensic-report/ExecutiveSummaryCard";
import NextActionCard from "@/components/forensic-report/NextActionCard";
import RevealDiagnosisBridgeCard from "@/components/forensic-report/RevealDiagnosisBridgeCard";
import RevealDiagnosisStickyCta from "@/components/forensic-report/RevealDiagnosisStickyCta";
import QuoteMathLedger from "@/components/forensic-report/QuoteMathLedger";
import ScopeGapChecklist from "@/components/forensic-report/ScopeGapChecklist";
import WarrantyFinePrintSection from "@/components/forensic-report/WarrantyFinePrintSection";
import {
  mapAnalysisDataToForensicShellProps,
  toProductionV2ModuleSource,
} from "@/lib/productionV2ReportHarness";
import {
  saveReportDiagnosisHandoff,
  type ReportDiagnosisHandoff,
} from "@/lib/reportDiagnosisHandoff";

type Props = {
  analysisData: AnalysisData | null;
  v2ReportSource: V2ReportSource | null;
  county: string;
  /** Homepage in-page flow — preferred over route param when provided. */
  scanSessionId?: string;
  /** Homepage handoff — preferred over internal route-only handler when provided. */
  onDiagnosisCta?: () => void;
};

const MAX_INSIGHT_LENGTH = 120;

function truncateInsight(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= MAX_INSIGHT_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_INSIGHT_LENGTH - 1)}…`;
}

function buildTopInsights(analysisData: AnalysisData): string[] {
  const fromFlags = analysisData.flags
    .filter((flag) => flag.severity === "red" || flag.severity === "amber")
    .map((flag) => truncateInsight(flag.label || flag.detail))
    .filter(Boolean)
    .slice(0, 3);

  if (fromFlags.length > 0) return fromFlags;

  return [analysisData.topWarning, analysisData.topMissingItem]
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => truncateInsight(item))
    .slice(0, 3);
}

function AnalysisDataUnavailablePanel() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-lg border border-amber-500/40 bg-amber-950/20 p-6 text-center">
        <p className="text-sm text-amber-200/90 leading-relaxed">
          Dark V2 analysis data unavailable after authorization. Classic fallback intentionally
          disabled for harness visibility.
        </p>
      </div>
    </div>
  );
}

function V2SourceUnavailablePanel() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-lg border border-amber-500/40 bg-amber-950/20 p-6 text-center">
        <p className="text-sm text-amber-200/90 leading-relaxed">
          Dark V2 source unavailable after authorization. Classic fallback intentionally disabled
          for harness visibility.
        </p>
      </div>
    </div>
  );
}

function buildFullEvidenceStack(
  modules: ReturnType<typeof useV2ReportModules>,
  onDiagnosisCta?: () => void,
): ReactNode {
  return (
    <>
      {modules.contractorIdentityProps ? (
        <ContractorQuoteIdentityCard {...modules.contractorIdentityProps} />
      ) : null}
      {modules.quoteMathLedgerProps ? (
        <QuoteMathLedger {...modules.quoteMathLedgerProps} />
      ) : null}
      {modules.codeComplianceProps ? (
        <CodeComplianceProofSection {...modules.codeComplianceProps} />
      ) : null}
      {modules.changeOrderDefenseProps ? (
        <ChangeOrderDefenseMatrix {...modules.changeOrderDefenseProps} />
      ) : null}
      {modules.scopeGapChecklistProps ? (
        <ScopeGapChecklist {...modules.scopeGapChecklistProps} />
      ) : null}
      {modules.financialIntegrityProps ? (
        <FinancialIntegritySection {...modules.financialIntegrityProps} />
      ) : null}
      {modules.warrantyFinePrintProps ? (
        <WarrantyFinePrintSection {...modules.warrantyFinePrintProps} />
      ) : null}
      <NextActionCard
        onPrimary={onDiagnosisCta}
        onSecondary={onDiagnosisCta}
        primaryLabel="Show My Best Next Move"
        secondaryLabel="Build My Quote Defense Plan"
      />
    </>
  );
}

export default function ReportClassicDarkV2Full({
  analysisData,
  v2ReportSource,
  county,
  scanSessionId: scanSessionIdProp,
  onDiagnosisCta: onDiagnosisCtaProp,
}: Props) {
  const navigate = useNavigate();
  const { sessionId: routeSessionId } = useParams<{ sessionId: string }>();
  const sessionId = scanSessionIdProp ?? routeSessionId;

  const moduleSource =
    analysisData && v2ReportSource
      ? toProductionV2ModuleSource(v2ReportSource, analysisData)
      : null;
  const v2Modules = useV2ReportModules(moduleSource, {
    accessLevel: "full",
    sourceMode: "live",
  });

  const handleRouteDiagnosisCta = useCallback(() => {
    if (!sessionId || !analysisData?.grade) return;

    const handoff: ReportDiagnosisHandoff = {
      lead_id: "",
      scan_session_id: sessionId,
      analysis_id: analysisData.analysisId ?? null,
      report_grade: analysisData.grade,
      first_name: null,
      phone: null,
      email: null,
      top_insights: buildTopInsights(analysisData),
      returnTo: `/report/classic/${sessionId}?renderer=v2`,
      saved_at: new Date().toISOString(),
    };

    saveReportDiagnosisHandoff(handoff);
    navigate("/diagnosis", { state: handoff });
  }, [analysisData, navigate, sessionId]);

  const handleDiagnosisCta = onDiagnosisCtaProp ?? handleRouteDiagnosisCta;
  const ctaEnabled = Boolean(onDiagnosisCtaProp);

  if (!analysisData) {
    return <AnalysisDataUnavailablePanel />;
  }

  if (!v2ReportSource) {
    return <V2SourceUnavailablePanel />;
  }

  const shellProps = mapAnalysisDataToForensicShellProps(analysisData, county);

  return (
    <ForensicDiagnosisCtaContext.Provider value={ctaEnabled ? handleDiagnosisCta : null}>
      <ForensicAuditReport
        accessLevel="full"
        analysisId={shellProps.analysisId}
        grade={shellProps.grade}
        confidenceScore={shellProps.confidenceScore}
        flagRedCount={shellProps.flagRedCount}
        flagAmberCount={shellProps.flagAmberCount}
        flagClearCount={shellProps.flagClearCount}
        overpaymentLow={shellProps.overpaymentLow}
        overpaymentHigh={shellProps.overpaymentHigh}
        pricePerOpening={shellProps.pricePerOpening}
        pricePerOpeningBand={shellProps.pricePerOpeningBand}
        marketLow={shellProps.marketLow}
        marketHigh={shellProps.marketHigh}
        totalContractPrice={shellProps.totalContractPrice}
        totalOpenings={shellProps.totalOpenings}
        flags={shellProps.flags}
        codeJurisdiction={shellProps.codeJurisdiction}
        executiveSummaryTeaser={shellProps.executiveSummaryTeaser}
        revealBridgeSlot={
          <RevealDiagnosisBridgeCard
            ctaEnabled={ctaEnabled}
            onPrimaryClick={ctaEnabled ? handleDiagnosisCta : undefined}
            onSecondaryClick={ctaEnabled ? handleDiagnosisCta : undefined}
          />
        }
        fullEvidenceStack={buildFullEvidenceStack(v2Modules, ctaEnabled ? handleDiagnosisCta : undefined)}
        suppressBuiltInNextAction={true}
      />
      <RevealDiagnosisStickyCta
        enabled={ctaEnabled}
        onClick={ctaEnabled ? handleDiagnosisCta : undefined}
      />
    </ForensicDiagnosisCtaContext.Provider>
  );
}
