import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { peekDevSecret } from "@/lib/devSecret";

export type LeadAssignmentStatus =
  | "unassigned"
  | "assigned"
  | "accepted"
  | "contacted"
  | "scheduled"
  | "sold_closed"
  | "lost_dead"
  | "recycled"
  | "reassigned"
  | "disputed"
  | "manual_review";

export type LeadRoutingAction = "route_lead" | "reassign_lead" | "recycle_lead" | "manual_review" | "operator_note";

export const LEAD_ASSIGNMENT_REASON_CODES = [
  "initial_assignment",
  "manual_operator_assignment",
  "client_slug_match",
  "territory_match",
  "capacity_match",
  "quote_uploaded_high_intent",
  "no_response_recycle",
  "contractor_declined",
  "lost_reassign",
  "manual_override",
  "duplicate_resolution",
  "manual_review_required",
  "operator_note",
] as const;

export type LeadAssignmentReasonCode = (typeof LEAD_ASSIGNMENT_REASON_CODES)[number];

export interface LeadAssignmentRow {
  id: string;
  created_at: string;
  updated_at: string;
  lead_id: string | null;
  scan_session_id: string | null;
  analysis_id: string | null;
  syndicate_id: string | null;
  client_slug: string;
  contractor_account_id: string | null;
  status: LeadAssignmentStatus;
  is_current: boolean;
  assigned_at: string;
  accepted_at: string | null;
  released_at: string | null;
  recycled_at: string | null;
  reason_code: string;
  assigned_by: string | null;
  metadata: Record<string, unknown>;
  syndicate?: { id: string; slug: string; name: string; is_active: boolean } | null;
  contractor_account?: { id: string; display_name: string; client_slug: string; is_active: boolean } | null;
}

export interface LeadRoutingEventRow {
  id: string;
  created_at: string;
  assignment_id: string | null;
  lead_id: string | null;
  scan_session_id: string | null;
  analysis_id: string | null;
  event_type: string;
  from_client_slug: string | null;
  to_client_slug: string | null;
  from_contractor_account_id: string | null;
  to_contractor_account_id: string | null;
  operator_id: string | null;
  reason_code: string;
  note: string | null;
  metadata: Record<string, unknown>;
}

export interface LeadAssignmentDetail {
  assignment: LeadAssignmentRow;
  events: LeadRoutingEventRow[];
}

export interface RouteLeadInput {
  lead_id?: string | null;
  scan_session_id?: string | null;
  analysis_id?: string | null;
  syndicate_id?: string | null;
  client_slug: string;
  contractor_account_id?: string | null;
  reason_code: LeadAssignmentReasonCode | string;
  operator_note?: string | null;
}

export interface ReassignLeadInput extends RouteLeadInput {
  assignment_id?: string | null;
}

export interface RecycleLeadInput {
  assignment_id: string;
  reason_code: LeadAssignmentReasonCode | string;
  operator_note?: string | null;
}

export interface ManualReviewInput {
  assignment_id: string;
  reason_code: LeadAssignmentReasonCode | string;
  operator_note?: string | null;
}

export interface OperatorNoteInput {
  assignment_id: string;
  reason_code: LeadAssignmentReasonCode | string;
  operator_note?: string | null;
}

export interface LeadAssignmentFilters {
  clientSlug?: string;
  status?: LeadAssignmentStatus | "all";
  currentOnly?: boolean;
  manualReviewOnly?: boolean;
  search?: string;
  limit?: number;
}

export interface LeadAssignmentReferenceData {
  syndicates: Array<{ id: string; slug: string; name: string; is_active: boolean }>;
  contractorAccounts: Array<{ id: string; display_name: string; client_slug: string; is_active: boolean }>;
}

const db = supabase as unknown as SupabaseClient;

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function requireReason(reasonCode: string) {
  if (!cleanText(reasonCode)) throw new Error("Reason code is required.");
}

function hasIdentity(input: { lead_id?: string | null; scan_session_id?: string | null; analysis_id?: string | null }) {
  return Boolean(cleanText(input.lead_id) || cleanText(input.scan_session_id) || cleanText(input.analysis_id));
}

function safeMetadata(action: LeadRoutingAction) {
  return {
    ui_source: "lead_assignment_board",
    requested_action: action,
    external_dispatch: false,
    revenue_truth_mutated: false,
  };
}

