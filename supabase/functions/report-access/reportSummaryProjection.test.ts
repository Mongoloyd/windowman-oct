import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  attachReportSummaryBody,
  extractDisplayEligibleSummaryBody,
  fullAuthorizationAllowsSummaryLookup,
  loadDisplayEligibleSummaryBody,
  REPORT_SUMMARY_BODY_FIELD,
  REPORT_SUMMARY_VERSION,
  stripPreviewUnsafeFields,
  UNAUTHORIZED_FULL_ENVELOPE,
  type ReportSummaryLookupClient,
  type ReportSummaryQueryBuilder,
  type SummaryLookupRow,
} from "./reportSummaryProjection.ts";

const ANALYSIS_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ANALYSIS_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const READY_BODY = "WindowMan found three high-risk gaps in this estimate.";

function readyRow(analysisId: string, body = READY_BODY): SummaryLookupRow & {
  analysis_id: string;
} {
  return {
    analysis_id: analysisId,
    status: "ready",
    summary_version: REPORT_SUMMARY_VERSION,
    summary_json: { summary_body: body },
    generated_at: "2026-09-01T00:00:00.000Z",
  };
}

function createFilteredLookupClient(
  rows: Array<SummaryLookupRow & { analysis_id: string }>,
): {
  client: ReportSummaryLookupClient;
  filters: Record<string, string>;
  table: string | null;
} {
  const filters: Record<string, string> = {};
  let table: string | null = null;

  const builder: ReportSummaryQueryBuilder = {
    select(_columns) {
      return builder;
    },
    eq(column, value) {
      filters[column] = value;
      return builder;
    },
    order(_column, _options) {
      return builder;
    },
    limit(_count) {
      return builder;
    },
    maybeSingle() {
      const match = rows.find((row) =>
        row.analysis_id === filters.analysis_id &&
        row.status === filters.status &&
        row.summary_version === filters.summary_version
      );
      return Promise.resolve({ data: match ?? null, error: null });
    },
  };

  return {
    client: {
      from(name) {
        table = name;
        return builder;
      },
    },
    filters,
    get table() {
      return table;
    },
  };
}

Deno.test("ready report_summary_v1 row yields summary_body", () => {
  assertEquals(
    extractDisplayEligibleSummaryBody(readyRow(ANALYSIS_A)),
    READY_BODY,
  );
});

Deno.test("empty ready summary_body is not display-eligible", () => {
  assertEquals(
    extractDisplayEligibleSummaryBody({
      ...readyRow(ANALYSIS_A),
      summary_json: { summary_body: "   " },
    }),
    null,
  );
});

Deno.test("failed summary prose is suppressed", () => {
  assertEquals(
    extractDisplayEligibleSummaryBody({
      analysis_id: ANALYSIS_A,
      status: "failed",
      summary_version: REPORT_SUMMARY_VERSION,
      summary_json: { summary_body: "Provider failed after retries." },
    }),
    null,
  );
});

Deno.test("insufficient_facts prose is suppressed", () => {
  assertEquals(
    extractDisplayEligibleSummaryBody({
      analysis_id: ANALYSIS_A,
      status: "insufficient_facts",
      summary_version: REPORT_SUMMARY_VERSION,
      summary_json: { summary_body: "Not enough facts to summarize." },
    }),
    null,
  );
});

Deno.test("processing and pending prose are suppressed", () => {
  for (const status of ["processing", "pending"]) {
    assertEquals(
      extractDisplayEligibleSummaryBody({
        analysis_id: ANALYSIS_A,
        status,
        summary_version: REPORT_SUMMARY_VERSION,
        summary_json: { summary_body: "Working on your summary." },
      }),
      null,
    );
  }
});

Deno.test("authorized full + ready row returns report_summary_body", async () => {
  const lookup = createFilteredLookupClient([readyRow(ANALYSIS_A)]);
  const body = await loadDisplayEligibleSummaryBody(lookup.client, ANALYSIS_A);
  assertEquals(lookup.table, "wm_report_summaries");
  assertEquals(lookup.filters.analysis_id, ANALYSIS_A);
  assertEquals(lookup.filters.status, "ready");
  assertEquals(lookup.filters.summary_version, REPORT_SUMMARY_VERSION);
  assertEquals(body, READY_BODY);
});

Deno.test("authorized full + no ready row returns null", async () => {
  const lookup = createFilteredLookupClient([]);
  const body = await loadDisplayEligibleSummaryBody(lookup.client, ANALYSIS_A);
  assertEquals(body, null);
});

Deno.test("failed / insufficient / processing rows are not selected", async () => {
  const lookup = createFilteredLookupClient([
    {
      analysis_id: ANALYSIS_A,
      status: "failed",
      summary_version: REPORT_SUMMARY_VERSION,
      summary_json: { summary_body: "failed prose" },
    },
    {
      analysis_id: ANALYSIS_A,
      status: "insufficient_facts",
      summary_version: REPORT_SUMMARY_VERSION,
      summary_json: { summary_body: "insufficient prose" },
    },
    {
      analysis_id: ANALYSIS_A,
      status: "processing",
      summary_version: REPORT_SUMMARY_VERSION,
      summary_json: { summary_body: "processing prose" },
    },
  ]);
  const body = await loadDisplayEligibleSummaryBody(lookup.client, ANALYSIS_A);
  assertEquals(body, null);
});

Deno.test("ready summary for analysis B never returns for analysis A", async () => {
  const lookup = createFilteredLookupClient([
    readyRow(ANALYSIS_B, "Summary belonging to analysis B."),
  ]);
  const body = await loadDisplayEligibleSummaryBody(lookup.client, ANALYSIS_A);
  assertEquals(lookup.filters.analysis_id, ANALYSIS_A);
  assertEquals(body, null);
});

Deno.test("authorization failure envelope contains no Summary V1 prose", () => {
  assertEquals(fullAuthorizationAllowsSummaryLookup("__UNAUTHORIZED__"), false);
  assertEquals(fullAuthorizationAllowsSummaryLookup("C"), true);
  assertEquals("data" in UNAUTHORIZED_FULL_ENVELOPE, false);
  assertEquals(
    REPORT_SUMMARY_BODY_FIELD in UNAUTHORIZED_FULL_ENVELOPE,
    false,
  );
  assertEquals(
    JSON.stringify(UNAUTHORIZED_FULL_ENVELOPE).includes("WindowMan"),
    false,
  );
});

Deno.test("preview strip removes Summary V1 and full_json", () => {
  const stripped = stripPreviewUnsafeFields({
    grade: "C",
    full_json: { summary: "deterministic full summary" },
    report_summary_body: READY_BODY,
    preview_json: { summary_teaser: "safe teaser" },
  });
  assertEquals("full_json" in stripped, false);
  assertEquals("report_summary_body" in stripped, false);
  assertEquals(stripped.preview_json, { summary_teaser: "safe teaser" });
  assertEquals(JSON.stringify(stripped).includes(READY_BODY), false);
});

Deno.test("attachReportSummaryBody adds only the nullable string field", () => {
  const attached = attachReportSummaryBody({ grade: "C" }, READY_BODY);
  assertEquals(attached.report_summary_body, READY_BODY);
  assertEquals(Object.keys(attached).sort(), ["grade", "report_summary_body"]);
});
