import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { fetchRevenueDispatchReadiness, type RevenueReadinessRow } from "@/services/revenueDispatchReadiness";

export type SyndicateHealthStatus = "healthy" | "warning" | "critical" | "manual_review" | "unknown";

export interface SyndicateHealthFilters {
  syndicateId?: string;
  clientSlug?: string;
  contractorAccountId?: string;
  status?: SyndicateHealthStatus | "all";
  needsAttentionOnly?: boolean;
}

export interface AssignmentHealthSummary {
  currentAssignments: number;
  staleAssignments: number;
  manualReviewAssignments: number;
  recycledAssignments: number;
  reassignedAssignments: number;
  disputedAssignments: number;
  duplicateCurrentAssignmentRisk: number;
  missingClientSlug: number;
  missingContractorAccount: number;
  assignmentClientMismatch: number;
  unknownTimestampCount: number;
}

export interface OutcomeHealthSummary {
  soldOutcomes: number;
  lostOutcomes: number;
  disputedOutcomes: number;
  blockedOutcomes: number;
  incompleteOutcomes: number;
  manualReviewOutcomes: number;
  grossProxyValueCount: number;
  missingSoldValue: number;
  missingLostReason: number;
  contractorClientMismatch: number;
  assignmentClientMismatch: number;
}

export interface RevenueSignalHealthSummary {
  readySignals: number;
  warningSignals: number;
  blockedSignals: number;
  missingSignals: number;
  duplicateProtectedSignals: number;
  ambiguousSignals: number;
  signalSourceUnavailable: boolean;
}

export interface SyndicateHealthSummary {
  status: SyndicateHealthStatus;
  activeSyndicates: number;
  activeClients: number;
  activeContractors: number;
  currentAssignments: number;
  staleAssignments: number;
  soldOutcomes: number;
  blockedSignals: number;
  operationalActions: number;
  assignmentHealth: AssignmentHealthSummary;
  outcomeHealth: OutcomeHealthSummary;
  revenueSignalHealth: RevenueSignalHealthSummary;
  generatedAt: string;
  contextDebt: string[];
}

export interface SyndicateHealthRow {
  id: string;
  slug: string;
  name: string;
  market: string | null;
  region: string | null;
  isActive: boolean;
  status: SyndicateHealthStatus;
  reasons: string[];
  activeClients: number;
  activeContractors: number;
  currentAssignments: number;
  staleAssignments: number;
  soldOutcomes: number;
  blockedOutcomes: number;
  blockedSignals: number;
}

export interface ClientHealthRow {
  clientSlug: string;
  syndicateId: string | null;
  syndicateSlug: string | null;
  role: string | null;
  priority: number | null;
  isActive: boolean;
  status: SyndicateHealthStatus;
  reasons: string[];
  activeContractors: number;
  currentAssignments: number;
  staleAssignments: number;
  soldOutcomes: number;
  blockedOutcomes: number;
  blockedSignals: number;
}

export interface ContractorAccountHealthRow {
  id: string;
  displayName: string;
  clientSlug: string | null;
  isActive: boolean;
  status: SyndicateHealthStatus;
  reasons: string[];
  currentAssignments: number;
  staleAssignments: number;
  soldOutcomes: number;
  blockedOutcomes: number;
  manualReviewOutcomes: number;
}

export type OperationalActionType =
  | "review_stale_assignment"
  | "review_manual_assignment"
  | "review_recycled_lead"
  | "review_disputed_outcome"
  | "review_blocked_outcome"
  | "sync_missing_revenue_signal"
  | "review_blocked_revenue_signal"
  | "review_missing_client_slug"
  | "review_missing_contractor_account"
  | "review_gross_proxy_value"
  | "review_duplicate_assignment_risk"
  | "review_assignment_client_mismatch"
  | "review_outcome_client_mismatch";

export interface OperationalAction {
  id: string;
  type: OperationalActionType;
  status: SyndicateHealthStatus;
  label: string;
  entityType: "assignment" | "outcome" | "revenue_signal" | "contractor_account" | "client" | "syndicate";
  entityIdMasked: string;
  clientSlug: string | null;
  syndicateSlug: string | null;
  contractorAccountIdMasked: string | null;
  createdAt: string | null;
  reason: string;
  suggestedAction: string;
}

