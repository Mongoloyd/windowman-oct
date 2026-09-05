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
import { FunctionsHttpError } from "@supabase/supabase-js";

// ── Hoisted mocks ───────────────────────────────────────────────────────
const {
  storageUpload,
  fromMock,
  invokeMock,
  rpcMock,
  rpcReceiverMock,
  insertMock,
  selectMock,
  eqMock,
  orderMock,
  limitMock,
  maybeSingleMock,
  mockSetScanSessionId,
  mockSetQuoteFileId,
  mockSetSessionId,
  mockSetLeadId,
  mockSetClientSlug,
  mockSetPhone,
} = vi.hoisted(() => {
  return {
    storageUpload: vi.fn(),
    fromMock: vi.fn(),
    invokeMock: vi.fn(),
    rpcMock: vi.fn(),
    rpcReceiverMock: vi.fn(),
    insertMock: vi.fn(),
    selectMock: vi.fn(),
    eqMock: vi.fn(),
    orderMock: vi.fn(),
    limitMock: vi.fn(),
    maybeSingleMock: vi.fn(),
    mockSetScanSessionId: vi.fn(),
    mockSetQuoteFileId: vi.fn(),
    mockSetSessionId: vi.fn(),
    mockSetLeadId: vi.fn(),
    mockSetClientSlug: vi.fn(),
    mockSetPhone: vi.fn(),
  };
});

vi.mock("@/integrations/supabase/client", () => {
  const supabase = {
    storage: { from: () => ({ upload: storageUpload }) },
    from: fromMock,
    functions: { invoke: invokeMock },
    rpc(this: unknown, fnName: string, args: Record<string, unknown>) {
      rpcReceiverMock(this === supabase);
      return rpcMock(fnName, args);
    },
  };

  return {
    supabase,
  };
});

vi.mock("@/hooks/useScanPolling", () => ({
  useScanPolling: () => ({ status: "idle" }),
}));

vi.mock("@/state/scanFunnel", () => ({
  useScanFunnelSafe: () => ({
    setScanSessionId: mockSetScanSessionId,
    setQuoteFileId: mockSetQuoteFileId,
    setSessionId: mockSetSessionId,
    setLeadId: mockSetLeadId,
    setClientSlug: mockSetClientSlug,
    setPhone: mockSetPhone,
    phoneStatus: "none",
    clientSlug: "direct",
  }),
}));

vi.mock("@/lib/tracking/dataLayer", () => ({
  pushV3BusinessEvent: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/lib/useUtmCapture", () => ({
  getAttributionPayload: vi.fn(() => ({
    client_slug: "direct",
    query_params: {},
  })),
}));

// Stub framer-motion to avoid AnimatePresence height transitions in jsdom.
// Preserve the underlying tag (motion.button → button, motion.div → div).
vi.mock("framer-motion", () => {
  const make = (tag: string) => ({ children, ...rest }: any) =>
    React.createElement(tag, rest, children);
  return {
    motion: new Proxy({}, { get: (_, key: string) => make(key) }),
    AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, null, children),
  };
});

import UploadZone from "./UploadZone";
import { pushV3BusinessEvent } from "@/lib/tracking/dataLayer";

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

function makeRpcResult(result: any) {
  return Promise.resolve(result);
}