function normalizeAssignment(row: Record<string, unknown>): LeadAssignmentRow {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    lead_id: (row.lead_id as string | null) ?? null,
    scan_session_id: (row.scan_session_id as string | null) ?? null,
    analysis_id: (row.analysis_id as string | null) ?? null,
    syndicate_id: (row.syndicate_id as string | null) ?? null,
    client_slug: String(row.client_slug),
    contractor_account_id: (row.contractor_account_id as string | null) ?? null,
    status: String(row.status) as LeadAssignmentStatus,
    is_current: Boolean(row.is_current),
    assigned_at: String(row.assigned_at),
    accepted_at: (row.accepted_at as string | null) ?? null,
    released_at: (row.released_at as string | null) ?? null,
    recycled_at: (row.recycled_at as string | null) ?? null,
    reason_code: String(row.reason_code),
    assigned_by: (row.assigned_by as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
    syndicate: (row.syndicates as LeadAssignmentRow["syndicate"]) ?? null,
    contractor_account: (row.contractor_accounts as LeadAssignmentRow["contractor_account"]) ?? null,
  };
}

function normalizeEvent(row: Record<string, unknown>): LeadRoutingEventRow {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    assignment_id: (row.assignment_id as string | null) ?? null,
    lead_id: (row.lead_id as string | null) ?? null,
    scan_session_id: (row.scan_session_id as string | null) ?? null,
    analysis_id: (row.analysis_id as string | null) ?? null,
    event_type: String(row.event_type),
    from_client_slug: (row.from_client_slug as string | null) ?? null,
    to_client_slug: (row.to_client_slug as string | null) ?? null,
    from_contractor_account_id: (row.from_contractor_account_id as string | null) ?? null,
    to_contractor_account_id: (row.to_contractor_account_id as string | null) ?? null,
    operator_id: (row.operator_id as string | null) ?? null,
    reason_code: String(row.reason_code),
    note: (row.note as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
  };
}

function operatorSafeError(error: unknown): Error {
  const message = error instanceof Error ? error.message : "Assignment action failed.";
  if (/permission|forbidden|JWT|authenticated|session/i.test(message)) {
    return new Error("You may not have internal operator permissions.");
  }
  if (/reason_code/i.test(message)) return new Error("Reason code is required.");
  if (/current assignment|assignment_required|not_found/i.test(message)) {
    return new Error("This action requires an existing current assignment.");
  }
  if (/routing|function|rpc|rejected/i.test(message)) return new Error("The routing service rejected this action.");
  return new Error(message || "Assignment action failed.");
}

export function maskAssignmentId(value: string | null | undefined): string {
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

export function summarizeSafeMetadata(metadata: Record<string, unknown> | null | undefined) {
  const source = typeof metadata?.ui_source === "string" ? metadata.ui_source : "—";
  const externalDispatch = metadata?.external_dispatch === false ? "false" : "—";
  const revenueTruthMutated = metadata?.revenue_truth_mutated === false ? "false" : "—";
  return { source, externalDispatch, revenueTruthMutated };
}

export async function fetchLeadAssignments(filters: LeadAssignmentFilters = {}): Promise<LeadAssignmentRow[]> {
  let query = db
    .from("lead_assignments")
    .select("*, syndicates(id, slug, name, is_active), contractor_accounts(id, display_name, client_slug, is_active)")
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 100);

  if (filters.clientSlug?.trim()) query = query.eq("client_slug", filters.clientSlug.trim());
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.currentOnly) query = query.eq("is_current", true);
  if (filters.manualReviewOnly) query = query.eq("status", "manual_review");

  const search = filters.search?.trim();
  if (search) {
    query = query.or(`id.eq.${search},lead_id.eq.${search},scan_session_id.eq.${search},analysis_id.eq.${search}`);
  }

  const { data, error } = await query;
  if (error) throw operatorSafeError(error);
  return ((data ?? []) as Record<string, unknown>[]).map(normalizeAssignment);
}

