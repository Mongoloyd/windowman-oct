/**
 * WarrantyFinePrintSection — lab-only warranty / fine-print types.
 */

export type WarrantyFinePrintStatus = "protected" | "partial" | "exposed" | "unclear";

export type WarrantyFinePrintRowStatus = "protected" | "partial" | "exposed" | "unclear";

export type ForensicRowSeverity = "neutral" | "info" | "warning" | "danger";

export interface WarrantyFinePrintRow {
  id: string;
  label: string;
  value: string;
  detail?: string;
  examples?: string[];
  status: WarrantyFinePrintRowStatus;
  severity?: ForensicRowSeverity;
}

export interface WarrantyFinePrintSectionProps {
  title?: string;
  subtitle?: string;
  status: WarrantyFinePrintStatus;
  statusLabel: string;
  rows: WarrantyFinePrintRow[];
  whyItMatters: string;
  missingStateMessage?: string | null;
  footerBadges?: string[];
}
