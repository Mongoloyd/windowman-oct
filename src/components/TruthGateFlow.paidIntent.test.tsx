import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { UtmData } from "@/lib/useUtmCapture";

const UTM_STORAGE_KEY = "wm_utm_data";
const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const LEAD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const { mockSetSessionId, mockSetLeadId, mockSetPhone, invokeMock, getUtmDataMock } =
  vi.hoisted(() => ({
    mockSetSessionId: vi.fn(),
    mockSetLeadId: vi.fn(),
    mockSetPhone: vi.fn(),
    invokeMock: vi.fn(),
    getUtmDataMock: vi.fn(),
  }));
const truthGateLeadCaptureModuleState = vi.hoisted(() => ({ loads: 0 }));

vi.mock("@/hooks/useTickerStats", () => ({
  useTickerStats: () => ({ total: 1000, today: 12 }),
}));

vi.mock("@/state/scanFunnel", () => ({
  useScanFunnelSafe: () => ({
    leadId: null,
    sessionId: null,
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
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_term: null,
    utm_content: null,
    tclid: null,
    fbclid: null,
    gclid: null,
    fbc: null,
    fbp: null,
    wm_intent: "unknown",
    client_slug: "direct",
    landing_page: "/",
    landing_page_url: "/",
  })),
  getAttributionPayload: vi.fn(() => ({
    client_slug: "direct",
    wm_intent: "unknown",
    query_params: {},
  })),
  getUtmData: () => getUtmDataMock(),
}));

vi.mock("@/lib/attribution/fbCookies", () => ({
  readLateFbCookies: vi.fn((seed: { fbp?: string | null; fbc?: string | null }) => ({
    fbp: seed.fbp ?? null,
    fbc: seed.fbc ?? null,
  })),
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

import TruthGateFlow from "./TruthGateFlow";

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

async function submitContactForm() {
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
}

/** Asserts durable contact-first intake surface — not fragile marketing copy. */
function expectContactFirstSurface(options?: { paidNetworkLabel?: string }) {
  expect(document.getElementById("truth-gate")).toBeInTheDocument();

  // Contact capture controls (stable placeholders + submit CTA)
  expect(screen.getByPlaceholderText("Your first name")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("your@email.com")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("(555) 555-5555")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Start Free" })).toBeInTheDocument();

  // Structural quote/scan framing badges (not headline copy)
  expect(screen.getByText("Quote", { exact: true })).toBeInTheDocument();
  expect(screen.getByText("Scan", { exact: true })).toBeInTheDocument();

  // Legacy four-question quiz blocker must not appear on contact-first path
  expect(
    screen.queryByText("How many windows are in your project?"),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(/STEP 1 OF 4/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/CONFIGURE YOUR SCAN/i)).not.toBeInTheDocument();
  expect(
    screen.queryByText("Let's prep you before the window sales appointment."),
  ).not.toBeInTheDocument();

  if (options?.paidNetworkLabel) {
    expect(
      screen.getByText(new RegExp(`FROM ${options.paidNetworkLabel}`, "i")),
    ).toBeInTheDocument();
  } else {
    expect(screen.getByText(/FREE QUOTE CHECK/i)).toBeInTheDocument();
    expect(screen.queryByText(/FROM NEXTDOOR/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/FROM TIKTOK/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/FROM META/i)).not.toBeInTheDocument();
  }
}

describe("TruthGateFlow contact-first intake", () => {
  beforeEach(() => {
    truthGateLeadCaptureModuleState.loads = 0;
    installLocalStorageMock();
    mockSetSessionId.mockReset();
    mockSetLeadId.mockReset();
    mockSetPhone.mockReset();
    invokeMock.mockReset();
    getUtmDataMock.mockReset();
    invokeMock.mockResolvedValue({
      data: {
        success: true,
        lead_id: LEAD_ID,
        session_id: SESSION_ID,
      },
      error: null,
    });
    vi.spyOn(crypto, "randomUUID").mockReturnValue(SESSION_ID);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders contact form immediately for organic/default traffic", () => {
    truthGateLeadCaptureModuleState.loads = 0;
    getUtmDataMock.mockReturnValue({
      utm_source: null,
      wm_intent: "unknown",
      ndclid: null,
      ttclid: null,
      fbclid: null,
    });

    renderTruthGate(<TruthGateFlow />);

    expectContactFirstSurface();
    expect(truthGateLeadCaptureModuleState.loads).toBe(0);
  });

  it("submits null quiz scalars for organic/default traffic", async () => {
    truthGateLeadCaptureModuleState.loads = 0;
    getUtmDataMock.mockReturnValue({
      utm_source: null,
      wm_intent: "unknown",
      ndclid: null,
      ttclid: null,
      fbclid: null,
    });

    renderTruthGate(<TruthGateFlow />);

    expect(truthGateLeadCaptureModuleState.loads).toBe(0);
    await submitContactForm();

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
    expect(truthGateLeadCaptureModuleState.loads).toBe(1);
  });

  it("succeeds with first name and email only (phone optional)", async () => {
    getUtmDataMock.mockReturnValue({
      utm_source: null,
      wm_intent: "unknown",
      ndclid: null,
      ttclid: null,
      fbclid: null,
    });

    const onLeadCaptured = vi.fn();
    renderTruthGate(<TruthGateFlow onLeadCaptured={onLeadCaptured} />);

    await submitContactForm();

    await waitFor(() => {
      expect(onLeadCaptured).toHaveBeenCalledWith(SESSION_ID);
    });

    expect(mockSetPhone).toHaveBeenCalledWith("", "none");
  });

  it("shows paid contact form for wm_intent=has_quote and unlocks upload after capture", async () => {
    getUtmDataMock.mockReturnValue({
      utm_source: "nextdoor",
      wm_intent: "has_quote",
      ndclid: "abc123",
      nd_lead_id: "lead_789",
      ttclid: null,
      fbclid: null,
    });

    const onLeadCaptured = vi.fn();

    renderTruthGate(<TruthGateFlow onLeadCaptured={onLeadCaptured} />);

    expectContactFirstSurface({ paidNetworkLabel: "NEXTDOOR" });

    await submitContactForm();

    await waitFor(() => {
      expect(onLeadCaptured).toHaveBeenCalledWith(SESSION_ID);
    });

    expect(mockSetSessionId).toHaveBeenCalledWith(SESSION_ID);
    expect(mockSetLeadId).toHaveBeenCalledWith(LEAD_ID);
    expect(invokeMock).toHaveBeenCalledWith(
      "capture-truth-gate-lead",
      expect.objectContaining({
        body: expect.objectContaining({
          county: null,
          project_type: null,
          window_count: null,
          quote_range: null,
        }),
      }),
    );
  });

  it("shows contact-first card for wm_intent=no_quote without four-question blocker", () => {
    getUtmDataMock.mockReturnValue({
      utm_source: "nextdoor",
      wm_intent: "no_quote",
      ndclid: "abc123",
      ttclid: null,
      fbclid: null,
    });

    renderTruthGate(<TruthGateFlow />);

    expectContactFirstSurface({ paidNetworkLabel: "NEXTDOOR" });
  });
});
