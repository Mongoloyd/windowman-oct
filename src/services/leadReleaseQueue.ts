import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type LeadReleaseStatus = "not_released" | "held" | "approved" | "revoked" | "blocked" | "manual_review";
export type AllowedContactField = "first_name" | "last_name" | "phone" | "email" | "city" | "county";
export type LeadReleaseDecisionAction = "approve" | "hold" | "block" | "revoke" | "manual_review";

export interface LeadReleaseQueueItem {
  assignmentId: string;
  assignmentIdMasked: string;
  contractorAccountIdMasked: string;
  contractorDisplayName: string;
  clientSlug: string;
  assignedAt: string;
  assignmentStatus: string;
  releaseStatus: LeadReleaseStatus;
  projectType: string | null;
  county: string | null;
  quoteRange: string | null;
  safeScoreBand: string | null;
  riskWarnings: string[];
  allowedContactFields: AllowedContactField[];
  lastDecisionAt: string | null;
}

export interface LeadReleaseTimelineEvent {
  id: string;
  createdAt: string;
  eventType: string;
  decision: string;
  reason: string | null;
  notes: string | null;
  allowedContactFields: AllowedContactField[];
}

export interface LeadReleaseDetail extends LeadReleaseQueueItem {
  safeProjectSummary: string;
  holdReason: string | null;
  blockReason: string | null;
  releaseNotes: string | null;
  timeline: LeadReleaseTimelineEvent[];
}

export interface LeadReleaseDecision {
  assignmentId: string;
  decision: LeadReleaseDecisionAction;
  allowedContactFields: AllowedContactField[];
  reason: string;
  notes?: string | null;
}

export interface LeadReleaseDecisionResult {
  ok: boolean;
  message: string;
  releaseStatus?: LeadReleaseStatus;
}

type AssignmentRow = {
  id: string;
  lead_id: string | null;
  scan_session_id: string | null;
  analysis_id: string | null;
  assigned_at: string;
  status: string;
  client_slug: string;
  contractor_account_id: string | null;
  is_current: boolean;
  metadata: Record<string, unknown> | null;
  contractor_accounts?: { id: string; display_name: string; client_slug: string; is_active: boolean; access_status?: string | null } | null;
};

function normalizeAssignmentRow(row: AssignmentRow & { contractor_accounts?: AssignmentRow["contractor_accounts"] | AssignmentRow["contractor_accounts"][] }): AssignmentRow {
  const joined = Array.isArray(row.contractor_accounts) ? row.contractor_accounts[0] ?? null : row.contractor_accounts ?? null;
  return { ...row, contractor_accounts: joined };
}

type ReleaseRow = {
  id: string;
  created_at: string;
  updated_at: string;
  lead_assignment_id: string;
  contractor_account_id: string;
  client_slug: string;
  release_status: LeadReleaseStatus;
  released_at: string | null;
  revoked_at: string | null;
  hold_reason: string | null;
  block_reason: string | null;
  release_notes: string | null;
  allowed_contact_fields: string[] | null;
};

type EventRow = {
  id: string;
  created_at: string;
  event_type: string;
  decision: string;
  reason: string | null;
  notes: string | null;
  allowed_contact_fields: string[] | null;
};

const db = supabase as unknown as SupabaseClient;
const RELEASE_TABLE = "lead_contact_releases";
const RELEASE_EVENTS_TABLE = "lead_contact_release_events";
const ALLOWED_FIELDS: AllowedContactField[] = ["first_name", "last_name", "phone", "email", "city", "county"];
const RELEASE_STATUSES: LeadReleaseStatus[] = ["not_released", "held", "approved", "revoked", "blocked", "manual_review"];

function safeError(error: unknown): Error {
  const raw = error instanceof Error ? error.message : "Lead release action failed.";
  if (/permission|policy|JWT|authenticated|operator|forbidden/i.test(raw)) return new Error("Internal operator permission is required for lead release actions.");
  if (/mismatch|foreign key|not_found|requires/i.test(raw)) return new Error("Release decision could not be matched to a valid assigned contractor opportunity.");
  return new Error(raw || "Lead release action failed.");
}

