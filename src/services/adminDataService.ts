/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ADMIN DATA SERVICE — Frontend invoker for the admin-data Edge Function
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * FIX APPLIED: invokeAdminData now explicitly passes the user's session
 * access_token in the Authorization header. Without this, supabase.functions
 * .invoke() sends the anon key by default (which has no `sub` claim),
 * causing adminAuth.ts to reject every request with a 401.
 *
 * Root cause: supabase.functions.invoke() with verify_jwt: false on the
 * edge function falls back to the anon key as the Bearer token.
 * The backend's adminAuth.ts calls getUser(token) on that anon key,
 * Supabase Auth says "missing sub claim", and returns 403/bad_jwt.
 */

import { supabase } from "@/integrations/supabase/client";
import { peekDevSecret } from "@/lib/devSecret";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export type AppRole = "super_admin" | "operator" | "viewer";

export interface AdminDataError {
  code: string;
  message: string;
  status: number;
}

/**
 * All actions supported by the admin-data edge function (v2.2).
 * Must stay in sync with ACTION_ROLES in admin-data/index.ts.
 */
export type AdminAction =
  | "fetch_leads"
  | "update_lead_status"
  | "update_lead_deal_status"
  | "fetch_opportunities"
  | "fetch_contractors"
  | "fetch_routes"
  | "fetch_billable"
  | "route_opportunity"
  | "mark_dead"
  | "fetch_voice_followups"
  | "trigger_voice_followup"
  | "manage_user_roles"
  | "list_user_roles"
  | "get_role_audit_log"
  | "fetch_lead_events"
  | "fetch_webhook_deliveries"
  | "fetch_lead_analysis"
  | "fetch_lead_voice_followups"
  | "fetch_needs_review"
  | "rescan_lead"
  | "update_lead_manual_entry"
  | "list_contractor_accounts"
  | "get_contractor_ledger"
  | "adjust_contractor_credits"
  | "get_contractor_unlocks"
  | "list_invitations"
  | "create_invitation"
  | "revoke_invitation"
  | "list_meta_configurations"
  | "create_meta_client_config"
  | "save_client_config"
  | "set_meta_client_active"
  | "preview_meta_route"
  | "smoke_send_meta_event"
  // Lead workspace (Sprint 4 + 5)
  | "fetch_lead_detail"
  | "update_lead_funnel_stage"
  | "list_lead_notes"
  | "create_lead_note"
  | "delete_lead_note"
  | "list_lead_tasks"
  | "create_lead_task"
  | "update_lead_task"
  | "delete_lead_task"
  // Phase 10 — Human Context Layer
  | "update_lead_human_context"
  // Phase 26 — Mission Control Truth Strip drilldown
  | "fetch_quote_evidence"
  | "fetch_lead_evidence"
  | "fetch_stage_leads";

/**
 * Payload shapes for each admin action.
 * Extend as new actions are added to the edge function.
 */
