import type { FailureCode, JobStatus, ResultDisposition } from "./types.ts";

export interface FailureMapping {
  jobStatus: JobStatus;
  disposition: ResultDisposition;
  errorCode: string;
  errorDetail: string;
  nextAttemptAtIso: string | null;
}

const SAFE_DETAILS: Record<FailureCode, string> = {
  NO_WORK: "no_claimable_job",
  LEASE_UNAVAILABLE: "content_lease_held",
  OWNERSHIP_LOST: "ownership_lost",
  PRIVATE_FILE_MISSING: "private_file_unavailable",
  PROVIDER_RETRYABLE: "provider_retryable",
  PROVIDER_INVALID_OUTPUT: "provider_invalid_output",
  PERSISTENCE_FAILURE: "persistence_failed",
  INSUFFICIENT_LEASE_BUDGET: "insufficient_lease_budget",
  UNEXPECTED_INTERNAL: "unexpected_internal",
};

export function mapFailure(
  code: FailureCode,
  now: Date,
  retryDelaySeconds: number,
): FailureMapping | null {
  if (code === "NO_WORK" || code === "OWNERSHIP_LOST") {
    return null;
  }

  const detail = SAFE_DETAILS[code];
  const retryAt = new Date(now.getTime() + retryDelaySeconds * 1000)
    .toISOString();

  if (code === "PRIVATE_FILE_MISSING") {
    return {
      jobStatus: "terminal_failed",
      disposition: "terminal_error",
      errorCode: "private_file_missing",
      errorDetail: detail,
      nextAttemptAtIso: null,
    };
  }

  if (code === "PERSISTENCE_FAILURE") {
    return {
      jobStatus: "retryable_failed",
      disposition: "retryable_error",
      errorCode: "persistence_failed",
      errorDetail: detail,
      nextAttemptAtIso: retryAt,
    };
  }

  if (code === "LEASE_UNAVAILABLE") {
    return {
      jobStatus: "retryable_failed",
      disposition: "skipped_lease_held",
      errorCode: "lease_unavailable",
      errorDetail: detail,
      nextAttemptAtIso: retryAt,
    };
  }

  return {
    jobStatus: "retryable_failed",
    disposition: "retryable_error",
    errorCode: detail.slice(0, 64),
    errorDetail: detail,
    nextAttemptAtIso: retryAt,
  };
}
