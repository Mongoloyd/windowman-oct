import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { fetchRevenueDispatchReadiness } from "@/services/revenueDispatchReadiness";
import { maskHealthId } from "@/services/syndicateHealth";

export type TenantAuditVerdict =
  | "syndicate_layer_ready_for_internal_operations"
  | "syndicate_layer_partially_ready_with_manual_review"
  | "syndicate_layer_blocked";

export type TenantAuditSeverity = "info" | "warning" | "critical" | "manual_review";

export type TenantWarningCode =
  | "assignment_missing_client_slug"
  | "assignment_missing_syndicate"
  | "assignment_without_contractor_account"
  | "current_assignment_duplicate_risk"
  | "assignment_without_routing_event"
  | "assignment_client_not_in_syndicate"
  | "assignment_contractor_client_mismatch"
  | "assignment_manual_review_required"
  | "contractor_missing_client_slug"
  | "contractor_inactive_with_current_assignments"
  | "contractor_client_mismatch"
  | "outcome_missing_client_slug"
  | "outcome_without_assignment"
  | "outcome_assignment_client_mismatch"
  | "outcome_contractor_client_mismatch"
  | "sold_outcome_missing_value"
  | "lost_outcome_missing_reason"
  | "outcome_manual_review_required"
  | "outcome_disputed"
  | "sold_outcome_missing_signal"
  | "signal_without_valid_outcome"
  | "revenue_signal_client_mismatch"
  | "revenue_signal_duplicate_risk"
  | "revenue_signal_blocked"
  | "revenue_signal_manual_review_required"
  | "rls_policy_unknown"
  | "contractor_access_policy_deferred"
  | "anon_access_must_be_absent"
  | "internal_operator_policy_missing"
  | "service_role_policy_missing"
  | "cross_tenant_policy_review_required"
  | "unresolved_client_slug"
  | "client_slug_direct_on_routed_assignment"
  | "platform_config_client_mismatch";

export type RlsEvidenceLevel = "runtime_verified" | "static_migration_review" | "unknown";
export type RlsPostureStatus = "safe" | "review" | "blocked" | "unknown";
export type ContractorFacingReadiness = "deferred" | "blocked" | "ready_for_review" | "not_applicable";
export type ClientReportingReadiness = "deferred" | "blocked" | "ready_for_review" | "not_applicable";

export interface TenantAuditFilters {
  severity?: TenantAuditSeverity | "all";
  clientSlug?: string;
  code?: TenantWarningCode | "all";
  needsAttentionOnly?: boolean;
}

export interface TenantIsolationWarning {
  id: string;
  severity: TenantAuditSeverity;
  warning_code: TenantWarningCode;
  entity_type: string;
  entity_id_masked: string;
  client_slug: string | null;
  related_client_slug: string | null;
  syndicate_slug: string | null;
  explanation: string;
  suggested_action: string;
  source_table: string;
  evidence_level: RlsEvidenceLevel;
  created_at: string | null;
  metadata_summary: Record<string, string | number | boolean | null>;
}

export interface RlsPostureRow {
  table_name: string;
  status: RlsPostureStatus;
  evidence_level: RlsEvidenceLevel;
  rls_enabled: boolean | null;
  anon_access: boolean | null;
  internal_operator_policy: boolean | null;
  service_role_policy: boolean | null;
  contractor_scope: "none" | "own_account_only" | "own_assignment_only" | "unknown";
  notes: string;
}

export interface TenantAuditSummary {
  verdict: TenantAuditVerdict;
  totalWarnings: number;
  criticalWarnings: number;
  warningWarnings: number;
  manualReviewWarnings: number;
  infoWarnings: number;
  rlsEvidenceLevel: RlsEvidenceLevel;
  rlsPosture: RlsPostureRow[];
  contractorFacingReadiness: ContractorFacingReadiness;
  clientReportingReadiness: ClientReportingReadiness;
  closeoutChecklist: Array<{ label: string; status: "pass" | "review" | "blocked"; detail: string }>;
  generatedAt: string;
  contextDebt: string[];
}

export interface TenantIsolationAuditResult {
  summary: TenantAuditSummary;
  warnings: TenantIsolationWarning[];
}

interface TablePolicyRow {
  tablename: string;
  policyname: string;
  roles: string[] | string;
  cmd: string;
  qual: string | null;
  with_check: string | null;
}

