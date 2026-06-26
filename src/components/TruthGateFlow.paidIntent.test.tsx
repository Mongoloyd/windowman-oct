import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

describe("TruthGateFlow paid intent", () => {
  beforeEach(() => {
    installLocalStorageMock();
    mockSetSessionId.mockReset();
    mockSetLeadId.mockReset();
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

  it("shows paid contact form for wm_intent=has_quote and unlocks upload after capture", async () => {
    getUtmDataMock.mockReturnValue({
      utm_source: "nextdoor",
      wm_intent: "has_quote",
      ndclid: "abc123",
      nd_lead_id: "lead_789",
      tclid: null,
      fbclid: null,
    });

    const onLeadCaptured = vi.fn();

    render(<TruthGateFlow onLeadCaptured={onLeadCaptured} />);

    expect(
      screen.getByText("Where should we send your free quote scan?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "We have your request from Nextdoor. Enter your details to unlock upload.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("You do not need to re-answer the starter questions."),
    ).toBeInTheDocument();

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

    await waitFor(() => {
      expect(onLeadCaptured).toHaveBeenCalledWith(SESSION_ID);
    });

    expect(mockSetSessionId).toHaveBeenCalledWith(SESSION_ID);
    expect(mockSetLeadId).toHaveBeenCalledWith(LEAD_ID);
    expect(invokeMock).toHaveBeenCalledWith(
      "capture-truth-gate-lead",
      expect.anything(),
    );
  });

  it("shows prep-mode copy for wm_intent=no_quote without upload bypass card", () => {
    getUtmDataMock.mockReturnValue({
      utm_source: "nextdoor",
      wm_intent: "no_quote",
      ndclid: "abc123",
      tclid: null,
      fbclid: null,
    });

    render(<TruthGateFlow />);

    expect(
      screen.getByText("Let's prep you before the window sales appointment."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "We have your request from Nextdoor. Answer a few details so the prep checklist matches your project.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Upload My Quote" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("You do not need to re-answer the starter questions."),
    ).not.toBeInTheDocument();
  });

  it("keeps organic first question when no paid intent is stored", () => {
    getUtmDataMock.mockReturnValue({
      utm_source: null,
      wm_intent: "unknown",
      ndclid: null,
      tclid: null,
      fbclid: null,
    });

    render(<TruthGateFlow />);

    expect(
      screen.getByText("How many windows are in your project?"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Where should we send your free quote scan?"),
    ).not.toBeInTheDocument();
  });
});
