/**
 * Regression: real OTP-verified phone always wins over dev bypass.
 * If localStorage.wm_dev_secret exists in DEV preview, fetchFull(validPhone)
 * MUST still call get_analysis_full and MUST NOT call dev-report-unlock.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const { fetchScanStatus, fetchAnalysisPreview, fetchAnalysisFull, fetchFullViaDevBypass } = vi.hoisted(() => ({
  fetchScanStatus: vi.fn(),
  fetchAnalysisPreview: vi.fn(),
  fetchAnalysisFull: vi.fn(),
  fetchFullViaDevBypass: vi.fn(),
}));

vi.mock("@/services/reportService", () => ({
  fetchScanStatus,
  fetchAnalysisPreview,
  fetchAnalysisFull,
  fetchFullViaDevBypass,
}));

vi.mock("@/lib/verifiedAccess", () => ({
  getVerifiedAccess: vi.fn().mockReturnValue(null),
  saveVerifiedAccess: vi.fn(),
  clearVerifiedAccess: vi.fn(),
}));

// Stale dev secret present — simulates Lovable preview with wm_dev_secret in localStorage.
vi.mock("@/lib/devSecret", () => ({
  peekDevSecret: () => "stale-dev-secret",
}));

vi.mock("@/lib/trackEvent", () => ({
  trackEvent: vi.fn(),
}));

import { useAnalysisData } from "./useAnalysisData";

const VALID_UUID = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  fetchAnalysisPreview.mockResolvedValue({ ok: true, data: null });
  fetchScanStatus.mockResolvedValue({ ok: true, data: { id: VALID_UUID, status: "preview_ready" } });
});

describe("useAnalysisData dev-bypass precedence", () => {
  it("uses get_analysis_full (not dev-report-unlock) when a valid phoneE164 is provided, even if wm_dev_secret is set", async () => {
    fetchAnalysisFull.mockResolvedValue({
      ok: true,
      data: {
        analysis_id: "a1",
        grade: "B",
        flags: [],
        full_json: {},
        proof_of_read: null,
        preview_json: null,
        confidence_score: null,
        document_type: null,
        rubric_version: null,
      },
    });

    const { result } = renderHook(() => useAnalysisData(VALID_UUID, true));
    await act(async () => {
      await result.current.fetchFull("+13055550000");
    });

    await waitFor(() => expect(result.current.isFullLoaded).toBe(true));

    expect(fetchAnalysisFull).toHaveBeenCalledWith(VALID_UUID, "+13055550000");
    expect(fetchAnalysisFull).toHaveBeenCalledTimes(1);
    expect(fetchFullViaDevBypass).not.toHaveBeenCalled();
  });

  it("falls back to dev bypass only when no valid phoneE164 is provided", async () => {
    fetchFullViaDevBypass.mockResolvedValue({
      ok: true,
      data: {
        analysis_id: "a2",
        grade: "A",
        flags: [],
        full_json: {},
        proof_of_read: null,
        preview_json: null,
        confidence_score: null,
        document_type: null,
        rubric_version: null,
      },
    });

    const { result } = renderHook(() => useAnalysisData(VALID_UUID, true));
    await act(async () => {
      await result.current.fetchFull("");
    });

    await waitFor(() => expect(result.current.isFullLoaded).toBe(true));

    expect(fetchFullViaDevBypass).toHaveBeenCalledWith(VALID_UUID, "stale-dev-secret");
    expect(fetchAnalysisFull).not.toHaveBeenCalled();
  });
});
