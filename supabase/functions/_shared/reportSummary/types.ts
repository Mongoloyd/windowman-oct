/**
 * reportSummary/types.ts — Versioned contracts for Truth Report Executive Summary V1.
 *
 * Pure types only. Summary AI explains established deterministic facts; it does not
 * extract, score, or create report truth.
 */

export const FULL_SUMMARY_FACT_PACK_VERSION =
  "full_summary_fact_pack_v1" as const;
export const REPORT_SUMMARY_VERSION = "report_summary_v1" as const;
export const SUMMARY_PROMPT_VERSION = "summary_prompt_p1" as const;

export type FullSummaryFactPackV1 = {
  pack_version: typeof FULL_SUMMARY_FACT_PACK_VERSION;

  analysis_identity: {
    analysis_id: string;
    rubric_version: string | null;
  };

  verdict: {
    grade: string | null;
    red_count: number;
    amber_count: number;
    clear_count: number | null;
  };

  top_findings: Array<{
    evidence_key: string;
    severity: string;
    headline: string;
    detail: string | null;
    pillar: string | null;
  }>;

  positive_findings: Array<{
    evidence_key: string;
    headline: string;
  }>;

  missing_findings: Array<{
    evidence_key: string;
    headline: string;
  }>;

  action_questions: string[];

  /** V1 intentionally empty — no market statistics in summary layer. */
  benchmark_context: [];
};

export type ReportSummaryHighlightKind =
  | "strength"
  | "concern"
  | "missing"
  | "question";

export type ReportSummaryV1Status =
  | "ready"
  | "insufficient_facts"
  | "failed";

export type ReportSummaryV1 = {
  summary_version: typeof REPORT_SUMMARY_VERSION;
  prompt_version: typeof SUMMARY_PROMPT_VERSION;

  summary_body: string;

  evidence_keys: string[];

  action_step: string | null;

  highlights: Array<{
    kind: ReportSummaryHighlightKind;
    text: string;
    evidence_keys: string[];
  }>;

  status: ReportSummaryV1Status;

  input_pack_hash: string;
};

/** Structured source for fact-pack construction — not raw full_json forwarding. */
export type ReportSummaryFlag = {
  flag: string;
  severity: string;
  pillar?: string | null;
  detail?: string | null;
  tip?: string | null;
};

export type FullReportSummarySource = {
  analysis_id: string;
  rubric_version: string | null;
  grade: string | null;
  flags: ReportSummaryFlag[];
  missing_items: string[];
  warnings: string[];
  summary: string | null;
  /** Optional precomputed RPC aggregates; derived from flags when omitted. */
  flag_red_count?: number | null;
  flag_amber_count?: number | null;
  /** Established proof-of-read / preview facts — not raw extraction blob. */
  has_warranty?: boolean | null;
  has_permits?: boolean | null;
  contractor_name_present?: boolean;
};
