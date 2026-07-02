import { beforeEach, describe, expect, it, vi } from "vitest";

const trackGtmEventMock = vi.fn();

vi.mock("@/lib/trackConversion", () => ({
  trackGtmEvent: (...args: unknown[]) => trackGtmEventMock(...args),
}));

vi.mock("@/lib/useLeadId", () => ({
  getLeadId: () => "visitor-uuid-123",
}));

vi.mock("@/lib/useUtmCapture", () => ({
  captureUtmFromUrl: vi.fn(() => ({
    utm_source: "nextdoor",
    utm_medium: "paid_social",
    utm_campaign: "tracking_fix_qa",
    utm_content: "ad1",
    utm_term: null,
    ttclid: null,
    fbclid: null,
    gclid: null,
    wbraid: null,
    gbraid: null,
    msclkid: null,
    ndclid: "test_ndclid_123",
    wm_intent: "unknown",
    client_slug: "direct",
    query_params: { utm_source: "nextdoor" },
  })),
  getUtmData: vi.fn(() => ({
    wm_intent: "has_quote",
  })),
}));

import { captureUtmFromUrl } from "@/lib/useUtmCapture";
import {
  buildAttributionDataLayerPayload,
  pushDataLayerEvent,
  pushLowIntentEvent,
  pushTruthGateViewedOnce,
  pushVirtualPageView,
} from "@/lib/tracking/dataLayer";

