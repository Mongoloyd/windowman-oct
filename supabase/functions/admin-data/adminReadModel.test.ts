import {
  assertBrowserSafeAdminPayload,
  AdminForbiddenPayloadError,
  ANALYSIS_ADMIN_SUMMARY_SELECT,
  ANALYSIS_FETCH_LEAD_ANALYSIS_SELECT,
  enrichLeadForEvidenceView,
  findForbiddenBrowserKey,
  LEAD_EVIDENCE_LEAD_SELECT,
  NEEDS_REVIEW_LEAD_SELECT,
  pickLatestByCreatedAt,
  pickLatestScanForLead,
  pickLatestScanWithQuoteFileForLead,
  ABSENT_LEAD_DENORM_COLUMNS,
  STAGE_LEAD_BASE_SELECT,
  summarizeFlagCounts,
} from "./adminReadModel.ts";
import { formatErrorForLog } from "./adminDataLog.ts";
import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("pickLatestByCreatedAt chooses newest created_at", () => {
  const latest = pickLatestByCreatedAt([
    { id: "a", created_at: "2026-01-01T00:00:00Z" },
    { id: "b", created_at: "2026-02-01T00:00:00Z" },
  ]);
  assertEquals(latest?.id, "b");
});

Deno.test("pickLatestScanForLead ignores other lead sessions", () => {
  const scan = pickLatestScanForLead(
    [
      {
        id: "s1",
        lead_id: "other",
        quote_file_id: null,
        status: "done",
        created_at: "2026-03-01T00:00:00Z",
        updated_at: "2026-03-01T00:00:00Z",
      },
      {
        id: "s2",
        lead_id: "lead-a",
        quote_file_id: "f1",
        status: "done",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "s3",
        lead_id: "lead-a",
        quote_file_id: "f2",
        status: "done",
        created_at: "2026-02-01T00:00:00Z",
        updated_at: "2026-02-01T00:00:00Z",
      },
    ],
    "lead-a",
  );
  assertEquals(scan?.id, "s3");
});

Deno.test("enrichLeadForEvidenceView derives scan and grade without lead columns", () => {
  const view = enrichLeadForEvidenceView(
    {
      id: "lead-a",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
      first_name: "A",
      last_name: null,
      email: null,
      phone_e164: null,
      city: null,
      county: null,
      zip: null,
      latest_analysis_id: null,
      status: "new",
    },
    {
      id: "scan-1",
      lead_id: "lead-a",
      quote_file_id: "file-1",
      status: "complete",
      created_at: "2026-01-01T01:00:00Z",
      updated_at: "2026-01-01T01:00:00Z",
    },
    {
      id: "analysis-1",
      lead_id: "lead-a",
      scan_session_id: "scan-1",
      grade: "B",
      analysis_status: "complete",
      confidence_score: 0.9,
      flags: [],
      dollar_delta: null,
      created_at: "2026-01-01T02:00:00Z",
      updated_at: "2026-01-01T02:00:00Z",
    },
  );
  assertEquals(view.latest_scan_session_id, "scan-1");
  assertEquals(view.grade, "B");
  assertEquals(view.state, null);
});

Deno.test("summarizeFlagCounts counts red severities", () => {
  const counts = summarizeFlagCounts([
    { severity: "red" },
    { severity: "yellow" },
    { severity: "red" },
  ]);
  assertEquals(counts.flag_count, 3);
  assertEquals(counts.red_flag_count, 2);
});

Deno.test("findForbiddenBrowserKey detects nested full_json", () => {
  assertEquals(findForbiddenBrowserKey({ ok: true, data: { full_json: {} } }), "full_json");
  assertEquals(findForbiddenBrowserKey({ ok: true, data: { grade: "A" } }), null);
});

Deno.test("assertBrowserSafeAdminPayload fails closed on full_json", () => {
  assertThrows(
    () => assertBrowserSafeAdminPayload({ nested: { full_json: { x: 1 } } }),
    AdminForbiddenPayloadError,
  );
});

Deno.test("LEAD select constants exclude denormalized lead fields", () => {
  for (const sel of [LEAD_EVIDENCE_LEAD_SELECT, NEEDS_REVIEW_LEAD_SELECT, STAGE_LEAD_BASE_SELECT]) {
    assertEquals(sel.includes("latest_scan_session_id"), false);
    assertEquals(sel.includes("full_json"), false);
    assertEquals(/\bgrade\b/.test(sel), false);
    assertEquals(sel.includes("flag_count"), false);
    assertEquals(sel.includes("scan_count"), false);
    assertEquals(/\bstate\b/.test(sel), false);
  }
});

Deno.test("pickLatestScanWithQuoteFileForLead skips sessions without quote_file_id", () => {
  const scan = pickLatestScanWithQuoteFileForLead(
    [
      {
        id: "s-new",
        lead_id: "lead-a",
        quote_file_id: null,
        status: "pending",
        created_at: "2026-03-01T00:00:00Z",
        updated_at: "2026-03-01T00:00:00Z",
      },
      {
        id: "s-old",
        lead_id: "lead-a",
        quote_file_id: "f1",
        status: "done",
        created_at: "2026-02-01T00:00:00Z",
        updated_at: "2026-02-01T00:00:00Z",
      },
    ],
    "lead-a",
  );
  assertEquals(scan?.id, "s-old");
});

Deno.test("stage lead select excludes absent denormalized lead columns", () => {
  for (const col of ABSENT_LEAD_DENORM_COLUMNS) {
    assertEquals(STAGE_LEAD_BASE_SELECT.includes(col), false);
  }
});

Deno.test("analysis summary select excludes full_json", () => {
  assertEquals(ANALYSIS_ADMIN_SUMMARY_SELECT.includes("full_json"), false);
  assertEquals(ANALYSIS_FETCH_LEAD_ANALYSIS_SELECT.includes("full_json"), false);
  assertEquals(ANALYSIS_FETCH_LEAD_ANALYSIS_SELECT.includes("preview_json"), true);
});

Deno.test("admin error formatting excludes raw backend details", () => {
  const formatted = formatErrorForLog({
    code: "23505",
    message: "duplicate email homeowner@example.com",
    details: "storage/path/private.pdf",
    hint: "sensitive hint",
  });
  assertEquals(formatted, {
    error_code: "23505",
    error_name: null,
  });
  const serialized = JSON.stringify(formatted);
  assertEquals(serialized.includes("homeowner@example.com"), false);
  assertEquals(serialized.includes("storage/path/private.pdf"), false);
});
