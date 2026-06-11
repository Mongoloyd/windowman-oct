import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import ForensicPillarSection from "@/components/report/ForensicPillarSection";
import RiskSummaryHeader from "@/components/report/RiskSummaryHeader";
import ExecutiveSummaryStrip from "@/components/report/ExecutiveSummaryStrip";
import RedFlagsList from "@/components/report/RedFlagsList";
import MissingItemsList from "@/components/report/MissingItemsList";
import TopRisksBlock from "@/components/report/TopRisksBlock";
import ReportDecisionFork from "@/components/report/ReportDecisionFork";
import GapFixModule from "@/components/report/GapFixModule";
import GreenChecklistModule from "@/components/report/GreenChecklistModule";
import QuotePriceMath from "@/components/report/QuotePriceMath";
import type { DerivedMetrics } from "@/components/report/QuotePriceMath";
import { LockedOverlay } from "@/components/LockedOverlay";
import type { LockedOverlayProps } from "@/components/LockedOverlay";
import TopViolationSummaryStrip from "@/components/TopViolationSummaryStrip";
import CriticalFlagCard from "@/components/CriticalFlagCard";
import windowmanMascot from "@/assets/windowman-mascot-pointing-up.avif";
import { selectTopViolation } from "@/utils/selectTopViolation";
import { mapFlagToExhibit } from "@/utils/evidenceMapping";
import { resolveEffectiveSeverity } from "@/utils/resolveEffectiveSeverity";
import type { AnalysisFlag, PillarScore } from "@/hooks/useAnalysisData";
import type { MatchConfidence } from "@/shared/matchReasons";

export interface SuggestedMatch {
  confidence: MatchConfidence;
  reasons: string[];
  contractor_alias: string;
}

interface TruthReportProps {
  grade: string;
  flags: AnalysisFlag[];
  pillarScores: PillarScore[];
  contractorName: string | null;
  county: string;
  confidenceScore: number | null;
  documentType: string | null;
  accessLevel: "preview" | "full";
  qualityBand?: "good" | "fair" | "poor" | null;
  hasWarranty?: boolean | null;
  hasPermits?: boolean | null;
  pageCount?: number | null;
  lineItemCount?: number | null;
  flagCount?: number;
  flagRedCount?: number;
  flagAmberCount?: number;
  onContractorMatchClick: () => void;
  onStartDiagnosisFlow?: (source: "local_heroes" | "second_quote") => void;
  onReportHelpCall: () => void;
  onSecondScan: () => void;
  gateProps?: Omit<LockedOverlayProps, "grade" | "flagCount">;
  /** CTA post-click state — managed by smart container */
  introRequested?: boolean;
  reportCallRequested?: boolean;
  isCtaLoading?: boolean;
  suggestedMatch?: SuggestedMatch | null;
  derivedMetrics?: DerivedMetrics;
  priceFairness?: string | null;
  markupEstimate?: string | null;
  negotiationLeverage?: string | null;
  warnings?: (string | Record<string, unknown>)[];
  missingItems?: (string | Record<string, unknown>)[];
  summary?: string | null;
  topWarning?: string | null;
  topMissingItem?: string | null;
  pricePerOpening?: number | null;
  pricePerOpeningBand?: "low" | "market" | "high" | "extreme" | null;
  paymentRiskDetected?: boolean;
  scopeGapDetected?: boolean;
  summaryTeaser?: string | null;
  missingItemsCount?: number;
  /** Shared CTA wording. Authoritative primary + sticky mirror use this exact string. */
  ctaLabel?: string;
}

const gradeConfig: Record<string, { color: string; bg: string; glow: string; label: string; verdict: string }> = {
  A: {
    color: "hsl(var(--color-emerald))",
    bg: "hsl(var(--color-emerald) / 0.12)",
    glow: "hsl(var(--color-emerald) / 0.1)",
    label: "STRONG QUOTE",
    verdict: "This quote is well-structured and competitively priced.",
  },
  B: {
    color: "hsl(var(--color-lime))",
    bg: "hsl(var(--color-lime) / 0.12)",
    glow: "hsl(var(--color-lime) / 0.1)",
    label: "ACCEPTABLE",
    verdict: "This quote is acceptable with minor items worth addressing.",
  },
  C: {
    color: "hsl(var(--color-caution))",
    bg: "hsl(var(--color-caution) / 0.12)",
    glow: "hsl(var(--color-caution) / 0.1)",
    label: "REVIEW BEFORE SIGNING",
    verdict: "This quote has issues that could cost you money.",
  },
  D: {
    color: "hsl(var(--color-danger))",
    bg: "hsl(var(--color-danger) / 0.12)",
    glow: "hsl(var(--color-danger) / 0.1)",
    label: "SIGNIFICANT PROBLEMS",
    verdict: "Do Not Sign Without Renegotiating These Issues.",
  },
  F: {
    color: "hsl(var(--color-danger))",
    bg: "hsl(var(--color-danger) / 0.12)",
    glow: "hsl(var(--color-danger) / 0.1)",
    label: "CRITICAL ISSUES",
    verdict: "This quote has critical problems. You are likely being significantly overcharged.",
  },
};

