/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Dispatch Healthcheck — Read-only operator visibility into the live
 * webhook_deliveries queue + dispatch-lead worker.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Grounded entirely in repo-real data:
 *   • public.webhook_deliveries          (queue rows, all statuses)
 *   • public.webhook_delivery_attempts   (immutable per-attempt audit log)
 *   • public.v_admin_routing_resolution  (per-client resolver truth)
 *
 * NOTHING here writes. The dispatch-lead edge function is the only producer
 * of attempt rows, and `fire_crm_handoff` is the only producer of queue rows.
 *
 * Used by the RoutingDesk Health strip — does NOT add a new admin tab.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { supabase } from "@/integrations/supabase/client";
import type { NoRouteReason } from "@/types/routing";

export interface DispatchHealthSnapshot {
  /** Queue counts by status — derived from webhook_deliveries directly. */
  counts: {
    pending: number;
    processing: number;
    delivered: number;
    failed: number;
    dead_letter: number;
    unroutable: number;
    total: number;
  };
  /** Most recent enqueue (any status). NULL means the trigger has never fired. */
  mostRecentEnqueueAt: string | null;
  /** Most recent attempt by the dispatch-lead worker. NULL means no drain has ever run. */
  mostRecentAttemptAt: string | null;
  /** Operator-derived state — never a backend status. */
  state: DispatchHealthState;
  /** Plain-language reason behind `state`. */
  stateReason: string;
}

export type DispatchHealthState =
  | "idle_no_traffic"        // queue empty AND no attempts ever — neutral
  | "draining"                // attempts in last 5 minutes, queue moving
  | "queue_idle"              // pending rows exist but worker hasn't run recently
  | "blocked_dead_letter"     // dead_letter accumulating (>=5)
  | "blocked_unroutable"      // unroutable accumulating (>=5)
  | "healthy";                // pending=0 and recent successful attempts

const FRESH_ATTEMPT_WINDOW_MS = 5 * 60_000;
const STALE_QUEUE_WINDOW_MS = 10 * 60_000;

export async function fetchDispatchHealth(): Promise<DispatchHealthSnapshot> {
  // Single SELECT — let Postgres aggregate. We use head:false + select('status,created_at,last_attempt_at')
  // and aggregate client-side because supabase-js does not expose .group().
  // Bounded by 1000 default — that's fine for a health snapshot; older rows
  // are still visible in the existing v_admin_recent_deliveries view.
  const { data, error } = await supabase
    .from("webhook_deliveries" as never)
    .select("status, created_at, last_attempt_at")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) throw error;

  const rows = (data ?? []) as Array<{
    status: string;
    created_at: string;
    last_attempt_at: string | null;
  }>;

  const counts = {
    pending: 0,
    processing: 0,
    delivered: 0,
    failed: 0,
    dead_letter: 0,
    unroutable: 0,
    total: rows.length,
  };

  let mostRecentEnqueue: number | null = null;
  let mostRecentAttempt: number | null = null;

  for (const r of rows) {
    if (r.status in counts) {
      (counts as Record<string, number>)[r.status] += 1;
    }
    const enq = new Date(r.created_at).getTime();
    if (mostRecentEnqueue === null || enq > mostRecentEnqueue) mostRecentEnqueue = enq;
    if (r.last_attempt_at) {
      const att = new Date(r.last_attempt_at).getTime();
      if (mostRecentAttempt === null || att > mostRecentAttempt) mostRecentAttempt = att;
    }
  }

  // Operator-derived state. Order matters — first match wins.
  const now = Date.now();
  let state: DispatchHealthState = "healthy";
  let stateReason = "Queue is clear and the worker is responsive.";

  if (counts.total === 0) {
    state = "idle_no_traffic";
    stateReason = "No leads have entered the dispatch queue yet.";
  } else if (counts.dead_letter >= 5) {
    state = "blocked_dead_letter";
    stateReason = `${counts.dead_letter} deliveries in dead_letter — operator action needed.`;
  } else if (counts.unroutable >= 5) {
    state = "blocked_unroutable";
    stateReason = `${counts.unroutable} deliveries unroutable — fix the assignment for the affected client.`;
  } else if (counts.pending > 0) {
    const attemptFresh =
      mostRecentAttempt !== null && now - mostRecentAttempt < FRESH_ATTEMPT_WINDOW_MS;
    const enqueueStale =
      mostRecentEnqueue !== null && now - mostRecentEnqueue > STALE_QUEUE_WINDOW_MS;

    if (attemptFresh) {
      state = "draining";
      stateReason = `${counts.pending} pending — worker is actively draining.`;
    } else if (enqueueStale) {
      state = "queue_idle";
      stateReason = `${counts.pending} pending and no worker attempt in the last 5 min. Cron is intentionally not wired in this sprint — invoke dispatch-lead to drain.`;
    } else {
      state = "draining";
      stateReason = `${counts.pending} pending — recently enqueued, worker should pick up shortly.`;
    }
  }

  return {
    counts,
    mostRecentEnqueueAt: mostRecentEnqueue ? new Date(mostRecentEnqueue).toISOString() : null,
    mostRecentAttemptAt: mostRecentAttempt ? new Date(mostRecentAttempt).toISOString() : null,
    state,
    stateReason,
  };
}

