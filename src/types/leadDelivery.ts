/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Sprint 5 — Lead delivery types (queue + immutable attempt log + admin views)
 * ═══════════════════════════════════════════════════════════════════════════
 * Mirrors the Sprint 5 schema. The Supabase generated types lag the new
 * webhook_delivery_attempts table and the four v_admin_* delivery views by
 * one round-trip — these types let the service layer compile and run now.
 *
 * READ-ONLY for the frontend. Only the dispatch-lead edge function writes.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { NoRouteReason } from "./routing";

export type DispatchMethod = "webhook" | "email" | "manual" | "none";

export type DeliveryStatus =
  | "pending"
  | "processing"
  | "delivered"
  | "failed"
  | "dead_letter"
  | "unroutable"
  | "mock_delivered"; // legacy sentinel — Sprint 5+ never produces this

export type AttemptOutcome =
  | "http_2xx"
  | "http_4xx"
  | "http_5xx"
  | "http_redirect"
  | "timeout"
  | "network_error"
  | "resend_accepted"
  | "resend_rejected"
  | "unsupported_dispatch_method"
  | "missing_destination"
  | "exception";

export interface DestinationSnapshot {
  dispatch_method: DispatchMethod;
  webhook_url: string | null;
  email: string | null;
  company_name: string | null;
}

// ─── Admin view rows ──────────────────────────────────────────────────────

export interface RecentDeliveryRow {
  delivery_id: string;
  lead_id: string;
  event_type: string;
  status: DeliveryStatus;
  client_slug: string | null;
  contractor_id: string | null;
  assignment_id: string | null;
  dispatch_method: DispatchMethod | null;
  no_route_reason: NoRouteReason | null;
  attempt_count: number;
  last_http_status: number | null;
  created_at: string;
  last_attempt_at: string | null;
  terminal_at: string | null;
  company_name: string | null;
  lead_first_name: string | null;
  lead_email: string | null;
}

export interface FailedDeliveryRow {
  delivery_id: string;
  lead_id: string;
  client_slug: string | null;
  contractor_id: string | null;
  company_name: string | null;
  dispatch_method: DispatchMethod | null;
  status: DeliveryStatus;
  no_route_reason: NoRouteReason | null;
  attempt_count: number;
  last_http_status: number | null;
  last_error: string | null;
  created_at: string;
  last_attempt_at: string | null;
  attempt_log_count: number;
}

export interface DeliveriesByClientRow {
  client_slug: string;
  total: number;
  pending: number;
  processing: number;
  delivered: number;
  failed: number;
  dead_letter: number;
  unroutable: number;
  most_recent_at: string | null;
}

export interface DeliveriesByContractorRow {
  contractor_id: string;
  company_name: string | null;
  total: number;
  delivered: number;
  failed_or_dead: number;
  pending: number;
  most_recent_at: string | null;
  distinct_clients: number;
}

// ─── Append-only attempt row (immutable proof) ────────────────────────────

export interface DeliveryAttemptRow {
  id: string;
  delivery_id: string;
  lead_id: string;
  client_slug: string | null;
  contractor_id: string | null;
  assignment_id: string | null;
  dispatch_method: DispatchMethod;
  destination_snapshot: Record<string, unknown>;
  attempt_number: number;
  request_started_at: string;
  request_completed_at: string | null;
  duration_ms: number | null;
  response_status_code: number | null;
  response_body_snippet: string | null;
  success: boolean;
  outcome: AttemptOutcome;
  error_class: string | null;
  error_message: string | null;
  created_at: string;
}
