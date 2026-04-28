import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const VALID_WINDOWS = new Set(["7d", "30d", "90d", "all"]);
const CONTACTED_STATES = new Set([
  "contacted",
  "meeting_scheduled",
  "scheduled",
  "quote_delivered",
  "sold_closed",
  "lost_dead",
]);
const SCHEDULED_STATES = new Set([
  "meeting_scheduled",
  "scheduled",
  "quote_delivered",
  "sold_closed",
  "lost_dead",
]);
const PROPOSAL_STATES = new Set(["quote_delivered", "sold_closed"]);
const APPROVED_RELEASE_STATES = new Set(["approved", "released"]);

type WindowValue = "7d" | "30d" | "90d" | "all";
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
function cutoffFor(windowValue: WindowValue): string | null {
  if (windowValue === "all") return null;
  const days = windowValue === "7d" ? 7 : windowValue === "30d" ? 30 : 90;
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}
function maskId(id: string): string {
  return id.length <= 12 ? id : `${id.slice(0, 8)}…${id.slice(-4)}`;
}
function rate(n: number, d: number): number | null {
  return d > 0 ? n / d : null;
}
function deriveStatus(
  released: number,
  sold: number,
  closeRate: number | null,
  attemptingRate: number | null,
) {
  if (released < 5) return "insufficient_data";
  if (released >= 10 && sold === 0) return "pause";
  if ((attemptingRate ?? 0) > 0.7) return "pause";
  if (released >= 5 && (attemptingRate ?? 0) > 0.5) return "coach";
  if ((closeRate ?? 0) < 0.1 || (attemptingRate ?? 0) > 0.35) return "watch";
  if ((closeRate ?? 0) >= 0.2 && (attemptingRate ?? 0) <= 0.25) {
    return "healthy";
  }
  return "watch";
}
function safeDateMax(values: Array<string | null | undefined>): string | null {
  const times = values.filter(Boolean).map((v) =>
    new Date(v as string).getTime()
  ).filter(Number.isFinite);
  return times.length ? new Date(Math.max(...times)).toISOString() : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(
      { error: "method_not_allowed", message: "POST required." },
      405,
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(
        { error: "unauthenticated", message: "Missing auth token." },
        401,
      );
    }
    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await anon.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userData?.user?.id) {
      return json(
        { error: "unauthenticated", message: "Invalid auth token." },
        401,
      );
    }

    const body = await req.json().catch(() => ({}));
    const requestedWindow =
      typeof body.window === "string" && VALID_WINDOWS.has(body.window)
        ? body.window as WindowValue
        : "30d";
    const cutoff = cutoffFor(requestedWindow);
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: accounts, error: accountError } = await svc.from(
      "contractor_accounts",
    ).select("id, client_slug, display_name, is_active, access_status").eq(
      "auth_user_id",
      userData.user.id,
    ).eq("is_active", true).eq("access_status", "active").limit(2);
    if (accountError) {
      return json({
        error: "account_lookup_failed",
        message: "Contractor account could not be verified.",
      }, 500);
    }
    const account = accounts?.[0];
    if (!account) {
      return json({
        error: "contractor_account_not_active",
        message: "No active contractor account is linked to this login.",
      }, 403);
    }

    const assignmentQuery = svc.from("lead_assignments").select(
      "id, contractor_account_id, client_slug, assigned_at, created_at",
    ).eq("contractor_account_id", account.id).eq(
      "client_slug",
      account.client_slug,
    );
    const releaseQuery = svc.from("lead_contact_releases").select(
      "id, lead_assignment_id, contractor_account_id, client_slug, release_status, released_at, created_at",
    ).eq("contractor_account_id", account.id).eq(
      "client_slug",
      account.client_slug,
    );
    const outcomeQuery = svc.from("contractor_outcomes").select(
      "id, lead_assignment_id, contractor_account_id, client_slug, disposition_state, disposition_reason_code, final_value_cents, value_basis, outcome_integrity_status, outcome_verified, outcome_verified_at, created_at, updated_at, last_partner_action_at",
    ).eq("contractor_account_id", account.id).eq(
      "client_slug",
      account.client_slug,
    );
    const [
      { data: assignments, error: assignmentError },
      { data: releases, error: releaseError },
      { data: outcomes, error: outcomeError },
    ] = await Promise.all([
      cutoff ? assignmentQuery.gte("assigned_at", cutoff) : assignmentQuery,
      cutoff ? releaseQuery.gte("created_at", cutoff) : releaseQuery,
      cutoff ? outcomeQuery.gte("updated_at", cutoff) : outcomeQuery,
    ]);
    if (assignmentError || releaseError || outcomeError) {
      return json({
        error: "performance_lookup_failed",
        message:
          "Contractor performance aggregates could not be loaded safely.",
      }, 500);
    }

    const assignmentRows = assignments ?? [];
    const assignmentIds = new Set(assignmentRows.map((row) => row.id));
    const approvedReleases = (releases ?? []).filter((row) =>
      APPROVED_RELEASE_STATES.has(row.release_status)
    );
    const activeOutcomes = (outcomes ?? []).filter((row) =>
      row.lead_assignment_id && assignmentIds.has(row.lead_assignment_id)
    );
    const attemptingContactCount = activeOutcomes.filter((row) =>
      row.disposition_state === "attempting_contact"
    ).length;
    const contactedCount = activeOutcomes.filter((row) =>
      CONTACTED_STATES.has(row.disposition_state)
    ).length;
    const scheduledCount = activeOutcomes.filter((row) =>
      SCHEDULED_STATES.has(row.disposition_state)
    ).length;
    const quoteDeliveredCount = activeOutcomes.filter((row) =>
      PROPOSAL_STATES.has(row.disposition_state)
    ).length;
    const soldOutcomes = activeOutcomes.filter((row) =>
      row.disposition_state === "sold_closed" &&
      row.final_value_cents != null && row.final_value_cents > 0 &&
      (row.outcome_verified === true ||
        row.outcome_integrity_status === "valid" ||
        row.outcome_integrity_status === "verified")
    );
    const lostOutcomes = activeOutcomes.filter((row) =>
      row.disposition_state === "lost_dead"
    );
    const manualReviewCount = activeOutcomes.filter((row) =>
      ["needs_review", "manual_review", "disputed"].includes(
        row.outcome_integrity_status ?? "",
      )
    ).length;
    const confirmedSoldValueCents = soldOutcomes.filter((row) =>
      row.value_basis === "contract_total" ||
      row.value_basis === "gross_sale_value"
    ).reduce((sum, row) =>
      sum + (row.final_value_cents ?? 0), 0);
    const estimatedSoldValueCents = soldOutcomes.filter((row) =>
      row.value_basis === "estimated_contract_value"
    ).reduce((sum, row) =>
      sum + (row.final_value_cents ?? 0), 0);
    const marginValueCents = soldOutcomes.filter((row) =>
      row.value_basis === "true_margin"
    ).reduce((sum, row) =>
      sum + (row.final_value_cents ?? 0), 0);
    const releasedCount = approvedReleases.length;
    const closeRate = rate(soldOutcomes.length, releasedCount);
    const attemptingContactRate = rate(attemptingContactCount, releasedCount);
    const assignmentById = new Map(assignmentRows.map((row) => [row.id, row]));
    const firstUpdateHours = activeOutcomes.map((outcome) => {
      const assignment = outcome.lead_assignment_id
        ? assignmentById.get(outcome.lead_assignment_id)
        : null;
      if (!assignment) {
        return null;
      }
      const a = new Date(assignment.assigned_at ?? assignment.created_at)
        .getTime();
      const u = new Date(
        outcome.last_partner_action_at ?? outcome.updated_at ??
          outcome.created_at,
      ).getTime();
      return Number.isFinite(a) && Number.isFinite(u) && u >= a
        ? (u - a) / 36e5
        : null;
    }).filter((value): value is number =>
      value != null
    );
    const warnings = [
      estimatedSoldValueCents > 0
        ? "estimated_contract_value_included_separately"
        : null,
      marginValueCents > 0
        ? "true_margin_value_separated_from_gross_sale"
        : null,
      manualReviewCount > 0 ? "manual_review_outcomes_present" : null,
    ].filter(Boolean);

    return json({
      success: true,
      window: requestedWindow,
      denominator: "released_leads",
      summaries: [{
        contractorAccountId: account.id,
        contractorAccountIdMasked: maskId(account.id),
        contractorDisplayName: account.display_name,
        clientSlug: account.client_slug,
        assignedCount: assignmentRows.length,
        releasedCount,
        attemptingContactCount,
        contactedCount,
        meetingScheduledCount: scheduledCount,
        scheduledCount,
        quoteDeliveredCount,
        soldCount: soldOutcomes.length,
        lostCount: lostOutcomes.length,
        manualReviewCount,
        contactRate: rate(contactedCount, releasedCount),
        appointmentRate: rate(scheduledCount, releasedCount),
        proposalRate: rate(quoteDeliveredCount, releasedCount),
        closeRate,
        lossRate: rate(lostOutcomes.length, releasedCount),
        attemptingContactRate,
        soldValueCents: confirmedSoldValueCents,
        estimatedSoldValueCents,
        confirmedSoldValueCents,
        marginValueCents,
        averageTimeToFirstUpdateHours: firstUpdateHours.length
          ? firstUpdateHours.reduce((sum, value) => sum + value, 0) /
            firstUpdateHours.length
          : null,
        lastActivityAt: safeDateMax([
          ...assignmentRows.map((row) => row.assigned_at ?? row.created_at),
          ...approvedReleases.map((row) => row.released_at ?? row.created_at),
          ...activeOutcomes.map((row) =>
            row.last_partner_action_at ?? row.updated_at ?? row.created_at
          ),
        ]),
        performanceStatus: deriveStatus(
          releasedCount,
          soldOutcomes.length,
          closeRate,
          attemptingContactRate,
        ),
        warnings,
        lostReasonBreakdown: lostOutcomes.reduce((acc, row) => {
          const key = row.disposition_reason_code ?? "unspecified";
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      }],
    });
  } catch (error) {
    console.error("[contractor-performance-summary] unhandled", error);
    return json({
      error: "internal_error",
      message: "Contractor performance request failed safely.",
    }, 500);
  }
});
