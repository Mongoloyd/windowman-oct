import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { UtmData } from "@/lib/useUtmCapture";

const UTM_STORAGE_KEY = "wm_utm_data";
const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const LEAD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const { mockSetSessionId, mockSetLeadId, mockSetPhone, invokeMock } = vi.hoisted(
  () => ({
    mockSetSessionId: vi.fn(),
    mockSetLeadId: vi.fn(),
    mockSetPhone: vi.fn(),
    invokeMock: vi.fn(),
  }),
);
const truthGateLeadCaptureModuleState = vi.hoisted(() => ({ loads: 0 }));

const funnelMockState = vi.hoisted(() => ({
  leadId: null as string | null,
  sessionId: null as string | null,
}));

vi.mock("@/hooks/useTickerStats", () => ({
  useTickerStats: () => ({ total: 1000, today: 12 }),
}));

vi.mock("@/state/scanFunnel", () => ({
  useScanFunnelSafe: () => ({
    leadId: funnelMockState.leadId,
    sessionId: funnelMockState.sessionId,
    setSessionId: mockSetSessionId,
    setLeadId: mockSetLeadId,
    setPhone: mockSetPhone,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: invokeMock },
  },
}));

vi.mock("@/services/truthGateLeadCapture", async () => {
  truthGateLeadCaptureModuleState.loads += 1;
  return vi.importActual<typeof import("@/services/truthGateLeadCapture")>(
    "@/services/truthGateLeadCapture",
  );
});

vi.mock("@/lib/useUtmCapture", () => ({
  captureUtmFromUrl: vi.fn(() => ({
    utm_source: "nextdoor",
    utm_medium: null,
    utm_campaign: null,
    utm_term: null,
    utm_content: null,
    tclid: null,
    fbclid: null,
    gclid: null,
    fbc: null,
    fbp: null,
    wm_intent: "has_quote",
    client_slug: "direct",
    landing_page: "/",
    landing_page_url: "/",
  })),
  getAttributionPayload: vi.fn(() => ({
    client_slug: "direct",
    wm_intent: "has_quote",
    query_params: { wm_intent: "has_quote" },
  })),
  getUtmData: vi.fn(() => ({
    utm_source: "nextdoor",
    wm_intent: "has_quote",
    ndclid: "abc123",
    nd_lead_id: null,
    tclid: null,
    fbclid: null,
  })),
}));

vi.mock("@/lib/attribution/fbCookies", () => ({
  readLateFbCookies: vi.fn((seed: { fbp?: string | null; fbc?: string | null }) => ({
    fbp: seed.fbp ?? null,
    fbc: seed.fbc ?? null,
  })),
}));

