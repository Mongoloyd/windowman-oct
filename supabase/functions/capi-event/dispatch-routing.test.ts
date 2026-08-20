/**
 * capi-event dispatch routing regression suite (Wave C).
 *
 * Locks resolvePixelConfigForDispatch fail-closed behavior and ensures
 * internal route metadata never reaches Meta outbound payloads.
 */

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

import {
  type CAPIEvent,
  buildHashedUserData,
  dispatchCapiEvent,
  parseInternalRouteContext,
  processAuthorizedCapiRequest,
  resolvePixelConfig,
  resolvePixelConfigForDispatch,
} from "./index.ts";

type Row = Record<string, unknown>;

interface MockTables {
  clients: Row[];
  meta_configurations: Row[];
  client_configs?: Row[];
}

function buildMockSupabase(tables: MockTables) {
  return {
    from(table: keyof MockTables | "capi_signal_logs" | "event_logs") {
      if (table === "capi_signal_logs" || table === "event_logs") {
        return {
          insert(_payload: unknown) {
            return Promise.resolve({ data: null, error: null });
          },
        };
      }

      let rows = [...(tables[table as keyof MockTables] ?? [])];
      const builder = {
        select(_cols: string) {
          return builder;
        },
        eq(col: string, val: unknown) {
          rows = rows.filter((r) => r[col] === val);
          return builder;
        },
        // deno-lint-ignore require-await
        async single() {
          return {
            data: rows[0] ?? null,
            error: rows[0] ? null : { code: "PGRST116" },
          };
        },
        // deno-lint-ignore require-await
        async maybeSingle() {
          return { data: rows[0] ?? null, error: null };
        },
      };
      return builder;
    },
    rpc(_fn: string, _args?: Record<string, unknown>) {
      return Promise.resolve({ data: null, error: null });
    },
  };
}

function clearEnv() {
  Deno.env.delete("META_PIXEL_ID");
  Deno.env.delete("META_CAPI_TOKEN");
  Deno.env.delete("META_TEST_EVENT_CODE");
}

function setEnv(pixelId: string, token: string) {
  Deno.env.set("META_PIXEL_ID", pixelId);
  Deno.env.set("META_CAPI_TOKEN", token);
}

const baseTables = {
  clients: [{ id: "client-uuid-1", slug: "acme", is_active: true }],
  meta_configurations: [
    {
      client_id: "client-uuid-1",
      pixel_id: "PIXEL_ACME_123",
      access_token: "TOKEN_ACME",
      test_event_code: null,
    },
    {
      is_default: true,
      pixel_id: "PIXEL_DEFAULT",
      access_token: "TOKEN_DEFAULT",
      test_event_code: null,
      id: "default-uuid",
    },
  ],
};

Deno.test("parseInternalRouteContext: prefers verified_client_slug", () => {
  const ctx = parseInternalRouteContext({
    event_name: "Lead",
    event_id: "e1",
    event_source_url: "https://windowman.app",
    action_source: "website",
    client_slug: "legacy-slug",
    verified_client_slug: "verified-slug",
    route_class: "tenant_required",
    user_data: {},
  });

  assertEquals(ctx.verifiedClientSlug, "verified-slug");
  assertEquals(ctx.metaEvent.client_slug, "verified-slug");
});

Deno.test("parseInternalRouteContext: infers tenant_required when slug present", () => {
  const ctx = parseInternalRouteContext({
    event_name: "Lead",
    event_id: "e2",
    event_source_url: "https://windowman.app",
    action_source: "website",
    verified_client_slug: "tenant-a",
    user_data: {},
  });

  assertEquals(ctx.routeClass, "tenant_required");
});

Deno.test("resolvePixelConfigForDispatch: tenant_required + valid slug routes to client config", async () => {
  clearEnv();
  const supabase = buildMockSupabase(baseTables);
  const result = await resolvePixelConfigForDispatch({
    supabase: supabase as never,
    routeClass: "tenant_required",
    verifiedClientSlug: "acme",
    eventName: "Lead",
  });

  assertEquals(result.ok, true);
  assertEquals(result.config?.pixelId, "PIXEL_ACME_123");
  assertEquals(result.config?.source, "client:acme");
});

