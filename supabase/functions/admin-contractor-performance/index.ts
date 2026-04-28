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
const TERMINAL_LOST_STATES = new Set(["lost_dead"]);
const APPROVED_RELEASE_STATES = new Set(["approved", "released"]);

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type WindowValue = "7d" | "30d" | "90d" | "all";
type ContractorAccount = {
  id: string;
  client_slug: string;
  display_name: string;
  is_active: boolean | null;
  access_status: string | null;
};
type Assignment = {
  id: string;
  contractor_account_id: string | null;
  client_slug: string;
  assigned_at: string | null;
  created_at: string;
};
type Release = {
  id: string;
  lead_assignment_id: string;
  contractor_account_id: string;
  client_slug: string;
  release_status: string;
  released_at: string | null;
  created_at: string;
};
type Outcome = {
  id: string;
  lead_assignment_id: string | null;
  contractor_account_id: string | null;
  client_slug: string | null;
  disposition_state: string;
  disposition_reason_code: string | null;
  final_value_cents: number | null;
  value_basis: string | null;
  outcome_integrity_status: string | null;
  outcome_verified: boolean | null;
  outcome_verified_at: string | null;
  created_at: string;
  updated_at: string;
  last_partner_action_at: string | null;
};

type Metrics = {
  contractorAccountId: string;
  contractorAccountIdMasked: string;
  contractorDisplayName: string;
  clientSlug: string;
  assignedCount: number;
  releasedCount: number;
  attemptingContactCount: number;
  contactedCount: number;
  meetingScheduledCount: number;
  scheduledCount: number;
  quoteDeliveredCount: number;
  soldCount: number;
  lostCount: number;
  manualReviewCount: number;
  contactRate: number | null;
  appointmentRate: number | null;
  proposalRate: number | null;
  closeRate: number | null;
  lossRate: number | null;
  attemptingContactRate: number | null;
  soldValueCents: number;
  estimatedSoldValueCents: number;
  confirmedSoldValueCents: number;
  marginValueCents: number;
  averageTimeToFirstUpdateHours: number | null;
  lastActivityAt: string | null;
  performanceStatus:
    | "insufficient_data"
    | "healthy"
    | "watch"
    | "coach"
    | "pause";
  warnings: string[];
  lostReasonBreakdown: Record<string, number>;
};

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

function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

function deriveStatus(
  releasedCount: number,
  soldCount: number,
  closeRate: number | null,
  attemptingContactRate: number | null,
): Metrics["performanceStatus"] {
  if (releasedCount < 5) return "insufficient_data";
  if (releasedCount >= 10 && soldCount === 0) return "pause";
  if ((attemptingContactRate ?? 0) > 0.7) return "pause";
  if (releasedCount >= 5 && (attemptingContactRate ?? 0) > 0.5) return "coach";
  if ((closeRate ?? 0) < 0.1 || (attemptingContactRate ?? 0) > 0.35) {
    return "watch";
  }
  if ((closeRate ?? 0) >= 0.2 && (attemptingContactRate ?? 0) <= 0.25) {
    return "healthy";
  }
  return "watch";
}

function logSourceError(label: string, error: unknown) {
  if (!error) return;
  console.error(`[admin-contractor-performance] ${label} failed`, {
    message: typeof error === "object" && error && "message" in error
      ? (error as { message?: string }).message
      : String(error),
    details: typeof error === "object" && error && "details" in error
      ? (error as { details?: string }).details
      : null,
    hint: typeof error === "object" && error && "hint" in error
      ? (error as { hint?: string }).hint
      : null,
    code: typeof error === "object" && error && "code" in error
      ? (error as { code?: string }).code
      : null,
  });
}

function safeDateMax(values: Array<string | null | undefined>): string | null {
  const times = values.filter(Boolean).map((value) =>
    new Date(value as string).getTime()
  ).filter(Number.isFinite);
  if (times.length === 0) return null;
  return new Date(Math.max(...times)).toISOString();
}

