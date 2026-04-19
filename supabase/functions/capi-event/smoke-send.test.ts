/**
 * dispatchCapiEvent() smoke-send regression suite
 *
 * Locks the contract that the admin smoke-send action depends on:
 *   1. dispatcher reuses the SAME payload shape used in production
 *   2. forceTestEventCode (smoke-send) wins over config.testEventCode
 *   3. mode is "test" iff a test_event_code is in play
 *   4. masked_pixel_id never returns the full pixel
 *   5. PII (em, ph, external_id) is hashed before leaving the dispatcher
 *
 * The Meta network call is stubbed via globalThis.fetch — no real outbound
 * traffic is generated. If the dispatcher ever stops routing through fetch
 * (e.g. switches to a worker / batched sender), these tests will alert us
 * before the smoke-send tool silently sends production traffic.
 */

import {
  assertEquals,
  assert,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

import { dispatchCapiEvent, type CAPIEvent } from "./index.ts";

interface CapturedRequest {
  url: string;
  body: Record<string, unknown>;
}

function installFetchSpy(meta: { ok: boolean; status: number; events_received?: number; error?: unknown }) {
  const captured: CapturedRequest[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const body = init?.body ? JSON.parse(init.body as string) : {};
    captured.push({ url, body });
    return new Response(
      JSON.stringify(meta.ok ? { events_received: meta.events_received ?? 1 } : { error: meta.error ?? "rejected" }),
      { status: meta.status, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;
  return {
    captured,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

const baseEvent: CAPIEvent = {
  event_name: "PageView",
  event_id: "wm-smoke-test-1",
  event_source_url: "https://wmmvp.lovable.app/__smoke__",
  action_source: "website",
  client_slug: "acme-windows",
  user_data: {
    external_id: "smoke-acme-windows",
  },
};

Deno.test("dispatchCapiEvent — smoke-send forces test_event_code into payload", async () => {
  const spy = installFetchSpy({ ok: true, status: 200 });
  try {
    const result = await dispatchCapiEvent(
      baseEvent,
      { pixelId: "1234567890123456", accessToken: "EAA_FAKE_TOKEN_VALUE" },
      { clientIp: "1.1.1.1", userAgent: "smoke-runner", forceTestEventCode: "TEST_OVERRIDE" },
    );

    assertEquals(spy.captured.length, 1, "exactly one Meta call");
    assertStringIncludes(spy.captured[0].url, "/1234567890123456/events");
    assertEquals(spy.captured[0].body.test_event_code, "TEST_OVERRIDE");
    assertEquals(result.mode, "test");
    assertEquals(result.test_event_code_used, "TEST_OVERRIDE");
    assertEquals(result.masked_pixel_id, "…3456");
    assertEquals(result.ok, true);
  } finally {
    spy.restore();
  }
});

Deno.test("dispatchCapiEvent — forceTestEventCode WINS over config.testEventCode", async () => {
  const spy = installFetchSpy({ ok: true, status: 200 });
  try {
    await dispatchCapiEvent(
      baseEvent,
      { pixelId: "1111111111", accessToken: "T", testEventCode: "FROM_CONFIG" },
      { clientIp: "0.0.0.0", userAgent: null, forceTestEventCode: "FROM_OPERATOR" },
    );
    assertEquals(spy.captured[0].body.test_event_code, "FROM_OPERATOR");
  } finally {
    spy.restore();
  }
});

Deno.test("dispatchCapiEvent — live mode (no test code) does NOT inject test_event_code", async () => {
  const spy = installFetchSpy({ ok: true, status: 200 });
  try {
    const result = await dispatchCapiEvent(
      baseEvent,
      { pixelId: "9999999999", accessToken: "T" },
      { clientIp: "0.0.0.0", userAgent: null },
    );
    assertEquals(spy.captured[0].body.test_event_code, undefined);
    assertEquals(result.mode, "live");
    assertEquals(result.test_event_code_used, null);
  } finally {
    spy.restore();
  }
});

Deno.test("dispatchCapiEvent — surfaces Meta rejection without throwing", async () => {
  const spy = installFetchSpy({ ok: false, status: 400, error: { message: "invalid pixel" } });
  try {
    const result = await dispatchCapiEvent(
      baseEvent,
      { pixelId: "1234567890", accessToken: "T" },
      { clientIp: "0.0.0.0", userAgent: null, forceTestEventCode: "TEST" },
    );
    assertEquals(result.ok, false);
    assertEquals(result.status, 400);
    assert(result.response, "Meta error body must be returned");
  } finally {
    spy.restore();
  }
});

Deno.test("dispatchCapiEvent — hashes external_id before sending to Meta", async () => {
  const spy = installFetchSpy({ ok: true, status: 200 });
  try {
    await dispatchCapiEvent(
      baseEvent,
      { pixelId: "1234567890", accessToken: "T" },
      { clientIp: "0.0.0.0", userAgent: null, forceTestEventCode: "TEST" },
    );
    const data = (spy.captured[0].body.data as Array<Record<string, unknown>>)[0];
    const userData = data.user_data as Record<string, unknown>;
    const ext = userData.external_id as string;
    // external_id must be a 64-char SHA-256 hex digest, NOT the raw value.
    assertEquals(typeof ext, "string");
    assertEquals(ext.length, 64);
    assert(/^[a-f0-9]{64}$/.test(ext), "external_id must be SHA-256 hex");
    assert(ext !== "smoke-acme-windows", "raw external_id must NOT leak to Meta");
  } finally {
    spy.restore();
  }
});