function makeFunctionsHttpError(payload: unknown, status = 422) {
  return new FunctionsHttpError(
    new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

// Canonical valid UUIDs for test fixtures.
// The isValidUuid guard added in PREP-2A-PATCH requires all IDs emitted by
// bootstrap Edge Function mocks to be properly-formatted v4 UUIDs.
const DEFAULT_SCAN_SESSION_ID = "00000000-0000-4000-8000-000000000001";
const DEFAULT_QUOTE_FILE_ID   = "00000000-0000-4000-8000-000000000002";

function setupHappyPath() {
  storageUpload.mockResolvedValue({ error: null, data: { path: "x" } });

  // RPC calls now replace direct from() queries on scan_sessions and quote_files:
  //   get_upload_retry_context → fresh-path cross-component retry guard (returns null = no existing session)
  //   get_scan_session_context → retry-path bound-session lookup (returns valid UUID for happy path)
  rpcMock.mockImplementation((fnName: string) => {
    if (fnName === "get_upload_retry_context") {
      return makeRpcResult({ data: null, error: null });
    }
    if (fnName === "get_scan_session_context") {
      // Happy-path retry: return a valid quote_file_id so the UUID guard passes.
      return makeRpcResult({
        data: { quote_file_id: DEFAULT_QUOTE_FILE_ID, lead_id: null },
        error: null,
      });
    }
    return Promise.resolve({ data: [], error: null });
  });

  // Differentiate start-upload-scan-session (must return success) from scan-quote.
  // IDs must be valid v4 UUIDs — the isValidUuid guard rejects anything else.
  invokeMock.mockImplementation((name: string) => {
    if (name === "start-upload-scan-session") {
      return Promise.resolve({
        data: {
          success: true,
          scan_session_id: DEFAULT_SCAN_SESSION_ID,
          quote_file_id: DEFAULT_QUOTE_FILE_ID,
          lead_id: null,
        },
        error: null,
      });
    }
    return Promise.resolve({
      data: {
        analysis_status: "complete",
        scan_session_status: "preview_ready",
        grade: "C",
      },
      error: null,
    });
  });

  fromMock.mockImplementation((table: string) => {
    if (table === "leads") return buildInsertChain();
    return {
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
  return await waitFor(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const btn = buttons.find((b) => /Scan my quote/i.test(b.textContent || ""));
    if (!btn) throw new Error("Start button not found");
    return btn as HTMLElement;
  });
}

async function findRetryButton(): Promise<HTMLElement> {
  return await waitFor(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const btn = buttons.find((b) => /Retry Scan/i.test(b.textContent || ""));
    if (!btn) throw new Error("Retry button not found");
    return btn as HTMLElement;
  });
}

// Returns the body object passed to the start-upload-scan-session invoke.
function getBootstrapBody(): Record<string, unknown> | undefined {
  const call = invokeMock.mock.calls.find(
    (args) => args[0] === "start-upload-scan-session",
  );
  return call?.[1]?.body as Record<string, unknown> | undefined;
}

// ── Tests ───────────────────────────────────────────────────────────────

describe("UploadZone — idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  it("rapid double-click triggers exactly ONE storage.upload", async () => {
    const onScanStart = vi.fn();
    const onUploadAttempt = vi.fn();
    render(
      <UploadZone
        isVisible
        sessionId="00000000-0000-0000-0000-000000000001"
        onScanStart={onScanStart}
        onUploadAttempt={onUploadAttempt}
      />
    );

    await selectFile(makeFile("quote.pdf", 1024));

    // Hold storage.upload open so the second click lands while first is mid-flight
    let resolveUpload: ((v: any) => void) | null = null;
    storageUpload.mockImplementationOnce(() => new Promise((r) => { resolveUpload = r; }));

    const btn = await findStartButton();

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
    expect(onUploadAttempt).toHaveBeenCalledTimes(1);
    expect(onUploadAttempt).toHaveBeenCalledWith("application/pdf");
  });

  it("first upload uses upsert:false (plain INSERT for the private bucket)", async () => {
    render(<UploadZone isVisible sessionId="00000000-0000-0000-0000-000000000002" />);
    await selectFile(makeFile("quote.pdf", 2048));

    const btn = await findStartButton();
    await act(async () => { fireEvent.click(btn); });

    await waitFor(() => expect(storageUpload).toHaveBeenCalled());
    const [, , opts] = storageUpload.mock.calls[0];
    expect(opts.upsert).toBe(false);
  });

  it("storage failure surfaces a Retry button and does NOT insert scan_sessions", async () => {
    storageUpload.mockResolvedValueOnce({ error: { message: "boom" }, data: null });
    const onUploadAttempt = vi.fn();
    const onUploadFailure = vi.fn();

    // scan_sessions and quote_files are no longer written by UploadZone directly
    // (the start-upload-scan-session Edge Function handles those inserts).
    // Only verifying that invokeMock (start-upload-scan-session) is NOT called
    // after a storage failure — storage fails before the EF is reached.
    render(
      <UploadZone
        isVisible
        sessionId="00000000-0000-0000-0000-000000000003"
        onUploadAttempt={onUploadAttempt}
        onUploadFailure={onUploadFailure}
      />,
    );
    await selectFile(makeFile());
    const btn = await findStartButton();
    await act(async () => { fireEvent.click(btn); });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Retry Scan/i })).toBeInTheDocument();
    });
    expect(fromMock).not.toHaveBeenCalledWith("event_logs");
    // invokeMock (start-upload-scan-session EF) must NOT have been called —
    // storage failure happens before the bootstrap EF is reached.
    expect(invokeMock).not.toHaveBeenCalled();
    expect(onUploadAttempt).toHaveBeenCalledTimes(1);
    expect(onUploadAttempt).toHaveBeenCalledWith("application/pdf");
    expect(onUploadFailure).toHaveBeenCalledTimes(1);
    expect(onUploadFailure).toHaveBeenCalledWith("application/pdf");
  });

  it("retry path after first success does NOT call storage.upload again", async () => {
    // First click: bootstrap (start-upload-scan-session) succeeds so uploadedOnceRef is
    // set, then scan-quote fails → Retry button surfaces.
    // Retry click: takes the retry path (no storage.upload) and scan-quote succeeds.
    const SCAN_ID_004 = "00000000-0000-4000-8000-000000000004";
    const QF_ID_004   = "00000000-0000-4000-8000-000000000044";

    let scanQuoteCallCount = 0;
    invokeMock.mockImplementation((name: string) => {
      if (name === "start-upload-scan-session") {
        return Promise.resolve({
          data: {
            success: true,
            scan_session_id: SCAN_ID_004,
            quote_file_id: QF_ID_004,
            lead_id: null,
          },
          error: null,
        });
      }
      // scan-quote: first call fails, subsequent calls succeed.
      scanQuoteCallCount++;
      if (scanQuoteCallCount === 1) {
        return Promise.resolve({
          data: { error: "transient" },
          error: { message: "scan-quote failed" },
        });
      }
      return Promise.resolve({ data: { ok: true }, error: null });
    });

    // Retry path: get_scan_session_context must return a valid UUID so the
    // isValidUuid guard allows invokeScan to proceed.
    rpcMock.mockImplementation((fnName: string) => {
      if (fnName === "get_upload_retry_context") {
        return makeRpcResult({ data: null, error: null });
      }
      if (fnName === "get_scan_session_context") {
        return makeRpcResult({
          data: { quote_file_id: QF_ID_004, lead_id: null },
          error: null,
        });
      }
      return Promise.resolve({ data: [], error: null });
    });

    const onUploadAttempt = vi.fn();
    const onUploadFailure = vi.fn();
    render(
      <UploadZone
        isVisible
        sessionId="00000000-0000-0000-0000-000000000004"
        onUploadAttempt={onUploadAttempt}
        onUploadFailure={onUploadFailure}
      />,
    );
    await selectFile(makeFile());

    const btn = await findStartButton();
    await act(async () => { fireEvent.click(btn); });

    // Retry button surfaces from the scan-quote failure (bootstrap succeeded).
    const retryBtn = await findRetryButton();
    expect(pushV3BusinessEvent).not.toHaveBeenCalled();

    storageUpload.mockClear();
    await act(async () => { fireEvent.click(retryBtn); });

    // bootstrap + scan-quote(fail) + scan-quote(retry via rpc path) = 3 invoke calls
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledTimes(3);
      expect(pushV3BusinessEvent).toHaveBeenCalledTimes(1);
    });
    expect(storageUpload).not.toHaveBeenCalled();

    const scanQuoteCalls = invokeMock.mock.calls.filter(
      ([name]) => name === "scan-quote",
    );
    expect(scanQuoteCalls).toHaveLength(2);
    const initialEventId = scanQuoteCalls[0][1].body.event_id;
    const retryEventId = scanQuoteCalls[1][1].body.event_id;
    expect(retryEventId).toBe(initialEventId);
    expect(pushV3BusinessEvent).toHaveBeenCalledWith("quote_uploaded", {
      eventId: retryEventId,
      parameters: {
        source_tool: "scanner",
        measurement_source: "native",
        journey_type: "scanner",
        file_type: "application/pdf",
      },
    });
    expect(onUploadAttempt).toHaveBeenCalledTimes(2);
    expect(onUploadFailure).toHaveBeenCalledTimes(1);
  });

  it("isolates optional callback failures from the canonical upload path", async () => {
    render(
      <UploadZone
        isVisible
        sessionId="00000000-0000-0000-0000-000000000024"
        onUploadAttempt={() => {
          throw new Error("measurement unavailable");
        }}
      />,
    );
    await selectFile(makeFile());

    await act(async () => {
      fireEvent.click(await findStartButton());
    });

    await waitFor(() => expect(storageUpload).toHaveBeenCalledTimes(1));
    expect(pushV3BusinessEvent).toHaveBeenCalledTimes(1);
  });

  it("after invalid retry context, next attempt escapes retry loop and re-enters fresh bootstrap", async () => {
    let scanQuoteCallCount = 0;
    invokeMock.mockImplementation((name: string) => {
      if (name === "start-upload-scan-session") {
        return Promise.resolve({
          data: {
            success: true,
            scan_session_id: "00000000-0000-4000-8000-000000000104",
            quote_file_id: "00000000-0000-4000-8000-000000000204",
            lead_id: null,
          },
          error: null,
        });
      }
      scanQuoteCallCount += 1;
      if (scanQuoteCallCount === 1) {
        return Promise.resolve({
          data: { error: "transient" },
          error: { message: "scan-quote failed" },
        });
      }
      return Promise.resolve({ data: { ok: true }, error: null });
    });

    rpcMock.mockImplementation((fnName: string) => {
      if (fnName === "get_upload_retry_context") {
        return makeRpcResult({ data: null, error: null });
      }
      if (fnName === "get_scan_session_context") {
        return makeRpcResult({ data: null, error: null });
      }
      return Promise.resolve({ data: [], error: null });
    });

    render(<UploadZone isVisible sessionId="00000000-0000-0000-0000-000000000104" />);
    await selectFile(makeFile());

    const btn = await findStartButton();
    await act(async () => { fireEvent.click(btn); });

    // First attempt completed; bootstrap called once.
    await waitFor(() => {
      const bootstrapCalls = invokeMock.mock.calls.filter((args) => args[0] === "start-upload-scan-session");
      expect(bootstrapCalls).toHaveLength(1);
    });

    const retryBtn = await findRetryButton();
    await act(async () => { fireEvent.click(retryBtn); });

    await waitFor(() => {
      expect(screen.getByText("Session not found or expired. Please upload again.")).toBeInTheDocument();
    });
    // Invalid retry context must not call bootstrap again on the same click.
    {
      const bootstrapCalls = invokeMock.mock.calls.filter((args) => args[0] === "start-upload-scan-session");
      expect(bootstrapCalls).toHaveLength(1);
    }

    // Next click should escape retry loop and proceed to fresh bootstrap.
    const retryBtnAgain = await findRetryButton();
    await act(async () => { fireEvent.click(retryBtnAgain); });

    await waitFor(() => {
      const bootstrapCalls = invokeMock.mock.calls.filter((args) => args[0] === "start-upload-scan-session");
      expect(bootstrapCalls).toHaveLength(2);
    });
  });
});

