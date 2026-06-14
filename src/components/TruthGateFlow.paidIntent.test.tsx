import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import TruthGateFlow from "./TruthGateFlow";
import type { UtmData } from "@/lib/useUtmCapture";

const UTM_STORAGE_KEY = "wm_utm_data";
const mockSetSessionId = vi.fn();

vi.mock("@/hooks/useTickerStats", () => ({
  useTickerStats: () => ({ total: 1000, today: 12 }),
}));

vi.mock("@/state/scanFunnel", () => ({
  useScanFunnelSafe: () => ({
    setSessionId: mockSetSessionId,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
  },
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
    vi.stubGlobal("crypto", {
      randomUUID: () => "11111111-1111-4111-8111-111111111111",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows paid-continuation card for wm_intent=has_quote and unlocks upload on CTA", () => {
    seedAttribution({
      utm_source: "nextdoor",
      wm_intent: "has_quote",
      ndclid: "abc123",
      nd_lead_id: "lead_789",
    });

    const onLeadCaptured = vi.fn();

    render(<TruthGateFlow onLeadCaptured={onLeadCaptured} />);

    expect(
      screen.getByText("We have your request from Nextdoor."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Upload your current quote for a secure price check."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("You do not need to re-answer the starter questions."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Upload My Quote" }));

    expect(onLeadCaptured).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(mockSetSessionId).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
    );
  });

  it("shows prep-mode copy for wm_intent=no_quote without upload bypass card", () => {
    seedAttribution({
      utm_source: "nextdoor",
      wm_intent: "no_quote",
      ndclid: "abc123",
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
    localStorage.removeItem(UTM_STORAGE_KEY);

    render(<TruthGateFlow />);

    expect(
      screen.getByText("How many windows are in your project?"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("We have your request from Nextdoor."),
    ).not.toBeInTheDocument();
  });
});
