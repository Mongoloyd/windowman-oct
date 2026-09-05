import { beforeEach, describe, expect, it, vi } from "vitest";

const trackGtmEventMock = vi.fn();

vi.mock("@/lib/trackConversion", () => ({
  trackGtmEvent: (...args: unknown[]) => trackGtmEventMock(...args),
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
  HANDOFF_SOURCE_ROUTE_KEY,
  pushDataLayerEvent,
  pushLeadMagnetCaptured,
  pushLeadMagnetUploadCtaClicked,
  pushLowIntentEvent,
  pushTruthGateViewedOnce,
  pushV3BusinessEvent,
  pushV3DiagnosticEvent,
  pushVirtualPageView,
  type V3BusinessEventName,
  type V3DataLayerParameters,
  type V3DiagnosticEventName,
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

  it("buildAttributionDataLayerPayload includes attribution without persistent identifiers", () => {
    const payload = buildAttributionDataLayerPayload();
    expect(payload.utm_source).toBe("nextdoor");
    expect(payload.ndclid).toBe("test_ndclid_123");
    expect(payload.wm_intent).toBeNull();
    expect(payload).not.toHaveProperty("visitor_id");
    expect(payload).not.toHaveProperty("lead_id");
    expect(payload).not.toHaveProperty("session_id");
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
      visitor_id: "visitor-id",
      lead_id: "lead-id",
      session_id: "session-id",
    });

    const payload = trackGtmEventMock.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.event).toBeUndefined();
    expect(payload.email).toBeUndefined();
    expect(payload.phone_e164).toBeUndefined();
    expect(payload.visitor_id).toBeUndefined();
    expect(payload.lead_id).toBeUndefined();
    expect(payload.session_id).toBeUndefined();
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

  describe("V3 browser envelope", () => {
    it("pushes an allowlisted business event with the trimmed caller-owned event ID", () => {
      pushV3BusinessEvent("lead_captured", {
        eventId: "  canonical-event-id  ",
        parameters: {
          source_tool: "wmchat",
          measurement_source: "native",
          step_index: 0,
          project_type: null,
        },
      });

      expect(trackGtmEventMock).toHaveBeenCalledWith("lead_captured", {
        source_tool: "wmchat",
        measurement_source: "native",
        step_index: 0,
        project_type: null,
        event_id: "canonical-event-id",
      });
    });

    it("suppresses a business event with a blank caller-owned event ID", () => {
      pushV3BusinessEvent("quote_uploaded", {
        eventId: "   ",
        parameters: { source_tool: "upload_zone" },
      });

      expect(trackGtmEventMock).not.toHaveBeenCalled();
    });

    it("does not let V3 parameters override the caller-owned event ID", () => {
      pushV3BusinessEvent("phone_verified", {
        eventId: "server-event-id",
        parameters: {
          source_tool: "verify_gate",
          event_id: "substituted-event-id",
        } as V3DataLayerParameters,
      });

      expect(trackGtmEventMock).toHaveBeenCalledWith("phone_verified", {
        source_tool: "verify_gate",
        event_id: "server-event-id",
      });
    });

    it("pushes a diagnostic event without manufacturing an event ID", () => {
      pushV3DiagnosticEvent("wmchat_step_completed", {
        step_name: "project_type",
        step_index: 0,
        journey_type: null,
        measurement_source: null,
      });

      const payload = trackGtmEventMock.mock.calls[0][1] as Record<string, unknown>;
      expect(payload).toEqual({
        step_name: "project_type",
        step_index: 0,
        journey_type: null,
        measurement_source: null,
      });
      expect(payload).not.toHaveProperty("event_id");
    });

    it("drops blank, non-finite, array, object, and invalid measurement values", () => {
      pushV3DiagnosticEvent(
        "powerdemo_started",
        {
          source_tool: "   ",
          flow_variant: [],
          project_type: {},
          step_index: Number.NaN,
          project_scope: Number.POSITIVE_INFINITY,
          project_stage: Number.NEGATIVE_INFINITY,
          measurement_source: "server",
          service_area_status: undefined,
          journey_type: null,
          cta_location: "  hero  ",
        } as V3DataLayerParameters,
      );

      expect(trackGtmEventMock).toHaveBeenCalledWith("powerdemo_started", {
        journey_type: null,
        cta_location: "hero",
      });
    });

    it("rejects forbidden identifiers, PII, click IDs, raw JSON, and unknown keys at runtime", () => {
      const forbiddenParameters = {
        source_tool: "wmchat",
        email: "owner@example.com",
        phone: "5551234567",
        phone_e164: "+15551234567",
        first_name: "Ada",
        last_name: "Lovelace",
        name: "Ada Lovelace",
        full_name: "Ada Lovelace",
        zip: "33101",
        zipcode: "33101",
        zip_code: "33101",
        postal_code: "33101",
        address: "1 Main Street",
        street_address: "1 Main Street",
        lead_id: "lead-id",
        visitor_id: "visitor-id",
        session_id: "session-id",
        scan_session_id: "scan-session-id",
        quote_id: "quote-id",
        report_id: "report-id",
        gclid: "gclid-value",
        fbclid: "fbclid-value",
        ttclid: "ttclid-value",
        msclkid: "msclkid-value",
        full_json: { secret: true },
        preview_json: { teaser: true },
        arbitrary_unknown_key: "unknown-value",
      } as V3DataLayerParameters;

      pushV3DiagnosticEvent("wmchat_started", forbiddenParameters);

      expect(trackGtmEventMock).toHaveBeenCalledWith("wmchat_started", {
        source_tool: "wmchat",
      });
    });

    it("rejects non-allowlisted event names even when TypeScript is bypassed", () => {
      pushV3BusinessEvent("purchase" as V3BusinessEventName, {
        eventId: "event-id",
        parameters: {},
      });
      pushV3DiagnosticEvent(
        "debug_event" as V3DiagnosticEventName,
        { source_tool: "wmchat" },
      );

      expect(trackGtmEventMock).not.toHaveBeenCalled();
    });
  });

  describe("pushLeadMagnetCaptured", () => {
    it("fires once with capture fields and a dedup event ID without persistent identifiers", () => {
      pushLeadMagnetCaptured({
        leadId: "lead-abc-123",
        sessionId: "session-xyz-456",
        captureSource: "window_price_audit",
        capturePagePath: "/window-price-audit",
        capturePageUrl: "/window-price-audit?utm_source=qa",
      });

      const calls = trackGtmEventMock.mock.calls.filter(
        ([name]) => name === "lead_magnet_captured",
      );
      expect(calls).toHaveLength(1);
      expect(calls[0][1]).toMatchObject({
        capture_source: "window_price_audit",
        capture_page_path: "/window-price-audit",
        capture_page_url: "/window-price-audit?utm_source=qa",
        utm_source: "nextdoor",
      });
      expect(calls[0][1]).not.toHaveProperty("lead_id");
      expect(calls[0][1]).not.toHaveProperty("session_id");
      expect(calls[0][1].event_id).toEqual(expect.stringContaining("lead_magnet_captured"));
      expect(calls[0][1].event_id).not.toEqual(expect.stringContaining("lead-abc-123"));
      expect(calls[0][1].event_id).not.toEqual(expect.stringContaining("session-xyz-456"));
    });

    it("does not fire before this helper is called (no submit-start fire)", () => {
      // Sanity check: nothing pushes lead_magnet_captured as a side effect
      // of unrelated dataLayer helpers.
      pushVirtualPageView({ page_path: "/window-price-audit", page_search: "" });

      const calls = trackGtmEventMock.mock.calls.filter(
        ([name]) => name === "lead_magnet_captured",
      );
      expect(calls).toHaveLength(0);
    });

    it("dedupes repeated fires for the same lead/session", () => {
      pushLeadMagnetCaptured({
        leadId: "lead-dedupe-1",
        sessionId: "session-dedupe-1",
        captureSource: "ai_demo",
      });
      pushLeadMagnetCaptured({
        leadId: "lead-dedupe-1",
        sessionId: "session-dedupe-1",
        captureSource: "ai_demo",
      });

      const calls = trackGtmEventMock.mock.calls.filter(
        ([name]) => name === "lead_magnet_captured",
      );
      expect(calls).toHaveLength(1);
    });

    it("allows a fresh fire for a different lead/session (retry after failure is not blocked)", () => {
      pushLeadMagnetCaptured({
        leadId: "lead-retry-1",
        sessionId: "session-retry-1",
        captureSource: "truth_report_demo",
      });
      pushLeadMagnetCaptured({
        leadId: "lead-retry-2",
        sessionId: "session-retry-1",
        captureSource: "truth_report_demo",
      });

      const calls = trackGtmEventMock.mock.calls.filter(
        ([name]) => name === "lead_magnet_captured",
      );
      expect(calls).toHaveLength(2);
    });

    it("never includes email, phone, or full_json", () => {
      pushLeadMagnetCaptured({
        leadId: "lead-pii-check",
        sessionId: "session-pii-check",
        captureSource: "window_prices",
      });

      const payload = trackGtmEventMock.mock.calls.find(
        ([name]) => name === "lead_magnet_captured",
      )?.[1] as Record<string, unknown>;

      expect(payload.email).toBeUndefined();
      expect(payload.phone).toBeUndefined();
      expect(payload.phone_e164).toBeUndefined();
      expect(payload.full_json).toBeUndefined();
      expect(payload.preview_json).toBeUndefined();
    });
  });

  describe("pushLeadMagnetUploadCtaClicked", () => {
    it("fires with handoff_source and destination_url, and persists the handoff hint", () => {
      pushLeadMagnetUploadCtaClicked({
        leadId: "lead-upload-1",
        sessionId: "session-upload-1",
        handoffSource: "window_price_audit",
        captureSource: "window_price_audit",
        destinationUrl: "/?post_capture=upload&source=window_price_audit",
      });

      const calls = trackGtmEventMock.mock.calls.filter(
        ([name]) => name === "lead_magnet_upload_cta_clicked",
      );
      expect(calls).toHaveLength(1);
      expect(calls[0][1]).toMatchObject({
        handoff_source: "window_price_audit",
        capture_source: "window_price_audit",
        destination_url: "/?post_capture=upload&source=window_price_audit",
      });
      expect(calls[0][1]).not.toHaveProperty("lead_id");
      expect(calls[0][1]).not.toHaveProperty("session_id");
      expect(calls[0][1].event_id).not.toEqual(expect.stringContaining("lead-upload-1"));
      expect(calls[0][1].event_id).not.toEqual(expect.stringContaining("session-upload-1"));
      expect(sessionStorage.getItem(HANDOFF_SOURCE_ROUTE_KEY)).toBe("window_price_audit");
    });

    it("dedupes repeated fires for the same lead/session", () => {
      pushLeadMagnetUploadCtaClicked({
        leadId: "lead-upload-dedupe",
        sessionId: "session-upload-dedupe",
        handoffSource: "quote-check",
        destinationUrl: "/?post_capture=upload&source=quote-check",
      });
      pushLeadMagnetUploadCtaClicked({
        leadId: "lead-upload-dedupe",
        sessionId: "session-upload-dedupe",
        handoffSource: "quote-check",
        destinationUrl: "/?post_capture=upload&source=quote-check",
      });

      const calls = trackGtmEventMock.mock.calls.filter(
        ([name]) => name === "lead_magnet_upload_cta_clicked",
      );
      expect(calls).toHaveLength(1);
    });
  });
});
