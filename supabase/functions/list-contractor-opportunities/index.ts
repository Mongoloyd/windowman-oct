/**
 * list-contractor-opportunities — Authenticated contractor opportunity inbox.
 *
 * Resolves the contractor's auth identity → marketplace contractor record via
 * the `contractors.auth_user_id` bridge column, then reads opportunity data
 * using service-role to avoid exposing internal tables to the browser.
 *
 * Inputs (POST body — all optional filters):
 *   { status?, release_status?, county?, unlocked_only? }
 *
 * Auth: JWT required (contractor auth user)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ──────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(
        { error: "unauthenticated", message: "Missing auth token." },
        401,
      );
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: claimsData, error: claimsErr } = await anonClient.auth
      .getClaims(
        authHeader.replace("Bearer ", ""),
      );
    if (claimsErr || !claimsData?.claims?.sub) {
      return json(
        { error: "unauthenticated", message: "Invalid auth token." },
        401,
      );
    }
    const authUserId = claimsData.claims.sub as string;

    // ── Service client ───────────────────────────────────────────
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Resolve contractor identity ──────────────────────────────
    // contractor_profiles.id = auth.uid (auth identity)
    const { data: profile } = await svc
      .from("contractor_profiles")
      .select("id, status")
      .eq("id", authUserId)
      .maybeSingle();

    if (!profile) {
      return json({
        error: "no_contractor_profile",
        message: "No contractor profile found.",
      }, 404);
    }

    if (profile.status !== "active") {
      return json({
        error: "contractor_inactive",
        message: `Contractor account is ${profile.status}.`,
        contractor_status: profile.status,
      }, 403);
    }

    // Bridge to marketplace contractor record
    const { data: contractor } = await svc
      .from("contractors")
      .select("id, company_name, status")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (!contractor) {
      return json({
        error: "no_contractor_record",
        message: "No marketplace contractor record linked to your account.",
      }, 404);
    }

    const contractorId = contractor.id as string;

    // ── Credit balance ───────────────────────────────────────────
    const { data: creditRow } = await svc
      .from("contractor_credits")
      .select("balance")
      .eq("contractor_id", authUserId)
      .maybeSingle();

    const creditBalance = (creditRow?.balance as number) ?? 0;

    // ── Parse filters ────────────────────────────────────────────
    let filters: Record<string, unknown> = {};
    try {
      if (req.method === "POST") {
        filters = await req.json();
      }
    } catch {
      // no body or invalid JSON — use defaults
    }

    const filterStatus = filters.status as string | undefined;
    const filterReleaseStatus = filters.release_status as string | undefined;
    const filterCounty = filters.county as string | undefined;
    const filterUnlockedOnly = filters.unlocked_only === true;

    // ── Fetch routes for this contractor ──────────────────────────
    const { data: routes, error: routesErr } = await svc
      .from("contractor_opportunity_routes")
      .select(
        "id, opportunity_id, contractor_id, route_status, release_status, contact_released, sent_at, viewed_at",
      )
      .eq("contractor_id", contractorId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (routesErr) {
      console.error(
        "[list-contractor-opportunities] Routes fetch error:",
        routesErr,
      );
      return json(
        { error: "fetch_error", message: "Failed to fetch routes." },
        500,
      );
    }

    if (!routes || routes.length === 0) {
      return json({
        opportunities: [],
        meta: {
          credit_balance: creditBalance,
          contractor_status: profile.status,
          total: 0,
        },
      });
    }

    // ── Fetch linked opportunities ───────────────────────────────
    const oppIds = [...new Set(routes.map((r) => r.opportunity_id))];

    let oppQuery = svc
      .from("contractor_opportunities")
      .select(
        "id, lead_id, analysis_id, scan_session_id, county, project_type, window_count, quote_range, grade, flag_count, red_flag_count, amber_flag_count, priority_score, status, created_at",
      )
      .in("id", oppIds);

    if (filterStatus) oppQuery = oppQuery.eq("status", filterStatus);
    if (filterCounty) oppQuery = oppQuery.eq("county", filterCounty);

    const { data: opportunities, error: oppErr } = await oppQuery;

    if (oppErr) {
      console.error(
        "[list-contractor-opportunities] Opportunities fetch error:",
        oppErr,
      );
      return json({
        error: "fetch_error",
        message: "Failed to fetch opportunities.",
      }, 500);
    }

    const oppMap = new Map((opportunities ?? []).map((o) => [o.id, o]));

    // ── Fetch unlock state for all leads ─────────────────────────
    const leadIds = [
      ...new Set((opportunities ?? []).map((o) => o.lead_id).filter(Boolean)),
    ];

    let unlockedLeadIds = new Set<string>();
    if (leadIds.length > 0) {
      const { data: unlocks } = await svc
        .from("contractor_unlocked_leads")
        .select("lead_id")
        .eq("contractor_id", authUserId)
        .in("lead_id", leadIds);

      unlockedLeadIds = new Set((unlocks ?? []).map((u) => u.lead_id));
    }

    // ── Fetch lead cities for display ────────────────────────────
    const leadCities = new Map<string, string>();
    if (leadIds.length > 0) {
      const { data: leads } = await svc
        .from("leads")
        .select("id, city, county")
        .in("id", leadIds);

      if (leads) {
        for (const l of leads) {
          leadCities.set(l.id, l.city ?? "");
        }
      }
    }

    // ── Check for quote files (document evidence) ────────────────
    const scanSessionIds = [
      ...new Set(
        (opportunities ?? []).map((o) => o.scan_session_id).filter(Boolean),
      ),
    ];
    let sessionsWithDocs = new Set<string>();
    if (scanSessionIds.length > 0) {
      const { data: sessions } = await svc
        .from("scan_sessions")
        .select("id, quote_file_id")
        .in("id", scanSessionIds)
        .not("quote_file_id", "is", null);

      sessionsWithDocs = new Set((sessions ?? []).map((s) => s.id));
    }

    // ── Build response ───────────────────────────────────────────
    const result: unknown[] = [];

    for (const route of routes) {
      const opp = oppMap.get(route.opportunity_id);
      if (!opp) continue;

      // Apply release_status filter
      if (filterReleaseStatus && route.release_status !== filterReleaseStatus) {
        continue;
      }

      const leadId = opp.lead_id as string;
      const isUnlocked = unlockedLeadIds.has(leadId);

      // Apply unlocked_only filter
      if (filterUnlockedOnly && !isUnlocked) continue;

      const canUnlock = !isUnlocked && creditBalance >= 1;
      const hasDocument = sessionsWithDocs.has(opp.scan_session_id);

      result.push({
        opportunity_id: opp.id,
        route_id: route.id,
        analysis_id: opp.analysis_id,
        lead_id: leadId,
        county: opp.county,
        city: leadCities.get(leadId) ?? null,
        project_type: opp.project_type,
        window_count: opp.window_count,
        quote_range: opp.quote_range,
        grade: opp.grade,
        flag_count: opp.flag_count,
        red_flag_count: opp.red_flag_count,
        amber_flag_count: opp.amber_flag_count,
        priority_score: opp.priority_score,
        status: opp.status,
        release_status: route.release_status,
        already_unlocked: isUnlocked,
        can_unlock: canUnlock,
        credit_balance: creditBalance,
        dossier_href: `/partner/dossier/${opp.analysis_id}`,
        has_document: hasDocument,
        created_at: opp.created_at,
      });
    }

    // Sort by priority desc, then created_at desc
    // deno-lint-ignore no-explicit-any
    result.sort((a: any, b: any) => {
      if (b.priority_score !== a.priority_score) {
        return b.priority_score - a.priority_score;
      }
      return new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime();
    });

    return json({
      opportunities: result,
      meta: {
        credit_balance: creditBalance,
        contractor_status: profile.status,
        total: result.length,
      },
    });
  } catch (err) {
    console.error("[list-contractor-opportunities] Unhandled error:", err);
    return json(
      { error: "internal_error", message: "Internal server error." },
      500,
    );
  }
});