// ── UUID guard suite (PREP-2A-PATCH) ────────────────────────────────────
/**
 * Validates that invokeScan() is never reached when the RPC retry context
 * returns null, an empty-string quote_file_id, or a malformed UUID.
 * Also validates that UI state recovers so the user is not frozen.
 */
describe("UploadZone — UUID guard on RPC retry paths (PREP-2A-PATCH)", () => {
  const GUARD_SCAN_ID = "00000000-0000-4000-8000-000000000099";
  const GUARD_QF_ID   = "00000000-0000-4000-8000-000000000098";

  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  /**
   * Helper: render the component, perform a first upload (bootstrap succeeds,
   * scan-quote fails), and return the Retry button element.
   * After this, activeScanSessionId is set and uploadedOnceRef is true.
   */
  async function renderAndReachRetryState(sessionId: string): Promise<HTMLElement> {
    let scanQuoteCount = 0;
    invokeMock.mockImplementation((name: string) => {
      if (name === "start-upload-scan-session") {
        return Promise.resolve({
          data: {
            success: true,
            scan_session_id: GUARD_SCAN_ID,
            quote_file_id: GUARD_QF_ID,
            lead_id: null,
          },
          error: null,
        });
      }
      scanQuoteCount++;
      if (scanQuoteCount === 1) {
        return Promise.resolve({
          data: { error: "transient" },
          error: { message: "scan-quote failed" },
        });
      }
      return Promise.resolve({ data: { ok: true }, error: null });
    });
    // RPC: fresh path has no retry context; scan-quote will fail so retry state is reached.
    rpcMock.mockImplementation((fnName: string) => {
      if (fnName === "get_upload_retry_context") {
        return makeRpcResult({ data: null, error: null });
      }
      if (fnName === "get_scan_session_context") {
        return makeRpcResult({ data: { quote_file_id: GUARD_QF_ID, lead_id: null }, error: null });
      }
      return Promise.resolve({ data: [], error: null });
    });

    render(<UploadZone isVisible sessionId={sessionId} />);
    await selectFile(makeFile("quote.pdf", 1024));
    const btn = await findStartButton();
    await act(async () => { fireEvent.click(btn); });
    return findRetryButton();
  }

  it("retry: null get_scan_session_context blocks scan-quote and restores actionable UI", async () => {
    const retryBtn = await renderAndReachRetryState("00000000-0000-0000-0000-000000000010");

    rpcMock.mockImplementation((fnName: string) => {
      if (fnName === "get_scan_session_context") {
        return makeRpcResult({ data: null, error: null });
      }
      return makeRpcResult({ data: null, error: null });
    });
    invokeMock.mockClear();

    await act(async () => { fireEvent.click(retryBtn); });

    // scan-quote must NOT be invoked when session context is null
    await waitFor(() => {
      const scanQuoteCalls = invokeMock.mock.calls.filter((args) => args[0] === "scan-quote");
      expect(scanQuoteCalls).toHaveLength(0);
    });
    // UI must not be frozen: a start/retry action button must be available
    await waitFor(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const hasAction = buttons.some((b) =>
        /Retry Scan|Scan my quote/i.test(b.textContent || "")
      );
      expect(hasAction).toBe(true);
    });
  });

  it("retry: empty-string quote_file_id from get_scan_session_context blocks scan-quote", async () => {
    const retryBtn = await renderAndReachRetryState("00000000-0000-0000-0000-000000000011");

    rpcMock.mockImplementation((fnName: string) => {
      if (fnName === "get_scan_session_context") {
        return makeRpcResult({
          data: { quote_file_id: "", lead_id: null },
          error: null,
        });
      }
      return makeRpcResult({ data: null, error: null });
    });
    invokeMock.mockClear();

    await act(async () => { fireEvent.click(retryBtn); });

    await waitFor(() => {
      const scanQuoteCalls = invokeMock.mock.calls.filter((args) => args[0] === "scan-quote");
      expect(scanQuoteCalls).toHaveLength(0);
    });
  });

  it("retry: malformed UUID from get_scan_session_context blocks scan-quote", async () => {
    const retryBtn = await renderAndReachRetryState("00000000-0000-0000-0000-000000000012");

    rpcMock.mockImplementation((fnName: string) => {
      if (fnName === "get_scan_session_context") {
        return makeRpcResult({
          data: { quote_file_id: "not-a-uuid", lead_id: null },
          error: null,
        });
      }
      return makeRpcResult({ data: null, error: null });
    });
    invokeMock.mockClear();

    await act(async () => { fireEvent.click(retryBtn); });

    await waitFor(() => {
      const scanQuoteCalls = invokeMock.mock.calls.filter((args) => args[0] === "scan-quote");
      expect(scanQuoteCalls).toHaveLength(0);
    });
  });

  it("fresh: malformed UUID from get_upload_retry_context falls through to storage upload", async () => {
    // Malformed retry context must be ignored — fresh upload path must still proceed.
    rpcMock.mockImplementation((fnName: string) => {
      if (fnName === "get_upload_retry_context") {
        return makeRpcResult({
          data: { quote_file_id: "not-a-uuid", scan_session_id: "also-not-a-uuid", lead_id: null },
          error: null,
        });
      }
      if (fnName === "get_scan_session_context") {
        return makeRpcResult({ data: { quote_file_id: GUARD_QF_ID, lead_id: null }, error: null });
      }
      return Promise.resolve({ data: [], error: null });
    });

    render(<UploadZone isVisible sessionId="00000000-0000-0000-0000-000000000013" />);
    await selectFile(makeFile("quote.pdf", 1024));
    const btn = await findStartButton();
    await act(async () => { fireEvent.click(btn); });

    // Malformed retry context is skipped; fresh upload path must reach storage.upload
    await waitFor(() => expect(storageUpload).toHaveBeenCalled());
    expect(invokeMock).toHaveBeenCalledWith("start-upload-scan-session", expect.anything());
  });

  it("fresh: empty-string quote_file_id from get_upload_retry_context falls through to storage upload", async () => {
    rpcMock.mockImplementation((fnName: string) => {
      if (fnName === "get_upload_retry_context") {
        return makeRpcResult({
          data: { quote_file_id: "", scan_session_id: "", lead_id: null },
          error: null,
        });
      }
      if (fnName === "get_scan_session_context") {
        return makeRpcResult({ data: { quote_file_id: GUARD_QF_ID, lead_id: null }, error: null });
      }
      return Promise.resolve({ data: [], error: null });
    });

    render(<UploadZone isVisible sessionId="00000000-0000-0000-0000-000000000014" />);
    await selectFile(makeFile("quote.pdf", 1024));
    const btn = await findStartButton();
    await act(async () => { fireEvent.click(btn); });

    await waitFor(() => expect(storageUpload).toHaveBeenCalled());
    expect(invokeMock).toHaveBeenCalledWith("start-upload-scan-session", expect.anything());
  });

  it("retry: valid UUID from get_scan_session_context allows scan-quote to proceed", async () => {
    const retryBtn = await renderAndReachRetryState("00000000-0000-0000-0000-000000000015");

    // Valid UUID → guard passes → invokeScan proceeds
    rpcMock.mockImplementation((fnName: string) => {
      if (fnName === "get_scan_session_context") {
        return makeRpcResult({
          data: { quote_file_id: GUARD_QF_ID, lead_id: null },
          error: null,
        });
      }
      return makeRpcResult({ data: null, error: null });
    });
    invokeMock.mockClear();
    invokeMock.mockResolvedValue({
      data: {
        analysis_status: "complete",
        scan_session_status: "preview_ready",
        grade: "C",
      },
      error: null,
    });

    await act(async () => { fireEvent.click(retryBtn); });

    await waitFor(() => {
      const scanQuoteCalls = invokeMock.mock.calls.filter((args) => args[0] === "scan-quote");
      expect(scanQuoteCalls).toHaveLength(1);
    });
  });
});

