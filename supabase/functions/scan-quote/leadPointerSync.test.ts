import {
  assert,
  assertEquals,
  assertFalse,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  buildLeadPointerRpcArgs,
  buildLeadPointerSyncClientBody,
  buildMissingAnalysisIdLog,
  FORBIDDEN_LEAD_POINTER_KEYS,
  interpretLeadPointerRpcResult,
  LEAD_POINTER_RPC_NAME,
  LEAD_POINTER_RPC_OUTCOMES,
  LEAD_POINTER_SYNC_ERROR_CODE,
  type LeadPointerSyncLog,
  planLeadPointerSync,
  syncLeadAnalysisPointer,
} from "./leadPointerSync.ts";

const LEAD_ID = "11111111-1111-4111-8111-111111111111";
const ANALYSIS_ID = "22222222-2222-4222-8222-222222222222";
const SESSION_ID = "33333333-3333-4333-8333-333333333333";

const ALLOWED_LOG_KEYS = [
  "analysis_id",
  "detail",
  "lead_id",
  "outcome",
  "postgrest_code",
  "rpc",
  "scan_session_id",
];

type RpcCall = { name: string; args: Record<string, unknown> };

/** Minimal client stub. `from` throws so any direct table write fails loudly. */
function stubClient(
  respond: (call: RpcCall) => { data: unknown; error: unknown },
  calls: RpcCall[] = [],
): SupabaseClient {
  return {
    from(table: string) {
      throw new Error(`unexpected direct table access: ${table}`);
    },
    rpc(name: string, args: Record<string, unknown>) {
      const call = { name, args };
      calls.push(call);
      return Promise.resolve(respond(call));
    },
  } as unknown as SupabaseClient;
}

function okRow(overrides: Record<string, unknown> = {}) {
  return {
    data: [{
      updated: true,
      outcome: "updated",
      latest_analysis_id: ANALYSIS_ID,
      ...overrides,
    }],
    error: null,
  };
}

Deno.test("planLeadPointerSync skips session-only scans", () => {
  assertEquals(planLeadPointerSync(null, ANALYSIS_ID), { kind: "skip" });
  assertEquals(planLeadPointerSync(undefined, ANALYSIS_ID), { kind: "skip" });
  assertEquals(planLeadPointerSync("", ANALYSIS_ID), { kind: "skip" });
});

Deno.test("planLeadPointerSync blocks a lead-backed scan with no analysis id", () => {
  for (const missing of [null, undefined, "", "   "]) {
    assertEquals(planLeadPointerSync(LEAD_ID, missing), {
      kind: "missing_analysis_id",
      leadId: LEAD_ID,
    });
  }
});

Deno.test("planLeadPointerSync syncs when both ids are present", () => {
  assertEquals(planLeadPointerSync(LEAD_ID, ANALYSIS_ID), {
    kind: "sync",
    leadId: LEAD_ID,
    analysisId: ANALYSIS_ID,
  });
});

Deno.test("sync calls the exact rpc name with the exact argument keys", async () => {
  const calls: RpcCall[] = [];
  const supabase = stubClient(() => okRow(), calls);

  await syncLeadAnalysisPointer(supabase, {
    leadId: LEAD_ID,
    analysisId: ANALYSIS_ID,
    scanSessionId: SESSION_ID,
  });

  assertEquals(calls.length, 1);
  assertEquals(calls[0].name, "set_latest_complete_analysis_pointer");
  assertEquals(calls[0].name, LEAD_POINTER_RPC_NAME);
  assertEquals(Object.keys(calls[0].args).sort(), [
    "p_analysis_id",
    "p_lead_id",
  ]);
  assertEquals(calls[0].args, {
    p_lead_id: LEAD_ID,
    p_analysis_id: ANALYSIS_ID,
  });
});

Deno.test("sync never touches the leads table", async () => {
  const supabase = stubClient(() => okRow());

  const outcome = await syncLeadAnalysisPointer(supabase, {
    leadId: LEAD_ID,
    analysisId: ANALYSIS_ID,
    scanSessionId: SESSION_ID,
  });

  assertEquals(outcome.ok, true);
});

