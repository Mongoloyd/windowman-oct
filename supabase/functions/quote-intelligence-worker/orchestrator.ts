import {
  DEFAULT_CONTENT_LEASE_SECONDS,
  DEFAULT_JOB_LEASE_SECONDS,
  DEFAULT_LEASE_RETRY_DELAY_SECONDS,
  DEFAULT_LEASE_SAFETY_MARGIN_MS,
  DEFAULT_PROVIDER_TIMEOUT_MS,
  MODULE_KEY,
  PROMPT_VERSION,
  PROVIDER,
  SCHEMA_VERSION,
} from "./contract.ts";
import { mapFailure } from "./classifier.ts";
import { sha256Hex } from "./hash.ts";
import { hasSufficientLeaseBudget } from "./leaseBudget.ts";
import { normalizeGeminiJsonText } from "./geminiJson.ts";
import { normalizeProviderExtraction } from "./normalizer.ts";
import type { QuoteIntelligencePorts } from "./ports.ts";
import { parseProviderJsonText } from "./schema.ts";
import type {
  CasCompleteInput,
  ExtractionIdentity,
  FailureCode,
  JobOwnership,
  WorkerResult,
} from "./types.ts";

const QUOTES_MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
};

export interface WorkerConfig {
  jobLeaseSeconds: number;
  contentLeaseSeconds: number;
  providerTimeoutMs: number;
  safetyMarginMs: number;
  retryDelaySeconds: number;
}

export const DEFAULT_WORKER_CONFIG: WorkerConfig = {
  jobLeaseSeconds: DEFAULT_JOB_LEASE_SECONDS,
  contentLeaseSeconds: DEFAULT_CONTENT_LEASE_SECONDS,
  providerTimeoutMs: DEFAULT_PROVIDER_TIMEOUT_MS,
  safetyMarginMs: DEFAULT_LEASE_SAFETY_MARGIN_MS,
  retryDelaySeconds: DEFAULT_LEASE_RETRY_DELAY_SECONDS,
};

function mimeFromPath(storagePath: string): string {
  const ext = storagePath.split(".").pop()?.toLowerCase() ?? "";
  return QUOTES_MIME[ext] ?? "application/octet-stream";
}

function result(
  partial: Partial<WorkerResult> & Pick<WorkerResult, "ok" | "detail">,
): WorkerResult {
  return {
    failureCode: null,
    providerCalls: 0,
    jobId: null,
    extractionId: null,
    disposition: null,
    ...partial,
  };
}

async function completeOwned(
  ports: QuoteIntelligencePorts,
  ownership: JobOwnership,
  input: Omit<CasCompleteInput, "jobId" | "workerId" | "claimToken">,
): Promise<boolean> {
  return await ports.casComplete({
    jobId: ownership.jobId,
    workerId: ownership.workerId,
    claimToken: ownership.claimToken,
    ...input,
  });
}

async function failOwned(
  ports: QuoteIntelligencePorts,
  ownership: JobOwnership,
  code: FailureCode,
  now: Date,
  retryDelaySeconds: number,
  extra?: { contentSha256?: string },
): Promise<WorkerResult> {
  const mapped = mapFailure(code, now, retryDelaySeconds);
  if (!mapped) {
    return result({
      ok: false,
      failureCode: code,
      jobId: ownership.jobId,
      detail: code === "OWNERSHIP_LOST" ? "ownership_lost" : "no_work",
    });
  }
  const casOk = await completeOwned(ports, ownership, {
    status: mapped.jobStatus,
    resultDisposition: mapped.disposition,
    errorCode: mapped.errorCode,
    errorDetail: mapped.errorDetail,
    nextAttemptAt: mapped.nextAttemptAtIso,
    contentSha256: extra?.contentSha256 ?? null,
  });
  if (!casOk) {
    return result({
      ok: false,
      failureCode: "OWNERSHIP_LOST",
      jobId: ownership.jobId,
      detail: "ownership_lost",
    });
  }
  return result({
    ok: false,
    failureCode: code,
    jobId: ownership.jobId,
    disposition: mapped.disposition,
    detail: mapped.errorDetail,
  });
}

