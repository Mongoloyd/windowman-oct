import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { useDiagnosticIntake } from "./useDiagnosticIntake";
import { supabase } from "@/integrations/supabase/client";
import { trackGtmEvent } from "@/lib/trackConversion";
import { trackEvent } from "@/lib/trackEvent";
import {
  readReportDiagnosisHandoff,
  saveReportDiagnosisHandoff,
} from "@/lib/reportDiagnosisHandoff";

// ── Identity constants ──────────────────────────────────────────────────────
const SCAN_SESSION_ID = "11111111-1111-4111-8111-111111111111";
const ANALYSIS_ID = "66666666-6666-4666-8666-666666666666";

// ── Mocks ───────────────────────────────────────────────────────────────────
// `rpc` is still exposed on the mock so we can assert it is NEVER called for
// the forbidden service-role-only lead-context lookup during hydration.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}));

vi.mock("@/lib/trackConversion", () => ({
  trackGtmEvent: vi.fn(),
}));

vi.mock("@/lib/trackEvent", () => ({
  trackEvent: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Router state seed shape used by ReportClassic → Diagnosis handoff.
type RouterSeed = Record<string, unknown> | undefined;

function makeWrapper(routerState: RouterSeed) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter
        initialEntries={[{ pathname: "/diagnosis", state: routerState }]}
      >
        {children}
      </MemoryRouter>
    );
  };
}

/** A valid Truth Report handoff whose cached lead_id is empty (ReportClassic). */
function routerSeedEmptyLead(): Record<string, unknown> {
  return {
    lead_id: "", // ReportClassic emits "" — must NOT block rendering/submit
    scan_session_id: SCAN_SESSION_ID,
    report_grade: "C",
    first_name: "Jane",
    phone: "",
    email: "jane@example.com",
    top_insights: ["Missing DP rating", "Warranty scope unclear"],
    returnTo: `/report/classic/${SCAN_SESSION_ID}`,
    analysis_id: ANALYSIS_ID,
  };
}

function seedSessionHandoff(leadId: string) {
  saveReportDiagnosisHandoff({
    lead_id: leadId,
    scan_session_id: SCAN_SESSION_ID,
    analysis_id: ANALYSIS_ID,
    report_grade: "B",
    first_name: "Bob",
    phone: null,
    email: "bob@example.com",
    top_insights: ["Permit handling unclear"],
    returnTo: `/report/classic/${SCAN_SESSION_ID}`,
    saved_at: new Date().toISOString(),
  });
}

const EVENT_ID = "wmc_callback_requested_lead-x_scan-y";
const VOICE_FOLLOWUP_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const DIAGNOSIS_INTAKE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function successData(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    event_id: EVENT_ID,
    diagnosis_intake_id: DIAGNOSIS_INTAKE_ID,
    voice_followup_id: VOICE_FOLLOWUP_ID,
    reused: false,
    meta_dispatch_status: "pending",
    ...overrides,
  };
}

const rpcMock = vi.mocked(
  supabase.rpc as unknown as (...args: unknown[]) => unknown,
);
const invokeMock = vi.mocked(
  supabase.functions.invoke as unknown as (...args: unknown[]) => unknown,
);
const trackGtmMock = vi.mocked(trackGtmEvent);
const trackEventMock = vi.mocked(trackEvent);

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  invokeMock.mockResolvedValue({ data: successData(), error: null });
});

