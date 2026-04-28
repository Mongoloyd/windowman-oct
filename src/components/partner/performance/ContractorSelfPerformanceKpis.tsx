import { formatPerformanceCurrency, formatPerformanceRate, type ContractorPerformanceSummary } from "@/services/contractorPerformance";

function Kpi({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"><p className="text-xs font-extrabold uppercase tracking-wide text-slate-600">{label}</p><p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p></div>;
}

function formatHours(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  if (value < 1) return "<1h";
  return `${Math.round(value)}h`;
}

export function ContractorSelfPerformanceKpis({ summary }: { summary: ContractorPerformanceSummary }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Kpi label="Assigned" value={summary.assignedCount} /><Kpi label="Released" value={summary.releasedCount} /><Kpi label="Attempting contact" value={summary.attemptingContactCount} /><Kpi label="Contacted" value={summary.contactedCount} /><Kpi label="Contact rate" value={formatPerformanceRate(summary.contactRate)} /><Kpi label="Avg first update" value={formatHours(summary.averageTimeToFirstUpdateHours)} /><Kpi label="Scheduled" value={summary.scheduledCount} /><Kpi label="Proposal delivered" value={summary.quoteDeliveredCount} /><Kpi label="Sold" value={summary.soldCount} /><Kpi label="Lost" value={summary.lostCount} /><Kpi label="Close rate" value={formatPerformanceRate(summary.closeRate)} /><Kpi label="Sold value" value={formatPerformanceCurrency(summary.soldValueCents)} /></div>;
}
