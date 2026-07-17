import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { useDiagnosticIntake } from "./useDiagnosticIntake";
import { supabase } from "@/integrations/supabase/client";
import {
  readReportDiagnosisHandoff,
  saveReportDiagnosisHandoff,
} from "@/lib/reportDiagnosisHandoff";

// ── Identity constants ──────────────────────────────────────────────────────
const SCAN_SESSION_ID = "11111111-1111-4111-8111-111111111111";
const CANONICAL_LEAD_ID = "22222222-2222-4222-8222-222222222222";
const CACHED_LEAD_ID = "33333333-3333-4333-8333-333333333333";
const FRESH_LEAD_ID = "44444444-4444-4444-8444-444444444444";
const STALE_LEAD_ID = "55555555-5555-4555-8555-555555555555";
const ANALYSIS_ID = "66666666-6666-4666-8666-666666666666";

// ── Mocks ───────────────────────────────────────────────────────────────────
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

function routerSeedEmptyLead(): Record<string, unknown> {
  return {
    lead_id: "", // ReportClassic emits "" — the consumer must repair it
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

const rpcMock = vi.mocked(supabase.rpc as unknown as (...args: unknown[]) => unknown);
const invokeMock = vi.mocked(
  supabase.functions.invoke as unknown as (...args: unknown[]) => unknown,
);

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  invokeMock.mockResolvedValue({ data: { success: true }, error: null });
});

describe("useDiagnosticIntake — canonical lead_id hydration (FIX 1)", () => {
  it("empty seed lead_id + RPC success → canonical applied, ready, corrected handoff saved", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          lead_id: CANONICAL_LEAD_ID,
          first_name: "Jane",
          county: "Miami-Dade",
          phone_e164: "+13055551234",
        },
      ],
      error: null,
    });

    const { result } = renderHook(() => useDiagnosticIntake(), {
      wrapper: makeWrapper(routerSeedEmptyLead()),
    });

    await waitFor(() => expect(result.current.hydrationStatus).toBe("ready"));

    expect(result.current.context.lead_id).toBe(CANONICAL_LEAD_ID);
    expect(result.current.context.scan_session_id).toBe(SCAN_SESSION_ID);
    // Display fields merged (server phone applied, seed name preserved).
    expect(result.current.context.phone).toBe("+13055551234");
    expect(result.current.context.first_name).toBe("Jane");

    // Corrected handoff persisted back to session storage.
    const saved = readReportDiagnosisHandoff();
    expect(saved?.lead_id).toBe(CANONICAL_LEAD_ID);
    expect(saved?.scan_session_id).toBe(SCAN_SESSION_ID);
    expect(saved?.report_grade).toBe("C");
  });

  it("cached lead ≠ RPC lead → server wins", async () => {
    seedSessionHandoff(CACHED_LEAD_ID);
    rpcMock.mockResolvedValue({
      data: [
        {
          lead_id: CANONICAL_LEAD_ID,
          first_name: null,
          county: null,
          phone_e164: null,
        },
      ],
      error: null,
    });

    const { result } = renderHook(() => useDiagnosticIntake(), {
      wrapper: makeWrapper(undefined),
    });

    await waitFor(() => expect(result.current.hydrationStatus).toBe("ready"));

    expect(result.current.context.lead_id).toBe(CANONICAL_LEAD_ID);
    expect(result.current.context.lead_id).not.toBe(CACHED_LEAD_ID);
    // Seed display data preserved when server returns null.
    expect(result.current.context.first_name).toBe("Bob");
    const saved = readReportDiagnosisHandoff();
    expect(saved?.lead_id).toBe(CANONICAL_LEAD_ID);
  });

  it("RPC operational error → questionnaire hidden; handoff kept; error state", async () => {
    seedSessionHandoff(CACHED_LEAD_ID);
    rpcMock.mockResolvedValue({ data: null, error: { message: "RLS blocked" } });

    const { result } = renderHook(() => useDiagnosticIntake(), {
      wrapper: makeWrapper(undefined),
    });

    await waitFor(() => expect(result.current.hydrationStatus).toBe("error"));

    // Not ready — the questionnaire must stay hidden.
    expect(result.current.hydrationStatus).not.toBe("ready");
    // Seed handoff preserved for the retry.
    expect(readReportDiagnosisHandoff()).not.toBeNull();
    // Safe return path is available.
    expect(result.current.returnTo).toBe(`/report/classic/${SCAN_SESSION_ID}`);
  });

  it("RPC no row → questionnaire hidden; stale handoff cleared; invalid state", async () => {
    seedSessionHandoff(CACHED_LEAD_ID);
    rpcMock.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useDiagnosticIntake(), {
      wrapper: makeWrapper(undefined),
    });

    await waitFor(() => expect(result.current.hydrationStatus).toBe("invalid"));

    expect(result.current.hydrationStatus).not.toBe("ready");
    // Stale handoff cleared.
    expect(readReportDiagnosisHandoff()).toBeNull();
  });

  it("stale/superseded async response cannot update active context", async () => {
    let resolveFirst!: (v: unknown) => void;
    rpcMock
      .mockImplementationOnce(
        () =>
          new Promise((res) => {
            resolveFirst = res as (v: unknown) => void;
          }),
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          data: [
            {
              lead_id: FRESH_LEAD_ID,
              first_name: "Fresh",
              county: null,
              phone_e164: null,
            },
          ],
          error: null,
        }),
      );

    const { result } = renderHook(() => useDiagnosticIntake(), {
      wrapper: makeWrapper(routerSeedEmptyLead()),
    });

    // First recovery is still in-flight; supersede it with a retry.
    act(() => {
      result.current.retryHydration();
    });

    await waitFor(() => expect(result.current.hydrationStatus).toBe("ready"));
    expect(result.current.context.lead_id).toBe(FRESH_LEAD_ID);

    // The stale first response now resolves — it must NOT overwrite state.
    await act(async () => {
      resolveFirst({
        data: [
          {
            lead_id: STALE_LEAD_ID,
            first_name: "Stale",
            county: null,
            phone_e164: null,
          },
        ],
        error: null,
      });
    });

    expect(result.current.context.lead_id).toBe(FRESH_LEAD_ID);
    expect(result.current.context.lead_id).not.toBe(STALE_LEAD_ID);
  });
});

