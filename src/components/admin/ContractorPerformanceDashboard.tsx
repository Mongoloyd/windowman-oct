import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { ContractorPerformanceDetailDrawer } from "./contractor-performance/ContractorPerformanceDetailDrawer";
import { ContractorPerformanceFilters } from "./contractor-performance/ContractorPerformanceFilters";
import { ContractorPerformanceKpiStrip } from "./contractor-performance/ContractorPerformanceKpiStrip";
import { ContractorPerformanceTable } from "./contractor-performance/ContractorPerformanceTable";
import { fetchAdminContractorPerformance, type ContractorPerformanceStatus, type ContractorPerformanceSummary, type ContractorPerformanceWindow } from "@/services/contractorPerformance";

export function ContractorPerformanceDashboard() {
  const [window, setWindow] = useState<ContractorPerformanceWindow>("30d");
  const [clientSlug, setClientSlug] = useState("all");
  const [performanceStatus, setPerformanceStatus] = useState<ContractorPerformanceStatus | "all">("all");
  const [selected, setSelected] = useState<ContractorPerformanceSummary | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["admin-contractor-performance", window], queryFn: () => fetchAdminContractorPerformance(window), staleTime: 60_000 });
  const summaries = data?.summaries ?? [];
  const clientSlugs = useMemo(() => Array.from(new Set(summaries.map((row) => row.clientSlug))).sort(), [summaries]);
  const filtered = summaries.filter((row) => (clientSlug === "all" || row.clientSlug === clientSlug) && (performanceStatus === "all" || row.performanceStatus === performanceStatus));

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-sky-300 bg-sky-50 p-4 text-sky-950 shadow-sm"><div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden /><p className="text-sm font-extrabold leading-6">Performance metrics are aggregate-only. No homeowner contact details, quote files, or provider dispatches are shown here. Close rate denominator: released leads.</p></div></section>
      <ContractorPerformanceFilters window={window} clientSlug={clientSlug} performanceStatus={performanceStatus} clientSlugs={clientSlugs} onWindowChange={setWindow} onClientSlugChange={setClientSlug} onPerformanceStatusChange={setPerformanceStatus} />
      {isLoading ? <div className="rounded-lg border border-slate-300 bg-white p-6 shadow-sm"><div className="flex items-center gap-3 text-slate-800"><Loader2 className="h-5 w-5 animate-spin" aria-hidden /><span className="text-sm font-extrabold uppercase tracking-wide">Loading contractor performance</span></div></div> : null}
      {!isLoading && data?.success === false ? <div className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-amber-950 shadow-sm"><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5" aria-hidden /><p className="text-sm font-extrabold leading-6">{data.message ?? "Contractor performance could not be loaded safely."}</p></div></div> : null}
      {!isLoading && data?.success && summaries.length === 0 ? <div className="rounded-lg border border-slate-300 bg-white p-6 text-sm font-extrabold text-slate-700 shadow-sm">No contractor outcome data is available for this time window yet.</div> : null}
      {!isLoading && filtered.length > 0 ? <><ContractorPerformanceKpiStrip summaries={filtered} /><ContractorPerformanceTable summaries={filtered} onSelect={setSelected} /></> : null}
      <ContractorPerformanceDetailDrawer summary={selected} onOpenChange={(open) => { if (!open) setSelected(null); }} />
    </div>
  );
}