export async function fetchLeadRoutingEvents(filters: { assignmentId?: string; leadId?: string; scanSessionId?: string; analysisId?: string } = {}): Promise<LeadRoutingEventRow[]> {
  let query = db.from("lead_routing_events").select("*").order("created_at", { ascending: true }).limit(200);
  if (filters.assignmentId) query = query.eq("assignment_id", filters.assignmentId);
  if (filters.leadId) query = query.eq("lead_id", filters.leadId);
  if (filters.scanSessionId) query = query.eq("scan_session_id", filters.scanSessionId);
  if (filters.analysisId) query = query.eq("analysis_id", filters.analysisId);

  const { data, error } = await query;
  if (error) throw operatorSafeError(error);
  return ((data ?? []) as Record<string, unknown>[]).map(normalizeEvent);
}

export async function fetchLeadAssignmentDetail(assignmentId: string): Promise<LeadAssignmentDetail> {
  const { data, error } = await db
    .from("lead_assignments")
    .select("*, syndicates(id, slug, name, is_active), contractor_accounts(id, display_name, client_slug, is_active)")
    .eq("id", assignmentId)
    .maybeSingle();

  if (error) throw operatorSafeError(error);
  if (!data) throw new Error("This action requires an existing current assignment.");

  const assignment = normalizeAssignment(data as Record<string, unknown>);
  const events = await fetchLeadRoutingEvents({ assignmentId });
  return { assignment, events };
}

export async function fetchLeadAssignmentReferenceData(): Promise<LeadAssignmentReferenceData> {
  const [syndicatesResult, contractorAccountsResult] = await Promise.all([
    db.from("syndicates").select("id, slug, name, is_active").eq("is_active", true).order("slug"),
    db.from("contractor_accounts").select("id, display_name, client_slug, is_active").eq("is_active", true).order("display_name"),
  ]);
  if (syndicatesResult.error) throw operatorSafeError(syndicatesResult.error);
  if (contractorAccountsResult.error) throw operatorSafeError(contractorAccountsResult.error);
  return {
    syndicates: (syndicatesResult.data ?? []) as LeadAssignmentReferenceData["syndicates"],
    contractorAccounts: (contractorAccountsResult.data ?? []) as LeadAssignmentReferenceData["contractorAccounts"],
  };
}

async function invokeRouteLead(action: LeadRoutingAction, payload: Record<string, unknown>) {
  const body = { ...payload, action, metadata: { ...safeMetadata(action), ...(payload.metadata as Record<string, unknown> | undefined) } };
  const devSecret = peekDevSecret();

  try {
    if (devSecret) {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-route-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-dev-secret": devSecret },
        body: JSON.stringify(body),
      });
      const parsed = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(parsed.error || parsed.message || "Assignment action failed.");
      return parsed;
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session?.access_token) {
      throw new Error("User is not authenticated or session has expired.");
    }

    const { data, error } = await supabase.functions.invoke("admin-route-lead", {
      body,
      headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
    });
    if (error) throw error;
    return data;
  } catch (error) {
    throw operatorSafeError(error);
  }
}

export async function routeLead(input: RouteLeadInput) {
  requireReason(input.reason_code);
  if (!hasIdentity(input)) throw new Error("Route Lead requires a lead/session/analysis identity.");
  if (!cleanText(input.client_slug)) throw new Error("Client slug is required.");
  return invokeRouteLead("route_lead", input as unknown as Record<string, unknown>);
}

export async function reassignLead(input: ReassignLeadInput) {
  requireReason(input.reason_code);
  if (!input.assignment_id && !hasIdentity(input)) throw new Error("This action requires an existing current assignment.");
  if (!cleanText(input.client_slug)) throw new Error("Client slug is required.");
  return invokeRouteLead("reassign_lead", input as unknown as Record<string, unknown>);
}

export async function recycleLead(input: RecycleLeadInput) {
  requireReason(input.reason_code);
  if (!input.assignment_id) throw new Error("This action requires an existing current assignment.");
  return invokeRouteLead("recycle_lead", input as unknown as Record<string, unknown>);
}

export async function markAssignmentManualReview(input: ManualReviewInput) {
  requireReason(input.reason_code);
  if (!input.assignment_id) throw new Error("This action requires an existing current assignment.");
  return invokeRouteLead("manual_review", input as unknown as Record<string, unknown>);
}

export async function addOperatorNote(input: OperatorNoteInput) {
  requireReason(input.reason_code);
  if (!input.assignment_id) throw new Error("This action requires an existing current assignment.");
  return invokeRouteLead("operator_note", input as unknown as Record<string, unknown>);
}