describe("useDiagnosticIntake — submit lock + canonical payload (FIX 3)", () => {
  async function renderReady() {
    rpcMock.mockResolvedValue({
      data: [
        {
          lead_id: CANONICAL_LEAD_ID,
          first_name: "Jane",
          county: null,
          phone_e164: "+13055551234",
        },
      ],
      error: null,
    });
    const hook = renderHook(() => useDiagnosticIntake(), {
      wrapper: makeWrapper(routerSeedEmptyLead()),
    });
    await waitFor(() => expect(hook.result.current.hydrationStatus).toBe("ready"));
    // Complete the minimum required answers for a valid submit.
    act(() => hook.result.current.selectPrimaryDiagnosis("price_shock"));
    act(() => hook.result.current.setCounterOfferTerms(["lower_price"]));
    return hook;
  }

  it("rapid double-submit → exactly one edge function invocation", async () => {
    const { result } = await renderReady();

    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;
    await act(async () => {
      // Two synchronous clicks before the first submit resolves.
      result.current.handleSubmit(fakeEvent);
      result.current.handleSubmit(fakeEvent);
    });

    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith(
      "submit-diagnosis-intake",
      expect.objectContaining({
        body: expect.objectContaining({
          lead_id: CANONICAL_LEAD_ID,
          scan_session_id: SCAN_SESSION_ID,
        }),
      }),
    );
  });

  it("backend failure keeps answers, surfaces inline error, releases the lock", async () => {
    const { result } = await renderReady();
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
    // Answers preserved (still on prescription step, not success).
    expect(result.current.step).not.toBe("success");
    expect(result.current.primaryDiagnosis).toBe("price_shock");

    // Lock released — a subsequent deliberate submit reaches the network again.
    invokeMock.mockResolvedValueOnce({ data: { success: true }, error: null });
    await act(async () => {
      await result.current.handleSubmit(fakeEvent);
    });
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });
});
