import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { MAX_REAL_SCAN_FILE_BYTES, REAL_SCAN_QUOTES_BUCKET } from "./realScanConstants";
import { validateEstimateFile } from "./scanPrototypeModel";

const storageUpload = vi.fn();
const functionsInvoke = vi.fn();
const fetchAnalysisPreview = vi.fn();
const storageFrom = vi.fn((_bucket: string) => ({ upload: storageUpload }));
let pollStatus = "idle";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: (bucket: string) => storageFrom(bucket),
    },
    functions: { invoke: (...args: unknown[]) => functionsInvoke(...args) },
  },
}));

vi.mock("@/hooks/useScanPolling", () => ({
  useScanPolling: vi.fn(() => ({
    status: pollStatus,
    isPolling: false,
    error: null,
    fatalPollError: null,
  })),
}));

vi.mock("@/services/reportService", () => ({
  fetchAnalysisPreview: (...args: unknown[]) => fetchAnalysisPreview(...args),
}));

vi.mock("@/lib/useUtmCapture", () => ({
  getAttributionPayload: () => ({ client_slug: "direct" }),
}));

import { useRealScanBridge } from "./useRealScanBridge";

describe("scan file validation", () => {
  it("enforces the 10 MiB production limit", () => {
    expect(MAX_REAL_SCAN_FILE_BYTES).toBe(10 * 1024 * 1024);
    const oversized = new File(["x"], "big.pdf", { type: "application/pdf" });
    Object.defineProperty(oversized, "size", { value: MAX_REAL_SCAN_FILE_BYTES + 1 });
    expect(validateEstimateFile(oversized).ok).toBe(false);
  });

  it("rejects HEIC and HEIF", () => {
    expect(
      validateEstimateFile(new File(["x"], "photo.heic", { type: "image/heic" })).ok,
    ).toBe(false);
    expect(
      validateEstimateFile(new File(["x"], "photo.heif", { type: "image/heif" })).ok,
    ).toBe(false);
  });
});

describe("useRealScanBridge", () => {
  beforeEach(() => {
    pollStatus = "idle";
    storageUpload.mockReset();
    functionsInvoke.mockReset();
    fetchAnalysisPreview.mockReset();
    storageFrom.mockClear();
    storageUpload.mockResolvedValue({ error: null });
  });

  it("uploads to the private quotes bucket and invokes bootstrap + scan-quote", async () => {
    functionsInvoke.mockImplementation(async (name: string) => {
      if (name === "start-upload-scan-session") {
        return {
          data: {
            success: true,
            scan_session_id: "22222222-2222-4222-8222-222222222222",
            quote_file_id: "33333333-3333-4333-8333-333333333333",
            lead_id: "44444444-4444-4444-8444-444444444444",
          },
          error: null,
        };
      }
      if (name === "scan-quote") {
        return { data: { scan_session_status: "processing" }, error: null };
      }
      return { data: null, error: null };
    });

    const { result } = renderHook(() => useRealScanBridge());
    const file = new File(["pdf-bytes"], "estimate.pdf", { type: "application/pdf" });

    act(() => {
      result.current.holdSelectedFile(file);
    });

    await act(async () => {
      await result.current.beginScan();
    });

    expect(storageFrom).toHaveBeenCalledWith(REAL_SCAN_QUOTES_BUCKET);
    expect(storageUpload).toHaveBeenCalledWith(
      expect.any(String),
      file,
      expect.objectContaining({ upsert: false }),
    );

    expect(functionsInvoke).toHaveBeenCalledWith(
      "start-upload-scan-session",
      expect.objectContaining({
        body: expect.objectContaining({
          storage_path: expect.any(String),
          session_id: expect.any(String),
        }),
      }),
    );

    expect(functionsInvoke).toHaveBeenCalledWith(
      "scan-quote",
      expect.objectContaining({
        body: expect.objectContaining({
          scan_session_id: "22222222-2222-4222-8222-222222222222",
          event_id: expect.any(String),
        }),
      }),
    );
  });

  it("fails closed on contact_required_before_upload", async () => {
    storageUpload.mockResolvedValue({ error: null });
    functionsInvoke.mockResolvedValue({
      data: {
        success: false,
        code: "contact_required_before_upload",
        message: "Contact required",
      },
      error: null,
    });

    const { result } = renderHook(() => useRealScanBridge());
    act(() => {
      result.current.holdSelectedFile(
        new File(["x"], "estimate.pdf", { type: "application/pdf" }),
      );
    });

    await act(async () => {
      await result.current.beginScan();
    });

    expect(result.current.error).toMatch(/contact connected/i);
    expect(result.current.phase).toBe("retryable_failure");
  });

  it("opens lead capture only after preview fetch and mapping", async () => {
    functionsInvoke.mockImplementation(async (name: string) => {
      if (name === "start-upload-scan-session") {
        return {
          data: {
            success: true,
            scan_session_id: "22222222-2222-4222-8222-222222222222",
            quote_file_id: "33333333-3333-4333-8333-333333333333",
          },
          error: null,
        };
      }
      if (name === "scan-quote") {
        return { data: { scan_session_status: "preview_ready" }, error: null };
      }
      return { data: null, error: null };
    });

    fetchAnalysisPreview.mockResolvedValue({
      ok: true,
      data: {
        analysis_id: "11111111-1111-4111-8111-111111111111",
        grade: "B",
        flag_count: 1,
        flag_red_count: 0,
        flag_amber_count: 1,
        proof_of_read: { contractor_name: "Live Co" },
        preview_json: { top_warning: "Check permits." },
        confidence_score: 0.9,
        document_type: "Estimate",
        rubric_version: "1.0",
      },
    });

    pollStatus = "preview_ready";

    const { result } = renderHook(() => useRealScanBridge());
    act(() => {
      result.current.holdSelectedFile(
        new File(["x"], "estimate.pdf", { type: "application/pdf" }),
      );
    });

    await act(async () => {
      await result.current.beginScan();
    });

    await waitFor(() => {
      expect(result.current.phase).toBe("lead_capture");
    });

    expect(result.current.livePreview?.source).toBe("live_preview");
    expect(fetchAnalysisPreview).toHaveBeenCalledWith(
      "22222222-2222-4222-8222-222222222222",
    );
  });

  it("prevents duplicate beginScan while uploadedOnce is set", async () => {
    functionsInvoke.mockImplementation(async (name: string) => {
      if (name === "start-upload-scan-session") {
        return {
          data: {
            success: true,
            scan_session_id: "22222222-2222-4222-8222-222222222222",
            quote_file_id: "33333333-3333-4333-8333-333333333333",
          },
          error: null,
        };
      }
      return { data: { scan_session_status: "processing" }, error: null };
    });

    const { result } = renderHook(() => useRealScanBridge());
    act(() => {
      result.current.holdSelectedFile(
        new File(["x"], "estimate.pdf", { type: "application/pdf" }),
      );
    });

    await act(async () => {
      await result.current.beginScan();
      await result.current.beginScan();
    });

    const scanQuoteCalls = functionsInvoke.mock.calls.filter(
      (call) => call[0] === "scan-quote",
    );
    expect(scanQuoteCalls.length).toBe(1);
  });
});