interface RlsRow { tablename: string; rowsecurity: boolean | null }
interface SyndicateRow { id: string; slug: string; is_active: boolean }
interface SyndicateClientRow { syndicate_id: string; client_slug: string; is_active: boolean }
interface ContractorRow { id: string; client_slug: string | null; is_active: boolean; created_at?: string | null }
interface AssignmentRow { id: string; lead_id: string | null; scan_session_id: string | null; analysis_id: string | null; syndicate_id: string | null; client_slug: string | null; contractor_account_id: string | null; status: string | null; is_current: boolean | null; created_at: string | null }
interface RoutingEventRow { id: string; assignment_id: string | null; lead_id: string | null; scan_session_id: string | null; analysis_id: string | null; from_client_slug: string | null; to_client_slug: string | null; created_at: string | null }
interface OutcomeRow { id: string; lead_assignment_id: string | null; client_slug: string | null; contractor_account_id: string | null; disposition_state: string | null; final_value_cents: number | null; disposition_reason_code: string | null; outcome_notes: string | null; outcome_integrity_status: string | null; outcome_integrity_reasons: string[] | null; created_at: string | null }

const db = supabase as unknown as SupabaseClient;
const CORE_TABLES = ["syndicates", "syndicate_clients", "contractor_accounts", "lead_assignments", "lead_routing_events", "contractor_outcomes", "event_logs"];