// ── leadId contract suite (Sprint 2A) ──────────────────────────────────
/**
 * Sprint 2A: UploadZone forwards a contact-owned `lead_id` to
 * start-upload-scan-session ONLY when a valid UUID leadId prop is supplied.
 * Otherwise the key is omitted entirely (never null/""/undefined), preserving
 * legacy flag-off behavior.
 */
describe("UploadZone — leadId contract (Sprint 2A)", () => {
  const VALID_LEAD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  async function uploadWith(props: { leadId?: string | null }) {
    render(
      <UploadZone
        isVisible
        sessionId="00000000-0000-0000-0000-000000000201"
        {...props}
      />,
    );
    await selectFile(makeFile());
    const btn = await findStartButton();
    await act(async () => {
      fireEvent.click(btn);
    });
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        "start-upload-scan-session",
        expect.anything(),
      );
    });
  }

  it("includes body.lead_id when a valid leadId is provided", async () => {
    await uploadWith({ leadId: VALID_LEAD_ID });
    const body = getBootstrapBody();
    expect(body).toBeDefined();
    expect(body).toHaveProperty("lead_id", VALID_LEAD_ID);
  });

  it("omits lead_id entirely when leadId is absent", async () => {
    await uploadWith({});
    const body = getBootstrapBody();
    expect(body).toBeDefined();
    expect(body).not.toHaveProperty("lead_id");
  });

  it("omits lead_id entirely when leadId is invalid", async () => {
    await uploadWith({ leadId: "not-a-uuid" });
    const body = getBootstrapBody();
    expect(body).toBeDefined();
    expect(body).not.toHaveProperty("lead_id");
  });

  it("omits lead_id when leadId is null and preserves attribution/query_params", async () => {
    await uploadWith({ leadId: null });
    const body = getBootstrapBody();
    expect(body).toBeDefined();
    expect(body).not.toHaveProperty("lead_id");
    expect(body).toHaveProperty("session_id");
    expect(body).toHaveProperty("attribution");
    expect(body).toHaveProperty("query_params");
  });
});

