/**
 * CodeComplianceProofSection — lab-only code/compliance proof types.
 */

export type CodeComplianceStatus = "documented" | "partial" | "missing" | "unclear";

export type CodeComplianceRowStatus = "documented" | "partial" | "missing" | "unclear";

export type ForensicRowSeverity = "neutral" | "info" | "warning" | "danger";

export interface CodeComplianceProofRow {
  id: string;
  label: string;
  value: string;
  detail?: string;
  examples?: string[];
  status: CodeComplianceRowStatus;
  severity?: ForensicRowSeverity;
}

export interface CodeComplianceProofSectionProps {
  title?: string;
  subtitle?: string;
  status: CodeComplianceStatus;
  statusLabel: string;
  rows: CodeComplianceProofRow[];
  whyItMatters: string;
  missingStateMessage?: string | null;
  footerBadges?: string[];
}
