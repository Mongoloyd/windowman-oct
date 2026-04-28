import { formatPerformanceCurrency, formatPerformanceRate, type ContractorPerformanceSummary } from "@/services/contractorPerformance";

function Kpi({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"><p className="text-xs font-extrabold uppercase tracking-wide text-slate-600">{label}</p><p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p></div>;
}

export function ContractorPerformanceKpiStrip({ summaries }: { summaries: ContractorPerformanceSummary[] }) {
  const totals = summaries.reduce((acc, row) => ({ assigned: acc.assigned + row.assignedCount, released: acc.released + row.releasedCount, sold: acc.sold + row.soldCount, soldValue: acc.soldValue + row.soldValueCents, manualReview: acc.manualReview + row.manualReviewCount, highAttempting: acc.highAttempting + ((row.attemptingContactRate ?? 0) > 0.35 ? 1 : 0) }), { assigned: 0, released: 0, sold: 0, soldValue: 0, manualReview: 0, highAttempting: 0 });
  const avgCloseRate = totals.released > 0 ? totals.sold / totals.released : null;
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"><Kpi label="Assigned" value={totals.assigned} /><Kpi label="Released" value={totals.released} /><Kpi label="Sold" value={totals.sold} /><Kpi label="Sold value" value={formatPerformanceCurrency(totals.soldValue)} /><Kpi label="Avg close rate" value={formatPerformanceRate(avgCloseRate)} /><Kpi label="High attempting" value={totals.highAttempting} /></div>;
}
