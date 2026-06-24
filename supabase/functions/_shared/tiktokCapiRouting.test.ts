/**
 * tiktokCapiRouting regression suite.
 * Mocks Supabase + provider fetch. No live network.
 *
 * Run: deno test --allow-env supabase/functions/_shared/tiktokCapiRouting.test.ts
 */

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

import { isInternalCapiAuthorized } from "./capiRouting.ts";
import { handleTikTokCapiEventRequest } from "../tiktok-capi-event/index.ts";
import {
  buildOutboundTikTokPayload,
  processAuthorizedTikTokRequest,
  type SupabaseLike,
  type TikTokPlatformConfigRow,
  validateTikTokRequestBody,
} from "./tiktokCapiRouting.ts";

type Row = Record<string, unknown>;

interface MockSupabaseOptions {
  client?: Row | null;
  platformConfig?: Row | TikTokPlatformConfigRow | null;
  token?: string | null;
  clientError?: { message?: string; code?: string } | null;
  configError?: { message?: string; code?: string } | null;
  tokenError?: { message?: string } | null;
}

function buildMockSupabase(options: MockSupabaseOptions = {}): SupabaseLike {
  return {
    from(table: string) {
      const builder = {
        select(_cols: string) {
          return builder;
        },
        eq(_column: string, _value: unknown) {
          return builder;
        },
        async maybeSingle() {
          if (table === "clients") {
            if (options.clientError) {
              return { data: null, error: options.clientError };
            }
            return { data: options.client ?? null, error: null };
          }

          if (table === "client_platform_configs") {
            if (options.configError) {
              return { data: null, error: options.configError };
            }
            return { data: (options.platformConfig as Row | null) ?? null, error: null };
          }

          return { data: null, error: null };
        },
      };
      return builder;
    },
    rpc(fn: string, _args?: Record<string, unknown>) {
      if (fn === "get_client_capi_token_by_secret_id") {
        if (options.tokenError) {
          return Promise.resolve({ data: null, error: options.tokenError });
        }
        return Promise.resolve({ data: options.token ?? null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
  } as unknown as SupabaseLike;
}

const basePayload = {
  event_source: "web" as const,
  event_source_id: "caller-supplied-pixel",
  data: [{
    event: "UploadQuote",
    event_time: 1776160800,
    event_id: "wmc_test_tiktok_1",
    user: {
      external_id: "lead-1",
      email: "abc123hashed",
      ttclid: "tt-click-1",
    },
    properties: {
      value: 1000,
      currency: "USD",
    },
    page: {
      url: "https://windowman.example/report",
    },
  }],
};

const baseRequest = {
  payload: basePayload,
  client_slug: "direct",
  verified_client_slug: "direct",
};

const activePlatformConfig: TikTokPlatformConfigRow = {
  id: "cfg-1",
  client_id: "client-1",
  platform_name: "tiktok",
  pixel_id: "server-pixel-9999",
  dataset_id: "server-dataset-1234",
  token_secret_id: "secret-1",
  is_active: true,
};

function clearTikTokEnv() {
  Deno.env.delete("TIKTOK_ACCESS_TOKEN");
  Deno.env.delete("TIKTOK_PIXEL_ID");
  Deno.env.delete("TIKTOK_EVENT_SOURCE_ID");
  Deno.env.delete("TIKTOK_TEST_EVENT_CODE");
  Deno.env.delete("TIKTOK_EVENTS_API_ENDPOINT_URL");
}

Deno.test("validateTikTokRequestBody rejects missing payload", () => {
  const result = validateTikTokRequestBody({ client_slug: "direct" });
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.reason, "invalid_payload");
  }
});

Deno.test("validateTikTokRequestBody rejects invalid event_source", () => {
  const result = validateTikTokRequestBody({
    client_slug: "direct",
    payload: {
      ...basePayload,
      event_source: "app",
    },
  });
  assertEquals(result.ok, false);
});

Deno.test("processAuthorizedTikTokRequest: missing platform config", async () => {
  clearTikTokEnv();
  const result = await processAuthorizedTikTokRequest(baseRequest, {
    supabase: buildMockSupabase({ client: null }),
  });

  assertEquals(result.status, 202);
  assertEquals(result.body.success, false);
  assertEquals(result.body.degraded, true);
  assertEquals(result.body.reason, "missing_platform_config");
});

Deno.test("processAuthorizedTikTokRequest: missing token", async () => {
  clearTikTokEnv();
  const result = await processAuthorizedTikTokRequest(baseRequest, {
    supabase: buildMockSupabase({
      client: { id: "client-1" },
      platformConfig: {
        ...activePlatformConfig,
        token_secret_id: null,
      },
    }),
  });

  assertEquals(result.status, 202);
  assertEquals(result.body.reason, "missing_token");
});

Deno.test("processAuthorizedTikTokRequest: missing event_source_id", async () => {
  clearTikTokEnv();
  const result = await processAuthorizedTikTokRequest(baseRequest, {
    supabase: buildMockSupabase({
      client: { id: "client-1" },
      platformConfig: {
        ...activePlatformConfig,
        pixel_id: null,
        dataset_id: null,
        token_secret_id: "secret-1",
      },
      token: "vault-token",
    }),
  });

  assertEquals(result.status, 202);
  assertEquals(result.body.reason, "missing_event_source_id");
});

Deno.test("processAuthorizedTikTokRequest: server overwrites payload.event_source_id", async () => {
  clearTikTokEnv();
  let capturedBody = "";

  const result = await processAuthorizedTikTokRequest(baseRequest, {
    supabase: buildMockSupabase({
      client: { id: "client-1" },
      platformConfig: activePlatformConfig,
      token: "vault-token",
    }),
    fetchImpl: async (_input, init) => {
      capturedBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ code: 0, message: "OK" }), { status: 200 });
    },
  });

  assertEquals(result.body.success, true);
  const parsed = JSON.parse(capturedBody);
  assertEquals(parsed.event_source_id, "server-pixel-9999");
  assertEquals(parsed.event_source_id !== "caller-supplied-pixel", true);
});

