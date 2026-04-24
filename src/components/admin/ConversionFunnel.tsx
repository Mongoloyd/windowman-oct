/**
 * @deprecated Phase 26 — Funnel counts are now produced by the canonical
 * `computeFunnelMetrics` engine in `missionControl/funnelMetrics.ts` and
 * rendered by `MasterCommandCenter`. This legacy view uses the
 * `latest_analysis_id` proxy and is no longer mounted anywhere.
 */
import type { CRMLead } from "./types";

interface ConversionFunnelProps {
  leads: CRMLead[];
}

export function ConversionFunnel({ leads }: ConversionFunnelProps) {
  const stages = [
    {
      label: "Scans",
      count: leads.filter((l) => l.latest_analysis_id != null).length,
      color: "text-amber-400",
    },
    {
      label: "Verified",
      count: leads.filter((l) => l.phone_verified === true).length,
      color: "text-blue-400",
    },
    {
      label: "Intro Requested",
      count: leads.filter((l) => l.intro_requested_at != null).length,
      color: "text-purple-400",
    },
    {
      label: "Closed",
      count: leads.filter((l) =>
        ["won", "lost", "appointment_booked"].includes(l.deal_status ?? "")
      ).length,
      color: "text-muted-foreground",
    },
  ];

  const dropPct = (curr: number, next: number) =>
    curr > 0 ? (100 - (next / curr) * 100).toFixed(0) + "%" : "—";

  if (leads.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No scan data yet — start collecting leads.
      </p>
    );
  }

  return (
    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-0">
      {stages.map((stage, i) => (
        <div key={stage.label} className="flex flex-col md:flex-row items-center">
          {/* Connector */}
          {i > 0 && (
            <div className="flex flex-col md:flex-row items-center justify-center px-2 py-1 md:py-0">
              <span className="hidden md:block text-muted-foreground text-xs">→</span>
              <span className="md:hidden text-muted-foreground text-xs">↓</span>
              <span className="text-xs text-destructive ml-1">
                {dropPct(stages[i - 1].count, stage.count)} drop
              </span>
            </div>
          )}
          {/* Card */}
          <div className="min-w-[120px] rounded-lg border border-border bg-card p-4 text-center flex-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              {stage.label}
            </p>
            <p className={`text-3xl font-bold ${stage.color}`}>
              {stage.count}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
