import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type ContractorOutcomeStatus =
  | "new"
  | "attempting_contact"
  | "contacted"
  | "meeting_scheduled"
  | "scheduled"
  | "quote_delivered"
  | "sold_closed"
  | "lost_dead"
  | "disputed"
  | "manual_review"
  | "invalid";

export type OutcomeValueBasis =
  | "contract_total"
  | "gross_sale_value"
  | "true_margin"
  | "estimated_contract_value"
  | "unknown";

export type OutcomeIntegrityStatus = "valid" | "warning" | "blocked" | "needs_review";

export type OutcomeIntegrityReason =
  | "missing_client_slug"
  | "missing_assignment"
  | "missing_contractor_account"
  | "sold_missing_value"
  | "sold_invalid_value"
  | "sold_missing_value_basis"
  | "lost_missing_reason"
  | "value_basis_gross_proxy"
  | "value_basis_unknown"
  | "outcome_disputed"
  | "assignment_client_mismatch"
  | "contractor_client_mismatch"
  | "manual_review_required"
  | "outcome_not_terminal"
  | "eligible_for_future_signal"
  | "not_eligible_for_signal";

export interface ContractorOutcomeIntegrityRow {
  outcome_id: string;
  created_at: string;
  updated_at: string;
  outcome_timestamp: string;
  opportunity_id: string | null;
  lead_id: string | null;
  scan_session_id: string | null;
  analysis_id: string | null;
  lead_assignment_id: string | null;
  assignment_client_slug: string | null;
  contractor_id: string | null;
  contractor_account_id: string | null;
  contractor_account_name: string | null;
  contractor_account_client_slug: string | null;
  contractor_company_name: string | null;
  client_slug: string | null;
  outcome_status: ContractorOutcomeStatus;
  sold_amount_cents: number | null;
  sold_amount: number | null;
  sold_currency: string;
  value_basis: OutcomeValueBasis;
  lost_reason: string | null;
  lost_reason_code: string | null;
  outcome_source: string;
  outcome_verified: boolean;
  outcome_verified_at: string | null;
  outcome_integrity_status: OutcomeIntegrityStatus;
  outcome_integrity_reasons: OutcomeIntegrityReason[];
  eligible_for_future_signal: boolean;
  safe_metadata: Record<string, unknown>;
}

export interface ContractorOutcomeIntegritySummary {
  total: number;
  valid: number;
  warning: number;
  blocked: number;
  needsReview: number;
  soldClosed: number;
  lostDead: number;
  disputed: number;
  grossProxy: number;
  missingValue: number;
  missingLostReason: number;
}

export interface ContractorOutcomeFilters {
  clientSlug?: string;
  outcomeStatus?: ContractorOutcomeStatus | "all";
  integrityStatus?: OutcomeIntegrityStatus | "all";
  valueBasis?: OutcomeValueBasis | "all";
  needsReviewOnly?: boolean;
  soldOnly?: boolean;
  lostOnly?: boolean;
  search?: string;
  limit?: number;
}

const db = supabase as unknown as SupabaseClient;

const TERMINAL_SOLD = "sold_closed";
const TERMINAL_LOST = "lost_dead";

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) return Number(value);
  return null;
}

function bool(value: unknown): boolean {
  return value === true;
}

function metadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeReasons(value: unknown): OutcomeIntegrityReason[] {
  return Array.isArray(value) ? value.filter((item): item is OutcomeIntegrityReason => typeof item === "string") : [];
}

function normalizeStatus(value: unknown): OutcomeIntegrityStatus {
  return ["valid", "warning", "blocked", "needs_review"].includes(String(value))
    ? (String(value) as OutcomeIntegrityStatus)
    : "needs_review";
}

function normalizeOutcomeStatus(value: unknown): ContractorOutcomeStatus {
  return [
    "new",
    "attempting_contact",
    "contacted",
    "meeting_scheduled",
    "scheduled",
    "quote_delivered",
    "sold_closed",
    "lost_dead",
    "disputed",
    "manual_review",
    "invalid",
  ].includes(String(value))
    ? (String(value) as ContractorOutcomeStatus)
    : "new";
}

