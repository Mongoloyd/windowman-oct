import { describe, expect, it } from "vitest";
import { buildTikTokPayload } from "../buildTikTokPayload";
import type { WMCanonicalEvent } from "../types";

const EMAIL_HASH =
  "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e808837b87a";
const PHONE_HASH =
  "5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf1a9c041a87";

function baseCanonical(
  overrides: Partial<WMCanonicalEvent> = {},
): WMCanonicalEvent {
  return {
    eventId: "wmc_quote_uploaded_lead-lead123_scan-scan456",
    eventName: "quote_uploaded",
    eventTimestamp: "2026-04-14T10:00:00.000Z",
    schemaVersion: "1.0.0",
    dispatchStatus: "pending",
    identityQuality: "medium",
    shouldSendMeta: false,
    shouldSendGoogle: false,
    shouldSendNextdoor: false,
    payload: {
      identity: {
        leadId: "lead-123",
        emailHash: EMAIL_HASH,
        phoneHash: PHONE_HASH,
      },
      journey: { route: "/vault/upload", flow: "vault" },
    },
    ...overrides,
  };
}

function buildInput(
  canonical: WMCanonicalEvent,
  extras: {
    attribution?: Record<string, unknown>;
    queryParams?: Record<string, unknown>;
    eventSourceId?: string;
  } = {},
) {
  return {
    canonical,
    attribution: extras.attribution,
    queryParams: extras.queryParams,
    eventSourceId: extras.eventSourceId ?? "pixel-123",
    eventSourceUrl: "https://windowman.app/verify",
  };
}

const LADDER_CASES = [
  ["truth_gate_captured", "SubmitForm"],
  ["lead_captured", "SubmitForm"],
  ["quote_uploaded", "UploadQuote"],
  ["report_revealed", "UnlockReport"],
  ["report_unlocked", "UnlockReport"],
  ["contractor_match_requested", "Contact"],
  ["contractor_intro_requested", "Contact"],
  ["appointment_booked", "Schedule"],
  ["appointment_scheduled", "Schedule"],
  ["sold", "CompletePayment"],
  ["won", "CompletePayment"],
] as const;

function canonicalForSourceEvent(sourceEvent: string): WMCanonicalEvent {
  const isRevenue = sourceEvent === "sold" || sourceEvent === "won";
  return baseCanonical({
    eventName: sourceEvent as WMCanonicalEvent["eventName"],
    ...(isRevenue
      ? {
        payload: {
          identity: { leadId: "lead-123", emailHash: EMAIL_HASH },
          journey: { route: "/", flow: "public" },
          optimization: {
            valueUsd: 5000,
            approvedForAds: true,
            approvedForIndex: true,
            manualReviewRequired: false,
          },
        },
      }
      : {}),
  });
}

