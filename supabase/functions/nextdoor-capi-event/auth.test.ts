/**
 * nextdoor-capi-event internal auth regression suite.
 */

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

import { isInternalCapiAuthorized } from "../_shared/capiRouting.ts";
import { handleNextdoorCapiEventRequest } from "./index.ts";

const TEST_SERVICE_KEY = "test-service-key";
const TEST_DISPATCH_SECRET = "test-dispatch-secret";

function saveEnv(key: string): string | undefined {
  return Deno.env.get(key);
}

function restoreEnv(key: string, prev: string | undefined) {
  if (prev === undefined) {
    Deno.env.delete(key);
  } else {
    Deno.env.set(key, prev);
  }
}

function withTestAuthEnv(fn: () => void | Promise<void>) {
  const prevService = saveEnv("SUPABASE_SERVICE_ROLE_KEY");
  const prevDispatch = saveEnv("CAPI_DISPATCH_SECRET");
  const prevUrl = saveEnv("SUPABASE_URL");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", TEST_SERVICE_KEY);
  Deno.env.set("CAPI_DISPATCH_SECRET", TEST_DISPATCH_SECRET);
  Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
  return Promise.resolve(fn()).finally(() => {
    restoreEnv("SUPABASE_SERVICE_ROLE_KEY", prevService);
    restoreEnv("CAPI_DISPATCH_SECRET", prevDispatch);
    restoreEnv("SUPABASE_URL", prevUrl);
  });
}

function authHeaders(
  kind: "service" | "anon" | "dispatch" | "none",
): Record<string, string> {
  const base = { "Content-Type": "application/json" };
  if (kind === "service") {
    return { ...base, Authorization: `Bearer ${TEST_SERVICE_KEY}` };
  }
  if (kind === "anon") {
    return { ...base, Authorization: "Bearer anon-publishable-key" };
  }
  if (kind === "dispatch") {
    return { ...base, "x-capi-dispatch-secret": TEST_DISPATCH_SECRET };
  }
  return base;
}

const minimalPayload = JSON.stringify({
  payload: {
    event_name: "lead",
    event_id: "auth-test-1",
    event_time_epoch: 1776160800,
    action_source: "website",
    action_source_url: "https://windowman.example/nextdoor",
    data_source_id: "placeholder",
    delivery_optimization: true,
    customer: { external_id: "lead-1" },
  },
  client_slug: "direct",
});

Deno.test("isInternalCapiAuthorized: service-role bearer accepted", () =>
  withTestAuthEnv(() => {
    const req = new Request("https://example/functions/v1/nextdoor-capi-event", {
      method: "POST",
      headers: authHeaders("service"),
    });
    assert(isInternalCapiAuthorized(req));
  }));

Deno.test("isInternalCapiAuthorized: dispatch secret accepted when configured", () =>
  withTestAuthEnv(() => {
    const req = new Request("https://example/functions/v1/nextdoor-capi-event", {
      method: "POST",
      headers: authHeaders("dispatch"),
    });
    assert(isInternalCapiAuthorized(req));
  }));

Deno.test("handleNextdoorCapiEventRequest: no auth → 401 unauthorized", () =>
  withTestAuthEnv(async () => {
    const res = await handleNextdoorCapiEventRequest(
      new Request("https://example/functions/v1/nextdoor-capi-event", {
        method: "POST",
        headers: authHeaders("none"),
        body: minimalPayload,
      }),
    );
    assertEquals(res.status, 401);
    assertEquals(await res.json(), { success: false, reason: "unauthorized" });
  }));

Deno.test("handleNextdoorCapiEventRequest: authenticated malformed JSON → 400 invalid_json", () =>
  withTestAuthEnv(async () => {
    const res = await handleNextdoorCapiEventRequest(
      new Request("https://example/functions/v1/nextdoor-capi-event", {
        method: "POST",
        headers: authHeaders("service"),
        body: "{bad-json",
      }),
    );
    assertEquals(res.status, 400);
    assertEquals(await res.json(), { success: false, reason: "invalid_json" });
  }));

Deno.test("handleNextdoorCapiEventRequest: unauthenticated malformed JSON → 401", () =>
  withTestAuthEnv(async () => {
    const res = await handleNextdoorCapiEventRequest(
      new Request("https://example/functions/v1/nextdoor-capi-event", {
        method: "POST",
        headers: authHeaders("none"),
        body: "{bad-json",
      }),
    );
    assertEquals(res.status, 401);
  }));