Deno.test("buildOutboundTikTokPayload prefers server event_source_id", () => {
  const outbound = buildOutboundTikTokPayload(
    basePayload,
    "server-pixel-9999",
    null,
  );
  assertEquals(outbound.event_source_id, "server-pixel-9999");
});

Deno.test("processAuthorizedTikTokRequest: dry_run returns success without fetch", async () => {
  clearTikTokEnv();
  let fetchCalled = false;

  const result = await processAuthorizedTikTokRequest(
    { ...baseRequest, dry_run: true },
    {
      supabase: buildMockSupabase({
        client: { id: "client-1" },
        platformConfig: activePlatformConfig,
        token: "vault-token",
      }),
      fetchImpl: async () => {
        fetchCalled = true;
        return new Response("{}", { status: 200 });
      },
    },
  );

  assertEquals(fetchCalled, false);
  assertEquals(result.body.success, true);
  assertEquals(result.body.dry_run, true);
  assertEquals(result.body.masked_event_source_id, "…9999");
});

Deno.test("processAuthorizedTikTokRequest: attaches test_event_code when provided", async () => {
  clearTikTokEnv();
  let capturedBody = "";

  await processAuthorizedTikTokRequest(
    {
      ...baseRequest,
      test_event_code: "TEST123",
    },
    {
      supabase: buildMockSupabase({
        client: { id: "client-1" },
        platformConfig: activePlatformConfig,
        token: "vault-token",
      }),
      fetchImpl: async (_input, init) => {
        capturedBody = String(init?.body ?? "");
        return new Response(JSON.stringify({ code: 0 }), { status: 200 });
      },
    },
  );

  const parsed = JSON.parse(capturedBody);
  assertEquals(parsed.test_event_code, "TEST123");
});

Deno.test("processAuthorizedTikTokRequest: payload passes through without mutating data rows", async () => {
  clearTikTokEnv();
  let capturedBody = "";

  await processAuthorizedTikTokRequest(baseRequest, {
    supabase: buildMockSupabase({
      client: { id: "client-1" },
      platformConfig: activePlatformConfig,
      token: "vault-token",
    }),
    fetchImpl: async (_input, init) => {
      capturedBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ code: 0 }), { status: 200 });
    },
  });

  const parsed = JSON.parse(capturedBody);
  assertEquals(parsed.data[0].event, "UploadQuote");
  assertEquals(parsed.data[0].event_id, "wmc_test_tiktok_1");
  assertEquals(parsed.data[0].user.email, "abc123hashed");
  assertEquals(parsed.data[0].properties.value, 1000);
});

Deno.test("processAuthorizedTikTokRequest: mocked provider 2xx success", async () => {
  clearTikTokEnv();
  const result = await processAuthorizedTikTokRequest(baseRequest, {
    supabase: buildMockSupabase({
      client: { id: "client-1" },
      platformConfig: activePlatformConfig,
      token: "vault-token",
    }),
    fetchImpl: async () =>
      new Response(JSON.stringify({ code: 0, message: "OK" }), { status: 200 }),
  });

  assertEquals(result.body.success, true);
  assertEquals(result.body.retryable, false);
  assertEquals(result.body.provider_status, 200);
});

Deno.test("processAuthorizedTikTokRequest: mocked provider 400 permanent", async () => {
  clearTikTokEnv();
  const result = await processAuthorizedTikTokRequest(baseRequest, {
    supabase: buildMockSupabase({
      client: { id: "client-1" },
      platformConfig: activePlatformConfig,
      token: "vault-token",
    }),
    fetchImpl: async () =>
      new Response(JSON.stringify({ error: "bad request" }), { status: 400 }),
  });

  assertEquals(result.body.success, false);
  assertEquals(result.body.reason, "provider_4xx");
  assertEquals(result.body.retryable, false);
});

