/**
 * visualState — frontend-only map from existing report signals to .fr-* CSS primitives.
 * Pure presentation. No fetch, no auth, no adapter imports.
 */

export type ReportVisualTone =
  | "critical"
  | "warning"
  | "verified"
  | "info"
  | "unknown"
  | "neutral";

export type ReportVisualIntensity = "none" | "soft" | "medium" | "strong";

export type ReportVisualState = {
  tone: ReportVisualTone;
  intensity: ReportVisualIntensity;
  cardClass: string;
  pillClass: string;
  accentClass: string;
  titleClass: string;
  valueClass: string;
  shouldGlow: boolean;
  reason: string;
};

const CRITICAL: ReportVisualState = {
  tone: "critical",
  intensity: "strong",
  cardClass: "fr-card fr-card--critical fr-glow--critical",
  pillClass: "fr-pill--critical",
  accentClass: "fr-accent-l--critical",
  titleClass: "fr-text-t1",
  valueClass: "fr-num fr-text-t1",
  shouldGlow: true,
  reason: "flag severity red",
};

const WARNING: ReportVisualState = {
  tone: "warning",
  intensity: "medium",
  cardClass: "fr-card fr-card--warning fr-glow--warning",
  pillClass: "fr-pill--warning",
  accentClass: "fr-accent-l--warning",
  titleClass: "fr-text-t2",
  valueClass: "fr-num fr-text-t2",
  shouldGlow: true,
  reason: "flag severity amber",
};

const VERIFIED: ReportVisualState = {
  tone: "verified",
  intensity: "soft",
  cardClass: "fr-card fr-card--verified",
  pillClass: "fr-pill--verified",
  accentClass: "fr-accent-l--verified",
  titleClass: "fr-text-t2",
  valueClass: "fr-num fr-text-t2",
  shouldGlow: false,
  reason: "flag severity green",
};

export function mapFlagSeverityToVisual(
  severity: "red" | "amber" | "green",
): ReportVisualState {
  switch (severity) {
    case "amber":
      return WARNING;
    case "green":
      return VERIFIED;
    case "red":
    default:
      return CRITICAL;
  }
}

export function mapSigningRiskSeverityToVisual(
  severity: "critical" | "warning",
): ReportVisualState {
  return mapFlagSeverityToVisual(severity === "critical" ? "red" : "amber");
}

export function deriveExecutiveSummaryVisual(input: {
  grade: string;
  flagRedCount: number;
  overpaymentLow?: number | null;
  overpaymentHigh?: number | null;
}): ReportVisualState {
  const hasOverpayment =
    (input.overpaymentLow ?? 0) > 0 || (input.overpaymentHigh ?? 0) > 0;

  if (hasOverpayment) {
    return {
      tone: "critical",
      intensity: "strong",
      cardClass: "fr-card fr-card--critical fr-glow--critical-strong",
      pillClass: "fr-pill--critical",
      accentClass: "fr-accent-l--critical",
      titleClass: "fr-text-t1",
      valueClass: "fr-num fr-text-t1",
      shouldGlow: true,
      reason: "positive overpayment range",
    };
  }

  const gradeUpper = (input.grade ?? "").trim().toUpperCase();
  const weakGrade = gradeUpper === "C" || gradeUpper === "D" || gradeUpper === "F";

  if (weakGrade || (input.flagRedCount ?? 0) > 0) {
    return {
      tone: "warning",
      intensity: "medium",
      cardClass: "fr-card fr-card--warning fr-glow--warning",
      pillClass: "fr-pill--warning",
      accentClass: "fr-accent-l--warning",
      titleClass: "fr-text-t2",
      valueClass: "fr-num fr-text-t2",
      shouldGlow: true,
      reason: "weak grade or critical flags",
    };
  }

  return {
    tone: "info",
    intensity: "soft",
    cardClass: "fr-card",
    pillClass: "fr-pill--info",
    accentClass: "fr-accent-l--info",
    titleClass: "fr-text-t2",
    valueClass: "fr-num fr-text-t2",
    shouldGlow: false,
    reason: "calm executive summary",
  };
}

/** Tone → icon/text utility class for lucide icons and inline accents. */
export function toneIconClass(tone: ReportVisualTone): string {
  switch (tone) {
    case "critical":
      return "text-[hsl(var(--fr-danger))]";
    case "warning":
      return "text-[hsl(var(--fr-caution))]";
    case "verified":
      return "text-[hsl(var(--fr-success))]";
    case "info":
      return "text-[hsl(var(--fr-cyan))]";
    default:
      return "text-[hsl(var(--fr-text-muted))]";
  }
}

