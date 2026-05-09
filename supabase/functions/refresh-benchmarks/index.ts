/**
 * refresh-benchmarks — Nightly data moat builder.
 *
 * Triggered by pg_cron daily at 3:00 AM EST (8:00 AM UTC).
 * Queries all completed analyses, extracts per-opening pricing,
 * groups by county and project_type, computes P25/median/P75/avg,
 * and upserts into county_benchmarks.
 *
 * Minimum sample threshold: 5 analyses per bucket before overwriting seed data.
 * Below threshold: row is still created but source_type = 'insufficient_sample'.
 *
 * POST { trigger: "cron" }
 * Returns { success, buckets_updated, total_analyses_processed }
 *
 * No external API keys needed — purely database-driven.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Statistical helpers ────────────────────────────────────────────────
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const rank = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  const weight = rank - lower;
  return Math.round(
    (sorted[lower] * (1 - weight) + sorted[upper] * weight) * 100,
  ) / 100;
}

function median(sorted: number[]): number {
  return percentile(sorted, 50);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) /
    100;
}

// ── County normalizer (mirrors scan-quote's countyBenchmarks.ts) ───────
function normalizeCounty(
  input: string | null | undefined,
): { key: string; label: string } {
  if (!input) return { key: "south-florida", label: "South Florida" };
  const v = input.trim().toLowerCase();
  if (v.includes("miami") || v.includes("dade")) {
    return { key: "miami-dade", label: "Miami-Dade" };
  }
  if (v.includes("broward")) return { key: "broward", label: "Broward" };
  if (v.includes("palm")) return { key: "palm-beach", label: "Palm Beach" };
  return { key: "south-florida", label: "South Florida" };
}

const MIN_SAMPLE_SIZE = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Cron auth ─────────────────────────────────────────────────────────
  const provided = req.headers.get("x-cron-secret");
  const expected = Deno.env.get("BENCHMARK_CRON_SECRET") ??
    Deno.env.get("CONTRACTOR_CRON_SECRET");
  if (!expected || provided !== expected) {
    return json({ error: "Forbidden" }, 403);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── 1. Fetch all completed analyses with full_json ─────────────────
    const { data: analyses, error: fetchErr } = await supabase
      .from("analyses")
      .select("scan_session_id, full_json, grade")
      .eq("analysis_status", "complete")
      .not("full_json", "is", null);

    if (fetchErr) {
      console.error("[refresh-benchmarks] Failed to fetch analyses:", fetchErr);
      return json({ error: "Failed to query analyses" }, 500);
    }

    if (!analyses || analyses.length === 0) {
      console.log("[refresh-benchmarks] No completed analyses found");
      return json({
        success: true,
        buckets_updated: 0,
        total_analyses_processed: 0,
      });
    }

    console.log(
      `[refresh-benchmarks] Processing ${analyses.length} completed analyses`,
    );

    // ── 2. Resolve county for each analysis via scan_session → lead ────
    const sessionIds = analyses.map((a) => a.scan_session_id).filter(Boolean);
    const { data: sessions } = await supabase
      .from("scan_sessions")
      .select("id, lead_id")
      .in("id", sessionIds);

    const sessionToLead = new Map<string, string>();
    for (const s of sessions || []) {
      if (s.lead_id) sessionToLead.set(s.id, s.lead_id);
    }

    const leadIds = [...new Set(sessionToLead.values())];
    const { data: leads } = await supabase
      .from("leads")
      .select("id, county, project_type")
      .in("id", leadIds);

    const leadMap = new Map<
      string,
      { county: string | null; project_type: string | null }
    >();
    for (const l of leads || []) {
      leadMap.set(l.id, { county: l.county, project_type: l.project_type });
    }

    // ── 3. Extract per-opening pricing and bucket by county+project_type ─
    interface PriceBucket {
      countyKey: string;
      countyLabel: string;
      projectType: string;
      prices: number[];
    }

    const buckets = new Map<string, PriceBucket>();

    for (const analysis of analyses) {
      const fullJson = analysis.full_json as Record<string, unknown> | null;
      if (!fullJson) continue;

      const derivedMetrics = fullJson.derived_metrics as
        | Record<string, unknown>
        | undefined;
      if (!derivedMetrics) continue;

      const perOpening = derivedMetrics.per_opening as
        | Record<string, unknown>
        | undefined;
      const installedPPO = perOpening?.installed_price_per_opening as
        | number
        | null
        | undefined;
      const contractPPO = perOpening?.contract_price_per_opening as
        | number
        | null
        | undefined;

      const price = installedPPO ?? contractPPO;
      if (!price || price <= 0 || price > 10000) continue; // sanity bounds

      const leadId = sessionToLead.get(analysis.scan_session_id);
      const leadData = leadId ? leadMap.get(leadId) : undefined;
      const { key: countyKey, label: countyLabel } = normalizeCounty(
        leadData?.county,
      );
      const projectType = leadData?.project_type || "all";

      // Bucket by county+all (aggregate) and county+projectType (specific)
      const allKey = `${countyKey}::all`;
      if (!buckets.has(allKey)) {
        buckets.set(allKey, {
          countyKey,
          countyLabel,
          projectType: "all",
          prices: [],
        });
      }
      buckets.get(allKey)!.prices.push(price);

      if (projectType !== "all") {
        const specificKey = `${countyKey}::${projectType}`;
        if (!buckets.has(specificKey)) {
          buckets.set(specificKey, {
            countyKey,
            countyLabel,
            projectType,
            prices: [],
          });
        }
        buckets.get(specificKey)!.prices.push(price);
      }
    }

    // ── 4. Compute statistics and upsert ───────────────────────────
    const now = new Date().toISOString();
    let bucketsUpdated = 0;

    for (const [, bucket] of buckets) {
      const sorted = [...bucket.prices].sort((a, b) => a - b);
      const count = sorted.length;

      const meetsThreshold = count >= MIN_SAMPLE_SIZE;
      const sourceType = meetsThreshold ? "computed" : "insufficient_sample";
      const sourceLabel = meetsThreshold
        ? `Computed from ${count} WindowMan scans as of ${now.split("T")[0]}`
        : `Only ${count} sample${
          count !== 1 ? "s" : ""
        } — below ${MIN_SAMPLE_SIZE} minimum threshold`;

      const { error: upsertErr } = await supabase
        .from("county_benchmarks")
        .upsert(
          {
            county_key: bucket.countyKey,
            county_label: bucket.countyLabel,
            project_type: bucket.projectType,
            sample_count: count,
            installed_price_per_opening_p25: percentile(sorted, 25),
            installed_price_per_opening_median: median(sorted),
            installed_price_per_opening_p75: percentile(sorted, 75),
            installed_price_per_opening_avg: average(sorted),
            source_type: sourceType,
            source_label: sourceLabel,
            computed_at: now,
            updated_at: now,
          },
          { onConflict: "county_key,project_type" },
        );

      if (upsertErr) {
        console.error(
          `[refresh-benchmarks] Upsert failed for ${bucket.countyKey}/${bucket.projectType}:`,
          upsertErr,
        );
      } else {
        bucketsUpdated++;
        console.log(
          `[refresh-benchmarks] ${bucket.countyKey}/${bucket.projectType}: ${count} samples, median=$${
            median(sorted)
          }, P25=$${percentile(sorted, 25)}, P75=$${percentile(sorted, 75)}`,
        );
      }
    }

    // ── 5. Log summary event ───────────────────────────────────────────
    await supabase.from("event_logs").insert({
      event_name: "benchmarks_refreshed",
      route: "/cron",
      metadata: {
        total_analyses_processed: analyses.length,
        buckets_updated: bucketsUpdated,
        bucket_details: [...buckets.entries()].map(([key, b]) => ({
          key,
          sample_count: b.prices.length,
          median: median([...b.prices].sort((a, c) => a - c)),
        })),
        timestamp: now,
      },
    });

    console.log(
      `[refresh-benchmarks] Complete: ${bucketsUpdated} buckets updated from ${analyses.length} analyses`,
    );

    return json({
      success: true,
      buckets_updated: bucketsUpdated,
      total_analyses_processed: analyses.length,
    });
  } catch (err) {
    console.error("[refresh-benchmarks] unhandled error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
