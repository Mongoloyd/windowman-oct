import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, waitFor } from "@testing-library/react";

const { storageUpload, invokeMock, getAttributionPayloadMock } = vi.hoisted(() => ({
  storageUpload: vi.fn(),
  invokeMock: vi.fn(),
  getAttributionPayloadMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: { from: () => ({ upload: storageUpload }) },
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null, data: null }),
    })),
    functions: { invoke: invokeMock },
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  },
}));

vi.mock("@/hooks/useScanPolling", () => ({
  useScanPolling: () => ({ status: "idle" }),
}));

vi.mock("@/lib/trackEvent", () => ({
  trackEvent: vi.fn(),
}));

vi.mock("@/lib/trackConversion", () => ({
  trackGtmEvent: vi.fn(),
}));

vi.mock("@/lib/useUtmCapture", () => ({
  getAttributionPayload: getAttributionPayloadMock,
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("framer-motion", () => {
  const make = (tag: string) =>
    ({ children, ...rest }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement(tag, rest, children);

  return {
    motion: new Proxy({}, { get: (_, key: string) => make(key) }),
    AnimatePresence: ({ children }: React.PropsWithChildren) =>
      React.createElement(React.Fragment, null, children),
  };
});

import UploadZone from "./UploadZone";

const DEFAULT_SCAN_SESSION_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const DEFAULT_QUOTE_FILE_ID = "bbbbbbbb-cccc-dddd-eeee-ffffffffffff";

function makeFile(name = "quote.pdf", size = 1024) {
  return new File(["x".repeat(size)], name, { type: "application/pdf" });
}

describe("UploadZone paid attribution bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageUpload.mockResolvedValue({ error: null });
    invokeMock.mockImplementation((name: string) => {
      if (name === "start-upload-scan-session") {
        return Promise.resolve({
          data: {
            success: true,
            scan_session_id: DEFAULT_SCAN_SESSION_ID,
            quote_file_id: DEFAULT_QUOTE_FILE_ID,
            lead_id: "cccccccc-dddd-eeee-ffff-000000000001",
          },
          error: null,
        });
      }
      return Promise.resolve({ data: { ok: true }, error: null });
    });
    getAttributionPayloadMock.mockReturnValue({
      utm_source: "nextdoor",
      wm_intent: "has_quote",
      ndclid: "abc123",
      nd_lead_id: "lead_789",
      client_slug: "nextdoor",
      query_params: {
        ndclid: "abc123",
        wm_intent: "has_quote",
        nd_lead_id: "lead_789",
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends attribution and query_params to start-upload-scan-session", async () => {
    render(
      <UploadZone
        isVisible
        sessionId="11111111-1111-4111-8111-111111111111"
      />,
    );

    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [makeFile()] } });
    });

    const startButton = await waitFor(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) =>
        /Start My AI Scan/i.test(b.textContent || ""),
      );
      if (!btn) throw new Error("Start button not found");
      return btn;
    });

    await act(async () => {
      fireEvent.click(startButton);
    });

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        "start-upload-scan-session",
        expect.objectContaining({
          body: expect.objectContaining({
            attribution: expect.objectContaining({
              ndclid: "abc123",
              wm_intent: "has_quote",
              nd_lead_id: "lead_789",
            }),
            query_params: expect.objectContaining({
              ndclid: "abc123",
              wm_intent: "has_quote",
              nd_lead_id: "lead_789",
            }),
          }),
        }),
      );
    });

    const bootstrapCall = invokeMock.mock.calls.find(
      (args) => args[0] === "start-upload-scan-session",
    );
    const body = bootstrapCall?.[1]?.body as Record<string, unknown>;
    expect(body.attribution).not.toHaveProperty("query_params");
  });
});
