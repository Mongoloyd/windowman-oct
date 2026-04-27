/**
 * calculate-estimate-metrics — Derived financial metrics from OCR extraction.
 *
 * Pipeline position: after AI extraction, before report rendering.
 * Deterministic TypeScript math — no AI inference.
 *
 * POST { extraction: ExtractionResult }
 * Returns { ok: true, metrics: DerivedMetrics }
 */

// ── CORS ─────────────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── V2.0 SCHEMA ENUMS & TYPES ────────────────────────────────────────────────
const PRODUCT_SUB_TYPES = [
  "Single Hung", "Double Hung", "Casement", "Sliding Glass Door",
  "French Door", "Picture Window", "Architectural Shape",
  "Generic Window", "Generic Door", "Unknown"
] as const;

type ProductSubTypeEnum = typeof PRODUCT_SUB_TYPES[number];

// ── Types ────────────────────────────────────────────────────────────────────
type NullableNumber = number | null | undefined;

interface LineItem {
  description?: string;
  quantity?: NullableNumber;
  unit_price?: NullableNumber;
  total_price?: NullableNumber;
  brand?: string | null;
  series?: string | null;
  dp_rating?: string | null;
  noa_number?: string | null;
  dimensions?: string | null;
}

interface ExtractionResult {
  total_quoted_price?: NullableNumber;
  opening_count?: NullableNumber;
  line_items?: LineItem[];
  permits?: {
    included?: boolean | null;
    responsible_party?: string | null;
    details?: string | null;
  } | null;
  installation?: {
    scope_detail?: string | null;
    disposal_included?: boolean | null;
    accessories_mentioned?: boolean | null;
  } | null;
  warranty?: {
    labor_years?: NullableNumber;
    manufacturer_years?: NullableNumber;
    transferable?: boolean | null;
    details?: string | null;
  } | null;
}

type ItemBucket =
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

// ── Numeric helpers ──────────────────────────────────────────────────────────
function n(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^0-9.\-]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function round2(v: number | null): number | null {
  if (v === null || !Number.isFinite(v)) return null;
  return Math.round(v * 100) / 100;
}

function safeDiv(num: number | null, den: number | null): number | null {
  if (num === null || den === null || den <= 0) return null;
  return round2(num / den);
}

function pct(num: number, den: number): number | null {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return null;
  return round2((num / den) * 100);
}

function median(values: number[]): number | null {
  const clean = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!clean.length) return null;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 === 0
    ? round2((clean[mid - 1] + clean[mid]) / 2)
    : round2(clean[mid]);
}

// ── V2.0 Line Item Granular Classification ───────────────────────────────────
function classifyProductV2(desc: string): ProductSubTypeEnum {
  const lowDesc = desc.toLowerCase();
  if (lowDesc.includes("single hung")) return "Single Hung";
  if (lowDesc.includes("double hung")) return "Double Hung";
  if (lowDesc.includes("casement")) return "Casement";
  if (lowDesc.includes("sliding glass") || lowDesc.includes("sgd")) return "Sliding Glass Door";
  if (lowDesc.includes("french door")) return "French Door";
  if (lowDesc.includes("picture") || lowDesc.includes("fixed")) return "Picture Window";
  if (lowDesc.includes("shape") || lowDesc.includes("arch")) return "Architectural Shape";
  if (lowDesc.includes("window")) return "Generic Window";
  if (lowDesc.includes("door")) return "Generic Door";
  return "Unknown";
}

function aggregateBrandV2(desc: string, existingBrand: string | null): string | null {
  if (existingBrand) return existingBrand;
  const knownBrands = ["PGT", "CGI", "ESW", "Andersen", "Pella", "WinDoor", "CWS"];
  const lowDesc = desc.toLowerCase();
  return knownBrands.find(b => lowDesc.includes(b.toLowerCase())) || null;
}

