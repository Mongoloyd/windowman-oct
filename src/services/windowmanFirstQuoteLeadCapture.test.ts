import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FIRST_QUOTE_SESSION_STORAGE_KEY,
  WINDOWMAN_FIRST_QUOTE_SOURCE,
  buildWindowmanFirstQuoteLeadPayload,
  getOrCreateFirstQuoteSessionId,
  submitWindowmanFirstQuoteLead,
} from "./windowmanFirstQuoteLeadCapture";
import {
  HELP_NEEDED_OPTIONS,
  OPENINGS_BUCKET_OPTIONS,
  PRODUCT_SCOPE_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  TIMING_OPTIONS,
  isValidZipCode,
  normalizeZipCode,
} from "@/components/landing/firstQuoteIntakeTypes";
import { TEST_CONSENT_SUBMISSION_ID } from "@/lib/consent/testConsentFixtures";

const invokeMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
}));

vi.mock("@/lib/useUtmCapture", () => ({
  captureUtmFromUrl: vi.fn(() => ({
    utm_source: "nextdoor",
    utm_medium: null,
    utm_campaign: "first_quote_test",
    utm_term: null,
    utm_content: null,
    fbclid: null,
    gclid: null,
    fbp: null,
    fbc: null,
    client_slug: "direct",
    landing_page: "/windowman",
    landing_page_url: "/windowman?utm_source=nextdoor",
  })),
  getUtmData: vi.fn(() => ({
    utm_source: "nextdoor",
    utm_medium: null,
    utm_campaign: "first_quote_test",
    utm_term: null,
    utm_content: null,
    fbclid: null,
    gclid: null,
    fbp: null,
    fbc: null,
    client_slug: "direct",
    landing_page: "/windowman",
    landing_page_url: "/windowman?utm_source=nextdoor",
  })),
  getAttributionPayload: vi.fn(() => ({
    utm_source: "nextdoor",
    utm_campaign: "first_quote_test",
    wm_intent: "unknown",
    query_params: { utm_source: "nextdoor" },
    fbp: null,
    fbc: null,
  })),
}));

vi.mock("@/lib/attribution/fbCookies", () => ({
  readLateFbCookies: vi.fn((_seed, _ctx) => ({ fbp: null, fbc: null })),
}));

const TEST_SESSION_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

const sampleInput = {
  sessionId: TEST_SESSION_ID,
  submissionId: TEST_CONSENT_SUBMISSION_ID,
  firstName: "Sam",
  email: "sam@example.com",
  phoneE164: "+15551234567",
  projectBasics: {
    zipOrCity: "33301",
    homeownerRole: "I own the home" as const,
    propertyType: PROPERTY_TYPE_OPTIONS[0],
    openingsBucket: OPENINGS_BUCKET_OPTIONS[0],
    productScope: PRODUCT_SCOPE_OPTIONS[0],
    timing: TIMING_OPTIONS[0],
  },
  helpNeeded: HELP_NEEDED_OPTIONS[0],
  preferredContact: "Text" as const,
  serviceCommunicationsGranted: true,
  marketingConsentPresented: true,
  marketingCommunicationsGranted: false,
};