Deno.test("resolvePixelConfigForDispatch: tenant_required + missing slug fails closed", async () => {
  clearEnv();
  const supabase = buildMockSupabase(baseTables);
  const result = await resolvePixelConfigForDispatch({
    supabase: supabase as never,
    routeClass: "tenant_required",
  });

  assertEquals(result.ok, false);
  assertEquals(result.reason, "route_context_missing");
});

Deno.test("resolvePixelConfigForDispatch: unknown tenant does not default fallback", async () => {
  clearEnv();
  setEnv("PIXEL_ENV", "TOKEN_ENV");
  const supabase = buildMockSupabase(baseTables);
  const result = await resolvePixelConfigForDispatch({
    supabase: supabase as never,
    routeClass: "tenant_required",
    verifiedClientSlug: "ghost-client",
    eventName: "Lead",
  });

  assertEquals(result.ok, false);
  assertEquals(result.reason, "tenant_config_missing");
  clearEnv();
});

Deno.test("resolvePixelConfigForDispatch: inactive tenant does not default fallback", async () => {
  clearEnv();
  const supabase = buildMockSupabase({
    clients: [{ id: "c1", slug: "acme", is_active: false }],
    meta_configurations: baseTables.meta_configurations,
  });
  const result = await resolvePixelConfigForDispatch({
    supabase: supabase as never,
    routeClass: "tenant_required",
    verifiedClientSlug: "acme",
    eventName: "Lead",
  });

  assertEquals(result.ok, false);
  assertEquals(result.reason, "tenant_config_missing");
});

Deno.test("resolvePixelConfigForDispatch: unresolved route fails closed", async () => {
  clearEnv();
  const supabase = buildMockSupabase(baseTables);
  const result = await resolvePixelConfigForDispatch({
    supabase: supabase as never,
    routeClass: "unresolved",
  });

  assertEquals(result.ok, false);
  assertEquals(result.reason, "unresolved_route");
});

Deno.test("resolvePixelConfigForDispatch: platform_owned with empty allowlist fails closed", async () => {
  clearEnv();
  const supabase = buildMockSupabase(baseTables);
  const result = await resolvePixelConfigForDispatch({
    supabase: supabase as never,
    routeClass: "platform_owned",
    eventName: "PageView",
  });

  assertEquals(result.ok, false);
  assertEquals(result.reason, "platform_default_not_allowed");
});

Deno.test("platform WMChat Lead requires the exact internal scope and uses default config", async () => {
  clearEnv();
  const supabase = buildMockSupabase(baseTables);
  const context = parseInternalRouteContext({
    event_name: "Lead",
    event_id: "wmc_lead_captured_lead-a_session-b",
    event_source_url: "https://windowman.app/wmchat",
    action_source: "website",
    route_class: "platform_owned",
    platform_event_scope: "wmchat_day1_lead",
    user_data: { ph: "a".repeat(64) },
  });

  assertEquals(context.routeClass, "platform_owned");
  assertEquals("platform_event_scope" in context.metaEvent, false);
  const result = await resolvePixelConfigForDispatch({
    supabase: supabase as never,
    routeClass: context.routeClass,
    verifiedClientSlug: context.verifiedClientSlug,
    eventName: "Lead",
  });
  assertEquals(result.ok, true);
  assertEquals(result.config?.pixelId, "PIXEL_DEFAULT");
});

Deno.test("platform route without the exact WMChat scope is unresolved", () => {
  const context = parseInternalRouteContext({
    event_name: "Lead",
    event_id: "unscoped-lead",
    event_source_url: "https://windowman.app/wmchat",
    action_source: "website",
    route_class: "platform_owned",
    user_data: { ph: "a".repeat(64) },
  });
  assertEquals(context.routeClass, "unresolved");
  assertEquals(context.verifiedClientSlug, undefined);
});

Deno.test("buildHashedUserData preserves the captured browser IP and hashes PII", async () => {
  const userData = await buildHashedUserData(
    {
      ph: "+15615550123",
      client_ip_address: "203.0.113.10",
      client_user_agent: "captured-browser-agent",
    },
    { clientIp: "127.0.0.1", userAgent: "worker-agent" },
  );

  assertEquals(userData.client_ip_address, "203.0.113.10");
  assertEquals(userData.client_user_agent, "captured-browser-agent");
  assertEquals(Array.isArray(userData.ph), true);
  assertEquals(String((userData.ph as string[])[0]).includes("5615550123"), false);
});

