import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  mapToTikTok,
  TIKTOK_LADDER_SOURCE_EVENTS,
  type TikTokMappedEvent,
  type WindowManTikTokSourceEvent,
} from "./mapToTikTok.ts";

const LADDER: Array<
  [WindowManTikTokSourceEvent, string, "standard" | "custom"]
> = [
  ["truth_gate_captured", "SubmitForm", "standard"],
  ["lead_captured", "SubmitForm", "standard"],
  ["quote_uploaded", "UploadQuote", "custom"],
  ["report_revealed", "UnlockReport", "custom"],
  ["report_unlocked", "UnlockReport", "custom"],
  ["contractor_match_requested", "Contact", "standard"],
  ["contractor_intro_requested", "Contact", "standard"],
  ["appointment_booked", "Schedule", "standard"],
  ["appointment_scheduled", "Schedule", "standard"],
  ["sold", "CompletePayment", "standard"],
  ["won", "CompletePayment", "standard"],
];

Deno.test("mapToTikTok maps the full CRM/canonical ladder", () => {
  for (const [source, expectedName, expectedKind] of LADDER) {
    const result = mapToTikTok(source);
    assert(result !== null, `expected mapping for ${source}`);
    assertEquals(result.sourceEvent, source);
    assertEquals(result.tiktokEventName, expectedName);
    assertEquals(result.kind, expectedKind);
  }
});

Deno.test("mapToTikTok returns null for unknown events (never throws)", () => {
  assertEquals(mapToTikTok("unknown_event"), null);
  assertEquals(mapToTikTok(""), null);
  assertEquals(mapToTikTok("phone_verified"), null);
  assertEquals(mapToTikTok("SubmitForm"), null);
});

Deno.test("mapToTikTok standard vs custom classification", () => {
  const standard = ["truth_gate_captured", "contractor_match_requested", "appointment_booked", "sold"];
  const custom = ["quote_uploaded", "report_revealed", "report_unlocked"];

  for (const e of standard) assertEquals(mapToTikTok(e)?.kind, "standard");
  for (const e of custom) assertEquals(mapToTikTok(e)?.kind, "custom");
});

Deno.test("mapToTikTok optimization tiers are assigned per funnel stage", () => {
  assertEquals(mapToTikTok("truth_gate_captured")?.recommendedOptimizationTier, "lead");
  assertEquals(mapToTikTok("quote_uploaded")?.recommendedOptimizationTier, "high_intent");
  assertEquals(mapToTikTok("report_revealed")?.recommendedOptimizationTier, "verified_demand");
  assertEquals(mapToTikTok("contractor_match_requested")?.recommendedOptimizationTier, "sales_ready");
  assertEquals(mapToTikTok("appointment_booked")?.recommendedOptimizationTier, "scheduled");
  assertEquals(mapToTikTok("sold")?.recommendedOptimizationTier, "revenue");
});

Deno.test("mapToTikTok always requires server confirmation", () => {
  for (const source of TIKTOK_LADDER_SOURCE_EVENTS) {
    assertEquals(mapToTikTok(source)?.requiresServerConfirmation, true);
  }
});

Deno.test("mapToTikTok aliases resolve to the same TikTok event", () => {
  assertEquals(
    mapToTikTok("lead_captured")?.tiktokEventName,
    mapToTikTok("truth_gate_captured")?.tiktokEventName,
  );
  assertEquals(
    mapToTikTok("report_unlocked")?.tiktokEventName,
    mapToTikTok("report_revealed")?.tiktokEventName,
  );
  assertEquals(
    mapToTikTok("contractor_intro_requested")?.tiktokEventName,
    mapToTikTok("contractor_match_requested")?.tiktokEventName,
  );
  assertEquals(
    mapToTikTok("appointment_scheduled")?.tiktokEventName,
    mapToTikTok("appointment_booked")?.tiktokEventName,
  );
  assertEquals(
    mapToTikTok("won")?.tiktokEventName,
    mapToTikTok("sold")?.tiktokEventName,
  );
});

Deno.test("mapToTikTok output contains no live endpoints or dispatch primitives", () => {
  const forbidden = [
    "business-api.tiktok.com",
    "open-api.tiktok.com",
    "http://",
    "https://",
    "fetch",
    "ttq(",
    "capi-event",
    "dataLayer",
  ];

  for (const source of TIKTOK_LADDER_SOURCE_EVENTS) {
    const result = mapToTikTok(source) as TikTokMappedEvent;
    const serialized = JSON.stringify(result);
    for (const token of forbidden) {
      assert(
        !serialized.includes(token),
        `mapped output for ${source} unexpectedly contained "${token}"`,
      );
    }
  }
});

Deno.test("mapToTikTok returns a fresh object (pure, no shared mutation)", () => {
  const a = mapToTikTok("sold") as TikTokMappedEvent;
  const b = mapToTikTok("sold") as TikTokMappedEvent;
  assert(a !== b, "expected distinct object instances");
  assertEquals(a, b);
});