describe("windowmanFirstQuoteLeadCapture", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("payload includes source=windowman-first-quote", () => {
    const payload = buildWindowmanFirstQuoteLeadPayload(sampleInput);
    expect(payload.source).toBe(WINDOWMAN_FIRST_QUOTE_SOURCE);
  });

  it("payload includes wm_intent=no_quote in attribution and query_params", () => {
    const payload = buildWindowmanFirstQuoteLeadPayload(sampleInput);
    expect((payload.attribution as Record<string, unknown>).wm_intent).toBe(
      "no_quote",
    );
    expect((payload.query_params as Record<string, string>).wm_intent).toBe(
      "no_quote",
    );
  });

  it("stores project basics in query_params", () => {
    const qp = buildWindowmanFirstQuoteLeadPayload(sampleInput)
      .query_params as Record<string, string>;
    expect(qp.zip_code).toBe("33301");
    expect(qp.zip_or_city).toBe("33301");
    expect(qp.homeowner_role).toBe("I own the home");
    expect(qp.property_type).toBe(PROPERTY_TYPE_OPTIONS[0]);
    expect(qp.openings_bucket).toBe(OPENINGS_BUCKET_OPTIONS[0]);
    expect(qp.product_scope).toBe(PRODUCT_SCOPE_OPTIONS[0]);
    expect(qp.timing).toBe(TIMING_OPTIONS[0]);
    expect(qp.help_needed).toBe(HELP_NEEDED_OPTIONS[0]);
    expect(qp.preferred_contact).toBe("Text");
    expect(qp.intake_version).toBe("windowman_first_quote_v1");
    expect(qp.source_path).toBe("/windowman");
  });

  it("uses an explicit NQ4 source path without changing the default", () => {
    const defaultQueryParams = buildWindowmanFirstQuoteLeadPayload(sampleInput)
      .query_params as Record<string, string>;
    const nq3QueryParams = buildWindowmanFirstQuoteLeadPayload({
      ...sampleInput,
      sourcePath: "/nq3",
    }).query_params as Record<string, string>;
    const nq4QueryParams = buildWindowmanFirstQuoteLeadPayload({
      ...sampleInput,
      sourcePath: "/nq4",
    }).query_params as Record<string, string>;
    const prophecyQueryParams = buildWindowmanFirstQuoteLeadPayload({
      ...sampleInput,
      sourcePath: "/prophecy",
      wmIntent: "no_quote",
      extraQueryParams: {
        prophecy_intent: "no_quote",
        prophecy_priority: "Not overpaying",
      },
    }).query_params as Record<string, string>;

    expect(defaultQueryParams.source_path).toBe("/windowman");
    expect(nq3QueryParams.source_path).toBe("/nq3");
    expect(nq4QueryParams.source_path).toBe("/nq4");
    expect(prophecyQueryParams.source_path).toBe("/prophecy");
    expect(prophecyQueryParams.prophecy_intent).toBe("no_quote");
    expect(prophecyQueryParams.prophecy_priority).toBe("Not overpaying");
  });

  it("keeps the Prophecy bucket in query_params without sending an exact count", () => {
    const payload = buildWindowmanFirstQuoteLeadPayload({
      ...sampleInput,
      sourcePath: "/prophecy",
      wmIntent: "no_quote",
      projectBasics: {
        ...sampleInput.projectBasics,
        openingsBucket: "11–15",
      },
      extraQueryParams: { prophecy_intent: "no_quote" },
    });
    const queryParams = payload.query_params as Record<string, string>;
    const exactCountKey = ["window", "count"].join("_");
    const estimateFlagKey = ["has", "estimate"].join("_");

    expect(queryParams.openings_bucket).toBe("11–15");
    expect(queryParams.prophecy_intent).toBe("no_quote");
    expect(payload).not.toHaveProperty(exactCountKey);
    expect(payload).not.toHaveProperty(estimateFlagKey);
  });

  it("carries has-quote intent without inventing project scope", () => {
    const payload = buildWindowmanFirstQuoteLeadPayload({
      ...sampleInput,
      sourcePath: "/prophecy",
      wmIntent: "has_quote",
      projectBasics: {
        ...sampleInput.projectBasics,
        openingsBucket: "",
      },
      extraQueryParams: { prophecy_intent: "has_quote" },
    });

    expect((payload.attribution as Record<string, unknown>).wm_intent).toBe(
      "has_quote",
    );
    expect(
      (payload.query_params as Record<string, string>).prophecy_intent,
    ).toBe("has_quote");
  });

  it("does not include project_type, window_count, or quote_range in query_params", () => {
    const qp = buildWindowmanFirstQuoteLeadPayload(sampleInput)
      .query_params as Record<string, string>;
    expect(qp.project_type).toBeUndefined();
    expect(qp.window_count).toBeUndefined();
    expect(qp.quote_range).toBeUndefined();
  });

  it("sets legacy top-level quote fields to null", () => {
    const payload = buildWindowmanFirstQuoteLeadPayload(sampleInput);
    expect(payload.project_type).toBeNull();
    expect(payload.window_count).toBeNull();
    expect(payload.quote_range).toBeNull();
  });

  it("does not store PII in sessionStorage", () => {
    getOrCreateFirstQuoteSessionId();
    const stored = sessionStorage.getItem(FIRST_QUOTE_SESSION_STORAGE_KEY);
    expect(stored).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(stored).not.toContain("sam@example.com");
    expect(stored).not.toContain("Sam");
  });

  it("reuses modal-local session ID", () => {
    const first = getOrCreateFirstQuoteSessionId();
    const second = getOrCreateFirstQuoteSessionId();
    expect(second).toBe(first);
  });

  it("reuses an in-memory session ID when sessionStorage throws", () => {
    const getItemSpy = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("sessionStorage unavailable");
      });
    const setItemSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("sessionStorage unavailable");
      });

    const first = getOrCreateFirstQuoteSessionId();
    const second = getOrCreateFirstQuoteSessionId();

    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(second).toBe(first);

    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
  });

  describe("isValidZipCode", () => {
    it.each([
      ["Miami", false],
      ["abcde", false],
      ["3330", false],
      ["333011", false],
      ["33 301", false],
      ["33301", true],
      [" 33301 ", true],
    ])("validates %s as %s", (input, expected) => {
      expect(isValidZipCode(input)).toBe(expected);
    });

    it("trims outer whitespace before validating", () => {
      expect(isValidZipCode(normalizeZipCode(" 33301 "))).toBe(true);
    });
  });

  it("rejects invalid ZIP before network call", async () => {
    const result = await submitWindowmanFirstQuoteLead({
      ...sampleInput,
      projectBasics: { ...sampleInput.projectBasics, zipOrCity: "Miami" },
    });

    expect(result.ok).toBe(false);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("maps raw errors to safe error", async () => {
    invokeMock.mockResolvedValue({
      data: { success: false, code: "insert_failed", message: "duplicate key" },
      error: null,
    });

    const result = await submitWindowmanFirstQuoteLead(sampleInput);
    expect(result).toEqual({
      ok: false,
      message:
        "We couldn't save your plan yet. Check your details and try again.",
    });
  });

  it("returns success when lead_id is present", async () => {
    invokeMock.mockResolvedValue({
      data: { success: true, lead_id: "lead-abc" },
      error: null,
    });

    const result = await submitWindowmanFirstQuoteLead(sampleInput);
    expect(result).toEqual({ ok: true, leadId: "lead-abc", reused: false });
  });

  it("maps invoke errors to safe error", async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: {
        name: "FunctionsHttpError",
        message: "500 Internal Server Error",
      },
    });

    const result = await submitWindowmanFirstQuoteLead(sampleInput);
    expect(result).toEqual({
      ok: false,
      message:
        "We couldn't save your plan yet. Check your details and try again.",
    });
  });

  it("calls capture-truth-gate-lead, not scanner/upload functions", async () => {
    invokeMock.mockResolvedValue({
      data: { success: true, lead_id: "lead-1" },
      error: null,
    });

    await submitWindowmanFirstQuoteLead(sampleInput);

    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith(
      "capture-truth-gate-lead",
      expect.any(Object),
    );
    expect(invokeMock).not.toHaveBeenCalledWith(
      "scan-quote",
      expect.anything(),
    );
    expect(invokeMock).not.toHaveBeenCalledWith(
      "start-upload-scan-session",
      expect.anything(),
    );
  });
});