export interface AdminActionPayloads {
  fetch_leads: Record<string, never>;
  update_lead_status: { lead_id: string; status: string };
  update_lead_deal_status: { lead_id: string; deal_status: string };
  fetch_opportunities: Record<string, never>;
  fetch_contractors: Record<string, never>;
  fetch_routes: { opportunity_id?: string };
  fetch_billable: Record<string, never>;
  route_opportunity: {
    opportunity_id: string;
    contractor_id: string;
    scan_session_id?: string;
  };
  mark_dead: { opportunity_id: string; scan_session_id?: string };
  fetch_voice_followups: Record<string, never>;
  trigger_voice_followup: {
    scan_session_id: string;
    phone_e164: string;
    opportunity_id?: string;
  };
  manage_user_roles: { target_user_id: string; new_role: AppRole };
  list_user_roles: Record<string, never>;
  get_role_audit_log: { limit?: number };
  fetch_lead_events: { lead_id: string; limit?: number };
  fetch_webhook_deliveries: { status?: string; limit?: number };
  fetch_lead_analysis: { analysis_id: string };
  fetch_lead_voice_followups: { lead_id: string };
  fetch_needs_review: Record<string, never>;
  rescan_lead: { lead_id: string };
  update_lead_manual_entry: { lead_id: string; manual_entry_data?: Record<string, unknown>; manually_reviewed?: boolean };
  list_contractor_accounts: Record<string, never>;
  get_contractor_ledger: { contractor_id: string; limit?: number };
  adjust_contractor_credits: { contractor_id: string; delta: number; entry_type: string; notes?: string | null };
  get_contractor_unlocks: { contractor_id: string; limit?: number };
  list_invitations: Record<string, never>;
  create_invitation: { invited_email: string; contractor_id: string; initial_credits?: number; expires_in_days?: number };
  revoke_invitation: { invitation_id: string };
  // CAPI control-plane (Meta multi-pixel routing)
  list_meta_configurations: Record<string, never>;
  create_meta_client_config: {
    client_slug: string;
    client_name: string;
    pixel_id: string;
    access_token: string;
    test_event_code?: string | null;
  };
  save_client_config: {
    client_id: string;
    google_ads_conversion_id?: string | null;
    google_ads_label?: string | null;
    meta_pixel_id?: string | null;
    meta_dataset_id?: string | null;
    gtm_server_url?: string | null;
    capi_token?: string | null;
  };
  set_meta_client_active: { client_slug: string; is_active: boolean };
  preview_meta_route: { client_slug?: string };
  smoke_send_meta_event: {
    client_slug?: string;
    test_event_code?: string;
    event_name?: "PageView" | "ViewContent" | "Lead" | "CompleteRegistration";
    event_source_url?: string;
  };
  // Lead workspace (Sprint 4 + 5)
  fetch_lead_detail: { lead_id: string };
  update_lead_funnel_stage: { lead_id: string; funnel_stage: string };
  list_lead_notes: { lead_id: string };
  create_lead_note: { lead_id: string; body: string; category?: string };
  delete_lead_note: { note_id: string };
  list_lead_tasks: { lead_id: string };
  create_lead_task: { lead_id: string; title: string; details?: string; due_at?: string | null };
  update_lead_task: {
    task_id: string;
    completed?: boolean;
    title?: string;
    details?: string;
    due_at?: string | null;
  };
  delete_lead_task: { task_id: string };
  // Phase 10
  update_lead_human_context: {
    lead_id: string;
    property_type_detail?: string | null;
    hoa_or_condo_complexity?: string | null;
    handoff_consent_status?: string | null;
  };
  // Phase 26 — Mission Control Truth Strip drilldown
  fetch_quote_evidence: { lead_id: string };
  fetch_lead_evidence: { lead_id: string };
  fetch_stage_leads: {
    stage: "captured" | "verified" | "scanned" | "routed" | "booked" | "closed";
    scope: "today" | "7d" | "all";
    limit?: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Voice Followup Types
// ═══════════════════════════════════════════════════════════════════════════

export interface VoiceFollowup {
  id: string;
  lead_id: string;
  call_intent: string;
  status: string;
  call_outcome: string | null;
  failure_reason: string | null;
  duration_seconds: number | null;
  recording_url: string | null;
  transcript_url: string | null;
  transcript_text: string | null;
  summary: string | null;
  booking_intent_detected: boolean;
  appointment_booked: boolean;
  scan_session_id: string | null;
  phone_e164: string;
  queued_at: string;
  started_at: string | null;
  answered_at: string | null;
  completed_at: string | null;
  created_at: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Response types (from admin-data edge function responses)
// ═══════════════════════════════════════════════════════════════════════════

export interface UserRoleEntry {
  id: string;
  user_id: string;
  email: string;
  role: AppRole;
  last_sign_in: string | null;
  updated_at: string | null;
}

export interface RoleAuditLogEntry {
  id: string;
  target_user_id: string;
  target_email: string;
  changed_by_user_id: string;
  changed_by_email: string;
  old_role?: string | null;
  new_role: AppRole;
  action: string;
  created_at: string;
}

export interface ListUserRolesResponse {
  users: UserRoleEntry[];
}

export interface RoleAuditLogResponse {
  entries: RoleAuditLogEntry[];
}

export interface LeadEvidenceResponse {
  lead: {
    id: string;
    created_at: string;
    updated_at: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone_e164: string | null;
    city: string | null;
    county: string | null;
    state: string | null;
    zip: string | null;
    latest_scan_session_id: string | null;
    latest_analysis_id: string | null;
    grade: string | null;
    status: string | null;
  };
  quote_files: Array<{
    id: string;
    lead_id: string | null;
    storage_path: string;
    status: string | null;
    created_at: string;
    related_scan_session_id: string | null;
    signed_url: string | null;
    signed_url_expires_in: number | null;
    signed_url_error: "signing_failed" | null;
  }>;
  scan_sessions: Array<{
    id: string;
    lead_id: string | null;
    quote_file_id: string | null;
    status: string;
    created_at: string;
    updated_at: string;
  }>;
  analyses: Array<{
    id: string;
    lead_id: string | null;
    scan_session_id: string | null;
    grade: string | null;
    analysis_status: string;
    confidence_score: number | null;
    rubric_version: string | null;
    document_type: string | null;
    document_is_window_door_related: boolean | null;
    dollar_delta: number | null;
    created_at: string;
    updated_at: string;
    flags_summary: { count: number; severities: Record<string, number> };
    preview_summary: { present: boolean; top_level_keys: string[] };
    proof_summary: { present: boolean; top_level_keys: string[] };
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Error Utilities
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Type guard: checks if an unknown value is an AdminDataError.
 */
export function isAdminDataError(error: unknown): error is AdminDataError {
  if (error === null || error === undefined || typeof error !== "object") {
    return false;
  }
  const obj = error as Record<string, unknown>;
  return "code" in obj && "message" in obj && "status" in obj;
}

/**
 * Extract a human-readable message from any error shape.
 */
export function getErrorMessage(error: unknown): string {
  if (isAdminDataError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unexpected error occurred";
}

// ═══════════════════════════════════════════════════════════════════════════
// Core Invoker
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Core invoker for the admin-data Edge Function.
 *
 * ⚠️  AUTH FIX: Explicitly passes session.access_token in the
 *     Authorization header. Without this override, supabase.functions
 *     .invoke() sends the anon key (which has no `sub` claim) and
 *     adminAuth.ts rejects it as bad_jwt / missing sub claim.
 */
export async function invokeAdminData<T extends AdminAction>(
  action: T,
  payload: AdminActionPayloads[T] = {} as AdminActionPayloads[T],
): Promise<any> {
  // ── DEV BYPASS: Use direct fetch to avoid supabase auto-attaching anon key ──
  const devSecret = peekDevSecret();
  if (devSecret) {
    console.log(`[adminDataService] DEV BYPASS: Using direct fetch for action "${action}"`);
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const resp = await fetch(`${supabaseUrl}/functions/v1/admin-data`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-dev-secret": devSecret,
      },
      body: JSON.stringify({ action, payload }),
    });

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({ error: resp.statusText }));
      const adminError: AdminDataError = {
        code: body.code || "invocation_error",
        message: body.error || `Edge function returned ${resp.status}`,
        status: resp.status,
      };
      console.error(`[adminDataService] ${action} failed:`, adminError);
      throw adminError;
    }

    const body = await resp.json();
    return body.data;
  }

  // ── Production: Use supabase client with session JWT ──
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    const authError: AdminDataError = {
      code: "auth_error",
      message: "User is not authenticated or session has expired.",
      status: 401,
    };
    console.error(`[adminDataService] ${action} failed: No active session.`, authError);
    throw authError;
  }

  const { data, error } = await supabase.functions.invoke("admin-data", {
    body: { action, payload },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error) {
    const adminError: AdminDataError = {
      code: "invocation_error",
      message: error.message || "Failed to contact admin-data",
      status: (error as any).status || 500,
    };
    console.error(`[adminDataService] ${action} failed:`, adminError);
    throw adminError;
  }

  return data.data;
}

// ═══════════════════════════════════════════════════════════════════════════
// Convenience Wrappers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * List all user roles (super_admin only).
 */
export async function listUserRoles(): Promise<ListUserRolesResponse> {
  return invokeAdminData("list_user_roles");
}

/**
 * Assign or change a user's role (super_admin only).
 * This is the function AdminSettings.tsx imports as `manageUserRole`.
 */
export async function manageUserRole(targetUserId: string, newRole: AppRole): Promise<{ success: boolean }> {
  return invokeAdminData("manage_user_roles", {
    target_user_id: targetUserId,
    new_role: newRole,
  });
}

/**
 * Get the role audit log with optional limit (super_admin only).
 */
export async function getRoleAuditLog(limit: number = 100): Promise<RoleAuditLogResponse> {
  return invokeAdminData("get_role_audit_log", { limit });
}

/**
 * Update lead status (operator+).
 */
export async function updateLeadStatus(leadId: string, status: string): Promise<{ success: boolean }> {
  return invokeAdminData("update_lead_status", { lead_id: leadId, status });
}

/**
 * Fetch lead events for a specific lead (timeline view).
 */
export async function fetchLeadEvents(leadId: string, limit = 50): Promise<any[]> {
  return invokeAdminData("fetch_lead_events", { lead_id: leadId, limit });
}

/**
 * Fetch webhook deliveries, optionally filtered by status.
 */
export async function fetchWebhookDeliveries(status?: string, limit = 200): Promise<any[]> {
  return invokeAdminData("fetch_webhook_deliveries", { status, limit } as any);
}

/**
 * Update lead deal_status (operator+). Used by the Power Dialer.
 */
export async function updateLeadDealStatus(leadId: string, dealStatus: string): Promise<{ success: boolean }> {
  return invokeAdminData("update_lead_deal_status", { lead_id: leadId, deal_status: dealStatus });
}

/**
 * Fetch analysis data (flags, grade, dollar_delta) for a specific analysis ID.
 */
export async function fetchLeadAnalysis(analysisId: string): Promise<any> {
  return invokeAdminData("fetch_lead_analysis", { analysis_id: analysisId });
}

/**
 * Fetch voice followups for a specific lead (call history).
 */
export async function fetchLeadVoiceFollowups(leadId: string): Promise<VoiceFollowup[]> {
  const result = await invokeAdminData("fetch_lead_voice_followups", { lead_id: leadId });
  return result ?? [];
}

/**
 * Autodial a lead via the dial-lead Edge Function.
 * Uses the same dev-bypass / session JWT pattern as invokeAdminData.
 */
export async function dialLead(leadId: string): Promise<{ success: boolean; followup_id: string; webhook_status: string }> {
  const devSecret = peekDevSecret();

  if (devSecret) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const resp = await fetch(`${supabaseUrl}/functions/v1/dial-lead`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-dev-secret": devSecret,
      },
      body: JSON.stringify({ lead_id: leadId }),
    });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({ error: resp.statusText }));
      throw { code: "dial_error", message: body.error || `dial-lead returned ${resp.status}`, status: resp.status } as AdminDataError;
    }
    return resp.json();
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) {
    throw { code: "auth_error", message: "Not authenticated", status: 401 } as AdminDataError;
  }

  const { data, error } = await supabase.functions.invoke("dial-lead", {
    body: { lead_id: leadId },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) {
    throw { code: "dial_error", message: error.message || "Failed to dial", status: 500 } as AdminDataError;
  }
  if (data?.error) {
    throw { code: "dial_error", message: data.error, status: 400 } as AdminDataError;
  }
  return data;
}

