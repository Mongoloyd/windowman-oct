/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Sprint 4 — Routing Resolver Service (READ-ONLY)
 * ═══════════════════════════════════════════════════════════════════════════
 * Wraps the deterministic resolver RPCs and the three v_admin_routing_* views.
 *
 * Resolution rules (enforced by the SQL function — DO NOT recompute here):
 *   1. Prefer assignment.is_primary = true
 *   2. Otherwise lowest priority number (ASC)
 *   3. Tie-break on oldest assignment.created_at (ASC)
 *
 * NO DELIVERY SIDE EFFECTS in this sprint. Callers may consume the chosen
 * route to render UI or to plan a future delivery — but actually firing the
 * webhook / email is Sprint 5's responsibility.
 *
 * Coexistence with legacy fire_crm_handoff:
 *   - The legacy DB trigger continues to queue rows in webhook_deliveries.
 *   - This resolver does NOT touch that queue.
 *   - fetchLegacyVsNewRouting() exposes the audit view used to plan the
 *     Sprint 5 hard-guard against double-fire.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  ResolvedRoute,
  RoutingResolutionRow,
  UnroutedLeadRow,
  LegacyVsNewRoutingRow,
} from "@/types/routing";

// ─── Resolvers (RPC) ──────────────────────────────────────────────────────

/**
 * Resolve the single chosen route for a lead.
 * Always returns ONE row — either resolved=true with destination details,
 * or resolved=false with a typed `no_route_reason`.
 */
export async function resolveRouteForLead(leadId: string): Promise<ResolvedRoute> {
  const { data, error } = await supabase.rpc(
    "resolve_route_for_lead" as never,
    { p_lead_id: leadId } as never
  );
  if (error) throw error;
  const rows = (data ?? []) as ResolvedRoute[];
  if (rows.length === 0) {
    // Defensive: the function always returns one row, but never trust the wire.
    return {
      lead_id: leadId,
      client_slug: null,
      client_id: null,
      client_name: null,
      assignment_id: null,
      contractor_id: null,
      company_name: null,
      is_primary: null,
      priority: null,
      dispatch_method: null,
      crm_webhook_url: null,
      crm_email: null,
      resolved: false,
      no_route_reason: "lead_not_found",
    };
  }
  return rows[0];
}

/** Resolve the single chosen route for a client_slug (operator preview). */
export async function resolveRouteForSlug(clientSlug: string): Promise<ResolvedRoute> {
  const { data, error } = await supabase.rpc(
    "resolve_route_for_slug" as never,
    { p_client_slug: clientSlug } as never
  );
  if (error) throw error;
  const rows = (data ?? []) as ResolvedRoute[];
  if (rows.length === 0) {
    return {
      client_slug: clientSlug,
      client_id: null,
      client_name: null,
      assignment_id: null,
      contractor_id: null,
      company_name: null,
      is_primary: null,
      priority: null,
      dispatch_method: null,
      crm_webhook_url: null,
      crm_email: null,
      resolved: false,
      no_route_reason: "slug_not_in_clients",
    };
  }
  return rows[0];
}

// ─── Admin debug views ────────────────────────────────────────────────────

export async function fetchRoutingResolution(): Promise<RoutingResolutionRow[]> {
  const { data, error } = await supabase
    .from("v_admin_routing_resolution" as never)
    .select("*");
  if (error) throw error;
  return (data ?? []) as RoutingResolutionRow[];
}

export async function fetchLeadsUnrouted(): Promise<UnroutedLeadRow[]> {
  const { data, error } = await supabase
    .from("v_admin_leads_unrouted" as never)
    .select("*");
  if (error) throw error;
  return (data ?? []) as UnroutedLeadRow[];
}

export async function fetchLegacyVsNewRouting(): Promise<LegacyVsNewRoutingRow[]> {
  const { data, error } = await supabase
    .from("v_admin_legacy_vs_new_routing" as never)
    .select("*");
  if (error) throw error;
  return (data ?? []) as LegacyVsNewRoutingRow[];
}
