import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { MODULE_KEY, PROMPT_VERSION, SCHEMA_VERSION } from "./contract.ts";
import {
  runQuoteIntelligenceWorker,
  type WorkerConfig,
} from "./orchestrator.ts";
import type { QuoteIntelligencePorts } from "./ports.ts";
import type {
  CasCompleteInput,
  ClaimedJob,
  ContentLease,
  PersistSuccessResult,
} from "./types.ts";

const WORKER_ID = "qi-test-worker";
const FILE_BYTES = new TextEncoder().encode("quote-bytes-v1");

function futureIso(msFromNow: number): string {
  return new Date(Date.now() + msFromNow).toISOString();
}

function claimedJob(overrides: Partial<ClaimedJob> = {}): ClaimedJob {
  return {
    job_id: "11111111-1111-4111-8111-111111111111",
    quote_file_id: "22222222-2222-4222-8222-222222222222",
    scan_session_id: null,
    analysis_id: null,
    lead_id: null,
    module_key: MODULE_KEY,
    schema_version: SCHEMA_VERSION,
    prompt_version: PROMPT_VERSION,
    status: "processing",
    attempt_count: 1,
    max_attempts: 5,
    worker_id: WORKER_ID,
    claim_token: "33333333-3333-4333-8333-333333333333",
    claimed_at: new Date().toISOString(),
    lease_expires_at: futureIso(300_000),
    content_sha256: null,
    extraction_id: null,
    ...overrides,
  };
}

function acquiredLease(overrides: Partial<ContentLease> = {}): ContentLease {
  return {
    acquired: true,
    already_extracted: false,
    lease_id: "44444444-4444-4444-8444-444444444444",
    claim_token: "55555555-5555-4555-8555-555555555555",
    lease_expires_at: futureIso(300_000),
    existing_extraction_id: null,
    ...overrides,
  };
}

interface MockState {
  providerCalls: number;
  casCalls: CasCompleteInput[];
  releaseTokens: string[];
}

function createMockPorts(
  state: MockState,
  overrides: Partial<QuoteIntelligencePorts>,
): QuoteIntelligencePorts {
  return {
    atomicPersistenceAvailable: true,
    now: () => new Date(),
    claimJobs: async () => [],
    getQuoteFile: async () => ({
      id: "22222222-2222-4222-8222-222222222222",
      storage_path: "quotes/test.pdf",
    }),
    downloadQuoteBytes: async () => FILE_BYTES,
    lookupExtraction: async () => null,
    acquireContentLease: async () => acquiredLease(),
    releaseContentLease: async (_identity, _worker, token) => {
      state.releaseTokens.push(token);
      return true;
    },
    casComplete: async (input) => {
      state.casCalls.push(input);
      return true;
    },
    callProvider: async () => {
      state.providerCalls += 1;
      return {
        ok: true,
        text: JSON.stringify({
          document_type: "quote",
          is_window_door_related: true,
          extraction_confidence: 0.9,
          contractor_raw_name: "Acme Windows",
          contract_total: "$0.00",
          total_openings: 8,
          county_name: "Miami-Dade",
          zip_code: "33139",
        }),
        modelId: "gemini-2.0-flash",
        metadata: {},
      };
    },
    persistSuccess: async () =>
      ({
        ok: false,
        code: "SCHEMA_GAP_ATOMIC_PERSISTENCE",
      }) satisfies PersistSuccessResult,
    ...overrides,
  };
}

const longLeaseConfig: WorkerConfig = {
  jobLeaseSeconds: 300,
  contentLeaseSeconds: 300,
  providerTimeoutMs: 1_000,
  safetyMarginMs: 100,
  retryDelaySeconds: 30,
};

Deno.test("no claimable job returns NO_WORK without provider calls", async () => {
  const state: MockState = {
    providerCalls: 0,
    casCalls: [],
    releaseTokens: [],
  };
  const ports = createMockPorts(state, {
    claimJobs: async () => [],
    callProvider: async () => {
      state.providerCalls += 1;
      return { ok: false, retryable: true };
    },
  });
  const out = await runQuoteIntelligenceWorker(
    ports,
    WORKER_ID,
    longLeaseConfig,
  );
  assertEquals(out.failureCode, "NO_WORK");
  assertEquals(out.ok, true);
  assertEquals(out.providerCalls, 0);
  assertEquals(state.casCalls.length, 0);
});

Deno.test("existing extraction suppresses provider calls", async () => {
  const state: MockState = {
    providerCalls: 0,
    casCalls: [],
    releaseTokens: [],
  };
  const ports = createMockPorts(state, {
    claimJobs: async () => [claimedJob()],
    lookupExtraction: async () => ({ id: "ext-existing" }),
    callProvider: async () => {
      state.providerCalls += 1;
      return { ok: false, retryable: true };
    },
  });
  const out = await runQuoteIntelligenceWorker(
    ports,
    WORKER_ID,
    longLeaseConfig,
  );
  assertEquals(out.ok, true);
  assertEquals(out.providerCalls, 0);
  assertEquals(out.disposition, "skipped_existing_extraction");
  assertEquals(state.casCalls[0]?.status, "completed");
  assertEquals(state.casCalls[0]?.extractionId, "ext-existing");
});

