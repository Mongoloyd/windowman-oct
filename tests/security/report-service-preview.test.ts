import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}));

import { fetchAnalysisPreview } from "../../src/services/reportService";

const SCAN_SESSION_ID = "11111111-1111-4111-8111-111111111111";

function containsForbiddenPreviewKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenPreviewKey);
  if (!value || typeof value !== "object") return false;

  return Object.entries(value).some(
    ([key, nested]) =>
      ["full_json", "report_summary_body", "v2_source"].includes(key) ||
      containsForbiddenPreviewKey(nested),
  );
}

describe("reportService preview projection", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("drops full-report canaries returned beside an otherwise valid preview", async () => {
    invokeMock.mockResolvedValue({
      data: {
        ok: true,
        mode: "preview",
        data: {
          analysis_id: "22222222-2222-4222-8222-222222222222",
          grade: "B",
          flag_count: 2,
          flag_red_count: 0,
          flag_amber_count: 2,
          preview_json: { safe: "preview-only" },
          proof_of_read: { page_count: 3 },
          full_json: { canary: "must-not-survive" },
          report_summary_body: "must-not-survive",
          v2_source: { canary: "must-not-survive" },
        },
      },
      error: null,
    });

    const result = await fetchAnalysisPreview(SCAN_SESSION_ID);

    expect(invokeMock).toHaveBeenCalledWith("report-access", {
      body: { mode: "preview", scan_session_id: SCAN_SESSION_ID },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected preview success");
    expect(result.data).not.toBeNull();
    expect(containsForbiddenPreviewKey(result.data)).toBe(false);
    expect(JSON.stringify(result.data)).not.toContain("must-not-survive");
  });
});
