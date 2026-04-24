/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FUNNEL METRICS — Phase 26 canonical engine
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Single source of truth for the Mission Control Truth Strip.
 *
 * Replaces the legacy `latest_analysis_id` proxy used by CommandCenter.tsx
 * and ConversionFunnel.tsx. Every dashboard surface that reads funnel counts
 * MUST go through `computeFunnelMetrics` so the numbers cannot disagree.
 *
 * Canonical predicates (timestamps in scope):
 *   captured  → created_at
 *   verified  → phone_verified_at
 *   scanned   → scan_count > 0  AND  updated_at        ← repo-real
 *   routed    → routed_to_contractor_at
 *   booked    → appointment_booked_at
 *   closed    → closed_at  AND  deal_status ∈ CLOSED_STATUSES
 *
 * This file is pure (no React, no fetch). Safe to import anywhere.
 */

import type { CRMLead } from "@/components/admin/types";

// Sprint 1 backend canonical: `sold_closed`. Legacy synonyms kept for older rows.
export const CLOSED_STATUSES = new Set<string>([
  "sold_closed",
  "won",
  "closed_won",
  "sold",
  "closed",
]);

export type Scope = "today" | "7d" | "all";

export type StageKey =
  | "captured" | "verified" | "scanned"
  | "routed"   | "booked"   | "closed";

export interface StageMetric {
  count: number;
  prevCount: number;
  delta: number;
  /** null when prior window is empty (no baseline). */
  deltaPct: number | null;
  /** null for the baseline (Captured). */
  convPct: number | null;
}

export type FunnelMetrics = Record<StageKey, StageMetric>;

export const STAGE_KEYS: StageKey[] = [
  "captured", "verified", "scanned", "routed", "booked", "closed",
];

const PRIOR_OF: Record<StageKey, StageKey | null> = {
  captured: null,
  verified: "captured",
  scanned:  "captured",
  routed:   "verified",
  booked:   "routed",
  closed:   "booked",
};

function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Returns the active window plus a same-length prior window for delta.
 * For `all`: compare last 30d vs prior 30d (active window includes everything
 * since 0 — the prior window is only used for the trend chip).
 */
export function getScopeWindow(scope: Scope): {
  start: number; prevStart: number; prevEnd: number;
} {
  const now = Date.now();
  if (scope === "today") {
    const start = startOfTodayMs();
    const span = now - start;
    return { start, prevStart: start - span, prevEnd: start };
  }
  if (scope === "7d") {
    const span = 7 * 24 * 60 * 60 * 1000;
    const start = now - span;
    return { start, prevStart: start - span, prevEnd: start };
  }
  const span = 30 * 24 * 60 * 60 * 1000;
  const start = now - span;
  return { start: 0, prevStart: start - span, prevEnd: start };
}

function ts(s: string | null | undefined): number | null {
  if (!s) return null;
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? null : t;
}

function pctRound(n: number, d: number): number {
  if (d <= 0) return 0;
  return Math.round((n / d) * 100);
}

/**
 * Canonical stage-entry timestamp for a lead. Returns `null` when the lead
 * has not entered that stage. For `scanned`, the predicate also requires
 * `scan_count > 0` — matching the repo-real backend rule used by
 * `fetch_stage_leads`.
 */
export function getStageTimestamp(lead: CRMLead, stage: StageKey): number | null {
  switch (stage) {
    case "captured": return ts(lead.created_at);
    case "verified": return ts(lead.phone_verified_at);
    case "scanned":  return (lead.scan_count ?? 0) > 0 ? ts(lead.updated_at) : null;
    case "routed":   return ts(lead.routed_to_contractor_at);
    case "booked":   return ts(lead.appointment_booked_at);
    case "closed": {
      if (!lead.closed_at) return null;
      const status = (lead.deal_status ?? "").toLowerCase();
      if (!CLOSED_STATUSES.has(status)) return null;
      return ts(lead.closed_at);
    }
  }
}

/**
 * Compute counts + deltas + stage-to-prior conversion for the given scope.
 * Used by MasterCommandCenter and any other surface that displays the funnel.
 */
export function computeFunnelMetrics(
  leads: CRMLead[],
  scope: Scope,
): FunnelMetrics {
  const { start, prevStart, prevEnd } = getScopeWindow(scope);

  const counts: Record<StageKey, number> = {
    captured: 0, verified: 0, scanned: 0, routed: 0, booked: 0, closed: 0,
  };
  const prevCounts: Record<StageKey, number> = {
    captured: 0, verified: 0, scanned: 0, routed: 0, booked: 0, closed: 0,
  };

  for (const l of leads) {
    for (const k of STAGE_KEYS) {
      const t = getStageTimestamp(l, k);
      if (t == null) continue;
      if (t >= start) counts[k]++;
      if (t >= prevStart && t < prevEnd) prevCounts[k]++;
    }
  }

  const result = {} as FunnelMetrics;
  for (const k of STAGE_KEYS) {
    const c = counts[k];
    const p = prevCounts[k];
    const delta = c - p;
    const deltaPct = p === 0 ? null : (delta / p) * 100;
    const prior = PRIOR_OF[k];
    const convPct = prior == null ? null : pctRound(c, counts[prior]);
    result[k] = { count: c, prevCount: p, delta, deltaPct, convPct };
  }
  return result;
}

/**
 * Today's closed revenue, using canonical close detection +
 * COALESCE(deal_value, revenue_amount, 0). Mirrors the existing logic in
 * MasterCommandCenter so any future surface stays consistent.
 */
export function computeTodayRevenue(leads: CRMLead[]): { volume: number; count: number } {
  const since = startOfTodayMs();
  let volume = 0;
  let count = 0;
  for (const l of leads) {
    if (!l.closed_at) continue;
    const t = new Date(l.closed_at).getTime();
    if (Number.isNaN(t) || t < since) continue;
    const status = (l.deal_status ?? "").toLowerCase();
    if (!CLOSED_STATUSES.has(status)) continue;
    const v = l.deal_value ?? l.revenue_amount ?? 0;
    volume += Number.isFinite(v as number) ? Number(v) : 0;
    count++;
  }
  return { volume, count };
}

/** Stage labels for UI surfaces (kept here so legends never disagree). */
export const STAGE_LABELS: Record<StageKey, string> = {
  captured: "Captured",
  verified: "Verified",
  scanned:  "Scanned",
  routed:   "Routed",
  booked:   "Booked",
  closed:   "Closed",
};