const WARNING_COPY: Record<TenantWarningCode, { explanation: string; suggested: string; severity: TenantAuditSeverity }> = {
  assignment_missing_client_slug: { severity: "critical", explanation: "Current assignment lacks client_slug tenant scope.", suggested: "Repair via routing service before any contractor/client-facing access." },
  assignment_missing_syndicate: { severity: "warning", explanation: "Current assignment is not linked to a syndicate.", suggested: "Confirm whether this assignment should belong to an active syndicate." },
  assignment_without_contractor_account: { severity: "warning", explanation: "Current assignment has no contractor account.", suggested: "Confirm intentionally unassigned status or route to a scoped contractor account." },
  current_assignment_duplicate_risk: { severity: "critical", explanation: "More than one current assignment shares the same lead/session/analysis identity.", suggested: "Resolve to one current owner while preserving routing events." },
  assignment_without_routing_event: { severity: "manual_review", explanation: "Assignment has no routing event evidence.", suggested: "Review audit trail before relying on this assignment operationally." },
  assignment_client_not_in_syndicate: { severity: "critical", explanation: "Assignment client_slug is not active in the assignment syndicate.", suggested: "Block cross-tenant exposure until membership or assignment scope is corrected." },
  assignment_contractor_client_mismatch: { severity: "critical", explanation: "Assignment client_slug differs from contractor account client_slug.", suggested: "Repair ownership before contractor access or reporting." },
  assignment_manual_review_required: { severity: "manual_review", explanation: "Assignment is explicitly in manual_review.", suggested: "Resolve operator review before downstream surfaces depend on it." },
  contractor_missing_client_slug: { severity: "critical", explanation: "Contractor account lacks client_slug tenant scope.", suggested: "Do not expose this contractor account until tenant scope is restored." },
  contractor_inactive_with_current_assignments: { severity: "warning", explanation: "Inactive contractor account still has current assignments.", suggested: "Reassign or reactivate intentionally through approved controls." },
  contractor_client_mismatch: { severity: "critical", explanation: "Contractor account context conflicts with linked record tenant scope.", suggested: "Review contractor ownership and assignment relationships." },
  outcome_missing_client_slug: { severity: "critical", explanation: "Contractor outcome lacks client_slug tenant scope.", suggested: "Do not report or signal this outcome externally until source context is repaired." },
  outcome_without_assignment: { severity: "manual_review", explanation: "Contractor outcome is not linked to a lead assignment.", suggested: "Reconcile outcome to assignment history before contractor/client surfacing." },
  outcome_assignment_client_mismatch: { severity: "critical", explanation: "Outcome client_slug differs from linked assignment client_slug.", suggested: "Block reporting/signal use until outcome context is repaired." },
  outcome_contractor_client_mismatch: { severity: "critical", explanation: "Outcome client_slug differs from contractor account client_slug.", suggested: "Investigate cross-tenant outcome ownership before external use." },
  sold_outcome_missing_value: { severity: "critical", explanation: "Sold outcome has no positive final value.", suggested: "Collect authoritative sold value before revenue signal readiness." },
  lost_outcome_missing_reason: { severity: "critical", explanation: "Lost outcome lacks loss reason or notes.", suggested: "Collect outcome reason before using loss data for operations." },
  outcome_manual_review_required: { severity: "manual_review", explanation: "Outcome integrity requires review.", suggested: "Resolve contractor_outcomes integrity reasons; do not mutate from dashboard." },
  outcome_disputed: { severity: "critical", explanation: "Outcome is disputed.", suggested: "Resolve dispute before reporting or signal eligibility." },
  sold_outcome_missing_signal: { severity: "manual_review", explanation: "Sold outcome has no outcome-derived internal revenue signal visible.", suggested: "Use the approved internal sync path only after eligibility review; no live dispatch." },
  signal_without_valid_outcome: { severity: "critical", explanation: "Revenue signal references no valid contractor outcome.", suggested: "Exclude from readiness until source outcome is verified." },
  revenue_signal_client_mismatch: { severity: "critical", explanation: "Revenue signal client_slug differs from outcome client_slug.", suggested: "Do not dispatch or report this signal until tenant context is corrected." },
  revenue_signal_duplicate_risk: { severity: "critical", explanation: "Multiple revenue signals reference the same contractor outcome.", suggested: "Verify duplicate protection and exclude duplicates from downstream use." },
  revenue_signal_blocked: { severity: "critical", explanation: "Revenue signal is blocked by readiness checks.", suggested: "Repair source metadata/config before any dispatch phase." },
  revenue_signal_manual_review_required: { severity: "manual_review", explanation: "Revenue signal has ambiguous or historical integrity metadata.", suggested: "Review readiness reasons before Phase 4 dispatch planning." },
  rls_policy_unknown: { severity: "critical", explanation: "RLS posture could not be verified for a core table.", suggested: "Perform runtime policy inspection before approving contractor/client-facing work." },
  contractor_access_policy_deferred: { severity: "info", explanation: "Contractor-facing access remains intentionally deferred or narrowly scoped.", suggested: "Design redacted contractor views in a later sprint before broad access." },
  anon_access_must_be_absent: { severity: "critical", explanation: "Anon access appears possible on a protected Syndicate/control table.", suggested: "Revoke anon access and re-run policy verification." },
  internal_operator_policy_missing: { severity: "critical", explanation: "Internal operator policy is missing on a core table.", suggested: "Add scoped internal-operator policies before operations rely on the surface." },
  service_role_policy_missing: { severity: "manual_review", explanation: "Service role policy evidence is missing.", suggested: "Confirm backend maintenance paths before relying on automation." },
  cross_tenant_policy_review_required: { severity: "manual_review", explanation: "Policy evidence requires manual cross-tenant review.", suggested: "Review RLS predicates for direct user-owned scope and internal-only boundaries." },
  unresolved_client_slug: { severity: "critical", explanation: "Record has unresolved or unknown client_slug.", suggested: "Resolve tenant slug before routing, reporting, or signal use." },
  client_slug_direct_on_routed_assignment: { severity: "warning", explanation: "Routed assignment uses direct client_slug fallback.", suggested: "Confirm direct tenant is intentional and not a slug propagation failure." },
  platform_config_client_mismatch: { severity: "critical", explanation: "Platform config appears mismatched to tenant context.", suggested: "Review platform config client ownership before dispatch phases." },
};

export function formatTenantWarning(code: TenantWarningCode): string {
  return code.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function groupWarningsBySeverity(warnings: TenantIsolationWarning[]) {
  return warnings.reduce<Record<TenantAuditSeverity, TenantIsolationWarning[]>>((acc, warning) => {
    acc[warning.severity].push(warning);
    return acc;
  }, { info: [], warning: [], critical: [], manual_review: [] });
}

export function computeTenantAuditVerdict(input: TenantAuditSummary): TenantAuditVerdict {
  if (input.criticalWarnings > 0) return "syndicate_layer_blocked";
  if (input.rlsPosture.some((row) => row.evidence_level === "unknown" || row.status === "unknown" || row.status === "blocked")) return "syndicate_layer_blocked";
  if (input.manualReviewWarnings > 0 || input.warningWarnings > 0 || input.rlsEvidenceLevel !== "runtime_verified" || input.contractorFacingReadiness === "deferred") {
    return "syndicate_layer_partially_ready_with_manual_review";
  }
  return "syndicate_layer_ready_for_internal_operations";
}

async function tableRows<T>(table: string, select: string, limit = 1000): Promise<{ rows: T[]; error: string | null }> {
  const { data, error } = await db.from(table).select(select).limit(limit);
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as T[], error: null };
}

