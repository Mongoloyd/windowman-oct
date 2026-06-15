/**
 * nextdoor-capi-event dispatch regression suite.
 * Mocks Supabase + provider fetch. No live network.
 */

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

import {
  buildOutboundNextdoorPayload,
  processAuthorizedNextdoorRequest,
  type NextdoorPlatformConfigRow,
  type SupabaseLike,
  validateNextdoorRequestBody,
} from "../_shared/nextdoorCapiRouting.ts";

type Row = Record<string, unknown>;

interface MockSupabaseOptions {
  client?: Row | null;
  platformConfig?: Row | NextdoorPlatformConfigRow | null;
  token?: string | null;
  clientError?: { message?: string; code?: string } | null;
  configError?: { message?: string; code?: string } | null;
  tokenError?: { message?: string } | null;
}

function buildMockSupabase(options: MockSupabaseOptions = {}): SupabaseLike {
  return {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const builder = {
        select(_cols: string) {
          return builder;
        },
        eq(column: string, value: unknown) {
          filters[column] = value;
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

const baseRequest = {
  payload: {
    event_name: "lead",
    event_id: "wmc_test_1",
    event_time_epoch: 1776160800,
    action_source: "website" as const,
    action_source_url: "https://windowman.example/nextdoor",
    data_source_id: "caller-supplied-id",
    delivery_optimization: true,
    customer: { external_id: "lead-1" },
  },
  client_slug: "direct",
  verified_client_slug: "direct",
};

const activePlatformConfig: NextdoorPlatformConfigRow = {
  id: "cfg-1",
  client_id: "client-1",
  platform_name: "nextdoor",
  pixel_id: "pixel-fallback-9999",
  dataset_id: "server-dataset-id-1234",
  token_secret_id: "secret-1",
  is_active: true,
};

function clearNextdoorEnv() {
  Deno.env.delete("NEXTDOOR_CAPI_TOKEN");
  Deno.env.delete("NEXTDOOR_DATA_SOURCE_ID");
  Deno.env.delete("NEXTDOOR_CAPI_ENDPOINT_URL");
}

Deno.test("validateNextdoorRequestBody rejects missing payload", () => {
  const result = validateNextdoorRequestBody({ client_slug: "direct" });
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.reason, "invalid_payload");
  }
});

Deno.test("processAuthorizedNextdoorRequest: missing platform config", async () => {
  clearNextdoorEnv();
  const result = await processAuthorizedNextdoorRequest(baseRequest, {
    supabase: buildMockSupabase({ client: null }),
  });

  assertEquals(result.status, 202);
  assertEquals(result.body.success, false);
  assertEquals(result.body.degraded, true);
  assertEquals(result.body.reason, "missing_platform_config");
});

Deno.test("processAuthorizedNextdoorRequest: missing token", async () => {
  clearNextdoorEnv();
  const result = await processAuthorizedNextdoorRequest(baseRequest, {
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

Deno.test("processAuthorizedNextdoorRequest: missing data_source_id", async () => {
  clearNextdoorEnv();
  const result = await processAuthorizedNextdoorRequest(baseRequest, {
    supabase: buildMockSupabase({
      client: { id: "client-1" },
      platformConfig: {
        ...activePlatformConfig,
        dataset_id: null,
        pixel_id: null,
        token_secret_id: "secret-1",
      },
      token: "vault-token",
    }),
  });

  assertEquals(result.status, 202);
  assertEquals(result.body.reason, "missing_data_source_id");
});

Deno.test("processAuthorizedNextdoorRequest: server overwrites payload.data_source_id", async () => {
  clearNextdoorEnv();
  let capturedBody = "";

  const result = await processAuthorizedNextdoorRequest(baseRequest, {
    supabase: buildMockSupabase({
      client: { id: "client-1" },
      platformConfig: activePlatformConfig,
      token: "vault-token",
    }),
    fetchImpl: async (_input, init) => {
      capturedBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
  });

  assertEquals(result.body.success, true);
  const parsed = JSON.parse(capturedBody);
  assertEquals(parsed.data_source_id, "server-dataset-id-1234");
  assertEquals(parsed.data_source_id !== "caller-supplied-id", true);
});

Deno.test("buildOutboundNextdoorPayload prefers server data_source_id", () => {
  const outbound = buildOutboundNextdoorPayload(
    baseRequest.payload,
    "server-dataset-id-1234",
  );
  assertEquals(outbound.data_source_id, "server-dataset-id-1234");
});

Deno.test("processAuthorizedNextdoorRequest: dry_run does not call provider", async () => {
  clearNextdoorEnv();
  let fetchCalled = false;

  const result = await processAuthorizedNextdoorRequest(
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
  assertEquals(result.body.masked_data_source_id, "…1234");
});

Deno.test("processAuthorizedNextdoorRequest: mocked provider 2xx success", async () => {
  clearNextdoorEnv();
  const result = await processAuthorizedNextdoorRequest(baseRequest, {
    supabase: buildMockSupabase({
      client: { id: "client-1" },
      platformConfig: activePlatformConfig,
      token: "vault-token",
    }),
    fetchImpl: async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
  });

  assertEquals(result.body.success, true);
  assertEquals(result.body.retryable, false);
  assertEquals(result.body.provider_status, 200);
});

Deno.test("processAuthorizedNextdoorRequest: mocked provider 400", async () => {
  clearNextdoorEnv();
  const result = await processAuthorizedNextdoorRequest(baseRequest, {
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

Deno.test("processAuthorizedNextdoorRequest: mocked provider 429", async () => {
  clearNextdoorEnv();
  const result = await processAuthorizedNextdoorRequest(baseRequest, {
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

Deno.test("processAuthorizedNextdoorRequest: mocked provider 500", async () => {
  clearNextdoorEnv();
  const result = await processAuthorizedNextdoorRequest(baseRequest, {
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

Deno.test("processAuthorizedNextdoorRequest: network throw returns network_error", async () => {
  clearNextdoorEnv();
  const result = await processAuthorizedNextdoorRequest(baseRequest, {
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

Deno.test("processAuthorizedNextdoorRequest: enum mismatch returns missing_platform_config", async () => {
  clearNextdoorEnv();
  const result = await processAuthorizedNextdoorRequest(baseRequest, {
    supabase: buildMockSupabase({
      client: { id: "client-1" },
      configError: {
        message: 'invalid input value for enum wm_platform_name: "nextdoor"',
        code: "22P02",
      },
    }),
  });

  assertEquals(result.body.reason, "missing_platform_config");
});

Deno.test("logNextdoorDispatchSafe does not log raw token or customer", async () => {
  clearNextdoorEnv();
  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  };

  try {
    await processAuthorizedNextdoorRequest(baseRequest, {
      supabase: buildMockSupabase({
        client: { id: "client-1" },
        platformConfig: activePlatformConfig,
        token: "super-secret-token-value",
      }),
      fetchImpl: async (_input, init) => {
        const body = String(init?.body ?? "");
        assert(!body.includes("super-secret-token-value") || body.startsWith("{"));
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    });
  } finally {
    console.log = originalLog;
  }

  const joined = logs.join("\n");
  assert(!joined.includes("super-secret-token-value"));
  assert(!joined.includes("customer"));
  assert(!joined.includes("email"));
  assert(!joined.includes("phone"));
});