vi.mock("@/lib/tracking/dataLayer", () => ({
  pushLeadMagnetCaptured: vi.fn(),
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

import TruthGateFlow, {
  createTruthGateLeadCaptureModuleLoader,
} from "./TruthGateFlow";
import {
  hasTrustedContactIdentity,
  isValidLeadSessionUuid,
} from "@/lib/leadSession";

function renderTruthGate(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

function installLocalStorageMock() {
  const store = new Map<string, string>();

  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
  });

  return store;
}

function seedAttribution(overrides: Partial<UtmData>) {
  const payload: UtmData = {
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_term: null,
    utm_content: null,
    ttclid: null,
    fbclid: null,
    gclid: null,
    wbraid: null,
    gbraid: null,
    msclkid: null,
    ndclid: null,
    wm_intent: "unknown",
    nd_lead_id: null,
    nd_form_id: null,
    nd_ad_id: null,
    nd_ad_group_id: null,
    nd_campaign_id: null,
    fbc: null,
    fbp: null,
    ttp: null,
    client_slug: "direct",
    landing_page: "/",
    landing_page_url: "/",
    raw_query_string: null,
    query_params: {},
    referrer: null,
    captured_at: Date.now(),
    ...overrides,
  };

  localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(payload));
}

async function submitPaidHasQuoteForm() {
  await act(async () => {
    fireEvent.change(screen.getByPlaceholderText("Your first name"), {
      target: { value: "Jane" },
    });
    fireEvent.change(screen.getByPlaceholderText("your@email.com"), {
      target: { value: "jane@example.com" },
    });
  });
  await act(async () => {
    fireEvent.submit(
      screen.getByPlaceholderText("Your first name").closest("form") as HTMLFormElement,
    );
  });
  await waitFor(() => expect(invokeMock.mock.calls.length).toBeGreaterThan(0), {
    timeout: 3000,
  }).catch(() => undefined);
}

describe("TruthGateFlow intent-loaded capture service", () => {
  beforeEach(() => {
    funnelMockState.leadId = null;
    funnelMockState.sessionId = null;
    installLocalStorageMock();
    mockSetSessionId.mockReset();
    mockSetLeadId.mockReset();
    mockSetPhone.mockReset();
    invokeMock.mockReset();
    seedAttribution({ wm_intent: "has_quote" });
    invokeMock.mockResolvedValue({
      data: { success: true, lead_id: LEAD_ID, session_id: SESSION_ID },
      error: null,
    });
    vi.spyOn(crypto, "randomUUID").mockReturnValue(SESSION_ID);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resets a rejected module promise so a later load can retry", async () => {
    const recoveredModule = {
      submitTruthGateLead: vi.fn(),
    } as unknown as typeof import("@/services/truthGateLeadCapture");
    const importer = vi.fn<
      () => Promise<typeof import("@/services/truthGateLeadCapture")>
    >();
    importer
      .mockRejectedValueOnce(new Error("chunk unavailable"))
      .mockResolvedValueOnce(recoveredModule);
    const loader = createTruthGateLeadCaptureModuleLoader(importer);

    await expect(loader.load()).rejects.toThrow("chunk unavailable");
    await expect(loader.load()).resolves.toBe(recoveredModule);
    expect(importer).toHaveBeenCalledTimes(2);
  });

  it("does not load the capture service on render or invalid submission", async () => {
    renderTruthGate(<TruthGateFlow />);

    expect(truthGateLeadCaptureModuleState.loads).toBe(0);

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText("Your first name"), {
        target: { value: "J" },
      });
      fireEvent.submit(
        screen.getByPlaceholderText("Your first name").closest("form") as HTMLFormElement,
      );
    });

    expect(invokeMock).not.toHaveBeenCalled();
    expect(truthGateLeadCaptureModuleState.loads).toBe(0);
  });

  it("prewarms once on intent and reuses the module during submission", async () => {
    renderTruthGate(<TruthGateFlow />);

    const firstName = screen.getByPlaceholderText("Your first name");
    const email = screen.getByPlaceholderText("your@email.com");

    fireEvent.focus(firstName);
    await waitFor(() => expect(truthGateLeadCaptureModuleState.loads).toBe(1));

    fireEvent.pointerDown(email);
    expect(truthGateLeadCaptureModuleState.loads).toBe(1);

    await submitPaidHasQuoteForm();

    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(truthGateLeadCaptureModuleState.loads).toBe(1);
  });
});

describe("TruthGateFlow helpers", () => {
  it("isValidLeadSessionUuid accepts UUID v4", () => {
    expect(isValidLeadSessionUuid(LEAD_ID)).toBe(true);
    expect(isValidLeadSessionUuid("not-a-uuid")).toBe(false);
  });

  it("hasTrustedContactIdentity requires both ids", () => {
    expect(hasTrustedContactIdentity(LEAD_ID, SESSION_ID)).toBe(true);
    expect(hasTrustedContactIdentity(null, SESSION_ID)).toBe(false);
    expect(hasTrustedContactIdentity(LEAD_ID, null)).toBe(false);
  });
});

