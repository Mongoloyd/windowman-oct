/**
 * ScopeGapChecklist — Install-Day Coverage Map (lab-only types).
 */

export type ScopeGapState =
  | "included"
  | "not_detected"
  | "excluded"
  | "unclear"
  | "not_applicable";

export type ScopeGapPhaseId =
  | "site_prep_removal"
  | "exposed_opening"
  | "waterproofing_fastening"
  | "finish_work"
  | "permit_inspection_costs";

export interface ScopeGapItem {
  fieldKey: string;
  label: string;
  state: ScopeGapState;
  statusLabel: string;
  evidenceText?: string | null;
  homeownerRiskCopy: string;
  contractorQuestion: string;
}

export interface ScopeGapPhase {
  id: ScopeGapPhaseId;
  title: string;
  subtitle?: string;
  items: ScopeGapItem[];
}

export interface ScopeGapSummaryCounts {
  included: number;
  unclear: number;
  notDetected: number;
  excluded: number;
  notApplicable: number;
  needsConfirmation: number;
}

export interface ScopeGapChecklistProps {
  phases: ScopeGapPhase[];
  summary: ScopeGapSummaryCounts;
  title?: string;
  subtitle?: string;
  ocrDisclaimer?: string;
}