/**
 * Send contractor handoff dossier via the send-contractor-handoff Edge Function.
 * Uses the same dev-bypass / session JWT pattern as dialLead.
 */
export async function sendContractorHandoff(leadId: string): Promise<{ success: boolean; opportunity_id?: string; warning?: string }> {
  const devSecret = peekDevSecret();

  if (devSecret) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const resp = await fetch(`${supabaseUrl}/functions/v1/send-contractor-handoff`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-dev-secret": devSecret,
      },
      body: JSON.stringify({ lead_id: leadId }),
    });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({ error: resp.statusText }));
      throw { code: "handoff_error", message: body.error || `send-contractor-handoff returned ${resp.status}`, status: resp.status } as AdminDataError;
    }
    return resp.json();
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) {
    throw { code: "auth_error", message: "Not authenticated", status: 401 } as AdminDataError;
  }

  const { data, error } = await supabase.functions.invoke("send-contractor-handoff", {
    body: { lead_id: leadId },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) {
    throw { code: "handoff_error", message: error.message || "Failed to send handoff", status: 500 } as AdminDataError;
  }
  if (data?.error) {
    throw { code: "handoff_error", message: data.error, status: 400 } as AdminDataError;
  }
  return data;
}

/**
 * Fetch leads that need manual review (triage queue).
 */
