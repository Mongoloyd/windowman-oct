import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildHandoffEmailProjection,
  buildHandoffOpportunityProjection,
  countHandoffFlags,
  FORBIDDEN_LEAD_SNAPSHOT_KEYS,
  HANDOFF_COMPLETED_ANALYSIS_STATUS,
  type HandoffAnalysisContext,
  type HandoffAnalysisRow,
  loadHandoffAnalysisContext,
  parseHandoffFlags,
  resolveHandoffAnalysisContext,
} from "./handoffAnalysisContext.ts";

const LEAD_ID = "11111111-1111-4111-8111-111111111111";
const ANALYSIS_ID = "22222222-2222-4222-8222-222222222222";
const SESSION_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_LEAD = "44444444-4444-4444-8444-444444444444";

function validRow(
  overrides: Partial<HandoffAnalysisRow> = {},
): HandoffAnalysisRow {
  return {
    id: ANALYSIS_ID,
    lead_id: LEAD_ID,
    scan_session_id: SESSION_ID,
    analysis_status: HANDOFF_COMPLETED_ANALYSIS_STATUS,
    grade: "C",
    flags: [{ severity: "High", flag: "Missing NOA" }],
    full_json: {
      grade: "F",
      flags: [{
        severity: "Critical",
        flag: "ignored for count when column set",
      }],
      pillar_scores: { price: { grade: "D", summary: "High" } },
    },
    ...overrides,
  };
}

function assertContextHasNoLeadSnapshotKeys(context: HandoffAnalysisContext) {
  const keys = Object.keys(context);
  assert(!keys.includes("latest_scan_session_id"));
  for (
    const key of [
      "critical_flag_count",
      "red_flag_count",
      "amber_flag_count",
    ] as const
  ) {
    assert(!keys.includes(key));
  }
}

Deno.test("valid lead-owned completed analysis resolves context", () => {
  const result = resolveHandoffAnalysisContext(
    LEAD_ID,
    ANALYSIS_ID,
    validRow(),
  );
  assertEquals(result.ok, true);
  if (!result.ok) return;
  const ctx = result.context;
  assertEquals(ctx.analysis_id, ANALYSIS_ID);
  assertEquals(ctx.scan_session_id, SESSION_ID);
  assertEquals(ctx.grade, "C");
  assertEquals(ctx.flag_count, 1);
  assertContextHasNoLeadSnapshotKeys(ctx);
});

Deno.test("opportunity projection uses one canonical context", () => {
  const result = resolveHandoffAnalysisContext(
    LEAD_ID,
    ANALYSIS_ID,
    validRow({ grade: "B", flags: [{}, {}] }),
  );
  assertEquals(result.ok, true);
  if (!result.ok) return;

  const projection = buildHandoffOpportunityProjection(result.context);
  assertEquals(projection, {
    analysis_id: ANALYSIS_ID,
    scan_session_id: SESSION_ID,
    grade: "B",
    flag_count: 2,
  });
  assertEquals(Object.keys(projection).sort(), [
    "analysis_id",
    "flag_count",
    "grade",
    "scan_session_id",
  ]);
});

Deno.test("opportunity projection preserves nullable grade and zero flags", () => {
  const result = resolveHandoffAnalysisContext(
    LEAD_ID,
    ANALYSIS_ID,
    validRow({ grade: null, flags: null, full_json: null }),
  );
  assertEquals(result.ok, true);
  if (!result.ok) return;

  assertEquals(buildHandoffOpportunityProjection(result.context), {
    analysis_id: ANALYSIS_ID,
    scan_session_id: SESSION_ID,
    grade: null,
    flag_count: 0,
  });
});

Deno.test("missing latest_analysis_id rejects", () => {
  const result = resolveHandoffAnalysisContext(LEAD_ID, null, validRow());
  assertEquals(result.ok, false);
});

Deno.test("cross-lead analysis rejects", () => {
  const result = resolveHandoffAnalysisContext(
    LEAD_ID,
    ANALYSIS_ID,
    validRow({ lead_id: OTHER_LEAD }),
  );
  assertEquals(result.ok, false);
});

Deno.test("missing scan_session_id rejects", () => {
  const result = resolveHandoffAnalysisContext(
    LEAD_ID,
    ANALYSIS_ID,
    validRow({ scan_session_id: null }),
  );
  assertEquals(result.ok, false);
});

