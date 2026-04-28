/**
 * diagnoseRoute() preview/dry-run regression suite
 *
 * Locks the contract that the admin preview action depends on:
 *   1. preview reuses resolvePixelConfig() — never a parallel routing brain
 *   2. preview NEVER fires to Meta and NEVER writes to capi_signal_logs
 *   3. every routing outcome carries a deterministic reason enum
 *   4. degraded outcomes list missing_fields the operator must fix
 *
 * If any test here fails, the operator dry-run path can no longer be trusted
 * to predict real controller behavior — fix the regression before deploy.
 *
 * No network. No Supabase. No Meta calls.
 */

import {
  // deno-lint-ignore no-unused-vars
  assert,
  assertArrayIncludes,
  assertEquals,
  // deno-lint-ignore no-import-prefix
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

import { diagnoseRoute } from "./index.ts";

// ── Mock Supabase client ───────────────────────────────────────────────────
// Models the chained query API used by both resolvePixelConfig (uses .single)
// and diagnoseRoute (uses .maybeSingle). Both must be supported.

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
        // deno-lint-ignore require-await
        async maybeSingle() {
          return { data: rows[0] ?? null, error: null };
        },
      };
      return builder;
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

// ── Global send-safety fence ───────────────────────────────────────────────
// diagnoseRoute() must never make outbound HTTP. We monkey-patch fetch for the
// duration of every test and assert it was not called.

let fetchCallCount = 0;
const realFetch = globalThis.fetch;

function installFetchSpy() {
  fetchCallCount = 0;
  globalThis.fetch = ((..._args: unknown[]) => {
    fetchCallCount += 1;
    throw new Error(
      "preview must not perform any fetch — diagnoseRoute called fetch()",
    );
  }) as typeof fetch;
}

function restoreFetch() {
  globalThis.fetch = realFetch;
}

// ── 1. Active client → tier=client, is_send_safe=true ──────────────────────

Deno.test("preview: active client slug resolves to client tier with send-safe flag", async () => {
  clearEnv();
  installFetchSpy();
  try {
    const supabase = buildMockSupabase({
      clients: [{ id: "c1", slug: "acme", is_active: true }],
      meta_configurations: [
        {
          client_id: "c1",
          pixel_id: "PIXEL_ACME",
          access_token: "TOK_ACME",
          test_event_code: null,
        },
        {
          is_default: true,
          id: "d1",
          pixel_id: "PIXEL_DEFAULT",
          access_token: "TOK_DEFAULT",
          test_event_code: null,
        },
      ],
    });

    const d = await diagnoseRoute(supabase as never, "acme");

    assertEquals(d.tier, "client");
    assertEquals(d.resolved, true);
    assertEquals(d.is_send_safe, true);
    assertEquals(d.degraded, false);
    assertEquals(d.uses_default, false);
    assertEquals(d.uses_env_fallback, false);
    assertEquals(d.resolved_pixel_id, "PIXEL_ACME");
    assertEquals(d.source, "client:acme");
    assertArrayIncludes(d.reasons, ["client_resolved"]);
    assertEquals(d.missing_fields.length, 0);
    assertEquals(fetchCallCount, 0, "preview must not call fetch");
  } finally {
    restoreFetch();
  }
});

// ── 2. Unknown slug → tier=default with reason ─────────────────────────────

Deno.test("preview: unknown slug falls through to default tier with explicit reason", async () => {
  clearEnv();
  installFetchSpy();
  try {
    const supabase = buildMockSupabase({
      clients: [],
      meta_configurations: [
        {
          is_default: true,
          id: "d1",
          pixel_id: "PIXEL_DEFAULT",
          access_token: "TOK_DEFAULT",
          test_event_code: null,
        },
      ],
    });

    const d = await diagnoseRoute(supabase as never, "ghost");

    assertEquals(d.tier, "default");
    assertEquals(d.is_send_safe, true);
    assertEquals(d.uses_default, true);
    assertEquals(d.resolved_pixel_id, "PIXEL_DEFAULT");
    assertArrayIncludes(d.reasons, ["client_not_found", "default_resolved"]);
    assertEquals(fetchCallCount, 0);
  } finally {
    restoreFetch();
  }
});

// ── 3. Inactive client → tier=default with client_inactive reason ──────────

Deno.test("preview: inactive client slug yields client_inactive reason and falls to default", async () => {
  clearEnv();
  installFetchSpy();
  try {
    const supabase = buildMockSupabase({
      clients: [{ id: "c1", slug: "acme", is_active: false }],
      meta_configurations: [
        { client_id: "c1", pixel_id: "PIXEL_ACME", access_token: "TOK_ACME" },
        {
          is_default: true,
          id: "d1",
          pixel_id: "PIXEL_DEFAULT",
          access_token: "TOK_DEFAULT",
        },
      ],
    });

    const d = await diagnoseRoute(supabase as never, "acme");

    assertEquals(d.tier, "default");
    assertArrayIncludes(d.reasons, ["client_inactive", "default_resolved"]);
    assertEquals(d.is_send_safe, true);
    assertEquals(fetchCallCount, 0);
  } finally {
    restoreFetch();
  }
});