// pillarIcons moved to ForensicPillarSection

const statusConfig = {
  pass: {
    color: "hsl(var(--color-emerald))",
    bg: "hsl(var(--color-emerald) / 0.12)",
    border: "hsl(var(--color-emerald) / 0.3)",
    label: "PASS",
  },
  warn: {
    color: "hsl(var(--color-caution))",
    bg: "hsl(var(--color-caution) / 0.12)",
    border: "hsl(var(--color-caution) / 0.3)",
    label: "REVIEW",
  },
  fail: {
    color: "hsl(var(--color-danger))",
    bg: "hsl(var(--color-danger) / 0.12)",
    border: "hsl(var(--color-danger) / 0.3)",
    label: "FAIL",
  },
  pending: {
    color: "hsl(var(--muted-foreground))",
    bg: "hsl(var(--secondary))",
    border: "hsl(var(--border))",
    label: "PENDING",
  },
};

const severityStyles = {
  red: {
    border: "1.5px solid hsl(var(--color-danger) / 0.3)",
    borderLeft: "4px solid hsl(var(--color-danger))",
    badgeBg: "hsl(var(--color-danger) / 0.12)",
    badgeColor: "hsl(var(--color-danger))",
    badgeText: "⚠ CRITICAL",
    tipBg: "hsl(var(--color-caution) / 0.08)",
  },
  amber: {
    border: "1.5px solid hsl(var(--color-caution) / 0.3)",
    borderLeft: "4px solid hsl(var(--color-caution))",
    badgeBg: "hsl(var(--color-caution) / 0.12)",
    badgeColor: "hsl(var(--color-caution))",
    badgeText: "⚡ REVIEW",
    tipBg: "hsl(var(--color-caution) / 0.08)",
  },
  green: {
    border: "1.5px solid hsl(var(--color-emerald) / 0.3)",
    borderLeft: "4px solid hsl(var(--color-emerald))",
    badgeBg: "hsl(var(--color-emerald) / 0.12)",
    badgeColor: "hsl(var(--color-emerald))",
    badgeText: "✓ CONFIRMED",
    tipBg: "",
  },
};

const stagger = (i: number) =>
  ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: i * 0.04, duration: 0.15, ease: "easeInOut" as const },
  }) as const;

import { ForensicVerdictPanel } from "@/components/forensic-report/ForensicVerdictPanel";