Deno.test("all four recognized rpc outcomes succeed", async () => {
  for (const outcome of LEAD_POINTER_RPC_OUTCOMES) {
    const supabase = stubClient(() =>
      okRow({ outcome, updated: outcome === "updated" })
    );

    const result = await syncLeadAnalysisPointer(supabase, {
      leadId: LEAD_ID,
      analysisId: ANALYSIS_ID,
      scanSessionId: SESSION_ID,
    });

    assert(result.ok, `expected ${outcome} to succeed`);
    if (result.ok) {
      assertEquals(result.row.outcome, outcome);
    }
  }
});

Deno.test("kept_newer accepts a pointer other than the candidate analysis", async () => {
  const newerAnalysisId = "44444444-4444-4444-8444-444444444444";
  const supabase = stubClient(() =>
    okRow({
      updated: false,
      outcome: "kept_newer",
      latest_analysis_id: newerAnalysisId,
    })
  );

  const result = await syncLeadAnalysisPointer(supabase, {
    leadId: LEAD_ID,
    analysisId: ANALYSIS_ID,
    scanSessionId: SESSION_ID,
  });

  assert(result.ok);
  if (result.ok) {
    assertEquals(result.row.updated, false);
    assertEquals(result.row.latest_analysis_id, newerAnalysisId);
  }
});

Deno.test("rpc error returns a generic client-safe failure", async () => {
  const supabase = stubClient(() => ({
    data: null,
    error: { code: "22023", message: "analysis_lead_mismatch" },
  }));

  const result = await syncLeadAnalysisPointer(supabase, {
    leadId: LEAD_ID,
    analysisId: ANALYSIS_ID,
    scanSessionId: SESSION_ID,
  });

  assertFalse(result.ok);
  if (!result.ok) {
    assertEquals(result.clientBody, {
      error: LEAD_POINTER_SYNC_ERROR_CODE,
      scan_session_id: SESSION_ID,
      analysis_status: "complete",
      scan_session_status: "processing",
    });
    assertEquals(result.log.detail, "rpc_error");
    assertEquals(result.log.postgrest_code, "22023");
    assertFalse("postgrest_message" in result.log);
    assertFalse("message" in result.log);
  }
});

Deno.test("malformed, missing, multiple, and unknown rows fail closed", async () => {
  const cases: Array<{ data: unknown; detail: string }> = [
    { data: null, detail: "rpc_result_missing" },
    { data: undefined, detail: "rpc_result_missing" },
    { data: [], detail: "rpc_result_missing" },
    {
      data: [
        { updated: true, outcome: "updated", latest_analysis_id: ANALYSIS_ID },
        { updated: false, outcome: "kept_newer", latest_analysis_id: LEAD_ID },
      ],
      detail: "rpc_result_multiple_rows",
    },
    { data: ["not-an-object"], detail: "rpc_result_malformed" },
    {
      data: [{ outcome: "updated", latest_analysis_id: ANALYSIS_ID }],
      detail: "rpc_result_malformed",
    },
    {
      data: [{
        updated: "yes",
        outcome: "updated",
        latest_analysis_id: ANALYSIS_ID,
      }],
      detail: "rpc_result_malformed",
    },
    {
      data: [{ updated: true, outcome: "updated", latest_analysis_id: null }],
      detail: "rpc_result_malformed",
    },
    {
      data: [{ updated: true, outcome: "updated", latest_analysis_id: "  " }],
      detail: "rpc_result_malformed",
    },
    {
      data: [{
        updated: true,
        outcome: "pointer_deleted",
        latest_analysis_id: ANALYSIS_ID,
      }],
      detail: "rpc_outcome_unrecognized",
    },
  ];

  for (const testCase of cases) {
    assertEquals(
      interpretLeadPointerRpcResult(testCase.data),
      { ok: false, detail: testCase.detail },
    );

    const supabase = stubClient(() => ({ data: testCase.data, error: null }));
    const result = await syncLeadAnalysisPointer(supabase, {
      leadId: LEAD_ID,
      analysisId: ANALYSIS_ID,
      scanSessionId: SESSION_ID,
    });

    assertFalse(result.ok, `expected ${testCase.detail} to fail closed`);
    if (!result.ok) {
      assertEquals(result.log.detail, testCase.detail);
      assertEquals(result.clientBody.error, LEAD_POINTER_SYNC_ERROR_CODE);
      assertEquals(result.clientBody.scan_session_status, "processing");
    }
  }
});