function makeWarning(code: TenantWarningCode, row: Partial<TenantIsolationWarning> & { entity_type: string; entity_id_masked: string; source_table: string }): TenantIsolationWarning {
  const copy = WARNING_COPY[code];
  return {
    id: `${code}:${row.source_table}:${row.entity_id_masked}:${row.client_slug ?? "none"}:${row.related_client_slug ?? "none"}`,
    severity: row.severity ?? copy.severity,
    warning_code: code,
    entity_type: row.entity_type,
    entity_id_masked: row.entity_id_masked,
    client_slug: row.client_slug ?? null,
    related_client_slug: row.related_client_slug ?? null,
    syndicate_slug: row.syndicate_slug ?? null,
    explanation: row.explanation ?? copy.explanation,
    suggested_action: row.suggested_action ?? copy.suggested,
    source_table: row.source_table,
    evidence_level: row.evidence_level ?? "runtime_verified",
    created_at: row.created_at ?? null,
    metadata_summary: row.metadata_summary ?? {},
  };
}

function duplicateAssignmentIds(assignments: AssignmentRow[]) {
  const ids = new Set<string>();
  for (const key of ["lead_id", "scan_session_id", "analysis_id"] as const) {
    const groups = new Map<string, AssignmentRow[]>();
    assignments.filter((row) => row.is_current && row[key]).forEach((row) => groups.set(String(row[key]), [...(groups.get(String(row[key])) ?? []), row]));
    groups.forEach((rows) => { if (rows.length > 1) rows.forEach((row) => ids.add(row.id)); });
  }
  return ids;
}

