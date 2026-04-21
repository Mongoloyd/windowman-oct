/**
 * capi-event end-to-end smoke test.
 *
 * Two modes:
 *
 * 1. LIVE mode (preferred): when CAPI_SMOKE_BASE_URL + CAPI_SMOKE_AUTH_TOKEN
 *    are set in env, this calls the deployed `capi-event` endpoint with a
 *    safe synthetic Lead payload (test event_id + UUID external_id) and
 *    then verifies a corresponding `event_logs` row landed for that lead.
 *
 * 2. SKIP mode: when env vars are absent, the test is reported as ignored.
 *    We deliberately do NOT silently green a non-existent path — operators
 *    must opt in by setting the env vars when they want a real e2e proof.
 *
 * No new endpoint. No parallel CAPI path. Reads `event_logs` directly via
 * the same supabase-js service-role client the existing functions use.
 *
 * Run:
 *   CAPI_SMOKE_BASE_URL=https://<project>.functions.supabase.co \
 *   CAPI_SMOKE_AUTH_TOKEN=<service-role-or-anon-jwt> \
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   deno test --allow-net --allow-env supabase/functions/capi-event/smoke_test.ts
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

function uuid(): string {
  return crypto.randomUUID();
}

const BASE = Deno.env.get("CAPI_SMOKE_BASE_URL");
const AUTH = Deno.env.get("CAPI_SMOKE_AUTH_TOKEN");
const SUPA_URL = Deno.env.get("SUPABASE_URL");
const SUPA_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const liveModeReady = Boolean(BASE && AUTH && SUPA_URL && SUPA_KEY);

Deno.test({
  name: "capi-event smoke: Lead event lands in event_logs (live mode)",
  ignore: !liveModeReady,
  async fn() {
    const externalId = uuid();
    const eventId = `smoke-${externalId}`;
    const payload = {
      event_name: "Lead",
      event_id: eventId,
      event_time: Math.floor(Date.now() / 1000),
      event_source_url: "https://windowman.pro/__smoke__",
      action_source: "website",
      client_slug: "direct",
      user_data: {
        external_id: externalId,
        em: "smoke+test@windowman.pro",
        fbp: `fb.1.${Date.now()}.1234567890`,
      },
      custom_data: { smoke: true },
    };

    const res = await fetch(`${BASE}/functions/v1/capi-event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AUTH}`,
      },
      body: JSON.stringify(payload),
    });

    // capi-event returns 200 on both success and graceful failure paths;
    // we only assert the request was accepted, then verify the side-effect.
    assert(res.status === 200 || res.status === 202, `unexpected status ${res.status}`);

    // Wait briefly for the event_logs insert (capi-event awaits it inline,
    // but Postgres + edge function flush has small latency).
    const supabase = createClient(SUPA_URL!, SUPA_KEY!);
    let row: { event_name: string; lead_id: string | null } | null = null;
    for (let i = 0; i < 10; i++) {
      const { data } = await supabase
        .from("event_logs")
        .select("event_name, lead_id, metadata")
        .eq("lead_id", externalId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        row = data[0] as typeof row;
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    assert(row !== null, "no event_logs row landed for smoke external_id");
    assertEquals(row!.event_name, "capi_lead_dispatched");
    assertEquals(row!.lead_id, externalId);
  },
});

Deno.test({
  name: "capi-event smoke: skipped (no CAPI_SMOKE_BASE_URL)",
  ignore: liveModeReady,
  fn() {
    // Intentionally a no-op marker so CI logs make the skip visible.
    // Set CAPI_SMOKE_BASE_URL + CAPI_SMOKE_AUTH_TOKEN to enable live mode.
    assert(true);
  },
});