// ── 4. Malformed client config (no token) → tier=default with reason ───────

Deno.test("preview: client config missing access_token reports client_config_missing_token + missing_fields", async () => {
  clearEnv();
  installFetchSpy();
  try {
    const supabase = buildMockSupabase({
      clients: [{ id: "c1", slug: "acme", is_active: true }],
      meta_configurations: [
        { client_id: "c1", pixel_id: "PIXEL_ACME", access_token: null },
        {
          is_default: true,
          id: "d1",
          pixel_id: "PIXEL_DEFAULT",
          access_token: "TOK_DEFAULT",
        },
      ],
    });

    const d = await diagnoseRoute(supabase as never, "acme");

    assertEquals(d.tier, "default");
    assertArrayIncludes(d.reasons, [
      "client_config_missing_token",
      "default_resolved",
    ]);
    assertArrayIncludes(d.missing_fields, ["meta_configurations.access_token"]);
    assertEquals(fetchCallCount, 0);
  } finally {
    restoreFetch();
  }
});

// ── 5. Missing default → tier=env when env vars set ────────────────────────

Deno.test("preview: missing default row falls through to env tier", async () => {
  clearEnv();
  setEnv("PIXEL_ENV", "TOK_ENV");
  installFetchSpy();
  try {
    const supabase = buildMockSupabase({
      clients: [],
      meta_configurations: [],
    });

    const d = await diagnoseRoute(supabase as never, undefined);

    assertEquals(d.tier, "env");
    assertEquals(d.uses_env_fallback, true);
    assertEquals(d.resolved_pixel_id, "PIXEL_ENV");
    assertArrayIncludes(d.reasons, [
      "client_slug_not_provided",
      "env_resolved",
    ]);
    assertEquals(fetchCallCount, 0);
  } finally {
    restoreFetch();
    clearEnv();
  }
});

// ── 6. Missing default + missing env → tier=degraded, NOT send-safe ────────

Deno.test("preview: no default + no env yields degraded with explicit missing_fields", async () => {
  clearEnv();
  installFetchSpy();
  try {
    const supabase = buildMockSupabase({
      clients: [],
      meta_configurations: [],
    });

    const d = await diagnoseRoute(supabase as never, "ghost");

    assertEquals(d.tier, "degraded");
    assertEquals(d.resolved, false);
    assertEquals(d.is_send_safe, false);
    assertEquals(d.degraded, true);
    assertEquals(d.resolved_pixel_id, null);
    assertArrayIncludes(d.reasons, [
      "client_not_found",
      "default_missing",
      "env_missing",
      "degraded_no_route",
    ]);
    assertArrayIncludes(d.missing_fields, [
      "meta_configurations.is_default_row",
      "env.META_PIXEL_ID",
      "env.META_CAPI_TOKEN",
    ]);
    assertEquals(fetchCallCount, 0);
  } finally {
    restoreFetch();
  }
});

// ── 7. No client_slug + default present → tier=default ─────────────────────

Deno.test("preview: no slug supplied previews the default tier directly", async () => {
  clearEnv();
  installFetchSpy();
  try {
    const supabase = buildMockSupabase({
      clients: [],
      meta_configurations: [
        {
          is_default: true,
          id: "d1",
          pixel_id: "PIXEL_DEFAULT",
          access_token: "TOK_DEFAULT",
        },
      ],
    });

    const d = await diagnoseRoute(supabase as never, undefined);

    assertEquals(d.tier, "default");
    assertEquals(d.client_slug, null);
    assertArrayIncludes(d.reasons, [
      "client_slug_not_provided",
      "default_resolved",
    ]);
    assertEquals(fetchCallCount, 0);
  } finally {
    restoreFetch();
  }
});

// ── 8. Send-safety fence summary — preview never calls fetch ───────────────

Deno.test("preview: diagnoseRoute is hermetic across all tiers (no fetch ever)", async () => {
  clearEnv();
  installFetchSpy();
  try {
    const cases: Array<[string | undefined, MockTables]> = [
      ["acme", {
        clients: [{ id: "c1", slug: "acme", is_active: true }],
        meta_configurations: [{
          client_id: "c1",
          pixel_id: "P",
          access_token: "T",
        }],
      }],
      ["ghost", {
        clients: [],
        meta_configurations: [{
          is_default: true,
          id: "d1",
          pixel_id: "PD",
          access_token: "TD",
        }],
      }],
      [undefined, { clients: [], meta_configurations: [] }],
    ];

    for (const [slug, tables] of cases) {
      const supabase = buildMockSupabase(tables);
      await diagnoseRoute(supabase as never, slug);
    }

    assertEquals(
      fetchCallCount,
      0,
      "preview must remain hermetic — no live Meta call across any tier",
    );
  } finally {
    restoreFetch();
  }
});
