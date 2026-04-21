/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Sprint 4 — Deterministic Routing Resolver Types
 * ═══════════════════════════════════════════════════════════════════════════
 * Mirrors public.resolve_route_for_lead / resolve_route_for_slug and the
 * three v_admin_* routing views. The Supabase generated types file lags new
 * functions/views by one round-trip — these types let the service layer
 * compile and run immediately.
 *
 * IMPORTANT: this module is READ-ONLY mapping. Sprint 4 does not deliver.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { DispatchMethod } from "./contractorClientAssignments";

/** Every reason the resolver may return when it cannot route a lead. */
export type NoRouteReason =
  | "lead_not_found"
  | "lead_has_no_slug"
  | "slug_not_in_clients"
  | "client_inactive"
  | "no_active_assignment"
  | "assignment_missing_destination";

/** One row returned by resolve_route_for_lead / resolve_route_for_slug. */
export interface ResolvedRoute {
  lead_id?: string | null;        // present on resolve_route_for_lead, absent on slug variant
  client_slug: string | null;
  client_id: string | null;
  client_name: string | null;
  assignment_id: string | null;
  contractor_id: string | null;
  company_name: string | null;
  is_primary: boolean | null;
  priority: number | null;
  dispatch_method: DispatchMethod | null;
  crm_webhook_url: string | null;
  crm_email: string | null;
  resolved: boolean;
  no_route_reason: NoRouteReason | null;
}

// ─── Admin view rows ──────────────────────────────────────────────────────

export interface RoutingResolutionRow {
  client_id: string;
  client_slug: string;
  client_name: string;
  client_is_active: boolean;
  assignment_id: string | null;
  contractor_id: string | null;
  company_name: string | null;
  is_primary: boolean | null;
  priority: number | null;
  dispatch_method: DispatchMethod | null;
  has_webhook_url: boolean;
  has_crm_email: boolean;
  resolved: boolean;
  no_route_reason: NoRouteReason | null;
}

export interface UnroutedLeadRow {
  lead_id: string;
  created_at: string;
  client_slug: string | null;
  phone_verified: boolean;
  latest_analysis_id: string | null;
  no_route_reason: NoRouteReason;
  client_id: string | null;
  client_name: string | null;
}

export type CoexistenceState = "BOTH_PATHS_ACTIVE" | "LEGACY_ONLY" | "UNKNOWN";

export interface LegacyVsNewRoutingRow {
  legacy_delivery_id: string;
  lead_id: string;
  legacy_event_type: string;
  legacy_status: string;
  legacy_created_at: string;
  client_slug: string | null;
  new_resolver_resolved: boolean;
  new_resolver_reason: NoRouteReason | null;
  new_chosen_contractor_id: string | null;
  new_chosen_company: string | null;
  new_dispatch_method: DispatchMethod | null;
  coexistence_state: CoexistenceState;
}