function buildSummary(
  accounts: ContractorAccount[],
  assignments: Assignment[],
  releases: Release[],
  outcomes: Outcome[],
): Metrics[] {
  return accounts.map((account) => {
    const accountAssignments = assignments.filter((row) =>
      row.contractor_account_id === account.id &&
      row.client_slug === account.client_slug
    );
    const assignmentById = new Map(
      accountAssignments.map((row) => [row.id, row]),
    );
    const accountReleases = releases.filter((row) =>
      row.contractor_account_id === account.id &&
      row.client_slug === account.client_slug &&
      APPROVED_RELEASE_STATES.has(row.release_status)
    );
    const activeOutcomes = outcomes.filter((row) =>
      row.contractor_account_id === account.id &&
      row.client_slug === account.client_slug && row.lead_assignment_id &&
      assignmentById.has(row.lead_assignment_id)
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
      TERMINAL_LOST_STATES.has(row.disposition_state)
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
    const denominator = accountReleases.length;
    const closeRate = rate(soldOutcomes.length, denominator);
    const attemptingContactRate = rate(attemptingContactCount, denominator);

    const firstUpdateHours = activeOutcomes
      .map((outcome) => {
        const assignment = outcome.lead_assignment_id
          ? assignmentById.get(outcome.lead_assignment_id)
          : null;
        if (!assignment) {
          return null;
        }
        const assignedAt = new Date(
          assignment.assigned_at ?? assignment.created_at,
        ).getTime();
        const updateAt = new Date(
          outcome.last_partner_action_at ?? outcome.updated_at ??
            outcome.created_at,
        ).getTime();
        return Number.isFinite(assignedAt) && Number.isFinite(updateAt) &&
            updateAt >= assignedAt
          ? (updateAt - assignedAt) / 36e5
          : null;
      })
      .filter((value): value is number =>
        value != null
      );

    const lostReasonBreakdown = lostOutcomes.reduce<Record<string, number>>(
      (acc, row) => {
        const key = row.disposition_reason_code ?? "unspecified";
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      },
      {},
    );

    const warnings: string[] = [];
    if (estimatedSoldValueCents > 0) {
      warnings.push(
        "estimated_contract_value_included_separately",
      );
    }
    if (marginValueCents > 0) {
      warnings.push(
        "true_margin_value_separated_from_gross_sale",
      );
    }
    if (manualReviewCount > 0) warnings.push("manual_review_outcomes_present");

    return {
      contractorAccountId: account.id,
      contractorAccountIdMasked: maskId(account.id),
      contractorDisplayName: account.display_name,
      clientSlug: account.client_slug,
      assignedCount: accountAssignments.length,
      releasedCount: denominator,
      attemptingContactCount,
      contactedCount,
      meetingScheduledCount: scheduledCount,
      scheduledCount,
      quoteDeliveredCount,
      soldCount: soldOutcomes.length,
      lostCount: lostOutcomes.length,
      manualReviewCount,
      contactRate: rate(contactedCount, denominator),
      appointmentRate: rate(scheduledCount, denominator),
      proposalRate: rate(quoteDeliveredCount, denominator),
      closeRate,
      lossRate: rate(lostOutcomes.length, denominator),
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
        ...accountAssignments.map((row) => row.assigned_at ?? row.created_at),
        ...accountReleases.map((row) => row.released_at ?? row.created_at),
        ...activeOutcomes.map((row) =>
          row.last_partner_action_at ?? row.updated_at ?? row.created_at
        ),
      ]),
      performanceStatus: deriveStatus(
        denominator,
        soldOutcomes.length,
        closeRate,
        attemptingContactRate,
      ),
      warnings,
      lostReasonBreakdown,
    };
  });
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
    const { data: userData, error: userError } = await anon.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userError || !userData?.user?.id) {
      return json(
        { error: "unauthenticated", message: "Invalid auth token." },
        401,
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: roleRow, error: roleError } = await admin.from("user_roles")
      .select("role").eq("id", userData.user.id).maybeSingle();
    const role = roleRow?.role === "admin" ? "super_admin" : roleRow?.role;
    if (
      roleError || !["super_admin", "operator", "viewer"].includes(role ?? "")
    ) {
      return json({
        error: "forbidden",
        message: "Internal operator access required.",
      }, 403);
    }
    const body = await req.json().catch(() => ({}));
    const requestedWindow =
      typeof body.window === "string" && VALID_WINDOWS.has(body.window)
        ? body.window as WindowValue
        : "30d";
    const cutoff = cutoffFor(requestedWindow);

    const [
      { data: accounts, error: accountError },
      { data: assignments, error: assignmentError },
      { data: releases, error: releaseError },
      { data: outcomes, error: outcomeError },
    ] = await Promise.all([
      admin.from("contractor_accounts").select(
        "id, client_slug, display_name, is_active, access_status",
      ).order("display_name", { ascending: true }),
      cutoff
        ? admin.from("lead_assignments").select(
          "id, contractor_account_id, client_slug, assigned_at, created_at",
        ).gte("assigned_at", cutoff)
        : admin.from("lead_assignments").select(
          "id, contractor_account_id, client_slug, assigned_at, created_at",
        ),
      cutoff
        ? admin.from("lead_contact_releases").select(
          "id, lead_assignment_id, contractor_account_id, client_slug, release_status, released_at, created_at",
        ).gte("released_at", cutoff)
        : admin.from("lead_contact_releases").select(
          "id, lead_assignment_id, contractor_account_id, client_slug, release_status, released_at, created_at",
        ),
      cutoff
        ? admin.from("contractor_outcomes").select(
          "id, lead_assignment_id, contractor_account_id, client_slug, disposition_state, disposition_reason_code, final_value_cents, value_basis, outcome_integrity_status, outcome_verified, outcome_verified_at, created_at, updated_at, last_partner_action_at",
        ).gte("updated_at", cutoff)
        : admin.from("contractor_outcomes").select(
          "id, lead_assignment_id, contractor_account_id, client_slug, disposition_state, disposition_reason_code, final_value_cents, value_basis, outcome_integrity_status, outcome_verified, outcome_verified_at, created_at, updated_at, last_partner_action_at",
        ),
    ]);

    if (accountError || assignmentError || releaseError || outcomeError) {
      const failedSources: string[] = [];
      if (accountError) {
        logSourceError("contractor_accounts", accountError);
        failedSources.push("contractor_accounts");
      }
      if (assignmentError) {
        logSourceError("lead_assignments", assignmentError);
        failedSources.push("lead_assignments");
      }
      if (releaseError) {
        logSourceError("lead_contact_releases", releaseError);
        failedSources.push("lead_contact_releases");
      }
      if (outcomeError) {
        logSourceError("contractor_outcomes", outcomeError);
        failedSources.push("contractor_outcomes");
      }
      return json({
        error: "performance_lookup_failed",
        message:
          "Contractor performance aggregates could not be loaded safely.",
        failed_sources: failedSources,
      }, 500);
    }

    return json({
      success: true,
      window: requestedWindow,
      denominator: "released_leads",
      summaries: buildSummary(
        (accounts ?? []) as ContractorAccount[],
        (assignments ?? []) as Assignment[],
        (releases ?? []) as Release[],
        (outcomes ?? []) as Outcome[],
      ),
    });
  } catch (error) {
    console.error("[admin-contractor-performance] unhandled", error);
    return json({
      error: "internal_error",
      message: "Contractor performance request failed safely.",
    }, 500);
  }
});
