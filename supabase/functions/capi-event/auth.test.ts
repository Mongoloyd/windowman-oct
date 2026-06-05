/**
 * capi-event internal auth gate regression suite (Wave C).
 *
 * Proves auth runs before JSON parse and rejects public/anon callers.
 */

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

import {
  constantTimeEqual,
  handleCapiEventRequest,
  isInternalCapiAuthorized,
} from "./index.ts";

const TEST_SERVICE_KEY = "test-service-key";
const TEST_DISPATCH_SECRET = "test-dispatch-secret";

function saveEnv(key: string): string | undefined {
  const prev = Deno.env.get(key);
  return prev;
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
  event_name: "Lead",
  event_id: "auth-test-1",
  event_source_url: "https://windowman.app/test",
  action_source: "website",
  client_slug: "forged-tenant",
  verified_client_slug: "forged-tenant",
  route_class: "tenant_required",
  user_data: { external_id: crypto.randomUUID() },
});

Deno.test("constantTimeEqual: equal strings match", () => {
  assert(constantTimeEqual("abc", "abc"));
});

Deno.test("constantTimeEqual: different lengths do not match", () => {
  assert(!constantTimeEqual("abc", "abcd"));
});

Deno.test("constantTimeEqual: empty strings do not throw", () => {
  assert(constantTimeEqual("", ""));
  assert(!constantTimeEqual("", "x"));
});

Deno.test("isInternalCapiAuthorized: service-role bearer accepted", () =>
  withTestAuthEnv(() => {
    const req = new Request("https://example/functions/v1/capi-event", {
      method: "POST",
      headers: authHeaders("service"),
    });
    assert(isInternalCapiAuthorized(req));
  }));

Deno.test("isInternalCapiAuthorized: dispatch secret accepted when configured", () =>
  withTestAuthEnv(() => {
    const req = new Request("https://example/functions/v1/capi-event", {
      method: "POST",
      headers: authHeaders("dispatch"),
    });
    assert(isInternalCapiAuthorized(req));
  }));

Deno.test("isInternalCapiAuthorized: anon bearer rejected", () =>
  withTestAuthEnv(() => {
    const req = new Request("https://example/functions/v1/capi-event", {
      method: "POST",
      headers: authHeaders("anon"),
    });
    assert(!isInternalCapiAuthorized(req));
  }));

Deno.test("isInternalCapiAuthorized: no auth rejected", () =>
  withTestAuthEnv(() => {
    const req = new Request("https://example/functions/v1/capi-event", {
      method: "POST",
      headers: authHeaders("none"),
    });
    assert(!isInternalCapiAuthorized(req));
  }));

Deno.test("handleCapiEventRequest: no auth → 401", () =>
  withTestAuthEnv(async () => {
    const res = await handleCapiEventRequest(
      new Request("https://example/functions/v1/capi-event", {
        method: "POST",
        headers: authHeaders("none"),
        body: minimalPayload,
      }),
    );
    assertEquals(res.status, 401);
    const body = await res.json();
    assertEquals(body, { success: false, reason: "unauthorized" });
  }));

Deno.test("handleCapiEventRequest: anon bearer → 401", () =>
  withTestAuthEnv(async () => {
    const res = await handleCapiEventRequest(
      new Request("https://example/functions/v1/capi-event", {
        method: "POST",
        headers: authHeaders("anon"),
        body: minimalPayload,
      }),
    );
    assertEquals(res.status, 401);
    assertEquals((await res.json()).reason, "unauthorized");
  }));

Deno.test("handleCapiEventRequest: missing Origin without auth → 401", () =>
  withTestAuthEnv(async () => {
    const res = await handleCapiEventRequest(
      new Request("https://example/functions/v1/capi-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: minimalPayload,
      }),
    );
    assertEquals(res.status, 401);
  }));

Deno.test("handleCapiEventRequest: forged client_slug without auth → 401", () =>
  withTestAuthEnv(async () => {
    const res = await handleCapiEventRequest(
      new Request("https://example/functions/v1/capi-event", {
        method: "POST",
        headers: authHeaders("none"),
        body: JSON.stringify({
          event_name: "Lead",
          event_id: "forged",
          event_source_url: "https://evil.example",
          action_source: "website",
          client_slug: "premium-tenant",
          verified_client_slug: "premium-tenant",
          route_class: "tenant_required",
          user_data: {},
        }),
      }),
    );
    assertEquals(res.status, 401);
  }));

Deno.test("handleCapiEventRequest: unauthenticated malformed JSON → 401", () =>
  withTestAuthEnv(async () => {
    const res = await handleCapiEventRequest(
      new Request("https://example/functions/v1/capi-event", {
        method: "POST",
        headers: authHeaders("none"),
        body: "{not-json",
      }),
    );
    assertEquals(res.status, 401);
  }));

Deno.test("handleCapiEventRequest: authenticated malformed JSON → 400 invalid_json", () =>
  withTestAuthEnv(async () => {
    const res = await handleCapiEventRequest(
      new Request("https://example/functions/v1/capi-event", {
        method: "POST",
        headers: authHeaders("service"),
        body: "{bad-json",
      }),
    );
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body, { success: false, reason: "invalid_json" });
  }));

Deno.test("handleCapiEventRequest: OPTIONS bypasses auth", () =>
  withTestAuthEnv(async () => {
    const res = await handleCapiEventRequest(
      new Request("https://example/functions/v1/capi-event", {
        method: "OPTIONS",
      }),
    );
    assertEquals(res.status, 200);
  }));
