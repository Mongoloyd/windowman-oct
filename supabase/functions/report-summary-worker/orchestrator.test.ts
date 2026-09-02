import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildFixtureMixedSource } from "../_shared/reportSummary/reportSummary.fixtures.ts";
import type { AnalysisRowForSummary } from "../_shared/reportSummary/buildSummarySourceFromAnalysis.ts";
import { buildFullSummaryFactPackV1 } from "../_shared/reportSummary/buildFullSummaryFactPackV1.ts";
import { hashFactPack } from "../_shared/reportSummary/hashFactPack.ts";
import type { ReportSummaryV1 } from "../_shared/reportSummary/types.ts";
import { SUMMARY_PROMPT_VERSION } from "../_shared/reportSummary/types.ts";
import { runReportSummaryWorker } from "./orchestrator.ts";
import type {
  CompleteSummaryInput,
  ReportSummaryWorkerPorts,
  SummaryClaim,
} from "./types.ts";

const WORKER_ID = "rs-test-worker";
const ANALYSIS_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_ANALYSIS_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function analysisRowFromFixture(
  source = buildFixtureMixedSource(),
): AnalysisRowForSummary {
  return {
    id: source.analysis_id,
    grade: source.grade,
    rubric_version: source.rubric_version,
    flags: source.flags,
    proof_of_read: {
      contractor_name: source.contractor_name_present ? "Acme Windows" : null,
    },
    full_json: {
      grade: source.grade,
      rubric_version: source.rubric_version,
      flags: source.flags,
      missing_items: source.missing_items,
      warnings: source.warnings,
      summary: source.summary,
      has_warranty: source.has_warranty,
      has_permits: source.has_permits,
    },
  };
}

function readySummary(inputPackHash: string): ReportSummaryV1 {
  return {
    summary_version: "report_summary_v1",
    prompt_version: SUMMARY_PROMPT_VERSION,
    summary_body: "Grounded summary body.",
    evidence_keys: ["subject_to_remeasure_clause"],
    action_step: null,
    highlights: [],
    status: "ready",
    input_pack_hash: inputPackHash,
  };
}

interface MockState {
  providerCalls: number;
  completeCalls: CompleteSummaryInput[];
  claimCalls: number;
}

function createMockPorts(
  state: MockState,
  overrides: Partial<ReportSummaryWorkerPorts> = {},
): ReportSummaryWorkerPorts {
  return {
    pickCandidate: async () => ({ analysis_id: ANALYSIS_ID }),
    loadAnalysis: async (analysisId) =>
      analysisId === ANALYSIS_ID ? analysisRowFromFixture() : null,
    getTerminalSummary: async () => null,
    claimGeneration: async () => {
      state.claimCalls += 1;
      return {
        summary_id: "11111111-1111-4111-8111-111111111111",
        claim_token: "22222222-2222-4222-8222-222222222222",
        prior_status: null,
        already_terminal: false,
      } satisfies SummaryClaim;
    },
    completeSummary: async (input) => {
      state.completeCalls.push(input);
      return true;
    },
    callProvider: async (factPack) => {
      state.providerCalls += 1;
      const inputPackHash = await hashFactPack(factPack);
      return {
        ok: true,
        summary: readySummary(inputPackHash),
        modelId: "gemini-test-model",
        inputPackHash,
      };
    },
    ...overrides,
  };
}

Deno.test("eligible completed analysis processes one summary", async () => {
  const state: MockState = { providerCalls: 0, completeCalls: [], claimCalls: 0 };
  const ports = createMockPorts(state);
  const result = await runReportSummaryWorker(ports, WORKER_ID, {
    leaseSeconds: 300,
  });

  assertEquals(result.ok, true);
  assertEquals(result.disposition, "ready");
  assertEquals(result.analysis_id, ANALYSIS_ID);
  assertEquals(state.providerCalls, 1);
  assertEquals(state.claimCalls, 1);
  assertEquals(state.completeCalls.length, 1);
  assertEquals(state.completeCalls[0].analysis_id, ANALYSIS_ID);
  assertEquals(state.completeCalls[0].status, "ready");
});

Deno.test("ready persistence stores validated summary json", async () => {
  const state: MockState = { providerCalls: 0, completeCalls: [], claimCalls: 0 };
  const ports = createMockPorts(state);
  await runReportSummaryWorker(ports, WORKER_ID, { leaseSeconds: 300 });

  const completed = state.completeCalls[0];
  assert(completed.summary_json);
  assertEquals(completed.summary_json?.status, "ready");
  assertEquals(completed.runtime_model_id, "gemini-test-model");
});