export async function fetchNeedsReview(): Promise<any[]> {
  return invokeAdminData("fetch_needs_review");
}

/**
 * Update manual-entry data and/or review status for a lead.
 * Throws if lead_id is missing.
 */
export async function updateLeadManualEntry(params: {
  lead_id: string;
  manually_reviewed?: boolean;
  manual_entry_data?: Record<string, unknown>;
}): Promise<{ success: boolean }> {
  if (!params.lead_id) {
    throw { code: "validation_error", message: "lead_id is required", status: 400 } as AdminDataError;
  }
  return invokeAdminData("update_lead_manual_entry", params);
}

// ═══════════════════════════════════════════════════════════════════════════
// Phase 6 — Single-Client Delivery Spine: Routing wrappers
// All actions below are existing repo-real admin-data actions; these are
// just typed convenience wrappers. No new endpoints, no new payload shapes.
// ═══════════════════════════════════════════════════════════════════════════

import type {
  RoutingOpportunity,
  RoutingRoute,
  RoutingContractor,
} from "@/types/routingDesk";

/** List all contractor opportunities (operator+). */
export async function fetchOpportunities(): Promise<RoutingOpportunity[]> {
  const result = await invokeAdminData("fetch_opportunities");
  return (result ?? []) as RoutingOpportunity[];
}