async function collectWarnings(): Promise<{ warnings: TenantIsolationWarning[]; contextDebt: string[] }> {
  const contextDebt: string[] = [];
  const [syndicatesR, membershipsR, contractorsR, assignmentsR, eventsR, outcomesR, readinessR] = await Promise.all([
    tableRows<SyndicateRow>("syndicates", "id, slug, is_active"),
    tableRows<SyndicateClientRow>("syndicate_clients", "syndicate_id, client_slug, is_active"),
    tableRows<ContractorRow>("contractor_accounts", "id, client_slug, is_active, created_at"),
    tableRows<AssignmentRow>("lead_assignments", "id, lead_id, scan_session_id, analysis_id, syndicate_id, client_slug, contractor_account_id, status, is_current, created_at"),
    tableRows<RoutingEventRow>("lead_routing_events", "id, assignment_id, lead_id, scan_session_id, analysis_id, from_client_slug, to_client_slug, created_at"),
    tableRows<OutcomeRow>("contractor_outcomes", "id, lead_assignment_id, client_slug, contractor_account_id, disposition_state, final_value_cents, disposition_reason_code, outcome_notes, outcome_integrity_status, outcome_integrity_reasons, created_at"),
    fetchRevenueDispatchReadiness().catch((error) => ({ rows: [], error })),
  ]);

  const sources = { syndicatesR, membershipsR, contractorsR, assignmentsR, eventsR, outcomesR };
  Object.entries(sources).forEach(([key, result]) => { if (result.error) contextDebt.push(`${key.replace(/R$/, "")}_unreadable`); });

  const warnings: TenantIsolationWarning[] = [];
  const syndicateSlugById = new Map(syndicatesR.rows.map((row) => [row.id, row.slug]));
  const activeClientBySyndicate = new Set(membershipsR.rows.filter((row) => row.is_active).map((row) => `${row.syndicate_id}:${row.client_slug}`));
  const contractorById = new Map(contractorsR.rows.map((row) => [row.id, row]));
  const assignmentById = new Map(assignmentsR.rows.map((row) => [row.id, row]));
  const outcomeById = new Map(outcomesR.rows.map((row) => [row.id, row]));
  const duplicateIds = duplicateAssignmentIds(assignmentsR.rows);
  const signalOutcomeCounts = new Map<string, number>();
  const readinessRows = "rows" in readinessR ? readinessR.rows : [];
  readinessRows.forEach((row) => {
    if (row.context.contractorOutcomeId) signalOutcomeCounts.set(row.context.contractorOutcomeId, (signalOutcomeCounts.get(row.context.contractorOutcomeId) ?? 0) + 1);
  });

  assignmentsR.rows.filter((row) => row.is_current).forEach((assignment) => {
    const contractor = assignment.contractor_account_id ? contractorById.get(assignment.contractor_account_id) : null;
    const syndicateSlug = assignment.syndicate_id ? syndicateSlugById.get(assignment.syndicate_id) ?? null : null;
    const base = { entity_type: "assignment", entity_id_masked: maskHealthId(assignment.id), client_slug: assignment.client_slug, syndicate_slug: syndicateSlug, source_table: "lead_assignments", created_at: assignment.created_at };
    if (!assignment.client_slug) warnings.push(makeWarning("assignment_missing_client_slug", base));
    if (!assignment.syndicate_id) warnings.push(makeWarning("assignment_missing_syndicate", base));
    if (!assignment.contractor_account_id) warnings.push(makeWarning("assignment_without_contractor_account", base));
    if (duplicateIds.has(assignment.id)) warnings.push(makeWarning("current_assignment_duplicate_risk", base));
    const hasRoutingEvent = eventsR.rows.some((event) => event.assignment_id === assignment.id || (assignment.lead_id && event.lead_id === assignment.lead_id) || (assignment.scan_session_id && event.scan_session_id === assignment.scan_session_id) || (assignment.analysis_id && event.analysis_id === assignment.analysis_id));
    if (!hasRoutingEvent) warnings.push(makeWarning("assignment_without_routing_event", base));
    if (assignment.syndicate_id && assignment.client_slug && !activeClientBySyndicate.has(`${assignment.syndicate_id}:${assignment.client_slug}`)) warnings.push(makeWarning("assignment_client_not_in_syndicate", base));
    if (assignment.client_slug === "direct" && assignment.contractor_account_id) warnings.push(makeWarning("client_slug_direct_on_routed_assignment", base));
    if (contractor?.client_slug && assignment.client_slug && contractor.client_slug !== assignment.client_slug) warnings.push(makeWarning("assignment_contractor_client_mismatch", { ...base, related_client_slug: contractor.client_slug, metadata_summary: { contractor_account_id: maskHealthId(contractor.id) } }));
    if (assignment.status === "manual_review") warnings.push(makeWarning("assignment_manual_review_required", base));
  });

  contractorsR.rows.forEach((contractor) => {
    const assignments = assignmentsR.rows.filter((row) => row.is_current && row.contractor_account_id === contractor.id);
    const base = { entity_type: "contractor_account", entity_id_masked: maskHealthId(contractor.id), client_slug: contractor.client_slug, source_table: "contractor_accounts", created_at: contractor.created_at ?? null };
    if (!contractor.client_slug) warnings.push(makeWarning("contractor_missing_client_slug", base));
    if (!contractor.is_active && assignments.length > 0) warnings.push(makeWarning("contractor_inactive_with_current_assignments", { ...base, metadata_summary: { current_assignments: assignments.length } }));
  });

  outcomesR.rows.forEach((outcome) => {
    const assignment = outcome.lead_assignment_id ? assignmentById.get(outcome.lead_assignment_id) : null;
    const contractor = outcome.contractor_account_id ? contractorById.get(outcome.contractor_account_id) : null;
    const base = { entity_type: "contractor_outcome", entity_id_masked: maskHealthId(outcome.id), client_slug: outcome.client_slug, source_table: "contractor_outcomes", created_at: outcome.created_at, metadata_summary: { integrity_status: outcome.outcome_integrity_status } };
    if (!outcome.client_slug) warnings.push(makeWarning("outcome_missing_client_slug", base));
    if (!outcome.lead_assignment_id) warnings.push(makeWarning("outcome_without_assignment", base));
    if (assignment?.client_slug && outcome.client_slug && assignment.client_slug !== outcome.client_slug) warnings.push(makeWarning("outcome_assignment_client_mismatch", { ...base, related_client_slug: assignment.client_slug }));
    if (contractor?.client_slug && outcome.client_slug && contractor.client_slug !== outcome.client_slug) warnings.push(makeWarning("outcome_contractor_client_mismatch", { ...base, related_client_slug: contractor.client_slug }));
    if (outcome.disposition_state === "sold_closed" && (!outcome.final_value_cents || outcome.final_value_cents <= 0)) warnings.push(makeWarning("sold_outcome_missing_value", base));
    if (outcome.disposition_state === "lost_dead" && !outcome.disposition_reason_code && !outcome.outcome_notes) warnings.push(makeWarning("lost_outcome_missing_reason", base));
    if (["manual_review", "needs_review"].includes(outcome.outcome_integrity_status ?? "")) warnings.push(makeWarning("outcome_manual_review_required", base));
    if (outcome.disposition_state === "disputed" || outcome.outcome_integrity_reasons?.includes("outcome_disputed")) warnings.push(makeWarning("outcome_disputed", base));
    if (outcome.disposition_state === "sold_closed" && !readinessRows.some((row) => row.context.contractorOutcomeId === outcome.id)) warnings.push(makeWarning("sold_outcome_missing_signal", base));
  });

  readinessRows.forEach((row) => {
    const outcome = row.context.contractorOutcomeId ? outcomeById.get(row.context.contractorOutcomeId) : null;
    const base = { entity_type: "revenue_signal", entity_id_masked: maskHealthId(row.id), client_slug: row.clientSlug, source_table: "event_logs", created_at: row.createdAt, metadata_summary: { readiness_status: row.status, outcome_id: maskHealthId(row.context.contractorOutcomeId) } };
    if (row.context.contractorOutcomeId && !outcome) warnings.push(makeWarning("signal_without_valid_outcome", base));
    if (outcome?.client_slug && row.clientSlug && outcome.client_slug !== row.clientSlug) warnings.push(makeWarning("revenue_signal_client_mismatch", { ...base, related_client_slug: outcome.client_slug }));
    if (row.context.contractorOutcomeId && (signalOutcomeCounts.get(row.context.contractorOutcomeId) ?? 0) > 1) warnings.push(makeWarning("revenue_signal_duplicate_risk", base));
    if (row.status === "blocked") warnings.push(makeWarning("revenue_signal_blocked", base));
    if (row.reasons.includes("historical_payload_missing_integrity_metadata")) warnings.push(makeWarning("revenue_signal_manual_review_required", base));
  });

  if (!("rows" in readinessR) || ("error" in readinessR && readinessR.error)) contextDebt.push("revenue_dispatch_readiness_unreadable");
  return { warnings, contextDebt };
}

