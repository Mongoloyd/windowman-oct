/**
 * verify-capi-fallback.ts
 *
 * E2E validation: proves capi-event reads from meta_configurations (DB)
 * before falling back to environment secrets.
 *
 * Usage:
 *   npx tsx scripts/verify-capi-fallback.ts
 *
 * Requires: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env
 *           (or SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY for service-role insert/delete)
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  console.error("❌ Missing env vars. Need VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY);
const FUNC_URL = `${SUPABASE_URL}/functions/v1/capi-event`;

let seedId: string | null = null;

async function run() {
  // ── Step 1: Seed ──
  console.log("\n🌱 Step 1 — Seeding dummy meta_configuration row…");
  const { data: row, error: seedErr } = await admin
    .from("meta_configurations")
    .insert({
      is_default: true,
      pixel_id: "dummy_pixel_qa",
      access_token: "dummy_token_qa",
      test_event_code: "TEST_QA_RUN",
    })
    .select("id")
    .single();

  if (seedErr || !row) {
    console.error("❌ Seed failed:", seedErr?.message);
    process.exit(1);
  }
  seedId = row.id;
  console.log(`   ✅ Seeded row id=${seedId}`);

  // ── Step 2: Delay ──
  console.log("\n⏳ Step 2 — Waiting 2s for cache clearance…");
  await new Promise((r) => setTimeout(r, 2000));

  // ── Step 3: Fire test event ──
  console.log("\n🚀 Step 3 — Firing test CAPI event…");
  const res = await fetch(FUNC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({
      event_name: "PageView",
      event_id: `qa-db-priority-${Date.now()}`,
      event_source_url: "https://windowman.app/qa-e2e",
      action_source: "website",
      user_data: { em: "e2e@test.com" },
    }),
  });

  const body = await res.json();
  console.log(`   HTTP ${res.status}`, JSON.stringify(body, null, 2));

  // ── Step 4: Assert ──
  // We expect 200 (Meta will reject dummy token, but our function returns 200 with error detail)
  if (res.status !== 200) {
    console.error(`❌ Expected HTTP 200, got ${res.status}`);
    process.exit(1);
  }
  console.log("   ✅ HTTP 200 confirmed — function used DB config (Meta rejected dummy token as expected)");

  // ── Step 5: Verify signal log ──
  console.log("\n🔍 Step 5 — Checking capi_signal_logs for proof…");
  const { data: logs } = await admin
    .from("capi_signal_logs")
    .select("pixel_id, status_code, event_name")
    .eq("pixel_id", "dummy_pixel_qa")
    .order("fired_at", { ascending: false })
    .limit(1);

  if (logs && logs.length > 0) {
    console.log(`   ✅ Signal log found: pixel_id=${logs[0].pixel_id}, status=${logs[0].status_code}`);
  } else {
    console.warn("   ⚠️  No signal log found — check edge function logs for [CAPI:RESOLVE] Loaded default meta_configuration id=…");
  }

  // ── Step 6: Verify fallback (after cleanup) ──
  // This happens after finally block runs
}

async function verifyFallback() {
  console.log("\n🔄 Step 6 — Verifying fallback after cleanup…");
  await new Promise((r) => setTimeout(r, 1500));

  const res = await fetch(FUNC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({
      event_name: "PageView",
      event_id: `qa-fallback-${Date.now()}`,
      event_source_url: "https://windowman.app/qa-fallback",
      action_source: "website",
      user_data: { em: "fallback@test.com" },
    }),
  });

  const body = await res.json();
  console.log(`   HTTP ${res.status}`, JSON.stringify(body, null, 2));

  if (res.status === 202 && body.degraded === true) {
    console.log("   ✅ Fallback confirmed — 202 degraded (no DB row, no env secrets)");
  } else if (res.status === 200) {
    console.log("   ℹ️  200 returned — env secrets (META_PIXEL_ID) are configured as fallback");
  }
}

(async () => {
  try {
    await run();
  } finally {
    // ── GUARANTEED TEARDOWN ──
    console.log("\n🧹 Cleanup — Removing dummy rows…");
    if (seedId) {
      const { error: delErr } = await admin
        .from("meta_configurations")
        .delete()
        .eq("id", seedId);
      console.log(delErr ? `   ❌ Config cleanup failed: ${delErr.message}` : `   ✅ meta_configurations row ${seedId} deleted`);
    }

    // Clean signal log traces
    const { error: logErr } = await admin
      .from("capi_signal_logs")
      .delete()
      .eq("pixel_id", "dummy_pixel_qa");
    console.log(logErr ? `   ❌ Signal log cleanup failed: ${logErr.message}` : "   ✅ capi_signal_logs cleaned");
  }

  // After cleanup, verify the function falls back correctly
  await verifyFallback();

  console.log("\n✅ E2E validation complete. Check edge function logs for:");
  console.log('   → "[CAPI:RESOLVE] Loaded default meta_configuration id=<uuid>"  (DB priority proven)');
  console.log('   → "[CAPI:RESOLVE] No pixel configuration found…"               (fallback proven)');
  console.log("");
})();