/** List route rows, optionally filtered by opportunity_id (operator+). */
export async function fetchRoutes(opportunityId?: string): Promise<RoutingRoute[]> {
  const payload = opportunityId ? { opportunity_id: opportunityId } : {};
  const result = await invokeAdminData("fetch_routes", payload as any);
  return (result ?? []) as RoutingRoute[];
}

/** List contractors (operator+). */
export async function fetchContractors(): Promise<RoutingContractor[]> {
  const result = await invokeAdminData("fetch_contractors");
  return (result ?? []) as RoutingContractor[];
}

/** Mark an opportunity as dead (operator+). */
export async function markOpportunityDead(args: {
  opportunity_id: string;
  scan_session_id?: string;
}): Promise<{ success: boolean }> {
  return invokeAdminData("mark_dead", args);
}

/**
 * Direct route_opportunity wrapper — used internally by routeLeadToContractor.
 * Prefer the unified helper below for new call sites.
 */
export async function routeOpportunity(args: {
  opportunity_id: string;
  contractor_id: string;
  scan_session_id?: string;
}): Promise<{ success: boolean }> {
  return invokeAdminData("route_opportunity", args);
}

/**
 * ⭐ CANONICAL UNIFIED ROUTING HELPER ⭐
 *
 * One operator action = one canonical writer chain. Both RoutingDesk and
 * LeadDossierSheet call this — no parallel paths.
 *
 * Step 1: send-contractor-handoff — guarantees the opportunity row exists,
 *         dispatches the email, and sets lead.latest_opportunity_id. Returns
 *         opportunity_id we can attach a route to.
 * Step 2: route_opportunity — inserts the formal contractor_opportunity_routes
 *         row + sets routed_at on the opportunity (audit trail).
 *
 * If step 2 fails after step 1 succeeded, the opportunity still exists and
 * the email was sent; we surface a soft warning rather than throw, so the
 * operator can retry routing without re-emailing the contractor.
 */
export async function routeLeadToContractor(
  leadId: string,
  contractorId: string,
  scanSessionId?: string,
): Promise<{
  success: boolean;
  opportunity_id?: string;
  warning?: string;
  handoff_warning?: string;
}> {
  // 1. Handoff: upsert opportunity + send email.
  const handoff = await sendContractorHandoff(leadId);
  if (!handoff.success || !handoff.opportunity_id) {
    return {
      success: false,
      warning: handoff.warning ?? "Handoff did not return an opportunity_id",
    };
  }

  // 2. Attach formal route row + audit trail.
  try {
    await routeOpportunity({
      opportunity_id: handoff.opportunity_id,
      contractor_id: contractorId,
      ...(scanSessionId ? { scan_session_id: scanSessionId } : {}),
    });
  } catch (err) {
    // Opportunity exists, email sent, but route audit failed — surface as warning.
    return {
      success: true,
      opportunity_id: handoff.opportunity_id,
      handoff_warning: handoff.warning,
      warning: getErrorMessage(err),
    };
  }

  return {
    success: true,
    opportunity_id: handoff.opportunity_id,
    handoff_warning: handoff.warning,
  };
}