// ── Legacy Line item classification ──────────────────────────────────────────
function classifyItem(description?: string): ItemBucket {
  const d = (description ?? "").toLowerCase().trim();
  if (!d) return "other";

  if (/\bdiscount\b|\bcredit\b|\brebate\b/.test(d)) return "discount";
  if (/\btax\b|\bsales tax\b/.test(d)) return "tax";
  if (/\bpermit\b/.test(d)) return "permit";
  if (
    /\binstall\b|\blabor\b|\binstallation\b|\bcaulk\b|\bseal\b|\bfoam\b/.test(d)
  )
    return "install";
  if (
    /\bdemo\b|\bremove\b|\bremoval\b|\bdisposal\b|\bhaul\b|\bcleanup\b/.test(d)
  )
    return "demo";
  if (/\btrim\b|\bstucco\b|\bflashing\b|\bwrap\b|\bwood\b/.test(d))
    return "trim";
  if (/\bscreen\b|\bmesh\b/.test(d)) return "screen";
  if (/\bdoor\b|\bslider\b|\bentry\b|\bfrench\b/.test(d)) return "door";
  if (
    /\bwindow\b|\bsingle hung\b|\bdouble hung\b|\bcasement\b|\bpicture\b|\bawning\b/.test(
      d,
    )
  )
    return "window";

  return "other";
}

function isCoreOpening(bucket: ItemBucket): boolean {
  return bucket === "window" || bucket === "door";
}

function itemQuantity(item: LineItem, bucket: ItemBucket): number {
  const q = n(item.quantity);
  if (q !== null && q > 0) return q;
  // Core opening line with no quantity → count as 1
  if (isCoreOpening(bucket)) return 1;
  return 0;
}

function itemExtendedPrice(item: LineItem): number | null {
  const total = n(item.total_price);
  if (total !== null) return total;
  const unit = n(item.unit_price);
  const qty = n(item.quantity);
  if (unit !== null && qty !== null && qty > 0) return round2(unit * qty);
  return null;
}