export type EvidenceRowTier =
  | "summary"
  | "warning-alert"
  | "critical-alert"
  | "quiet";

const MONEY_PATTERN =
  /(~?\$[\d,]+(?:\.\d{2})?(?:\s*[–-]\s*~?\$?[\d,]+(?:\.\d{2})?)?)/g;

export function splitMoneyPhrases(text: string): Array<{ text: string; isMoney: boolean }> {
  if (!text) return [{ text: "", isMoney: false }];

  const parts: Array<{ text: string; isMoney: boolean }> = [];
  let lastIndex = 0;
  const re = new RegExp(MONEY_PATTERN.source, "g");
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), isMoney: false });
    }
    parts.push({ text: match[0], isMoney: true });
    lastIndex = re.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), isMoney: false });
  }

  if (parts.length === 0) {
    parts.push({ text, isMoney: false });
  }

  return parts;
}

export function deriveEvidenceRowTier(input: {
  severity?: string | null;
  status?: string | null;
  domain: "financial" | "compliance";
}): EvidenceRowTier {
  const severity = input.severity ?? undefined;
  const status = input.status ?? undefined;

  if (input.domain === "financial") {
    if (severity === "danger" || status === "high_friction") {
      return "critical-alert";
    }
    if (severity === "warning" || status === "unclear" || status === "needs_verification") {
      return "warning-alert";
    }
    if (status === "transparent") {
      return "summary";
    }
    return "quiet";
  }

  if (severity === "danger" && status === "missing") {
    return "critical-alert";
  }
  if (
    status === "missing" ||
    status === "partial" ||
    status === "unclear" ||
    severity === "warning"
  ) {
    return "warning-alert";
  }
  if (status === "documented") {
    return "summary";
  }
  return "quiet";
}

export function mapFinancialIntegrityStatusToVisual(
  status?: string | null,
): Pick<ReportVisualState, "tone" | "pillClass" | "titleClass" | "cardClass" | "accentClass"> {
  switch (status) {
    case "transparent":
      return {
        tone: "verified",
        pillClass: "fr-pill--verified",
        titleClass: "fr-text-t2",
        cardClass: "fr-card fr-card-elevated",
        accentClass: "fr-accent-l--verified",
      };
    case "needs_verification":
      return {
        tone: "info",
        pillClass: "fr-pill--info",
        titleClass: "fr-text-t2",
        cardClass: "fr-card fr-card-elevated",
        accentClass: "fr-accent-l--info",
      };
    case "high_friction":
      return {
        tone: "critical",
        pillClass: "fr-pill--critical",
        titleClass: "fr-text-t1",
        cardClass: "fr-card fr-card-elevated",
        accentClass: "fr-accent-l--critical",
      };
    case "unclear":
    default:
      return {
        tone: "warning",
        pillClass: "fr-pill--warning",
        titleClass: "fr-text-t2",
        cardClass: "fr-card fr-card-elevated",
        accentClass: "fr-accent-l--warning",
      };
  }
}

export function mapCodeComplianceStatusToVisual(
  status?: string | null,
): Pick<ReportVisualState, "tone" | "pillClass" | "titleClass" | "cardClass" | "accentClass"> {
  switch (status) {
    case "documented":
      return {
        tone: "verified",
        pillClass: "fr-pill--verified",
        titleClass: "fr-text-t2",
        cardClass: "fr-card fr-card-elevated",
        accentClass: "fr-accent-l--verified",
      };
    case "partial":
      return {
        tone: "warning",
        pillClass: "fr-pill--warning",
        titleClass: "fr-text-t2",
        cardClass: "fr-card fr-card-elevated",
        accentClass: "fr-accent-l--warning",
      };
    case "missing":
      return {
        tone: "critical",
        pillClass: "fr-pill--critical",
        titleClass: "fr-text-t1",
        cardClass: "fr-card fr-card-elevated",
        accentClass: "fr-accent-l--critical",
      };
    case "unclear":
    default:
      return {
        tone: "info",
        pillClass: "fr-pill--info",
        titleClass: "fr-text-t2",
        cardClass: "fr-card fr-card-elevated",
        accentClass: "fr-accent-l--info",
      };
  }
}
