import {
  assert,
  assertEquals,
  assertFalse,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  type AuthorizedAnalysisRow,
  type ContractorBriefAdmissionOperation,
  handleGenerateContractorBriefRequest,
} from "./index.ts";

const PHONE = "+13055550123";
const SCAN_ID = "11111111-1111-4111-8111-111111111111";
const LEAD_ID = "22222222-2222-4222-8222-222222222222";
const ANALYSIS_ID = "33333333-3333-4333-8333-333333333333";
const OPPORTUNITY_ID = "44444444-4444-4444-8444-444444444444";

interface RpcResult {
  data: unknown;
  error: unknown;
}

interface RecordedCalls {
  rpc: Array<{ name: string; args: Record<string, unknown> }>;
  from: string[];
  updates: Array<{ table: string; payload: unknown }>;
  inserts: Array<{ table: string; payload: unknown }>;
}

interface InvokeOptions {
  request?: Request;
  supabase?: SupabaseClient;
  admitPublishable?: ContractorBriefAdmissionOperation;
}

function emptyCalls(): RecordedCalls {
  return {
    rpc: [],
    from: [],
    updates: [],
    inserts: [],
  };
}

function authorizedRow(
  overrides: Partial<AuthorizedAnalysisRow> = {},
): AuthorizedAnalysisRow {
  return {
    analysis_id: ANALYSIS_ID,
    grade: "D",
    flags: [{
      title: "Synthetic scope warning",
      severity: "Medium",
    }],
    full_json: { synthetic: true },
    proof_of_read: { synthetic: true },
    preview_json: { synthetic: true },
    confidence_score: 92,
    document_type: "window_quote",
    rubric_version: "synthetic-rubric",
    ...overrides,
  };
}

function unauthorizedSentinel(): Record<string, unknown> {
  return {
    analysis_id: null,
    grade: "__UNAUTHORIZED__",
    flags: null,
    full_json: null,
    proof_of_read: null,
    preview_json: null,
    confidence_score: null,
    document_type: null,
    rubric_version: null,
  };
}

function request(): Request {
  return new Request("http://localhost/generate-contractor-brief", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scan_session_id: SCAN_ID,
      phone_e164: PHONE,
      cta_source: "synthetic_test",
    }),
  });
}

const admitPublishable: ContractorBriefAdmissionOperation = () =>
  Promise.resolve({ error: null });

function rejectingClient(
  rpcResult: RpcResult,
  calls: RecordedCalls,
): SupabaseClient {
  return {
    rpc(name: string, args: Record<string, unknown>) {
      calls.rpc.push({ name, args });
      return Promise.resolve(rpcResult);
    },
    from(table: string) {
      calls.from.push(table);
      throw new Error(`unexpected privileged table access: ${table}`);
    },
  } as unknown as SupabaseClient;
}

function authorizedClient(
  calls: RecordedCalls,
  options: { existingOpportunity?: boolean } = {},
): SupabaseClient {
  function resultFor(
    table: string,
    operation: "select" | "update" | "insert" | null,
  ): { data: unknown; error: null } {
    if (table === "scan_sessions" && operation === "select") {
      return { data: { lead_id: LEAD_ID }, error: null };
    }
    if (table === "leads" && operation === "select") {
      return {
        data: {
          county: "Synthetic County",
          window_count: 8,
          project_type: "replacement",
          quote_range: "$10,000-$20,000",
          first_name: "Test",
        },
        error: null,
      };
    }
    if (table === "analyses" && operation === "select") {
      return { data: { id: ANALYSIS_ID }, error: null };
    }
    if (table === "contractors" && operation === "select") {
      return { data: [], error: null };
    }
    if (table === "contractor_opportunities" && operation === "select") {
      if (options.existingOpportunity) {
        return {
          data: {
            id: OPPORTUNITY_ID,
            suggested_match_snapshot: null,
            suggested_match_confidence: null,
            suggested_match_reasons: null,
            suggested_contractor_id: null,
          },
          error: null,
        };
      }
      return { data: null, error: null };
    }
    if (table === "contractor_opportunities" && operation === "insert") {
      return { data: { id: OPPORTUNITY_ID }, error: null };
    }
    return { data: null, error: null };
  }

  function queryBuilder(table: string) {
    let operation: "select" | "update" | "insert" | null = null;

    const builder = {
      select(_columns: string) {
        if (operation === null) operation = "select";
        return builder;
      },
      update(payload: unknown) {
        operation = "update";
        calls.updates.push({ table, payload });
        return builder;
      },
      insert(payload: unknown) {
        operation = "insert";
        calls.inserts.push({ table, payload });
        return builder;
      },
      eq(_column: string, _value: unknown) {
        return builder;
      },
      maybeSingle() {
        return Promise.resolve(resultFor(table, operation));
      },
      single() {
        return Promise.resolve(resultFor(table, operation));
      },
      then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
        onfulfilled?:
          | ((
            value: { data: unknown; error: null },
          ) => TResult1 | PromiseLike<TResult1>)
          | null,
        onrejected?:
          | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
          | null,
      ): Promise<TResult1 | TResult2> {
        return Promise.resolve(resultFor(table, operation)).then(
          onfulfilled,
          onrejected,
        );
      },
    };

    return builder;
  }

  return {
    rpc(name: string, args: Record<string, unknown>) {
      calls.rpc.push({ name, args });
      return Promise.resolve({ data: [authorizedRow()], error: null });
    },
    from(table: string) {
      calls.from.push(table);
      return queryBuilder(table);
    },
  } as unknown as SupabaseClient;
}