describe("TruthGateFlow paid has_quote identity gate (Sprint 2B-1)", () => {
  beforeEach(() => {
    funnelMockState.leadId = null;
    funnelMockState.sessionId = null;
    installLocalStorageMock();
    mockSetSessionId.mockReset();
    mockSetLeadId.mockReset();
    mockSetPhone.mockReset();
    invokeMock.mockReset();
    vi.spyOn(crypto, "randomUUID").mockReturnValue(SESSION_ID);
    seedAttribution({
      utm_source: "nextdoor",
      wm_intent: "has_quote",
      query_params: { wm_intent: "has_quote" },
    });
    invokeMock.mockResolvedValue({
      data: {
        success: true,
        lead_id: LEAD_ID,
        session_id: SESSION_ID,
      },
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not call onLeadCaptured before contact fields are valid", async () => {
    const onLeadCaptured = vi.fn();
    renderTruthGate(<TruthGateFlow onLeadCaptured={onLeadCaptured} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Start Free" }));
    });

    expect(onLeadCaptured).not.toHaveBeenCalled();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("calls capture-truth-gate-lead then onLeadCaptured on success", async () => {
    const onLeadCaptured = vi.fn();
    renderTruthGate(<TruthGateFlow onLeadCaptured={onLeadCaptured} />);

    await submitPaidHasQuoteForm();

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        "capture-truth-gate-lead",
        expect.objectContaining({
          body: expect.objectContaining({
            session_id: SESSION_ID,
            first_name: "Jane",
            email: "jane@example.com",
            county: null,
            project_type: null,
            window_count: null,
            quote_range: null,
            source: "truth-gate",
          }),
        }),
      );
    });

    expect(mockSetSessionId).toHaveBeenCalledWith(SESSION_ID);
    expect(mockSetLeadId).toHaveBeenCalledWith(LEAD_ID);
    expect(onLeadCaptured).toHaveBeenCalledWith(SESSION_ID);
  });

  it("does not call onLeadCaptured when capture fails", async () => {
    invokeMock.mockResolvedValueOnce({
      data: { success: false, message: "Lead capture failed." },
      error: null,
    });

    const onLeadCaptured = vi.fn();
    renderTruthGate(<TruthGateFlow onLeadCaptured={onLeadCaptured} />);

    await submitPaidHasQuoteForm();

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalled();
    });

    expect(onLeadCaptured).not.toHaveBeenCalled();
    expect(screen.getByText("Lead capture failed.")).toBeInTheDocument();
  });
});