Deno.test("processAuthorizedTikTokRequest: mocked provider 429 retryable", async () => {
  clearTikTokEnv();
  const result = await processAuthorizedTikTokRequest(baseRequest, {
    supabase: buildMockSupabase({
      client: { id: "client-1" },
      platformConfig: activePlatformConfig,
      token: "vault-token",
    }),
    fetchImpl: async () =>
      new Response(JSON.stringify({ error: "rate limit" }), { status: 429 }),
  });

  assertEquals(result.body.reason, "provider_429");
  assertEquals(result.body.retryable, true);
});

Deno.test("processAuthorizedTikTokRequest: mocked provider 500 retryable", async () => {
  clearTikTokEnv();
  const result = await processAuthorizedTikTokRequest(baseRequest, {
    supabase: buildMockSupabase({
      client: { id: "client-1" },
      platformConfig: activePlatformConfig,
      token: "vault-token",
    }),
    fetchImpl: async () =>
      new Response(JSON.stringify({ error: "server error" }), { status: 500 }),
  });

  assertEquals(result.body.reason, "provider_5xx");
  assertEquals(result.body.retryable, true);
});

Deno.test("processAuthorizedTikTokRequest: network throw returns network_error", async () => {
  clearTikTokEnv();
  const result = await processAuthorizedTikTokRequest(baseRequest, {
    supabase: buildMockSupabase({
      client: { id: "client-1" },
      platformConfig: activePlatformConfig,
      token: "vault-token",
    }),
    fetchImpl: async () => {
      throw new Error("connection reset");
    },
  });

  assertEquals(result.body.reason, "network_error");
  assertEquals(result.body.retryable, true);
});

Deno.test("processAuthorizedTikTokRequest: live path uses Access-Token header not body token", async () => {
  clearTikTokEnv();
  let capturedHeaders: Headers | undefined;
  let capturedBody = "";

  await processAuthorizedTikTokRequest(baseRequest, {
    supabase: buildMockSupabase({
      client: { id: "client-1" },
      platformConfig: activePlatformConfig,
      token: "vault-token-secret",
    }),
    fetchImpl: async (_input, init) => {
      capturedHeaders = init?.headers as Headers;
      capturedBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ code: 0 }), { status: 200 });
    },
  });

  const headers = capturedHeaders as unknown as Record<string, string>;
  assertEquals(headers["Access-Token"], "vault-token-secret");
  assert(!capturedBody.includes("vault-token-secret"));
});

Deno.test("logTikTokDispatchSafe does not log raw token or user hashes", async () => {
  clearTikTokEnv();
  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  };

  try {
    await processAuthorizedTikTokRequest(baseRequest, {
      supabase: buildMockSupabase({
        client: { id: "client-1" },
        platformConfig: activePlatformConfig,
        token: "super-secret-token-value",
      }),
      fetchImpl: async () =>
        new Response(JSON.stringify({ code: 0 }), { status: 200 }),
    });
  } finally {
    console.log = originalLog;
  }

  const joined = logs.join("\n");
  assert(!joined.includes("super-secret-token-value"));
  assert(!joined.includes("abc123hashed"));
  assert(!joined.includes("tt-click-1"));
});

Deno.test("error responses do not include raw token values", async () => {
  clearTikTokEnv();
  const result = await processAuthorizedTikTokRequest(baseRequest, {
    supabase: buildMockSupabase({
      client: { id: "client-1" },
      platformConfig: activePlatformConfig,
      token: "super-secret-token-value",
    }),
    fetchImpl: async () =>
      new Response(JSON.stringify({ error: "invalid token super-secret-token-value" }), {
        status: 400,
      }),
  });

  const serialized = JSON.stringify(result.body);
  assert(!serialized.includes("super-secret-token-value"));
});

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
  kind: "service" | "none",
): Record<string, string> {
  const base = { "Content-Type": "application/json" };
  if (kind === "service") {
    return { ...base, Authorization: `Bearer ${TEST_SERVICE_KEY}` };
  }
  return base;
}

Deno.test("isInternalCapiAuthorized: service-role bearer accepted", () =>
  withTestAuthEnv(() => {
    const req = new Request("https://example/functions/v1/tiktok-capi-event", {
      method: "POST",
      headers: authHeaders("service"),
    });
    assert(isInternalCapiAuthorized(req));
  }));

Deno.test("handleTikTokCapiEventRequest: no auth → 401 unauthorized", () =>
  withTestAuthEnv(async () => {
    const res = await handleTikTokCapiEventRequest(
      new Request("https://example/functions/v1/tiktok-capi-event", {
        method: "POST",
        headers: authHeaders("none"),
        body: JSON.stringify(baseRequest),
      }),
    );
    assertEquals(res.status, 401);
    assertEquals(await res.json(), { success: false, reason: "unauthorized" });
  }));

Deno.test("handleTikTokCapiEventRequest: authenticated malformed JSON → 400 invalid_json", () =>
  withTestAuthEnv(async () => {
    const res = await handleTikTokCapiEventRequest(
      new Request("https://example/functions/v1/tiktok-capi-event", {
        method: "POST",
        headers: authHeaders("service"),
        body: "{bad-json",
      }),
    );
    assertEquals(res.status, 400);
    assertEquals(await res.json(), { success: false, reason: "invalid_json" });
  }));
