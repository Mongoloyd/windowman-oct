import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContractorSelfPerformanceKpis } from "./performance/ContractorSelfPerformanceKpis";
import { fetchContractorSelfPerformance, formatPerformanceStatus, formatPerformanceWindow, type ContractorPerformanceStatus, type ContractorPerformanceWindow } from "@/services/contractorPerformance";

const WINDOWS: ContractorPerformanceWindow[] = ["7d", "30d", "90d", "all"];
const GUIDANCE: Record<ContractorPerformanceStatus, string> = {
  insufficient_data: "More assigned opportunities are needed before performance trends are meaningful.",
  healthy: "You are converting assigned opportunities well.",
  watch: "Recent aggregate activity suggests follow-up consistency should be watched.",
  coach: "A higher share of released opportunities is staying in attempting-contact, so tightening contact cadence may help.",
  pause: "Current aggregate performance needs operational review before more lead flow is increased.",
};

export function ContractorPerformancePanel() {
  const [window, setWindow] = useState<ContractorPerformanceWindow>("30d");
  const { data, isLoading } = useQuery({ queryKey: ["contractor-self-performance", window], queryFn: () => fetchContractorSelfPerformance(window), staleTime: 60_000 });
  const summary = data?.summaries[0] ?? null;
  const denominatorLabel = summary?.releasedCount ? `${summary.soldCount} sold ÷ ${summary.releasedCount} released` : "No released opportunities in this window";
  const attemptingContactLabel = summary?.releasedCount ? `${summary.attemptingContactCount} attempting contact ÷ ${summary.releasedCount} released` : "0 attempting contact ÷ 0 released";
  const contactedLabel = summary?.releasedCount ? `${summary.contactedCount} contacted ÷ ${summary.releasedCount} released` : "0 contacted ÷ 0 released";

  return (
    <section className="space-y-4 rounded-lg border border-slate-300 bg-slate-50 p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-2xl font-black tracking-tight text-slate-950">My Performance</h2><p className="mt-1 text-sm font-semibold leading-6 text-slate-700">Aggregate outcome metrics only. No homeowner contact details, quote files, or lead rows are shown.</p></div><Select value={window} onValueChange={(value) => setWindow(value as ContractorPerformanceWindow)}><SelectTrigger className="w-full border-slate-300 bg-white font-bold text-slate-950 sm:w-48"><SelectValue /></SelectTrigger><SelectContent>{WINDOWS.map((value) => <SelectItem key={value} value={value}>{formatPerformanceWindow(value)}</SelectItem>)}</SelectContent></Select></div>
      <div className="rounded-md border border-sky-300 bg-sky-50 p-3 text-sky-950"><div className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><p className="text-sm font-extrabold leading-6">This view is scoped to your authenticated contractor account only. Close rate uses released opportunities as the denominator.</p></div></div>
      {isLoading ? <div className="rounded-lg border border-slate-300 bg-white p-5"><div className="flex items-center gap-3 text-slate-800"><Loader2 className="h-5 w-5 animate-spin" aria-hidden /><span className="text-sm font-extrabold uppercase tracking-wide">Loading performance</span></div></div> : null}
      {!isLoading && data?.success === false ? <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950"><div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4" aria-hidden /><p className="text-sm font-extrabold leading-6">{data.message ?? "Performance could not be loaded safely."}</p></div></div> : null}
      {!isLoading && data?.success && !summary ? <div className="rounded-lg border border-slate-300 bg-white p-5 text-sm font-extrabold text-slate-700">No outcome activity is available for this time window yet.</div> : null}
      {summary ? <><ContractorSelfPerformanceKpis summary={summary} /><div className="grid gap-3 lg:grid-cols-2"><div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"><p className="text-xs font-extrabold uppercase tracking-wide text-slate-600">Close-rate denominator</p><h3 className="mt-2 text-xl font-black text-slate-950">{denominatorLabel}</h3><p className="mt-2 text-sm font-semibold leading-6 text-slate-700">Assigned count shows all assigned opportunities in the selected window. Released count is the rate denominator because contact details were approved for follow-up.</p></div><div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"><p className="text-xs font-extrabold uppercase tracking-wide text-slate-600">Contact / SLA detail</p><h3 className="mt-2 text-xl font-black text-slate-950">{summary.averageTimeToFirstUpdateHours == null ? "No first update yet" : `${Math.round(summary.averageTimeToFirstUpdateHours)}h avg first update`}</h3><p className="mt-2 text-sm font-semibold leading-6 text-slate-700">Contact rate is contacted outcomes divided by released opportunities. Attempting-contact pressure highlights released opportunities that have not progressed to contact or later states.</p></div></div><div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"><p className="text-xs font-extrabold uppercase tracking-wide text-slate-600">Contact funnel</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="rounded-md border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-extrabold uppercase tracking-wide text-slate-600">Attempting contact</p><p className="mt-1 text-lg font-black text-slate-950">{attemptingContactLabel}</p><p className="mt-1 text-sm font-semibold leading-6 text-slate-700">Released opportunities currently recorded as attempting contact.</p></div><div className="rounded-md border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-extrabold uppercase tracking-wide text-slate-600">Contacted</p><p className="mt-1 text-lg font-black text-slate-950">{contactedLabel}</p><p className="mt-1 text-sm font-semibold leading-6 text-slate-700">Released opportunities that reached contacted or a later qualified outcome.</p></div></div></div><div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"><p className="text-xs font-extrabold uppercase tracking-wide text-slate-600">Status recommendation</p><h3 className="mt-2 text-xl font-black text-slate-950">{formatPerformanceStatus(summary.performanceStatus)}</h3><p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{GUIDANCE[summary.performanceStatus]}</p></div></> : null}
    </section>
  );
}