Deno.test("live execution lease elsewhere suppresses provider calls", async () => {
  const state: MockState = {
    providerCalls: 0,
    casCalls: [],
    releaseTokens: [],
  };
  const ports = createMockPorts(state, {
    claimJobs: async () => [claimedJob()],
    acquireContentLease: async () => ({
      acquired: false,
      already_extracted: false,
      lease_id: null,
      claim_token: null,
      lease_expires_at: null,
      existing_extraction_id: null,
    }),
    callProvider: async () => {
      state.providerCalls += 1;
      return { ok: false, retryable: true };
    },
  });
  const out = await runQuoteIntelligenceWorker(
    ports,
    WORKER_ID,
    longLeaseConfig,
  );
  assertEquals(out.failureCode, "LEASE_UNAVAILABLE");
  assertEquals(out.providerCalls, 0);
  assertEquals(state.casCalls[0]?.resultDisposition, "skipped_lease_held");
});

Deno.test("insufficient remaining lease budget suppresses provider calls", async () => {
  const state: MockState = {
    providerCalls: 0,
    casCalls: [],
    releaseTokens: [],
  };
  const ports = createMockPorts(state, {
    claimJobs: async () => [
      claimedJob({ lease_expires_at: futureIso(500) }),
    ],
    acquireContentLease: async () =>
      acquiredLease({ lease_expires_at: futureIso(500) }),
    callProvider: async () => {
      state.providerCalls += 1;
      return { ok: false, retryable: true };
    },
  });
  const tight: WorkerConfig = {
    ...longLeaseConfig,
    providerTimeoutMs: 20_000,
    safetyMarginMs: 5_000,
  };
  const out = await runQuoteIntelligenceWorker(ports, WORKER_ID, tight);
  assertEquals(out.failureCode, "INSUFFICIENT_LEASE_BUDGET");
  assertEquals(out.providerCalls, 0);
  assertEquals(state.releaseTokens.length, 1);
});

Deno.test("malformed provider payload yields no authoritative observations", async () => {
  const state: MockState = {
    providerCalls: 0,
    casCalls: [],
    releaseTokens: [],
  };
  const ports = createMockPorts(state, {
    atomicPersistenceAvailable: true,
    claimJobs: async () => [claimedJob()],
    callProvider: async () => {
      state.providerCalls += 1;
      return {
        ok: true,
        text: "not-json",
        modelId: "gemini-2.0-flash",
        metadata: {},
      };
    },
    persistSuccess: async () => {
      throw new Error("persist must not run");
    },
  });
  const out = await runQuoteIntelligenceWorker(
    ports,
    WORKER_ID,
    longLeaseConfig,
  );
  assertEquals(out.failureCode, "PROVIDER_INVALID_OUTPUT");
  assertEquals(out.providerCalls, 1);
  assertEquals(state.casCalls[0]?.status, "retryable_failed");
});

Deno.test("stale job token rejects state transition", async () => {
  const state: MockState = {
    providerCalls: 0,
    casCalls: [],
    releaseTokens: [],
  };
  const ports = createMockPorts(state, {
    claimJobs: async () => [claimedJob()],
    lookupExtraction: async () => ({ id: "ext-existing" }),
    casComplete: async (input) => {
      state.casCalls.push(input);
      return false;
    },
  });
  const out = await runQuoteIntelligenceWorker(
    ports,
    WORKER_ID,
    longLeaseConfig,
  );
  assertEquals(out.failureCode, "OWNERSHIP_LOST");
  assertEquals(out.ok, false);
});

Deno.test("stale content-lease token is treated as ownership loss", async () => {
  const state: MockState = {
    providerCalls: 0,
    casCalls: [],
    releaseTokens: [],
  };
  const ports = createMockPorts(state, {
    claimJobs: async () => [claimedJob()],
    persistSuccess: async () => ({
      ok: true,
      extractionId: "ext-new",
      reusedExisting: false,
    }),
    releaseContentLease: async () => false,
  });
  const out = await runQuoteIntelligenceWorker(
    ports,
    WORKER_ID,
    longLeaseConfig,
  );
  assertEquals(out.failureCode, "OWNERSHIP_LOST");
  assertEquals(out.providerCalls, 1);
});

Deno.test("extraction uniqueness race reuses winner without provider", async () => {
  const state: MockState = {
    providerCalls: 0,
    casCalls: [],
    releaseTokens: [],
  };
  let lookups = 0;
  const ports = createMockPorts(state, {
    claimJobs: async () => [claimedJob()],
    lookupExtraction: async () => {
      lookups += 1;
      if (lookups === 1) return null;
      return { id: "ext-winner" };
    },
    callProvider: async () => {
      state.providerCalls += 1;
      return { ok: false, retryable: true };
    },
  });
  const out = await runQuoteIntelligenceWorker(
    ports,
    WORKER_ID,
    longLeaseConfig,
  );
  assertEquals(out.ok, true);
  assertEquals(out.extractionId, "ext-winner");
  assertEquals(out.providerCalls, 0);
  assertEquals(out.detail, "extraction_uniqueness_race");
});

