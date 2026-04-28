/**
 * capi-event regression tests
 *
 * These tests lock the server-side Meta match-quality behavior so the recent
 * "double-hash" defect cannot silently regress. They cover:
 *
 *   1. Pre-hashed em / ph / external_id MUST pass through unchanged
 *   2. Raw em / ph MUST be normalized + SHA-256 hashed
 *   3. fbc / fbp MUST pass through unchanged
 *   4. client_ip_address MUST resolve from CDN/proxy headers in correct order
 *   5. client_user_agent MUST fall back to the request's user-agent header
 *      when the payload does not provide one, and MUST NOT overwrite a
 *      payload-provided value
 *
 * No network. No Supabase. No Meta calls. Pure functions only.
 */

import {
  assert,
  assertEquals,
  assertNotEquals,
  // deno-lint-ignore no-import-prefix
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

import {
  buildHashedUserData,
  type CAPIEvent,
  extractClientIp,
  hashPhone,
  isSha256Hex,
  sha256,
} from "./index.ts";

// ── Helpers ─────────────────────────────────────────────────────────────────

const SAMPLE_EMAIL = "Homeowner@Example.COM";
const SAMPLE_PHONE_RAW = "(561) 468-5571";
const SAMPLE_PHONE_DIGITS = "5614685571";

async function knownHash(value: string) {
  // Mirror the production normalization (trim + lowercase) used by sha256().
  return await sha256(value);
}

// ── 1. isSha256Hex ──────────────────────────────────────────────────────────

Deno.test("isSha256Hex: detects valid 64-char lowercase hex", () => {
  const v = "a".repeat(64);
  assertEquals(isSha256Hex(v), true);
});

Deno.test("isSha256Hex: detects valid 64-char uppercase hex", () => {
  const v = "F".repeat(64);
  assertEquals(isSha256Hex(v), true);
});

Deno.test("isSha256Hex: rejects 63-char string", () => {
  assertEquals(isSha256Hex("a".repeat(63)), false);
});

Deno.test("isSha256Hex: rejects 65-char string", () => {
  assertEquals(isSha256Hex("a".repeat(65)), false);
});

Deno.test("isSha256Hex: rejects non-hex characters", () => {
  assertEquals(isSha256Hex("z".repeat(64)), false);
});

Deno.test("isSha256Hex: rejects raw email", () => {
  assertEquals(isSha256Hex(SAMPLE_EMAIL), false);
});

Deno.test("isSha256Hex: rejects raw phone", () => {
  assertEquals(isSha256Hex(SAMPLE_PHONE_RAW), false);
});

// ── 2. Pre-hashed values MUST NOT be re-hashed (the actual defect) ─────────

Deno.test("buildHashedUserData: pre-hashed em is NOT double-hashed", async () => {
  const preHashed = await knownHash(SAMPLE_EMAIL);

  const out = await buildHashedUserData(
    { em: preHashed } as CAPIEvent["user_data"],
    { clientIp: "1.2.3.4", userAgent: null },
  );

  // em is wrapped in a single-element array (Meta CAPI spec)
  assertEquals(out.em, [preHashed]);

  // Sanity: hashing again would NOT equal the original hash
  const wouldBeDoubleHashed = await sha256(preHashed);
  assertNotEquals(out.em, [wouldBeDoubleHashed]);
});

Deno.test("buildHashedUserData: pre-hashed ph is NOT double-hashed", async () => {
  const preHashed = await knownHash(SAMPLE_PHONE_DIGITS);

  const out = await buildHashedUserData(
    { ph: preHashed } as CAPIEvent["user_data"],
    { clientIp: "1.2.3.4", userAgent: null },
  );

  assertEquals(out.ph, [preHashed]);

  const wouldBeDoubleHashed = await sha256(preHashed);
  assertNotEquals(out.ph, [wouldBeDoubleHashed]);
});

Deno.test("buildHashedUserData: pre-hashed external_id is NOT double-hashed", async () => {
  const preHashed = await knownHash("lead-uuid-12345");

  const out = await buildHashedUserData(
    { external_id: preHashed } as CAPIEvent["user_data"],
    { clientIp: "1.2.3.4", userAgent: null },
  );

  // external_id is NOT wrapped in an array
  assertEquals(out.external_id, preHashed);

  const wouldBeDoubleHashed = await sha256(preHashed);
  assertNotEquals(out.external_id, wouldBeDoubleHashed);
});

Deno.test("buildHashedUserData: pre-hashed values mixed-case are lowercased, not re-hashed", async () => {
  // Meta requires lowercase hex. Mixed-case pre-hashed values must be
  // lowercased and forwarded as-is (not re-hashed).
  const preHashedUpper = (await knownHash(SAMPLE_EMAIL)).toUpperCase();

  const out = await buildHashedUserData(
    { em: preHashedUpper } as CAPIEvent["user_data"],
    { clientIp: "1.2.3.4", userAgent: null },
  );

  assertEquals(out.em, [preHashedUpper.toLowerCase()]);
});

// ── 3. Raw values MUST be normalized + hashed ──────────────────────────────

Deno.test("buildHashedUserData: raw em is lowercased + trimmed + SHA-256 hashed", async () => {
  const out = await buildHashedUserData(
    { em: SAMPLE_EMAIL } as CAPIEvent["user_data"],
    { clientIp: "1.2.3.4", userAgent: null },
  );

  const expected = await sha256(SAMPLE_EMAIL); // sha256() lowercases + trims
  assertEquals(out.em, [expected]);
  // And it must NOT match the literal raw value
  assertNotEquals(out.em, [SAMPLE_EMAIL]);
});

Deno.test("buildHashedUserData: raw ph is digit-normalized + SHA-256 hashed", async () => {
  const out = await buildHashedUserData(
    { ph: SAMPLE_PHONE_RAW } as CAPIEvent["user_data"],
    { clientIp: "1.2.3.4", userAgent: null },
  );

  // hashPhone strips non-digits then hashes
  const expected = await hashPhone(SAMPLE_PHONE_RAW);
  // Same as hashing just the digits
  const expectedFromDigits = await sha256(SAMPLE_PHONE_DIGITS);
  assertEquals(expected, expectedFromDigits);
  assertEquals(out.ph, [expected]);
});

Deno.test("buildHashedUserData: raw em with surrounding whitespace is normalized", async () => {
  const out = await buildHashedUserData(
    { em: "  Foo@BAR.com  " } as CAPIEvent["user_data"],
    { clientIp: "1.2.3.4", userAgent: null },
  );

  const expected = await sha256("foo@bar.com");
  assertEquals(out.em, [expected]);
});

// ── 4. fbc / fbp pass through unchanged ────────────────────────────────────

Deno.test("buildHashedUserData: fbp passes through unchanged", async () => {
  const fbp = "fb.1.1700000000000.1234567890";
  const out = await buildHashedUserData(
    { fbp } as CAPIEvent["user_data"],
    { clientIp: "1.2.3.4", userAgent: null },
  );
  assertEquals(out.fbp, fbp);
});

Deno.test("buildHashedUserData: fbc passes through unchanged", async () => {
  const fbc = "fb.1.1700000000000.AbCdEfGhIjKlMnOp";
  const out = await buildHashedUserData(
    { fbc } as CAPIEvent["user_data"],
    { clientIp: "1.2.3.4", userAgent: null },
  );
  assertEquals(out.fbc, fbc);
});

Deno.test("buildHashedUserData: fbc and fbp coexist with hashed em/ph", async () => {
  const fbp = "fb.1.1700000000000.1234567890";
  const fbc = "fb.1.1700000000000.AbCdEf";
  const out = await buildHashedUserData(
    {
      em: SAMPLE_EMAIL,
      ph: SAMPLE_PHONE_RAW,
      fbp,
      fbc,
    } as CAPIEvent["user_data"],
    { clientIp: "9.9.9.9", userAgent: "ua-string" },
  );

  assertEquals(out.fbp, fbp);
  assertEquals(out.fbc, fbc);
  assert(Array.isArray(out.em));
  assert(Array.isArray(out.ph));
});

// ── 5. client_ip_address resolves correctly ────────────────────────────────

Deno.test("buildHashedUserData: client_ip_address is taken from caller (clientIp arg)", async () => {
  const out = await buildHashedUserData(
    {} as CAPIEvent["user_data"],
    { clientIp: "203.0.113.7", userAgent: null },
  );
  assertEquals(out.client_ip_address, "203.0.113.7");
});

Deno.test("extractClientIp: prefers cf-connecting-ip", () => {
  const h = new Headers({
    "cf-connecting-ip": "1.1.1.1",
    "x-forwarded-for": "2.2.2.2, 3.3.3.3",
    "x-real-ip": "4.4.4.4",
  });
  assertEquals(extractClientIp(h), "1.1.1.1");
});

Deno.test("extractClientIp: falls back to first x-forwarded-for hop", () => {
  const h = new Headers({
    "x-forwarded-for": "2.2.2.2, 3.3.3.3",
    "x-real-ip": "4.4.4.4",
  });
  assertEquals(extractClientIp(h), "2.2.2.2");
});

Deno.test("extractClientIp: trims whitespace from x-forwarded-for hop", () => {
  const h = new Headers({
    "x-forwarded-for": "   5.5.5.5  , 6.6.6.6",
  });
  assertEquals(extractClientIp(h), "5.5.5.5");
});

Deno.test("extractClientIp: falls back to x-real-ip", () => {
  const h = new Headers({ "x-real-ip": "4.4.4.4" });
  assertEquals(extractClientIp(h), "4.4.4.4");
});

Deno.test("extractClientIp: returns 0.0.0.0 when no IP headers present", () => {
  const h = new Headers();
  assertEquals(extractClientIp(h), "0.0.0.0");
});

// ── 6. client_user_agent fallback ──────────────────────────────────────────

Deno.test("buildHashedUserData: client_user_agent falls back to request header when missing", async () => {
  const out = await buildHashedUserData(
    {} as CAPIEvent["user_data"],
    { clientIp: "1.2.3.4", userAgent: "Mozilla/5.0 (TestAgent)" },
  );
  assertEquals(out.client_user_agent, "Mozilla/5.0 (TestAgent)");
});

Deno.test("buildHashedUserData: payload client_user_agent is preserved over request header", async () => {
  const out = await buildHashedUserData(
    { client_user_agent: "PayloadProvidedUA/1.0" } as CAPIEvent["user_data"],
    { clientIp: "1.2.3.4", userAgent: "Mozilla/5.0 (TestAgent)" },
  );
  assertEquals(out.client_user_agent, "PayloadProvidedUA/1.0");
});

Deno.test("buildHashedUserData: missing UA header AND missing payload UA leaves field undefined", async () => {
  const out = await buildHashedUserData(
    {} as CAPIEvent["user_data"],
    { clientIp: "1.2.3.4", userAgent: null },
  );
  assertEquals(out.client_user_agent, undefined);
});

// ── 7. Integration: a realistic canonical-dispatch payload ─────────────────

Deno.test("buildHashedUserData: full canonical-dispatch shape (pre-hashed em/ph/external_id + fbp/fbc)", async () => {
  const emHash = await knownHash(SAMPLE_EMAIL);
  const phHash = await knownHash(SAMPLE_PHONE_DIGITS);
  const extHash = await knownHash("lead-uuid-12345");
  const fbp = "fb.1.1700000000000.1234567890";
  const fbc = "fb.1.1700000000000.AbCdEf";

  const out = await buildHashedUserData(
    {
      em: emHash,
      ph: phHash,
      external_id: extHash,
      fbp,
      fbc,
    } as CAPIEvent["user_data"],
    { clientIp: "203.0.113.7", userAgent: "Mozilla/5.0 (TestAgent)" },
  );

  assertEquals(out.em, [emHash]);
  assertEquals(out.ph, [phHash]);
  assertEquals(out.external_id, extHash);
  assertEquals(out.fbp, fbp);
  assertEquals(out.fbc, fbc);
  assertEquals(out.client_ip_address, "203.0.113.7");
  assertEquals(out.client_user_agent, "Mozilla/5.0 (TestAgent)");
});