interface SyndicateRowRaw {
  id: string;
  slug: string;
  name: string;
  market: string | null;
  region: string | null;
  is_active: boolean;
}

interface SyndicateClientRowRaw {
  id: string;
  syndicate_id: string;
  client_slug: string;
  role: string | null;
  is_active: boolean;
  priority: number | null;
}

interface ContractorAccountRaw {
  id: string;
  display_name: string;
  client_slug: string | null;
  is_active: boolean;
}

interface AssignmentRaw {
  id: string;
  lead_id: string | null;
  scan_session_id: string | null;
  analysis_id: string | null;
  syndicate_id: string | null;
  client_slug: string | null;
  contractor_account_id: string | null;
  status: string | null;
  is_current: boolean | null;
  assigned_at: string | null;
  created_at: string | null;
}

interface OutcomeRaw {
  id: string;
  lead_assignment_id: string | null;
  client_slug: string | null;
  contractor_account_id: string | null;
  disposition_state: string | null;
  final_value_cents: number | null;
  value_basis: string | null;
  disposition_reason_code: string | null;
  outcome_notes: string | null;
  outcome_integrity_status: string | null;
  outcome_integrity_reasons: string[] | null;
  created_at: string | null;
  updated_at: string | null;
}

interface HealthData {
  syndicates: SyndicateRowRaw[];
  syndicateClients: SyndicateClientRowRaw[];
  contractorAccounts: ContractorAccountRaw[];
  assignments: AssignmentRaw[];
  outcomes: OutcomeRaw[];
  revenueRows: RevenueReadinessRow[];
  revenueUnavailable: boolean;
  contextDebt: string[];
}

const db = supabase as unknown as SupabaseClient;
const CURRENT_ASSIGNMENT_STATUSES = new Set(["assigned", "contacted", "manual_review"]);