async function invokeWithoutExternalRequests(
  options: InvokeOptions,
): Promise<{ response: Response; externalRequestCount: number }> {
  const originalFetch = globalThis.fetch;
  let externalRequestCount = 0;
  globalThis.fetch = ((_input: string | URL | Request) => {
    externalRequestCount += 1;
    return Promise.reject(new Error("unexpected external request"));
  }) as typeof globalThis.fetch;

  try {
    const response = await handleGenerateContractorBriefRequest(
      options.request ?? request(),
      {
        supabase: options.supabase,
        admitPublishable: options.admitPublishable ?? admitPublishable,
      },
    );
    return { response, externalRequestCount };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function assertRejectedWithoutSideEffects(
  rpcResult: RpcResult,
  expectedStatus: number,
  forbiddenResponseFragments: string[] = [],
): Promise<void> {
  const calls = emptyCalls();
  const { response, externalRequestCount } =
    await invokeWithoutExternalRequests(
      { supabase: rejectingClient(rpcResult, calls) },
    );
  const responseText = await response.text();

  assertEquals(response.status, expectedStatus);
  assertEquals(calls.rpc, [{
    name: "get_analysis_full",
    args: {
      p_scan_session_id: SCAN_ID,
      p_phone_e164: PHONE,
    },
  }]);
  assertEquals(calls.from, []);
  assertEquals(calls.updates, []);
  assertEquals(calls.inserts, []);
  assertEquals(externalRequestCount, 0);
  assertEquals(
    responseText,
    JSON.stringify({
      error: expectedStatus === 403
        ? "Not authorized. Phone verification required."
        : "Internal server error.",
    }),
  );

  for (
    const forbidden of [
      PHONE,
      SCAN_ID,
      ANALYSIS_ID,
      "__UNAUTHORIZED__",
      ...forbiddenResponseFragments,
    ]
  ) {
    assertFalse(
      responseText.includes(forbidden),
      `response disclosed forbidden content: ${forbidden}`,
    );
  }
}

Deno.test(
  "CORS preflight succeeds without admission, parsing, RPC, or side effects",
  async () => {
    let admissionCalls = 0;
    let jsonCalls = 0;
    const calls = emptyCalls();
    const preflightRequest = {
      method: "OPTIONS",
      json() {
        jsonCalls += 1;
        throw new Error("preflight body must not be parsed");
      },
    } as unknown as Request;

    const { response, externalRequestCount } =
      await invokeWithoutExternalRequests({
        request: preflightRequest,
        supabase: rejectingClient(
          { data: [unauthorizedSentinel()], error: null },
          calls,
        ),
        admitPublishable: () => {
          admissionCalls += 1;
          return Promise.resolve({ error: null });
        },
      });

    const allowHeaders = response.headers.get("Access-Control-Allow-Headers") ??
      "";
    assertEquals(response.status, 200);
    assertEquals(admissionCalls, 0);
    assertEquals(jsonCalls, 0);
    assertEquals(calls.rpc, []);
    assertEquals(calls.from, []);
    assertEquals(calls.updates, []);
    assertEquals(calls.inserts, []);
    assertEquals(externalRequestCount, 0);
    assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
    for (
      const requiredHeader of [
        "authorization",
        "apikey",
        "content-type",
        "x-client-info",
      ]
    ) {
      assert(
        allowHeaders.split(",").map((header) => header.trim()).includes(
          requiredHeader,
        ),
        `preflight is missing ${requiredHeader}`,
      );
    }
  },
);

async function assertAdmissionRejected(
  syntheticAdmissionError: unknown,
  shouldThrow = false,
): Promise<void> {
  let admissionCalls = 0;
  let jsonCalls = 0;
  const calls = emptyCalls();
  const trackedRequest = {
    method: "POST",
    json() {
      jsonCalls += 1;
      return Promise.resolve({
        scan_session_id: SCAN_ID,
        phone_e164: PHONE,
      });
    },
  } as unknown as Request;

  const { response, externalRequestCount } =
    await invokeWithoutExternalRequests({
      request: trackedRequest,
      supabase: rejectingClient(
        { data: [unauthorizedSentinel()], error: null },
        calls,
      ),
      admitPublishable: () => {
        admissionCalls += 1;
        if (shouldThrow) {
          return Promise.reject(syntheticAdmissionError);
        }
        return Promise.resolve({ error: syntheticAdmissionError });
      },
    });
  const responseText = await response.text();

  assertEquals(response.status, 401);
  assertEquals(responseText, JSON.stringify({ error: "Unauthorized." }));
  assertFalse(responseText.includes(String(syntheticAdmissionError)));
  assertEquals(admissionCalls, 1);
  assertEquals(jsonCalls, 0);
  assertEquals(calls.rpc, []);
  assertEquals(calls.from, []);
  assertEquals(calls.updates, []);
  assertEquals(calls.inserts, []);
  assertEquals(externalRequestCount, 0);
}

Deno.test(
  "missing publishable admission returns a generic 401 before parsing or RPC",
  async () => {
    await assertAdmissionRejected("synthetic missing credential detail");
  },
);

Deno.test(
  "invalid publishable admission returns the same generic 401 without error disclosure",
  async () => {
    await assertAdmissionRejected("synthetic invalid credential detail");
  },
);

Deno.test(
  "thrown publishable admission failures return the same generic 401",
  async () => {
    await assertAdmissionRejected(
      new Error("synthetic admission infrastructure detail"),
      true,
    );
  },
);

Deno.test(
  "valid publishable admission permits body validation but empty body fields stop before RPC",
  async () => {
    const calls = emptyCalls();
    const emptyBodyRequest = new Request(
      "http://localhost/generate-contractor-brief",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      },
    );
    const { response, externalRequestCount } =
      await invokeWithoutExternalRequests({
        request: emptyBodyRequest,
        supabase: rejectingClient(
          { data: [authorizedRow()], error: null },
          calls,
        ),
      });

    assertEquals(response.status, 400);
    assertEquals(
      await response.text(),
      JSON.stringify({
        error: "scan_session_id and phone_e164 are required.",
      }),
    );
    assertEquals(calls.rpc, []);
    assertEquals(calls.from, []);
    assertEquals(calls.updates, []);
    assertEquals(calls.inserts, []);
    assertEquals(externalRequestCount, 0);
  },
);

Deno.test(
  "valid publishable admission rejects invalid JSON with the generic 400 before RPC",
  async () => {
    const calls = emptyCalls();
    const invalidJsonRequest = new Request(
      "http://localhost/generate-contractor-brief",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      },
    );
    const { response, externalRequestCount } =
      await invokeWithoutExternalRequests({
        request: invalidJsonRequest,
        supabase: rejectingClient(
          { data: [authorizedRow()], error: null },
          calls,
        ),
      });

    assertEquals(response.status, 400);
    assertEquals(calls.rpc, []);
    assertEquals(calls.from, []);
    assertEquals(calls.updates, []);
    assertEquals(calls.inserts, []);
    assertEquals(externalRequestCount, 0);
  },
);

