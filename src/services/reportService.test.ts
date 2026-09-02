/**
 * reportService — Summary V1 full-response transport only.
 *
 * Proves the already-authorized nullable string is mapped through and that
 * preview / unauthorized envelopes never carry Summary V1 prose.
 * No browser query of wm_report_summaries.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: mockInvoke } },
}));

import { fetchAnalysisFull, fetchAnalysisPreview } from "./reportService";

const SCAN_SESSION_ID = "11111111-1111-4111-8111-111111111111";
const PHONE = "+13055550000";
const READY_BODY = "WindowMan found three high-risk gaps in this estimate.";

const BASE_FULL_ROW = {
  analysis_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  grade: "C",
  flags: [],
  full_json: { summary: "deterministic full_json.summary" },
  proof_of_read: null,
  preview_json: { summary_teaser: "preview teaser" },
  confidence_score: 0.8,
  document_type: "estimate",
  rubric_version: "v1",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("reportService Summary V1 transport", () => {
  it("maps authorized ready report_summary_body through fetchAnalysisFull", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ok: true,
        mode: "full",
        authorized: true,
        data: { ...BASE_FULL_ROW, report_summary_body: READY_BODY },
      },
      error: null,
    });

    const result = await fetchAnalysisFull(SCAN_SESSION_ID, PHONE);

    expect(mockInvoke).toHaveBeenCalledWith("report-access", {
      body: {
        mode: "full",
        scan_session_id: SCAN_SESSION_ID,
        phone_e164: PHONE,
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.report_summary_body).toBe(READY_BODY);
      expect(result.data?.full_json).toEqual({
        summary: "deterministic full_json.summary",
      });
    }
  });

  it("maps missing or empty report_summary_body to null", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ok: true,
        mode: "full",
        authorized: true,
        data: { ...BASE_FULL_ROW, report_summary_body: "   " },
      },
      error: null,
    });

    const result = await fetchAnalysisFull(SCAN_SESSION_ID, PHONE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.report_summary_body).toBeNull();
    }
  });

  it("does not query wm_report_summaries from the browser", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ok: true,
        mode: "full",
        authorized: true,
        data: BASE_FULL_ROW,
      },
      error: null,
    });

    await fetchAnalysisFull(SCAN_SESSION_ID, PHONE);

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke.mock.calls[0]?.[0]).toBe("report-access");
    expect(JSON.stringify(mockInvoke.mock.calls)).not.toContain(
      "wm_report_summaries",
    );
  });

  it("unauthorized full envelope carries no Summary V1 prose", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ok: true,
        mode: "full",
        authorized: false,
        locked: true,
        reason: "unauthorized",
        report_summary_body: READY_BODY,
        data: { report_summary_body: READY_BODY },
      },
      error: null,
    });

    const result = await fetchAnalysisFull(SCAN_SESSION_ID, PHONE);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("unauthorized");
      expect(JSON.stringify(result)).not.toContain(READY_BODY);
    }
  });

  it("preview mapping never includes report_summary_body even if the envelope leaks it", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ok: true,
        mode: "preview",
        data: {
          analysis_id: BASE_FULL_ROW.analysis_id,
          grade: "C",
          flag_count: 2,
          flag_red_count: 1,
          flag_amber_count: 1,
          proof_of_read: null,
          preview_json: { summary_teaser: "preview teaser" },
          confidence_score: 0.8,
          document_type: "estimate",
          rubric_version: "v1",
          report_summary_body: READY_BODY,
        },
      },
      error: null,
    });

    const result = await fetchAnalysisPreview(SCAN_SESSION_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).not.toBeNull();
      expect(result.data).not.toHaveProperty("report_summary_body");
      expect(JSON.stringify(result.data)).not.toContain(READY_BODY);
    }
  });
});
