/**
 * capi-event multi-pixel routing matrix proof
 *
 * These tests lock the deterministic routing behavior of resolvePixelConfig()
 * so the multi-pixel control plane cannot silently regress. They cover the
 * full operating matrix:
 *
 *   1. Active client slug         → routes to client-specific pixel
 *   2. Unknown client slug        → falls through to default DB row
 *   3. Inactive client slug       → falls through to default DB row
 *   4. Malformed client config    → falls through to default DB row
 *   5. Missing default config     → falls through to env vars
 *   6. Missing default + no env   → returns null (degraded, no-send)
 *   7. Active client + no token   → falls through (treated as malformed)
 *
 * Each test uses a hand-rolled in-memory mock of the Supabase client so the
 * routing logic is exercised without any network, DB, or Meta calls.
 *
 * If any of these tests fail, the multi-pixel control plane is no longer
 * deterministic and the regression must be fixed before deploy.
 *
 * No network. No Supabase. No Meta calls. Pure routing logic only.
 */

import {
  assert,
  assertEquals,
  // deno-lint-ignore no-import-prefix
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

import { resolvePixelConfig } from "./index.ts";

// ── Mock Supabase client ───────────────────────────────────────────────────
//
// Models the chained query API used by resolvePixelConfig:
//   supabase.from(table).select(...).eq(col, val).eq(col, val).single()
//
// Each table is backed by an in-memory array; .eq() filters narrow it down;
// .single() returns { data: row | null }.

type Row = Record<string, unknown>;

interface MockTables {
  clients: Row[];
  meta_configurations: Row[];
}

function buildMockSupabase(tables: MockTables) {
  return {
    from(table: keyof MockTables) {
      let rows = [...tables[table]];
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
      };
      return builder;
    },
  };
}

// Cleanly clear env so env-fallback tier is deterministic.
function clearEnv() {
  Deno.env.delete("META_PIXEL_ID");
  Deno.env.delete("META_CAPI_TOKEN");
  Deno.env.delete("META_TEST_EVENT_CODE");
}

function setEnv(pixelId: string, token: string, testCode?: string) {
  Deno.env.set("META_PIXEL_ID", pixelId);
  Deno.env.set("META_CAPI_TOKEN", token);
  if (testCode) Deno.env.set("META_TEST_EVENT_CODE", testCode);
}

// ── 1. Active client slug → routes to client-specific pixel ────────────────

Deno.test("routing: active client slug routes to client-specific pixel", async () => {
  clearEnv();
  const supabase = buildMockSupabase({
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
  });

  const result = await resolvePixelConfig(supabase as never, "acme");

  assert(result !== null, "expected resolved config, got null");
  assertEquals(result!.pixelId, "PIXEL_ACME_123");
  assertEquals(result!.accessToken, "TOKEN_ACME");
  assertEquals(result!.source, "client:acme");
});

// ── 2. Unknown client slug → falls through to default DB row ───────────────

Deno.test("routing: unknown client slug falls through to default DB row", async () => {
  clearEnv();
  const supabase = buildMockSupabase({
    clients: [{ id: "client-uuid-1", slug: "acme", is_active: true }],
    meta_configurations: [
      {
        is_default: true,
        pixel_id: "PIXEL_DEFAULT",
        access_token: "TOKEN_DEFAULT",
        test_event_code: null,
        id: "default-uuid",
      },
    ],
  });

  const result = await resolvePixelConfig(supabase as never, "ghost-client");

  assert(result !== null, "expected fallback to default, got null");
  assertEquals(result!.pixelId, "PIXEL_DEFAULT");
  assertEquals(result!.source, "db:default");
});

// ── 3. Inactive client slug → falls through to default DB row ──────────────

Deno.test("routing: inactive client slug falls through to default DB row", async () => {
  clearEnv();
  const supabase = buildMockSupabase({
    // is_active=false should be filtered out by the .eq("is_active", true) clause
    clients: [{ id: "client-uuid-1", slug: "acme", is_active: false }],
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
  });

  const result = await resolvePixelConfig(supabase as never, "acme");

  assert(result !== null, "expected fallback to default, got null");
  assertEquals(result!.pixelId, "PIXEL_DEFAULT");
  assertEquals(result!.source, "db:default");
});

// ── 4. Malformed client config (missing token) → falls through ─────────────

