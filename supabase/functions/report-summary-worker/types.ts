import type { AnalysisRowForSummary } from "../_shared/reportSummary/buildSummarySourceFromAnalysis.ts";
import type {
  ReportSummaryProviderResult,
} from "../_shared/reportSummary/reportSummaryProvider.ts";
import type {
  FullSummaryFactPackV1,
  ReportSummaryV1,
} from "../_shared/reportSummary/types.ts";

export type SummaryDisposition =
  | "no_work"
  | "skipped_current"
  | "claim_conflict"
  | "ownership_lost"
  | "insufficient_facts"
  | "ready"
  | "failed"
  | "analysis_unreadable";

export type WorkerResult = {
  ok: boolean;
  disposition: SummaryDisposition | null;
  analysis_id: string | null;
  summary_id: string | null;
  provider_calls: number;
  detail: string;
};

export type SummaryClaim = {
  summary_id: string;
  claim_token: string;
  prior_status: string | null;
  already_terminal: boolean;
};

export type CompleteSummaryInput = {
  summary_id: string;
  analysis_id: string;
  worker_id: string;
  claim_token: string;
  status: "ready" | "insufficient_facts" | "failed";
  summary_json?: ReportSummaryV1 | null;
  runtime_model_id?: string | null;
  failure_class?: string | null;
};

export type ReportSummaryWorkerPorts = {
  pickCandidate: (promptVersion: string) => Promise<{ analysis_id: string } | null>;
  loadAnalysis: (analysisId: string) => Promise<AnalysisRowForSummary | null>;
  getTerminalSummary: (
    analysisId: string,
    promptVersion: string,
    inputPackHash: string,
  ) => Promise<{ status: string } | null>;
  claimGeneration: (input: {
    analysis_id: string;
    prompt_version: string;
    input_pack_hash: string;
    worker_id: string;
    lease_seconds: number;
  }) => Promise<SummaryClaim | null>;
  completeSummary: (input: CompleteSummaryInput) => Promise<boolean>;
  callProvider: (
    factPack: FullSummaryFactPackV1,
  ) => Promise<ReportSummaryProviderResult>;
};

export type WorkerConfig = {
  leaseSeconds: number;
};

export const DEFAULT_WORKER_CONFIG: WorkerConfig = {
  leaseSeconds: 300,
};
