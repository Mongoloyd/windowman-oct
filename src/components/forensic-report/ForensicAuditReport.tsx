/**
 * ForensicAuditReport — unified shell for partial + full reveal.
 *
 * One component, two modes:
 *   - accessLevel="preview" → Top Findings rendered as blurred placeholders + lock overlay.
 *     NEVER receives real flag data (orchestrator passes flags=[]).
 *   - accessLevel="full"    → All sections rendered with real data.
 *
 * Pure presentation. Does not fetch data, does not gate access (server does that).
 */
import { useMemo } from "react";
import type { AnalysisFlag } from "@/hooks/useAnalysisData";
import ReportHeader from "./ReportHeader";
import ExecutiveSummaryCard from "./ExecutiveSummaryCard";
import PartialRevealHero from "./PartialRevealHero";
import TopFindingsList from "./TopFindingsList";
import PartialUnlockOverlay from "./PartialUnlockOverlay";
import PropertyProfileCard from "./PropertyProfileCard";
import ScopeOverviewCard from "./ScopeOverviewCard";
import { FR } from "./tokens";

export interface ForensicAuditReportProps {
  accessLevel: "preview" | "full";

  // Always available
  analysisId: string | null | undefined;
  grade: string;
  confidenceScore: number | null;
  flagRedCount: number;
  flagAmberCount: number;
  flagClearCount?: number;
  signalsExtracted?: number | null;
  signalsTotal?: number | null;

  // Pricing
  overpaymentLow?: number | null;
  overpaymentHigh?: number | null;
  overpaymentBasis?: string | null;
  pricePerOpening?: number | null;
  pricePerOpeningBand?: "low" | "market" | "high" | "extreme" | null;
  marketLow?: number | null;
  marketHigh?: number | null;
  totalContractPrice?: number | null;
  totalOpenings?: number | null;

  // Full-only
  flags?: AnalysisFlag[];
  homeownerName?: string | null;
  propertyAddress?: string | null;
  propertyType?: string | null;
  windZone?: string | null;
  codeJurisdiction?: string | null;

  // Slot for the OTP gate / verify CTA — keeps gating ownership outside this shell
  unlockSlot?: React.ReactNode;
}

export default function ForensicAuditReport(props: ForensicAuditReportProps) {
  const isPreview = props.accessLevel === "preview";

  // SECURITY: Even if a real flag array is accidentally passed in preview mode,
  // we drop it here. Real flags must never reach the rendered DOM pre-OTP.
  const safeFlags = useMemo<AnalysisFlag[]>(
    () => (isPreview ? [] : props.flags ?? []),
    [isPreview, props.flags],
  );

  return (
    <div className={`report-dark min-h-screen ${FR.pagePad} py-6 sm:py-8`}>
      <div className={FR.maxWidth}>
        {/* Full-reveal keeps the report header chrome; preview leads with the hero teaser. */}
        {!isPreview && <ReportHeader analysisId={props.analysisId} />}

        <div className={`${FR.sectionGap} ${isPreview ? "" : "mt-6"}`}>
          {isPreview ? (
            <PartialRevealHero
              grade={props.grade}
              flagRedCount={props.flagRedCount}
              flagAmberCount={props.flagAmberCount}
              overpaymentLow={props.overpaymentLow}
              overpaymentHigh={props.overpaymentHigh}
              overpaymentBasis={props.overpaymentBasis}
              signalsExtracted={props.signalsExtracted}
              signalsTotal={props.signalsTotal}
            />
          ) : (
            <ExecutiveSummaryCard
              grade={props.grade}
              confidenceScore={props.confidenceScore}
              signalsExtracted={props.signalsExtracted}
              signalsTotal={props.signalsTotal}
              flagRedCount={props.flagRedCount}
              flagAmberCount={props.flagAmberCount}
              flagClearCount={props.flagClearCount}
              overpaymentLow={props.overpaymentLow}
              overpaymentHigh={props.overpaymentHigh}
              overpaymentBasis={props.overpaymentBasis}
            />
          )}

          <div className="relative">
            <TopFindingsList
              flags={safeFlags}
              blurred={isPreview}
              totalRedCount={props.flagRedCount}
            />
            {isPreview && <PartialUnlockOverlay />}
          </div>

          {!isPreview && (
            <PropertyProfileCard
              homeownerName={props.homeownerName}
              propertyAddress={props.propertyAddress}
              propertyType={props.propertyType}
              windZone={props.windZone}
              codeJurisdiction={props.codeJurisdiction}
            />
          )}

          <ScopeOverviewCard
            totalOpenings={props.totalOpenings}
            pricePerOpening={props.pricePerOpening}
            pricePerOpeningBand={props.pricePerOpeningBand}
            marketLow={props.marketLow}
            marketHigh={props.marketHigh}
            totalContractPrice={props.totalContractPrice}
          />

          {props.unlockSlot && <div className="pt-2">{props.unlockSlot}</div>}
        </div>
      </div>
    </div>
  );
}
