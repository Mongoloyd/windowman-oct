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
// Legacy ReportHeader retained in repo but no longer rendered by this shell (UnlockedHeader replaces it).
import UnlockedHeader from "./UnlockedHeader";
import ExecutiveSummaryCard from "./ExecutiveSummaryCard";
import PartialRevealHero from "./PartialRevealHero";
import TopFindingsList from "./TopFindingsList";
import PartialUnlockOverlay from "./PartialUnlockOverlay";
import ExecutiveSummaryBand from "./ExecutiveSummaryBand";
import PropertyProfileCard from "./PropertyProfileCard";
import ScopeOverviewCard from "./ScopeOverviewCard";
import MoneyAtRiskCard from "./MoneyAtRiskCard";
import NextActionCard from "./NextActionCard";
import { ForensicVerdictPanel } from "@/components/forensic-report/ForensicVerdictPanel";
import { FR } from "./tokens";

function normalizeConfidencePercent(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const pct = value >= 0 && value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

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

  /** Lab full-reveal evidence modules (ledger, matrix, scope gap, etc.) */
  fullEvidenceStack?: React.ReactNode;
  /** When true, built-in NextActionCard is omitted (lab renders CTA after evidence stack) */
  suppressBuiltInNextAction?: boolean;
  /** Optional teaser copy for ExecutiveSummaryBand (e.g. preview_json.summary_teaser) */
  executiveSummaryTeaser?: string | null;
}

export default function ForensicAuditReport(props: ForensicAuditReportProps) {
  const isPreview = props.accessLevel === "preview";

  // SECURITY: Even if a real flag array is accidentally passed in preview mode,
  // we drop it here. Real flags must never reach the rendered DOM pre-OTP.
  const safeFlags = useMemo<AnalysisFlag[]>(
    () => (isPreview ? [] : props.flags ?? []),
    [isPreview, props.flags],
  );

  const displayConfidenceScore = normalizeConfidencePercent(props.confidenceScore);

  const hasOverpayment =
    (props.overpaymentLow ?? 0) > 0 || (props.overpaymentHigh ?? 0) > 0;

  return (
    <div className={`report-dark min-h-screen ${FR.pagePad} py-6 sm:py-10`}>
      <div className={FR.maxWidth}>
        {/* Full-reveal leads with the premium "Case File Unlocked" header. */}
        {isPreview ? null : (
          <UnlockedHeader analysisId={props.analysisId} />
        )}

        {!isPreview && (
          <ExecutiveSummaryBand
            accessLevel={props.accessLevel}
            flagRedCount={props.flagRedCount}
            flagAmberCount={props.flagAmberCount}
            summary={props.executiveSummaryTeaser}
          />
        )}

        <div className={`${FR.sectionGap} ${isPreview ? "" : "mt-6 sm:mt-8"}`}>
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
              confidenceScore={displayConfidenceScore}
              signalsExtracted={props.signalsExtracted}
              signalsTotal={props.signalsTotal}
              flagRedCount={props.flagRedCount}
              flagAmberCount={props.flagAmberCount}
              flagClearCount={props.flagClearCount}
              overpaymentLow={props.overpaymentLow}
              overpaymentHigh={props.overpaymentHigh}
              overpaymentBasis={props.overpaymentBasis}
              marketLow={props.marketLow}
              marketHigh={props.marketHigh}
            />
          )}

          {!isPreview && hasOverpayment && (
            <MoneyAtRiskCard
              overpaymentLow={props.overpaymentLow}
              overpaymentHigh={props.overpaymentHigh}
              overpaymentBasis={props.overpaymentBasis}
              totalContractPrice={props.totalContractPrice}
              marketLow={props.marketLow}
              marketHigh={props.marketHigh}
            />
          )}

          <ForensicVerdictPanel
            grade={props.grade}
            redCount={props.flagRedCount ?? 0}
            amberCount={props.flagAmberCount ?? 0}
          />

          <div className="relative">
            <TopFindingsList
              flags={safeFlags}
              blurred={isPreview}
              totalRedCount={props.flagRedCount}
            />
            {isPreview && <PartialUnlockOverlay />}
          </div>

          {isPreview && (
            <ExecutiveSummaryBand
              accessLevel={props.accessLevel}
              flagRedCount={props.flagRedCount}
              flagAmberCount={props.flagAmberCount}
              summary={props.executiveSummaryTeaser}
            />
          )}

          <ScopeOverviewCard
            accessLevel={props.accessLevel}
            totalOpenings={props.totalOpenings}
            pricePerOpening={props.pricePerOpening}
            pricePerOpeningBand={props.pricePerOpeningBand}
            marketLow={props.marketLow}
            marketHigh={props.marketHigh}
            totalContractPrice={props.totalContractPrice}
          />

          {!isPreview && (
            <PropertyProfileCard
              homeownerName={props.homeownerName}
              propertyAddress={props.propertyAddress}
              propertyType={props.propertyType}
              windZone={props.windZone}
              codeJurisdiction={props.codeJurisdiction}
            />
          )}

          {!isPreview && props.fullEvidenceStack ? (
            <div className="space-y-0">{props.fullEvidenceStack}</div>
          ) : null}

          {!isPreview && !props.suppressBuiltInNextAction && <NextActionCard />}

          {props.unlockSlot && <div className="pt-2">{props.unlockSlot}</div>}
        </div>

      </div>
    </div>
  );
}