describe("dataLayer helper", () => {
  beforeEach(() => {
    trackGtmEventMock.mockReset();
    vi.stubGlobal("window", {
      dataLayer: [],
      location: {
        origin: "https://windowman.app",
        pathname: "/windowman",
        search: "?utm_source=nextdoor",
        hash: "",
      },
      document: { title: "WindowMan Landing" },
    });
    sessionStorage.clear();
  });

  it("buildAttributionDataLayerPayload includes structured UTMs and visitor_id", () => {
    const payload = buildAttributionDataLayerPayload();
    expect(payload.utm_source).toBe("nextdoor");
    expect(payload.ndclid).toBe("test_ndclid_123");
    expect(payload.wm_intent).toBeNull();
    expect(payload.visitor_id).toBe("visitor-uuid-123");
    expect(payload.lead_id).toBe("visitor-uuid-123");
  });

  it("pushVirtualPageView sends enriched virtual_page_view without PII", () => {
    pushVirtualPageView({
      page_path: "/windowman",
      page_search: "?utm_source=nextdoor",
    });

    expect(trackGtmEventMock).toHaveBeenCalledTimes(1);
    const [eventName, payload] = trackGtmEventMock.mock.calls[0];
    expect(eventName).toBe("virtual_page_view");
    expect(payload.page_path).toBe("/windowman");
    expect(payload.page_location).toContain("/windowman");
    expect(payload.utm_source).toBe("nextdoor");
    expect(payload).not.toHaveProperty("email");
    expect(payload).not.toHaveProperty("phone");
  });

  it("pushLowIntentEvent strips forbidden keys", () => {
    pushLowIntentEvent("first_quote_modal_opened", {
      page_path: "/windowman",
      wm_intent: "no_quote",
      email: "secret@example.com",
      phone_e164: "+15551234567",
    });

    const payload = trackGtmEventMock.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.event).toBeUndefined();
    expect(payload.email).toBeUndefined();
    expect(payload.phone_e164).toBeUndefined();
  });

  it("pushTruthGateViewedOnce fires once per session key", () => {
    pushTruthGateViewedOnce({
      page_path: "/dedupe-session",
      page_search: "?wm_intent=has_quote",
      page_hash: "#truth-gate",
    });
    pushTruthGateViewedOnce({
      page_path: "/dedupe-session",
      page_search: "?wm_intent=has_quote",
      page_hash: "#truth-gate",
    });

    const truthGateCalls = trackGtmEventMock.mock.calls.filter(
      ([name]) => name === "truth_gate_viewed",
    );
    expect(truthGateCalls).toHaveLength(1);
    expect(truthGateCalls[0][1]).toMatchObject({
      wm_intent: "has_quote",
      page_hash: "#truth-gate",
      page_search: "?wm_intent=has_quote",
    });
  });

  it("pushTruthGateViewedOnce forwards full safe attribution payload", () => {
    vi.mocked(captureUtmFromUrl).mockReturnValueOnce({
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "tracking_fix_qa",
      utm_content: "ad1",
      utm_term: "impact windows",
      ttclid: "test-ttclid",
      fbclid: "test-fbclid",
      gclid: "test-gclid",
      wbraid: "test-wbraid",
      gbraid: "test-gbraid",
      msclkid: "test-msclkid",
      ndclid: "test_ndclid_123",
      wm_intent: "has_quote",
      client_slug: "direct",
      query_params: { utm_id: "camp-123" },
      nd_lead_id: null,
      nd_form_id: null,
      nd_ad_id: null,
      nd_ad_group_id: null,
      nd_campaign_id: null,
      fbc: null,
      fbp: null,
      ttp: null,
      landing_page: "/windowman",
      landing_page_url: null,
      raw_query_string: null,
      referrer: null,
      first_touch_at: 0,
      latest_touch_at: 0,
      captured_at: 0,
    });

    pushTruthGateViewedOnce({
      page_path: "/attribution-full",
      page_search: "?utm_source=google",
      page_hash: "#truth-gate",
    });

    const payload = trackGtmEventMock.mock.calls.find(
      ([name]) => name === "truth_gate_viewed",
    )?.[1] as Record<string, unknown>;

    expect(payload).toMatchObject({
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "tracking_fix_qa",
      utm_content: "ad1",
      utm_term: "impact windows",
      utm_id: "camp-123",
      gclid: "test-gclid",
      gbraid: "test-gbraid",
      wbraid: "test-wbraid",
      fbclid: "test-fbclid",
      ttclid: "test-ttclid",
      msclkid: "test-msclkid",
      ndclid: "test_ndclid_123",
      page_path: "/attribution-full",
      page_search: "?utm_source=google",
      page_hash: "#truth-gate",
    });
  });

  it("pushTruthGateViewedOnce strips forbidden PII keys", () => {
    pushTruthGateViewedOnce({
      page_path: "/attribution-pii",
      page_search: "",
      page_hash: "#truth-gate",
    });

    const truthGatePayload = trackGtmEventMock.mock.calls.find(
      ([name]) => name === "truth_gate_viewed",
    )?.[1] as Record<string, unknown>;

    expect(truthGatePayload).toBeDefined();
    expect(truthGatePayload.email).toBeUndefined();
    expect(truthGatePayload.phone).toBeUndefined();
    expect(truthGatePayload.phone_e164).toBeUndefined();
    expect(truthGatePayload.full_json).toBeUndefined();
    expect(truthGatePayload.preview_json).toBeUndefined();
  });

  it("pushTruthGateViewedOnce dedupes when sessionStorage throws", () => {
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("sessionStorage blocked");
    });
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("sessionStorage blocked");
    });

    try {
      pushTruthGateViewedOnce({
        page_path: "/dedupe-memory",
        page_search: "?blocked=1",
        page_hash: "#truth-gate",
      });
      pushTruthGateViewedOnce({
        page_path: "/dedupe-memory",
        page_search: "?blocked=1",
        page_hash: "#truth-gate",
      });

      const truthGateCalls = trackGtmEventMock.mock.calls.filter(
        ([name]) => name === "truth_gate_viewed",
      );
      expect(truthGateCalls).toHaveLength(1);
    } finally {
      getItemSpy.mockRestore();
      setItemSpy.mockRestore();
    }
  });

  it("pushTruthGateViewedOnce does not fire when page_hash is not #truth-gate", () => {
    pushTruthGateViewedOnce({
      page_path: "/windowman",
      page_search: "",
      page_hash: "#other",
    });

    const truthGateCalls = trackGtmEventMock.mock.calls.filter(
      ([name]) => name === "truth_gate_viewed",
    );
    expect(truthGateCalls).toHaveLength(0);
  });

  it("pushDataLayerEvent passes through wm_intent when present in attribution", () => {
    vi.mocked(captureUtmFromUrl).mockReturnValueOnce({
      utm_source: "nextdoor",
      utm_medium: "paid_social",
      utm_campaign: "tracking_fix_qa",
      utm_content: "ad1",
      utm_term: null,
      ttclid: null,
      fbclid: null,
      gclid: null,
      wbraid: null,
      gbraid: null,
      msclkid: null,
      ndclid: "test_ndclid_123",
      wm_intent: "has_quote",
      client_slug: "direct",
      query_params: {},
      nd_lead_id: null,
      nd_form_id: null,
      nd_ad_id: null,
      nd_ad_group_id: null,
      nd_campaign_id: null,
      fbc: null,
      fbp: null,
      ttp: null,
      landing_page: "/windowman",
      landing_page_url: null,
      raw_query_string: null,
      referrer: null,
      first_touch_at: 0,
      latest_touch_at: 0,
      captured_at: 0,
    });

    pushDataLayerEvent("windowman_handoff_has_quote", {
      wm_intent: "has_quote",
    });

    const payload = trackGtmEventMock.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.wm_intent).toBe("has_quote");
  });
});