describe("UploadZone — quote_uploaded V3 envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  it("reuses the scan-quote event_id for the valid-response browser event", async () => {
    render(
      <UploadZone
        isVisible
        sessionId="00000000-0000-0000-0000-000000000016"
      />,
    );
    await selectFile(makeFile("quote.pdf", 1024));
    await act(async () => {
      fireEvent.click(await findStartButton());
    });

    await waitFor(() => {
      expect(pushV3BusinessEvent).toHaveBeenCalledTimes(1);
    });

    const scanQuoteCalls = invokeMock.mock.calls.filter(
      ([name]) => name === "scan-quote",
    );
    expect(scanQuoteCalls).toHaveLength(1);
    const scanQuoteEventId = scanQuoteCalls[0][1].body.event_id;
    expect(scanQuoteEventId).toEqual(expect.any(String));
    expect(pushV3BusinessEvent).toHaveBeenCalledWith("quote_uploaded", {
      eventId: scanQuoteEventId,
      parameters: {
        source_tool: "scanner",
        measurement_source: "native",
        journey_type: "scanner",
        file_type: "application/pdf",
      },
    });
  });

  it("rotates the event ID when a new scan session starts in the same mount", async () => {
    const secondScanSessionId = "00000000-0000-4000-8000-000000000021";
    const secondQuoteFileId = "00000000-0000-4000-8000-000000000022";
    let bootstrapCount = 0;
    invokeMock.mockImplementation((name: string) => {
      if (name === "start-upload-scan-session") {
        bootstrapCount += 1;
        return Promise.resolve({
          data: {
            success: true,
            scan_session_id:
              bootstrapCount === 1
                ? DEFAULT_SCAN_SESSION_ID
                : secondScanSessionId,
            quote_file_id:
              bootstrapCount === 1 ? DEFAULT_QUOTE_FILE_ID : secondQuoteFileId,
            lead_id: null,
          },
          error: null,
        });
      }
      return Promise.resolve({
        data: {
          analysis_status: "complete",
          scan_session_status: "preview_ready",
        },
        error: null,
      });
    });

    render(
      <UploadZone
        isVisible
        sessionId="00000000-0000-0000-0000-000000000026"
      />,
    );
    await selectFile(makeFile("first.pdf", 1024));
    await act(async () => {
      fireEvent.click(await findStartButton());
    });
    await waitFor(() => expect(pushV3BusinessEvent).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: /Change file/i }));
    await selectFile(makeFile("second.pdf", 2048));
    await act(async () => {
      fireEvent.click(await findStartButton());
    });
    await waitFor(() => expect(pushV3BusinessEvent).toHaveBeenCalledTimes(2));

    const scanQuoteCalls = invokeMock.mock.calls.filter(
      ([name]) => name === "scan-quote",
    );
    expect(scanQuoteCalls).toHaveLength(2);
    const firstEventId = scanQuoteCalls[0][1].body.event_id;
    const secondEventId = scanQuoteCalls[1][1].body.event_id;
    expect(secondEventId).not.toBe(firstEventId);
    expect(pushV3BusinessEvent).toHaveBeenNthCalledWith(1, "quote_uploaded", {
      eventId: firstEventId,
      parameters: {
        source_tool: "scanner",
        measurement_source: "native",
        journey_type: "scanner",
        file_type: "application/pdf",
      },
    });
    expect(pushV3BusinessEvent).toHaveBeenNthCalledWith(2, "quote_uploaded", {
      eventId: secondEventId,
      parameters: {
        source_tool: "scanner",
        measurement_source: "native",
        journey_type: "scanner",
        file_type: "application/pdf",
      },
    });
  });
});

describe("UploadZone — scan-quote terminal response", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  it("does not fire quote_uploaded or onScanStart for invalid_document", async () => {
    const onScanStart = vi.fn();
    invokeMock.mockImplementation((name: string) => {
      if (name === "start-upload-scan-session") {
        return Promise.resolve({
          data: {
            success: true,
            scan_session_id: DEFAULT_SCAN_SESSION_ID,
            quote_file_id: DEFAULT_QUOTE_FILE_ID,
            lead_id: null,
          },
          error: null,
        });
      }
      return Promise.resolve({
        data: {
          analysis_status: "invalid_document",
          scan_session_status: "invalid_document",
        },
        error: null,
      });
    });

    render(
      <UploadZone
        isVisible
        sessionId="00000000-0000-0000-0000-000000000001"
        onScanStart={onScanStart}
      />,
    );

    await selectFile(makeFile());
    const startBtn = await findStartButton();
    await act(async () => {
      fireEvent.click(startBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/does not appear to be a valid window estimate or quote/i)).toBeTruthy();
    });

    expect(onScanStart).not.toHaveBeenCalled();
    expect(pushV3BusinessEvent).not.toHaveBeenCalled();
  });

  it("reads needs_better_upload from FunctionsHttpError context", async () => {
    const onScanStart = vi.fn();
    invokeMock.mockImplementation((name: string) => {
      if (name === "start-upload-scan-session") {
        return Promise.resolve({
          data: {
            success: true,
            scan_session_id: DEFAULT_SCAN_SESSION_ID,
            quote_file_id: DEFAULT_QUOTE_FILE_ID,
            lead_id: null,
          },
          error: null,
        });
      }
      return Promise.resolve({
        data: null,
        error: makeFunctionsHttpError({ error: "needs_better_upload" }),
      });
    });

    render(
      <UploadZone
        isVisible
        sessionId="00000000-0000-0000-0000-000000000601"
        onScanStart={onScanStart}
      />,
    );
    await selectFile(makeFile());
    await act(async () => { fireEvent.click(await findStartButton()); });

    await waitFor(() => {
      expect(screen.getByText(/upload a clearer window estimate/i)).toBeInTheDocument();
    });
    expect(onScanStart).not.toHaveBeenCalled();
  });

  it("reads rate-limit code and safe message from FunctionsHttpError context", async () => {
    invokeMock.mockImplementation((name: string) => {
      if (name === "start-upload-scan-session") {
        return Promise.resolve({
          data: {
            success: true,
            scan_session_id: DEFAULT_SCAN_SESSION_ID,
            quote_file_id: DEFAULT_QUOTE_FILE_ID,
            lead_id: null,
          },
          error: null,
        });
      }
      return Promise.resolve({
        data: null,
        error: makeFunctionsHttpError(
          { error: "rate_limit_exceeded", message: "Please try again in 12 minutes." },
          429,
        ),
      });
    });

    render(<UploadZone isVisible sessionId="00000000-0000-0000-0000-000000000602" />);
    await selectFile(makeFile());
    await act(async () => { fireEvent.click(await findStartButton()); });

    await waitFor(() => {
      expect(screen.getByText("Please try again in 12 minutes.")).toBeInTheDocument();
    });
  });

  it("keeps unknown HTTP and network failures generic", async () => {
    let scanCall = 0;
    invokeMock.mockImplementation((name: string) => {
      if (name === "start-upload-scan-session") {
        return Promise.resolve({
          data: {
            success: true,
            scan_session_id: DEFAULT_SCAN_SESSION_ID,
            quote_file_id: DEFAULT_QUOTE_FILE_ID,
            lead_id: null,
          },
          error: null,
        });
      }
      scanCall += 1;
      return Promise.resolve({
        data: null,
        error: scanCall === 1
          ? makeFunctionsHttpError({ error: "unexpected_internal_detail" }, 500)
          : { message: "network offline" },
      });
    });

    render(<UploadZone isVisible sessionId="00000000-0000-0000-0000-000000000603" />);
    await selectFile(makeFile());
    await act(async () => { fireEvent.click(await findStartButton()); });

    expect(await screen.findByText("Scan encountered an issue. Tap retry to try again.")).toBeInTheDocument();
    await act(async () => { fireEvent.click(await findRetryButton()); });
    await waitFor(() => {
      expect(invokeMock.mock.calls.filter((args) => args[0] === "scan-quote")).toHaveLength(2);
    });
    expect(screen.getByText("Scan encountered an issue. Tap retry to try again.")).toBeInTheDocument();
  });

  it("recovers from a structured HTTP error on retry", async () => {
    let scanCall = 0;
    invokeMock.mockImplementation((name: string) => {
      if (name === "start-upload-scan-session") {
        return Promise.resolve({
          data: {
            success: true,
            scan_session_id: DEFAULT_SCAN_SESSION_ID,
            quote_file_id: DEFAULT_QUOTE_FILE_ID,
            lead_id: null,
          },
          error: null,
        });
      }
      scanCall += 1;
      if (scanCall === 1) {
        return Promise.resolve({
          data: null,
          error: makeFunctionsHttpError({ error: "needs_better_upload" }),
        });
      }
      return Promise.resolve({
        data: {
          analysis_status: "complete",
          scan_session_status: "preview_ready",
        },
        error: null,
      });
    });

    const onScanStart = vi.fn();
    render(
      <UploadZone
        isVisible
        sessionId="00000000-0000-0000-0000-000000000604"
        onScanStart={onScanStart}
      />,
    );
    await selectFile(makeFile());
    await act(async () => { fireEvent.click(await findStartButton()); });
    await act(async () => { fireEvent.click(await findRetryButton()); });

    await waitFor(() => expect(onScanStart).toHaveBeenCalledTimes(1));
    expect(storageUpload).toHaveBeenCalledTimes(1);
  });
});

