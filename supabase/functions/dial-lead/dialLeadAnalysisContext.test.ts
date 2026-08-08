import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildDialLeadWebhookAnalysisFields,
  countDialLeadFlags,
  DIAL_ANALYSIS_SELECT,
  DIAL_COMPLETED_ANALYSIS_STATUS,
  DIAL_LEAD_INVALID_CONTEXT_ERROR,
  DIAL_LEAD_LOOKUP_FAILED_ERROR,
  type DialLeadAnalysisContext,
  type DialLeadAnalysisRow,
  FORBIDDEN_LEAD_SNAPSHOT_KEYS,
  httpStatusForDialLeadContextFailure,
  loadDialLeadAnalysisContext,
  resolveDialLeadAnalysisContext,
} from "./dialLeadAnalysisContext.ts";

const LEAD_ID = "11111111-1111-4111-8111-111111111111";
const ANALYSIS_ID = "22222222-2222-4222-8222-222222222222";
const SESSION_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_LEAD = "44444444-4444-4444-8444-444444444444";

function validRow(
  overrides: Partial<DialLeadAnalysisRow> = {},
): DialLeadAnalysisRow {
  return {
    id: ANALYSIS_ID,
    lead_id: LEAD_ID,
    scan_session_id: SESSION_ID,
    analysis_status: DIAL_COMPLETED_ANALYSIS_STATUS,
    grade: "C",
    flags: [{ severity: "High", flag: "Missing NOA" }],
    ...overrides,
  };
}

function assertContextHasNoLeadSnapshotKeys(context: DialLeadAnalysisContext) {
  const keys = Object.keys(context);
  assert(!keys.includes("latest_scan_session_id"));
  assert(!keys.includes("full_json"));
}

Deno.test("no analysis pointer returns empty context without querying analyses", async () => {
  let analysesTouched = false;
  const supabase = {
    from(table: string) {
      if (table === "analyses") analysesTouched = true;
      throw new Error(`unexpected table ${table}`);
    },
  };

  const result = await loadDialLeadAnalysisContext(
    supabase as never,
    LEAD_ID,
    null,
  );
  assertEquals(result.ok, true);
  if (!result.ok) return;
  assertEquals(result.context, {
    analysis_id: null,
    scan_session_id: null,
    grade: null,
    flag_count: 0,
  });
  assertEquals(analysesTouched, false);
});

Deno.test("valid completed owned analysis resolves scan session, grade, and flag count", () => {
  const result = resolveDialLeadAnalysisContext(
    LEAD_ID,
    ANALYSIS_ID,
    validRow({ grade: "B", flags: [{}, {}] }),
  );
  assertEquals(result.ok, true);
  if (!result.ok) return;
  assertEquals(result.context.analysis_id, ANALYSIS_ID);
  assertEquals(result.context.scan_session_id, SESSION_ID);
  assertEquals(result.context.grade, "B");
  assertEquals(result.context.flag_count, 2);
  assertContextHasNoLeadSnapshotKeys(result.context);
});

