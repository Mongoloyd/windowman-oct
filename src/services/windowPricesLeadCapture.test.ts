import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { submitWindowPricesLead } from "./windowPricesLeadCapture";

const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const LEAD_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const captureUtmFromUrlMock = vi.fn();
const getAttributionPayloadMock = vi.fn();
const readLateFbCookiesMock = vi.fn();
const invokeMock = vi.fn();
const pushLeadMagnetCapturedMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
}));

vi.mock("@/lib/useUtmCapture", () => ({
  captureUtmFromUrl: () => captureUtmFromUrlMock(),
  getAttributionPayload: () => getAttributionPayloadMock(),
}));

vi.mock("@/lib/attribution/fbCookies", () => ({
  readLateFbCookies: (...args: unknown[]) => readLateFbCookiesMock(...args),
}));

vi.mock("@/lib/tracking/dataLayer", () => ({
  pushLeadMagnetCaptured: (...args: unknown[]) => pushLeadMagnetCapturedMock(...args),
}));

function stubWindowLocation(search: string, pathname = "/window-price-audit") {
  vi.stubGlobal("window", {
    ...window,
    location: { pathname, search, href: `${pathname}${search}` },
  });
}

describe("windowPricesLeadCapture", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    captureUtmFromUrlMock.mockReset();
    getAttributionPayloadMock.mockReset();
    readLateFbCookiesMock.mockReset();
    pushLeadMagnetCapturedMock.mockReset();

    stubWindowLocation("?utm_source=qa&gclid=test-gclid-wpa");

    captureUtmFromUrlMock.mockReturnValue({
      utm_source: "qa",
      utm_medium: "audit",
      utm_campaign: "cta_audit",
      utm_term: null,
      utm_content: null,
      fbclid: null,
      gclid: "test-gclid-wpa",
      fbc: null,
      fbp: null,
      client_slug: "direct",
      landing_page: "/window-price-audit",
      landing_page_url: "/window-price-audit?utm_source=qa&gclid=test-gclid-wpa",
    });

    getAttributionPayloadMock.mockReturnValue({
      utm_source: "qa",
      query_params: { utm_source: "qa", gclid: "test-gclid-wpa" },
    });

    readLateFbCookiesMock.mockReturnValue({ fbp: null, fbc: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("submits with the requested source and captures a fresh capture_page_url", async () => {
    invokeMock.mockResolvedValue({
      data: { success: true, lead_id: LEAD_ID, session_id: SESSION_ID },
      error: null,
    });

    const result = await submitWindowPricesLead({
      sessionId: SESSION_ID,
      firstName: "Jane",
      email: "jane@example.com",
      source: "window_price_audit",
    });

    expect(result.ok).toBe(true);
    const body = invokeMock.mock.calls[0][1].body as Record<string, unknown>;
    expect(body.source).toBe("window_price_audit");
    expect(body.query_params).toMatchObject({
      capture_page_path: "/window-price-audit",
      capture_page_url: "/window-price-audit?utm_source=qa&gclid=test-gclid-wpa",
    });
  });

  it("fires pushLeadMagnetCaptured with the DB lead_id and the page-specific source after success", async () => {
    invokeMock.mockResolvedValue({
      data: { success: true, lead_id: LEAD_ID, session_id: SESSION_ID },
      error: null,
    });

    await submitWindowPricesLead({
      sessionId: SESSION_ID,
      firstName: "Jane",
      email: "jane@example.com",
      source: "ai_demo",
    });

    expect(pushLeadMagnetCapturedMock).toHaveBeenCalledTimes(1);
    expect(pushLeadMagnetCapturedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: LEAD_ID,
        sessionId: SESSION_ID,
        captureSource: "ai_demo",
      }),
    );
  });

  it("preserves google_quote_check as the /quote-check capture source", async () => {
    const quoteCheckSessionId = "33333333-3333-4333-8333-333333333333";
    const quoteCheckLeadId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

    stubWindowLocation(
      "?utm_source=google&gclid=test-gclid-quote-check",
      "/quote-check",
    );
    captureUtmFromUrlMock.mockReturnValue({
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "qa_quote_check",
      utm_term: null,
      utm_content: null,
      fbclid: null,
      gclid: "test-gclid-quote-check",
      fbc: null,
      fbp: null,
      client_slug: "direct",
      landing_page: "/quote-check",
      landing_page_url:
        "/quote-check?utm_source=google&gclid=test-gclid-quote-check",
    });
    getAttributionPayloadMock.mockReturnValue({
      utm_source: "google",
      query_params: { utm_source: "google", gclid: "test-gclid-quote-check" },
    });
    invokeMock.mockResolvedValue({
      data: {
        success: true,
        lead_id: quoteCheckLeadId,
        session_id: quoteCheckSessionId,
      },
      error: null,
    });

    const result = await submitWindowPricesLead({
      sessionId: quoteCheckSessionId,
      firstName: "Jane",
      email: "jane@example.com",
      source: "google_quote_check",
    });

    expect(result.ok).toBe(true);
    const body = invokeMock.mock.calls[0][1].body as Record<string, unknown>;
    expect(body.source).toBe("google_quote_check");
    expect(body.query_params).toMatchObject({
      capture_page_path: "/quote-check",
      capture_page_url:
        "/quote-check?utm_source=google&gclid=test-gclid-quote-check",
    });
    expect(pushLeadMagnetCapturedMock).toHaveBeenCalledTimes(1);
    expect(pushLeadMagnetCapturedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: quoteCheckLeadId,
        sessionId: quoteCheckSessionId,
        captureSource: "google_quote_check",
        capturePagePath: "/quote-check",
        capturePageUrl:
          "/quote-check?utm_source=google&gclid=test-gclid-quote-check",
      }),
    );
  });

  it("does not fire pushLeadMagnetCaptured when capture fails", async () => {
    invokeMock.mockResolvedValue({
      data: { success: false, message: "Lead capture failed." },
      error: null,
    });

    const result = await submitWindowPricesLead({
      sessionId: SESSION_ID,
      firstName: "Jane",
      email: "jane@example.com",
      source: "truth_report_demo",
    });

    expect(result.ok).toBe(false);
    expect(pushLeadMagnetCapturedMock).not.toHaveBeenCalled();
  });

  it("folds ZIP into query_params alongside capture_page_url", async () => {
    invokeMock.mockResolvedValue({
      data: { success: true, lead_id: LEAD_ID, session_id: SESSION_ID },
      error: null,
    });

    await submitWindowPricesLead({
      sessionId: SESSION_ID,
      firstName: "Jane",
      email: "jane@example.com",
      zip: "33301",
      source: "google_window_prices",
    });

    const body = invokeMock.mock.calls[0][1].body as Record<string, unknown>;
    expect(body.query_params).toMatchObject({
      zip: "33301",
      capture_page_path: "/window-price-audit",
    });
  });
});
