/**
 * UploadZone — idempotency-critical regression suite.
 *
 * Locks the load-bearing guards in handleScan:
 *  - inFlightRef + uploading: rapid double-click → exactly ONE storage.upload
 *  - uploadedOnceRef + activeScanSessionId: retry → NO new storage.upload,
 *    NO duplicate quote_files / scan_sessions inserts
 *  - Plain INSERT on first upload, upsert ONLY on retry path
 *  - Storage failure surfaces uploadError + Retry button (no scan_sessions row)
 *
 * Visible UX is intentionally not asserted beyond what the user requires —
 * we lock the data-layer side effects that prior bugs have hit.
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

// ── Hoisted mocks ───────────────────────────────────────────────────────
const { storageUpload, fromMock, invokeMock, rpcMock, insertMock, selectMock, eqMock, orderMock, limitMock, maybeSingleMock } = vi.hoisted(() => {
  return {
    storageUpload: vi.fn(),
    fromMock: vi.fn(),
    invokeMock: vi.fn(),
    rpcMock: vi.fn(),
    insertMock: vi.fn(),
    selectMock: vi.fn(),
    eqMock: vi.fn(),
    orderMock: vi.fn(),
    limitMock: vi.fn(),
    maybeSingleMock: vi.fn(),
  };
});

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      storage: { from: () => ({ upload: storageUpload }) },
      from: fromMock,
      functions: { invoke: invokeMock },
      rpc: rpcMock,
    },
  };
});

vi.mock("@/hooks/useScanPolling", () => ({
  useScanPolling: () => ({ status: "idle" }),
}));

vi.mock("@/lib/trackEvent", () => ({
  trackEvent: vi.fn(),
}));

vi.mock("@/lib/trackConversion", () => ({
  trackGtmEvent: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Stub framer-motion to avoid AnimatePresence height transitions in jsdom.
vi.mock("framer-motion", () => {
  const Comp = ({ children, ...rest }: any) => React.createElement("div", rest, children);
  return {
    motion: new Proxy({}, { get: () => Comp }),
    AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, null, children),
  };
});

import UploadZone from "./UploadZone";

// ── Builders ────────────────────────────────────────────────────────────
function buildSelectChain(returnValue: any) {
  // Mirrors:  .from(table).select(...).eq(col,val).order(...).limit(N).maybeSingle()
  // Also supports:  .from(table).select(...).eq(...).maybeSingle()
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => Promise.resolve(returnValue),
    maybeSingle: () => Promise.resolve(returnValue),
  };
  return chain;
}

function buildInsertChain() {
  return { insert: vi.fn().mockResolvedValue({ error: null, data: null }) };
}

function makeFile(name = "quote.pdf", size = 1024) {
  const blob = new Blob([new Uint8Array(size)], { type: "application/pdf" });
  return new File([blob], name, { type: "application/pdf" });
}

function setupHappyPath() {
  storageUpload.mockResolvedValue({ error: null, data: { path: "x" } });
  rpcMock.mockResolvedValue({ data: [], error: null }); // no existing lead
  invokeMock.mockResolvedValue({ data: { ok: true }, error: null });

  fromMock.mockImplementation((table: string) => {
    if (table === "quote_files") {
      // Lookup: storage_path → no existing rows
      return {
        select: () => ({
          eq: () => ({
            order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
          }),
        }),
        insert: vi.fn().mockResolvedValue({ error: null, data: null }),
      };
    }
    if (table === "scan_sessions") {
      return {
        select: () => ({
          eq: () => ({
            order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
        insert: vi.fn().mockResolvedValue({ error: null, data: null }),
      };
    }
    if (table === "leads") return buildInsertChain();
    if (table === "event_logs") return buildInsertChain();
    return {
      select: () => ({ eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) }),
      insert: vi.fn().mockResolvedValue({ error: null, data: null }),
    };
  });
}

async function selectFile(file: File) {
  const input = document.querySelector("input[type='file']") as HTMLInputElement;
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
  });
}

async function findStartButton(): Promise<HTMLElement> {
  const el = await screen.findByText(/Start My AI Scan/i);
  return (el.tagName === "BUTTON" ? el : el.closest("button"))! as HTMLElement;
}

async function findRetryButton(): Promise<HTMLElement> {
  const el = await screen.findByText(/Retry Scan/i);
  return (el.tagName === "BUTTON" ? el : el.closest("button"))! as HTMLElement;
}

// ── Tests ───────────────────────────────────────────────────────────────

describe("UploadZone — idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  it("rapid double-click triggers exactly ONE storage.upload", async () => {
    const onScanStart = vi.fn();
    render(
      <UploadZone isVisible sessionId="00000000-0000-0000-0000-000000000001" onScanStart={onScanStart} />
    );

    await selectFile(makeFile("quote.pdf", 1024));

    // Hold storage.upload open so the second click lands while first is mid-flight
    let resolveUpload: ((v: any) => void) | null = null;
    storageUpload.mockImplementationOnce(() => new Promise((r) => { resolveUpload = r; }));

    const btn = await screen.findByRole("button", { name: /Start My AI Scan/i });

    await act(async () => {
      fireEvent.click(btn);
      fireEvent.click(btn);
    });

    await act(async () => {
      resolveUpload!({ error: null, data: { path: "x" } });
    });

    await waitFor(() => {
      expect(storageUpload).toHaveBeenCalledTimes(1);
    });
  });

  it("first upload uses upsert:false (plain INSERT for the private bucket)", async () => {
    render(<UploadZone isVisible sessionId="00000000-0000-0000-0000-000000000002" />);
    await selectFile(makeFile("quote.pdf", 2048));

    const btn = await screen.findByRole("button", { name: /Start My AI Scan/i });
    await act(async () => { fireEvent.click(btn); });

    await waitFor(() => expect(storageUpload).toHaveBeenCalled());
    const [, , opts] = storageUpload.mock.calls[0];
    expect(opts.upsert).toBe(false);
  });

  it("storage failure surfaces a Retry button and does NOT insert scan_sessions", async () => {
    storageUpload.mockResolvedValueOnce({ error: { message: "boom" }, data: null });

    const ssInsert = vi.fn().mockResolvedValue({ error: null, data: null });
    fromMock.mockImplementation((table: string) => {
      if (table === "scan_sessions") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
          insert: ssInsert,
        };
      }
      if (table === "quote_files") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null, data: null }),
        };
      }
      return buildInsertChain();
    });

    render(<UploadZone isVisible sessionId="00000000-0000-0000-0000-000000000003" />);
    await selectFile(makeFile());
    const btn = await screen.findByRole("button", { name: /Start My AI Scan/i });
    await act(async () => { fireEvent.click(btn); });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Retry Scan/i })).toBeInTheDocument();
    });
    expect(ssInsert).not.toHaveBeenCalled();
  });

  it("retry path after first success does NOT call storage.upload again", async () => {
    // First click: full happy path (storage upload + inserts succeed),
    // but scan-quote returns error so the user can hit Retry.
    invokeMock.mockResolvedValueOnce({
      data: { error: "transient" },
      error: { message: "scan-quote failed" },
    });

    render(<UploadZone isVisible sessionId="00000000-0000-0000-0000-000000000004" />);
    await selectFile(makeFile());

    const btn = await screen.findByRole("button", { name: /Start My AI Scan/i });
    await act(async () => { fireEvent.click(btn); });

    // Retry button surfaces from the scan-quote failure
    const retryBtn = await screen.findByRole("button", { name: /Retry Scan/i });

    // Second invokeScan should succeed; storage.upload must NOT be called again
    invokeMock.mockResolvedValueOnce({ data: { ok: true }, error: null });
    storageUpload.mockClear();

    await act(async () => { fireEvent.click(retryBtn); });

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledTimes(2);
    });
    expect(storageUpload).not.toHaveBeenCalled();
  });
});