export async function runQuoteIntelligenceWorker(
  ports: QuoteIntelligencePorts,
  workerId: string,
  config: WorkerConfig = DEFAULT_WORKER_CONFIG,
): Promise<WorkerResult> {
  let providerCalls = 0;
  const now = () => ports.now();

  let claimed;
  try {
    claimed = await ports.claimJobs(1, workerId, config.jobLeaseSeconds);
  } catch {
    return result({
      ok: false,
      failureCode: "UNEXPECTED_INTERNAL",
      detail: "claim_failed",
    });
  }

  if (!claimed.length) {
    return result({
      ok: true,
      failureCode: "NO_WORK",
      detail: "no_claimable_job",
    });
  }

  const job = claimed[0];
  const ownership: JobOwnership = {
    jobId: job.job_id,
    workerId,
    claimToken: job.claim_token,
    jobLeaseExpiresAt: new Date(job.lease_expires_at),
  };

  if (
    job.module_key !== MODULE_KEY ||
    job.schema_version !== SCHEMA_VERSION ||
    job.prompt_version !== PROMPT_VERSION
  ) {
    return await failOwned(
      ports,
      ownership,
      "UNEXPECTED_INTERNAL",
      now(),
      config.retryDelaySeconds,
    );
  }

  const quoteFile = await ports.getQuoteFile(job.quote_file_id);
  if (!quoteFile?.storage_path) {
    return await failOwned(
      ports,
      ownership,
      "PRIVATE_FILE_MISSING",
      now(),
      config.retryDelaySeconds,
    );
  }

  const bytes = await ports.downloadQuoteBytes(quoteFile.storage_path);
  if (!bytes || bytes.byteLength === 0) {
    return await failOwned(
      ports,
      ownership,
      "PRIVATE_FILE_MISSING",
      now(),
      config.retryDelaySeconds,
    );
  }

  const contentSha256 = await sha256Hex(bytes);
  const identity: ExtractionIdentity = {
    contentSha256,
    moduleKey: MODULE_KEY,
    schemaVersion: SCHEMA_VERSION,
    promptVersion: PROMPT_VERSION,
  };

  const existing = await ports.lookupExtraction(identity);
  if (existing) {
    const casOk = await completeOwned(ports, ownership, {
      status: "completed",
      resultDisposition: "skipped_existing_extraction",
      extractionId: existing.id,
      contentSha256,
    });
    if (!casOk) {
      return result({
        ok: false,
        failureCode: "OWNERSHIP_LOST",
        jobId: ownership.jobId,
        providerCalls,
        detail: "ownership_lost",
      });
    }
    return result({
      ok: true,
      jobId: ownership.jobId,
      extractionId: existing.id,
      providerCalls,
      disposition: "skipped_existing_extraction",
      detail: "existing_extraction",
    });
  }

  const lease = await ports.acquireContentLease(
    identity,
    workerId,
    config.contentLeaseSeconds,
  );

  if (lease.already_extracted && lease.existing_extraction_id) {
    const casOk = await completeOwned(ports, ownership, {
      status: "completed",
      resultDisposition: "skipped_existing_extraction",
      extractionId: lease.existing_extraction_id,
      contentSha256,
    });
    if (!casOk) {
      return result({
        ok: false,
        failureCode: "OWNERSHIP_LOST",
        jobId: ownership.jobId,
        providerCalls,
        detail: "ownership_lost",
      });
    }
    return result({
      ok: true,
      jobId: ownership.jobId,
      extractionId: lease.existing_extraction_id,
      providerCalls,
      disposition: "skipped_existing_extraction",
      detail: "existing_extraction",
    });
  }

  if (!lease.acquired || !lease.claim_token || !lease.lease_expires_at) {
    return await failOwned(
      ports,
      ownership,
      "LEASE_UNAVAILABLE",
      now(),
      config.retryDelaySeconds,
      { contentSha256 },
    );
  }

  const contentToken = lease.claim_token;
  let releaseOk = true;

  const release = async () => {
    releaseOk = await ports.releaseContentLease(
      identity,
      workerId,
      contentToken,
    );
  };

  try {
    const contentLeaseExpiresAt = new Date(lease.lease_expires_at);
    if (
      !hasSufficientLeaseBudget({
        jobLeaseExpiresAt: ownership.jobLeaseExpiresAt,
        contentLeaseExpiresAt,
        providerTimeoutMs: config.providerTimeoutMs,
        safetyMarginMs: config.safetyMarginMs,
        now: now(),
      })
    ) {
      await release();
      const failed = await failOwned(
        ports,
        ownership,
        "INSUFFICIENT_LEASE_BUDGET",
        now(),
        config.retryDelaySeconds,
        { contentSha256 },
      );
      if (!releaseOk && failed.failureCode !== "OWNERSHIP_LOST") {
        return result({
          ok: false,
          failureCode: "OWNERSHIP_LOST",
          jobId: ownership.jobId,
          providerCalls,
          detail: "content_lease_release_rejected",
        });
      }
      return { ...failed, providerCalls };
    }

    const raced = await ports.lookupExtraction(identity);
    if (raced) {
      await release();
      const casOk = await completeOwned(ports, ownership, {
        status: "completed",
        resultDisposition: "skipped_existing_extraction",
        extractionId: raced.id,
        contentSha256,
      });
      if (!casOk || !releaseOk) {
        return result({
          ok: false,
          failureCode: "OWNERSHIP_LOST",
          jobId: ownership.jobId,
          providerCalls,
          extractionId: raced.id,
          detail: "ownership_lost",
        });
      }
      return result({
        ok: true,
        jobId: ownership.jobId,
        extractionId: raced.id,
        providerCalls,
        disposition: "skipped_existing_extraction",
        detail: "extraction_uniqueness_race",
      });
    }

    providerCalls += 1;
    const providerResult = await ports.callProvider(
      bytes,
      mimeFromPath(quoteFile.storage_path),
    );
    if (!providerResult.ok) {
      await release();
      const failed = await failOwned(
        ports,
        ownership,
        "PROVIDER_RETRYABLE",
        now(),
        config.retryDelaySeconds,
        { contentSha256 },
      );
      return { ...failed, providerCalls };
    }

    const jsonText =
      normalizeGeminiJsonText(providerResult.text).normalizedText;
    const parsed = parseProviderJsonText(jsonText);
    if (!parsed.ok) {
      await release();
      const failed = await failOwned(
        ports,
        ownership,
        "PROVIDER_INVALID_OUTPUT",
        now(),
        config.retryDelaySeconds,
        { contentSha256 },
      );
      return { ...failed, providerCalls };
    }

    const normalized = normalizeProviderExtraction(identity, parsed.value);
    const persist = await ports.persistSuccess({
      identity,
      provider: PROVIDER,
      runtimeModelId: providerResult.modelId,
      validatedPayload: normalized.validatedPayload,
      normalizedPayload: normalized.normalizedPayload,
      fieldConfidence: normalized.fieldConfidence,
      providerCompletionMetadata: providerResult.metadata,
      usageMetadata: {},
      observations: normalized.observations,
    });

    await release();

    if (!releaseOk) {
      return result({
        ok: false,
        failureCode: "OWNERSHIP_LOST",
        jobId: ownership.jobId,
        providerCalls,
        detail: "content_lease_release_rejected",
      });
    }

    if (!persist.ok) {
      const failed = await failOwned(
        ports,
        ownership,
        "PERSISTENCE_FAILURE",
        now(),
        config.retryDelaySeconds,
        { contentSha256 },
      );
      return { ...failed, providerCalls };
    }

    const casOk = await completeOwned(ports, ownership, {
      status: "completed",
      resultDisposition: persist.reusedExisting
        ? "skipped_existing_extraction"
        : "extracted",
      extractionId: persist.extractionId,
      contentSha256,
    });
    if (!casOk) {
      return result({
        ok: false,
        failureCode: "OWNERSHIP_LOST",
        jobId: ownership.jobId,
        providerCalls,
        extractionId: persist.extractionId,
        detail: "ownership_lost",
      });
    }

    return result({
      ok: true,
      jobId: ownership.jobId,
      extractionId: persist.extractionId,
      providerCalls,
      disposition: persist.reusedExisting
        ? "skipped_existing_extraction"
        : "extracted",
      detail: persist.reusedExisting
        ? "extraction_uniqueness_race"
        : "extracted",
    });
  } catch {
    try {
      await release();
    } catch {
      /* ignore */
    }
    const failed = await failOwned(
      ports,
      ownership,
      "UNEXPECTED_INTERNAL",
      now(),
      config.retryDelaySeconds,
      { contentSha256 },
    );
    return { ...failed, providerCalls };
  }
}