function normalizeValueBasis(value: unknown): OutcomeValueBasis {
  return ["contract_total", "gross_sale_value", "true_margin", "estimated_contract_value", "unknown"].includes(String(value))
    ? (String(value) as OutcomeValueBasis)
    : "unknown";
}

export function computeOutcomeIntegrity(row: unknown): Pick<ContractorOutcomeIntegrityRow, "outcome_integrity_status" | "outcome_integrity_reasons" | "eligible_for_future_signal"> {
  const r = metadata(row);
  const status = normalizeOutcomeStatus(r.outcome_status ?? r.disposition_state);
  const valueCents = numberOrNull(r.sold_amount_cents ?? r.final_value_cents);
  const valueBasis = normalizeValueBasis(r.value_basis ?? r.optimization_value_basis);
  const lostReason = text(r.lost_reason ?? r.outcome_notes);
  const lostReasonCode = text(r.lost_reason_code ?? r.disposition_reason_code);
  const clientSlug = text(r.client_slug);
  const assignmentClient = text(r.assignment_client_slug);
  const contractorClient = text(r.contractor_account_client_slug);
  const reasons: OutcomeIntegrityReason[] = [];

  if (!clientSlug) reasons.push("missing_client_slug");
  if (!text(r.lead_assignment_id)) reasons.push("missing_assignment");
  if (!text(r.contractor_account_id)) reasons.push("missing_contractor_account");

  if (status === TERMINAL_SOLD) {
    if (valueCents == null) reasons.push("sold_missing_value");
    else if (valueCents <= 0) reasons.push("sold_invalid_value");

    if (!valueBasis) reasons.push("sold_missing_value_basis");
    else if (valueBasis === "unknown") reasons.push("value_basis_unknown");
    else if (valueBasis === "gross_sale_value") reasons.push("value_basis_gross_proxy");
  }

  if (status === TERMINAL_LOST && (!lostReasonCode || !lostReason)) reasons.push("lost_missing_reason");
  if (status === "disputed") reasons.push("outcome_disputed");
  if (status === "manual_review" || status === "invalid") reasons.push("manual_review_required");
  if (status !== TERMINAL_SOLD && status !== TERMINAL_LOST) reasons.push("outcome_not_terminal");
  if (clientSlug && assignmentClient && clientSlug !== assignmentClient) reasons.push("assignment_client_mismatch");
  if (clientSlug && contractorClient && clientSlug !== contractorClient) reasons.push("contractor_client_mismatch");

  const eligible = status === TERMINAL_SOLD && valueCents != null && valueCents > 0 && valueBasis !== "unknown" && !reasons.some((reason) => ["assignment_client_mismatch", "contractor_client_mismatch", "missing_client_slug"].includes(reason));
  reasons.push(eligible ? "eligible_for_future_signal" : "not_eligible_for_signal");

  const integrityStatus: OutcomeIntegrityStatus = reasons.some((reason) => ["sold_missing_value", "sold_invalid_value", "lost_missing_reason", "assignment_client_mismatch", "contractor_client_mismatch", "outcome_disputed"].includes(reason))
    ? "blocked"
    : reasons.some((reason) => ["missing_client_slug", "missing_assignment", "missing_contractor_account", "sold_missing_value_basis", "value_basis_unknown", "manual_review_required"].includes(reason))
    ? "needs_review"
    : reasons.some((reason) => ["value_basis_gross_proxy", "outcome_not_terminal"].includes(reason))
    ? "warning"
    : "valid";

  return { outcome_integrity_status: integrityStatus, outcome_integrity_reasons: reasons, eligible_for_future_signal: eligible };
}