export function maskHealthId(value: string | null | undefined): string {
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

export function formatHealthReason(reason: string): string {
  return reason.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function computeSyndicateHealthStatus(input: unknown): SyndicateHealthStatus {
  const reasons = Array.isArray(input)
    ? input.map(String)
    : typeof input === "object" && input && "reasons" in input && Array.isArray((input as { reasons?: unknown }).reasons)
      ? (input as { reasons: unknown[] }).reasons.map(String)
      : [];
  if (reasons.includes("source_unknown") || reasons.includes("required_source_unreadable")) return "unknown";
  if (reasons.some((reason) => /blocked|duplicate|missing_client_slug|missing_sold_value|missing_lost_reason|client_mismatch|contractor_client_mismatch/.test(reason))) return "critical";
  if (reasons.some((reason) => /manual_review|needs_review|ambiguous|contradictory/.test(reason))) return "manual_review";
  if (reasons.length > 0) return "warning";
  return "healthy";
}

function applyFilters<T extends { clientSlug?: string | null; status?: SyndicateHealthStatus; id?: string }>(rows: T[], filters: SyndicateHealthFilters = {}) {
  return rows.filter((row) => {
    if (filters.clientSlug && row.clientSlug !== filters.clientSlug) return false;
    if (filters.contractorAccountId && row.id !== filters.contractorAccountId) return false;
    if (filters.status && filters.status !== "all" && row.status !== filters.status) return false;
    if (filters.needsAttentionOnly && row.status === "healthy") return false;
    return true;
  });
}

function isStaleAssignment(assignment: AssignmentRaw, outcomes: OutcomeRaw[]): boolean | "unknown" {
  if (!assignment.is_current || !CURRENT_ASSIGNMENT_STATUSES.has(assignment.status ?? "")) return false;
  const hasTerminalOutcome = outcomes.some((outcome) => outcome.lead_assignment_id === assignment.id && ["sold_closed", "lost_dead"].includes(outcome.disposition_state ?? ""));
  if (hasTerminalOutcome) return false;
  if (!assignment.assigned_at) return "unknown";
  const assignedAt = new Date(assignment.assigned_at).getTime();
  if (Number.isNaN(assignedAt)) return "unknown";
  const ageDays = (Date.now() - assignedAt) / 86_400_000;
  return ageDays > (assignment.status === "manual_review" ? 14 : 7);
}

function duplicateCurrentAssignmentRisk(assignments: AssignmentRaw[]): Set<string> {
  const risk = new Set<string>();
  for (const key of ["lead_id", "scan_session_id", "analysis_id"] as const) {
    const groups = new Map<string, AssignmentRaw[]>();
    assignments.filter((row) => row.is_current && row[key]).forEach((row) => {
      const value = row[key] as string;
      groups.set(value, [...(groups.get(value) ?? []), row]);
    });
    groups.forEach((rows) => {
      if (rows.length > 1) rows.forEach((row) => risk.add(row.id));
    });
  }
  return risk;
}

function assignmentClientMismatch(assignment: AssignmentRaw, contractors: ContractorAccountRaw[]) {
  const contractor = contractors.find((row) => row.id === assignment.contractor_account_id);
  return Boolean(assignment.client_slug && contractor?.client_slug && assignment.client_slug !== contractor.client_slug);
}

function outcomeAssignmentMismatch(outcome: OutcomeRaw, assignments: AssignmentRaw[]) {
  const assignment = assignments.find((row) => row.id === outcome.lead_assignment_id);
  return Boolean(outcome.client_slug && assignment?.client_slug && outcome.client_slug !== assignment.client_slug);
}

function outcomeContractorMismatch(outcome: OutcomeRaw, contractors: ContractorAccountRaw[]) {
  const contractor = contractors.find((row) => row.id === outcome.contractor_account_id);
  return Boolean(outcome.client_slug && contractor?.client_slug && outcome.client_slug !== contractor.client_slug);
}

function clientToSyndicate(data: HealthData) {
  const map = new Map<string, { id: string; slug: string }>();
  data.syndicateClients.forEach((membership) => {
    const syndicate = data.syndicates.find((row) => row.id === membership.syndicate_id);
    if (membership.is_active && syndicate) map.set(membership.client_slug, { id: syndicate.id, slug: syndicate.slug });
  });
  return map;
}

async function fetchHealthData(): Promise<HealthData> {
  const contextDebt: string[] = [];
  const [syndicatesResult, clientsResult, contractorsResult, assignmentsResult, outcomesResult, revenueResult] = await Promise.allSettled([
    db.from("syndicates").select("id, slug, name, market, region, is_active").limit(500),
    db.from("syndicate_clients").select("id, syndicate_id, client_slug, role, is_active, priority").limit(1000),
    db.from("contractor_accounts").select("id, display_name, client_slug, is_active").limit(1000),
    db.from("lead_assignments").select("id, lead_id, scan_session_id, analysis_id, syndicate_id, client_slug, contractor_account_id, status, is_current, assigned_at, created_at").limit(1000),
    db.from("contractor_outcomes").select("id, lead_assignment_id, client_slug, contractor_account_id, disposition_state, final_value_cents, value_basis, disposition_reason_code, outcome_notes, outcome_integrity_status, outcome_integrity_reasons, created_at, updated_at").limit(1000),
    fetchRevenueDispatchReadiness(),
  ]);

  function unwrap<T>(result: PromiseSettledResult<{ data: unknown; error: unknown }>, label: string): T[] {
    if (result.status === "rejected") {
      contextDebt.push(`${label}_unreadable`);
      return [];
    }
    if (result.value.error) {
      contextDebt.push(`${label}_unreadable`);
      return [];
    }
    return (result.value.data ?? []) as T[];
  }

  let revenueRows: RevenueReadinessRow[] = [];
  let revenueUnavailable = false;
  if (revenueResult.status === "fulfilled") {
    revenueRows = revenueResult.value.rows;
  } else {
    revenueUnavailable = true;
    contextDebt.push("revenue_dispatch_readiness_unreadable");
  }

  return {
    syndicates: unwrap<SyndicateRowRaw>(syndicatesResult, "syndicates"),
    syndicateClients: unwrap<SyndicateClientRowRaw>(clientsResult, "syndicate_clients"),
    contractorAccounts: unwrap<ContractorAccountRaw>(contractorsResult, "contractor_accounts"),
    assignments: unwrap<AssignmentRaw>(assignmentsResult, "lead_assignments"),
    outcomes: unwrap<OutcomeRaw>(outcomesResult, "contractor_outcomes"),
    revenueRows,
    revenueUnavailable,
    contextDebt,
  };
}

function buildSummary(data: HealthData): SyndicateHealthSummary {
  const duplicateRisk = duplicateCurrentAssignmentRisk(data.assignments);
  const staleStates = data.assignments.map((assignment) => isStaleAssignment(assignment, data.outcomes));
  const currentAssignments = data.assignments.filter((row) => row.is_current);
  const assignmentHealth: AssignmentHealthSummary = {
    currentAssignments: currentAssignments.length,
    staleAssignments: staleStates.filter(Boolean).length,
    manualReviewAssignments: currentAssignments.filter((row) => row.status === "manual_review").length,
    recycledAssignments: data.assignments.filter((row) => row.status === "recycled").length,
    reassignedAssignments: data.assignments.filter((row) => row.status === "reassigned").length,
    disputedAssignments: data.assignments.filter((row) => row.status === "disputed").length,
    duplicateCurrentAssignmentRisk: duplicateRisk.size,
    missingClientSlug: currentAssignments.filter((row) => !row.client_slug).length,
    missingContractorAccount: currentAssignments.filter((row) => !row.contractor_account_id).length,
    assignmentClientMismatch: currentAssignments.filter((row) => assignmentClientMismatch(row, data.contractorAccounts)).length,
    unknownTimestampCount: staleStates.filter((value) => value === "unknown").length,
  };
  const outcomeHealth: OutcomeHealthSummary = {
    soldOutcomes: data.outcomes.filter((row) => row.disposition_state === "sold_closed").length,
    lostOutcomes: data.outcomes.filter((row) => row.disposition_state === "lost_dead").length,
    disputedOutcomes: data.outcomes.filter((row) => row.disposition_state === "disputed").length,
    blockedOutcomes: data.outcomes.filter((row) => row.outcome_integrity_status === "blocked").length,
    incompleteOutcomes: data.outcomes.filter((row) => !["sold_closed", "lost_dead"].includes(row.disposition_state ?? "")).length,
    manualReviewOutcomes: data.outcomes.filter((row) => ["manual_review", "needs_review"].includes(row.outcome_integrity_status ?? "") || row.disposition_state === "manual_review").length,
    grossProxyValueCount: data.outcomes.filter((row) => row.value_basis === "gross_sale_value").length,
    missingSoldValue: data.outcomes.filter((row) => row.disposition_state === "sold_closed" && (!row.final_value_cents || row.final_value_cents <= 0)).length,
    missingLostReason: data.outcomes.filter((row) => row.disposition_state === "lost_dead" && !row.disposition_reason_code && !row.outcome_notes).length,
    contractorClientMismatch: data.outcomes.filter((row) => outcomeContractorMismatch(row, data.contractorAccounts)).length,
    assignmentClientMismatch: data.outcomes.filter((row) => outcomeAssignmentMismatch(row, data.assignments)).length,
  };
  const revenueSignalHealth: RevenueSignalHealthSummary = {
    readySignals: data.revenueRows.filter((row) => row.status === "ready").length,
    warningSignals: data.revenueRows.filter((row) => row.status === "warning").length,
    blockedSignals: data.revenueRows.filter((row) => row.status === "blocked").length,
    missingSignals: data.outcomes.filter((outcome) => outcome.disposition_state === "sold_closed" && !data.revenueRows.some((row) => row.context.contractorOutcomeId === outcome.id)).length,
    duplicateProtectedSignals: data.revenueRows.filter((row) => row.context.contractorOutcomeId).length,
    ambiguousSignals: data.revenueRows.filter((row) => row.reasons.includes("historical_payload_missing_integrity_metadata")).length,
    signalSourceUnavailable: data.revenueUnavailable,
  };

  const reasons: string[] = [];
  if (data.contextDebt.length) reasons.push("source_unknown");
  if (assignmentHealth.duplicateCurrentAssignmentRisk) reasons.push("duplicate_current_assignment_risk");
  if (assignmentHealth.missingClientSlug) reasons.push("missing_client_slug");
  if (assignmentHealth.assignmentClientMismatch) reasons.push("assignment_client_mismatch");
  if (outcomeHealth.blockedOutcomes) reasons.push("blocked_outcomes");
  if (outcomeHealth.missingSoldValue) reasons.push("sold_outcome_missing_value");
  if (outcomeHealth.missingLostReason) reasons.push("lost_outcome_missing_reason");
  if (outcomeHealth.contractorClientMismatch || outcomeHealth.assignmentClientMismatch) reasons.push("outcome_client_mismatch");
  if (revenueSignalHealth.blockedSignals) reasons.push("blocked_revenue_signal");
  if (assignmentHealth.manualReviewAssignments || outcomeHealth.manualReviewOutcomes || revenueSignalHealth.ambiguousSignals) reasons.push("manual_review_required");
  if (assignmentHealth.staleAssignments) reasons.push("stale_assignments");
  if (outcomeHealth.grossProxyValueCount) reasons.push("gross_proxy_value_used");
  if (revenueSignalHealth.signalSourceUnavailable) reasons.push("signal_source_unavailable");

  return {
    status: computeSyndicateHealthStatus(reasons),
    activeSyndicates: data.syndicates.filter((row) => row.is_active).length,
    activeClients: data.syndicateClients.filter((row) => row.is_active).length,
    activeContractors: data.contractorAccounts.filter((row) => row.is_active).length,
    currentAssignments: assignmentHealth.currentAssignments,
    staleAssignments: assignmentHealth.staleAssignments,
    soldOutcomes: outcomeHealth.soldOutcomes,
    blockedSignals: revenueSignalHealth.blockedSignals,
    operationalActions: buildActions(data).length,
    assignmentHealth,
    outcomeHealth,
    revenueSignalHealth,
    generatedAt: new Date().toISOString(),
    contextDebt: data.contextDebt,
  };
}

function rowStatus(reasons: string[]) {
  return computeSyndicateHealthStatus(reasons);
}

function buildSyndicateRows(data: HealthData): SyndicateHealthRow[] {
  return data.syndicates.map((syndicate) => {
    const clients = data.syndicateClients.filter((row) => row.syndicate_id === syndicate.id && row.is_active).map((row) => row.client_slug);
    const contractors = data.contractorAccounts.filter((row) => row.is_active && clients.includes(row.client_slug ?? ""));
    const assignments = data.assignments.filter((row) => row.is_current && (row.syndicate_id === syndicate.id || clients.includes(row.client_slug ?? "")));
    const outcomes = data.outcomes.filter((row) => clients.includes(row.client_slug ?? ""));
    const revenueRows = data.revenueRows.filter((row) => clients.includes(row.clientSlug ?? ""));
    const reasons: string[] = [];
    if (assignments.some((row) => !row.client_slug)) reasons.push("missing_client_slug");
    if (assignments.some((row) => assignmentClientMismatch(row, data.contractorAccounts))) reasons.push("assignment_client_mismatch");
    if (outcomes.some((row) => row.outcome_integrity_status === "blocked")) reasons.push("blocked_outcomes");
    if (outcomes.some((row) => ["manual_review", "needs_review"].includes(row.outcome_integrity_status ?? ""))) reasons.push("manual_review_required");
    if (revenueRows.some((row) => row.status === "blocked")) reasons.push("blocked_revenue_signal");
    if (assignments.some((row) => isStaleAssignment(row, data.outcomes) === true)) reasons.push("stale_assignments");
    return {
      id: syndicate.id,
      slug: syndicate.slug,
      name: syndicate.name,
      market: syndicate.market,
      region: syndicate.region,
      isActive: syndicate.is_active,
      status: rowStatus(reasons),
      reasons,
      activeClients: clients.length,
      activeContractors: contractors.length,
      currentAssignments: assignments.length,
      staleAssignments: assignments.filter((row) => isStaleAssignment(row, data.outcomes) === true).length,
      soldOutcomes: outcomes.filter((row) => row.disposition_state === "sold_closed").length,
      blockedOutcomes: outcomes.filter((row) => row.outcome_integrity_status === "blocked").length,
      blockedSignals: revenueRows.filter((row) => row.status === "blocked").length,
    };
  });
}

function buildClientRows(data: HealthData): ClientHealthRow[] {
  const syndicateMap = new Map(data.syndicates.map((row) => [row.id, row.slug]));
  return data.syndicateClients.map((membership) => {
    const contractors = data.contractorAccounts.filter((row) => row.client_slug === membership.client_slug && row.is_active);
    const assignments = data.assignments.filter((row) => row.client_slug === membership.client_slug && row.is_current);
    const outcomes = data.outcomes.filter((row) => row.client_slug === membership.client_slug);
    const revenueRows = data.revenueRows.filter((row) => row.clientSlug === membership.client_slug);
    const reasons: string[] = [];
    if (assignments.some((row) => row.syndicate_id && row.syndicate_id !== membership.syndicate_id)) reasons.push("assignment_client_not_in_syndicate");
    if (assignments.some((row) => assignmentClientMismatch(row, data.contractorAccounts))) reasons.push("assignment_client_mismatch");
    if (outcomes.some((row) => row.outcome_integrity_status === "blocked")) reasons.push("blocked_outcomes");
    if (outcomes.some((row) => ["manual_review", "needs_review"].includes(row.outcome_integrity_status ?? ""))) reasons.push("manual_review_required");
    if (revenueRows.some((row) => row.status === "blocked")) reasons.push("blocked_revenue_signal");
    if (assignments.some((row) => isStaleAssignment(row, data.outcomes) === true)) reasons.push("stale_assignments");
    return {
      clientSlug: membership.client_slug,
      syndicateId: membership.syndicate_id,
      syndicateSlug: syndicateMap.get(membership.syndicate_id) ?? null,
      role: membership.role,
      priority: membership.priority,
      isActive: membership.is_active,
      status: rowStatus(reasons),
      reasons,
      activeContractors: contractors.length,
      currentAssignments: assignments.length,
      staleAssignments: assignments.filter((row) => isStaleAssignment(row, data.outcomes) === true).length,
      soldOutcomes: outcomes.filter((row) => row.disposition_state === "sold_closed").length,
      blockedOutcomes: outcomes.filter((row) => row.outcome_integrity_status === "blocked").length,
      blockedSignals: revenueRows.filter((row) => row.status === "blocked").length,
    };
  });
}

function buildContractorRows(data: HealthData): ContractorAccountHealthRow[] {
  return data.contractorAccounts.map((contractor) => {
    const assignments = data.assignments.filter((row) => row.contractor_account_id === contractor.id && row.is_current);
    const outcomes = data.outcomes.filter((row) => row.contractor_account_id === contractor.id);
    const reasons: string[] = [];
    if (!contractor.client_slug) reasons.push("missing_client_slug");
    if (!contractor.is_active && assignments.length) reasons.push("inactive_with_current_assignments");
    if (assignments.some((row) => row.client_slug !== contractor.client_slug)) reasons.push("assignment_client_mismatch");
    if (outcomes.some((row) => row.client_slug !== contractor.client_slug)) reasons.push("outcome_client_mismatch");
    if (outcomes.some((row) => row.outcome_integrity_status === "blocked")) reasons.push("blocked_outcomes");
    if (outcomes.some((row) => ["manual_review", "needs_review"].includes(row.outcome_integrity_status ?? ""))) reasons.push("manual_review_required");
    if (assignments.some((row) => isStaleAssignment(row, data.outcomes) === true)) reasons.push("stale_assignments");
    return {
      id: contractor.id,
      displayName: contractor.display_name,
      clientSlug: contractor.client_slug,
      isActive: contractor.is_active,
      status: rowStatus(reasons),
      reasons,
      currentAssignments: assignments.length,
      staleAssignments: assignments.filter((row) => isStaleAssignment(row, data.outcomes) === true).length,
      soldOutcomes: outcomes.filter((row) => row.disposition_state === "sold_closed").length,
      blockedOutcomes: outcomes.filter((row) => row.outcome_integrity_status === "blocked").length,
      manualReviewOutcomes: outcomes.filter((row) => ["manual_review", "needs_review"].includes(row.outcome_integrity_status ?? "")).length,
    };
  });
}

function buildActions(data: HealthData): OperationalAction[] {
  const actions: OperationalAction[] = [];
  const syndicateByClient = clientToSyndicate(data);
  const duplicateRisk = duplicateCurrentAssignmentRisk(data.assignments);
  const pushAction = (action: Omit<OperationalAction, "id">) => actions.push({ ...action, id: `${action.type}:${action.entityType}:${action.entityIdMasked}:${actions.length}` });

  data.assignments.filter((row) => row.is_current).forEach((assignment) => {
    const syndicate = assignment.client_slug ? syndicateByClient.get(assignment.client_slug) : null;
    const base = { entityType: "assignment" as const, entityIdMasked: maskHealthId(assignment.id), clientSlug: assignment.client_slug, syndicateSlug: syndicate?.slug ?? null, contractorAccountIdMasked: maskHealthId(assignment.contractor_account_id), createdAt: assignment.assigned_at ?? assignment.created_at };
    if (isStaleAssignment(assignment, data.outcomes) === true) pushAction({ ...base, type: "review_stale_assignment", status: "warning", label: "Review stale assignment", reason: "Current assignment has no terminal outcome past threshold.", suggestedAction: "Inspect contact history and decide whether to recycle, reassign, or keep in manual review." });
    if (assignment.status === "manual_review") pushAction({ ...base, type: "review_manual_assignment", status: "manual_review", label: "Review manual assignment", reason: "Assignment is in manual_review.", suggestedAction: "Resolve routing ambiguity before contractor-facing access is considered." });
    if (assignment.status === "recycled") pushAction({ ...base, type: "review_recycled_lead", status: "warning", label: "Review recycled lead", reason: "Assignment has been recycled.", suggestedAction: "Confirm the next current owner is present and tenant-scoped." });
    if (!assignment.client_slug) pushAction({ ...base, type: "review_missing_client_slug", status: "critical", label: "Review missing client_slug", reason: "Current assignment is missing tenant scope.", suggestedAction: "Repair source ownership through the routing service; do not mutate records from this dashboard." });
    if (!assignment.contractor_account_id) pushAction({ ...base, type: "review_missing_contractor_account", status: "warning", label: "Review missing contractor account", reason: "Current assignment lacks contractor account context.", suggestedAction: "Confirm whether this is intentionally unassigned or needs routing." });
    if (duplicateRisk.has(assignment.id)) pushAction({ ...base, type: "review_duplicate_assignment_risk", status: "critical", label: "Review duplicate current assignment risk", reason: "More than one current assignment exists for the same identity.", suggestedAction: "Use the routing service to preserve one current owner and audit the transition." });
    if (assignmentClientMismatch(assignment, data.contractorAccounts)) pushAction({ ...base, type: "review_assignment_client_mismatch", status: "critical", label: "Review assignment/client mismatch", reason: "Assignment client_slug does not match contractor account client_slug.", suggestedAction: "Block contractor-facing surfaces until assignment ownership is repaired." });
  });

  data.outcomes.forEach((outcome) => {
    const syndicate = outcome.client_slug ? syndicateByClient.get(outcome.client_slug) : null;
    const base = { entityType: "outcome" as const, entityIdMasked: maskHealthId(outcome.id), clientSlug: outcome.client_slug, syndicateSlug: syndicate?.slug ?? null, contractorAccountIdMasked: maskHealthId(outcome.contractor_account_id), createdAt: outcome.updated_at ?? outcome.created_at };
    if (outcome.disposition_state === "disputed") pushAction({ ...base, type: "review_disputed_outcome", status: "critical", label: "Review disputed outcome", reason: "Outcome is disputed.", suggestedAction: "Resolve dispute before revenue signal or reporting use." });
    if (outcome.outcome_integrity_status === "blocked") pushAction({ ...base, type: "review_blocked_outcome", status: "critical", label: "Review blocked outcome", reason: "Outcome integrity is blocked.", suggestedAction: "Inspect outcome integrity reasons; contractor_outcomes remains revenue truth." });
    if (outcome.value_basis === "gross_sale_value") pushAction({ ...base, type: "review_gross_proxy_value", status: "warning", label: "Review gross proxy value", reason: "Sold value uses gross proxy value rather than true margin.", suggestedAction: "Confirm value basis before using for optimization decisions." });
    if (outcomeAssignmentMismatch(outcome, data.assignments) || outcomeContractorMismatch(outcome, data.contractorAccounts)) pushAction({ ...base, type: "review_outcome_client_mismatch", status: "critical", label: "Review outcome/client mismatch", reason: "Outcome tenant context differs from assignment or contractor context.", suggestedAction: "Do not expose or report this outcome externally until repaired." });
    if (outcome.disposition_state === "sold_closed" && !data.revenueRows.some((row) => row.context.contractorOutcomeId === outcome.id)) pushAction({ ...base, type: "sync_missing_revenue_signal", status: "manual_review", label: "Review missing revenue signal", reason: "Sold outcome has no internal outcome-derived sold signal visible in readiness.", suggestedAction: "Run the approved internal sync path after confirming eligibility; no live dispatch." });
  });

  data.revenueRows.filter((row) => row.status === "blocked").forEach((row) => {
    pushAction({
      type: "review_blocked_revenue_signal",
      status: "critical",
      label: "Review blocked revenue signal",
      entityType: "revenue_signal",
      entityIdMasked: maskHealthId(row.id),
      clientSlug: row.clientSlug,
      syndicateSlug: row.clientSlug ? syndicateByClient.get(row.clientSlug)?.slug ?? null : null,
      contractorAccountIdMasked: maskHealthId(row.context.contractorOutcomeId),
      createdAt: row.createdAt,
      reason: row.reasons.map(formatHealthReason).join(", ") || "Revenue signal is blocked.",
      suggestedAction: "Repair source outcome/readiness metadata before any external dispatch phase.",
    });
  });

  return actions;
}

export async function fetchSyndicateHealthSummary(filters: SyndicateHealthFilters = {}): Promise<SyndicateHealthSummary> {
  const data = await fetchHealthData();
  const summary = buildSummary(data);
  if (filters.needsAttentionOnly && summary.status === "healthy") return { ...summary, operationalActions: 0 };
  return summary;
}

export async function fetchSyndicateHealthRows(filters: SyndicateHealthFilters = {}): Promise<SyndicateHealthRow[]> {
  const data = await fetchHealthData();
  return applyFilters(buildSyndicateRows(data), filters).filter((row) => !filters.syndicateId || row.id === filters.syndicateId);
}

export async function fetchClientHealthRows(filters: SyndicateHealthFilters = {}): Promise<ClientHealthRow[]> {
  const data = await fetchHealthData();
  return applyFilters(buildClientRows(data), filters).filter((row) => !filters.syndicateId || row.syndicateId === filters.syndicateId);
}

export async function fetchContractorAccountHealthRows(filters: SyndicateHealthFilters = {}): Promise<ContractorAccountHealthRow[]> {
  const data = await fetchHealthData();
  return applyFilters(buildContractorRows(data), filters);
}

export async function fetchOperationalActionQueue(filters: SyndicateHealthFilters = {}): Promise<OperationalAction[]> {
  const data = await fetchHealthData();
  return buildActions(data).filter((action) => {
    if (filters.clientSlug && action.clientSlug !== filters.clientSlug) return false;
    if (filters.contractorAccountId && action.contractorAccountIdMasked !== maskHealthId(filters.contractorAccountId)) return false;
    if (filters.status && filters.status !== "all" && action.status !== filters.status) return false;
    return true;
  });
}