// ── Same-file retry recovery + 409 conflict suite ───────────────────────
/**
 * Tests added for the same-image retry hardening pass:
 *  1. File input value is cleared after every onChange so same-file re-selection
 *     always fires the event (browser-native dedup guard).
 *  2. Storage 409 / object-exists is detected narrowly; no blind upsert.
 *  3. On 409 with no retry context, the user sees a clear recovery message.
 *  4. Non-409 storage errors preserve the existing generic failure message.
 *  5. (Optional) On 409 when retry context is available, rebind succeeds.
 */
describe("UploadZone — same-file retry recovery and 409 conflict handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  // ── Test 1: input value clears after onChange ────────────────────────
  it("clears input element value after onChange so the same file can be reselected", async () => {
    render(<UploadZone isVisible sessionId="00000000-0000-0000-0000-000000000501" />);
    const input = document.querySelector("input[type='file']") as HTMLInputElement;

    // First selection
    await act(async () => {
      fireEvent.change(input, { target: { files: [makeFile("img.jpg", 256)] } });
    });
    // After onChange the input value must be "" so the browser won't suppress a
    // second identical change event. The handler sets e.target.value = "".
    expect(input.value).toBe("");

    // Second selection of the same file must also be accepted (onChange fires again)
    await act(async () => {
      fireEvent.change(input, { target: { files: [makeFile("img.jpg", 256)] } });
    });
    expect(input.value).toBe("");
    // handleFile called twice — both selections produced the "Scan my quote" button
    await findStartButton();
  });

  // ── Test 2: 409 with no retry context shows recovery message, no upsert ─
  it("storage 409 with no retry context shows recovery message and never upserts", async () => {
    // First and only storage.upload returns a 409
    storageUpload.mockResolvedValue({
      error: { message: "The resource already exists", name: "StorageApiError", statusCode: "409" },
      data: null,
    });
    // get_upload_retry_context returns null on both calls (initial + conflict re-check)
    rpcMock.mockImplementation((fnName: string) => {
      if (fnName === "get_upload_retry_context") {
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: [], error: null });
    });

    render(<UploadZone isVisible sessionId="00000000-0000-0000-0000-000000000502" />);
    await selectFile(makeFile());
    await act(async () => { fireEvent.click(await findStartButton()); });

    await waitFor(() => {
      expect(
        screen.getByText(/safely reconnect/i),
      ).toBeInTheDocument();
    });
    // storageUpload called once (the plain INSERT); never retried with upsert:true
    expect(storageUpload).toHaveBeenCalledTimes(1);
    const [, , opts] = storageUpload.mock.calls[0];
    expect(opts.upsert).toBe(false);
    // Bootstrap edge function must NOT have been reached
    expect(invokeMock).not.toHaveBeenCalledWith("start-upload-scan-session", expect.anything());
  });

  // ── Test 3: 409 recovery message appears, retry button present ─────────
  it("storage 409 conflict surfaces a Retry Scan button so the user can act", async () => {
    storageUpload.mockResolvedValue({
      error: { message: "The resource already exists", name: "StorageApiError", statusCode: "409" },
      data: null,
    });
    rpcMock.mockImplementation(() => Promise.resolve({ data: null, error: null }));

    render(<UploadZone isVisible sessionId="00000000-0000-0000-0000-000000000503" />);
    await selectFile(makeFile());
    await act(async () => { fireEvent.click(await findStartButton()); });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Retry Scan/i })).toBeInTheDocument();
    });
  });

  // ── Test 4: non-409 storage error preserves existing generic message ────
  it("non-409 storage error shows the original generic failure message", async () => {
    storageUpload.mockResolvedValue({
      error: { message: "network timeout", name: "FetchError", statusCode: "503" },
      data: null,
    });
    rpcMock.mockImplementation(() => Promise.resolve({ data: null, error: null }));

    render(<UploadZone isVisible sessionId="00000000-0000-0000-0000-000000000504" />);
    await selectFile(makeFile());
    await act(async () => { fireEvent.click(await findStartButton()); });

    await waitFor(() => {
      expect(screen.getByText(/Upload failed\. Please try again\./i)).toBeInTheDocument();
    });
    // Generic error must never show the conflict-specific recovery message
    expect(
      screen.queryByText(/safely reconnect/i),
    ).not.toBeInTheDocument();
  });

  // ── Test 5 (optional): 409 with valid full retry context rebinds ────────
  // Setup: first get_upload_retry_context call (before storage) returns null
  // so the code falls through to the storage upload, which returns 409.
  // Second get_upload_retry_context call (inside the conflict handler) returns
  // a full valid context → code rebinds and calls scan-quote without bootstrap.
  it("storage 409 conflict-handler rebinds when second retry-context lookup succeeds", async () => {
    const REBIND_SCAN_ID = "00000000-0000-4000-8000-000000000501";
    const REBIND_QF_ID   = "00000000-0000-4000-8000-000000000502";

    storageUpload.mockResolvedValue({
      error: { message: "The resource already exists", name: "StorageApiError", statusCode: "409" },
      data: null,
    });

    // First get_upload_retry_context → null (fall through to storage upload).
    // Second get_upload_retry_context (conflict handler) → full valid context.
    let retryContextCallCount = 0;
    rpcMock.mockImplementation((fnName: string) => {
      if (fnName === "get_upload_retry_context") {
        retryContextCallCount++;
        if (retryContextCallCount === 1) {
          return Promise.resolve({ data: null, error: null });
        }
        return Promise.resolve({
          data: {
            quote_file_id: REBIND_QF_ID,
            scan_session_id: REBIND_SCAN_ID,
            lead_id: null,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: [], error: null });
    });

    invokeMock.mockImplementation((name: string) => {
      if (name === "start-upload-scan-session") {
        throw new Error("start-upload-scan-session must not be called on conflict rebind path");
      }
      return Promise.resolve({
        data: { analysis_status: "complete", scan_session_status: "preview_ready" },
        error: null,
      });
    });

    const onScanStart = vi.fn();
    render(
      <UploadZone
        isVisible
        sessionId="00000000-0000-0000-0000-000000000505"
        onScanStart={onScanStart}
      />,
    );
    await selectFile(makeFile());
    await act(async () => { fireEvent.click(await findStartButton()); });

    // onScanStart must fire (conflict-handler rebind succeeded)
    await waitFor(() => {
      expect(onScanStart).toHaveBeenCalledWith(expect.any(String), REBIND_SCAN_ID);
    });
    // storageUpload called exactly once (the failed plain INSERT)
    expect(storageUpload).toHaveBeenCalledTimes(1);
    const [, , opts] = storageUpload.mock.calls[0];
    expect(opts.upsert).toBe(false);
    // scan-quote fired; bootstrap must NOT have been reached
    expect(invokeMock).toHaveBeenCalledWith("scan-quote", expect.anything());
    expect(invokeMock).not.toHaveBeenCalledWith("start-upload-scan-session", expect.anything());
    // Retry-context was queried twice (initial + conflict re-check)
    expect(retryContextCallCount).toBe(2);
    expect(rpcReceiverMock).toHaveBeenCalledTimes(2);
    expect(rpcReceiverMock).toHaveBeenNthCalledWith(1, true);
    expect(rpcReceiverMock).toHaveBeenNthCalledWith(2, true);
  });

  // ── Test 6: numeric 409 status triggers object-conflict branch ─────────
  it("numeric 409 status triggers the object-conflict branch without upsert", async () => {
    storageUpload.mockResolvedValue({
      error: { message: "The resource already exists", name: "StorageApiError", status: 409 },
      data: null,
    });
    rpcMock.mockImplementation((fnName: string) => {
      if (fnName === "get_upload_retry_context") {
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: [], error: null });
    });

    render(<UploadZone isVisible sessionId="00000000-0000-0000-0000-000000000506" />);
    await selectFile(makeFile());
    await act(async () => { fireEvent.click(await findStartButton()); });

    await waitFor(() => {
      expect(screen.getByText(/safely reconnect/i)).toBeInTheDocument();
    });
    expect(storageUpload).toHaveBeenCalledTimes(1);
    const [, , opts] = storageUpload.mock.calls[0];
    expect(opts.upsert).toBe(false);
  });

  // ── Test 7: Start Fresh Upload CTA appears for unrecoverable 409 ───────
  it("unrecoverable 409 reconnect failure shows Start Fresh Upload CTA", async () => {
    storageUpload.mockResolvedValue({
      error: { message: "The resource already exists", name: "StorageApiError", statusCode: "409" },
      data: null,
    });
    rpcMock.mockImplementation(() => Promise.resolve({ data: null, error: null }));

    render(<UploadZone isVisible sessionId="00000000-0000-0000-0000-000000000507" />);
    await selectFile(makeFile());
    await act(async () => { fireEvent.click(await findStartButton()); });

    await waitFor(() => {
      expect(screen.getByText(/safely reconnect/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Start Fresh Upload/i }),
      ).toBeInTheDocument();
    });
  });

  // ── Test 8: Start Fresh clears scan/upload state, preserves identity ───
  it("Start Fresh Upload clears stale upload state but preserves session identity", async () => {
    storageUpload.mockResolvedValue({
      error: { message: "The resource already exists", name: "StorageApiError", statusCode: "409" },
      data: null,
    });
    rpcMock.mockImplementation(() => Promise.resolve({ data: null, error: null }));

    const onUploadReset = vi.fn();
    render(
      <UploadZone
        isVisible
        sessionId="00000000-0000-0000-0000-000000000508"
        leadId="00000000-0000-4000-8000-000000000508"
        onUploadReset={onUploadReset}
      />,
    );
    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    await selectFile(makeFile("stale.pdf", 512));
    await act(async () => { fireEvent.click(await findStartButton()); });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Start Fresh Upload/i }),
      ).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Start Fresh Upload/i }));
    });

    expect(mockSetScanSessionId).toHaveBeenCalledWith(null);
    expect(mockSetQuoteFileId).toHaveBeenCalledWith(null);
    expect(mockSetSessionId).not.toHaveBeenCalled();
    expect(mockSetLeadId).not.toHaveBeenCalled();
    expect(pushV3BusinessEvent).not.toHaveBeenCalled();
    expect(input.value).toBe("");
    expect(screen.queryByText(/safely reconnect/i)).not.toBeInTheDocument();
    expect(onUploadReset).toHaveBeenCalled();

    // Same file can be selected again after reset
    await selectFile(makeFile("stale.pdf", 512));
    await findStartButton();
  });

  // ── Test A: Start Fresh rotates same-file storage path ─────────────────
  it("Start Fresh Upload rotates storage path when the same file is selected again", async () => {
    const SESSION = "00000000-0000-0000-0000-000000000511";
    const file = makeFile("stale.pdf", 512);

    storageUpload
      .mockResolvedValueOnce({
        error: { message: "The resource already exists", name: "StorageApiError", statusCode: "409" },
        data: null,
      })
      .mockResolvedValueOnce({ error: null, data: { path: "x" } });

    rpcMock.mockImplementation((fnName: string) => {
      if (fnName === "get_upload_retry_context") {
        return Promise.resolve({ data: null, error: null });
      }
      if (fnName === "get_scan_session_context") {
        return makeRpcResult({
          data: { quote_file_id: DEFAULT_QUOTE_FILE_ID, lead_id: null },
          error: null,
        });
      }
      return Promise.resolve({ data: [], error: null });
    });

    invokeMock.mockImplementation((name: string) => {
      if (name === "start-upload-scan-session") {
        return Promise.resolve({
          data: {
            success: true,
            scan_session_id: DEFAULT_SCAN_SESSION_ID,
            quote_file_id: DEFAULT_QUOTE_FILE_ID,
            lead_id: null,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: { ok: true }, error: null });
    });

    render(<UploadZone isVisible sessionId={SESSION} />);
    await selectFile(file);
    await act(async () => { fireEvent.click(await findStartButton()); });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Start Fresh Upload/i })).toBeInTheDocument();
    });

    const firstPath = storageUpload.mock.calls[0][0] as string;
    expect(firstPath).not.toContain("_r1_");
    expect(firstPath).toBe(`${SESSION}/512_stale.pdf`);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Start Fresh Upload/i }));
    });

    await selectFile(file);
    await act(async () => { fireEvent.click(await findStartButton()); });

    await waitFor(() => {
      expect(storageUpload).toHaveBeenCalledTimes(2);
    });

    const secondPath = storageUpload.mock.calls[1][0] as string;
    expect(secondPath).toContain("_r1_");
    expect(secondPath).toBe(`${SESSION}/512_r1_stale.pdf`);
    const [, , secondOpts] = storageUpload.mock.calls[1];
    expect(secondOpts.upsert).toBe(false);
  });

  // ── Test B: bootstrap receives rotated storage_path ────────────────────
  it("Start Fresh then bootstrap receives rotated storage_path with same session_id", async () => {
    const SESSION = "00000000-0000-0000-0000-000000000512";
    const file = makeFile("stale.pdf", 512);

    storageUpload
      .mockResolvedValueOnce({
        error: { message: "The resource already exists", name: "StorageApiError", statusCode: "409" },
        data: null,
      })
      .mockResolvedValueOnce({ error: null, data: { path: "x" } });

    rpcMock.mockImplementation((fnName: string) => {
      if (fnName === "get_upload_retry_context") {
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: [], error: null });
    });

    invokeMock.mockImplementation((name: string) => {
      if (name === "start-upload-scan-session") {
        return Promise.resolve({
          data: {
            success: true,
            scan_session_id: DEFAULT_SCAN_SESSION_ID,
            quote_file_id: DEFAULT_QUOTE_FILE_ID,
            lead_id: null,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: { ok: true }, error: null });
    });

    render(<UploadZone isVisible sessionId={SESSION} />);
    await selectFile(file);
    await act(async () => { fireEvent.click(await findStartButton()); });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Start Fresh Upload/i })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Start Fresh Upload/i }));
    });

    await selectFile(file);
    await act(async () => { fireEvent.click(await findStartButton()); });

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("start-upload-scan-session", expect.anything());
    });

    const body = getBootstrapBody();
    expect(body?.session_id).toBe(SESSION);
    expect(body?.storage_path).toBe(`${SESSION}/512_r1_stale.pdf`);
    expect(String(body?.storage_path)).toContain("_r1_");
  });

  // ── Test C: Start Fresh preserves parent session / lead identity ───────
  it("Start Fresh path rotation preserves sessionId and leadId", async () => {
    const SESSION = "00000000-0000-0000-0000-000000000513";
    const LEAD = "00000000-0000-4000-8000-000000000513";

    storageUpload.mockResolvedValue({
      error: { message: "The resource already exists", name: "StorageApiError", statusCode: "409" },
      data: null,
    });
    rpcMock.mockImplementation(() => Promise.resolve({ data: null, error: null }));

    render(<UploadZone isVisible sessionId={SESSION} leadId={LEAD} />);
    await selectFile(makeFile("stale.pdf", 512));
    await act(async () => { fireEvent.click(await findStartButton()); });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Start Fresh Upload/i })).toBeInTheDocument();
    });

    mockSetSessionId.mockClear();
    mockSetLeadId.mockClear();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Start Fresh Upload/i }));
    });

    expect(mockSetSessionId).not.toHaveBeenCalled();
    expect(mockSetLeadId).not.toHaveBeenCalled();
  });

  // ── Test D: generic Retry Scan does not rotate path ────────────────────
  it("generic Retry Scan does not introduce rotated storage paths", async () => {
    const SESSION = "00000000-0000-0000-0000-000000000514";
    const SCAN_ID = "00000000-0000-4000-8000-000000000514";
    const QF_ID = "00000000-0000-4000-8000-000000000514";

    let scanQuoteCallCount = 0;
    invokeMock.mockImplementation((name: string) => {
      if (name === "start-upload-scan-session") {
        return Promise.resolve({
          data: {
            success: true,
            scan_session_id: SCAN_ID,
            quote_file_id: QF_ID,
            lead_id: null,
          },
          error: null,
        });
      }
      scanQuoteCallCount++;
      if (scanQuoteCallCount === 1) {
        return Promise.resolve({
          data: { error: "transient" },
          error: { message: "scan-quote failed" },
        });
      }
      return Promise.resolve({ data: { ok: true }, error: null });
    });

    rpcMock.mockImplementation((fnName: string) => {
      if (fnName === "get_upload_retry_context") {
        return makeRpcResult({ data: null, error: null });
      }
      if (fnName === "get_scan_session_context") {
        return makeRpcResult({ data: { quote_file_id: QF_ID, lead_id: null }, error: null });
      }
      return Promise.resolve({ data: [], error: null });
    });

    render(<UploadZone isVisible sessionId={SESSION} />);
    await selectFile(makeFile("quote.pdf", 1024));
    await act(async () => { fireEvent.click(await findStartButton()); });

    const firstPath = storageUpload.mock.calls[0][0] as string;
    expect(firstPath).not.toContain("_r1_");
    expect(firstPath).toBe(`${SESSION}/1024_quote.pdf`);

    const retryBtn = await findRetryButton();
    storageUpload.mockClear();
    await act(async () => { fireEvent.click(retryBtn); });

    await waitFor(() => {
      expect(invokeMock.mock.calls.filter((args) => args[0] === "scan-quote").length).toBe(2);
    });
    expect(storageUpload).not.toHaveBeenCalled();
  });

  // ── Test 9: busy guard blocks dropzone file picker ─────────────────────
  it("dropzone click does not open file picker while busy", async () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click");

    render(<UploadZone isVisible sessionId="00000000-0000-0000-0000-000000000509" />);
    await selectFile(makeFile());

    let resolveUpload: ((v: unknown) => void) | null = null;
    storageUpload.mockImplementationOnce(
      () => new Promise((r) => { resolveUpload = r; }),
    );

    const btn = await findStartButton();
    await act(async () => { fireEvent.click(btn); });

    const dropzone = screen.getByRole("button", { name: /Selected file/i });
    clickSpy.mockClear();
    await act(async () => { fireEvent.click(dropzone); });
    expect(clickSpy).not.toHaveBeenCalled();

    await act(async () => {
      resolveUpload!({ error: null, data: { path: "x" } });
    });

    clickSpy.mockRestore();
  });

  // ── Test 10: busy guard blocks Change file ─────────────────────────────
  it("Change file is disabled while busy and does not reset selection", async () => {
    const onUploadReset = vi.fn();
    render(
      <UploadZone
        isVisible
        sessionId="00000000-0000-0000-0000-000000000510"
        onUploadReset={onUploadReset}
      />,
    );
    await selectFile(makeFile("busy-test.pdf", 768));

    let resolveUpload: ((v: unknown) => void) | null = null;
    storageUpload.mockImplementationOnce(
      () => new Promise((r) => { resolveUpload = r; }),
    );

    const btn = await findStartButton();
    await act(async () => { fireEvent.click(btn); });

    const changeFileBtn = screen.getByRole("button", { name: /Change file/i });
    expect(changeFileBtn).toBeDisabled();

    onUploadReset.mockClear();
    await act(async () => { fireEvent.click(changeFileBtn); });
    expect(onUploadReset).not.toHaveBeenCalled();
    expect(screen.getByText(/busy-test\.pdf/i)).toBeInTheDocument();

    await act(async () => {
      resolveUpload!({ error: null, data: { path: "x" } });
    });
  });
});
