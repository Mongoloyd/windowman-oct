/**
 * enrich-lead v2 — Property data enrichment for contractor brief boosting.
 *
 * Called asynchronously after lead capture in TruthGateFlow.
 *
 * ACCEPTS BOTH:
 *   { session_id, county, window_count }  — from anon frontend (TruthGateFlow)
 *   { lead_id, county, window_count }     — from admin/internal callers
 *
 * When session_id is provided, resolves lead_id server-side via:
 *   1. scan_sessions.lead_id (if scan already linked)
 *   2. leads.session_id (direct column match)
 *
 * Phase 1: Uses county-level proxy data (mocked but realistic ranges).
 * Phase 2: Will integrate Zillow/county appraiser API for address-level data.
 *
 * POST { session_id | lead_id, county?, window_count? }
 * Returns { success, enrichment: EnrichmentData }
 */

// deno-lint-ignore no-import-prefix
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// COUNTY PROXY DATA
// ═══════════════════════════════════════════════════════════════════════════

interface PropertyData {
  property_value_low: number;
  property_value_high: number;
  year_built_estimate: number;
  property_type: string;
  source: string;
}

interface CountyProfile {
  valueLow: number;
  valueHigh: number;
  medianYearBuilt: number;
  yearBuiltRange: [number, number];
  dominantPropertyType: string;
}

const COUNTY_PROFILES: Record<string, CountyProfile> = {
  "miami-dade": {
    valueLow: 380000,
    valueHigh: 720000,
    medianYearBuilt: 1985,
    yearBuiltRange: [1955, 2015],
    dominantPropertyType: "single_family",
  },
  "broward": {
    valueLow: 340000,
    valueHigh: 650000,
    medianYearBuilt: 1988,
    yearBuiltRange: [1960, 2012],
    dominantPropertyType: "single_family",
  },
  "palm-beach": {
    valueLow: 360000,
    valueHigh: 780000,
    medianYearBuilt: 1990,
    yearBuiltRange: [1965, 2018],
    dominantPropertyType: "single_family",
  },
  "other": {
    valueLow: 280000,
    valueHigh: 550000,
    medianYearBuilt: 1992,
    yearBuiltRange: [1970, 2015],
    dominantPropertyType: "single_family",
  },
};

function normalizeCountyKey(county: string | null | undefined): string {
  if (!county) return "other";
  const v = county.trim().toLowerCase();
  if (v.includes("miami") || v.includes("dade")) return "miami-dade";
  if (v.includes("broward")) return "broward";
  if (v.includes("palm")) return "palm-beach";
  return "other";
}

async function fetchPropertyData(
  county: string | null | undefined,
  windowCount: number | null | undefined,
): Promise<PropertyData> {
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const key = normalizeCountyKey(county);
  const profile = COUNTY_PROFILES[key] || COUNTY_PROFILES["other"];

  const variance = 0.92 + Math.random() * 0.16;
  const valueLow = Math.round(profile.valueLow * variance / 1000) * 1000;
  const valueHigh = Math.round(profile.valueHigh * variance / 1000) * 1000;

  const [yearMin, yearMax] = profile.yearBuiltRange;
  const yearBuilt = Math.round(yearMin + Math.random() * (yearMax - yearMin));

  const sizeFactor = (windowCount && windowCount >= 15) ? 1.15 : 1.0;

  return {
    property_value_low: Math.round(valueLow * sizeFactor / 1000) * 1000,
    property_value_high: Math.round(valueHigh * sizeFactor / 1000) * 1000,
    year_built_estimate: yearBuilt,
    property_type: profile.dominantPropertyType,
    source: "county_proxy_v1",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_id, lead_id: direct_lead_id, county, window_count } =
      await req.json();

    // Support both session_id (anon client) and direct lead_id (admin/internal)
    let lead_id = direct_lead_id;

    if (!lead_id && !session_id) {
      return json({ error: "session_id or lead_id is required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Resolve lead_id from session_id when called from anon client ──
    if (!lead_id && session_id) {
      // Path 1: scan_sessions table (if scan already linked session to lead)
      const { data: scanSession } = await supabase
        .from("scan_sessions")
        .select("lead_id")
        .eq("id", session_id)
        .maybeSingle();

      if (scanSession?.lead_id) {
        lead_id = scanSession.lead_id;
      } else {
        // Path 2: leads table directly by session_id column
        const { data: leadBySession } = await supabase
          .from("leads")
          .select("id")
          .eq("session_id", session_id)
          .maybeSingle();

        lead_id = leadBySession?.id || null;
      }

      if (!lead_id) {
        console.warn(
          `[enrich-lead] Could not resolve lead from session_id=${
            session_id?.slice(0, 8)
          }`,
        );
        return json({ error: "Could not resolve lead from session_id" }, 404);
      }

      console.log(
        `[enrich-lead] Resolved session_id=${
          session_id.slice(0, 8)
        } -> lead_id=${lead_id.slice(0, 8)}`,
      );
    }

    // ── 1. Idempotency: check if already enriched ─────────────────────
    const { data: existingLead } = await supabase
      .from("leads")
      .select("enriched_at, county, window_count")
      .eq("id", lead_id)
      .maybeSingle();

    if (!existingLead) {
      return json({ error: "Lead not found" }, 404);
    }

    if (existingLead.enriched_at) {
      console.log(
        `[enrich-lead] Lead ${lead_id.slice(0, 8)} already enriched — skipping`,
      );
      return json({ success: true, already_enriched: true });
    }

    const resolvedCounty = county || existingLead.county;
    const resolvedWindowCount = window_count ?? existingLead.window_count;

    // ── 2. Fetch property data (mocked in Phase 1) ───────────────────
    const propertyData = await fetchPropertyData(
      resolvedCounty,
      resolvedWindowCount,
    );

    // ── 3. Update lead with enrichment data ───────────────────────────
    const now = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from("leads")
      .update({
        property_value_low: propertyData.property_value_low,
        property_value_high: propertyData.property_value_high,
        year_built: propertyData.year_built_estimate,
        property_type: propertyData.property_type,
        enrichment_source: propertyData.source,
        enriched_at: now,
      })
      .eq("id", lead_id);

    if (updateErr) {
      console.error("[enrich-lead] Failed to update lead:", updateErr);
      return json({ error: "Failed to save enrichment data" }, 500);
    }

    // ── 4. Log event ──────────────────────────────────────────────────
    await supabase.from("event_logs").insert({
      event_name: "lead_enriched",
      session_id: session_id || null,
      route: "/",
      metadata: {
        lead_id,
        county: resolvedCounty,
        property_value_range:
          `$${propertyData.property_value_low.toLocaleString()}-$${propertyData.property_value_high.toLocaleString()}`,
        year_built: propertyData.year_built_estimate,
        property_type: propertyData.property_type,
        source: propertyData.source,
        resolved_via: direct_lead_id ? "direct" : "session_id",
        timestamp: now,
      },
    });

    console.log(
      `[enrich-lead] Enriched lead ${
        lead_id.slice(0, 8)
      }: $${propertyData.property_value_low.toLocaleString()}-$${propertyData.property_value_high.toLocaleString()}, built ~${propertyData.year_built_estimate}, ${resolvedCounty}`,
    );

    return json({
      success: true,
      enrichment: {
        property_value_low: propertyData.property_value_low,
        property_value_high: propertyData.property_value_high,
        year_built: propertyData.year_built_estimate,
        property_type: propertyData.property_type,
        source: propertyData.source,
      },
    });
  } catch (err) {
    console.error("[enrich-lead] unhandled error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
