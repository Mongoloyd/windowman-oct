/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Operator Snapshot — Phase 25 Master Polish
 * ═══════════════════════════════════════════════════════════════════════════
 * Pure client-side CSV builder. No deps, no edge function.
 * Captures funnel + revenue + readiness + webhooks + outcomes + data quality
 * at a single point in time for end-of-day operator handoff.
 */

export interface SnapshotInput {
  generatedAt: Date;
  funnel: {
    captured: number;
    verified: number;
    scanned: number;
    routed: number;
    booked: number;
    closed: number;
  };
  revenue: {
    goal: number;
    todayClosedVolume: number;
    todayClosedCount: number;
  };
  signals: Array<{
    label: string;
    status: string;
    detail: string;
  }>;
  webhooks: {
    pending: number;
    delivered: number;
    failed: number;
    dead: number;
  };
  outcomes: {
    booked: number;
    closed: number;
    stale: number;
    unresolved: number;
    recentHandoffs24h: number;
    interestedNotBooked: number;
  };
  dataQuality: {
    strong: number;
    partial: number;
    sparse: number;
    missingCounty: number;
    orphanedOpps: number;
  };
}

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function row(...cells: unknown[]): string {
  return cells.map(csvCell).join(",");
}

function pct(n: number, d: number): string {
  if (d <= 0) return "—";
  return `${Math.round((n / d) * 100)}%`;
}

export function buildSnapshotCsv(snap: SnapshotInput): string {
  const lines: string[] = [];

  lines.push(row("WindowMan Operator Snapshot"));
  lines.push(row("Generated", snap.generatedAt.toISOString()));
  lines.push("");

  lines.push(row("[Funnel]"));
  lines.push(row("Stage", "Count", "% of prior"));
  lines.push(row("Captured", snap.funnel.captured, "—"));
  lines.push(row("Verified", snap.funnel.verified, pct(snap.funnel.verified, snap.funnel.captured)));
  lines.push(row("Scanned", snap.funnel.scanned, pct(snap.funnel.scanned, snap.funnel.captured)));
  lines.push(row("Routed", snap.funnel.routed, pct(snap.funnel.routed, snap.funnel.verified)));
  lines.push(row("Booked", snap.funnel.booked, pct(snap.funnel.booked, snap.funnel.routed)));
  lines.push(row("Closed", snap.funnel.closed, pct(snap.funnel.closed, snap.funnel.booked)));
  lines.push("");

  lines.push(row("[Daily Revenue]"));
  lines.push(row("Daily Goal (USD)", snap.revenue.goal));
  lines.push(row("Today's Closed Volume (USD)", snap.revenue.todayClosedVolume));
  lines.push(row("Today's Closed Count", snap.revenue.todayClosedCount));
  lines.push(row("% of Goal", pct(snap.revenue.todayClosedVolume, snap.revenue.goal)));
  lines.push("");

  lines.push(row("[Readiness Signals]"));
  lines.push(row("Signal", "Status", "Detail"));
  for (const s of snap.signals) {
    lines.push(row(s.label, s.status, s.detail));
  }
  lines.push("");

  lines.push(row("[Webhook Health]"));
  lines.push(row("Pending", snap.webhooks.pending));
  lines.push(row("Delivered", snap.webhooks.delivered));
  lines.push(row("Failed", snap.webhooks.failed));
  lines.push(row("Dead-Letter (CRITICAL)", snap.webhooks.dead));
  lines.push("");

  lines.push(row("[Outcome Rollup]"));
  lines.push(row("Booked", snap.outcomes.booked));
  lines.push(row("Closed", snap.outcomes.closed));
  lines.push(row("Stale unresolved", snap.outcomes.stale));
  lines.push(row("Total unresolved", snap.outcomes.unresolved));
  lines.push(row("Recent handoffs (24h)", snap.outcomes.recentHandoffs24h));
  lines.push(row("Interested, not booked", snap.outcomes.interestedNotBooked));
  lines.push("");

  lines.push(row("[Data Quality]"));
  lines.push(row("Strong field groups", snap.dataQuality.strong));
  lines.push(row("Partial field groups", snap.dataQuality.partial));
  lines.push(row("Sparse field groups", snap.dataQuality.sparse));
  lines.push(row("Leads missing county", snap.dataQuality.missingCounty));
  lines.push(row("Orphaned opportunities", snap.dataQuality.orphanedOpps));

  return lines.join("\n");
}

export function downloadSnapshotCsv(snap: SnapshotInput): void {
  const csv = buildSnapshotCsv(snap);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const stamp = snap.generatedAt
    .toISOString()
    .replace(/[:T]/g, "-")
    .slice(0, 16);
  const a = document.createElement("a");
  a.href = url;
  a.download = `wm-operator-snapshot-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