// ─── Per-opportunity blocked-reason resolver state ─────────────────────────
// Reads v_admin_routing_resolution → keyed by client_slug.
// Used by RoutingDesk to explain why a `brief_ready` opportunity has no route.

export interface ClientResolutionRow {
  client_slug: string;
  client_is_active: boolean;
  resolved: boolean;
  no_route_reason: NoRouteReason | null;
  contractor_id: string | null;
  company_name: string | null;
  dispatch_method: string | null;
  has_webhook_url: boolean;
  has_crm_email: boolean;
}

export async function fetchClientResolutions(): Promise<ClientResolutionRow[]> {
  const { data, error } = await supabase
    .from("v_admin_routing_resolution" as never)
    .select(
      "client_slug, client_is_active, resolved, no_route_reason, contractor_id, company_name, dispatch_method, has_webhook_url, has_crm_email",
    );
  if (error) throw error;
  return (data ?? []) as ClientResolutionRow[];
}

/** Plain operator text for a no_route_reason. Never invent reasons. */
export function describeNoRouteReason(reason: NoRouteReason | null): string {
  switch (reason) {
    case "lead_not_found":
      return "Lead record could not be found.";
    case "lead_has_no_slug":
      return "Lead has no client slug — backfill to 'direct' or assign a tenant.";
    case "slug_not_in_clients":
      return "Lead's client slug is not registered in the clients table.";
    case "client_inactive":
      return "Client tenant is inactive — activate it in Admin Settings.";
    case "no_active_assignment":
      return "Client has no active contractor assignment — seed one in Admin Settings.";
    case "assignment_missing_destination":
      return "Assignment exists but is missing a webhook URL or email.";
    case null:
    default:
      return "Routable — awaiting dispatch.";
  }
}

// ─── 24h attribution freshness ─────────────────────────────────────────────
// Read-only count of how many leads created in the last 24 hours actually
// have `fbp` / `fbc` populated. Pure aggregation against `public.leads`.
//
// Used by the existing DispatchHealthCard — does NOT add a new admin tab.

export interface AttributionFreshnessSnapshot {
  /** Total leads created in the last 24 hours. */
  total24h: number;
  /** Of those, how many have a non-null fbp value. */
  withFbp: number;
  /** Of those, how many have a non-null fbc value. */
  withFbc: number;
  /** Of those, how many have at least one of fbp / fbc. */
  withEither: number;
  /** ISO timestamp of the most recent lead in the window, or null. */
  mostRecentLeadAt: string | null;
}

export async function fetchAttributionFreshness(): Promise<AttributionFreshnessSnapshot> {
  const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();

  const { data, error } = await supabase
    .from("leads")
    .select("created_at, fbp, fbc")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) throw error;

  const rows = (data ?? []) as Array<{
    created_at: string;
    fbp: string | null;
    fbc: string | null;
  }>;

  let withFbp = 0;
  let withFbc = 0;
  let withEither = 0;
  for (const r of rows) {
    const hasFbp = typeof r.fbp === "string" && r.fbp.length > 0;
    const hasFbc = typeof r.fbc === "string" && r.fbc.length > 0;
    if (hasFbp) withFbp += 1;
    if (hasFbc) withFbc += 1;
    if (hasFbp || hasFbc) withEither += 1;
  }

  return {
    total24h: rows.length,
    withFbp,
    withFbc,
    withEither,
    mostRecentLeadAt: rows[0]?.created_at ?? null,
  };
}
