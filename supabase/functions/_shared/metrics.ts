/**
 * _shared/metrics.ts — Shared financial metric utilities.
 *
 * Pure functions only. Zero external dependencies. Zero side effects.
 * Used by: scan-quote, calculate-estimate-metrics.
 *
 * ⚠️  DO NOT add Supabase, Gemini, Twilio, or any I/O dependencies here.
 * This file must remain a leaf-level utility module.
 */

import { getCountyBenchmark } from "./countyBenchmarks.ts";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type ItemBucket =
  | "window"
  | "door"
  | "screen"
  | "install"
  | "permit"
  | "trim"
  | "demo"
  | "discount"
  | "tax"
  | "other";

export interface MetricLineItem {
  description?: string;
  quantity?: number | null;
  unit_price?: number | null;
  total_price?: number | null;
  brand?: string | null;
  series?: string | null;
  dp_rating?: string | null;
  noa_number?: string | null;
  dimensions?: string | null;
}

export interface DerivedMetricsExtraction {
  line_items?: MetricLineItem[];
  opening_count?: number | null;
  total_quoted_price?: number | null;
  installation?: { scope_detail?: string | null } | null;
  permits?: { included?: boolean | null } | null;
  warranty?: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════════
// NUMERIC HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

export function n(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^0-9.\-]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function round2(v: number | null): number | null {
  if (v === null || !Number.isFinite(v)) return null;
  return Math.round(v * 100) / 100;
}

export function safeDiv(num: number | null, den: number | null): number | null {
  if (num === null || den === null || den <= 0) return null;
  return round2(num / den);
}

export function pct(num: number, den: number): number | null {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return null;
  return round2((num / den) * 100);
}

export function median(values: number[]): number | null {
  const clean = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!clean.length) return null;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 === 0
    ? round2((clean[mid - 1] + clean[mid]) / 2)
    : round2(clean[mid]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// LINE ITEM CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

const FIXED_FEE_NEGATIVE =
  /\bfixed\s+(?:fee|fees|cost|charge|charges|rate|rates|amount|disposal|labor)\b|\b(?:fee|fees|charge|charges|cost)\s+(?:is\s+)?fixed\b|\bfixed\s+(?:disposal|labor)\s+(?:fee|charge|cost)\b/;

const FIXED_WINDOW_PRODUCT_CONTEXT =
  /\b(?:window|w(?:in)?guard|pgt|impact|glass|vinyl|aluminum|series|\d{2,4}\s*[x×]\s*\d|single\s+hung|double\s+hung|casement|awning|slider|hung|panel)\b/;

/** Context-aware fixed-window detection — not lazy `includes("fixed")`. */
export function isFixedWindowProductDescription(description: string): boolean {
  const d = description.toLowerCase().trim();
  if (!d || FIXED_FEE_NEGATIVE.test(d)) return false;
  if (/\bfixed\s+(?:window|glass)\b/.test(d)) return true;
  if (/\b(?:picture|fixed)\s*[/\-]\s*(?:fixed|picture)\b/.test(d)) return true;
  if (!/\bfixed\b/.test(d)) return false;
  return FIXED_WINDOW_PRODUCT_CONTEXT.test(d);
}

export function classifyLineItem(description?: string): ItemBucket {
  const d = (description ?? "").toLowerCase().trim();
  if (!d) return "other";

  if (/\bdiscount\b|\bcredit\b|\brebate\b/.test(d)) return "discount";
  if (/\btax\b|\bsales tax\b/.test(d)) return "tax";
  if (/\bpermit\b/.test(d)) return "permit";
  if (
    /\binstall\b|\blabor\b|\binstallation\b|\bcaulk\b|\bseal\b|\bfoam\b/.test(d)
  ) return "install";
  if (
    /\bdemo\b|\bremove\b|\bremoval\b|\bdisposal\b|\bhaul\b|\bcleanup\b/.test(d)
  ) return "demo";
  if (/\btrim\b|\bstucco\b|\bflashing\b|\bwrap\b|\bwood\b/.test(d)) {
    return "trim";
  }
  if (/\bscreen\b|\bmesh\b/.test(d)) return "screen";
  if (/\bdoor\b|\bslider\b|\bentry\b|\bfrench\b/.test(d)) return "door";
  if (isFixedWindowProductDescription(d)) return "window";
  if (
    /\bwindow\b|\bsingle hung\b|\bdouble hung\b|\bcasement\b|\bpicture\b|\bawning\b/
      .test(d)
  ) return "window";

  return "other";
}

export function isCoreOpening(bucket: ItemBucket): boolean {
  return bucket === "window" || bucket === "door";
}

export function itemQuantity(item: MetricLineItem, bucket: ItemBucket): number {
  const q = n(item.quantity);
  if (q !== null && q > 0) return q;
  if (isCoreOpening(bucket)) return 1;
  return 0;
}

export function itemExtendedPrice(item: MetricLineItem): number | null {
  const total = n(item.total_price);
  if (total !== null) return total;
  const unit = n(item.unit_price);
  const qty = n(item.quantity);
  if (unit !== null && qty !== null && qty > 0) return round2(unit * qty);
  return null;
}

function compareToCountyBenchmark(
  countyInput: string | null | undefined,
  installedPricePerOpening: number | null,
  contractPricePerOpening: number | null,
  doorOpenings: number,
) {
  const benchmark = getCountyBenchmark(countyInput);
  const comparablePrice = installedPricePerOpening ?? contractPricePerOpening;

  if (comparablePrice === null) {
    return {
      county_key: benchmark.county_key,
      county_label: benchmark.county_label,
      benchmark_available: true,
      comparison_available: false,
      benchmark_price_per_opening_low:
        benchmark.installed_price_per_opening_low,
      benchmark_price_per_opening_avg:
        benchmark.installed_price_per_opening_avg,
      benchmark_price_per_opening_high:
        benchmark.installed_price_per_opening_high,
      source_type: benchmark.source_type,
      source_label: benchmark.source_label,
      updated_at: benchmark.updated_at,
      status: "insufficient_data" as const,
      compared_metric: null,
      compared_value: null,
      delta_amount: null,
      delta_pct: null,
      comparability: doorOpenings > 0
        ? "approximate_mixed_openings" as const
        : "direct_window_proxy" as const,
    };
  }

  const deltaAmount = round2(
    comparablePrice - benchmark.installed_price_per_opening_avg,
  );
  const deltaPct = benchmark.installed_price_per_opening_avg > 0
    ? round2(
      ((deltaAmount ?? 0) / benchmark.installed_price_per_opening_avg) * 100,
    )
    : null;

  const status = comparablePrice < benchmark.installed_price_per_opening_low
    ? "below_county_range" as const
    : comparablePrice > benchmark.installed_price_per_opening_high
    ? "above_county_range" as const
    : "within_county_range" as const;

  return {
    county_key: benchmark.county_key,
    county_label: benchmark.county_label,
    benchmark_available: true,
    comparison_available: true,
    benchmark_price_per_opening_low: benchmark.installed_price_per_opening_low,
    benchmark_price_per_opening_avg: benchmark.installed_price_per_opening_avg,
    benchmark_price_per_opening_high:
      benchmark.installed_price_per_opening_high,
    source_type: benchmark.source_type,
    source_label: benchmark.source_label,
    updated_at: benchmark.updated_at,
    compared_metric: installedPricePerOpening !== null
      ? "installed_price_per_opening"
      : "contract_price_per_opening",
    compared_value: comparablePrice,
    status,
    delta_amount: deltaAmount,
    delta_pct: deltaPct,
    comparability: doorOpenings > 0
      ? "approximate_mixed_openings" as const
      : "direct_window_proxy" as const,
  };
}

/**
 * Deterministic financial breakdown from extraction — canonical money buckets + PPO.
 * Homeowner-facing PPO denominators prefer validated header/extracted opening counts.
 */
export function computeDerivedMetrics(
  data: DerivedMetricsExtraction,
  countyName?: string | null,
): Record<string, unknown> {
  const items = Array.isArray(data.line_items) ? data.line_items : [];
  const warnings: string[] = [];

  const contractTotal = n(data.total_quoted_price) ??
    round2(
      items.reduce((sum, item) => sum + (itemExtendedPrice(item) ?? 0), 0),
    );

  const bucketTotals: Record<ItemBucket, number> = {
    window: 0,
    door: 0,
    screen: 0,
    install: 0,
    permit: 0,
    trim: 0,
    demo: 0,
    discount: 0,
    tax: 0,
    other: 0,
  };
  const bucketQty: Record<ItemBucket, number> = {
    window: 0,
    door: 0,
    screen: 0,
    install: 0,
    permit: 0,
    trim: 0,
    demo: 0,
    discount: 0,
    tax: 0,
    other: 0,
  };
  const coreLinePrices: number[] = [];
  let pricedLines = 0,
    brandKnownCore = 0,
    dpKnownCore = 0,
    noaKnownCore = 0,
    coreLines = 0;

  for (const item of items) {
    const bucket = classifyLineItem(item.description);
    const qty = itemQuantity(item, bucket);
    const ext = itemExtendedPrice(item);
    bucketQty[bucket] += qty;
    if (ext !== null) {
      bucketTotals[bucket] += ext;
      pricedLines += 1;
      if (isCoreOpening(bucket)) coreLinePrices.push(ext);
    }
    if (isCoreOpening(bucket)) {
      coreLines += 1;
      if ((item.brand ?? "").trim() || (item.series ?? "").trim()) {
        brandKnownCore += 1;
      }
      if ((item.dp_rating ?? "").trim()) dpKnownCore += 1;
      if ((item.noa_number ?? "").trim()) noaKnownCore += 1;
    }
  }

  const inferredCoreOpenings = bucketQty.window + bucketQty.door;
  const extractedOpenings = n(data.opening_count);
  const totalOpenings = (extractedOpenings && extractedOpenings > 0)
    ? extractedOpenings
    : inferredCoreOpenings > 0
    ? inferredCoreOpenings
    : null;
  const openingCountSource = (extractedOpenings && extractedOpenings > 0)
    ? "extracted_header"
    : inferredCoreOpenings > 0
    ? "inferred_from_lines"
    : "unknown";

  if (
    extractedOpenings && extractedOpenings > 0 && inferredCoreOpenings > 0 &&
    extractedOpenings !== inferredCoreOpenings
  ) {
    warnings.push(
      `Opening count mismatch: extracted=${extractedOpenings}, inferred_from_lines=${inferredCoreOpenings}`,
    );
  }

  // Homeowner-facing PPO uses validated total openings, not a smaller inferred count.
  const ppoDenominator = totalOpenings;

  const coreProductSubtotal = round2(
    bucketTotals.window + bucketTotals.door,
  );
  const installLikeSubtotal = round2(
    bucketTotals.install + bucketTotals.trim + bucketTotals.demo +
      bucketTotals.permit,
  );
  const accessorySubtotal = round2(
    bucketTotals.screen + bucketTotals.other,
  );
  const discountSubtotal = round2(Math.abs(bucketTotals.discount));
  const taxSubtotal = round2(bucketTotals.tax);

  const contractPPO = safeDiv(contractTotal, ppoDenominator);
  const coreProductPPO = safeDiv(coreProductSubtotal, ppoDenominator);

  const installedNumerator = round2(
    (coreProductSubtotal ?? 0) + (installLikeSubtotal ?? 0) -
      (discountSubtotal ?? 0),
  );
  const hasExplicitInstallLikeBuckets = (installLikeSubtotal ?? 0) > 0;

  let installedPPO: number | null = null;
  if (hasExplicitInstallLikeBuckets && ppoDenominator) {
    installedPPO = safeDiv(installedNumerator, ppoDenominator);
  } else if (contractPPO !== null) {
    installedPPO = contractPPO;
    warnings.push(
      "installed_ppo_fell_back_to_contract_total_due_to_missing_install_buckets",
    );
  }

  if (items.length > 0 && pricedLines / items.length < 0.7) {
    warnings.push(
      "Low pricing coverage: many line items are missing unit_price and total_price.",
    );
  }
  if (
    contractTotal !== null && accessorySubtotal !== null && contractTotal > 0 &&
    accessorySubtotal / contractTotal > 0.25
  ) {
    warnings.push(
      "A large share of the estimate appears to be non-core/accessory cost.",
    );
  }
  if (totalOpenings === null || totalOpenings <= 0) {
    warnings.push(
      "Unable to compute per-opening metrics because opening_count could not be determined.",
    );
  }

  const highestPricedOpening = coreLinePrices.length
    ? round2(Math.max(...coreLinePrices))
    : null;
  const lowestPricedOpening = coreLinePrices.length
    ? round2(Math.min(...coreLinePrices))
    : null;

  let quoteMathConfidence = 100;
  if (!contractTotal || contractTotal <= 0) quoteMathConfidence -= 35;
  if (!totalOpenings || totalOpenings <= 0) quoteMathConfidence -= 35;
  if (items.length > 0 && pricedLines / items.length < 0.7) {
    quoteMathConfidence -= 15;
  }
  if (
    extractedOpenings && inferredCoreOpenings > 0 &&
    extractedOpenings !== inferredCoreOpenings
  ) quoteMathConfidence -= 15;
  quoteMathConfidence = Math.max(0, Math.min(100, quoteMathConfidence));

  return {
    totals: {
      contract_total: round2(contractTotal),
      core_product_subtotal: coreProductSubtotal,
      install_like_subtotal: installLikeSubtotal,
      accessory_subtotal: accessorySubtotal,
      discount_subtotal: discountSubtotal,
      tax_subtotal: taxSubtotal,
    },
    counts: {
      total_openings: totalOpenings,
      opening_count_source: openingCountSource,
      inferred_core_openings: inferredCoreOpenings || null,
      window_openings: bucketQty.window || null,
      door_openings: bucketQty.door || null,
      total_line_items: items.length,
      priced_line_items: pricedLines,
    },
    per_opening: {
      contract_price_per_opening: contractPPO,
      core_product_price_per_opening: coreProductPPO,
      installed_price_per_opening: installedPPO,
      non_core_cost_per_opening: safeDiv(
        round2((contractTotal ?? 0) - (coreProductSubtotal ?? 0)),
        ppoDenominator,
      ),
    },
    unit_pricing: {
      window_avg_unit_price: safeDiv(
        bucketTotals.window,
        bucketQty.window || null,
      ),
      door_avg_unit_price: safeDiv(
        bucketTotals.door,
        bucketQty.door || null,
      ),
      median_core_line_price: median(coreLinePrices),
      highest_priced_opening: highestPricedOpening,
      lowest_priced_opening: lowestPricedOpening,
      price_spread_ratio:
        (highestPricedOpening !== null && lowestPricedOpening !== null &&
            lowestPricedOpening > 0)
          ? round2(highestPricedOpening / lowestPricedOpening)
          : null,
    },
    shares: {
      install_cost_share_pct: contractTotal
        ? pct(installLikeSubtotal ?? 0, contractTotal)
        : null,
      accessory_cost_share_pct: contractTotal
        ? pct(accessorySubtotal ?? 0, contractTotal)
        : null,
      permit_cost_share_pct: contractTotal
        ? pct(bucketTotals.permit, contractTotal)
        : null,
      discount_share_pct: contractTotal
        ? pct(discountSubtotal ?? 0, contractTotal)
        : null,
      tax_share_pct: contractTotal
        ? pct(taxSubtotal ?? 0, contractTotal)
        : null,
    },
    coverage: {
      priced_line_coverage_pct: items.length
        ? pct(pricedLines, items.length)
        : null,
      brand_coverage_pct: coreLines
        ? pct(brandKnownCore, coreLines)
        : null,
      dp_coverage_pct: coreLines ? pct(dpKnownCore, coreLines) : null,
      noa_coverage_pct: coreLines ? pct(noaKnownCore, coreLines) : null,
    },
    trust_signals: {
      scope_present: Boolean(data.installation?.scope_detail),
      permit_stated: data.permits?.included !== undefined &&
        data.permits?.included !== null,
      warranty_present: Boolean(data.warranty),
    },
    county_benchmark: compareToCountyBenchmark(
      countyName ?? null,
      installedPPO,
      contractPPO,
      bucketQty.door,
    ),
    diagnostics: { quote_math_confidence: quoteMathConfidence, warnings },
  };
}