Deno.test(
  "get_analysis_full caller authorization rejects exact unauthorized sentinel before side effects",
  async () => {
    await assertRejectedWithoutSideEffects(
      { data: [unauthorizedSentinel()], error: null },
      403,
    );
  },
);

Deno.test(
  "get_analysis_full caller authorization rejects RPC errors generically before side effects",
  async () => {
    await assertRejectedWithoutSideEffects(
      {
        data: [authorizedRow()],
        error: { message: "synthetic internal RPC detail" },
      },
      500,
      ["synthetic internal RPC detail"],
    );
  },
);

Deno.test(
  "get_analysis_full caller authorization rejects null results before side effects",
  async () => {
    await assertRejectedWithoutSideEffects(
      { data: null, error: null },
      403,
    );
  },
);

Deno.test(
  "get_analysis_full caller authorization rejects empty results before side effects",
  async () => {
    await assertRejectedWithoutSideEffects(
      { data: [], error: null },
      403,
    );
  },
);

Deno.test(
  "get_analysis_full caller authorization rejects malformed nonempty results before side effects",
  async () => {
    await assertRejectedWithoutSideEffects(
      {
        data: [{
          ...authorizedRow(),
          analysis_id: "malformed-analysis-id",
          full_json: { private_marker: "must-not-leak" },
        }],
        error: null,
      },
      500,
      ["malformed-analysis-id", "must-not-leak"],
    );
  },
);