const TruthReportClassic = ({
  grade,
  flags,
  pillarScores,
  contractorName,
  county,
  confidenceScore,
  documentType,
  accessLevel,
  qualityBand,
  hasWarranty,
  hasPermits,
  pageCount,
  lineItemCount,
  flagCount: flagCountProp,
  flagRedCount: flagRedCountProp,
  flagAmberCount: flagAmberCountProp,
  onContractorMatchClick,
  onStartDiagnosisFlow,
  gateProps,
  introRequested = false,
  isCtaLoading = false,
  derivedMetrics,
  priceFairness,
  markupEstimate,
  negotiationLeverage,
  warnings,
  missingItems,
  summary,
  topWarning,
  topMissingItem,
  pricePerOpening,
  pricePerOpeningBand,
  paymentRiskDetected,
  scopeGapDetected,
  summaryTeaser,
  missingItemsCount,
}: TruthReportProps) => {
  const config = gradeConfig[grade] || gradeConfig.C;
  const isFull = accessLevel === "full";
  const [copied, setCopied] = useState(false);
  const [expandedFlags, setExpandedFlags] = useState<Set<number>>(new Set());
  const [activeModule, setActiveModule] = useState<"none" | "gapFix" | "greenChecklist">("none");
  const copyTimeoutRef = useRef<number | null>(null);

  // In full mode, derive from actual flags array using effective severity.
  // In preview mode, flags is [] — use aggregate props from backend.
  const flagsDerivedRed = flags.filter((f) => resolveEffectiveSeverity(f) === "red").length;
  const flagsDerivedAmber = flags.filter((f) => resolveEffectiveSeverity(f) === "amber").length;
  const flagsDerivedGreen = flags.filter((f) => resolveEffectiveSeverity(f) === "green").length;

  // Preview mode: ALWAYS use aggregate props — flags array is intentionally empty
  const redCount = isFull ? flagsDerivedRed : (flagRedCountProp ?? 0);
  const amberCount = isFull ? flagsDerivedAmber : (flagAmberCountProp ?? 0);
  const totalFlagCount = isFull ? flags.length : (flagCountProp ?? 0);
  const greenCount = isFull ? flagsDerivedGreen : Math.max(0, totalFlagCount - redCount - amberCount);
  const issueCount = redCount + amberCount;

  const summaryParts = [
    redCount > 0 ? `${redCount} critical` : null,
    amberCount > 0 ? `${amberCount} review` : null,
    greenCount > 0 ? `${greenCount} clear` : null,
  ].filter(Boolean);

  const summaryText = summaryParts.length > 0 ? summaryParts.join(", ") : "no issues";

  const displayName = contractorName || "Your Contractor";

  const toggleFlag = (id: number) => {
    setExpandedFlags((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const redFlags = flags.filter((f) => resolveEffectiveSeverity(f) === "red");
  const amberFlags = flags.filter((f) => resolveEffectiveSeverity(f) === "amber");

  const scriptText = `Hi ${displayName},

I've had a chance to review your quote in more detail and I have a few questions before I can move forward.

${redFlags.map((f, i) => `${i + 1}. Regarding "${f.label}" — ${f.detail}`).join("\n\n")}

${amberFlags.length > 0 ? `I also have ${amberFlags.length} additional item${amberFlags.length !== 1 ? "s" : ""} I'd like to discuss before finalizing.` : ""}

I'm ready to move forward if we can get these items addressed. What's the fastest way to get a revised quote?`;

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptText);
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }
    setCopied(true);
    copyTimeoutRef.current = window.setTimeout(() => setCopied(false), 2500);
  };

  useEffect(
    () => () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    },
    [],
  );

  const reportDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="bg-background min-h-screen">
      {/* ─── REPORT HEADER ─── */}
      <section className="bg-background border-b border-border py-6 px-4 md:px-8">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full" style={{ background: "hsl(var(--color-emerald))" }} />
              <span className="wm-eyebrow" style={{ color: "hsl(var(--color-emerald))" }}>
                ANALYSIS COMPLETE
              </span>
            </div>
            <h1
              className="font-display text-foreground"
              style={{ fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2 }}
            >
              WindowMan Truth Report™
            </h1>
            <p className="font-body text-muted-foreground mt-1" style={{ fontSize: 14 }}>
              {county} County · {reportDate} · {documentType ? humanizeDocType(documentType) : "Quote Document"}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {isFull && confidenceScore != null && confidenceScore >= 40 && (
              <div className="text-right hidden md:block">
                <p className="font-mono text-muted-foreground" style={{ fontSize: 10, letterSpacing: "0.08em" }}>
                  CONFIDENCE
                </p>
                <p
                  className="font-mono"
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: confidenceScore >= 70 ? "hsl(var(--color-emerald))" : "hsl(var(--color-caution))",
                  }}
                >
                  {Math.round(confidenceScore)}%
                </p>
              </div>
            )}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.15, ease: "easeInOut" as const }}
              className="flex items-center justify-center bg-background"
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                border: `4px solid ${config.color}`,
                boxShadow: `0 0 0 6px ${config.glow}`,
              }}
            >
              <span
                className="font-display"
                style={{ fontSize: 48, fontWeight: 900, color: config.color, lineHeight: 1 }}
              >
                {grade}
              </span>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── GRADE VERDICT ─── */}
      <motion.section
        {...stagger(0)}
        style={{ background: config.bg, borderBottom: `2px solid ${config.color}` }}
        className="py-5 px-4 md:px-8"
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="flex items-center gap-3">
              <span
                className="font-mono card-raised"
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: config.color,
                  letterSpacing: "0.06em",
                  padding: "4px 14px",
                  border: `1px solid ${config.color}`,
                }}
              >
                GRADE {grade} — {config.label}
              </span>
            </div>
            <p className="font-body text-foreground/90 capitalize" style={{ fontSize: 16 }}>
              {config.verdict}
            </p>
          </div>

          {/* Summary chips — preview mode, no misleading green chips */}
          {!isFull && (
            <div className="flex flex-wrap gap-2 mt-3">
              {/* qualityBand, hasWarranty, hasPermits chips removed —
                  they created false confidence and duplicated findings */}
            </div>
          )}
        </div>
      </motion.section>

      {/* ─── EXECUTIVE SUMMARY (full mode) ─── */}
      {isFull && (
        <ExecutiveSummaryStrip
          summary={summary}
          pricePerOpening={pricePerOpening}
          pricePerOpeningBand={pricePerOpeningBand}
        />
      )}

      {/* ─── LOCKED PREVIEW TEASER (preview mode) ─── */}
      {!isFull && (topWarning || topMissingItem || summaryTeaser) && (
        <div className="card-raised py-4 px-4 md:px-8 border-b border-border">
          <div className="max-w-4xl mx-auto">
            <span className="wm-eyebrow" style={{ color: "hsl(var(--color-caution))" }}>
              LOCKED PREVIEW
            </span>
            <p className="font-body text-foreground" style={{ fontSize: 15, lineHeight: 1.7, marginTop: 6 }}>
              {summaryTeaser || topWarning || "We found several quote issues worth reviewing."}
            </p>
            <p
              className="font-mono text-muted-foreground"
              style={{ fontSize: 12, marginTop: 6, letterSpacing: "0.04em" }}
            >
              {missingItemsCount ?? 0} missing contract item{(missingItemsCount ?? 0) !== 1 ? "s" : ""} detected
              {topMissingItem ? ` · Example: ${topMissingItem}` : ""}
            </p>
          </div>
        </div>
      )}

      {/* ─── RISK SUMMARY HEADER ─── */}
      <RiskSummaryHeader
        flags={flags}
        flagRedCount={flagRedCountProp}
        flagAmberCount={flagAmberCountProp}
        accessLevel={accessLevel}
      />

      <ForensicVerdictPanel
        grade={grade}
        redCount={redCount}
        amberCount={amberCount}
        variant="classic"
      />

      {/* ─── TOP RISKS (full mode only) ───
          Highest-priority interpretation, immediately under the verdict.
          Punchy proof and the authoritative CTA Strip follow below. */}
      {isFull && (
        <TopRisksBlock
          flags={flags}
          pillarScores={pillarScores}
          missingItems={missingItems}
        />
      )}

      {/* ─── FINANCIAL FORENSICS (full only) — punchy proof BEFORE the CTA ───
          Asymmetric md:5-col grid: lead card spans 3, supporting stack spans 2.
          One coherent proof unit — no billboard text, no slab + weak side notes. */}
      {isFull && (priceFairness || markupEstimate || negotiationLeverage) && (
        <section className="py-6 md:py-7 px-4 md:px-8 bg-background border-b border-border">
          <div className="max-w-3xl mx-auto">
            <motion.div {...stagger(2.5)} className="mb-3">
              <span className="wm-eyebrow" style={{ color: "hsl(var(--color-gold-accent))" }}>
                FINANCIAL FORENSICS
              </span>
              <h2 className="font-display text-foreground text-xl md:text-2xl font-semibold mt-1">
                What You're Really Paying
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 md:gap-4">
              {markupEstimate && (
                <motion.div
                  {...stagger(2.6)}
                  className="md:col-span-3 rounded-[var(--radius-card)] border border-border bg-card p-5 md:p-6"
                  style={{ borderLeft: "3px solid hsl(var(--color-danger))" }}
                >
                  <p
                    className="font-mono text-xs font-bold uppercase"
                    style={{ color: "hsl(var(--color-danger))", letterSpacing: "0.08em" }}
                  >
                    Estimated Markup
                  </p>
                  <p className="font-display text-foreground tabular-nums text-3xl md:text-[28px] font-bold tracking-tight leading-none mt-2 mb-2">
                    {markupEstimate}
                  </p>
                  <p className="font-body text-foreground text-sm font-medium leading-snug">
                    Over Standard Florida Wholesale + Labor Baseline
                  </p>
                </motion.div>
              )}

              {(priceFairness || negotiationLeverage) && (
                <div className="md:col-span-2 flex flex-col gap-3">
                  {priceFairness && (
                    <motion.div
                      {...stagger(2.7)}
                      className="rounded-[var(--radius-card)] border border-border bg-card p-4"
                      style={{ borderLeft: "3px solid hsl(var(--color-caution))" }}
                    >
                      <p
                        className="font-mono text-xs font-bold uppercase mb-1.5"
                        style={{ color: "hsl(var(--color-caution))", letterSpacing: "0.08em" }}
                      >
                        Price Fairness
                      </p>
                      <p className="font-body text-foreground text-sm leading-snug line-clamp-3">
                        {priceFairness}
                      </p>
                    </motion.div>
                  )}

                  {negotiationLeverage && (
                    <motion.div
                      {...stagger(2.8)}
                      className="rounded-[var(--radius-card)] border border-border bg-card p-4"
                      style={{ borderLeft: "3px solid hsl(var(--color-cyan))" }}
                    >
                      <p
                        className="font-mono text-xs font-bold uppercase mb-1.5"
                        style={{ color: "hsl(var(--color-cyan))", letterSpacing: "0.08em" }}
                      >
                        Your Leverage
                      </p>
                      <p
                        className="font-body text-foreground text-sm leading-snug line-clamp-3"
                        style={{ whiteSpace: "pre-line" }}
                      >
                        {negotiationLeverage}
                      </p>
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ─── FULL REPORT DECISION FORK ─── */}
      {isFull && (
        <div className="relative">
          <ReportDecisionFork
            grade={grade}
            redCount={redCount}
            amberCount={amberCount}
            flags={flags}
            pricePerOpeningBand={pricePerOpeningBand}
            onContractorMatchClick={onContractorMatchClick}
            onStartDiagnosisFlow={onStartDiagnosisFlow}
            isCtaLoading={isCtaLoading}
            introRequested={introRequested}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 hidden translate-y-full lg:block" aria-hidden="true">
            <div className="mx-auto flex max-w-4xl">
              <div className="flex w-1/2 justify-center">
                <img
                  src={windowmanMascot}
                  alt=""
                  className="h-auto max-w-full object-contain lg:w-[210px] xl:w-[240px]"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── PROOF-OF-READ TRUST STRIP (preview only) ─── */}
      {!isFull && (pageCount != null || lineItemCount != null || contractorName) && (
        <motion.section {...stagger(0.5)} className="card-raised py-3 px-4 md:px-8 border-b border-border">
          <div className="max-w-4xl mx-auto flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="wm-eyebrow text-primary">DOCUMENT VERIFIED</span>
            {pageCount != null && pageCount > 1 && (
              <span className="font-sans text-muted-foreground" style={{ fontSize: 13, fontWeight: 500 }}>
                Multi-Page Document Analyzed
              </span>
            )}
            {lineItemCount != null && lineItemCount > 0 && (
              <span className="font-sans text-muted-foreground" style={{ fontSize: 13, fontWeight: 500 }}>
                · Detailed Line Items Detected
              </span>
            )}
            {contractorName && (
              <span className="font-sans text-muted-foreground" style={{ fontSize: 13, fontWeight: 500 }}>
                · Contractor Identified
              </span>
            )}
            {confidenceScore != null && confidenceScore >= 55 && (
              <span
                className="font-mono"
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  marginLeft: "auto",
                  color: "hsl(var(--color-emerald))",
                  background: "hsl(var(--color-emerald) / 0.12)",
                  padding: "2px 10px",
                  letterSpacing: "0.06em",
                }}
              >
                READ QUALITY: {confidenceScore >= 90 ? "EXCELLENT" : confidenceScore >= 70 ? "GOOD" : "FAIR"}
              </span>
            )}
          </div>
        </motion.section>
      )}

      {/* ─── TOP VIOLATION SUMMARY STRIP (preview only — avoid chip+card duplication) ─── */}
      {!isFull &&
        (() => {
          const topViolation = selectTopViolation(flags, grade);
          if (!topViolation) return null;
          return (
            <section className="py-4 px-4 md:px-12 bg-background">
              <div className="max-w-4xl mx-auto">
                <TopViolationSummaryStrip
                  title={topViolation.title}
                  consequence={topViolation.consequence}
                  impactLabel={topViolation.impactLabel}
                  severity={topViolation.severity}
                  locked={!isFull}
                />
              </div>
            </section>
          );
        })()}

      {/* ─── 5-PILLAR ANALYSIS (preview only — full mode renders this lower, below findings) ─── */}
      {!isFull && (
        <ForensicPillarSection pillarScores={pillarScores} flags={flags} county={county} isFull={isFull} />
      )}

      {/* ─── (Financial Forensics + Quote Price Math + Red Flags + Missing Items + WhatToDoNow + Pillar Section
          all render AFTER the Forensic Findings accordion below — see the section starting at id="forensic-findings".) ─── */}

      <section
        id="forensic-findings"
        className={`scroll-mt-20 px-4 md:px-14 bg-background border-b border-border ${
          isFull ? "pt-8 pb-10 md:pt-10 md:pb-14 lg:pt-56" : "py-10 md:py-14"
        }`}
      >
        <div className="max-w-4xl mx-auto">
          {isFull && (
            <div className="mb-6 flex justify-center lg:hidden">
              <img
                src={windowmanMascot}
                alt="WindowMan mascot pointing toward the recommended action"
                className="mx-auto h-auto max-w-full object-contain w-[min(72vw,220px)]"
                loading="lazy"
              />
            </div>
          )}
          <motion.div {...stagger(3)}>
            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6">
              <div>
                <span className="wm-eyebrow" style={{ color: "hsl(var(--color-danger))" }}>
                  FORENSIC FINDINGS
                </span>
                <h2 className="wm-title-section text-foreground" style={{ marginTop: 4 }}>
                  {issueCount === 0 && !isFull
                    ? "Findings Pending"
                    : `${issueCount} Forensic Finding${issueCount !== 1 ? "s" : ""}`}
                </h2>
                <p className="font-body text-muted-foreground" style={{ fontSize: 18 }}>
                  {redCount} critical · {amberCount} review{greenCount > 0 ? ` · ${greenCount} clear` : ""}
                </p>
              </div>
              <div
                className="hidden md:block"
                style={{
                  background: "hsl(var(--color-cyan) / 0.12)",
                  border: "1px solid hsl(var(--color-cyan))",
                  borderRadius: "var(--radius-btn)",
                  padding: "6px 12px",
                }}
              >
                <span
                  className="font-mono"
                  style={{ fontSize: 12, color: "hsl(var(--color-cyan))", letterSpacing: "0.08em" }}
                >
                  {county.toUpperCase()} COUNTY BENCHMARKS
                </span>
              </div>
            </div>
          </motion.div>

          {isFull ? (
            <div className="flex flex-col gap-3">
              {/* ── CRITICAL FLAG CARDS (max 2) ── */}
              {(() => {
                const MAX_CRITICAL = 2;
                const criticals = flags
                  .filter((f) => resolveEffectiveSeverity(f) === "red")
                  .map((f) => ({ flag: f, exhibit: mapFlagToExhibit(f) }))
                  .filter((c) => c.exhibit && c.exhibit.hasHardEvidence)
                  .slice(0, MAX_CRITICAL);

                if (criticals.length === 0) return null;
                return (
                  <div className="flex flex-col gap-3 mb-4">
                    {criticals.map((c, i) => (
                      <CriticalFlagCard
                        key={`critical-${c.flag.id}`}
                        label={c.flag.label}
                        severity="critical"
                        pillar={c.flag.pillar ?? ""}
                        yourQuoteText={c.exhibit!.yourQuoteText}
                        benchmark={c.exhibit!.benchmark}
                        interpretation={c.exhibit!.interpretation}
                        hasHardEvidence={c.exhibit!.hasHardEvidence}
                        index={i}
                        isTopRanked={i === 0}
                      />
                    ))}
                  </div>
                );
              })()}

              {/* ── Regular flag cards ── */}
              {flags.map((flag, i) => {
                const effectiveSev = resolveEffectiveSeverity(flag);
                const s = severityStyles[effectiveSev];
                const isExpanded = expandedFlags.has(flag.id);
                const pillarLabel = pillarScores.find((p) => p.key === flag.pillar)?.label;

                return (
                  <motion.div
                    key={flag.id}
                    id={`finding-${flag.id}`}
                    {...stagger(i * 0.5 + 4)}
                    className="card-raised overflow-hidden scroll-mt-24"
                    style={{
                      border: s.border,
                      borderLeft: s.borderLeft,
                    }}
                  >
                    <button
                      onClick={() => toggleFlag(flag.id)}
                      className="w-full text-left"
                      style={{ padding: "18px 20px 18px 24px", background: "none", border: "none", cursor: "pointer" }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span
                              className="font-mono"
                              style={{
                                display: "inline-block",
                                background: s.badgeBg,
                                padding: "3px 10px",
                                fontSize: 12,
                                fontWeight: 700,
                                color: s.badgeColor,
                                letterSpacing: "0.06em",
                                borderRadius: "var(--radius-btn)",
                              }}
                            >
                              {s.badgeText}
                            </span>
                            {pillarLabel && (
                              <span
                                className="bg-secondary text-muted-foreground"
                                style={{
                                  fontSize: 11,
                                  fontFamily: "'Roboto', sans-serif",
                                  letterSpacing: "0.06em",
                                  padding: "2px 8px",
                                  borderRadius: "var(--radius-btn)",
                                }}
                              >
                                {pillarLabel}
                              </span>
                            )}
                          </div>
                          <p className="font-body text-foreground" style={{ fontSize: 20, fontWeight: 700 }}>
                            {flag.label}
                          </p>
                        </div>
                        <div className="text-muted-foreground" style={{ flexShrink: 0, marginTop: 4 }}>
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        transition={{ duration: 0.25 }}
                        style={{ padding: "0 20px 20px 24px" }}
                      >
                        <div className="border-t border-border" style={{ paddingTop: 14 }}>
                          <p className="font-body text-foreground/90" style={{ fontSize: 14, lineHeight: 1.7 }}>
                            {flag.detail}
                          </p>

                          {flag.tip && (
                            <div
                              className="border border-border"
                              style={{
                                background: s.tipBg || "hsl(var(--card))",
                                borderRadius: "var(--radius-card)",
                                padding: "12px 16px",
                                marginTop: 14,
                                display: "flex",
                                gap: 10,
                                alignItems: "flex-start",
                              }}
                            >
                              <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
                              <div>
                                <p
                                  className="font-mono"
                                  style={{
                                    fontSize: 12,
                                    color: "hsl(var(--color-gold-accent))",
                                    letterSpacing: "0.08em",
                                    fontWeight: 700,
                                    marginBottom: 4,
                                  }}
                                >
                                  WHAT TO DO
                                </p>
                                <p className="font-body text-foreground/90" style={{ fontSize: 13, lineHeight: 1.6 }}>
                                  {flag.tip}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          ) : // ── LOCKED: render stateless LockedOverlay with gate props from orchestrator ──
          gateProps ? (() => {
              // Derive preview-safe latent-value teaser values from props already received.
              // No new fetches — pillarScores, gradeConfig, flagCountProp are all preview-safe.
              const weakestPillar =
                pillarScores.find((p) => p.status === "fail") ??
                pillarScores.find((p) => p.status === "warn") ??
                null;
              const weakestPillarLabel = weakestPillar?.label ?? undefined;
              const gradeLabel = gradeConfig[grade]?.label;
              // 1 finding is already surfaced via TopViolationSummaryStrip — subtract it.
              const hiddenFindingsCount = Math.max(0, (flagCountProp ?? 0) - 1);
              return (
                // Anchor target for pre-OTP scroll-to-gate (orchestrator + ghost-lock CTA).
                <div id="otp-gate" className="scroll-mt-24">
                  <LockedOverlay
                    grade={grade}
                    flagCount={issueCount}
                    gradeLabel={gradeLabel}
                    weakestPillarLabel={weakestPillarLabel}
                    hiddenFindingsCount={hiddenFindingsCount}
                    {...gateProps}
                  />
                </div>
              );
            })() : (
            // Fallback if no gateProps provided (e.g. dev/demo without orchestrator)
            <div id="otp-gate" className="py-12 text-center scroll-mt-24">
              <p className="font-body text-muted-foreground" style={{ fontSize: 16 }}>
                Verify your phone to unlock findings.
              </p>
            </div>
          )}

          {/* Summary bar */}
          <div
            className="card-raised flex flex-col md:flex-row md:items-center md:justify-between gap-2"
            style={{ padding: "14px 20px", marginTop: 16 }}
          >
            <p className="font-body text-foreground" style={{ fontSize: 18 }}>
              {summaryText} across 5 pillars.
            </p>
            <div className="text-right">
              <p className="font-mono text-foreground" style={{ fontSize: 16 }}>
                Grade {grade} · {issueCount} Issue{issueCount !== 1 ? "s" : ""}
                {greenCount > 0 ? ` · ${greenCount} Confirmed` : ""}
              </p>
              <p className="text-muted-foreground font-sans font-semibold" style={{ fontSize: 14, marginTop: 2 }}>
                Analyzed Against 37 Industry Signals.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── POST-FINDINGS DEEPER PROOF (full mode only) ───
          Order: Quote Price Math → Red Flags → Missing Items → demoted WhatToDoNow → full Pillar Section.
          These sit AFTER the Forensic Findings accordion as supporting depth — they
          must not compete with the single primary CTA above. */}
      {isFull && derivedMetrics && (
        <QuotePriceMath metrics={derivedMetrics} county={county} />
      )}

      {isFull && warnings && warnings.length > 0 && (
        <RedFlagsList warnings={warnings} />
      )}

      {isFull && missingItems && missingItems.length > 0 && (
        <MissingItemsList missingItems={missingItems} />
      )}

      {isFull && (
        <ForensicPillarSection pillarScores={pillarScores} flags={flags} county={county} isFull={isFull} />
      )}

      {/* ─── GAP-FIX MODULE (full mode only) ─── */}
      {activeModule === "gapFix" && isFull && <GapFixModule flags={flags} onClose={() => setActiveModule("none")} />}

      {/* ─── GREEN CHECKLIST MODULE ─── */}
      {activeModule === "greenChecklist" && isFull && <GreenChecklistModule onClose={() => setActiveModule("none")} />}

      {/* ─── NEGOTIATION SCRIPT ─── */}
      {isFull && (
        <section className="py-10 md:py-14 px-4 md:px-12 bg-background border-b border-border">
          <div className="max-w-4xl mx-auto">
            <motion.div {...stagger(6)}>
              <span className="wm-eyebrow" style={{ color: "hsl(var(--color-cyan))" }}>
                NEGOTIATION TOOL
              </span>
              <h2 className="wm-title-section text-foreground" style={{ marginTop: 4, marginBottom: 6 }}>
                Your Word-for-Word Script
              </h2>
              <p className="font-body text-muted-foreground" style={{ fontSize: 18, marginBottom: 20 }}>
                Customized for {displayName} based on the {issueCount} issue{issueCount !== 1 ? "s" : ""} found in your
                quote.
              </p>
            </motion.div>

            <motion.div
              {...stagger(7)}
              className="card-raised"
              style={{
                borderLeft: "4px solid hsl(var(--color-cyan))",
                padding: "24px 28px",
                position: "relative",
              }}
            >
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 border border-border"
                style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  background: copied ? "hsl(var(--color-emerald) / 0.12)" : "transparent",
                  borderColor: copied ? "hsl(var(--color-emerald) / 0.3)" : undefined,
                  borderRadius: "var(--radius-btn)",
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: copied ? "hsl(var(--color-emerald))" : "hsl(var(--foreground))",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Copied!" : "Copy Script"}
              </button>

              <p
                className="font-mono"
                style={{ fontSize: 12, color: "hsl(var(--color-cyan))", letterSpacing: "0.1em", marginBottom: 16 }}
              >
                CALL SCRIPT · {displayName.toUpperCase()}
              </p>
              <p
                className="font-body text-foreground"
                style={{ fontSize: 15, lineHeight: 2.0, whiteSpace: "pre-line" }}
              >
                {scriptText}
              </p>
            </motion.div>
          </div>
        </section>
      )}

      {/* ─── REPORT FOOTER ─── */}
      <section className="py-6 px-4 md:px-8 bg-background border-t border-border">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="font-mono text-foreground" style={{ fontSize: 11, fontWeight: 700 }}>
              WindowMan Truth Report™
            </p>
            <p className="font-body text-muted-foreground" style={{ fontSize: 12 }}>
              {reportDate} · {county} County · Grade {grade}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <p className="font-body text-muted-foreground" style={{ fontSize: 12 }}>
              This report is private. Only you can access it.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

function humanizeDocType(dt: string): string {
  const map: Record<string, string> = {
    quote: "Contractor Quote",
    estimate: "Project Estimate",
    proposal: "Project Proposal",
    invoice: "Invoice",
    contract: "Contract",
  };
  return map[dt.toLowerCase()] || dt;
}

export default TruthReportClassic;