describe("useDiagnosticIntake — server-derived identity hydration", () => {
  it("valid handoff with empty lead_id reaches the questionnaire (ready)", async () => {
    const { result } = renderHook(() => useDiagnosticIntake(), {
      wrapper: makeWrapper(routerSeedEmptyLead()),
    });

    await waitFor(() => expect(result.current.hydrationStatus).toBe("ready"));

    // The browser renders even though the cached lead_id is empty.
    expect(result.current.context.scan_session_id).toBe(SCAN_SESSION_ID);
    expect(result.current.context.lead_id).toBe("");
    expect(result.current.context.report_grade).toBe("C");
  });

  it("hydration NEVER invokes the forbidden get_lead_context_for_session RPC", async () => {
    const { result } = renderHook(() => useDiagnosticIntake(), {
      wrapper: makeWrapper(routerSeedEmptyLead()),
    });

    await waitFor(() => expect(result.current.hydrationStatus).toBe("ready"));

    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("recovers from durable session handoff and re-persists it (empty lead ok)", async () => {
    seedSessionHandoff(""); // durable handoff with no canonical lead_id
    const { result } = renderHook(() => useDiagnosticIntake(), {
      wrapper: makeWrapper(undefined),
    });

    await waitFor(() => expect(result.current.hydrationStatus).toBe("ready"));

    expect(rpcMock).not.toHaveBeenCalled();
    const saved = readReportDiagnosisHandoff();
    expect(saved?.scan_session_id).toBe(SCAN_SESSION_ID);
    expect(saved?.report_grade).toBe("B");
  });

  it("emits the existing hydration tracking event with unchanged name", async () => {
    const { result } = renderHook(() => useDiagnosticIntake(), {
      wrapper: makeWrapper(routerSeedEmptyLead()),
    });

    await waitFor(() => expect(result.current.hydrationStatus).toBe("ready"));

    expect(trackGtmMock).toHaveBeenCalledWith(
      "diagnosis_hydrated_from_router_state",
      expect.objectContaining({ scan_session_id: SCAN_SESSION_ID, grade: "C" }),
    );
  });

  it("missing scan_session_id → safe start-from-report state (not ready)", async () => {
    const { result } = renderHook(() => useDiagnosticIntake(), {
      wrapper: makeWrapper({ report_grade: "C" }),
    });

    await waitFor(() => expect(result.current.hydrationStatus).toBe("failed"));
    expect(result.current.hydrationStatus).not.toBe("ready");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("malformed handoff (no report_grade) → safe start-from-report state", async () => {
    const { result } = renderHook(() => useDiagnosticIntake(), {
      wrapper: makeWrapper({ scan_session_id: SCAN_SESSION_ID }),
    });

    await waitFor(() => expect(result.current.hydrationStatus).toBe("failed"));
    expect(result.current.hydrationStatus).not.toBe("ready");
  });
});

describe("useDiagnosticIntake — submission (no browser lead_id required)", () => {
  async function renderReady(seed = routerSeedEmptyLead()) {
    const hook = renderHook(() => useDiagnosticIntake(), {
      wrapper: makeWrapper(seed),
    });
    await waitFor(() =>
      expect(hook.result.current.hydrationStatus).toBe("ready"),
    );
    // Minimum required answers for a valid submit.
    act(() => hook.result.current.selectPrimaryDiagnosis("price_shock"));
    act(() => hook.result.current.setCounterOfferTerms(["lower_price"]));
    return hook;
  }

  it("submits successfully with an empty cached lead_id", async () => {
    const { result } = await renderReady();
    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;

    await act(async () => {
      await result.current.handleSubmit(fakeEvent);
    });

    expect(result.current.submitError).toBeNull();
    expect(result.current.step).toBe("success");
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it("request carries scan_session_id + answers and OMITS lead_id", async () => {
    const { result } = await renderReady();
    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;

    await act(async () => {
      await result.current.handleSubmit(fakeEvent);
    });

    const [fnName, opts] = invokeMock.mock.calls[0] as [
      string,
      { body: Record<string, unknown> },
    ];
    expect(fnName).toBe("submit-diagnosis-intake");
    expect(opts.body.scan_session_id).toBe(SCAN_SESSION_ID);
    expect(opts.body.primary_diagnosis).toBe("price_shock");
    // The canonical lead_id must be resolved server-side, never sent by the browser.
    expect(opts.body).not.toHaveProperty("lead_id");
    expect(opts.body.diagnosis_submission_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("answers + note text survive a recoverable submission failure", async () => {
    const { result } = await renderReady();
    act(() => result.current.setCounterOfferFreeText("Please match the cash bid."));

    invokeMock.mockResolvedValueOnce({
      data: { success: false, error: "We could not save your diagnosis." },
      error: null,
    });

    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;
    await act(async () => {
      await result.current.handleSubmit(fakeEvent);
    });

    expect(result.current.submitError).toBe("We could not save your diagnosis.");
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.step).not.toBe("success");
    expect(result.current.primaryDiagnosis).toBe("price_shock");
    expect(result.current.counterOfferFreeText).toBe(
      "Please match the cash bid.",
    );

    // Lock released — a subsequent deliberate submit reaches the network again.
    invokeMock.mockResolvedValueOnce({ data: successData(), error: null });
    await act(async () => {
      await result.current.handleSubmit(fakeEvent);
    });
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });

  it("rapid double-submit → exactly one edge function invocation", async () => {
    const { result } = await renderReady();
    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;

    await act(async () => {
      result.current.handleSubmit(fakeEvent);
      result.current.handleSubmit(fakeEvent);
    });

    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it("fires callback_requested with the server event_id after durable success", async () => {
    const { result } = await renderReady();
    invokeMock.mockResolvedValueOnce({
      data: successData(),
      error: null,
    });

    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;
    await act(async () => {
      await result.current.handleSubmit(fakeEvent);
    });

    expect(trackGtmMock).toHaveBeenCalledWith("callback_requested", {
      event_id: EVENT_ID,
      scan_session_id: SCAN_SESSION_ID,
    });
    const conversionCalls = trackGtmMock.mock.calls.filter(
      (call) => call[0] === "callback_requested",
    );
    expect(conversionCalls).toHaveLength(1);
    expect(conversionCalls[0][1]).not.toHaveProperty("lead_id");
    expect(trackEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ event_name: "diagnosis_completed" }),
    );
  });

  it("same diagnosis_submission_id survives a failed request and retry", async () => {
    const { result } = await renderReady();
    invokeMock.mockResolvedValueOnce({
      data: { success: false, error: "We could not save your diagnosis." },
      error: null,
    });
    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;
    await act(async () => {
      await result.current.handleSubmit(fakeEvent);
    });
    invokeMock.mockResolvedValueOnce({ data: successData(), error: null });
    await act(async () => {
      await result.current.handleSubmit(fakeEvent);
    });
    const firstId = (invokeMock.mock.calls[0][1] as { body: { diagnosis_submission_id: string } })
      .body.diagnosis_submission_id;
    const secondId = (invokeMock.mock.calls[1][1] as { body: { diagnosis_submission_id: string } })
      .body.diagnosis_submission_id;
    expect(firstId).toBe(secondId);
  });

  it("failed invoke pushes no callback_requested", async () => {
    const { result } = await renderReady();
    invokeMock.mockResolvedValueOnce({
      data: null,
      error: { message: "FunctionsHttpError" },
    });
    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;
    await act(async () => {
      await result.current.handleSubmit(fakeEvent);
    });
    expect(trackGtmMock.mock.calls.some((call) => call[0] === "callback_requested")).toBe(false);
    expect(result.current.step).not.toBe("success");
  });

  it("success=false pushes no callback_requested", async () => {
    const { result } = await renderReady();
    invokeMock.mockResolvedValueOnce({
      data: { success: false, error: "Failed to submit diagnosis" },
      error: null,
    });
    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;
    await act(async () => {
      await result.current.handleSubmit(fakeEvent);
    });
    expect(trackGtmMock.mock.calls.some((call) => call[0] === "callback_requested")).toBe(false);
  });

  it("missing event_id is treated as failure", async () => {
    const { result } = await renderReady();
    invokeMock.mockResolvedValueOnce({
      data: successData({ event_id: "" }),
      error: null,
    });
    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;
    await act(async () => {
      await result.current.handleSubmit(fakeEvent);
    });
    expect(result.current.step).not.toBe("success");
    expect(trackGtmMock.mock.calls.some((call) => call[0] === "callback_requested")).toBe(false);
  });

  it("suppressed Meta status still permits callback UI success", async () => {
    const { result } = await renderReady();
    invokeMock.mockResolvedValueOnce({
      data: successData({ meta_dispatch_status: "suppressed" }),
      error: null,
    });
    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;
    await act(async () => {
      await result.current.handleSubmit(fakeEvent);
    });
    expect(result.current.step).toBe("success");
    expect(trackGtmMock).toHaveBeenCalledWith(
      "callback_requested",
      expect.objectContaining({ event_id: EVENT_ID }),
    );
  });

  it("blocks submit when scan_session_id is absent (safe state, no network)", async () => {
    // Seed present but unusable → 'failed'; handleSubmit must be a no-op guard.
    const { result } = renderHook(() => useDiagnosticIntake(), {
      wrapper: makeWrapper({ report_grade: "C" }),
    });
    await waitFor(() => expect(result.current.hydrationStatus).toBe("failed"));

    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;
    await act(async () => {
      await result.current.handleSubmit(fakeEvent);
    });
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