// ── Core metric derivation ───────────────────────────────────────────────────
function deriveMetrics(data: ExtractionResult) {
  const items = Array.isArray(data.line_items) ? data.line_items : [];
  const warnings: string[] = [];

  // ── Contract total ─────────────────────────────────────────────────────
  const contractTotal =
    n(data.total_quoted_price) ??
    round2(
      items.reduce((sum, item) => {
        const ext = itemExtendedPrice(item);
        return sum + (ext ?? 0);
      }, 0),
    );

  // ── Bucketing ──────────────────────────────────────────────────────────
  const bucketTotals: Record<ItemBucket, number> = {
    window: 0, door: 0, screen: 0, install: 0, permit: 0,
    trim: 0, demo: 0, discount: 0, tax: 0, other: 0,
  };
  const bucketQty: Record<ItemBucket, number> = {
    window: 0, door: 0, screen: 0, install: 0, permit: 0,
    trim: 0, demo: 0, discount: 0, tax: 0, other: 0,
  };

  const coreLinePrices: number[] = [];
  const windowUnitPrices: number[] = [];
  const doorUnitPrices: number[] = [];
  let pricedLines = 0;
  let brandKnownCore = 0;
  let dpKnownCore = 0;
  let noaKnownCore = 0;
  let coreLines = 0;

  for (const item of items) {
    const bucket = classifyItem(item.description);
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
      if ((item.brand ?? "").trim() || (item.series ?? "").trim())
        brandKnownCore += 1;
      if ((item.dp_rating ?? "").trim()) dpKnownCore += 1;
      if ((item.noa_number ?? "").trim()) noaKnownCore += 1;

      const unit = n(item.unit_price);
      if (unit !== null) {
        if (bucket === "window") windowUnitPrices.push(unit);
        if (bucket === "door") doorUnitPrices.push(unit);
      }
    }
  }

  // ── Opening counts ─────────────────────────────────────────────────────
  const inferredCoreOpenings = bucketQty.window + bucketQty.door;
  const extractedOpenings = n(data.opening_count);
  const totalOpenings =
    extractedOpenings && extractedOpenings > 0
      ? extractedOpenings
      : inferredCoreOpenings > 0
        ? inferredCoreOpenings
        : null;

  const openingCountSource =
    extractedOpenings && extractedOpenings > 0
      ? "extracted_header"
      : inferredCoreOpenings > 0
        ? "inferred_from_lines"
        : "unknown";

  if (
    extractedOpenings &&
    extractedOpenings > 0 &&
    inferredCoreOpenings > 0 &&
    extractedOpenings !== inferredCoreOpenings
  ) {
    warnings.push(
      `Opening count mismatch: extracted=${extractedOpenings}, inferred_from_lines=${inferredCoreOpenings}`,
    );
  }

  // ── Subtotals ──────────────────────────────────────────────────────────
  const coreProductSubtotal = round2(bucketTotals.window + bucketTotals.door);
  const installLikeSubtotal = round2(
    bucketTotals.install +
      bucketTotals.trim +
      bucketTotals.demo +
      bucketTotals.permit,
  );
  const accessorySubtotal = round2(bucketTotals.screen + bucketTotals.other);
  const discountSubtotal = round2(Math.abs(bucketTotals.discount));
  const taxSubtotal = round2(bucketTotals.tax);

  // ── Per-opening metrics ────────────────────────────────────────────────
  const coreOpeningsForDiv = inferredCoreOpenings || totalOpenings;

  const contractPricePerOpening = safeDiv(contractTotal, totalOpenings);
  const coreProductPricePerOpening = safeDiv(
    coreProductSubtotal,
    coreOpeningsForDiv,
  );
  const installedPricePerOpening = safeDiv(
    round2(
      (coreProductSubtotal ?? 0) +
        (installLikeSubtotal ?? 0) -
        (discountSubtotal ?? 0),
    ),
    coreOpeningsForDiv,
  );
  const nonCoreCostPerOpening = safeDiv(
    round2((contractTotal ?? 0) - (coreProductSubtotal ?? 0)),
    totalOpenings,
  );

  // ── Unit pricing ───────────────────────────────────────────────────────
  const windowAvgUnitPrice = safeDiv(
    bucketTotals.window,
    bucketQty.window || null,
  );
  const doorAvgUnitPrice = safeDiv(
    bucketTotals.door,
    bucketQty.door || null,
  );
  const highestPricedOpening = coreLinePrices.length
    ? round2(Math.max(...coreLinePrices))
    : null;
  const lowestPricedOpening = coreLinePrices.length
    ? round2(Math.min(...coreLinePrices))
    : null;
  const medianCoreLinePrice = median(coreLinePrices);
  const priceSpreadRatio =
    highestPricedOpening !== null &&
    lowestPricedOpening !== null &&
    lowestPricedOpening > 0
      ? round2(highestPricedOpening / lowestPricedOpening)
      : null;

  // ── Warnings ───────────────────────────────────────────────────────────
  if (items.length > 0 && pricedLines / items.length < 0.7) {
    warnings.push(
      "Low pricing coverage: many line items are missing unit_price and total_price.",
    );
  }
  if (
    contractTotal !== null &&
    accessorySubtotal !== null &&
    contractTotal > 0 &&
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

  // ── Confidence ─────────────────────────────────────────────────────────
  const quoteMathConfidence = (() => {
    let score = 100;
    if (!contractTotal || contractTotal <= 0) score -= 35;
    if (!totalOpenings || totalOpenings <= 0) score -= 35;
    if (items.length > 0 && pricedLines / items.length < 0.7) score -= 15;
    if (
      extractedOpenings &&
      inferredCoreOpenings > 0 &&
      extractedOpenings !== inferredCoreOpenings
    )
      score -= 15;
    return Math.max(0, Math.min(100, score));
  })();

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
      opening_count_mismatch:
        extractedOpenings &&
        inferredCoreOpenings > 0 &&
        extractedOpenings !== inferredCoreOpenings,
      inferred_core_openings: inferredCoreOpenings || null,
      window_openings: bucketQty.window || null,
      door_openings: bucketQty.door || null,
      total_line_items: items.length,
      priced_line_items: pricedLines,
    },
    per_opening: {
      contract_price_per_opening: contractPricePerOpening,
      core_product_price_per_opening: coreProductPricePerOpening,
      installed_price_per_opening: installedPricePerOpening,
      non_core_cost_per_opening: nonCoreCostPerOpening,
    },
    unit_pricing: {
      window_avg_unit_price: windowAvgUnitPrice,
      door_avg_unit_price: doorAvgUnitPrice,
      median_core_line_price: medianCoreLinePrice,
      highest_priced_opening: highestPricedOpening,
      lowest_priced_opening: lowestPricedOpening,
      price_spread_ratio: priceSpreadRatio,
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
      brand_coverage_pct: coreLines ? pct(brandKnownCore, coreLines) : null,
      dp_coverage_pct: coreLines ? pct(dpKnownCore, coreLines) : null,
      noa_coverage_pct: coreLines ? pct(noaKnownCore, coreLines) : null,
    },
    trust_signals: {
      scope_present: Boolean(data.installation?.scope_detail),
      permit_stated:
        data.permits?.included !== undefined &&
        data.permits?.included !== null,
      warranty_present: Boolean(data.warranty),
    },
    diagnostics: {
      quote_math_confidence: quoteMathConfidence,
      warnings,
    },
  };
}