function normalizeRow(raw: Record<string, unknown>): ContractorOutcomeIntegrityRow {
  const fallbackIntegrity = computeOutcomeIntegrity(raw);
  const reasons = normalizeReasons(raw.outcome_integrity_reasons);
  const outcomeStatus = normalizeOutcomeStatus(raw.outcome_status ?? raw.disposition_state);
  const valueCents = numberOrNull(raw.sold_amount_cents ?? raw.final_value_cents);
  return {
    outcome_id: String(raw.outcome_id ?? raw.id),
    created_at: String(raw.created_at ?? raw.outcome_created_at ?? ""),
    updated_at: String(raw.updated_at ?? raw.outcome_updated_at ?? raw.created_at ?? ""),
    outcome_timestamp: String(raw.outcome_timestamp ?? raw.last_partner_action_at ?? raw.outcome_updated_at ?? raw.outcome_created_at ?? raw.created_at ?? ""),
    opportunity_id: text(raw.opportunity_id),
    lead_id: text(raw.lead_id),
    scan_session_id: text(raw.scan_session_id),
    analysis_id: text(raw.analysis_id),
    lead_assignment_id: text(raw.lead_assignment_id),
    assignment_client_slug: text(raw.assignment_client_slug),
    contractor_id: text(raw.contractor_id),
    contractor_account_id: text(raw.contractor_account_id),
    contractor_account_name: text(raw.contractor_account_name),
    contractor_account_client_slug: text(raw.contractor_account_client_slug),
    contractor_company_name: text(raw.contractor_company_name),
    client_slug: text(raw.client_slug),
    outcome_status: outcomeStatus,
    sold_amount_cents: valueCents,
    sold_amount: numberOrNull(raw.sold_amount) ?? (valueCents == null ? null : valueCents / 100),
    sold_currency: text(raw.sold_currency) ?? "USD",
    value_basis: normalizeValueBasis(raw.value_basis),
    lost_reason: outcomeStatus === TERMINAL_LOST ? text(raw.lost_reason ?? raw.outcome_notes) : null,
    lost_reason_code: text(raw.lost_reason_code ?? raw.disposition_reason_code),
    outcome_source: text(raw.outcome_source) ?? "operator_or_partner",
    outcome_verified: bool(raw.outcome_verified),
    outcome_verified_at: text(raw.outcome_verified_at),
    outcome_integrity_status: normalizeStatus(raw.outcome_integrity_status ?? fallbackIntegrity.outcome_integrity_status),
    outcome_integrity_reasons: reasons.length ? reasons : fallbackIntegrity.outcome_integrity_reasons,
    eligible_for_future_signal: bool(raw.eligible_for_future_signal) || fallbackIntegrity.eligible_for_future_signal,
    safe_metadata: metadata(raw.safe_metadata),
  };
}

function safeError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error || "Outcome data failed to load.");
  if (/permission|forbidden|JWT|authenticated|operator|policy/i.test(message)) {
    return new Error("You may not have internal operator permissions.");
  }
  if (/function|schema|column|relation|does not exist/i.test(message)) {
    return new Error("Outcome integrity backend is unavailable until the Phase 3E migration is applied.");
  }
  return new Error("Outcome data failed to load.");
}