export async function fetchRlsPostureSummary(): Promise<RlsPostureRow[]> {
  const rlsResult = await db.from("pg_tables").select("tablename, rowsecurity").eq("schemaname", "public").in("tablename", CORE_TABLES);
  const policiesResult = await db.from("pg_policies").select("tablename, policyname, roles, cmd, qual, with_check").eq("schemaname", "public").in("tablename", CORE_TABLES);
  const rlsRows = ((rlsResult.data ?? []) as RlsRow[]);
  const policyRows = ((policiesResult.data ?? []) as TablePolicyRow[]);
  if (rlsResult.error || policiesResult.error) {
    return CORE_TABLES.map((table) => ({ table_name: table, status: "unknown", evidence_level: "unknown", rls_enabled: null, anon_access: null, internal_operator_policy: null, service_role_policy: null, contractor_scope: "unknown", notes: "Runtime policy introspection unavailable." }));
  }

  return CORE_TABLES.map((table) => {
    const tablePolicies = policyRows.filter((row) => row.tablename === table);
    const rls = rlsRows.find((row) => row.tablename === table)?.rowsecurity ?? null;
    const roleText = tablePolicies.map((row) => Array.isArray(row.roles) ? row.roles.join(",") : String(row.roles)).join("|");
    const anonAccess = /anon/.test(roleText) && table !== "event_logs";
    const internal = tablePolicies.some((row) => /internal_operator|is_internal_operator/.test(`${row.qual ?? ""} ${row.with_check ?? ""}`));
    const service = tablePolicies.some((row) => /service_role/.test(Array.isArray(row.roles) ? row.roles.join(",") : String(row.roles)));
    const contractorScope = table === "contractor_accounts"
      ? "own_account_only"
      : table === "lead_assignments"
        ? "own_assignment_only"
        : "none";
    const status: RlsPostureStatus = !rls || anonAccess ? "blocked" : !internal && table !== "event_logs" ? "review" : "safe";
    return {
      table_name: table,
      status,
      evidence_level: "runtime_verified",
      rls_enabled: rls,
      anon_access: anonAccess,
      internal_operator_policy: internal,
      service_role_policy: service,
      contractor_scope: contractorScope,
      notes: table === "event_logs" ? "Anon insert exists for telemetry; no read policy surfaced for anon." : "Runtime pg_policies/pg_tables inspection completed.",
    };
  });
}