Deno.test(
  "get_analysis_full caller authorization rejects unexpected cardinality before side effects",
  async () => {
    await assertRejectedWithoutSideEffects(
      { data: [authorizedRow(), authorizedRow()], error: null },
      500,
    );
  },
);

Deno.test(
  "get_analysis_full caller authorization preserves the authorized response and single side effects",
  async () => {
    const calls = emptyCalls();
    const { response, externalRequestCount } =
      await invokeWithoutExternalRequests(
        { supabase: authorizedClient(calls) },
      );
    const body = await response.json();

    assertEquals(response.status, 200);
    assertEquals(body, {
      success: true,
      opportunity_id: OPPORTUNITY_ID,
      analysis_id: ANALYSIS_ID,
      status: "brief_ready",
      suggested_match: null,
    });
    assertEquals(calls.rpc, [{
      name: "get_analysis_full",
      args: {
        p_scan_session_id: SCAN_ID,
        p_phone_e164: PHONE,
      },
    }]);
    assertEquals(
      calls.updates.filter((call) => call.table === "analyses").length,
      1,
    );
    assertEquals(
      calls.inserts.filter((call) => call.table === "contractor_opportunities")
        .length,
      1,
    );
    assertEquals(
      calls.inserts.filter((call) =>
        call.table === "event_logs" &&
        (call.payload as Record<string, unknown>).event_name ===
          "contractor_brief_generated"
      ).length,
      1,
    );
    assertEquals(
      calls.inserts.filter((call) =>
        call.table === "event_logs" &&
        (call.payload as Record<string, unknown>).event_name ===
          "suggested_match_unavailable"
      ).length,
      1,
    );
    assertEquals(externalRequestCount, 0);
    assert(calls.from.length > 0);
  },
);

Deno.test(
  "valid admission and authorization preserve the existing idempotent opportunity response",
  async () => {
    const calls = emptyCalls();
    const { response, externalRequestCount } =
      await invokeWithoutExternalRequests({
        supabase: authorizedClient(calls, { existingOpportunity: true }),
      });
    const body = await response.json();

    assertEquals(response.status, 200);
    assertEquals(body, {
      success: true,
      opportunity_id: OPPORTUNITY_ID,
      analysis_id: ANALYSIS_ID,
      status: "brief_ready",
      suggested_match: null,
      idempotent: true,
    });
    assertEquals(calls.rpc.length, 1);
    assertEquals(
      calls.inserts.filter((call) => call.table === "contractor_opportunities")
        .length,
      0,
    );
    assertEquals(
      calls.inserts.filter((call) => call.table === "event_logs").length,
      0,
    );
    assertEquals(externalRequestCount, 0);
  },
);
