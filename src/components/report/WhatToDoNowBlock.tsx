/**
 * WhatToDoNowBlock — DEMOTED informational recommendation block.
 *
 * Authoritative primary CTA lives in `TopRisksCTAStrip` (above the fold,
 * directly under Financial Forensics). This block shows a single-winner
 * recommendation with a "Based on:" evidence line and a small text link
 * back up to the CTA strip — never a primary button.
 *
 * Single-winner action picker (priority order):
 * 1. Replace / Re-bid — wins on grade D/F or redCount >= 3
 * 2. Negotiate       — wins on price band high/extreme, markup, or price_fairness flag
 * 3. Validate        — wins on missing items or fine_print/safety_code flags
 */

import { motion } from "framer-motion";
import { ArrowUp, ShieldCheck, Scale, RefreshCw } from "lucide-react";
import type { AnalysisFlag } from "@/hooks/useAnalysisData";

type ActionKind = "replace" | "negotiate" | "validate";

interface QualifiedAction {
  kind: ActionKind;
  title: string;
  oneLiner: string;
  basedOn: string;
  icon: typeof ShieldCheck;
  accent: string;
}

interface WhatToDoNowBlockProps {
  flags: AnalysisFlag[];
  grade: string;
  redCount: number;
  missingItems?: (string | Record<string, unknown>)[];
  markupEstimate?: string | null;
  pricePerOpeningBand?: "low" | "market" | "high" | "extreme" | null;
  /** Shared CTA label so the link wording matches the primary strip. */
  ctaLabel: string;
}

function pluralize(n: number, singular: string, plural?: string) {
  return `${n} ${n === 1 ? singular : (plural ?? `${singular}s`)}`;
}

function buildQualified(props: WhatToDoNowBlockProps): QualifiedAction[] {
  const { flags, grade, redCount, missingItems = [], markupEstimate, pricePerOpeningBand } = props;
  const out: QualifiedAction[] = [];

  // 1. Replace / Re-bid
  const isHighSeverityGrade = grade === "D" || grade === "F";
  if (isHighSeverityGrade || redCount >= 3) {
    const evidenceParts: string[] = [];
    if (isHighSeverityGrade) evidenceParts.push(`Grade ${grade}`);
    if (redCount >= 3) evidenceParts.push(pluralize(redCount, "Critical Finding"));
    out.push({
      kind: "replace",
      title: "Replace / Re-Bid This Quote",
      oneLiner:
        "The Risk Pattern In This Quote is Severe Enough That The Strongest Move is to Get a Competing Quote Before Signing.",
      basedOn: evidenceParts.join(" · "),
      icon: RefreshCw,
      accent: "hsl(var(--color-danger))",
    });
  }

  // 2. Negotiate
  const priceFlags = flags.filter((f) => f.pillar === "price_fairness");
  const priceBandHigh = pricePerOpeningBand === "high" || pricePerOpeningBand === "extreme";
  if (priceFlags.length > 0 || markupEstimate || priceBandHigh) {
    const evidenceParts: string[] = [];
    if (priceBandHigh) evidenceParts.push(`Price Band: ${pricePerOpeningBand}`);
    if (markupEstimate) evidenceParts.push(`Markup: ${markupEstimate}`);
    if (priceFlags.length > 0 && evidenceParts.length === 0) {
      evidenceParts.push(pluralize(priceFlags.length, "Price-Fairness Finding"));
    }
    out.push({
      kind: "negotiate",
      title: "Negotiate This Quote",
      oneLiner:
        "Price Evidence in Your Report Supports Renegotiating Before You Sign — There's Room To Push Back on Labor and Materials.",
      basedOn: evidenceParts.join(" · "),
      icon: Scale,
      accent: "hsl(var(--color-caution))",
    });
  }

  // 3. Validate
  const validateFlags = flags.filter((f) => f.pillar === "fine_print" || f.pillar === "safety_code");
  const missingCount = (missingItems ?? []).length;
  if (missingCount > 0 || validateFlags.length > 0) {
    const evidenceParts: string[] = [];
    if (missingCount > 0) evidenceParts.push(pluralize(missingCount, "Missing Scope Item"));
    if (validateFlags.length > 0) {
      const fineCount = validateFlags.filter((f) => f.pillar === "fine_print").length;
      const safetyCount = validateFlags.filter((f) => f.pillar === "safety_code").length;
      if (safetyCount > 0) evidenceParts.push(pluralize(safetyCount, "Safety/Code Finding"));
      if (fineCount > 0) evidenceParts.push(pluralize(fineCount, "Fine-Print Finding"));
    }
    out.push({
      kind: "validate",
      title: "Validate This Quote Before Signing",
      oneLiner:
        "Important Scope, Code, or Fine-Print Items Are Unclear in This Quote. Get Them Clarified in Writing Before You Commit.",
      basedOn: evidenceParts.join(" · "),
      icon: ShieldCheck,
      accent: "hsl(var(--color-cyan))",
    });
  }

  return out;
}

const WhatToDoNowBlock = (props: WhatToDoNowBlockProps) => {
  const qualified = buildQualified(props);
  if (qualified.length === 0) return null;

  const primary = qualified[0];
  const runnersUp = qualified.slice(1, 3);
  const PrimaryIcon = primary.icon;

  const handleScrollToCta = (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById("cta-strip");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="py-5 md:py-6 px-4 md:px-8 bg-background border-b border-border">
      <div className="max-w-3xl mx-auto">
        <div className="mb-3">
          <span className="wm-eyebrow" style={{ color: "hsl(var(--foreground))" }}>
            WHAT TO DO NOW
          </span>
          <h2 className="font-display text-foreground text-lg md:text-xl font-semibold mt-1">
            Your Recommended Next Move
          </h2>
        </div>

        {/* Compact secondary recommendation — NOT a primary CTA */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="rounded-[var(--radius-card)] border border-border bg-card px-4 py-3 md:px-5 md:py-4"
          style={{ borderLeft: `3px solid ${primary.accent}` }}
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{
                width: 28,
                height: 28,
                borderRadius: "var(--radius-btn)",
                background: `${primary.accent}26`,
                color: primary.accent,
              }}
            >
              <PrimaryIcon size={15} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-body text-foreground text-base font-semibold leading-snug">
                {primary.title}
              </p>
              <p className="font-body text-foreground/85 text-sm leading-snug mt-1">
                {primary.oneLiner}
              </p>
              {primary.basedOn && (
                <p className="font-mono text-foreground/70 text-sm mt-1.5">
                  <span className="font-semibold">Based on:</span> {primary.basedOn}
                </p>
              )}

              {/* Demoted: text link only — sends user back up to the authoritative CTA */}
              <a
                href="#cta-strip"
                onClick={handleScrollToCta}
                className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80 underline underline-offset-2 mt-3 transition-colors"
              >
                <ArrowUp size={14} aria-hidden="true" />
                {props.ctaLabel}
              </a>
            </div>
          </div>
        </motion.div>

        {/* Runner-up actions — compact chips, secondary */}
        {runnersUp.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {runnersUp.map((action) => (
              <span
                key={action.kind}
                className="inline-flex items-center gap-1.5 border border-border bg-card text-foreground/85 text-sm font-medium"
                style={{
                  padding: "5px 11px",
                  borderRadius: "var(--radius-btn)",
                }}
                title={action.oneLiner}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: action.accent,
                    flexShrink: 0,
                  }}
                />
                Also: {action.title}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default WhatToDoNowBlock;
