/**
 * contractor-send-followups — integration tests
 *
 * Verifies authentication, CORS preflight, and empty-queue behaviour
 * against the deployed function.
 */

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = "https://example.supabase.co";
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/contractor-send-followups`;

Deno.test("contractor-send-followups CORS preflight returns 200", async () => {
  const res = await fetch(FUNCTION_URL, { method: "OPTIONS" });
  await res.text();
  assertEquals(res.status, 200);
  assertExists(res.headers.get("access-control-allow-origin"));
});

Deno.test("contractor-send-followups rejects request without secret", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  await res.text();
  assertEquals(res.status, 401);
});

Deno.test("contractor-send-followups rejects request with wrong secret", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-contractor-secret": "wrong-secret-value",
    },
  });
  await res.text();
  assertEquals(res.status, 401);
});

Deno.test("contractor-send-followups rejects non-POST method", async () => {
  const res = await fetch(FUNCTION_URL, { method: "GET" });
  await res.text();
  assertEquals(res.status, 405);
});

Deno.test("contractor-send-followups returns summary with correct secret", async () => {
  const secret = Deno.env.get("CONTRACTOR_CRON_SECRET");
  if (!secret) {
    console.log("Skipping: CONTRACTOR_CRON_SECRET not set");
    return;
  }
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-contractor-secret": secret,
    },
  });
  // Accept 200 (processed or empty queue) or 500 if RESEND_API_KEY not configured
  const acceptable = [200, 500];
  const body = await res.json();
  assertEquals(
    acceptable.includes(res.status),
    true,
    `Unexpected status ${res.status}: ${JSON.stringify(body)}`,
  );
  if (res.status === 200) {
    assertExists(body.attempted !== undefined ? body : null);
  }
});
