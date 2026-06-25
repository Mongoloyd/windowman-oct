/**
 * Google Ads conversion validation tests (Sprint 4C dry-run scaffold).
 *
 * Run: deno test --allow-env supabase/functions/_shared/googleAdsConversionValidation.test.ts
 */

import {
  assert,
  assertEquals,
  assertFalse,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  buildGoogleDryRunSuccessResponse,
  containsForbiddenResponseContent,
  extractGoogleConversionPayload,
  getGoogleAdsConfigPresence,
  parseGoogleConversionRequestBody,
  rejectLiveGoogleDispatch,
  validateGoogleConversionPayload,
} from "./googleAdsConversionValidation.ts";

const EMAIL_HASH = "a".repeat(64);
const PHONE_HASH = "b".repeat(64);

const basePayload = {
  conversion_action: "wm_phone_verified",
  transaction_id: "wmc_qa_4c_test_123456",
  conversion_date_time: "2026-06-24T12:00:00.000Z",
  conversion_value: 0,
  currency_code: "USD",
};

Deno.test("valid dry-run payload with gclid", () => {
  const payload = extractGoogleConversionPayload({
    ...basePayload,
    gclid: "CjwKCAiAQa4a_FAKE_GCLID",
  });
  assert(payload);

  const result = validateGoogleConversionPayload(payload);
  assert(result.ok);
  if (!result.ok) return;

  assertEquals(result.match_identifier_types, ["gclid"]);
});

Deno.test("valid dry-run payload with hashed email only", () => {
  const payload = extractGoogleConversionPayload({
    ...basePayload,
    user_identifiers: { hashed_email: EMAIL_HASH },
  });
  assert(payload);

  const result = validateGoogleConversionPayload(payload);
  assert(result.ok);
  if (!result.ok) return;

  assertEquals(result.match_identifier_types, ["hashed_email"]);
});

Deno.test("valid dry-run payload with hashed phone only", () => {
  const payload = extractGoogleConversionPayload({
    ...basePayload,
    hashed_phone: PHONE_HASH,
  });
  assert(payload);

  const result = validateGoogleConversionPayload(payload);
  assert(result.ok);
  if (!result.ok) return;

  assertEquals(result.match_identifier_types, ["hashed_phone"]);
});

Deno.test("reject missing match identifiers", () => {
  const payload = extractGoogleConversionPayload({ ...basePayload });
  assert(payload);

  const result = validateGoogleConversionPayload(payload);
  assertFalse(result.ok);
  if (result.ok) return;
  assertEquals(result.error, "missing_match_identifiers");
  assertEquals(result.retryable, false);
});

Deno.test("reject missing transaction/event id", () => {
  const payload = extractGoogleConversionPayload({
    conversion_action: "wm_phone_verified",
    conversion_date_time: "2026-06-24T12:00:00.000Z",
    gclid: "CjwKCAiAQa4a_FAKE_GCLID",
  });
  assert(payload);

  const result = validateGoogleConversionPayload(payload);
  assertFalse(result.ok);
  if (result.ok) return;
  assertEquals(result.error, "missing_transaction_or_event_id");
});

Deno.test("reject dry_run:false", () => {
  const parsed = parseGoogleConversionRequestBody({
    dry_run: false,
    payload: {
      ...basePayload,
      gclid: "CjwKCAiAQa4a_FAKE_GCLID",
    },
  });

  assertEquals(parsed.dryRun, false);
  const rejected = rejectLiveGoogleDispatch();
  assertEquals(rejected.success, false);
  assertEquals(rejected.dry_run, false);
  assertEquals(rejected.retryable, false);
  assertEquals(
    rejected.error,
    "Live Google Ads dispatch is not enabled in 4C",
  );
});

Deno.test("config presence returns booleans only", () => {
  const presence = getGoogleAdsConfigPresence({
    GOOGLE_ADS_CUSTOMER_ID: "1234567890",
    GOOGLE_ADS_REFRESH_TOKEN: undefined,
  });

  assertEquals(typeof presence.has_customer_id, "boolean");
  assertEquals(typeof presence.has_refresh_token, "boolean");
  assertEquals(presence.has_customer_id, true);
  assertEquals(presence.has_refresh_token, false);

  for (const value of Object.values(presence)) {
    assertEquals(typeof value, "boolean");
  }
});

Deno.test("serialized response does not contain raw PII", () => {
  const payload = extractGoogleConversionPayload({
    ...basePayload,
    gclid: "CjwKCAiAQa4a_FAKE_GCLID",
    user_identifiers: {
      hashed_email: EMAIL_HASH,
      hashed_phone_number: PHONE_HASH,
    },
  });
  assert(payload);

  const validation = validateGoogleConversionPayload(payload);
  assert(validation.ok);
  if (!validation.ok) return;

  const response = buildGoogleDryRunSuccessResponse(
    validation,
    getGoogleAdsConfigPresence({}),
  );
  const serialized = JSON.stringify(response);

  assertFalse(serialized.includes("qa@example.com"));
  assertFalse(serialized.includes("+15555550401"));
  assertFalse(serialized.includes("CjwKCAiAQa4a_FAKE_GCLID"));
  assertFalse(serialized.includes(EMAIL_HASH));
  assertFalse(serialized.includes(PHONE_HASH));
});

Deno.test("serialized response does not contain token/secret placeholders", () => {
  const payload = extractGoogleConversionPayload({
    ...basePayload,
    gclid: "CjwKCAiAQa4a_FAKE_GCLID",
  });
  assert(payload);

  const validation = validateGoogleConversionPayload(payload!);
  assert(validation.ok);
  if (!validation.ok) return;

  const response = buildGoogleDryRunSuccessResponse(
    validation,
    getGoogleAdsConfigPresence({
      GOOGLE_ADS_CLIENT_SECRET: "super-secret-value",
      GOOGLE_ADS_REFRESH_TOKEN: "refresh-token-value",
      GOOGLE_ADS_DEVELOPER_TOKEN: "developer-token-value",
    }),
  );
  const serialized = JSON.stringify(response);

  assertFalse(serialized.includes("super-secret-value"));
  assertFalse(serialized.includes("refresh-token-value"));
  assertFalse(serialized.includes("developer-token-value"));
  assertFalse(containsForbiddenResponseContent(serialized));
});

Deno.test("value/currency accepted when present", () => {
  const payload = extractGoogleConversionPayload({
    ...basePayload,
    gclid: "CjwKCAiAQa4a_FAKE_GCLID",
    conversion_value: 500,
    currency_code: "USD",
  });
  assert(payload);

  const validation = validateGoogleConversionPayload(payload);
  assert(validation.ok);
  if (!validation.ok) return;

  assertEquals(validation.normalized.conversion_value, 500);
  assertEquals(validation.normalized.currency_code, "USD");

  const response = buildGoogleDryRunSuccessResponse(
    validation,
    getGoogleAdsConfigPresence({}),
  );
  assertEquals(response.has_value, true);
  assertEquals(response.currency_code, "USD");
});

Deno.test("parseGoogleConversionRequestBody requires dry_run wrapper", () => {
  const missingDryRun = parseGoogleConversionRequestBody({
    payload: { ...basePayload, gclid: "abc" },
  });
  assertEquals(missingDryRun.error, "missing_dry_run_flag");

  const valid = parseGoogleConversionRequestBody({
    dry_run: true,
    payload: { ...basePayload, gclid: "abc" },
  });
  assertEquals(valid.dryRun, true);
  assert(valid.payload);
});
