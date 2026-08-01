import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TRUTH_GATE_SOURCE,
  buildTruthGateLeadPayload,
  resolveTruthGateClientSlug,
  submitTruthGateLead,
} from "./truthGateLeadCapture";
import {
  TEST_CONSENT_SUBMISSION_ID,
  testLeadCaptureConsent,
} from "@/lib/consent/testConsentFixtures";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const LEAD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TEST_CONSENT = testLeadCaptureConsent(TRUTH_GATE_SOURCE);

const captureUtmFromUrlMock = vi.fn();
const getAttributionPayloadMock = vi.fn();
const readLateFbCookiesMock = vi.fn();
const invokeMock = vi.fn();
const pushLeadMagnetCapturedMock = vi.fn();
const getOpenAiAdsCaptureContextMock = vi.fn();
const trackOpenAiAdsLeadCreatedMock = vi.fn();

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

vi.mock("@/lib/openAiAdsPixel", () => ({
  getOpenAiAdsCaptureContext: () => getOpenAiAdsCaptureContextMock(),
  trackOpenAiAdsLeadCreated: (...args: unknown[]) =>
    trackOpenAiAdsLeadCreatedMock(...args),
}));

function installLocalStorageMock(initial?: Record<string, string>) {
  const store = new Map<string, string>(Object.entries(initial ?? {}));

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

function stubWindowLocation(search: string, pathname = "/") {
  vi.stubGlobal("window", {
    ...window,
    location: { pathname, search, href: `${pathname}${search}` },
  });
}

describe("truthGateLeadCapture", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    captureUtmFromUrlMock.mockReset();
    getAttributionPayloadMock.mockReset();
    readLateFbCookiesMock.mockReset();
    pushLeadMagnetCapturedMock.mockReset();
    getOpenAiAdsCaptureContextMock.mockReset();
    trackOpenAiAdsLeadCreatedMock.mockReset();

    installLocalStorageMock();
    stubWindowLocation("");

    captureUtmFromUrlMock.mockReturnValue({
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "test",
      utm_term: null,
      utm_content: null,
      fbclid: null,
      gclid: "gclid123",
      fbc: null,
      fbp: null,
      client_slug: "utm-slug",
      landing_page: "/",
      landing_page_url: "/?utm_source=google",
    });

    getAttributionPayloadMock.mockReturnValue({
      utm_source: "google",
      wm_intent: "has_quote",
      query_params: { wm_intent: "has_quote", extra: "1" },
    });

    readLateFbCookiesMock.mockReturnValue({ fbp: "fbp123", fbc: "fbc123" });
    getOpenAiAdsCaptureContextMock.mockReturnValue({
      measurementConsent: true,
      sourceUrl: "https://windowman.app/",
      oppref: "opaque-oppref",
      obref: "opaque-obref",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("resolveTruthGateClientSlug", () => {
    it("prefers funnelClientSlug over URL, utm, and localStorage", () => {
      installLocalStorageMock({ wm_client_slug: "home-depot" });
      stubWindowLocation("?client=lowe");

      expect(resolveTruthGateClientSlug("funnel-slug", "utm-slug")).toBe("funnel-slug");
    });

    it("prefers URL ?client= over utm and localStorage when funnel absent", () => {
      installLocalStorageMock({ wm_client_slug: "home-depot" });
      stubWindowLocation("?client=lowe");

      expect(resolveTruthGateClientSlug(null, "utm-slug")).toBe("lowe");
    });

    it("prefers utm.client_slug over localStorage when query client absent", () => {
      installLocalStorageMock({ wm_client_slug: "home-depot" });
      stubWindowLocation("");

      expect(resolveTruthGateClientSlug(null, "utm-slug")).toBe("utm-slug");
    });

    it("uses localStorage when no funnel, query, or utm slug exists", () => {
      installLocalStorageMock({ wm_client_slug: "home-depot" });
      stubWindowLocation("");

      expect(resolveTruthGateClientSlug(null, null)).toBe("home-depot");
    });

    it("writes resolved client_slug to localStorage", () => {
      const store = installLocalStorageMock();
      stubWindowLocation("?client=lowe");

      resolveTruthGateClientSlug(null, null);

      expect(store.get("wm_client_slug")).toBe("lowe");
    });
  });

  describe("buildTruthGateLeadPayload", () => {
    it("preserves snake_case payload shape and null quiz scalars", () => {
      const payload = buildTruthGateLeadPayload({
        sessionId: SESSION_ID,
        firstName: "Jane",
        email: "jane@example.com",
        phoneE164: null,
        funnelClientSlug: null,
        consent: TEST_CONSENT,
      });

      expect(payload).toMatchObject({
        session_id: SESSION_ID,
        first_name: "Jane",
        email: "jane@example.com",
        phone_e164: null,
        county: null,
        project_type: null,
        window_count: null,
        quote_range: null,
        source: TRUTH_GATE_SOURCE,
        utm_source: "google",
        gclid: "gclid123",
        fbc: "fbc123",
        fbp: "fbp123",
        landing_page_url: "/?utm_source=google",
        first_page_path: "/",
      });

      expect(payload.attribution).toEqual({
        utm_source: "google",
        wm_intent: "has_quote",
        capture_page_path: "/",
        capture_page_url: "/",
      });
      expect(payload.query_params).toEqual({
        wm_intent: "has_quote",
        extra: "1",
        capture_page_path: "/",
        capture_page_url: "/",
      });
      expect(payload).not.toHaveProperty("wm_intent");
    });

    it("records capture_page_path/url from the current route independent of stale landing_page_url (B1)", () => {
      // Simulate a browser with a stale first-touch landing_page_url from an
      // earlier, unrelated visit while the current submit happens on a
      // paid magnet route.
      captureUtmFromUrlMock.mockReturnValue({
        utm_source: "nextdoor",
        utm_medium: "paid_social",
        utm_campaign: "old_pilot",
        utm_term: null,
        utm_content: null,
        fbclid: null,
        gclid: "test-gclid-wpa",
        fbc: null,
        fbp: null,
        client_slug: "direct",
        landing_page: "/",
        landing_page_url: "/?utm_source=nextdoor&utm_campaign=old_pilot",
      });
      getAttributionPayloadMock.mockReturnValue({
        utm_source: "nextdoor",
        current_page_url:
          "/window-price-audit?utm_source=qa&gclid=test-gclid-wpa",
        query_params: { gclid: "test-gclid-wpa" },
      });
      stubWindowLocation(
        "?utm_source=qa&gclid=test-gclid-wpa",
        "/window-price-audit",
      );

      const payload = buildTruthGateLeadPayload({
        sessionId: SESSION_ID,
        firstName: "Jane",
        email: "jane@example.com",
        phoneE164: null,
        funnelClientSlug: null,
        consent: TEST_CONSENT,
      });

      // Stale first-touch scalar is preserved (v1 keeps first-touch semantics).
      expect(payload.landing_page_url).toBe(
        "/?utm_source=nextdoor&utm_campaign=old_pilot",
      );
      // But the capture-time page is recorded separately, unaffected by staleness.
      expect(payload.query_params).toMatchObject({
        capture_page_path: "/window-price-audit",
        capture_page_url: "/window-price-audit?utm_source=qa&gclid=test-gclid-wpa",
      });
      expect(payload.attribution).toMatchObject({
        capture_page_path: "/window-price-audit",
        capture_page_url: "/window-price-audit?utm_source=qa&gclid=test-gclid-wpa",
      });
    });

    it("calls captureUtmFromUrl at build time", () => {
      buildTruthGateLeadPayload({
        sessionId: SESSION_ID,
        firstName: "Jane",
        email: "jane@example.com",
        phoneE164: "+15551234567",
        funnelClientSlug: null,
        consent: TEST_CONSENT,
      });

      expect(captureUtmFromUrlMock).toHaveBeenCalled();
    });

    it("calls readLateFbCookies with truth_gate_flow surface", () => {
      buildTruthGateLeadPayload({
        sessionId: SESSION_ID,
        firstName: "Jane",
        email: "jane@example.com",
        phoneE164: null,
        funnelClientSlug: null,
        consent: TEST_CONSENT,
      });

      expect(readLateFbCookiesMock).toHaveBeenCalledWith(
        { fbp: null, fbc: null },
        { surface: "truth_gate_flow", sessionId: SESSION_ID },
      );
    });

    it("uses landing_page_url fallback when utm value absent", () => {
      captureUtmFromUrlMock.mockReturnValue({
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        utm_term: null,
        utm_content: null,
        fbclid: null,
        gclid: null,
        fbc: null,
        fbp: null,
        client_slug: null,
        landing_page: "/",
        landing_page_url: null,
      });
      stubWindowLocation("?foo=bar", "/landing");

      const payload = buildTruthGateLeadPayload({
        sessionId: SESSION_ID,
        firstName: "Jane",
        email: "jane@example.com",
        phoneE164: null,
        funnelClientSlug: null,
        consent: TEST_CONSENT,
      });

      expect(payload.landing_page_url).toBe("/landing?foo=bar");
    });

    it("maps valid phone to E.164 via submit path input", () => {
      const payload = buildTruthGateLeadPayload({
        sessionId: SESSION_ID,
        firstName: "Jane",
        email: "jane@example.com",
        phoneE164: "+15551234567",
        funnelClientSlug: null,
        consent: TEST_CONSENT,
      });

      expect(payload.phone_e164).toBe("+15551234567");
    });
  });

  describe("submitTruthGateLead", () => {
    it("invokes only capture-truth-gate-lead with truth-gate source", async () => {
      invokeMock.mockResolvedValue({
        data: { success: true, lead_id: LEAD_ID, session_id: SESSION_ID },
        error: null,
      });

      const result = await submitTruthGateLead({
        sessionId: SESSION_ID,
        firstName: "Jane",
        email: "jane@example.com",
        phone: "",
        funnelClientSlug: null,
        submissionId: TEST_CONSENT_SUBMISSION_ID,
        marketingCommunicationsGranted: false,
      });

      expect(result.ok).toBe(true);
      expect(invokeMock).toHaveBeenCalledTimes(1);
      expect(invokeMock).toHaveBeenCalledWith("capture-truth-gate-lead", {
        body: expect.objectContaining({
          source: TRUTH_GATE_SOURCE,
          openai_ads: {
            measurementConsent: true,
            sourceUrl: "https://windowman.app/",
            oppref: "opaque-oppref",
            obref: "opaque-obref",
          },
        }),
      });
    });

    it("includes consent schema v1 with marketing declined when unchecked", async () => {
      invokeMock.mockResolvedValue({
        data: { success: true, lead_id: LEAD_ID, session_id: SESSION_ID },
        error: null,
      });

      await submitTruthGateLead({
        sessionId: SESSION_ID,
        firstName: "Jane",
        email: "jane@example.com",
        phone: "",
        funnelClientSlug: null,
        submissionId: TEST_CONSENT_SUBMISSION_ID,
        marketingCommunicationsGranted: false,
      });

      const body = invokeMock.mock.calls[0][1].body;
      expect(body.consent).toMatchObject({
        schemaVersion: "1",
        privacyPolicyVersion: "2026-08-01",
        termsVersion: "2026-04-14",
        source: TRUTH_GATE_SOURCE,
      });
      expect(body.consent.events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            purpose: "service_communications",
            decision: "granted",
          }),
          expect.objectContaining({
            purpose: "marketing_communications",
            decision: "declined",
          }),
        ]),
      );
    });

    it("fires OpenAI lead_created once with the unchanged server event ID after a new insert", async () => {
      const serverEventId = `wm_openai_lead_created_${LEAD_ID}`;
      invokeMock.mockResolvedValue({
        data: {
          success: true,
          lead_id: LEAD_ID,
          session_id: SESSION_ID,
          openai_ads_event_id: serverEventId,
        },
        error: null,
      });

      const result = await submitTruthGateLead({
        sessionId: SESSION_ID,
        firstName: "Jane",
        email: "jane@example.com",
        phone: "",
        funnelClientSlug: null,
        submissionId: TEST_CONSENT_SUBMISSION_ID,
        marketingCommunicationsGranted: false,
      });

      expect(result.ok).toBe(true);
      expect(trackOpenAiAdsLeadCreatedMock).toHaveBeenCalledTimes(1);
      expect(trackOpenAiAdsLeadCreatedMock).toHaveBeenCalledWith(serverEventId);
      if (result.ok) {
        expect(result.openAiAdsEventId).toBe(serverEventId);
      }
    });

    it("does not fire OpenAI lead_created for a reused capture", async () => {
      invokeMock.mockResolvedValue({
        data: {
          success: true,
          lead_id: LEAD_ID,
          session_id: SESSION_ID,
          reused: true,
          openai_ads_event_id: `wm_openai_lead_created_${LEAD_ID}`,
        },
        error: null,
      });

      await submitTruthGateLead({
        sessionId: SESSION_ID,
        firstName: "Jane",
        email: "jane@example.com",
        phone: "",
        funnelClientSlug: null,
        submissionId: TEST_CONSENT_SUBMISSION_ID,
        marketingCommunicationsGranted: false,
      });

      expect(trackOpenAiAdsLeadCreatedMock).not.toHaveBeenCalled();
    });

    it("does not fire OpenAI lead_created when the server ID is missing", async () => {
      invokeMock.mockResolvedValue({
        data: { success: true, lead_id: LEAD_ID, session_id: SESSION_ID },
        error: null,
      });

      await submitTruthGateLead({
        sessionId: SESSION_ID,
        firstName: "Jane",
        email: "jane@example.com",
        phone: "",
        funnelClientSlug: null,
        submissionId: TEST_CONSENT_SUBMISSION_ID,
        marketingCommunicationsGranted: false,
      });

      expect(trackOpenAiAdsLeadCreatedMock).not.toHaveBeenCalled();
    });

    it("does not send OpenAI request context or fire Pixel when consent is absent", async () => {
      getOpenAiAdsCaptureContextMock.mockReturnValue(null);
      invokeMock.mockResolvedValue({
        data: {
          success: true,
          lead_id: LEAD_ID,
          session_id: SESSION_ID,
          openai_ads_event_id: `wm_openai_lead_created_${LEAD_ID}`,
        },
        error: null,
      });

      await submitTruthGateLead({
        sessionId: SESSION_ID,
        firstName: "Jane",
        email: "jane@example.com",
        phone: "",
        funnelClientSlug: null,
        submissionId: TEST_CONSENT_SUBMISSION_ID,
        marketingCommunicationsGranted: false,
      });

      expect(invokeMock.mock.calls[0][1].body).not.toHaveProperty("openai_ads");
      expect(trackOpenAiAdsLeadCreatedMock).not.toHaveBeenCalled();
    });

    it("does not push raw contact fields into dataLayer beyond lead/session ids", async () => {
      invokeMock.mockResolvedValue({
        data: { success: true, lead_id: LEAD_ID, session_id: SESSION_ID },
        error: null,
      });

      await submitTruthGateLead({
        sessionId: SESSION_ID,
        firstName: "Jane",
        email: "jane@example.com",
        phone: "",
        funnelClientSlug: null,
        submissionId: TEST_CONSENT_SUBMISSION_ID,
        marketingCommunicationsGranted: false,
      });

      expect(pushLeadMagnetCapturedMock).toHaveBeenCalledWith(
        expect.not.objectContaining({
          email: expect.anything(),
          phone: expect.anything(),
          firstName: expect.anything(),
        }),
      );
    });

    it("fires pushLeadMagnetCaptured once with the DB lead_id after success (not before)", async () => {
      invokeMock.mockResolvedValue({
        data: { success: true, lead_id: LEAD_ID, session_id: SESSION_ID },
        error: null,
      });

      const result = await submitTruthGateLead({
        sessionId: SESSION_ID,
        firstName: "Jane",
        email: "jane@example.com",
        phone: "",
        funnelClientSlug: null,
        submissionId: TEST_CONSENT_SUBMISSION_ID,
        marketingCommunicationsGranted: false,
      });

      expect(result.ok).toBe(true);
      expect(pushLeadMagnetCapturedMock).toHaveBeenCalledTimes(1);
      expect(pushLeadMagnetCapturedMock).toHaveBeenCalledWith(
        expect.objectContaining({
          leadId: LEAD_ID,
          sessionId: SESSION_ID,
          captureSource: TRUTH_GATE_SOURCE,
        }),
      );
    });

    it("does not fire pushLeadMagnetCaptured when capture fails", async () => {
      invokeMock.mockResolvedValue({
        data: { success: false, message: "Lead capture failed." },
        error: null,
      });

      await submitTruthGateLead({
        sessionId: SESSION_ID,
        firstName: "Jane",
        email: "jane@example.com",
        phone: "",
        funnelClientSlug: null,
        submissionId: TEST_CONSENT_SUBMISSION_ID,
        marketingCommunicationsGranted: false,
      });

      expect(pushLeadMagnetCapturedMock).not.toHaveBeenCalled();
      expect(trackOpenAiAdsLeadCreatedMock).not.toHaveBeenCalled();
    });

    it("normalizes empty phone to null in payload", async () => {
      invokeMock.mockResolvedValue({
        data: { success: true, lead_id: LEAD_ID, session_id: SESSION_ID },
        error: null,
      });

      await submitTruthGateLead({
        sessionId: SESSION_ID,
        firstName: "Jane",
        email: "jane@example.com",
        phone: "",
        funnelClientSlug: null,
        submissionId: TEST_CONSENT_SUBMISSION_ID,
        marketingCommunicationsGranted: false,
      });

      const body = invokeMock.mock.calls[0][1].body;
      expect(body.phone_e164).toBe(null);
    });

    it("maps server success to ok result", async () => {
      invokeMock.mockResolvedValue({
        data: { success: true, lead_id: LEAD_ID, session_id: SESSION_ID, reused: true },
        error: null,
      });

      const result = await submitTruthGateLead({
        sessionId: SESSION_ID,
        firstName: "Jane",
        email: "jane@example.com",
        phone: "(555) 123-4567",
        funnelClientSlug: null,
        submissionId: TEST_CONSENT_SUBMISSION_ID,
        marketingCommunicationsGranted: false,
      });

      expect(result).toEqual({
        ok: true,
        leadId: LEAD_ID,
        sessionId: SESSION_ID,
        reused: true,
        phoneE164: "+15551234567",
        clientSlug: "utm-slug",
      });
    });

    it("maps server error to ok:false with server message", async () => {
      invokeMock.mockResolvedValue({
        data: { success: false, message: "Lead capture failed." },
        error: null,
      });

      const result = await submitTruthGateLead({
        sessionId: SESSION_ID,
        firstName: "Jane",
        email: "jane@example.com",
        phone: "",
        funnelClientSlug: null,
        submissionId: TEST_CONSENT_SUBMISSION_ID,
        marketingCommunicationsGranted: false,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toBe("Lead capture failed.");
        expect(result.code).toBe("lead_capture_failed");
      }
    });

    it("maps invoke error to ok:false with safe fallback message", async () => {
      invokeMock.mockResolvedValue({
        data: null,
        error: { name: "FunctionsHttpError", message: "Internal Server Error" },
      });

      const result = await submitTruthGateLead({
        sessionId: SESSION_ID,
        firstName: "Jane",
        email: "jane@example.com",
        phone: "",
        funnelClientSlug: null,
        submissionId: TEST_CONSENT_SUBMISSION_ID,
        marketingCommunicationsGranted: false,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toBe("Internal Server Error");
      }
    });

    it("maps missing lead_id to ok:false with safe message", async () => {
      invokeMock.mockResolvedValue({
        data: { success: true, lead_id: null, session_id: SESSION_ID },
        error: null,
      });

      const result = await submitTruthGateLead({
        sessionId: SESSION_ID,
        firstName: "Jane",
        email: "jane@example.com",
        phone: "",
        funnelClientSlug: null,
        submissionId: TEST_CONSENT_SUBMISSION_ID,
        marketingCommunicationsGranted: false,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toBe(
          "We couldn't save your details yet. Check them and try again.",
        );
      }
    });

    it("maps thrown errors to ok:false without throwing", async () => {
      invokeMock.mockRejectedValue(new Error("network timeout"));

      const result = await submitTruthGateLead({
        sessionId: SESSION_ID,
        firstName: "Jane",
        email: "jane@example.com",
        phone: "",
        funnelClientSlug: null,
        submissionId: TEST_CONSENT_SUBMISSION_ID,
        marketingCommunicationsGranted: false,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toBe(
          "We couldn't save your details yet. Check them and try again.",
        );
      }
    });
  });
});