Deno.test("resolvePixelConfig: legacy default fallback still works for admin preview path", async () => {
  clearEnv();
  const supabase = buildMockSupabase({
    clients: [],
    meta_configurations: [
      {
        is_default: true,
        pixel_id: "PIXEL_DEFAULT",
        access_token: "TOKEN_DEFAULT",
        id: "default-uuid",
      },
    ],
  });

  const result = await resolvePixelConfig(supabase as never, undefined);
  assert(result !== null);
  assertEquals(result!.source, "db:default");
});

Deno.test("dispatchCapiEvent: internal route fields are not forwarded to Meta", async () => {
  const captured: Record<string, unknown>[] = [];
  const original = globalThis.fetch;
  // deno-lint-ignore require-await
  globalThis.fetch = (async (_input, init) => {
    captured.push(JSON.parse(init?.body as string));
    return new Response(JSON.stringify({ events_received: 1 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const internalBody = {
      event_name: "Lead" as const,
      event_id: "meta-strip-1",
      event_source_url: "https://windowman.app",
      action_source: "website" as const,
      route_class: "tenant_required" as const,
      route_reason: "verified_event_client_slug",
      verified_client_slug: "acme",
      client_slug: "acme",
      user_data: { external_id: "abc123" },
    };

    const { metaEvent } = parseInternalRouteContext(internalBody);
    await dispatchCapiEvent(
      metaEvent,
      { pixelId: "1234567890", accessToken: "TOKEN" },
      { clientIp: "1.1.1.1", userAgent: null },
    );

    const eventData =
      (captured[0].data as Array<Record<string, unknown>>)[0];
    assertEquals(eventData.route_class, undefined);
    assertEquals(eventData.route_reason, undefined);
    assertEquals(eventData.verified_client_slug, undefined);
    assertEquals(eventData.client_slug, undefined);
  } finally {
    globalThis.fetch = original;
  }
});

Deno.test("processAuthorizedCapiRequest: sanitized failure does not leak raw Meta response", async () => {
  clearEnv();
  const original = globalThis.fetch;
  // deno-lint-ignore require-await
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        error: {
          code: 100,
          message: "Invalid parameter",
          fbtrace_id: "SECRET_TRACE",
        },
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    )) as typeof fetch;

  try {
    const supabase = buildMockSupabase(baseTables);
    const req = new Request("https://example/functions/v1/capi-event", {
      method: "POST",
      headers: { "user-agent": "test" },
    });

    const res = await processAuthorizedCapiRequest(
      {
        event_name: "Lead",
        event_id: "sanitize-1",
        event_source_url: "https://windowman.app",
        action_source: "website",
        route_class: "tenant_required",
        verified_client_slug: "acme",
        user_data: { external_id: crypto.randomUUID() },
      },
      req,
      supabase as never,
    );

    const body = await res.json();
    assertEquals(body.success, false);
    assertEquals(body.failure_class, "meta_rejected_payload");
    assertEquals(body.error, undefined);
    assertEquals(body.response, undefined);
    assertEquals(String(body).includes("TOKEN_ACME"), false);
    assertEquals(String(body).includes("PIXEL_ACME"), false);
  } finally {
    globalThis.fetch = original;
  }
});

Deno.test("processAuthorizedCapiRequest: dispatch-platform-events style payload succeeds routing", async () => {
  clearEnv();
  const original = globalThis.fetch;
  // deno-lint-ignore require-await
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ events_received: 1 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

  try {
    const supabase = buildMockSupabase(baseTables);
    const req = new Request("https://example/functions/v1/capi-event", {
      method: "POST",
      headers: { Authorization: "Bearer test-service-key" },
    });

    const res = await processAuthorizedCapiRequest(
      {
        event_name: "CompleteRegistration",
        event_id: "worker-1",
        event_source_url: "https://windowman.app",
        action_source: "website",
        client_slug: "acme",
        verified_client_slug: "acme",
        route_class: "tenant_required",
        route_reason: "verified_event_client_slug",
        user_data: {
          em: "a".repeat(64),
          external_id: crypto.randomUUID(),
        },
      } as CAPIEvent & {
        verified_client_slug: string;
        route_class: "tenant_required";
        route_reason: string;
      },
      req,
      supabase as never,
    );

    const body = await res.json();
    assertEquals(body.success, true);
    assertEquals(body.events_received, 1);
    assertEquals(body.pixel_id, undefined);
    assertEquals(body.access_token, undefined);
  } finally {
    globalThis.fetch = original;
  }
});
