import { describe, expect, it } from "vitest";
import { mapToMeta } from "../mapToMeta";
import { mapToGoogle } from "../mapToGoogle";
import { mapToNextdoor } from "../mapToNextdoor";
import type { WMCanonicalEvent } from "../types";

const NEXTDOOR_ACTION_URL = "https://windowman.example/nextdoor";
const NEXTDOOR_DATA_SOURCE_ID = "5b0b9e9a-156a-11ee-be56-0242ac120002";

function canonicalFixture(overrides: Partial<WMCanonicalEvent> = {}): WMCanonicalEvent {
  return {
    eventId: "wmc_123",
    eventName: "quote_validation_passed",
    eventTimestamp: "2026-04-14T10:00:00.000Z",
    schemaVersion: "1.0.0",
    dispatchStatus: "pending",
    identityQuality: "high",
    shouldSendMeta: true,
    shouldSendGoogle: true,
    payload: {
      identity: {
        leadId: "lead-1",
        emailHash: "a".repeat(64),
        phoneHash: "b".repeat(64),
        gclid: "gclid-123",
      },
      journey: { route: "/vault", flow: "vault" },
      analytics: {
        ocrConfidence: 0.9,
        completeness: 0.9,
        mathConsistency: 0.9,
        cohortFit: 0.9,
        scopeConsistency: 0.9,
        documentValidity: 0.9,
        identityStrength: 0.9,
        anomalyScore: 0.1,
        trustScore: 0.9,
        anomalyStatus: "safe",
        reasons: [],
      },
      optimization: {
        approvedForAds: true,
        approvedForIndex: true,
        manualReviewRequired: false,
        valueUsd: 500,
        priority: 70,
      },
    },
    ...overrides,
  };
}

function nextdoorCanonicalFixture(overrides: Partial<WMCanonicalEvent> = {}): WMCanonicalEvent {
  return canonicalFixture({
    shouldSendNextdoor: true,
    ...overrides,
  });
}

describe("canonical mappers", () => {
  it("keeps event_id/transaction_id consistent", () => {
    const canonical = canonicalFixture();
    const meta = mapToMeta(canonical, "https://windowman.example/vault");
    const google = mapToGoogle(canonical);

    expect(meta.suppressed).toBe(false);
    expect(google.suppressed).toBe(false);
    expect(meta.payload?.event_id).toBe(canonical.eventId);
    expect(google.payload?.transaction_id).toBe(canonical.eventId);
  });

  it("suppresses unsafe quote events", () => {
    const canonical = canonicalFixture({
      payload: {
        ...canonicalFixture().payload,
        analytics: {
          ...canonicalFixture().payload.analytics!,
          anomalyStatus: "review",
          trustScore: 0.5,
        },
      },
    });

    expect(mapToMeta(canonical, "https://windowman.example").suppressed).toBe(true);
    expect(mapToGoogle(canonical).suppressed).toBe(true);
  });

  it("suppresses when identity is too weak", () => {
    const canonical = canonicalFixture({
      identityQuality: "low",
      shouldSendMeta: true,
    });

    expect(mapToMeta(canonical, "https://windowman.example").suppressed).toBe(true);
  });

  it("maps quote_uploaded to correct google conversion action", () => {
    const canonical = canonicalFixture({ eventName: "quote_uploaded" });
    const google = mapToGoogle(canonical);

    expect(google.suppressed).toBe(false);
    expect(google.payload?.conversion_action).toBe("wm_quote_uploaded");
  });

  it("maps quote_upload_completed alias to correct google conversion action", () => {
    const canonical = canonicalFixture({ eventName: "quote_upload_completed" });
    const google = mapToGoogle(canonical);

    expect(google.suppressed).toBe(false);
    expect(google.payload?.conversion_action).toBe("wm_quote_uploaded");
  });

  it("maps quote_uploaded to SubmitApplication meta event", () => {
    const canonical = canonicalFixture({ eventName: "quote_uploaded" });
    const meta = mapToMeta(canonical, "https://windowman.example/vault");

    expect(meta.suppressed).toBe(false);
    expect(meta.payload?.event_name).toBe("SubmitApplication");
  });
});

