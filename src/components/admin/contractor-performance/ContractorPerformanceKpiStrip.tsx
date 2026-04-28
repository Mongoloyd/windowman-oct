import { formatPerformanceRate, type ContractorPerformanceSummary } from "@/services/contractorPerformance";

function Kpi({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"><p className="text-xs font-extrabold uppercase tracking-wide text-slate-600">{label}</p><p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p></div>;
}

function formatLastActivity(value: string | null): string {
  return value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value)) : "—";
}

export function ContractorPerformanceKpiStrip({ summaries }: { summaries: ContractorPerformanceSummary[] }) {
  const totals = summaries.reduce((acc, row) => ({ assigned: acc.assigned + row.assignedCount, released: acc.released + row.releasedCount, contacted: acc.contacted + row.contactedCount, scheduled: acc.scheduled + row.scheduledCount, proposalDelivered: acc.proposalDelivered + row.quoteDeliveredCount, sold: acc.sold + row.soldCount, lost: acc.lost + row.lostCount }), { assigned: 0, released: 0, contacted: 0, scheduled: 0, proposalDelivered: 0, sold: 0, lost: 0 });
  const avgCloseRate = totals.released > 0 ? totals.sold / totals.released : null;
  const lastActivityAt = summaries.map((row) => row.lastActivityAt).filter(Boolean).sort().at(-1) ?? null;
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-9"><Kpi label="Assigned" value={totals.assigned} /><Kpi label="Released" value={totals.released} /><Kpi label="Contacted" value={totals.contacted} /><Kpi label="Scheduled" value={totals.scheduled} /><Kpi label="Proposal delivered" value={totals.proposalDelivered} /><Kpi label="Sold" value={totals.sold} /><Kpi label="Lost" value={totals.lost} /><Kpi label="Close rate" value={formatPerformanceRate(avgCloseRate)} /><Kpi label="Last activity" value={formatLastActivity(lastActivityAt)} /></div>;
}