function maskId(value: string | null | undefined): string {
  if (!value) return "—";
  return value.length <= 12 ? value : `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function metadataString(metadata: Record<string, unknown> | null | undefined, keys: string[]): string | null {
  if (!metadata) return null;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function metadataNumber(metadata: Record<string, unknown> | null | undefined, keys: string[]): number | null {
  if (!metadata) return null;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function normalizeAllowedFields(fields: unknown): AllowedContactField[] {
  if (!Array.isArray(fields)) return [];
  return fields.filter((field): field is AllowedContactField => ALLOWED_FIELDS.includes(field as AllowedContactField));
}

function scoreBand(metadata: Record<string, unknown> | null): string | null {
  const band = metadataString(metadata, ["safe_score_band", "score_band", "grade_band"]);
  const grade = metadataString(metadata, ["grade"]);
  return band ?? (grade ? `${grade} band` : null);
}

function releaseStatusFrom(row: ReleaseRow | null | undefined): LeadReleaseStatus {
  return row && RELEASE_STATUSES.includes(row.release_status) ? row.release_status : "not_released";
}

function rowRiskWarnings(row: AssignmentRow, release: ReleaseRow | null): string[] {
  const warnings: string[] = [];
  if (!row.contractor_account_id) warnings.push("missing_contractor_account");
  if (!row.is_current) warnings.push("assignment_not_current");
  if (row.contractor_accounts?.client_slug && row.contractor_accounts.client_slug !== row.client_slug) warnings.push("contractor_client_slug_mismatch");
  if (row.contractor_accounts?.is_active === false) warnings.push("contractor_inactive");
  if (row.contractor_accounts?.access_status && row.contractor_accounts.access_status !== "active") warnings.push(`contractor_${row.contractor_accounts.access_status}`);
  if (!release) warnings.push("no_release_record");
  if (release?.release_status === "approved" && normalizeAllowedFields(release.allowed_contact_fields).length === 0) warnings.push("approved_without_contact_fields");
  return warnings;
}

function assignmentToItem(row: AssignmentRow, release: ReleaseRow | null): LeadReleaseQueueItem {
  const metadata = row.metadata ?? {};
  return {
    assignmentId: row.id,
    assignmentIdMasked: maskId(row.id),
    contractorAccountIdMasked: maskId(row.contractor_account_id),
    contractorDisplayName: row.contractor_accounts?.display_name ?? "Unlinked contractor account",
    clientSlug: row.client_slug,
    assignedAt: row.assigned_at,
    assignmentStatus: row.status,
    releaseStatus: releaseStatusFrom(release),
    projectType: metadataString(metadata, ["project_type", "projectType"]),
    county: metadataString(metadata, ["county", "region"]),
    quoteRange: metadataString(metadata, ["quote_range", "quoteRange"]),
    safeScoreBand: scoreBand(metadata),
    riskWarnings: rowRiskWarnings(row, release),
    allowedContactFields: normalizeAllowedFields(release?.allowed_contact_fields),
    lastDecisionAt: release?.updated_at ?? null,
  };
}

function validateDecision(input: LeadReleaseDecision) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.assignmentId)) throw new Error("A valid assignment ID is required.");
  if (!["approve", "hold", "block", "revoke", "manual_review"].includes(input.decision)) throw new Error("Invalid release decision.");
  if (!input.reason.trim()) throw new Error("A reason is required for release decisions.");
  if (input.allowedContactFields.some((field) => !ALLOWED_FIELDS.includes(field))) throw new Error("Allowed contact fields include an unsupported field.");
}

function decisionStatus(decision: LeadReleaseDecisionAction): LeadReleaseStatus {
  if (decision === "approve") return "approved";
  if (decision === "hold") return "held";
  if (decision === "block") return "blocked";
  if (decision === "revoke") return "revoked";
  return "manual_review";
}

function eventType(decision: LeadReleaseDecisionAction): string {
  return decision === "approve" ? "approved" : decision === "hold" ? "held" : decision === "block" ? "blocked" : decision === "revoke" ? "revoked" : "manual_review";
}

export function formatLeadReleaseStatus(status: LeadReleaseStatus): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatAllowedContactField(field: AllowedContactField): string {
  if (field === "first_name") return "First name";
  if (field === "last_name") return "Last name";
  return field.replace(/\b\w/g, (char) => char.toUpperCase());
}

export async function fetchLeadReleaseQueue(): Promise<LeadReleaseQueueItem[]> {
  const { data: assignments, error } = await db
    .from("lead_assignments")
    .select("id, lead_id, scan_session_id, analysis_id, assigned_at, status, client_slug, contractor_account_id, is_current, metadata, contractor_accounts(id, display_name, client_slug, is_active, access_status)")
    .not("contractor_account_id", "is", null)
    .order("assigned_at", { ascending: false })
    .limit(200);
  if (error) throw safeError(error);

  const rows = ((assignments ?? []) as unknown as Array<AssignmentRow & { contractor_accounts?: AssignmentRow["contractor_accounts"] | AssignmentRow["contractor_accounts"][] }>).map(normalizeAssignmentRow);
  const assignmentIds = rows.map((row) => row.id);
  let releases: ReleaseRow[] = [];
  if (assignmentIds.length > 0) {
    const releaseResult = await db.from(RELEASE_TABLE).select("*").in("lead_assignment_id", assignmentIds);
    if (releaseResult.error) throw safeError(releaseResult.error);
    releases = (releaseResult.data ?? []) as ReleaseRow[];
  }
  const releaseByAssignment = new Map(releases.map((row) => [row.lead_assignment_id, row]));
  return rows.map((row) => assignmentToItem(row, releaseByAssignment.get(row.id) ?? null));
}

export async function fetchLeadReleaseDetail(assignmentId: string): Promise<LeadReleaseDetail> {
  const { data, error } = await db
    .from("lead_assignments")
    .select("id, lead_id, scan_session_id, analysis_id, assigned_at, status, client_slug, contractor_account_id, is_current, metadata, contractor_accounts(id, display_name, client_slug, is_active, access_status)")
    .eq("id", assignmentId)
    .maybeSingle();
  if (error) throw safeError(error);
  if (!data) throw new Error("Release queue assignment was not found.");
  const assignment = normalizeAssignmentRow(data as unknown as AssignmentRow & { contractor_accounts?: AssignmentRow["contractor_accounts"] | AssignmentRow["contractor_accounts"][] });

  const [{ data: releaseData, error: releaseError }, { data: eventsData, error: eventsError }] = await Promise.all([
    db.from(RELEASE_TABLE).select("*").eq("lead_assignment_id", assignmentId).maybeSingle(),
    db.from(RELEASE_EVENTS_TABLE).select("id, created_at, event_type, decision, reason, notes, allowed_contact_fields").eq("lead_assignment_id", assignmentId).order("created_at", { ascending: true }),
  ]);
  if (releaseError) throw safeError(releaseError);
  if (eventsError) throw safeError(eventsError);

  const release = (releaseData as ReleaseRow | null) ?? null;
  const metadata = assignment.metadata ?? {};
  return {
    ...assignmentToItem(assignment, release),
    safeProjectSummary: metadataString(metadata, ["safe_project_summary", "project_summary"]) ?? "Assigned opportunity is available for internal release review. Contact visibility remains off unless approved.",
    holdReason: release?.hold_reason ?? null,
    blockReason: release?.block_reason ?? null,
    releaseNotes: release?.release_notes ?? null,
    timeline: ((eventsData ?? []) as EventRow[]).map((event) => ({
      id: event.id,
      createdAt: event.created_at,
      eventType: event.event_type,
      decision: event.decision,
      reason: event.reason,
      notes: event.notes,
      allowedContactFields: normalizeAllowedFields(event.allowed_contact_fields),
    })),
  };
}

export async function submitLeadReleaseDecision(input: LeadReleaseDecision): Promise<LeadReleaseDecisionResult> {
  try {
    validateDecision(input);
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) throw new Error("Internal operator authentication is required.");

    const { data: assignmentData, error: assignmentError } = await db
      .from("lead_assignments")
      .select("id, lead_id, scan_session_id, analysis_id, client_slug, contractor_account_id, is_current")
      .eq("id", input.assignmentId)
      .maybeSingle();
    if (assignmentError) throw assignmentError;
    if (!assignmentData?.contractor_account_id) throw new Error("Release decision requires an assigned contractor account.");

    const assignment = assignmentData as AssignmentRow;
    const status = decisionStatus(input.decision);
    const now = new Date().toISOString();
    const allowedFields = status === "approved" ? input.allowedContactFields : [];
    const releasePayload = {
      lead_assignment_id: assignment.id,
      contractor_account_id: assignment.contractor_account_id,
      client_slug: assignment.client_slug,
      release_status: status,
      released_at: status === "approved" ? now : null,
      released_by: status === "approved" ? userData.user.id : null,
      revoked_at: status === "revoked" ? now : null,
      revoked_by: status === "revoked" ? userData.user.id : null,
      hold_reason: status === "held" ? input.reason.trim() : null,
      block_reason: status === "blocked" ? input.reason.trim() : null,
      release_notes: input.notes?.trim() || null,
      allowed_contact_fields: allowedFields,
      audit_metadata: { ui_source: "lead_release_queue", external_dispatch: false, quote_file_exposure: false, outcome_submission: false },
    };

    const { data: releaseData, error: releaseError } = await db
      .from(RELEASE_TABLE)
      .upsert(releasePayload, { onConflict: "lead_assignment_id,contractor_account_id" })
      .select("id")
      .single();
    if (releaseError) throw releaseError;

    const { error: eventError } = await db.from(RELEASE_EVENTS_TABLE).insert({
      release_id: (releaseData as { id: string }).id,
      lead_assignment_id: assignment.id,
      contractor_account_id: assignment.contractor_account_id,
      client_slug: assignment.client_slug,
      event_type: eventType(input.decision),
      decision: input.decision,
      actor_id: userData.user.id,
      allowed_contact_fields: allowedFields,
      reason: input.reason.trim(),
      notes: input.notes?.trim() || null,
      audit_metadata: { ui_source: "lead_release_queue", external_dispatch: false, quote_file_exposure: false, outcome_submission: false },
    });
    if (eventError) throw eventError;

    return { ok: true, message: `Release decision saved as ${formatLeadReleaseStatus(status)}.`, releaseStatus: status };
  } catch (error) {
    const safe = safeError(error);
    return { ok: false, message: safe.message };
  }
}
