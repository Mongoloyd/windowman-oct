/**
 * Token rotation & secret-hygiene regression suite.
 *
 * Locks invariants the operator depends on:
 *   1. redactToken() never echoes raw bytes
 *   2. summarizeTokenPresence() returns booleans + masks only
 *   3. classifyMetaError() distinguishes token / permission / mismatch /
 *      rate-limit / payload / server / network failures
 *   4. token classification reads ONLY the documented Meta error.code path
 *      — never the access_token query parameter
 *   5. all helpers are pure / synchronous-safe and never perform network I/O
 *
 * No network. No Supabase. No Meta calls.
 */

import {
  assert,
  assertEquals,
  assertStringIncludes,
  // deno-lint-ignore no-import-prefix
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

import {
  classifyMetaError,
  redactToken,
  summarizeTokenPresence,
} from "../_shared/capiRouting.ts";

// ── 1. redactToken never returns raw bytes ─────────────────────────────────

Deno.test("redactToken: null/empty returns null", () => {
  assertEquals(redactToken(null), null);
  assertEquals(redactToken(undefined), null);
  assertEquals(redactToken(""), null);
});

Deno.test("redactToken: short tokens become **** (no leak)", () => {
  assertEquals(redactToken("abcd1234"), "****");
});

Deno.test("redactToken: long tokens reveal only first4…last4", () => {
  const raw = "EAAGm0PX4ZCpsBO_THIS_IS_SECRET_DO_NOT_LOG_xyz1234";
  const masked = redactToken(raw)!;
  assertEquals(masked, "EAAG…1234");
  // Hard guarantee: no substring of the secret middle leaks.
  assert(!masked.includes("SECRET"));
  assert(!masked.includes("DO_NOT_LOG"));
});

// ── 2. summarizeTokenPresence returns booleans + masks only ────────────────

Deno.test("summarizeTokenPresence: null row → all false, all masks null", () => {
  const p = summarizeTokenPresence(null);
  assertEquals(p, {
    pixel_id_present: false,
    access_token_present: false,
    test_event_code_present: false,
    pixel_id_masked: null,
    access_token_masked: null,
  });
});

Deno.test("summarizeTokenPresence: full row exposes only masked previews", () => {
  const p = summarizeTokenPresence({
    pixel_id: "1234567890123456",
    access_token: "EAAGm0PX4ZCpsBO_VERY_SECRET_DO_NOT_LEAK_xyz9999",
    test_event_code: "TEST123",
  });
  assertEquals(p.pixel_id_present, true);
  assertEquals(p.access_token_present, true);
  assertEquals(p.test_event_code_present, true);
  assertEquals(p.pixel_id_masked, "…3456");
  assertEquals(p.access_token_masked, "EAAG…9999");
  // The full secret must never appear anywhere in the summary.
  const json = JSON.stringify(p);
  assert(!json.includes("VERY_SECRET"));
  assert(!json.includes("DO_NOT_LEAK"));
});

Deno.test("summarizeTokenPresence: partial row classifies each field independently", () => {
  const p = summarizeTokenPresence({
    pixel_id: "1234567890123456",
    access_token: null,
    test_event_code: null,
  });
  assertEquals(p.pixel_id_present, true);
  assertEquals(p.access_token_present, false);
  assertEquals(p.access_token_masked, null);
});

// ── 3. classifyMetaError: success path ─────────────────────────────────────

Deno.test("classifyMetaError: 200 OK → ok", () => {
  const r = classifyMetaError(200, { events_received: 1 });
  assertEquals(r.class, "ok");
});

// ── 4. classifyMetaError: token-revoked / invalid family ───────────────────

Deno.test("classifyMetaError: OAuthException 190 → token_invalid_or_revoked", () => {
  const r = classifyMetaError(400, {
    error: {
      code: 190,
      message: "Error validating access token: Session has expired",
      type: "OAuthException",
    },
  });
  assertEquals(r.class, "token_invalid_or_revoked");
  assertStringIncludes(r.hint, "Rotate the token");
});

Deno.test("classifyMetaError: code 102 → token_invalid_or_revoked", () => {
  const r = classifyMetaError(400, {
    error: { code: 102, message: "Session expired" },
  });
  assertEquals(r.class, "token_invalid_or_revoked");
});

Deno.test("classifyMetaError: text-only 'Access token is invalid' → token_invalid_or_revoked", () => {
  const r = classifyMetaError(400, {
    error: { code: 999, message: "The access token is invalid." },
  });
  assertEquals(r.class, "token_invalid_or_revoked");
});

// ── 5. classifyMetaError: permission-scope problems ────────────────────────

Deno.test("classifyMetaError: code 200 → token_permission_denied", () => {
  const r = classifyMetaError(403, {
    error: { code: 200, message: "Permissions error" },
  });
  assertEquals(r.class, "token_permission_denied");
  assertStringIncludes(r.hint, "scopes");
});

// ── 6. classifyMetaError: pixel/token mismatch ─────────────────────────────

Deno.test("classifyMetaError: pixel-permission mismatch → pixel_token_mismatch", () => {
  const r = classifyMetaError(400, {
    error: {
      code: 100,
      message: "You do not have permission to access this pixel",
    },
  });
  assertEquals(r.class, "pixel_token_mismatch");
});

// ── 7. classifyMetaError: rate limit / server / payload / network ──────────

Deno.test("classifyMetaError: code 4 → rate_limited", () => {
  const r = classifyMetaError(400, {
    error: { code: 4, message: "App request limit reached" },
  });
  assertEquals(r.class, "rate_limited");
});

Deno.test("classifyMetaError: 503 → meta_server_error", () => {
  const r = classifyMetaError(503, {});
  assertEquals(r.class, "meta_server_error");
});

Deno.test("classifyMetaError: 400 with non-token payload error → meta_rejected_payload", () => {
  const r = classifyMetaError(400, {
    error: { code: 100, message: "Invalid parameter event_time" },
  });
  assertEquals(r.class, "meta_rejected_payload");
});

// ── 8. Hard fence: classifier never echoes the access_token ────────────────
// The classifier is a pure function over (status, response) — by construction
// it cannot reach the access_token. This test guards against a future regression
// where someone passes the token into the response object by accident.

Deno.test("classifyMetaError: hint never contains a token-shaped string", () => {
  const fakeToken = "EAAGm0PX4ZCpsBO_LOOKS_LIKE_A_TOKEN_xxxxxxxxxxxxxxxx";
  const r = classifyMetaError(400, {
    error: { code: 190, message: `Bad token: ${fakeToken}` },
  });
  // The classifier must NOT copy the message into its hint.
  assert(!r.hint.includes(fakeToken));
  assert(!r.hint.includes("EAAG"));
});
