import type { AnalysisData } from "@/hooks/useAnalysisData";
import { useV2ReportModules } from "@/hooks/useV2ReportModules";
import type { V2ReportSource } from "@/components/forensic-report/adapters/reportAccessAdapter.types";
import ChangeOrderDefenseMatrix from "@/components/forensic-report/ChangeOrderDefenseMatrix";
import CodeComplianceProofSection from "@/components/forensic-report/CodeComplianceProofSection";
import ContractorQuoteIdentityCard from "@/components/forensic-report/ContractorQuoteIdentityCard";
import FinancialIntegritySection from "@/components/forensic-report/FinancialIntegritySection";
import ForensicAuditReport from "@/components/forensic-report/ForensicAuditReport";
import NextActionCard from "@/components/forensic-report/NextActionCard";
import QuoteMathLedger from "@/components/forensic-report/QuoteMathLedger";
import ScopeGapChecklist from "@/components/forensic-report/ScopeGapChecklist";
import WarrantyFinePrintSection from "@/components/forensic-report/WarrantyFinePrintSection";
import {
  mapAnalysisDataToForensicShellProps,
  toProductionV2ModuleSource,
} from "@/lib/productionV2ReportHarness";
import type { ReactNode } from "react";

type Props = {
  analysisData: AnalysisData | null;
  v2ReportSource: V2ReportSource | null;
  county: string;
};

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
      <NextActionCard />
    </>
  );
}

export default function ReportClassicDarkV2Full({
  analysisData,
  v2ReportSource,
  county,
}: Props) {
  const moduleSource =
    analysisData && v2ReportSource
      ? toProductionV2ModuleSource(v2ReportSource, analysisData)
      : null;
  const v2Modules = useV2ReportModules(moduleSource, {
    accessLevel: "full",
    sourceMode: "live",
  });

  if (!analysisData) {
    return <AnalysisDataUnavailablePanel />;
  }

  if (!v2ReportSource) {
    return <V2SourceUnavailablePanel />;
  }

  const shellProps = mapAnalysisDataToForensicShellProps(analysisData, county);

  return (
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
      fullEvidenceStack={buildFullEvidenceStack(v2Modules)}
      suppressBuiltInNextAction={true}
    />
  );
}
