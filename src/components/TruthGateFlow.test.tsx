import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
import {
  hasTrustedContactIdentity,
  isValidLeadSessionUuid,
} from "@/lib/leadSession";

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
    render(<TruthGateFlow onLeadCaptured={onLeadCaptured} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Start Free" }));
    });

    expect(onLeadCaptured).not.toHaveBeenCalled();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("calls capture-truth-gate-lead then onLeadCaptured on success", async () => {
    const onLeadCaptured = vi.fn();
    render(<TruthGateFlow onLeadCaptured={onLeadCaptured} />);

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
    render(<TruthGateFlow onLeadCaptured={onLeadCaptured} />);

    await submitPaidHasQuoteForm();

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalled();
    });

    expect(onLeadCaptured).not.toHaveBeenCalled();
    expect(screen.getByText("Lead capture failed.")).toBeInTheDocument();
  });
});

describe("TruthGateFlow paid has_quote reuse path", () => {
  beforeEach(() => {
    funnelMockState.leadId = LEAD_ID;
    funnelMockState.sessionId = SESSION_ID;
    installLocalStorageMock();
    mockSetSessionId.mockReset();
    mockSetLeadId.mockReset();
    invokeMock.mockReset();
    seedAttribution({ wm_intent: "has_quote" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("skips capture-truth-gate-lead when trusted leadId+sessionId already exist", async () => {
    const onLeadCaptured = vi.fn();
    render(<TruthGateFlow onLeadCaptured={onLeadCaptured} />);

    await submitPaidHasQuoteForm();

    await waitFor(() => {
      expect(onLeadCaptured).toHaveBeenCalledWith(SESSION_ID);
    });

    expect(invokeMock).not.toHaveBeenCalled();
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
    render(<TruthGateFlow />);

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
    render(<TruthGateFlow />);

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
    render(<TruthGateFlow />);

    expect(screen.getByRole("button", { name: "Start Free" })).toBeInTheDocument();
  });
});
