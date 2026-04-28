import { validateAdminRequestWithRole, corsHeaders, errorResponse } from "../_shared/adminAuth.ts";

const VALID_WINDOWS = new Set(["7d", "30d", "90d", "all"]);
const CONTACTED_STATES = new Set(["contacted", "meeting_scheduled", "scheduled", "quote_delivered", "sold_closed", "lost_dead"]);
const SCHEDULED_STATES = new Set(["meeting_scheduled", "scheduled", "quote_delivered", "sold_closed", "lost_dead"]);
const PROPOSAL_STATES = new Set(["quote_delivered", "sold_closed"]);
const TERMINAL_LOST_STATES = new Set(["lost_dead"]);
const APPROVED_RELEASE_STATES = new Set(["approved", "released"]);

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type WindowValue = "7d" | "30d" | "90d" | "all";
type ContractorAccount = { id: string; client_slug: string; display_name: string; is_active: boolean | null; access_status: string | null };
type Assignment = { id: string; contractor_account_id: string | null; client_slug: string; assigned_at: string | null; created_at: string };
type Release = { id: string; lead_assignment_id: string; contractor_account_id: string; client_slug: string; release_status: string; approved_at: string | null; created_at: string };
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
  performanceStatus: "insufficient_data" | "healthy" | "watch" | "coach" | "pause";
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

function deriveStatus(releasedCount: number, soldCount: number, closeRate: number | null, attemptingContactRate: number | null): Metrics["performanceStatus"] {
  if (releasedCount < 5) return "insufficient_data";
  if (releasedCount >= 10 && soldCount === 0) return "pause";
  if ((attemptingContactRate ?? 0) > 0.7) return "pause";
  if (releasedCount >= 5 && (attemptingContactRate ?? 0) > 0.5) return "coach";
  if ((closeRate ?? 0) < 0.1 || (attemptingContactRate ?? 0) > 0.35) return "watch";
  if ((closeRate ?? 0) >= 0.2 && (attemptingContactRate ?? 0) <= 0.25) return "healthy";
  return "watch";
}

function safeDateMax(values: Array<string | null | undefined>): string | null {
  const times = values.filter(Boolean).map((value) => new Date(value as string).getTime()).filter(Number.isFinite);
  if (times.length === 0) return null;
  return new Date(Math.max(...times)).toISOString();
}

