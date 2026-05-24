import {
  assert,
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  classifyLineItem,
  computeDerivedMetrics,
  isFixedWindowProductDescription,
} from "./metrics.ts";

const SAMPLE_C_LINE_ITEMS = [
  {
    description: "PGT WinGuard 4500 Single Hung",
    quantity: 4,
    unit_price: 1260,
    total_price: 5040,
  },
  {
    description: "PGT WinGuard 4500 Fixed",
    quantity: 2,
    unit_price: 1090,
    total_price: 2180,
  },
  {
    description: "PGT WinGuard 5500 3-Panel Sliding Glass Door",
    quantity: 1,
    unit_price: 5800,
    total_price: 5800,
  },
];

function sampleCExtraction() {
  return {
    line_items: SAMPLE_C_LINE_ITEMS,
    opening_count: 7,
    total_quoted_price: 16381.4,
  };
}

Deno.test("Sample C: fixed-window row classifies as window, not accessory", () => {
  assertEquals(
    classifyLineItem("PGT WinGuard 4500 Fixed"),
    "window",
  );
  assert(isFixedWindowProductDescription("PGT WinGuard 4500 Fixed"));
});

Deno.test("Sample C: fixed fee rows are not classified as windows", () => {
  assertEquals(classifyLineItem("Fixed disposal fee"), "demo");
  assertEquals(classifyLineItem("Fixed labor charge"), "install");
  assertEquals(classifyLineItem("One-time fixed fee"), "other");
  assertEquals(isFixedWindowProductDescription("Fixed disposal fee"), false);
});

Deno.test("Sample C: sliding glass door remains a core door opening", () => {
  assertEquals(
    classifyLineItem("PGT WinGuard 5500 3-Panel Sliding Glass Door"),
    "door",
  );
});

Deno.test("Sample C: derived money buckets and PPO basis", () => {
  const derived = computeDerivedMetrics(sampleCExtraction());
  const totals = derived.totals as Record<string, number | null>;
  const counts = derived.counts as Record<string, number | null>;
  const perOpening = derived.per_opening as Record<string, number | null>;
  const diagnostics = derived.diagnostics as {
    warnings: string[];
  };

  assertEquals(totals.core_product_subtotal, 13020);
  assertEquals(totals.accessory_subtotal, 0);
  assertEquals(totals.install_like_subtotal, 0);
  assertEquals(totals.contract_total, 16381.4);
  assertEquals(counts.total_openings, 7);
  assertEquals(counts.inferred_core_openings, 7);
  assertEquals(counts.window_openings, 6);
  assertEquals(counts.door_openings, 1);

  assertEquals(perOpening.core_product_price_per_opening, 1860);
  assertNotEquals(perOpening.core_product_price_per_opening, 2168);
  assertEquals(perOpening.contract_price_per_opening, 2340.2);
  assertNotEquals(perOpening.installed_price_per_opening, 2168);
  assertEquals(perOpening.installed_price_per_opening, 2340.2);

  assert(
    diagnostics.warnings.includes(
      "installed_ppo_fell_back_to_contract_total_due_to_missing_install_buckets",
    ),
  );

  const topLevelPpo = perOpening.installed_price_per_opening;
  assertNotEquals(topLevelPpo, 2168);
  assertEquals(topLevelPpo, 2340.2);

  for (const value of Object.values(perOpening)) {
    if (value !== null) {
      assert(Number.isFinite(value), "PPO values must be finite");
    }
  }
});