// ── Server ───────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const body = await req.json();
    const extraction = body?.extraction as ExtractionResult | undefined;

    if (!extraction || typeof extraction !== "object") {
      return new Response(
        JSON.stringify({
          error: "Missing extraction object in request body.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 1. Generate the legacy metrics
    const legacyMetrics = deriveMetrics(extraction);

    // 2. Generate the V2.0 Intelligence line items and math gates
    const rawItems = extraction.line_items || [];
    let runningSum = 0;
    let mathIntegrityFailed = false;

    const processed_line_items = rawItems.map((item) => {
      const description = item.description || "";
      const classified_sub_type = classifyProductV2(description);
      const brand_identified = aggregateBrandV2(description, item.brand || null);
      const is_impact_rated = /impact|hurricane|non-impact/i.test(description) 
        ? !/non-impact/i.test(description) 
        : null;

      let computed_line_total = n(item.total_price);
      if (computed_line_total === null && n(item.unit_price) !== null) {
        computed_line_total = (n(item.unit_price) || 0) * (n(item.quantity) || 1);
      }

      const line_item_math_valid = typeof computed_line_total === "number";
      if (line_item_math_valid) {
        runningSum += (computed_line_total || 0);
      } else {
        mathIntegrityFailed = true;
      }

      return {
        ...item,
        classified_sub_type,
        brand_identified,
        is_impact_rated,
        line_item_math_valid,
        computed_line_total
      };
    });

    const quotedTotal = n(extraction.total_quoted_price);
    let math_discrepancy: boolean | null = null;
    if (quotedTotal !== null && !mathIntegrityFailed && processed_line_items.length > 0) {
      math_discrepancy = Math.abs(runningSum - quotedTotal) > 1.0;
    }

    // 3. Merge them additively
    const finalMetrics = {
      ...legacyMetrics,
      line_items: processed_line_items,
      math_validation: {
        computed_sum: runningSum,
        quoted_total: quotedTotal,
        math_discrepancy,
        trust_score: math_discrepancy === false ? 100 : (math_discrepancy === true ? 0 : 50)
      },
      engine_metadata: { version: "2.0.0-production", processed_at: new Date().toISOString() }
    };

    return new Response(JSON.stringify({ ok: true, metrics: finalMetrics }, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