Deno.test("analysis query enforces id, ownership, and completion predicates", async () => {
  const predicates: Array<[string, unknown]> = [];
  let selected = "";
  const analysisQuery = {
    eq(column: string, value: unknown) {
      predicates.push([column, value]);
      return analysisQuery;
    },
    maybeSingle() {
      assertEquals(predicates, [
        ["id", ANALYSIS_ID],
        ["lead_id", LEAD_ID],
        ["analysis_status", DIAL_COMPLETED_ANALYSIS_STATUS],
      ]);
      return Promise.resolve({ data: validRow(), error: null });
    },
  };
  const supabase = {
    from(table: string) {
      if (table === "analyses") {
        return {
          select(columns: string) {
            selected = columns;
            return analysisQuery;
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };

  const result = await loadDialLeadAnalysisContext(
    supabase as never,
    LEAD_ID,
    ANALYSIS_ID,
  );
  assertEquals(result.ok, true);
  assertEquals(selected, DIAL_ANALYSIS_SELECT);
  assert(!selected.includes("full_json"));
});

Deno.test("cross-lead analysis rejected as invalid_context", () => {
  const result = resolveDialLeadAnalysisContext(
    LEAD_ID,
    ANALYSIS_ID,
    validRow({ lead_id: OTHER_LEAD }),
  );
  assertEquals(result.ok, false);
  if (result.ok) return;
  assertEquals(result.kind, "invalid_context");
  assertEquals(result.errorMessage, DIAL_LEAD_INVALID_CONTEXT_ERROR);
});

Deno.test("pointer row ID mismatch rejected", () => {
  const result = resolveDialLeadAnalysisContext(
    LEAD_ID,
    ANALYSIS_ID,
    validRow({ id: "99999999-9999-4999-8999-999999999999" }),
  );
  assertEquals(result.ok, false);
});

Deno.test("non-complete analysis rejected", () => {
  const result = resolveDialLeadAnalysisContext(
    LEAD_ID,
    ANALYSIS_ID,
    validRow({ analysis_status: "processing" }),
  );
  assertEquals(result.ok, false);
});

Deno.test("missing scan session rejected", () => {
  const result = resolveDialLeadAnalysisContext(
    LEAD_ID,
    ANALYSIS_ID,
    validRow({ scan_session_id: null }),
  );
  assertEquals(result.ok, false);
});

Deno.test("query failure returns lookup_failed", async () => {
  const rawDatabaseError = {
    message: "phone=555 quote OCR full_json leak",
    details: "private",
    hint: "hint",
  };
  const query = {
    eq() {
      return query;
    },
    maybeSingle: () => Promise.resolve({ data: null, error: rawDatabaseError }),
  };
  const supabase = { from: () => ({ select: () => query }) };
  const logged: unknown[][] = [];
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    logged.push(args);
  };

  try {
    const result = await loadDialLeadAnalysisContext(
      supabase as never,
      LEAD_ID,
      ANALYSIS_ID,
    );
    assertEquals(result.ok, false);
    if (result.ok) return;
    assertEquals(result.kind, "lookup_failed");
    assertEquals(result.errorMessage, DIAL_LEAD_LOOKUP_FAILED_ERROR);
    assertEquals(logged.length, 1);
    const logPayload = JSON.stringify(logged);
    assert(logPayload.includes("analysis_context_lookup"));
    assert(!logPayload.includes(rawDatabaseError.message));
    assert(!logPayload.includes(rawDatabaseError.details));
    assertEquals(httpStatusForDialLeadContextFailure(result.kind), 500);
    const exposed = JSON.stringify({ result, logged });
    for (
      const forbidden of [
        rawDatabaseError.message,
        rawDatabaseError.details,
        rawDatabaseError.hint,
      ]
    ) {
      assert(!exposed.includes(forbidden));
    }
  } finally {
    console.error = originalConsoleError;
  }
});

Deno.test("missing analysis row returns invalid_context", async () => {
  const query = {
    eq() {
      return query;
    },
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
  };
  const supabase = { from: () => ({ select: () => query }) };
  const result = await loadDialLeadAnalysisContext(
    supabase as never,
    LEAD_ID,
    ANALYSIS_ID,
  );
  assertEquals(result.ok, false);
  if (result.ok) return;
  assertEquals(result.kind, "invalid_context");
  assertEquals(httpStatusForDialLeadContextFailure(result.kind), 400);
});

Deno.test("null or malformed flags produce deterministic zero", () => {
  assertEquals(countDialLeadFlags(null), 0);
  assertEquals(countDialLeadFlags("not-array"), 0);
  assertEquals(countDialLeadFlags([null, "bad", 1]), 0);
  assertEquals(countDialLeadFlags([{}, { severity: "High" }]), 2);
});

Deno.test("array flag entries do not increase flag count", () => {
  assertEquals(countDialLeadFlags([[], {}, null, "bad", 1]), 1);
});

Deno.test("full_json is absent from select and returned context", () => {
  assert(!DIAL_ANALYSIS_SELECT.includes("full_json"));
  const result = resolveDialLeadAnalysisContext(
    LEAD_ID,
    ANALYSIS_ID,
    validRow(),
  );
  assertEquals(result.ok, true);
  if (!result.ok) return;
  assert(!("full_json" in result.context));
  assert(!JSON.stringify(result.context).includes("full_json"));
});

Deno.test("webhook projection uses canonical analysis context", () => {
  const context: DialLeadAnalysisContext = {
    analysis_id: ANALYSIS_ID,
    scan_session_id: SESSION_ID,
    grade: "A",
    flag_count: 3,
  };
  assertEquals(buildDialLeadWebhookAnalysisFields(context), {
    scan_session_id: SESSION_ID,
    grade: "A",
    flag_count: 3,
  });
  assertEquals(
    buildDialLeadWebhookAnalysisFields({
      analysis_id: null,
      scan_session_id: null,
      grade: null,
      flag_count: 0,
    }),
    {
      scan_session_id: null,
      grade: null,
      flag_count: 0,
    },
  );
});

Deno.test("no lead snapshot keys appear in helper types or projections", () => {
  const projection = buildDialLeadWebhookAnalysisFields({
    analysis_id: ANALYSIS_ID,
    scan_session_id: SESSION_ID,
    grade: "C",
    flag_count: 1,
  });
  const keys = Object.keys(projection);
  assert(!keys.includes("latest_scan_session_id"));
  assertEquals(keys.sort(), ["flag_count", "grade", "scan_session_id"]);
  assertEquals(
    FORBIDDEN_LEAD_SNAPSHOT_KEYS.includes("latest_scan_session_id"),
    true,
  );
});

Deno.test("unsafe database messages cannot enter invalid_context responses", () => {
  const result = resolveDialLeadAnalysisContext(LEAD_ID, ANALYSIS_ID, null);
  assertEquals(result.ok, false);
  if (result.ok) return;
  assertEquals(result.kind, "invalid_context");
  const serialized = JSON.stringify(result);
  for (
    const forbidden of [
      "full_json",
      "OCR",
      "quote",
      "phone",
      "details",
      "hint",
    ]
  ) {
    assert(!serialized.includes(forbidden));
  }
});

Deno.test("index HTTP mapping uses 400 for invalid_context and 500 for lookup_failed", () => {
  assertEquals(httpStatusForDialLeadContextFailure("invalid_context"), 400);
  assertEquals(httpStatusForDialLeadContextFailure("lookup_failed"), 500);
});
