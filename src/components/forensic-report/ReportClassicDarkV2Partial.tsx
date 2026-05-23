import type { AnalysisData } from "@/hooks/useAnalysisData";
import type { LockedOverlayProps } from "@/components/LockedOverlay";
import ForensicAuditReport from "@/components/forensic-report/ForensicAuditReport";
import ForensicUnlockSlot from "@/components/forensic-report/ForensicUnlockSlot";

type ReportClassicDarkV2PartialProps = {
  analysisData: AnalysisData;
  county: string;
  gateProps?: Omit<LockedOverlayProps, "grade" | "flagCount">;
};

export default function ReportClassicDarkV2Partial({
  analysisData,
  gateProps,
}: ReportClassicDarkV2PartialProps) {
  const flagClearCount = Math.max(
    0,
    (analysisData.flagCount ?? 0) -
      (analysisData.flagRedCount ?? 0) -
      (analysisData.flagAmberCount ?? 0),
  );

  const issueCount = (analysisData.flagRedCount ?? 0) + (analysisData.flagAmberCount ?? 0);

  return (
    <ForensicAuditReport
      accessLevel="preview"
      analysisId={analysisData.analysisId}
      grade={analysisData.grade}
      confidenceScore={analysisData.confidenceScore ?? null}
      flagRedCount={analysisData.flagRedCount ?? 0}
      flagAmberCount={analysisData.flagAmberCount ?? 0}
      flagClearCount={flagClearCount}
      totalOpenings={analysisData.openingCount ?? null}
      pricePerOpeningBand={analysisData.pricePerOpeningBand ?? null}
      executiveSummaryTeaser={analysisData.summaryTeaser ?? null}
      overpaymentLow={null}
      overpaymentHigh={null}
      overpaymentBasis={null}
      pricePerOpening={null}
      marketLow={null}
      marketHigh={null}
      totalContractPrice={null}
      signalsExtracted={null}
      signalsTotal={null}
      unlockSlot={
        gateProps ? (
          <div id="otp-gate" className="scroll-mt-24">
            <ForensicUnlockSlot
              grade={analysisData.grade}
              flagCount={issueCount}
              {...gateProps}
            />
          </div>
        ) : null
      }
    />
  );
}