function buildSummary(accounts: ContractorAccount[], assignments: Assignment[], releases: Release[], outcomes: Outcome[]): Metrics[] {
  return accounts.map((account) => {
    const accountAssignments = assignments.filter((row) => row.contractor_account_id === account.id && row.client_slug === account.client_slug);
    const assignmentById = new Map(accountAssignments.map((row) => [row.id, row]));
    const accountReleases = releases.filter((row) => row.contractor_account_id === account.id && row.client_slug === account.client_slug && APPROVED_RELEASE_STATES.has(row.release_status));
    const activeOutcomes = outcomes.filter((row) => row.contractor_account_id === account.id && row.client_slug === account.client_slug && row.lead_assignment_id && assignmentById.has(row.lead_assignment_id));

    const attemptingContactCount = activeOutcomes.filter((row) => row.disposition_state === "attempting_contact").length;
    const contactedCount = activeOutcomes.filter((row) => CONTACTED_STATES.has(row.disposition_state)).length;
    const scheduledCount = activeOutcomes.filter((row) => SCHEDULED_STATES.has(row.disposition_state)).length;
    const quoteDeliveredCount = activeOutcomes.filter((row) => PROPOSAL_STATES.has(row.disposition_state)).length;
    const soldOutcomes = activeOutcomes.filter((row) => row.disposition_state === "sold_closed" && row.final_value_cents != null && row.final_value_cents > 0 && (row.outcome_verified === true || row.outcome_integrity_status === "valid" || row.outcome_integrity_status === "verified"));
    const lostOutcomes = activeOutcomes.filter((row) => TERMINAL_LOST_STATES.has(row.disposition_state));
    const manualReviewCount = activeOutcomes.filter((row) => ["needs_review", "manual_review", "disputed"].includes(row.outcome_integrity_status ?? "")).length;

    const confirmedSoldValueCents = soldOutcomes.filter((row) => row.value_basis === "contract_total" || row.value_basis === "gross_sale_value").reduce((sum, row) => sum + (row.final_value_cents ?? 0), 0);
    const estimatedSoldValueCents = soldOutcomes.filter((row) => row.value_basis === "estimated_contract_value").reduce((sum, row) => sum + (row.final_value_cents ?? 0), 0);
    const marginValueCents = soldOutcomes.filter((row) => row.value_basis === "true_margin").reduce((sum, row) => sum + (row.final_value_cents ?? 0), 0);
    const denominator = accountReleases.length;
    const closeRate = rate(soldOutcomes.length, denominator);
    const attemptingContactRate = rate(attemptingContactCount, denominator);

    const firstUpdateHours = activeOutcomes
      .map((outcome) => {
        const assignment = outcome.lead_assignment_id ? assignmentById.get(outcome.lead_assignment_id) : null;
        if (!assignment) return null;
        const assignedAt = new Date(assignment.assigned_at ?? assignment.created_at).getTime();
        const updateAt = new Date(outcome.last_partner_action_at ?? outcome.updated_at ?? outcome.created_at).getTime();
        return Number.isFinite(assignedAt) && Number.isFinite(updateAt) && updateAt >= assignedAt ? (updateAt - assignedAt) / 36e5 : null;
      })
      .filter((value): value is number => value != null);

    const lostReasonBreakdown = lostOutcomes.reduce<Record<string, number>>((acc, row) => {
      const key = row.disposition_reason_code ?? "unspecified";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const warnings: string[] = [];
    if (estimatedSoldValueCents > 0) warnings.push("estimated_contract_value_included_separately");
    if (marginValueCents > 0) warnings.push("true_margin_value_separated_from_gross_sale");
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
      averageTimeToFirstUpdateHours: firstUpdateHours.length ? firstUpdateHours.reduce((sum, value) => sum + value, 0) / firstUpdateHours.length : null,
      lastActivityAt: safeDateMax([...accountAssignments.map((row) => row.assigned_at ?? row.created_at), ...accountReleases.map((row) => row.approved_at ?? row.created_at), ...activeOutcomes.map((row) => row.last_partner_action_at ?? row.updated_at ?? row.created_at)]),
      performanceStatus: deriveStatus(denominator, soldOutcomes.length, closeRate, attemptingContactRate),
      warnings,
      lostReasonBreakdown,
    };
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse(405, "method_not_allowed", "POST required.");

  const validation = await validateAdminRequestWithRole(req, ["super_admin", "operator", "viewer"]);
  if (!validation.ok) return validation.response;

  try {
    const body = await req.json().catch(() => ({}));
    const requestedWindow = typeof body.window === "string" && VALID_WINDOWS.has(body.window) ? body.window as WindowValue : "30d";
    const cutoff = cutoffFor(requestedWindow);
    const admin = validation.supabaseAdmin;

    const [{ data: accounts, error: accountError }, { data: assignments, error: assignmentError }, { data: releases, error: releaseError }, { data: outcomes, error: outcomeError }] = await Promise.all([
      admin.from("contractor_accounts").select("id, client_slug, display_name, is_active, access_status").order("display_name", { ascending: true }),
      cutoff ? admin.from("lead_assignments").select("id, contractor_account_id, client_slug, assigned_at, created_at").gte("assigned_at", cutoff) : admin.from("lead_assignments").select("id, contractor_account_id, client_slug, assigned_at, created_at"),
      cutoff ? admin.from("lead_contact_releases").select("id, lead_assignment_id, contractor_account_id, client_slug, release_status, approved_at, created_at").gte("created_at", cutoff) : admin.from("lead_contact_releases").select("id, lead_assignment_id, contractor_account_id, client_slug, release_status, approved_at, created_at"),
      cutoff ? admin.from("contractor_outcomes").select("id, lead_assignment_id, contractor_account_id, client_slug, disposition_state, disposition_reason_code, final_value_cents, value_basis, outcome_integrity_status, outcome_verified, outcome_verified_at, created_at, updated_at, last_partner_action_at").gte("updated_at", cutoff) : admin.from("contractor_outcomes").select("id, lead_assignment_id, contractor_account_id, client_slug, disposition_state, disposition_reason_code, final_value_cents, value_basis, outcome_integrity_status, outcome_verified, outcome_verified_at, created_at, updated_at, last_partner_action_at"),
    ]);

    if (accountError || assignmentError || releaseError || outcomeError) {
      console.error("[admin-contractor-performance] source lookup failed", { accountError, assignmentError, releaseError, outcomeError });
      return errorResponse(500, "performance_lookup_failed", "Contractor performance aggregates could not be loaded safely.");
    }

    return json({ success: true, window: requestedWindow, denominator: "released_leads", summaries: buildSummary((accounts ?? []) as ContractorAccount[], (assignments ?? []) as Assignment[], (releases ?? []) as Release[], (outcomes ?? []) as Outcome[]) });
  } catch (error) {
    console.error("[admin-contractor-performance] unhandled", error);
    return errorResponse(500, "internal_error", "Contractor performance request failed safely.");
  }
});
