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
  | "set_meta_client_active"
  | "preview_meta_route";

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
  set_meta_client_active: { client_slug: string; is_active: boolean };
  preview_meta_route: { client_slug?: string };
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
  const devSecret = import.meta.env.DEV ? import.meta.env.VITE_DEV_BYPASS_SECRET : undefined;
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
  const devSecret = import.meta.env.DEV ? import.meta.env.VITE_DEV_BYPASS_SECRET : undefined;

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
  const devSecret = import.meta.env.DEV ? import.meta.env.VITE_DEV_BYPASS_SECRET : undefined;

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

/**
 * Response type map for admin actions.
 */
export type AdminActionResponses = {
  [K in AdminAction]: any;
};
