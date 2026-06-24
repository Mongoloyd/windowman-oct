import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildTikTokPayload } from "./buildTikTokPayload.ts";
import type { WMCanonicalEvent } from "./types.ts";

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
  ["quote_uploaded", "UploadQuote"],
  ["report_revealed", "UnlockReport"],
  ["contractor_match_requested", "Contact"],
  ["appointment_booked", "Schedule"],
  ["sold", "CompletePayment"],
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

Deno.test("buildTikTokPayload maps ladder events to TikTok event names", () => {
  for (const [sourceEvent, tiktokEvent] of LADDER_CASES) {
    const result = buildTikTokPayload(
      buildInput(canonicalForSourceEvent(sourceEvent)),
    );
    assertEquals(result.suppressed, false);
    if (!result.suppressed) {
      assertEquals(result.eventName, tiktokEvent);
      assertEquals(result.payload.data[0]?.event, tiktokEvent);
    }
  }
});

Deno.test("buildTikTokPayload suppresses unknown events", () => {
  const result = buildTikTokPayload(
    buildInput(
      baseCanonical({
        eventName: "unknown_event" as WMCanonicalEvent["eventName"],
      }),
    ),
  );
  assertEquals(result.suppressed, true);
  if (result.suppressed) {
    assertEquals(result.reason, "no_tiktok_mapping");
  }
});

Deno.test("buildTikTokPayload suppresses missing event_source_id", () => {
  const result = buildTikTokPayload(
    buildInput(baseCanonical(), { eventSourceId: "  " }),
  );
  assertEquals(result.suppressed, true);
  if (result.suppressed) {
    assertEquals(result.reason, "missing_event_source_id");
  }
});

Deno.test("buildTikTokPayload suppresses missing event_id", () => {
  const result = buildTikTokPayload(
    buildInput(baseCanonical({ eventId: "" })),
  );
  assertEquals(result.suppressed, true);
  if (result.suppressed) {
    assertEquals(result.reason, "missing_event_id");
  }
});

Deno.test("buildTikTokPayload suppresses revenue events without value", () => {
  const result = buildTikTokPayload(
    buildInput(
      baseCanonical({
        eventName: "sold",
        payload: {
          identity: { leadId: "lead-123" },
          journey: { route: "/", flow: "public" },
          optimization: { valueUsd: 0, approvedForAds: true, approvedForIndex: true, manualReviewRequired: false },
        },
      }),
    ),
  );
  assertEquals(result.suppressed, true);
  if (result.suppressed) {
    assertEquals(result.reason, "missing_revenue_value");
    assertEquals(result.eventName, "CompletePayment");
  }
});

Deno.test("buildTikTokPayload includes value and currency for sold events", () => {
  const result = buildTikTokPayload(
    buildInput(
      baseCanonical({
        eventName: "sold",
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
      }),
    ),
  );
  assertEquals(result.suppressed, false);
  if (!result.suppressed) {
    assertEquals(result.eventName, "CompletePayment");
    assertEquals(result.payload.data[0]?.properties.value, 5000);
    assertEquals(result.payload.data[0]?.properties.currency, "USD");
  }
});

Deno.test("buildTikTokPayload uses canonical event_id for dedupe", () => {
  const eventId = "wmc_sold_lead-abc_2026-04-14T10:00:00.000Z";
  const result = buildTikTokPayload(
    buildInput(baseCanonical({ eventId, eventName: "lead_captured" })),
  );
  assertEquals(result.suppressed, false);
  if (!result.suppressed) {
    assertEquals(result.payload.data[0]?.event_id, eventId);
  }
});

Deno.test("buildTikTokPayload pulls ttclid from attribution", () => {
  const result = buildTikTokPayload(
    buildInput(baseCanonical(), {
      attribution: { ttclid: "ttclid-from-attribution" },
    }),
  );
  assertEquals(result.suppressed, false);
  if (!result.suppressed) {
    assertEquals(result.payload.data[0]?.user.ttclid, "ttclid-from-attribution");
  }
});

Deno.test("buildTikTokPayload falls back to queryParams for ttclid", () => {
  const result = buildTikTokPayload(
    buildInput(baseCanonical(), {
      queryParams: { ttclid: "ttclid-from-query" },
    }),
  );
  assertEquals(result.suppressed, false);
  if (!result.suppressed) {
    assertEquals(result.payload.data[0]?.user.ttclid, "ttclid-from-query");
  }
});

Deno.test("buildTikTokPayload pulls ttp from attribution including _ttp alias", () => {
  const fromTtp = buildTikTokPayload(
    buildInput(baseCanonical(), { attribution: { ttp: "ttp-cookie" } }),
  );
  assertEquals(fromTtp.suppressed, false);
  if (!fromTtp.suppressed) {
    assertEquals(fromTtp.payload.data[0]?.user.ttp, "ttp-cookie");
  }

  const fromUnderscore = buildTikTokPayload(
    buildInput(baseCanonical(), { attribution: { _ttp: "ttp-underscore" } }),
  );
  assertEquals(fromUnderscore.suppressed, false);
  if (!fromUnderscore.suppressed) {
    assertEquals(fromUnderscore.payload.data[0]?.user.ttp, "ttp-underscore");
  }
});

Deno.test("buildTikTokPayload never serializes raw email or phone", () => {
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
  assertEquals(result.suppressed, false);
  if (!result.suppressed) {
    const serialized = JSON.stringify(result.payload);
    assert(!serialized.includes("user@example.com"));
    assert(!serialized.includes("5614685571"));
    assertEquals(result.payload.data[0]?.user.email, EMAIL_HASH);
    assertEquals(result.payload.data[0]?.user.phone, PHONE_HASH);
  }
});

Deno.test("buildTikTokPayload output contains no forbidden metadata keys", () => {
  const result = buildTikTokPayload(buildInput(baseCanonical()));
  assertEquals(result.suppressed, false);
  if (!result.suppressed) {
    const serialized = JSON.stringify(result.payload);
    assert(!serialized.includes("full_json"));
    assert(!serialized.includes("ocr_text"));
    assert(!serialized.includes("signed_url"));
    assert(!serialized.includes("storage_path"));
  }
});

Deno.test("buildTikTokPayload output contains no live dispatch primitives", () => {
  const result = buildTikTokPayload(buildInput(baseCanonical()));
  assertEquals(result.suppressed, false);
  if (!result.suppressed) {
    const serialized = JSON.stringify(result.payload);
    assert(!serialized.includes("business-api.tiktok.com"));
    assert(!serialized.includes("ttq("));
    assert(!serialized.includes("ACCESS_TOKEN"));
  }
});
