/**
 * selectSigningRisks — picks the top 3 "signing risks" for the SigningRiskSummary.
 *
 * Presentation helper only. Uses existing flag data; never fetches or scores.
 * Priority: red flags first by pillar, then amber/high-leverage. Backfills with
 * safe fallback cards when fewer than 3 real flags exist.
 */
import type { AnalysisFlag } from "@/hooks/useAnalysisData";
import { getFlagReasoning } from "@/utils/flagReasoningMap";

export interface SigningRisk {
  title: string;
  why: string;
  ask: string;
  severity: "critical" | "warning";
  isFallback: boolean;
}

const TARGET_COUNT = 3;

// Pillar priority mirrors selectTopViolation: safety/code first, then price,
// warranty, fine print, install scope.
const PILLAR_PRIORITY: Record<string, number> = {
  safety_code: 0,
  price_fairness: 1,
  warranty: 2,
  fine_print: 3,
  install_scope: 4,
};

const ASK_BY_PILLAR: Record<string, string> = {
  safety_code: "Ask for written NOA numbers and DP ratings for every proposed product.",
  price_fairness: "Ask for itemized pricing per opening so each line can be checked against market.",
  warranty: "Ask for written manufacturer and labor warranty terms, including durations.",
  fine_print: "Ask for written cancellation, deposit, and change-order terms before signing.",
  install_scope:
    "Ask for a written scope covering permits, waterproofing, wall repair, and debris removal.",
};

const DEFAULT_ASK = "Ask the contractor to confirm this item in writing before you sign.";

const FALLBACK_RISKS: SigningRisk[] = [
  {
    title: "Product approval not documented",
    why: "Florida impact work requires verifiable NOA/DP proof before permit.",
    ask: "Ask for written NOA numbers and DP ratings for every proposed product.",
    severity: "critical",
    isFallback: true,
  },
  {
    title: "Change-order rules unclear",
    why: "Open-ended change orders are the #1 post-signing cost surprise.",
    ask: "Ask for written change-order approval rules, substrate pricing, and remeasure limits.",
    severity: "warning",
    isFallback: true,
  },
  {
    title: "Install scope not fully defined",
    why: "Vague scope creates disputes on trim, flashing, permits, and debris.",
    ask: "Ask for a written scope list covering permits, waterproofing, wall repair, and debris removal.",
    severity: "warning",
    isFallback: true,
  },
];

function firstSentence(text: string | null | undefined): string {
  if (typeof text !== "string") return "";
  const trimmed = text.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^[^.!?]*[.!?]/);
  return (match ? match[0] : trimmed).trim();
}

function pillarRank(flag: AnalysisFlag): number {
  return PILLAR_PRIORITY[flag.pillar ?? ""] ?? 99;
}

function resolveWhy(flag: AnalysisFlag): string {
  const reasoning = getFlagReasoning(flag.label);
  if (reasoning) return reasoning;
  const sentence = firstSentence(flag.detail);
  return sentence || flag.detail || flag.label;
}

function resolveAsk(flag: AnalysisFlag): string {
  if (typeof flag.tip === "string" && flag.tip.trim()) return flag.tip.trim();
  return ASK_BY_PILLAR[flag.pillar ?? ""] ?? DEFAULT_ASK;
}

function toSigningRisk(flag: AnalysisFlag): SigningRisk {
  return {
    title: flag.label,
    why: resolveWhy(flag),
    ask: resolveAsk(flag),
    severity: flag.severity === "red" ? "critical" : "warning",
    isFallback: false,
  };
}

/**
 * Returns exactly the top {@link TARGET_COUNT} signing risks, backfilling with
 * safe fallbacks when the analysis exposes fewer real flags.
 */
export function selectSigningRisks(flags: AnalysisFlag[] | null | undefined): SigningRisk[] {
  const safeFlags = Array.isArray(flags) ? flags : [];

  const reds = safeFlags
    .filter((f) => f.severity === "red")
    .sort((a, b) => pillarRank(a) - pillarRank(b));

  const ambers = safeFlags
    .filter((f) => f.severity === "amber")
    .sort((a, b) => pillarRank(a) - pillarRank(b));

  const ordered = [...reds, ...ambers].slice(0, TARGET_COUNT).map(toSigningRisk);

  if (ordered.length >= TARGET_COUNT) return ordered;

  const usedTitles = new Set(ordered.map((r) => r.title.toLowerCase()));
  const result = [...ordered];
  for (const fallback of FALLBACK_RISKS) {
    if (result.length >= TARGET_COUNT) break;
    if (usedTitles.has(fallback.title.toLowerCase())) continue;
    result.push(fallback);
    usedTitles.add(fallback.title.toLowerCase());
  }

  return result.slice(0, TARGET_COUNT);
}