describe("TruthGateFlow paid has_quote trusted-session path", () => {
  beforeEach(() => {
    funnelMockState.leadId = LEAD_ID;
    funnelMockState.sessionId = SESSION_ID;
    installLocalStorageMock();
    mockSetSessionId.mockReset();
    mockSetLeadId.mockReset();
    mockSetPhone.mockReset();
    invokeMock.mockReset();
    seedAttribution({ wm_intent: "has_quote" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("persists consent via capture-truth-gate-lead even with trusted leadId+sessionId, reusing the session", async () => {
    invokeMock.mockResolvedValue({
      data: { success: true, lead_id: LEAD_ID, session_id: SESSION_ID, reused: true },
      error: null,
    });
    const onLeadCaptured = vi.fn();
    renderTruthGate(<TruthGateFlow onLeadCaptured={onLeadCaptured} />);

    await submitPaidHasQuoteForm();

    await waitFor(() => {
      expect(onLeadCaptured).toHaveBeenCalledWith(SESSION_ID);
    });

    expect(invokeMock).toHaveBeenCalledTimes(1);
    const body = invokeMock.mock.calls[0][1].body;
    // Session reuse preserved: the trusted funnel session id is submitted.
    expect(body.session_id).toBe(SESSION_ID);
    // Consent envelope reaches the existing server capture route.
    expect(body.consent.schemaVersion).toBe("1");
    expect(body.consent.events).toContainEqual(
      expect.objectContaining({
        purpose: "service_communications",
        decision: "granted",
      }),
    );
  });

  it("does not unlock the trusted session when consent capture fails", async () => {
    invokeMock.mockResolvedValue({
      data: {
        success: false,
        code: "consent_persist_failed",
        message: "Could not save consent records.",
      },
      error: null,
    });
    const onLeadCaptured = vi.fn();
    renderTruthGate(<TruthGateFlow onLeadCaptured={onLeadCaptured} />);

    await submitPaidHasQuoteForm();

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalled();
    });

    expect(onLeadCaptured).not.toHaveBeenCalled();
    expect(
      screen.getByText("Could not save consent records."),
    ).toBeInTheDocument();
  });
});

describe("TruthGateFlow consent submission lifecycle", () => {
  const UUID_V4_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  beforeEach(() => {
    funnelMockState.leadId = null;
    funnelMockState.sessionId = null;
    installLocalStorageMock();
    mockSetSessionId.mockReset();
    mockSetLeadId.mockReset();
    mockSetPhone.mockReset();
    invokeMock.mockReset();
    // No crypto.randomUUID stub here — real UUIDs must be generated.
    seedAttribution({ wm_intent: "has_quote" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends a real v4 UUID submissionId (no fixed fallback)", async () => {
    invokeMock.mockResolvedValue({
      data: { success: true, lead_id: LEAD_ID, session_id: SESSION_ID },
      error: null,
    });
    renderTruthGate(<TruthGateFlow />);

    await submitPaidHasQuoteForm();

    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    const submissionId = invokeMock.mock.calls[0][1].body.consent.submissionId;
    expect(submissionId).toMatch(UUID_V4_REGEX);
    expect(submissionId).not.toMatch(/^00000000-0000-4000-8000-/);
  });

  it("keeps the same submissionId for an identical retry after a failure", async () => {
    invokeMock.mockResolvedValueOnce({
      data: { success: false, code: "lead_capture_failed", message: "Try again." },
      error: null,
    });
    invokeMock.mockResolvedValueOnce({
      data: { success: true, lead_id: LEAD_ID, session_id: SESSION_ID },
      error: null,
    });
    renderTruthGate(<TruthGateFlow />);

    await submitPaidHasQuoteForm();
    await waitFor(() => expect(screen.getByText("Try again.")).toBeInTheDocument());

    await act(async () => {
      fireEvent.submit(
        screen.getByPlaceholderText("Your first name").closest("form") as HTMLFormElement,
      );
    });

    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(2));
    const first = invokeMock.mock.calls[0][1].body.consent.submissionId;
    const second = invokeMock.mock.calls[1][1].body.consent.submissionId;
    expect(second).toBe(first);
  });

  it("generates a new submissionId when the marketing decision changes", async () => {
    invokeMock.mockResolvedValueOnce({
      data: { success: false, code: "lead_capture_failed", message: "Try again." },
      error: null,
    });
    invokeMock.mockResolvedValueOnce({
      data: { success: true, lead_id: LEAD_ID, session_id: SESSION_ID },
      error: null,
    });
    renderTruthGate(<TruthGateFlow />);

    await submitPaidHasQuoteForm();
    await waitFor(() => expect(screen.getByText("Try again.")).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(
        screen.getByRole("checkbox", {
          name: /Optional: I agree to receive promotional/i,
        }),
      );
    });

    await act(async () => {
      fireEvent.submit(
        screen.getByPlaceholderText("Your first name").closest("form") as HTMLFormElement,
      );
    });

    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(2));
    const first = invokeMock.mock.calls[0][1].body.consent.submissionId;
    const second = invokeMock.mock.calls[1][1].body.consent.submissionId;
    expect(second).toMatch(UUID_V4_REGEX);
    expect(second).not.toBe(first);
    expect(invokeMock.mock.calls[1][1].body.consent.events).toContainEqual(
      expect.objectContaining({
        purpose: "marketing_communications",
        decision: "granted",
      }),
    );
  });
});

describe("TruthGateFlow contact validation and UI", () => {
  beforeEach(() => {
    funnelMockState.leadId = null;
    funnelMockState.sessionId = null;
    installLocalStorageMock();
    mockSetSessionId.mockReset();
    mockSetLeadId.mockReset();
    mockSetPhone.mockReset();
    invokeMock.mockReset();
    vi.spyOn(crypto, "randomUUID").mockReturnValue(SESSION_ID);
    seedAttribution({ wm_intent: "has_quote" });
    invokeMock.mockResolvedValue({
      data: {
        success: true,
        lead_id: LEAD_ID,
        session_id: SESSION_ID,
      },
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects junk phone 1111111111 and does not invoke capture", async () => {
    renderTruthGate(<TruthGateFlow />);

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText("Your first name"), {
        target: { value: "Jane" },
      });
      fireEvent.change(screen.getByPlaceholderText("your@email.com"), {
        target: { value: "jane@example.com" },
      });
      fireEvent.change(screen.getByPlaceholderText("(555) 555-5555"), {
        target: { value: "1111111111" },
      });
    });

    await act(async () => {
      fireEvent.submit(
        screen.getByPlaceholderText("Your first name").closest("form") as HTMLFormElement,
      );
    });

    expect(
      screen.getByText("Please enter a valid 10-digit US phone number"),
    ).toBeInTheDocument();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("formats phone input visually as user types", async () => {
    renderTruthGate(<TruthGateFlow />);

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText("(555) 555-5555"), {
        target: { value: "5551234567" },
      });
    });

    expect(screen.getByPlaceholderText("(555) 555-5555")).toHaveValue(
      "(555) 123-4567",
    );
  });

  it("preserves submit state button copy", () => {
    renderTruthGate(<TruthGateFlow />);

    expect(screen.getByRole("button", { name: "Start Free" })).toBeInTheDocument();
  });
});

