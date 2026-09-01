export const FAILURE_CODES = [
  "NO_WORK",
  "LEASE_UNAVAILABLE",
  "OWNERSHIP_LOST",
  "PRIVATE_FILE_MISSING",
  "PROVIDER_RETRYABLE",
  "PROVIDER_INVALID_OUTPUT",
  "PERSISTENCE_FAILURE",
  "INSUFFICIENT_LEASE_BUDGET",
  "UNEXPECTED_INTERNAL",
] as const;

export type FailureCode = (typeof FAILURE_CODES)[number];

export type JobStatus =
  | "completed"
  | "retryable_failed"
  | "terminal_failed"
  | "manual_review";

export type ResultDisposition =
  | "extracted"
  | "skipped_existing_extraction"
  | "skipped_lease_held"
  | "retryable_error"
  | "terminal_error"
  | "manual_review";

export type ObservationStatus =
  | "present"
  | "unknown"
  | "low_confidence"
  | "invalid";

export interface ClaimedJob {
  job_id: string;
  quote_file_id: string;
  scan_session_id: string | null;
  analysis_id: string | null;
  lead_id: string | null;
  module_key: string;
  schema_version: string;
  prompt_version: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
  worker_id: string;
  claim_token: string;
  claimed_at: string;
  lease_expires_at: string;
  content_sha256: string | null;
  extraction_id: string | null;
}

export interface JobOwnership {
  jobId: string;
  workerId: string;
  claimToken: string;
  jobLeaseExpiresAt: Date;
}

export interface ContentLease {
  acquired: boolean;
  already_extracted: boolean;
  lease_id: string | null;
  claim_token: string | null;
  lease_expires_at: string | null;
  existing_extraction_id: string | null;
}

export interface QuoteFileRef {
  id: string;
  storage_path: string;
}

export interface ExtractionIdentity {
  contentSha256: string;
  moduleKey: string;
  schemaVersion: string;
  promptVersion: string;
}

export interface ExtractionRecord {
  id: string;
}

export interface NormalizedObservation {
  field_key: string;
  observation_status: ObservationStatus;
  provenance: "QUOTED";
  value_boolean: boolean | null;
  value_integer: number | null;
  value_cents: number | null;
  value_numeric: number | null;
  value_text: string | null;
  value_canonical_text: string | null;
}

export interface NormalizedIntelligence {
  identity: ExtractionIdentity;
  validatedPayload: Record<string, unknown>;
  normalizedPayload: Record<string, unknown>;
  observations: NormalizedObservation[];
  fieldConfidence: Record<string, number | null>;
}

export interface PersistSuccessInput {
  identity: ExtractionIdentity;
  provider: string;
  runtimeModelId: string;
  validatedPayload: Record<string, unknown>;
  normalizedPayload: Record<string, unknown>;
  fieldConfidence: Record<string, number | null>;
  providerCompletionMetadata: Record<string, unknown>;
  usageMetadata: Record<string, unknown>;
  observations: NormalizedObservation[];
}

export type PersistSuccessResult =
  | { ok: true; extractionId: string; reusedExisting: boolean }
  | {
    ok: false;
    code: "SCHEMA_GAP_ATOMIC_PERSISTENCE" | "PERSISTENCE_FAILURE";
    extractionId?: string;
  };

export interface WorkerResult {
  ok: boolean;
  failureCode: FailureCode | null;
  providerCalls: number;
  jobId: string | null;
  extractionId: string | null;
  disposition: ResultDisposition | null;
  detail: string;
}

export interface CasCompleteInput {
  jobId: string;
  workerId: string;
  claimToken: string;
  status: JobStatus;
  resultDisposition?: ResultDisposition | null;
  extractionId?: string | null;
  contentSha256?: string | null;
  errorCode?: string | null;
  errorDetail?: string | null;
  nextAttemptAt?: string | null;
}
