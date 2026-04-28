import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatPerformanceCurrency, formatPerformanceRate, formatPerformanceStatus, type ContractorPerformanceSummary } from "@/services/contractorPerformance";

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg border border-slate-300 bg-slate-50 p-3"><p className="text-xs font-extrabold uppercase tracking-wide text-slate-600">{label}</p><p className="mt-1 text-lg font-black text-slate-950">{value}</p></div>;
}

export function ContractorPerformanceDetailDrawer({ summary, onOpenChange }: { summary: ContractorPerformanceSummary | null; onOpenChange: (open: boolean) => void }) {
  const lostReasons = Object.entries(summary?.lostReasonBreakdown ?? {});
  return (
    <Sheet open={Boolean(summary)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto bg-white sm:max-w-xl">
        {summary && <>
          <SheetHeader><SheetTitle className="text-2xl font-black text-slate-950">{summary.contractorDisplayName}</SheetTitle><SheetDescription className="font-semibold text-slate-700">Aggregate-only performance for {summary.clientSlug}. No homeowner contact details or quote files are included.</SheetDescription></SheetHeader>
          <div className="mt-6 grid gap-3 sm:grid-cols-2"><Metric label="Assigned" value={summary.assignedCount} /><Metric label="Released denominator" value={summary.releasedCount} /><Metric label="Close rate" value={formatPerformanceRate(summary.closeRate)} /><Metric label="Appointment rate" value={formatPerformanceRate(summary.appointmentRate)} /><Metric label="Contact rate" value={formatPerformanceRate(summary.contactRate)} /><Metric label="Attempting pressure" value={formatPerformanceRate(summary.attemptingContactRate)} /><Metric label="Sold value" value={formatPerformanceCurrency(summary.soldValueCents)} /><Metric label="Status" value={formatPerformanceStatus(summary.performanceStatus)} /></div>
          <section className="mt-6 rounded-lg border border-slate-300 bg-white p-4"><h3 className="font-black text-slate-950">Status explanation</h3><p className="mt-2 text-sm font-semibold leading-6 text-slate-700">Rules: insufficient data when released leads are below 5; healthy when close rate is at least 20% and attempting-contact pressure is at most 25%; watch/coach/pause are driven by low close rate, high attempting-contact pressure, or zero sales across 10+ released leads.</p></section>
          <section className="mt-4 rounded-lg border border-slate-300 bg-white p-4"><h3 className="font-black text-slate-950">Lost reason breakdown</h3>{lostReasons.length ? <ul className="mt-3 space-y-2 text-sm font-bold text-slate-700">{lostReasons.map(([reason, count]) => <li key={reason} className="flex justify-between"><span>{reason.split("_").join(" ")}</span><span>{count}</span></li>)}</ul> : <p className="mt-2 text-sm font-semibold text-slate-600">No lost outcome breakdown in this window.</p>}</section>
          <section className="mt-4 rounded-lg border border-slate-300 bg-white p-4"><h3 className="font-black text-slate-950">Revenue truth notes</h3><p className="mt-2 text-sm font-semibold leading-6 text-slate-700">Confirmed sold value includes validated sold outcomes with contract-total or gross-sale value basis only. Estimated contract value and true-margin values are separated: {formatPerformanceCurrency(summary.estimatedSoldValueCents)} estimated, {formatPerformanceCurrency(summary.marginValueCents)} margin.</p></section>
        </>}
      </SheetContent>
    </Sheet>
  );
}