describe("TruthGateFlow consent UX", () => {
  beforeEach(() => {
    funnelMockState.leadId = null;
    funnelMockState.sessionId = null;
    installLocalStorageMock();
    invokeMock.mockReset();
    vi.spyOn(crypto, "randomUUID").mockReturnValue(SESSION_ID);
    seedAttribution({ wm_intent: "has_quote" });
    invokeMock.mockResolvedValue({
      data: { success: true, lead_id: LEAD_ID, session_id: SESSION_ID },
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows Quote and Scan pills and no service communications checkbox", () => {
    renderTruthGate(<TruthGateFlow />);
    expect(screen.getByText("Quote")).toBeInTheDocument();
    expect(screen.getByText("Scan")).toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: /service communications/i }),
    ).not.toBeInTheDocument();
  });

  it("shows service authorization disclosure with Privacy and Terms links", () => {
    renderTruthGate(<TruthGateFlow />);
    expect(
      screen.getByText(/does not include marketing/i),
    ).toBeInTheDocument();
    const privacy = screen.getByRole("link", { name: /Privacy Policy/i });
    const terms = screen.getByRole("link", { name: /Terms of Service/i });
    expect(privacy).toHaveAttribute("href", "/privacy");
    expect(terms).toHaveAttribute("href", "/terms");
  });

  it("starts marketing checkbox unchecked and submits with declined when left unchecked", async () => {
    renderTruthGate(<TruthGateFlow />);
    const marketing = screen.getByRole("checkbox", {
      name: /Optional: I agree to receive promotional/i,
    });
    expect(marketing).not.toBeChecked();

    await submitPaidHasQuoteForm();

    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    const body = invokeMock.mock.calls[0][1].body;
    expect(body.consent.schemaVersion).toBe("1");
    const events = body.consent.events as Array<{ purpose: string; decision: string }>;
    expect(events).toContainEqual(
      expect.objectContaining({
        purpose: "service_communications",
        decision: "granted",
      }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        purpose: "marketing_communications",
        decision: "declined",
      }),
    );
    expect(events.some((e) => e.purpose === "contractor_sharing")).toBe(false);
  });

  it("sends marketing granted when checkbox is checked", async () => {
    renderTruthGate(<TruthGateFlow />);
    const marketing = screen.getByRole("checkbox", {
      name: /Optional: I agree to receive promotional/i,
    });
    await act(async () => {
      fireEvent.click(marketing);
    });
    await submitPaidHasQuoteForm();

    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    const events = invokeMock.mock.calls[0][1].body.consent.events as Array<{
      purpose: string;
      decision: string;
    }>;
    expect(events).toContainEqual(
      expect.objectContaining({
        purpose: "marketing_communications",
        decision: "granted",
      }),
    );
  });
});
