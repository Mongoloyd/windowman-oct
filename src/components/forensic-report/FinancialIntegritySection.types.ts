/**
 * FinancialIntegritySection — lab-only financial clarity types.
 */

export type FinancialIntegrityStatus =
  | "transparent"
  | "needs_verification"
  | "high_friction"
  | "unclear";

export type FinancialIntegrityRowStatus =
  | "transparent"
  | "needs_verification"
  | "high_friction"
  | "unclear";

export type ForensicRowSeverity = "neutral" | "info" | "warning" | "danger";

export interface FinancialIntegrityRow {
  id: string;
  label: string;
  value: string;
  detail?: string;
  examples?: string[];
  status: FinancialIntegrityRowStatus;
  severity?: ForensicRowSeverity;
}

export interface FinancialIntegritySectionProps {
  title?: string;
  subtitle?: string;
  status: FinancialIntegrityStatus;
  statusLabel: string;
  rows: FinancialIntegrityRow[];
  whyItMatters: string;
  missingStateMessage?: string | null;
  footerBadges?: string[];
}