Deno.test("a single row object is accepted as exactly one row", () => {
  assertEquals(
    interpretLeadPointerRpcResult({
      updated: true,
      outcome: "already_current",
      latest_analysis_id: ANALYSIS_ID,
    }),
    {
      ok: true,
      row: {
        updated: true,
        outcome: "already_current",
        latest_analysis_id: ANALYSIS_ID,
      },
    },
  );
});

Deno.test("failure logs and client bodies expose identifiers only", async () => {
  const SENTINEL_QUOTE = "quote text sentinel";
  const SENTINEL_EMAIL = "homeowner@example.com";
  const SENTINEL_PHONE = "+15551234567";
  const SENTINEL_ADDRESS = "742 Evergreen Terrace, Springfield";

  const supabase = stubClient(() => ({
    data: null,
    error: {
      code: "42501",
      message:
        `permission denied: ${SENTINEL_QUOTE} ${SENTINEL_EMAIL} ${SENTINEL_PHONE} ${SENTINEL_ADDRESS}`,
      details: "raw row payload that must never be logged",
      hint: "another unsanitized field",
    },
  }));

  const result = await syncLeadAnalysisPointer(supabase, {
    leadId: LEAD_ID,
    analysisId: ANALYSIS_ID,
    scanSessionId: SESSION_ID,
  });

  assertFalse(result.ok);
  if (result.ok) return;

  for (const key of Object.keys(result.log)) {
    assert(ALLOWED_LOG_KEYS.includes(key), `unexpected log key: ${key}`);
  }
  assertFalse("postgrest_message" in result.log);
  assertFalse("details" in result.log);
  assertFalse("hint" in result.log);
  assertFalse("message" in result.log);

  assertEquals(Object.keys(result.clientBody).sort(), [
    "analysis_status",
    "error",
    "scan_session_id",
    "scan_session_status",
  ]);

  const serializedLog = JSON.stringify(result.log);
  const serializedBody = JSON.stringify(result.clientBody);
  for (
    const leaked of [
      "full_json",
      "preview_json",
      "ocr",
      "raw row payload",
      "another unsanitized field",
      SENTINEL_QUOTE,
      SENTINEL_EMAIL,
      SENTINEL_PHONE,
      SENTINEL_ADDRESS,
      "postgrest_message",
    ]
  ) {
    assertFalse(serializedLog.includes(leaked), `log leaked ${leaked}`);
    assertFalse(
      serializedBody.includes(leaked),
      `client body leaked ${leaked}`,
    );
  }
});

Deno.test("no helper payload carries funnel stage or denormalized lead fields", () => {
  const payloads: Array<Record<string, unknown>> = [
    buildLeadPointerRpcArgs(LEAD_ID, ANALYSIS_ID),
    buildLeadPointerSyncClientBody(SESSION_ID),
    buildMissingAnalysisIdLog(LEAD_ID, SESSION_ID) as unknown as Record<
      string,
      unknown
    >,
  ];

  for (const payload of payloads) {
    const serialized = JSON.stringify(payload);
    for (const key of FORBIDDEN_LEAD_POINTER_KEYS) {
      assertFalse(key in payload, `forbidden key present: ${key}`);
      assertFalse(serialized.includes(key), `forbidden key serialized: ${key}`);
    }
  }
});

Deno.test("missing analysis id produces a blocking log and client body", () => {
  const log: LeadPointerSyncLog = buildMissingAnalysisIdLog(
    LEAD_ID,
    SESSION_ID,
  );
  assertEquals(log.detail, "missing_analysis_id_after_upsert");
  assertEquals(log.lead_id, LEAD_ID);
  assertEquals(log.analysis_id, "");
  assertEquals(log.scan_session_id, SESSION_ID);
  assertEquals(log.rpc, LEAD_POINTER_RPC_NAME);

  assertEquals(
    buildLeadPointerSyncClientBody(SESSION_ID).analysis_status,
    "complete",
  );
});