describe("buildTikTokPayload", () => {
  it.each(LADDER_CASES)("maps %s to %s", (sourceEvent, tiktokEvent) => {
    const result = buildTikTokPayload(
      buildInput(canonicalForSourceEvent(sourceEvent)),
    );
    expect(result.suppressed).toBe(false);
    if (!result.suppressed) {
      expect(result.eventName).toBe(tiktokEvent);
      expect(result.payload.data[0]?.event).toBe(tiktokEvent);
    }
  });

  it("suppresses unknown_event with no_tiktok_mapping", () => {
    const result = buildTikTokPayload(
      buildInput(
        baseCanonical({
          eventName: "unknown_event" as WMCanonicalEvent["eventName"],
        }),
      ),
    );
    expect(result).toEqual({
      suppressed: true,
      reason: "no_tiktok_mapping",
      eventName: null,
      payload: null,
    });
  });

  it("suppresses missing event_source_id", () => {
    const result = buildTikTokPayload(
      buildInput(baseCanonical(), { eventSourceId: "" }),
    );
    expect(result.suppressed).toBe(true);
    if (result.suppressed) {
      expect(result.reason).toBe("missing_event_source_id");
    }
  });

  it("suppresses missing event_id", () => {
    const result = buildTikTokPayload(
      buildInput(baseCanonical({ eventId: "   " })),
    );
    expect(result.suppressed).toBe(true);
    if (result.suppressed) {
      expect(result.reason).toBe("missing_event_id");
    }
  });

  it("suppresses sold without value", () => {
    const result = buildTikTokPayload(
      buildInput(
        baseCanonical({
          eventName: "sold",
          payload: {
            identity: { leadId: "lead-123" },
            journey: { route: "/", flow: "public" },
          },
        }),
      ),
    );
    expect(result.suppressed).toBe(true);
    if (result.suppressed) {
      expect(result.reason).toBe("missing_revenue_value");
      expect(result.eventName).toBe("CompletePayment");
    }
  });

  it("includes value and currency for sold with optimization value", () => {
    const result = buildTikTokPayload(
      buildInput(
        baseCanonical({
          eventName: "sold",
          payload: {
            identity: { leadId: "lead-123", emailHash: EMAIL_HASH },
            journey: { route: "/", flow: "public" },
            optimization: {
              valueUsd: 7500,
              approvedForAds: true,
              approvedForIndex: true,
              manualReviewRequired: false,
            },
          },
        }),
      ),
    );
    expect(result.suppressed).toBe(false);
    if (!result.suppressed) {
      expect(result.eventName).toBe("CompletePayment");
      expect(result.payload.data[0]?.properties.value).toBe(7500);
      expect(result.payload.data[0]?.properties.currency).toBe("USD");
    }
  });

  it("uses canonical.eventId as TikTok event_id", () => {
    const eventId = "wmc_report_revealed_lead-abc_scan-def";
    const result = buildTikTokPayload(
      buildInput(baseCanonical({ eventId, eventName: "report_revealed" })),
    );
    expect(result.suppressed).toBe(false);
    if (!result.suppressed) {
      expect(result.payload.data[0]?.event_id).toBe(eventId);
    }
  });

  it("pulls ttclid from attribution", () => {
    const result = buildTikTokPayload(
      buildInput(baseCanonical(), {
        attribution: { ttclid: "tt-attribution" },
      }),
    );
    expect(result.suppressed).toBe(false);
    if (!result.suppressed) {
      expect(result.payload.data[0]?.user.ttclid).toBe("tt-attribution");
    }
  });

  it("falls back to queryParams for ttclid", () => {
    const result = buildTikTokPayload(
      buildInput(baseCanonical(), {
        queryParams: { ttclid: "tt-query" },
      }),
    );
    expect(result.suppressed).toBe(false);
    if (!result.suppressed) {
      expect(result.payload.data[0]?.user.ttclid).toBe("tt-query");
    }
  });

  it("pulls ttp from attribution", () => {
    const result = buildTikTokPayload(
      buildInput(baseCanonical(), {
        attribution: { ttp: "ttp-value" },
      }),
    );
    expect(result.suppressed).toBe(false);
    if (!result.suppressed) {
      expect(result.payload.data[0]?.user.ttp).toBe("ttp-value");
    }
  });

  it("never includes raw email or phone in serialized payload", () => {
    const result = buildTikTokPayload(
      buildInput(
        baseCanonical({
          payload: {
            identity: {
              leadId: "lead-123",
              email: "user@example.com",
              phone: "+15614685571",
              emailHash: EMAIL_HASH,
              phoneHash: PHONE_HASH,
            },
            journey: { route: "/", flow: "public" },
          },
        }),
      ),
    );
    expect(result.suppressed).toBe(false);
    if (!result.suppressed) {
      const serialized = JSON.stringify(result.payload);
      expect(serialized).not.toContain("user@example.com");
      expect(serialized).not.toContain("5614685571");
      expect(result.payload.data[0]?.user.email).toBe(EMAIL_HASH);
      expect(result.payload.data[0]?.user.phone).toBe(PHONE_HASH);
    }
  });

  it("excludes forbidden metadata fields from output", () => {
    const result = buildTikTokPayload(buildInput(baseCanonical()));
    expect(result.suppressed).toBe(false);
    if (!result.suppressed) {
      const serialized = JSON.stringify(result.payload);
      expect(serialized).not.toMatch(/full_json|ocr_text|signed_url|storage_path/);
    }
  });
});
