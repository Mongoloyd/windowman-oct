import { ASK_BY_PILLAR, DEFAULT_ACTION_QUESTION } from "./constants.ts";
import type { ReportSummaryFlag } from "./types.ts";

export function humanizeFlag(flag: string): string {
  return flag.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function normalizePillarKey(
  raw: string | null | undefined,
): string | null {
  switch (raw) {
    case "safety":
      return "safety_code";
    case "install":
      return "install_scope";
    case "price":
      return "price_fairness";
    case "finePrint":
      return "fine_print";
    case "warranty":
      return "warranty";
    default:
      return raw || null;
  }
}

export function isConcernSeverity(severity: string): boolean {
  const normalized = severity.toLowerCase();
  return normalized === "critical" ||
    normalized === "high" ||
    normalized === "medium";
}

export function isRedSeverity(severity: string): boolean {
  const normalized = severity.toLowerCase();
  return normalized === "critical" || normalized === "high";
}

export function isAmberSeverity(severity: string): boolean {
  return severity.toLowerCase() === "medium";
}

export function isClearSeverity(severity: string): boolean {
  const normalized = severity.toLowerCase();
  return normalized === "low" || normalized === "info" ||
    normalized === "pass" || normalized === "confirmed" ||
    normalized === "green" || normalized === "ok" || normalized === "good";
}

export function slugifyMissingItem(text: string, index: number): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
  return slug.length > 0 ? `missing_${slug}` : `missing_item_${index + 1}`;
}

export function countFlagSeverities(flags: ReportSummaryFlag[]): {
  red: number;
  amber: number;
  clear: number;
} {
  let red = 0;
  let amber = 0;
  let clear = 0;
  for (const flag of flags) {
    if (isRedSeverity(flag.severity)) red += 1;
    else if (isAmberSeverity(flag.severity)) amber += 1;
    else if (isClearSeverity(flag.severity)) clear += 1;
  }
  return { red, amber, clear };
}

export function resolveActionQuestion(flag: ReportSummaryFlag): string {
  if (typeof flag.tip === "string" && flag.tip.trim()) {
    return flag.tip.trim();
  }
  const pillar = normalizePillarKey(flag.pillar);
  if (pillar && ASK_BY_PILLAR[pillar]) return ASK_BY_PILLAR[pillar];
  return DEFAULT_ACTION_QUESTION;
}