function applyFilters(rows: ContractorOutcomeIntegrityRow[], filters: ContractorOutcomeFilters): ContractorOutcomeIntegrityRow[] {
  const q = filters.search?.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.clientSlug?.trim() && row.client_slug !== filters.clientSlug.trim()) return false;
    if (filters.outcomeStatus && filters.outcomeStatus !== "all" && row.outcome_status !== filters.outcomeStatus) return false;
    if (filters.integrityStatus && filters.integrityStatus !== "all" && row.outcome_integrity_status !== filters.integrityStatus) return false;
    if (filters.valueBasis && filters.valueBasis !== "all" && row.value_basis !== filters.valueBasis) return false;
    if (filters.needsReviewOnly && !["blocked", "needs_review", "warning"].includes(row.outcome_integrity_status)) return false;
    if (filters.soldOnly && row.outcome_status !== TERMINAL_SOLD) return false;
    if (filters.lostOnly && row.outcome_status !== TERMINAL_LOST) return false;
    if (q) {
      const haystack = [row.outcome_id, row.lead_assignment_id, row.lead_id, row.scan_session_id, row.analysis_id, row.client_slug, row.contractor_account_id, row.contractor_account_name, row.contractor_company_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export async function fetchContractorOutcomeIntegrityRows(filters: ContractorOutcomeFilters = {}): Promise<ContractorOutcomeIntegrityRow[]> {
  const { data, error } = await db.rpc("admin_contractor_outcome_integrity");
  if (error) throw safeError(error);
  return applyFilters(((data ?? []) as Record<string, unknown>[]).map(normalizeRow), filters).slice(0, filters.limit ?? 200);
}

export async function fetchContractorOutcomeDetail(outcomeId: string): Promise<ContractorOutcomeIntegrityRow> {
  const rows = await fetchContractorOutcomeIntegrityRows({ search: outcomeId, limit: 200 });
  const row = rows.find((candidate) => candidate.outcome_id === outcomeId);
  if (!row) throw new Error("Outcome data failed to load.");
  return row;
}

export function formatOutcomeIntegrityReasons(reasons: string[]): string[] {
  const labels: Record<string, string> = {
    missing_client_slug: "Outcome is missing client ownership context.",
    missing_assignment: "Outcome is not linked to a lead assignment yet.",
    missing_contractor_account: "Outcome is missing contractor account context.",
    sold_missing_value: "Sold outcome is missing a positive sold amount.",
    sold_invalid_value: "Sold outcome has a non-positive sold amount.",
    sold_missing_value_basis: "Sold outcome is missing an explicit value basis.",
    lost_missing_reason: "Lost outcome requires a lost reason.",
    value_basis_gross_proxy: "Gross sale value is being used as a proxy, not true margin.",
    value_basis_unknown: "Value basis is unknown and must be reviewed.",
    outcome_disputed: "Outcome is disputed and blocked from future conversion signal generation.",
    assignment_client_mismatch: "Outcome client_slug does not match the linked assignment.",
    contractor_client_mismatch: "Outcome client_slug does not match the contractor account.",
    manual_review_required: "Outcome requires manual review before revenue use.",
    outcome_not_terminal: "Outcome is not a terminal sold/lost state.",
    eligible_for_future_signal: "Outcome is eligible to become a future conversion signal after Phase 3F rules run.",
    not_eligible_for_signal: "Outcome is not eligible for future conversion signal generation yet.",
  };
  return reasons.map((reason) => labels[reason] ?? reason);
}

export function summarizeOutcomeHealth(rows: ContractorOutcomeIntegrityRow[]): ContractorOutcomeIntegritySummary {
  return rows.reduce<ContractorOutcomeIntegritySummary>((acc, row) => {
    acc.total += 1;
    if (row.outcome_integrity_status === "valid") acc.valid += 1;
    if (row.outcome_integrity_status === "warning") acc.warning += 1;
    if (row.outcome_integrity_status === "blocked") acc.blocked += 1;
    if (row.outcome_integrity_status === "needs_review") acc.needsReview += 1;
    if (row.outcome_status === TERMINAL_SOLD) acc.soldClosed += 1;
    if (row.outcome_status === TERMINAL_LOST) acc.lostDead += 1;
    if (row.outcome_status === "disputed") acc.disputed += 1;
    if (row.outcome_integrity_reasons.includes("value_basis_gross_proxy")) acc.grossProxy += 1;
    if (row.outcome_integrity_reasons.some((reason) => reason === "sold_missing_value" || reason === "sold_invalid_value")) acc.missingValue += 1;
    if (row.outcome_integrity_reasons.includes("lost_missing_reason")) acc.missingLostReason += 1;
    return acc;
  }, { total: 0, valid: 0, warning: 0, blocked: 0, needsReview: 0, soldClosed: 0, lostDead: 0, disputed: 0, grossProxy: 0, missingValue: 0, missingLostReason: 0 });
}

export function maskOutcomeId(value: string | null | undefined): string {
  if (!value) return "—";
  return value.length <= 12 ? value : `${value.slice(0, 8)}…${value.slice(-4)}`;
}