Deno.test("insufficient_facts persists without provider call for sparse packs", async () => {
  const state: MockState = { providerCalls: 0, completeCalls: [], claimCalls: 0 };
  const ports = createMockPorts(state, {
    loadAnalysis: async () => ({
      id: ANALYSIS_ID,
      grade: null,
      rubric_version: null,
      flags: [],
      proof_of_read: {},
      full_json: {
        grade: null,
        flags: [],
        missing_items: [],
        warnings: [],
        summary: null,
      },
    }),
  });

  const result = await runReportSummaryWorker(ports, WORKER_ID, {
    leaseSeconds: 300,
  });

  assertEquals(result.disposition, "insufficient_facts");
  assertEquals(state.providerCalls, 0);
  assertEquals(state.completeCalls[0].status, "insufficient_facts");
});

Deno.test("provider failure persists failed state only", async () => {
  const state: MockState = { providerCalls: 0, completeCalls: [], claimCalls: 0 };
  const ports = createMockPorts(state, {
    callProvider: async () => ({
      ok: false,
      failureClass: "http_error",
      retryable: true,
    }),
  });

  const result = await runReportSummaryWorker(ports, WORKER_ID, {
    leaseSeconds: 300,
  });

  assertEquals(result.ok, false);
  assertEquals(result.disposition, "failed");
  assertEquals(state.completeCalls[0].status, "failed");
  assertEquals(state.completeCalls[0].failure_class, "http_error");
  assertEquals(state.completeCalls[0].summary_json, undefined);
});

Deno.test("already-current ready summary skips provider call", async () => {
  const state: MockState = { providerCalls: 0, completeCalls: [], claimCalls: 0 };
  const source = buildFixtureMixedSource();
  const hash = await hashFactPack(buildFullSummaryFactPackV1(source));
  const ports = createMockPorts(state, {
    getTerminalSummary: async (_analysisId, _prompt, inputHash) =>
      inputHash === hash ? { status: "ready" } : null,
  });

  const result = await runReportSummaryWorker(ports, WORKER_ID, {
    leaseSeconds: 300,
  });

  assertEquals(result.disposition, "skipped_current");
  assertEquals(state.providerCalls, 0);
  assertEquals(state.claimCalls, 0);
});

Deno.test("wrong analysis identity cannot cross-write on load", async () => {
  const state: MockState = { providerCalls: 0, completeCalls: [], claimCalls: 0 };
  const ports = createMockPorts(state, {
    pickCandidate: async () => ({ analysis_id: OTHER_ANALYSIS_ID }),
    loadAnalysis: async (analysisId) =>
      analysisId === OTHER_ANALYSIS_ID ? null : analysisRowFromFixture(),
  });

  const result = await runReportSummaryWorker(ports, WORKER_ID, {
    leaseSeconds: 300,
  });

  assertEquals(result.ok, false);
  assertEquals(result.disposition, "analysis_unreadable");
  assertEquals(state.providerCalls, 0);
  assertEquals(state.completeCalls.length, 0);
});

Deno.test("one analysis maximum per invocation when no work exists", async () => {
  const state: MockState = { providerCalls: 0, completeCalls: [], claimCalls: 0 };
  let pickCalls = 0;
  const ports = createMockPorts(state, {
    pickCandidate: async () => {
      pickCalls += 1;
      return null;
    },
  });

  const result = await runReportSummaryWorker(ports, WORKER_ID, {
    leaseSeconds: 300,
  });

  assertEquals(result.disposition, "no_work");
  assertEquals(pickCalls, 1);
  assertEquals(state.providerCalls, 0);
});

Deno.test("claim conflict returns without provider call", async () => {
  const state: MockState = { providerCalls: 0, completeCalls: [], claimCalls: 0 };
  const ports = createMockPorts(state, {
    claimGeneration: async () => null,
  });

  const result = await runReportSummaryWorker(ports, WORKER_ID, {
    leaseSeconds: 300,
  });

  assertEquals(result.disposition, "claim_conflict");
  assertEquals(state.providerCalls, 0);
});

Deno.test("completeSummary binds analysis_id on every write", async () => {
  const state: MockState = { providerCalls: 0, completeCalls: [], claimCalls: 0 };
  const ports = createMockPorts(state);
  await runReportSummaryWorker(ports, WORKER_ID, { leaseSeconds: 300 });

  for (const call of state.completeCalls) {
    assertEquals(call.analysis_id, ANALYSIS_ID);
    assertEquals(call.worker_id, WORKER_ID);
  }
});
