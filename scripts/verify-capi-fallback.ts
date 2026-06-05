/**
 * verify-capi-fallback.ts
 *
 * Wave C internal-auth verification for capi-event.
 *
 * Proves:
 *   1. Anon/publishable callers are rejected (401)
 *   2. Service-role internal calls fail closed without tenant route context
 *   3. tenant_required does not fall back to default DB / env pixels
 *
 * Usage:
 *   npx tsx scripts/verify-capi-fallback.ts
 *
 * Requires: VITE_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY
 *           plus VITE_SUPABASE_PUBLISHABLE_KEY for the anon rejection check.
 */

import * as dotenv from "dotenv";
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  console.error(
    "Missing env vars. Need SUPABASE_URL/VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_PUBLISHABLE_KEY",
  );
  process.exit(1);
}

const FUNC_URL = `${SUPABASE_URL}/functions/v1/capi-event`;

const basePayload = {
  event_name: "PageView",
  event_id: `wave-c-verify-${Date.now()}`,
  event_source_url: "https://windowman.app/qa-internal-auth",
  action_source: "website",
  user_data: { em: "e2e@test.com" },
};

async function assertAnonRejected() {
  console.log("\nStep 1 — Anon caller must be rejected (401)…");
  const res = await fetch(FUNC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({
      ...basePayload,
      client_slug: "direct",
      verified_client_slug: "direct",
      route_class: "tenant_required",
    }),
  });

  const body = await res.json();
  console.log(`   HTTP ${res.status}`, JSON.stringify(body));

  if (res.status !== 401 || body.reason !== "unauthorized") {
    console.error("❌ Expected 401 unauthorized for anon caller");
    process.exit(1);
  }
  console.log("   ✅ Anon caller rejected");
}

async function assertServiceRoleFailClosedWithoutTenantConfig() {
  console.log("\nStep 2 — Service-role without tenant config must fail closed…");
  const res = await fetch(FUNC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({
      ...basePayload,
      event_id: `wave-c-closed-${Date.now()}`,
      route_class: "tenant_required",
      verified_client_slug: "nonexistent-wave-c-slug",
      client_slug: "nonexistent-wave-c-slug",
    }),
  });

  const body = await res.json();
  console.log(`   HTTP ${res.status}`, JSON.stringify(body));

  if (res.status !== 202 || body.degraded !== true) {
    console.error("❌ Expected 202 degraded for missing tenant config");
    process.exit(1);
  }

  if (body.reason !== "tenant_config_missing") {
    console.error(
      `❌ Expected reason tenant_config_missing, got ${body.reason}`,
    );
    process.exit(1);
  }

  if (body.pixel_id || body.access_token || body.response) {
    console.error("❌ Response leaked sensitive fields");
    process.exit(1);
  }

  console.log("   ✅ Service-role fail-closed (no default/env fallback)");
}

async function assertNoDefaultFallbackOnMissingRouteContext() {
  console.log("\nStep 3 — Service-role without slug must fail closed…");
  const res = await fetch(FUNC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({
      ...basePayload,
      event_id: `wave-c-no-slug-${Date.now()}`,
      route_class: "tenant_required",
    }),
  });

  const body = await res.json();
  console.log(`   HTTP ${res.status}`, JSON.stringify(body));

  if (res.status !== 202 || body.reason !== "route_context_missing") {
    console.error("❌ Expected route_context_missing for tenant_required without slug");
    process.exit(1);
  }

  console.log("   ✅ Missing slug rejected before any default fallback");
}

(async () => {
  try {
    await assertAnonRejected();
    await assertServiceRoleFailClosedWithoutTenantConfig();
    await assertNoDefaultFallbackOnMissingRouteContext();
    console.log("\n✅ Wave C capi-event internal auth verification complete.\n");
  } catch (err) {
    console.error("❌ Verification failed:", err);
    process.exit(1);
  }
})();
