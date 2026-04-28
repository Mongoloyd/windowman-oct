/**
 * County Benchmark Module — Parallel pricing benchmark layer
 * Separate from compliance BENCHMARK_MAP (rubric scoring).
 * Phase 1: Miami-Dade, Broward, Palm Beach + South Florida fallback.
 */

export interface CountyBenchmark {
  county_key: string;
  county_label: string;
  installed_price_per_opening_low: number;
  installed_price_per_opening_avg: number;
  installed_price_per_opening_high: number;
  source_type: "city_proxy" | "regional_blend";
  source_label: string;
  updated_at: string;
}

export const SOUTH_FLORIDA_COUNTY_BENCHMARKS: Record<string, CountyBenchmark> =
  {
    "miami-dade": {
      county_key: "miami-dade",
      county_label: "Miami-Dade",
      installed_price_per_opening_low: 1800,
      installed_price_per_opening_avg: 2150,
      installed_price_per_opening_high: 2500,
      source_type: "city_proxy",
      source_label: "Miami 2026 installed impact-window range",
      updated_at: "2026-01-08",
    },
    broward: {
      county_key: "broward",
      county_label: "Broward",
      installed_price_per_opening_low: 1700,
      installed_price_per_opening_avg: 2050,
      installed_price_per_opening_high: 2400,
      source_type: "city_proxy",
      source_label: "Fort Lauderdale 2026 installed impact-window range",
      updated_at: "2026-01-08",
    },
    "palm-beach": {
      county_key: "palm-beach",
      county_label: "Palm Beach",
      installed_price_per_opening_low: 1700,
      installed_price_per_opening_avg: 2050,
      installed_price_per_opening_high: 2400,
      source_type: "city_proxy",
      source_label: "West Palm Beach 2026 installed impact-window range",
      updated_at: "2026-01-08",
    },
    "south-florida": {
      county_key: "south-florida",
      county_label: "South Florida",
      installed_price_per_opening_low: 1700,
      installed_price_per_opening_avg: 2100,
      installed_price_per_opening_high: 2500,
      source_type: "regional_blend",
      source_label: "Blended South Florida proxy average",
      updated_at: "2026-01-08",
    },
  };

export function normalizeCountyName(input?: string | null): string | null {
  if (!input) return null;
  const v = input.trim().toLowerCase();
  if (v.includes("miami") || v.includes("dade")) return "miami-dade";
  if (v.includes("broward")) return "broward";
  if (v.includes("palm")) return "palm-beach";
  return null;
}

export function getCountyBenchmark(input?: string | null): CountyBenchmark {
  const normalized = normalizeCountyName(input);
  return normalized
    ? SOUTH_FLORIDA_COUNTY_BENCHMARKS[normalized]
    : SOUTH_FLORIDA_COUNTY_BENCHMARKS["south-florida"];
}

// ── Phase 2 upgrade path ────────────────────────────────────────────────────
// When the refresh-benchmarks cron job has accumulated enough real-scan data
// (sample_count >= 5 per bucket), replace getCountyBenchmark() above with a
// live DB query so scoring uses computed benchmarks instead of hardcoded values:
//
//   const { data: benchmark } = await supabase
//     .from("county_benchmarks")
//     .select("*")
//     .eq("county_key", normalizeCountyName(input) ?? "south-florida")
//     .eq("project_type", "all")
//     .maybeSingle();
//
// Map the returned row `benchmark` to CountyBenchmark as:
//   CountyBenchmark.installed_price_per_opening_low  = benchmark.installed_price_per_opening_p25
//   CountyBenchmark.installed_price_per_opening_avg  = benchmark.installed_price_per_opening_median
//   CountyBenchmark.installed_price_per_opening_high = benchmark.installed_price_per_opening_p75
// Fall back to SOUTH_FLORIDA_COUNTY_BENCHMARKS if data is null or stale.
