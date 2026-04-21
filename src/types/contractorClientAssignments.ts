/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Contractor ↔ Client Assignment Types (Sprint 2)
 * ═══════════════════════════════════════════════════════════════════════════
 * Mirrors public.contractor_client_assignments and the four v_admin_* views.
 * The Supabase generated types file (src/integrations/supabase/types.ts) is
 * read-only and may lag a migration by one round-trip — these types let the
 * service layer compile and run immediately.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type AssignmentStatus = "active" | "paused" | "archived";
export type DispatchMethod = "webhook" | "email" | "manual" | "none";

export interface ContractorClientAssignment {
  id: string;
  created_at: string;
  updated_at: string;
  client_id: string;
  contractor_id: string;
  status: AssignmentStatus;
  is_primary: boolean;
  receives_leads: boolean;
  priority: number;
  dispatch_method: DispatchMethod;
  crm_webhook_url: string | null;
  crm_email: string | null;
  notes: string | null;
}

/** Shape accepted by createAssignment / updateAssignment. */
export interface ContractorClientAssignmentInput {
  client_id: string;
  contractor_id: string;
  status?: AssignmentStatus;
  is_primary?: boolean;
  receives_leads?: boolean;
  priority?: number;
  dispatch_method?: DispatchMethod;
  crm_webhook_url?: string | null;
  crm_email?: string | null;
  notes?: string | null;
}

// ─── Resolver output ──────────────────────────────────────────────────────

export interface ResolvedContractorReceiver {
  assignment_id: string;
  client_id: string;
  client_slug: string;
  client_name: string;
  contractor_id: string;
  company_name: string;
  is_primary: boolean;
  priority: number;
  dispatch_method: DispatchMethod;
  crm_webhook_url: string | null;
  crm_email: string | null;
}

// ─── Admin debug view rows ────────────────────────────────────────────────

export interface AssignmentRosterEntry {
  assignment_id: string;
  contractor_id?: string;
  client_id?: string;
  client_slug?: string;
  client_name?: string;
  company_name?: string;
  status: AssignmentStatus;
  is_primary: boolean;
  receives_leads: boolean;
  priority: number;
  dispatch_method: DispatchMethod;
}

export interface AssignmentsByClient {
  client_id: string;
  client_slug: string;
  client_name: string;
  client_is_active: boolean;
  active_receivers: number;
  total_assignments: number;
  has_primary: boolean | null;
  assignments: AssignmentRosterEntry[] | null;
}

export interface AssignmentsByContractor {
  contractor_id: string;
  company_name: string;
  contractor_status: string;
  is_vetted: boolean;
  active_client_count: number;
  total_assignments: number;
  assignments: AssignmentRosterEntry[] | null;
}

export interface UnassignedActiveClient {
  client_id: string;
  client_slug: string;
  client_name: string;
  created_at: string;
  lead_count: number;
}

export interface UnassignedActiveContractor {
  contractor_id: string;
  company_name: string;
  is_vetted: boolean;
  created_at: string;
  email: string | null;
  has_auth_user: boolean;
}