describe("mapToNextdoor", () => {
  it("suppresses when shouldSendNextdoor is false", () => {
    const result = mapToNextdoor(
      nextdoorCanonicalFixture({ shouldSendNextdoor: false }),
      NEXTDOOR_ACTION_URL,
      NEXTDOOR_DATA_SOURCE_ID,
    );

    expect(result).toEqual({ suppressed: true, reason: "shouldSendNextdoor_false" });
  });

  it("suppresses missing_event_id", () => {
    const result = mapToNextdoor(
      nextdoorCanonicalFixture({ eventId: "" }),
      NEXTDOOR_ACTION_URL,
      NEXTDOOR_DATA_SOURCE_ID,
    );

    expect(result).toEqual({ suppressed: true, reason: "missing_event_id" });
  });

  it("suppresses missing_action_source_url", () => {
    const result = mapToNextdoor(
      nextdoorCanonicalFixture(),
      "",
      NEXTDOOR_DATA_SOURCE_ID,
    );

    expect(result).toEqual({ suppressed: true, reason: "missing_action_source_url" });
  });

  it("suppresses missing_data_source_id", () => {
    const result = mapToNextdoor(
      nextdoorCanonicalFixture(),
      NEXTDOOR_ACTION_URL,
      "",
    );

    expect(result).toEqual({ suppressed: true, reason: "missing_data_source_id" });
  });

  it("suppresses unsupported_nextdoor_event_name for otp_started", () => {
    const result = mapToNextdoor(
      nextdoorCanonicalFixture({ eventName: "otp_started" }),
      NEXTDOOR_ACTION_URL,
      NEXTDOOR_DATA_SOURCE_ID,
    );

    expect(result).toEqual({ suppressed: true, reason: "unsupported_nextdoor_event_name" });
  });

  it("suppresses missing_customer when identity has no usable match fields", () => {
    const result = mapToNextdoor(
      nextdoorCanonicalFixture({
        payload: {
          ...nextdoorCanonicalFixture().payload,
          identity: {},
        },
      }),
      NEXTDOOR_ACTION_URL,
      NEXTDOOR_DATA_SOURCE_ID,
    );

    expect(result).toEqual({ suppressed: true, reason: "missing_customer" });
  });

  it("suppresses identity_too_weak for an optimization event", () => {
    const result = mapToNextdoor(
      nextdoorCanonicalFixture({
        eventName: "phone_verified",
        identityQuality: "low",
      }),
      NEXTDOOR_ACTION_URL,
      NEXTDOOR_DATA_SOURCE_ID,
    );

    expect(result).toEqual({ suppressed: true, reason: "identity_too_weak" });
  });

  it("maps phone_verified to sign_up with delivery_optimization true when identityQuality is medium/high", () => {
    const canonical = nextdoorCanonicalFixture({
      eventName: "phone_verified",
      identityQuality: "high",
    });
    const result = mapToNextdoor(canonical, NEXTDOOR_ACTION_URL, NEXTDOOR_DATA_SOURCE_ID);

    expect(result.suppressed).toBe(false);
    expect(result.payload?.event_name).toBe("sign_up");
    expect(result.payload?.delivery_optimization).toBe(true);
  });

  it("maps virtual_page_view to page_view with delivery_optimization false", () => {
    const canonical = nextdoorCanonicalFixture({
      eventName: "virtual_page_view",
      identityQuality: "high",
    });
    const result = mapToNextdoor(canonical, NEXTDOOR_ACTION_URL, NEXTDOOR_DATA_SOURCE_ID);

    expect(result.suppressed).toBe(false);
    expect(result.payload?.event_name).toBe("page_view");
    expect(result.payload?.delivery_optimization).toBe(false);
  });

  it("suppresses quote_validation_passed on unsafe anomaly status", () => {
    const result = mapToNextdoor(
      nextdoorCanonicalFixture({
        eventName: "quote_validation_passed",
        payload: {
          ...nextdoorCanonicalFixture().payload,
          analytics: {
            ...nextdoorCanonicalFixture().payload.analytics!,
            anomalyStatus: "review",
          },
        },
      }),
      NEXTDOOR_ACTION_URL,
      NEXTDOOR_DATA_SOURCE_ID,
    );

    expect(result).toEqual({ suppressed: true, reason: "anomaly_unsafe" });
  });

  it("suppresses quote_validation_passed below trust threshold", () => {
    const result = mapToNextdoor(
      nextdoorCanonicalFixture({
        eventName: "quote_validation_passed",
        payload: {
          ...nextdoorCanonicalFixture().payload,
          analytics: {
            ...nextdoorCanonicalFixture().payload.analytics!,
            trustScore: 0.5,
          },
        },
      }),
      NEXTDOOR_ACTION_URL,
      NEXTDOOR_DATA_SOURCE_ID,
    );

    expect(result).toEqual({ suppressed: true, reason: "trust_below_threshold" });
  });

  it("produces event_time_epoch as Unix seconds", () => {
    const canonical = nextdoorCanonicalFixture({
      eventTimestamp: "2026-04-14T10:00:00.000Z",
    });
    const result = mapToNextdoor(canonical, NEXTDOOR_ACTION_URL, NEXTDOOR_DATA_SOURCE_ID);

    expect(result.suppressed).toBe(false);
    expect(result.payload?.event_time_epoch).toBe(1776160800);
  });

  it("suppresses malformed_payload when eventTimestamp is unparseable", () => {
    const result = mapToNextdoor(
      nextdoorCanonicalFixture({ eventTimestamp: "not-a-valid-timestamp" }),
      NEXTDOOR_ACTION_URL,
      NEXTDOOR_DATA_SOURCE_ID,
    );

    expect(result).toEqual({ suppressed: true, reason: "malformed_payload" });
  });

  it("maps hashed identity only and never copies raw email or phone", () => {
    const emailHash = "a".repeat(64);
    const phoneHash = "b".repeat(64);
    const rawEmail = "homeowner@example.com";
    const rawPhone = "+15614685571";

    const result = mapToNextdoor(
      nextdoorCanonicalFixture({
        payload: {
          ...nextdoorCanonicalFixture().payload,
          identity: {
            leadId: "lead-1",
            email: rawEmail,
            phone: rawPhone,
            emailHash,
            phoneHash,
          },
        },
      }),
      NEXTDOOR_ACTION_URL,
      NEXTDOOR_DATA_SOURCE_ID,
    );

    expect(result.suppressed).toBe(false);
    expect(result.payload?.customer.email).toBe(emailHash);
    expect(result.payload?.customer.phone_number).toBe(phoneHash);

    const serialized = JSON.stringify(result.payload);
    expect(serialized).not.toContain(rawEmail);
    expect(serialized).not.toContain(rawPhone);
  });
});
