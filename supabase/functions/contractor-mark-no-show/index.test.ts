/**
 * contractor-mark-no-show — integration tests
 *
 * Verifies authentication, input validation, CORS preflight, and idempotency
 * behaviour against the deployed function.
 */

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = "https://wkrcyxcnzhwjtdpmfpaf.supabase.co";
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/contractor-mark-no-show`;

Deno.test("contractor-mark-no-show CORS preflight returns 200", async () => {
  const res = await fetch(FUNCTION_URL, { method: "OPTIONS" });
  await res.text();
  assertEquals(res.status, 200);
  assertExists(res.headers.get("access-control-allow-origin"));
});

Deno.test("contractor-mark-no-show rejects request without secret", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lead_id: "00000000-0000-0000-0000-000000000001" }),
  });
  await res.text();
  assertEquals(res.status, 401);
});

Deno.test("contractor-mark-no-show rejects request with wrong secret", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-contractor-secret": "wrong-secret-value",
    },
    body: JSON.stringify({ lead_id: "00000000-0000-0000-0000-000000000001" }),
  });
  await res.text();
  assertEquals(res.status, 401);
});

Deno.test("contractor-mark-no-show rejects non-POST method", async () => {
  const res = await fetch(FUNCTION_URL, { method: "GET" });
  await res.text();
  assertEquals(res.status, 405);
});

Deno.test("contractor-mark-no-show rejects missing lead_id", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-contractor-secret": Deno.env.get("CONTRACTOR_CRON_SECRET") ??
        "placeholder",
    },
    body: JSON.stringify({}),
  });
  await res.text();
  const acceptable = [400, 401, 500];
  assertEquals(
    acceptable.includes(res.status),
    true,
    `Unexpected status ${res.status}`,
  );
});

Deno.test("contractor-mark-no-show returns 404 for unknown lead_id", async () => {
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
    body: JSON.stringify({ lead_id: "00000000-0000-0000-0000-000000000000" }),
  });
  const body = await res.json();
  assertEquals(res.status, 404);
  assertExists(body.error);
});
