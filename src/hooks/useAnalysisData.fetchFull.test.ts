/**
 * useAnalysisData.fetchFull — Locks the unlock contract.
 *
 * Critical invariants:
 *  - fetchFull is called with the SERVER-CANONICAL phone returned by OTP.
 *  - That exact phone is what's forwarded to fetchAnalysisFull.
 *  - 'unauthorized' from the service surfaces as fullFetchError; isFullLoaded
 *    stays false.
 *  - Invalid (non-UUID) scan session id short-circuits without RPC call.
 *  - Second fetchFull after success is a no-op.
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

vi.mock("@/lib/devSecret", () => ({
  peekDevSecret: () => null,
}));

vi.mock("@/lib/trackEvent", () => ({
  trackEvent: vi.fn(),
}));

import { useAnalysisData } from "./useAnalysisData";

const VALID_UUID = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  // Make the preview fetch resolve to "no data" so the hook doesn't loop.
  fetchAnalysisPreview.mockResolvedValue({ ok: true, data: null });
  fetchScanStatus.mockResolvedValue({ ok: true, data: { id: VALID_UUID, status: "preview_ready" } });
});

describe("useAnalysisData.fetchFull", () => {
  it("forwards the EXACT phone passed in (server-canonical) to fetchAnalysisFull", async () => {
    fetchAnalysisFull.mockResolvedValue({
      ok: true,
      data: {
        analysis_id: "a1",
        grade: "C",
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

    expect(fetchAnalysisFull).toHaveBeenCalledWith(VALID_UUID, "+13055550000");
  });

  it("on 'unauthorized' surfaces fullFetchError and leaves isFullLoaded=false", async () => {
    fetchAnalysisFull.mockResolvedValue({
      ok: false,
      code: "unauthorized",
      message: "Verification failed. Please re-verify your phone number.",
    });

    const { result } = renderHook(() => useAnalysisData(VALID_UUID, true));
    await act(async () => {
      await result.current.fetchFull("+13055550000");
    });

    await waitFor(() => {
      expect(result.current.fullFetchError).toBe("Verification failed. Please re-verify your phone number.");
    });
    expect(result.current.isFullLoaded).toBe(false);
  });

  it("short-circuits without RPC for an invalid (non-UUID) scanSessionId", async () => {
    const { result } = renderHook(() => useAnalysisData("not-a-uuid", true));
    await act(async () => {
      await result.current.fetchFull("+13055550000");
    });
    expect(fetchAnalysisFull).not.toHaveBeenCalled();
  });

  it("a second fetchFull after success is a no-op (no second RPC call)", async () => {
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

    await act(async () => {
      await result.current.fetchFull("+13055550000");
    });

    expect(fetchAnalysisFull).toHaveBeenCalledTimes(1);
  });
});
