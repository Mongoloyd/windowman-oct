/**
 * Deno tests for _shared/adminAuth.ts dev-bypass gate.
 *
 * Covers the three-gate check:
 *   1. DEV_BYPASS_ENABLED must be "true" (case/whitespace tolerant)
 *   2. DEV_BYPASS_SECRET must be configured on server
 *   3. x-dev-secret header must match DEV_BYPASS_SECRET
 */
import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateAdminRequest } from "./adminAuth.ts";

const BASE_ENV = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
};

function setBaseEnv() {
  for (const [k, v] of Object.entries(BASE_ENV)) Deno.env.set(k, v);
}

function clearDevEnv() {
  Deno.env.delete("DEV_BYPASS_ENABLED");
  Deno.env.delete("DEV_BYPASS_SECRET");
}

function makeReq(headers: Record<string, string> = {}): Request {
  return new Request("https://example.com/admin", { headers });
}

Deno.test("no x-dev-secret + no JWT → 401 unauthorized", async () => {
  setBaseEnv();
  clearDevEnv();
  const res = await validateAdminRequest(makeReq());
  assertEquals(res.ok, false);
  if (!res.ok) {
    assertEquals(res.response.status, 401);
    const body = await res.response.json();
    assertEquals(body.code, "unauthorized");
  }
});

Deno.test("x-dev-secret present, DEV_BYPASS_ENABLED unset → 403 dev_bypass_disabled", async () => {
  setBaseEnv();
  clearDevEnv();
  Deno.env.set("DEV_BYPASS_SECRET", "correct-secret");
  const res = await validateAdminRequest(
    makeReq({ "x-dev-secret": "correct-secret" }),
  );
  assertEquals(res.ok, false);
  if (!res.ok) {
    assertEquals(res.response.status, 403);
    const body = await res.response.json();
    assertEquals(body.code, "dev_bypass_disabled");
  }
  clearDevEnv();
});

Deno.test("x-dev-secret + DEV_BYPASS_ENABLED=true, secret unset → 500 config_error", async () => {
  setBaseEnv();
  clearDevEnv();
  Deno.env.set("DEV_BYPASS_ENABLED", "true");
  const res = await validateAdminRequest(
    makeReq({ "x-dev-secret": "anything" }),
  );
  assertEquals(res.ok, false);
  if (!res.ok) {
    assertEquals(res.response.status, 500);
    const body = await res.response.json();
    assertEquals(body.code, "config_error");
  }
  clearDevEnv();
});

Deno.test("x-dev-secret wrong value with flag/secret set → 401 dev_bypass_mismatch", async () => {
  setBaseEnv();
  clearDevEnv();
  Deno.env.set("DEV_BYPASS_ENABLED", "true");
  Deno.env.set("DEV_BYPASS_SECRET", "correct-secret");
  const res = await validateAdminRequest(
    makeReq({ "x-dev-secret": "wrong-secret" }),
  );
  assertEquals(res.ok, false);
  if (!res.ok) {
    assertEquals(res.response.status, 401);
    const body = await res.response.json();
    assertEquals(body.code, "dev_bypass_mismatch");
  }
  clearDevEnv();
});

Deno.test("x-dev-secret correct + flag enabled + secret set → ok super_admin", async () => {
  setBaseEnv();
  clearDevEnv();
  Deno.env.set("DEV_BYPASS_ENABLED", "  TRUE  ");
  Deno.env.set("DEV_BYPASS_SECRET", "correct-secret");
  const res = await validateAdminRequest(
    makeReq({ "x-dev-secret": "correct-secret" }),
  );
  assertEquals(res.ok, true);
  if (res.ok) {
    assertEquals(res.role, "super_admin");
    assertExists(res.supabaseAdmin);
  }
  clearDevEnv();
});