Deno.test("non-complete analysis rejects", () => {
  const result = resolveHandoffAnalysisContext(
    LEAD_ID,
    ANALYSIS_ID,
    validRow({ analysis_status: "processing" }),
  );
  assertEquals(result.ok, false);
});

Deno.test("nullable or malformed flags yield deterministic count from full_json", () => {
  assertEquals(
    countHandoffFlags(null, { flags: [{ severity: "Low" }, {}] }),
    2,
  );
  assertEquals(
    countHandoffFlags("not-array", { flags: [{ severity: "Low" }] }),
    1,
  );
  assertEquals(parseHandoffFlags(undefined).length, 0);
});

Deno.test("grade passes through without rescoring", () => {
  const result = resolveHandoffAnalysisContext(
    LEAD_ID,
    ANALYSIS_ID,
    validRow({ grade: "B", full_json: { grade: "F" } }),
  );
  assertEquals(result.ok, true);
  if (result.ok) assertEquals(result.context.grade, "B");
});

Deno.test("errors are generic and omit protected data", () => {
  const result = resolveHandoffAnalysisContext(LEAD_ID, ANALYSIS_ID, null);
  assertEquals(result.ok, false);
  if (result.ok) return;
  assertEquals(
    result.errorMessage,
    "Lead missing scan session or analysis data",
  );
  const serialized = JSON.stringify(result);
  for (
    const forbidden of [
      "full_json",
      "OCR",
      "quote",
      "phone",
      "email",
      "address",
      "message",
      "details",
      "hint",
    ]
  ) {
    assert(!serialized.includes(forbidden));
  }
});

Deno.test("analysis query enforces id, ownership, and completion predicates", async () => {
  const forbiddenLeadUpdates: string[] = [];
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
        ["analysis_status", HANDOFF_COMPLETED_ANALYSIS_STATUS],
      ]);
      return Promise.resolve({
        data: validRow(),
        error: null,
      });
    },
  };
  const supabase = {
    from(table: string) {
      if (table === "leads") {
        return {
          update(payload: Record<string, unknown>) {
            forbiddenLeadUpdates.push(JSON.stringify(payload));
            for (const key of FORBIDDEN_LEAD_SNAPSHOT_KEYS) {
              if (key in payload) {
                throw new Error(`FORBIDDEN_LEAD_UPDATE:${key}`);
              }
            }
            return { eq: () => ({ error: null }) };
          },
        };
      }
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

  const result = await loadHandoffAnalysisContext(
    supabase as never,
    LEAD_ID,
    ANALYSIS_ID,
  );
  assertEquals(result.ok, true);
  assert(selected.includes("full_json"));
  assertEquals(forbiddenLeadUpdates.length, 0);
});

Deno.test("query failures log only a fixed diagnostic and return generic error", async () => {
  const rawDatabaseError = {
    message: "phone=test@example.com quote OCR",
    details: "private address",
    hint: "full_json",
  };
  const query = {
    eq() {
      return query;
    },
    maybeSingle: () => Promise.resolve({ data: null, error: rawDatabaseError }),
  };
  const supabase = {
    from: () => ({
      select: () => query,
    }),
  };
  const logged: unknown[][] = [];
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    logged.push(args);
  };

  try {
    const result = await loadHandoffAnalysisContext(
      supabase as never,
      LEAD_ID,
      ANALYSIS_ID,
    );
    assertEquals(result, {
      ok: false,
      errorMessage: "Lead missing scan session or analysis data",
    });
    assertEquals(logged, [[
      "[send-contractor-handoff] Analysis context unavailable",
    ]]);
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

Deno.test("email projection uses full_json server-side only in nested field", () => {
  const projection = buildHandoffEmailProjection(validRow().full_json);
  assertEquals(projection.topFlags.length, 1);
  assertEquals(projection.pillarScores?.price?.grade, "D");

  const result = resolveHandoffAnalysisContext(
    LEAD_ID,
    ANALYSIS_ID,
    validRow({
      flags: [],
      full_json: {
        flags: [
          { severity: "Critical", flag: "A" },
          { severity: "High", flag: "B" },
          { severity: "Low", flag: "C" },
        ],
      },
    }),
  );
  assertEquals(result.ok, true);
  if (!result.ok) return;
  const ctx: HandoffAnalysisContext = result.context;
  assertEquals(ctx.flag_count, 3);
  assertEquals(ctx.emailProjection.topFlags.length, 2);
});
