/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Routing Desk — Shared Types (Phase 6: Single-Client Delivery Spine)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Mirrors the canonical Postgres shapes for `contractor_opportunities`,
 * `contractor_opportunity_routes`, and `contractors`. Operator-facing
 * derivations ("stale", "reactivation candidate") are computed on the
 * client only — never written back as a backend status.
 */

export interface RoutingContractor {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  status: string;
}

export interface RoutingOpportunity {
  id: string;
  lead_id: string;
  scan_session_id: string;
  analysis_id: string;
  status: string; // intro_requested | sent_to_contractor | declined | closed | dead | …
  intro_requested_at: string | null;
  routed_at: string | null;
  sent_at: string | null;
  county: string | null;
  project_type: string | null;
  window_count: number | null;
  quote_range: string | null;
  grade: string | null;
  flag_count: number;
  red_flag_count: number;
  amber_flag_count: number;
  priority_score: number;
  brief_text: string | null;
  brief_json: Record<string, unknown> | null;
  brief_version: string | null;
  brief_generated_at: string | null;
  homeowner_contact_released_at: string | null;
  suggested_contractor_id: string | null;
  client_slug: string | null;
  internal_notes: string | null;
  last_call_intent: string | null;
  last_call_requested_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoutingRoute {
  id: string;
  opportunity_id: string;
  contractor_id: string;
  route_status: string; // suggested | sent | viewed | interested | declined | …
  sent_at: string | null;
  viewed_at: string | null;
  responded_at: string | null;
  interested_at: string | null;
  contact_released: boolean;
  contact_released_at: string | null;
  release_status: string; // none | requested | approved | denied
  release_requested_at: string | null;
  release_reviewed_at: string | null;
  release_reviewed_by: string | null;
  release_denial_reason: string | null;
  routing_reason: string | null;
  response_notes: string | null;
  assigned_by: string | null;
  created_at: string;
}

/**
 * Phase 7 — Ownership-aware operator badges.
 * All values are *derived* from repo-real timestamps on
 * `contractor_opportunity_routes` and the parent lead. They are NOT
 * backend statuses. Always render with operator-facing language.
 */
export type OwnershipBadge =
  | "currently_assigned"      // an active route exists, contact not released
  | "released"                // route.contact_released = true OR release_status = 'approved'
  | "previously_assigned"     // ≥2 routes for this opportunity (history present)
  | "recovery_candidate"      // operator-derived (report_unlocked >14d, never routed)
  | "reassignable";           // released OR (no active route AND prior route exists)

/**
 * Operator-derived UI groupings — NOT backend statuses.
 */
export type OperatorBucket =
  | "ready_to_route"
  | "routed"
  | "stale_operator_view"
  | "reactivation_operator_view";

export interface RoutingDeskRow {
  opportunity: RoutingOpportunity;
  latestRoute: RoutingRoute | null;
  contractor: RoutingContractor | null;
  bucket: OperatorBucket;
}

/**
 * Lightweight lead summary needed to compute reactivation candidates and
 * hydrate row-level context (homeowner name, phone, last call). Pulled from
 * the already-loaded CRMLead set in AdminDashboard.
 */
export interface RoutingLeadContext {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone_e164: string | null;
  county: string | null;
  report_unlocked_at: string | null;
  routed_to_contractor_at: string | null;
  appointment_booked_at: string | null;
  last_call_completed_at: string | null;
  latest_opportunity_id: string | null;
  latest_scan_session_id: string | null;
}

export interface OneContractorSummaryCounts {
  routed: number;
  contacted: number;
  booked: number;
  staleOperatorView: number;
  reactivationOperatorView: number;
}
