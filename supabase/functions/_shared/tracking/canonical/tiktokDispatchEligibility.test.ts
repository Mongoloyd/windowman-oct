import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  evaluateTikTokDispatchEligibility,
  isDenoTikTokCapiEnabled,
  isTikTokCapiEnabled,
} from "./tiktokDispatchEligibility.ts";

Deno.test("evaluateTikTokDispatchEligibility disables when env missing", () => {
  assertEquals(
    evaluateTikTokDispatchEligibility({ eventName: "quote_uploaded" }),
    {
      shouldEnqueue: false,
      reason: "tiktok_disabled",
      mappedEventName: null,
    },
  );
});

Deno.test("evaluateTikTokDispatchEligibility disables when env is false", () => {
  assertEquals(
    evaluateTikTokDispatchEligibility({
      eventName: "quote_uploaded",
      env: { TIKTOK_CAPI_ENABLED: "false" },
    }),
    {
      shouldEnqueue: false,
      reason: "tiktok_disabled",
      mappedEventName: null,
    },
  );
});

Deno.test("evaluateTikTokDispatchEligibility disables when env is 0", () => {
  assertEquals(
    evaluateTikTokDispatchEligibility({
      eventName: "quote_uploaded",
      env: { TIKTOK_CAPI_ENABLED: "0" },
    }),
    {
      shouldEnqueue: false,
      reason: "tiktok_disabled",
      mappedEventName: null,
    },
  );
});

Deno.test("evaluateTikTokDispatchEligibility enqueues mapped events when enabled", () => {
  assertEquals(
    evaluateTikTokDispatchEligibility({
      eventName: "truth_gate_captured",
      env: { TIKTOK_CAPI_ENABLED: "true" },
    }),
    {
      shouldEnqueue: true,
      platformName: "tiktok",
      mappedEventName: "SubmitForm",
    },
  );

  assertEquals(
    evaluateTikTokDispatchEligibility({
      eventName: "quote_uploaded",
      env: { TIKTOK_CAPI_ENABLED: "true" },
    }),
    {
      shouldEnqueue: true,
      platformName: "tiktok",
      mappedEventName: "UploadQuote",
    },
  );

  assertEquals(
    evaluateTikTokDispatchEligibility({
      eventName: "sold",
      env: { TIKTOK_CAPI_ENABLED: "true" },
    }),
    {
      shouldEnqueue: true,
      platformName: "tiktok",
      mappedEventName: "CompletePayment",
    },
  );
});

Deno.test("evaluateTikTokDispatchEligibility returns no_tiktok_mapping for unknown events", () => {
  assertEquals(
    evaluateTikTokDispatchEligibility({
      eventName: "unknown_event",
      env: { TIKTOK_CAPI_ENABLED: "true" },
    }),
    {
      shouldEnqueue: false,
      reason: "no_tiktok_mapping",
      mappedEventName: null,
    },
  );
});

Deno.test("evaluateTikTokDispatchEligibility returns missing_event_name for blank input", () => {
  assertEquals(
    evaluateTikTokDispatchEligibility({
      eventName: "   ",
      env: { TIKTOK_CAPI_ENABLED: "true" },
    }),
    {
      shouldEnqueue: false,
      reason: "missing_event_name",
      mappedEventName: null,
    },
  );
});

Deno.test("evaluateTikTokDispatchEligibility does not produce payload", () => {
  const result = evaluateTikTokDispatchEligibility({
    eventName: "quote_uploaded",
    env: { TIKTOK_CAPI_ENABLED: "true" },
  });

  assert(!("payload" in result));
});

Deno.test("isTikTokCapiEnabled requires exact true", () => {
  assertEquals(isTikTokCapiEnabled(undefined), false);
  assertEquals(isTikTokCapiEnabled("false"), false);
  assertEquals(isTikTokCapiEnabled("true"), true);
  assertEquals(isDenoTikTokCapiEnabled(undefined), false);
  assertEquals(isDenoTikTokCapiEnabled("false"), false);
  assertEquals(isDenoTikTokCapiEnabled("true"), true);
});
