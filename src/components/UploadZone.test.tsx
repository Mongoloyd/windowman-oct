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
import { trackGtmEvent } from "@/lib/trackConversion";

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
    if (table === "event_logs") return buildInsertChain();
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
    const btn = buttons.find((b) => /Start My AI Scan/i.test(b.textContent || ""));
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
    render(
      <UploadZone isVisible sessionId="00000000-0000-0000-0000-000000000001" onScanStart={onScanStart} />
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

    // scan_sessions and quote_files are no longer written by UploadZone directly
    // (the start-upload-scan-session Edge Function handles those inserts).
    // Only verifying that invokeMock (start-upload-scan-session) is NOT called
    // after a storage failure — storage fails before the EF is reached.
    fromMock.mockImplementation((table: string) => {
      if (table === "event_logs") return buildInsertChain();
      return buildInsertChain();
    });

    render(<UploadZone isVisible sessionId="00000000-0000-0000-0000-000000000003" />);
    await selectFile(makeFile());
    const btn = await findStartButton();
    await act(async () => { fireEvent.click(btn); });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Retry Scan/i })).toBeInTheDocument();
    });
    // invokeMock (start-upload-scan-session EF) must NOT have been called —
    // storage failure happens before the bootstrap EF is reached.
    expect(invokeMock).not.toHaveBeenCalled();
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

    render(<UploadZone isVisible sessionId="00000000-0000-0000-0000-000000000004" />);
    await selectFile(makeFile());

    const btn = await findStartButton();
    await act(async () => { fireEvent.click(btn); });

    // Retry button surfaces from the scan-quote failure (bootstrap succeeded).
    const retryBtn = await findRetryButton();

    storageUpload.mockClear();
    await act(async () => { fireEvent.click(retryBtn); });

    // bootstrap + scan-quote(fail) + scan-quote(retry via rpc path) = 3 invoke calls
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledTimes(3);
    });
    expect(storageUpload).not.toHaveBeenCalled();
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
        /Retry Scan|Start My AI Scan/i.test(b.textContent || "")
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
    expect(trackGtmEvent).not.toHaveBeenCalledWith(
      "quote_uploaded",
      expect.anything(),
    );
  });
});
