/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Contractor ↔ Client Assignments Service (Sprint 2)
 * ═══════════════════════════════════════════════════════════════════════════
 * Canonical bridge between paying tenants (clients) and operating contractors.
 *
 * This is the SOURCE OF TRUTH for "who is authorized to receive leads for
 * which client". All future dispatcher logic must read from this table —
 * never from contractors.client_slug or any denormalized shortcut.
 *
 * Resolver path:
 *   lead.client_slug → clients.id → contractor_client_assignments
 *                                   (status='active' AND receives_leads=true)
 *
 * Access:
 *   - SELECT:  internal operators OR the contractor themselves (own rows)
 *   - INSERT/UPDATE/DELETE: internal operators only
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  ContractorClientAssignment,
  ContractorClientAssignmentInput,
  ResolvedContractorReceiver,
  AssignmentsByClient,
  AssignmentsByContractor,
  UnassignedActiveClient,
  UnassignedActiveContractor,
} from "@/types/contractorClientAssignments";

// ─── Mutations ────────────────────────────────────────────────────────────

export async function createAssignment(
  input: ContractorClientAssignmentInput
): Promise<ContractorClientAssignment> {
  const { data, error } = await supabase
    .from("contractor_client_assignments")
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data as ContractorClientAssignment;
}

export async function updateAssignment(
  id: string,
  patch: Partial<ContractorClientAssignmentInput>
): Promise<ContractorClientAssignment> {
  const { data, error } = await supabase
    .from("contractor_client_assignments")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as ContractorClientAssignment;
}

export async function deleteAssignment(id: string): Promise<void> {
  const { error } = await supabase
    .from("contractor_client_assignments")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// ─── Reads ────────────────────────────────────────────────────────────────

export async function listAllAssignments(): Promise<ContractorClientAssignment[]> {
  const { data, error } = await supabase
    .from("contractor_client_assignments")
    .select("*")
    .order("is_primary", { ascending: false })
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ContractorClientAssignment[];
}

export async function listAssignmentsForClient(
  clientId: string
): Promise<ContractorClientAssignment[]> {
  const { data, error } = await supabase
    .from("contractor_client_assignments")
    .select("*")
    .eq("client_id", clientId)
    .order("is_primary", { ascending: false })
    .order("priority", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ContractorClientAssignment[];
}

export async function listAssignmentsForContractor(
  contractorId: string
): Promise<ContractorClientAssignment[]> {
  const { data, error } = await supabase
    .from("contractor_client_assignments")
    .select("*")
    .eq("contractor_id", contractorId)
    .order("is_primary", { ascending: false })
    .order("priority", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ContractorClientAssignment[];
}

// ─── Canonical resolver ───────────────────────────────────────────────────
// Maps lead.client_slug → ordered list of active receivers.
// Use this from edge functions / dispatcher logic — NOT from raw .from() queries.

export async function resolveContractorsForClientSlug(
  clientSlug: string
): Promise<ResolvedContractorReceiver[]> {
  const { data, error } = await supabase.rpc(
    "resolve_contractors_for_client_slug" as never,
    { p_client_slug: clientSlug } as never
  );

  if (error) throw error;
  return (data ?? []) as ResolvedContractorReceiver[];
}

// ─── Admin debug views ────────────────────────────────────────────────────

export async function fetchAssignmentsByClient(): Promise<AssignmentsByClient[]> {
  const { data, error } = await supabase
    .from("v_admin_assignments_by_client" as never)
    .select("*");

  if (error) throw error;
  return (data ?? []) as AssignmentsByClient[];
}

export async function fetchAssignmentsByContractor(): Promise<AssignmentsByContractor[]> {
  const { data, error } = await supabase
    .from("v_admin_assignments_by_contractor" as never)
    .select("*");

  if (error) throw error;
  return (data ?? []) as AssignmentsByContractor[];
}

export async function fetchUnassignedActiveClients(): Promise<UnassignedActiveClient[]> {
  const { data, error } = await supabase
    .from("v_admin_unassigned_active_clients" as never)
    .select("*");

  if (error) throw error;
  return (data ?? []) as UnassignedActiveClient[];
}

export async function fetchUnassignedActiveContractors(): Promise<UnassignedActiveContractor[]> {
  const { data, error } = await supabase
    .from("v_admin_active_contractors_unassigned" as never)
    .select("*");

  if (error) throw error;
  return (data ?? []) as UnassignedActiveContractor[];
}