Deno.test("routing: malformed client config (no access_token) falls through to default", async () => {
  clearEnv();
  const supabase = buildMockSupabase({
    clients: [{ id: "client-uuid-1", slug: "acme", is_active: true }],
    meta_configurations: [
      {
        client_id: "client-uuid-1",
        pixel_id: "PIXEL_ACME_123",
        access_token: null, // ← malformed
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
  });

  const result = await resolvePixelConfig(supabase as never, "acme");

  assert(result !== null, "expected fallback to default, got null");
  assertEquals(result!.pixelId, "PIXEL_DEFAULT");
  assertEquals(result!.source, "db:default");
});

Deno.test("routing: malformed client config (no pixel_id) falls through to default", async () => {
  clearEnv();
  const supabase = buildMockSupabase({
    clients: [{ id: "client-uuid-1", slug: "acme", is_active: true }],
    meta_configurations: [
      {
        client_id: "client-uuid-1",
        pixel_id: null, // ← malformed
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
  });

  const result = await resolvePixelConfig(supabase as never, "acme");

  assert(result !== null, "expected fallback to default, got null");
  assertEquals(result!.pixelId, "PIXEL_DEFAULT");
  assertEquals(result!.source, "db:default");
});

// ── 5. Missing default config → falls through to env vars ──────────────────

Deno.test("routing: missing default DB row falls through to env vars", async () => {
  setEnv("PIXEL_ENV_FALLBACK", "TOKEN_ENV", "TEST_ENV_CODE");
  const supabase = buildMockSupabase({
    clients: [],
    meta_configurations: [], // no default row at all
  });

  const result = await resolvePixelConfig(supabase as never, undefined);

  assert(result !== null, "expected env fallback, got null");
  assertEquals(result!.pixelId, "PIXEL_ENV_FALLBACK");
  assertEquals(result!.accessToken, "TOKEN_ENV");
  assertEquals(result!.testEventCode, "TEST_ENV_CODE");
  assertEquals(result!.source, "env:fallback");

  clearEnv();
});

// ── 6. Missing default + no env → returns null (degraded, no-send) ─────────

Deno.test("routing: missing default DB row AND no env vars returns null (degraded)", async () => {
  clearEnv();
  const supabase = buildMockSupabase({
    clients: [],
    meta_configurations: [],
  });

  const result = await resolvePixelConfig(supabase as never, undefined);

  assertEquals(result, null);
});

Deno.test("routing: unknown client + missing default + no env returns null (degraded)", async () => {
  clearEnv();
  const supabase = buildMockSupabase({
    clients: [],
    meta_configurations: [],
  });

  const result = await resolvePixelConfig(supabase as never, "ghost-client");

  assertEquals(result, null);
});

// ── 7. No client slug provided → goes straight to default DB row ───────────

Deno.test("routing: no clientSlug provided routes directly to default DB row", async () => {
  clearEnv();
  const supabase = buildMockSupabase({
    clients: [],
    meta_configurations: [
      {
        is_default: true,
        pixel_id: "PIXEL_DEFAULT",
        access_token: "TOKEN_DEFAULT",
        test_event_code: "TEST_DEFAULT",
        id: "default-uuid",
      },
    ],
  });

  const result = await resolvePixelConfig(supabase as never, undefined);

  assert(result !== null);
  assertEquals(result!.pixelId, "PIXEL_DEFAULT");
  assertEquals(result!.testEventCode, "TEST_DEFAULT");
  assertEquals(result!.source, "db:default");
});

// ── 8. test_event_code is propagated when present ──────────────────────────

Deno.test("routing: test_event_code from client-specific config is propagated", async () => {
  clearEnv();
  const supabase = buildMockSupabase({
    clients: [{ id: "client-uuid-1", slug: "acme", is_active: true }],
    meta_configurations: [
      {
        client_id: "client-uuid-1",
        pixel_id: "PIXEL_ACME_123",
        access_token: "TOKEN_ACME",
        test_event_code: "TEST_ACME_QA",
      },
    ],
  });

  const result = await resolvePixelConfig(supabase as never, "acme");

  assert(result !== null);
  assertEquals(result!.testEventCode, "TEST_ACME_QA");
  assertEquals(result!.source, "client:acme");
});

// ── 9. Env-tier requires BOTH pixel_id and token to resolve ────────────────

Deno.test("routing: env tier with only META_PIXEL_ID set returns null (degraded)", async () => {
  clearEnv();
  Deno.env.set("META_PIXEL_ID", "PIXEL_ENV_ONLY");
  // Intentionally no META_CAPI_TOKEN

  const supabase = buildMockSupabase({
    clients: [],
    meta_configurations: [],
  });

  const result = await resolvePixelConfig(supabase as never, undefined);

  assertEquals(result, null, "env tier must require BOTH pixel_id AND token");

  clearEnv();
});