/**
 * Response type map for admin actions.
 */
export type AdminActionResponses = {
  [K in AdminAction]: any;
};

// ═══════════════════════════════════════════════════════════════════════════
// Lead workspace wrappers (Sprint 4 + 5)
// ═══════════════════════════════════════════════════════════════════════════

export interface LeadNote {
  id: string;
  lead_id: string;
  body: string;
  category: string | null;
  created_by: string | null;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadTask {
  id: string;
  lead_id: string;
  title: string;
  details: string | null;
  due_at: string | null;
  completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchLeadDetail(leadId: string): Promise<any> {
  return invokeAdminData("fetch_lead_detail", { lead_id: leadId });
}

export async function updateLeadFunnelStage(
  leadId: string,
  funnelStage: string,
): Promise<{ id: string; funnel_stage: string; updated_at: string }> {
  return invokeAdminData("update_lead_funnel_stage", { lead_id: leadId, funnel_stage: funnelStage });
}

export async function listLeadNotes(leadId: string): Promise<LeadNote[]> {
  const result = await invokeAdminData("list_lead_notes", { lead_id: leadId });
  return (result ?? []) as LeadNote[];
}

export async function createLeadNote(
  leadId: string,
  body: string,
  category?: string,
): Promise<LeadNote> {
  return invokeAdminData("create_lead_note", { lead_id: leadId, body, category });
}

export async function deleteLeadNote(noteId: string): Promise<{ success: boolean }> {
  return invokeAdminData("delete_lead_note", { note_id: noteId });
}

export async function listLeadTasks(leadId: string): Promise<LeadTask[]> {
  const result = await invokeAdminData("list_lead_tasks", { lead_id: leadId });
  return (result ?? []) as LeadTask[];
}

export async function createLeadTask(args: {
  lead_id: string;
  title: string;
  details?: string;
  due_at?: string | null;
}): Promise<LeadTask> {
  return invokeAdminData("create_lead_task", args);
}

export async function updateLeadTask(args: {
  task_id: string;
  completed?: boolean;
  title?: string;
  details?: string;
  due_at?: string | null;
}): Promise<LeadTask> {
  return invokeAdminData("update_lead_task", args);
}

export async function deleteLeadTask(taskId: string): Promise<{ success: boolean }> {
  return invokeAdminData("delete_lead_task", { task_id: taskId });
}

// ── Phase 10 — Human Context ───────────────────────────────────────────
export async function updateLeadHumanContext(args: {
  lead_id: string;
  property_type_detail?: string | null;
  hoa_or_condo_complexity?: string | null;
  handoff_consent_status?: string | null;
}): Promise<{ id: string; updated_at: string }> {
  return invokeAdminData("update_lead_human_context", args);
}

// ── Phase 26 — Mission Control Truth Strip drilldown ────────────────────
import type { StageLeadRow, QuoteEvidence } from "@/components/admin/types";

export async function fetchQuoteEvidence(leadId: string): Promise<QuoteEvidence> {
  return invokeAdminData("fetch_quote_evidence", { lead_id: leadId });
}

export async function fetchLeadEvidence(leadId: string): Promise<LeadEvidenceResponse> {
  return invokeAdminData("fetch_lead_evidence", { lead_id: leadId });
}

export async function fetchStageLeads(
  stage: AdminActionPayloads["fetch_stage_leads"]["stage"],
  scope: AdminActionPayloads["fetch_stage_leads"]["scope"],
  limit?: number,
): Promise<{ leads: StageLeadRow[] }> {
  return invokeAdminData("fetch_stage_leads", { stage, scope, limit });
}