Deno.test("private file failure maps to safe terminal error", async () => {
  const state: MockState = {
    providerCalls: 0,
    casCalls: [],
    releaseTokens: [],
  };
  const ports = createMockPorts(state, {
    claimJobs: async () => [claimedJob()],
    getQuoteFile: async () => null,
  });
  const out = await runQuoteIntelligenceWorker(
    ports,
    WORKER_ID,
    longLeaseConfig,
  );
  assertEquals(out.failureCode, "PRIVATE_FILE_MISSING");
  assertEquals(out.providerCalls, 0);
  assertEquals(state.casCalls[0]?.status, "terminal_failed");
  assertEquals(state.casCalls[0]?.errorDetail, "private_file_unavailable");
});

Deno.test("persistence RPC failure uses safe failure classification", async () => {
  const state: MockState = {
    providerCalls: 0,
    casCalls: [],
    releaseTokens: [],
  };
  const ports = createMockPorts(state, {
    claimJobs: async () => [claimedJob()],
    persistSuccess: async () => ({
      ok: false,
      code: "PERSISTENCE_FAILURE",
    }),
  });
  const out = await runQuoteIntelligenceWorker(
    ports,
    WORKER_ID,
    longLeaseConfig,
  );
  assertEquals(out.failureCode, "PERSISTENCE_FAILURE");
  assertEquals(out.providerCalls, 1);
  assertEquals(state.casCalls[0]?.status, "retryable_failed");
  assertEquals(state.casCalls[0]?.errorCode, "persistence_failed");
});

Deno.test("successful new extraction is no longer blocked by schema gap", async () => {
  const state: MockState = {
    providerCalls: 0,
    casCalls: [],
    releaseTokens: [],
  };
  const ports = createMockPorts(state, {
    claimJobs: async () => [claimedJob()],
    persistSuccess: async () => ({
      ok: true,
      extractionId: "ext-live",
      reusedExisting: false,
    }),
  });
  const out = await runQuoteIntelligenceWorker(
    ports,
    WORKER_ID,
    longLeaseConfig,
  );
  assertEquals(out.ok, true);
  assertEquals(out.providerCalls, 1);
  assertEquals(out.disposition, "extracted");
  assertEquals(out.failureCode, null);
  assertEquals(state.casCalls[0]?.errorCode, undefined);
});

Deno.test("atomic persist adapter completes extracted jobs", async () => {
  const state: MockState = {
    providerCalls: 0,
    casCalls: [],
    releaseTokens: [],
  };
  const ports = createMockPorts(state, {
    atomicPersistenceAvailable: true,
    claimJobs: async () => [claimedJob()],
    persistSuccess: async () => ({
      ok: true,
      extractionId: "ext-new",
      reusedExisting: false,
    }),
  });
  const out = await runQuoteIntelligenceWorker(
    ports,
    WORKER_ID,
    longLeaseConfig,
  );
  assertEquals(out.ok, true);
  assertEquals(out.providerCalls, 1);
  assertEquals(out.disposition, "extracted");
  assertEquals(state.casCalls[0]?.extractionId, "ext-new");
});

Deno.test("persist uniqueness race reuses winner extraction id", async () => {
  const state: MockState = {
    providerCalls: 0,
    casCalls: [],
    releaseTokens: [],
  };
  const ports = createMockPorts(state, {
    atomicPersistenceAvailable: true,
    claimJobs: async () => [claimedJob()],
    persistSuccess: async () => ({
      ok: true,
      extractionId: "ext-winner-2",
      reusedExisting: true,
    }),
  });
  const out = await runQuoteIntelligenceWorker(
    ports,
    WORKER_ID,
    longLeaseConfig,
  );
  assertEquals(out.ok, true);
  assertEquals(out.disposition, "skipped_existing_extraction");
  assertEquals(out.extractionId, "ext-winner-2");
});

Deno.test("CAS payload always includes job id, worker id, and claim token", async () => {
  const state: MockState = {
    providerCalls: 0,
    casCalls: [],
    releaseTokens: [],
  };
  const job = claimedJob();
  const ports = createMockPorts(state, {
    claimJobs: async () => [job],
    lookupExtraction: async () => ({ id: "ext-existing" }),
  });
  await runQuoteIntelligenceWorker(ports, WORKER_ID, longLeaseConfig);
  assertEquals(state.casCalls[0]?.jobId, job.job_id);
  assertEquals(state.casCalls[0]?.workerId, WORKER_ID);
  assertEquals(state.casCalls[0]?.claimToken, job.claim_token);
  assert(state.casCalls[0]?.contentSha256);
});
