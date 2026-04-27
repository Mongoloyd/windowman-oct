import { describe, expect, it } from "vitest";
import {
  buildNeutralEventDraft,
  evaluateDispatchEligibilityDraft,
  maskAttributionIds,
  neutralEventCategoryOf,
  normalizeNeutralEventName,
} from "../neutralEventModel";

describe("normalizeNeutralEventName", () => {
  it("collapses legacy aliases to the canonical ladder name", () => {
    expect(normalizeNeutralEventName("quote_validation_passed")).toBe("quote_uploaded");
    expect(normalizeNeutralEventName("quote_upload_completed")).toBe("quote_uploaded");
    expect(normalizeNeutralEventName("lead_identified")).toBe("lead_captured");
    expect(normalizeNeutralEventName("sale_confirmed")).toBe("sold_closed");
    expect(normalizeNeutralEventName("sold")).toBe("sold_closed");
  });

  it("returns null for empty / whitespace / unknown identifiers", () => {
    expect(normalizeNeutralEventName(undefined)).toBeNull();
    expect(normalizeNeutralEventName(null)).toBeNull();
    expect(normalizeNeutralEventName("")).toBeNull();
    expect(normalizeNeutralEventName("   ")).toBeNull();
    expect(normalizeNeutralEventName("Meta_Lead")).toBeNull();
  });

  it("is case-insensitive on the input", () => {
    expect(normalizeNeutralEventName("QUOTE_UPLOADED")).toBe("quote_uploaded");
    expect(normalizeNeutralEventName("  Phone_Verified  ")).toBe("phone_verified");
  });
});

describe("neutralEventCategoryOf", () => {
  it("classifies all currently-known names as funnel events", () => {
    expect(neutralEventCategoryOf("lead_captured")).toBe("funnel");
    expect(neutralEventCategoryOf("phone_verified")).toBe("funnel");
    expect(neutralEventCategoryOf("sold_closed")).toBe("funnel");
  });
});

describe("buildNeutralEventDraft", () => {
  it("normalizes legacy event names and preserves the canonical id", () => {
    const draft = buildNeutralEventDraft({
      canonicalEventId: "wmc_quote_uploaded_lead-1__scan-2_bucket",
      eventName: "quote_validation_passed",
      eventTime: "2026-04-27T10:00:00.000Z",
      eventSource: "edge_function",
      clientSlug: "tenant-a",
      leadId: "lead-1",
      scanSessionId: "scan-2",
      utm: { source: "meta", medium: "paid", campaign: "spring", term: null, content: null },
      attribution: { fbclid: "abc", gclid: null, fbc: "fb.1.111.abc", fbp: null },
      sourcePlatform: "meta",
      sourceChannel: "paid",
      valueCents: 12_999,
      currency: "USD",
      metadata: { surface: "scan-quote" },
    });

    expect(draft.eventName).toBe("quote_uploaded");
    expect(draft.canonicalEventId).toBe("wmc_quote_uploaded_lead-1__scan-2_bucket");
    expect(draft.eventCategory).toBe("funnel");
    expect(draft.eventTime).toBe("2026-04-27T10:00:00.000Z");
    expect(draft.attribution.fbclidPresent).toBe(true);
    expect(draft.attribution.gclidPresent).toBe(false);
    expect(draft.utm.source).toBe("meta");
    expect(draft.valueCents).toBe(12_999);
    expect(draft.dispatchEligible).toBe(true);
    expect(draft.dispatchBlockReason).toBeNull();
  });

  it("flags an unknown event name without throwing", () => {
    const draft = buildNeutralEventDraft({
      canonicalEventId: "wmc_unknown_no-entity_bucket",
      eventName: "Meta_Lead", // Meta-named: must NOT enter the neutral plane
    });

    expect(draft.dispatchBlockReason).toBe("unknown_event_name");
    expect(draft.dispatchEligible).toBe(true); // structural flag only — final
                                                // eligibility uses the evaluator
  });

  it("truncates non-integer cents and preserves null inputs", () => {
    const draft = buildNeutralEventDraft({
      canonicalEventId: "wmc_lead_captured_no-entity_bucket",
      eventName: "lead_captured",
      valueCents: 1234.78,
    });
    expect(draft.valueCents).toBe(1234);

    const nullishDraft = buildNeutralEventDraft({
      canonicalEventId: "wmc_lead_captured_no-entity_bucket",
      eventName: "lead_captured",
      valueCents: null,
      currency: null,
    });
    expect(nullishDraft.valueCents).toBeNull();
    expect(nullishDraft.currency).toBeNull();
  });
});