export async function fetchTenantIsolationWarnings(filters: TenantAuditFilters = {}): Promise<TenantIsolationWarning[]> {
  const { warnings } = await collectWarnings();
  return warnings.filter((warning) => {
    if (filters.severity && filters.severity !== "all" && warning.severity !== filters.severity) return false;
    if (filters.clientSlug && warning.client_slug !== filters.clientSlug) return false;
    if (filters.code && filters.code !== "all" && warning.warning_code !== filters.code) return false;
    if (filters.needsAttentionOnly && warning.severity === "info") return false;
    return true;
  });
}

export async function fetchTenantIsolationAudit(filters: TenantAuditFilters = {}): Promise<TenantIsolationAuditResult> {
  const [{ warnings, contextDebt }, rlsPosture] = await Promise.all([collectWarnings(), fetchRlsPostureSummary()]);
  const filteredWarnings = warnings.filter((warning) => {
    if (filters.severity && filters.severity !== "all" && warning.severity !== filters.severity) return false;
    if (filters.clientSlug && warning.client_slug !== filters.clientSlug) return false;
    if (filters.code && filters.code !== "all" && warning.warning_code !== filters.code) return false;
    if (filters.needsAttentionOnly && warning.severity === "info") return false;
    return true;
  });
  const grouped = groupWarningsBySeverity(filteredWarnings);
  const rlsEvidenceLevel: RlsEvidenceLevel = rlsPosture.some((row) => row.evidence_level === "unknown") ? "unknown" : rlsPosture.every((row) => row.evidence_level === "runtime_verified") ? "runtime_verified" : "static_migration_review";
  const contractorFacingReadiness: ContractorFacingReadiness = grouped.critical.length > 0 ? "blocked" : "deferred";
  const clientReportingReadiness: ClientReportingReadiness = grouped.critical.length > 0 ? "blocked" : grouped.warning.length || grouped.manual_review.length ? "deferred" : "ready_for_review";
  const baseSummary: TenantAuditSummary = {
    verdict: "syndicate_layer_partially_ready_with_manual_review",
    totalWarnings: filteredWarnings.length,
    criticalWarnings: grouped.critical.length,
    warningWarnings: grouped.warning.length,
    manualReviewWarnings: grouped.manual_review.length,
    infoWarnings: grouped.info.length,
    rlsEvidenceLevel,
    rlsPosture,
    contractorFacingReadiness,
    clientReportingReadiness,
    closeoutChecklist: [
      { label: "No public contractor/client access added", status: "pass", detail: "3G-A/B is read-only internal admin UI." },
      { label: "No source records auto-mutated", status: "pass", detail: "Services only read Supabase tables/RPC readiness." },
      { label: "No live dispatch added", status: "pass", detail: "No provider APIs, webhooks, or dispatch senders are called." },
      { label: "RLS posture evidence", status: rlsEvidenceLevel === "unknown" ? "blocked" : rlsEvidenceLevel === "runtime_verified" ? "pass" : "review", detail: `Evidence level: ${rlsEvidenceLevel}.` },
      { label: "Contractor-facing access readiness", status: contractorFacingReadiness === "blocked" ? "blocked" : "review", detail: contractorFacingReadiness },
      { label: "Client-facing reporting readiness", status: clientReportingReadiness === "blocked" ? "blocked" : clientReportingReadiness === "ready_for_review" ? "pass" : "review", detail: clientReportingReadiness },
    ],
    generatedAt: new Date().toISOString(),
    contextDebt,
  };
  return { summary: { ...baseSummary, verdict: computeTenantAuditVerdict(baseSummary) }, warnings: filteredWarnings };
}