describe("evaluateDispatchEligibilityDraft", () => {
  const baseInput = {
    identityQuality: "high" as const,
    anomalyStatus: "safe" as const,
    trustScore: 0.9,
    manualReviewRequired: false,
    hasClientSlug: true,
    hasConfiguredDestination: true,
    isDispatchableCategory: true,
  };

  it("approves a clean event", () => {
    expect(evaluateDispatchEligibilityDraft(baseInput)).toEqual({
      dispatchEligible: true,
      dispatchBlockReason: null,
    });
  });

  it("blocks structurally before policy", () => {
    expect(
      evaluateDispatchEligibilityDraft({ ...baseInput, missingEventId: true, identityQuality: "low" }),
    ).toEqual({ dispatchEligible: false, dispatchBlockReason: "missing_event_id" });
  });

  it("blocks an unknown event name", () => {
    expect(
      evaluateDispatchEligibilityDraft({ ...baseInput, unknownEventName: true }),
    ).toEqual({ dispatchEligible: false, dispatchBlockReason: "unknown_event_name" });
  });

  it("blocks non-dispatchable categories (e.g. traffic)", () => {
    expect(
      evaluateDispatchEligibilityDraft({ ...baseInput, isDispatchableCategory: false }),
    ).toEqual({ dispatchEligible: false, dispatchBlockReason: "non_dispatchable_event" });
  });

  it("blocks when client_slug is missing", () => {
    expect(
      evaluateDispatchEligibilityDraft({ ...baseInput, hasClientSlug: false }),
    ).toEqual({ dispatchEligible: false, dispatchBlockReason: "missing_client_slug" });
  });

  it("blocks weak identity", () => {
    expect(
      evaluateDispatchEligibilityDraft({ ...baseInput, identityQuality: "low" }),
    ).toEqual({ dispatchEligible: false, dispatchBlockReason: "identity_too_weak" });
    expect(
      evaluateDispatchEligibilityDraft({ ...baseInput, identityQuality: "unknown" }),
    ).toEqual({ dispatchEligible: false, dispatchBlockReason: "identity_too_weak" });
  });

  it("blocks unsafe anomaly status and manual review", () => {
    expect(
      evaluateDispatchEligibilityDraft({ ...baseInput, anomalyStatus: "review" }),
    ).toEqual({ dispatchEligible: false, dispatchBlockReason: "anomaly_unsafe" });
    expect(
      evaluateDispatchEligibilityDraft({ ...baseInput, manualReviewRequired: true }),
    ).toEqual({ dispatchEligible: false, dispatchBlockReason: "manual_review_required" });
  });

  it("respects the configurable trust threshold", () => {
    expect(
      evaluateDispatchEligibilityDraft({ ...baseInput, trustScore: 0.5 }),
    ).toEqual({ dispatchEligible: false, dispatchBlockReason: "trust_below_threshold" });
    expect(
      evaluateDispatchEligibilityDraft({ ...baseInput, trustScore: 0.5, trustMin: 0.4 }),
    ).toEqual({ dispatchEligible: true, dispatchBlockReason: null });
  });

  it("blocks when no destination is configured", () => {
    expect(
      evaluateDispatchEligibilityDraft({ ...baseInput, hasConfiguredDestination: false }),
    ).toEqual({ dispatchEligible: false, dispatchBlockReason: "destination_not_configured" });
  });
});

describe("maskAttributionIds", () => {
  it("never echoes raw values back", () => {
    const masked = maskAttributionIds({
      email: "user@example.com",
      phone: "+15614685571",
      fbclid: "IwAR_secret",
      gclid: "Cj0ABC",
      fbc: "fb.1.123.abc",
      fbp: "fb.1.456.def",
      externalId: "lead-uuid",
    });

    const json = JSON.stringify(masked);
    expect(json).not.toContain("user@example.com");
    expect(json).not.toContain("+15614685571");
    expect(json).not.toContain("IwAR_secret");
    expect(json).not.toContain("Cj0ABC");
    expect(json).not.toContain("lead-uuid");
  });

  it("reports presence and lengths only", () => {
    expect(maskAttributionIds({ email: "a@b.co" })).toEqual({
      emailPresent: true,
      emailLength: 6,
      phonePresent: false,
      phoneLength: 0,
      fbclidPresent: false,
      gclidPresent: false,
      fbcPresent: false,
      fbpPresent: false,
      externalIdPresent: false,
    });
  });

  it("treats null / undefined as absent without throwing", () => {
    const masked = maskAttributionIds({
      email: null,
      phone: undefined,
      fbclid: null,
    });
    expect(masked.emailPresent).toBe(false);
    expect(masked.phonePresent).toBe(false);
    expect(masked.fbclidPresent).toBe(false);
  });
});
