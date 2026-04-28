import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, FileLock2, Loader2, Route, ShieldCheck } from "lucide-react";
import { fetchContractorAssignedLeadDetail, formatContractorLeadStatus } from "@/services/contractorLeads";
import { ContractorContactReleasePanel } from "@/components/partner/ContractorContactReleasePanel";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-black tracking-tight text-slate-950">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function ContractorLeadDetail({ assignmentId, onBack }: { assignmentId: string; onBack: () => void }) {
  const { data: result, isLoading } = useQuery({
    queryKey: ["contractor-assigned-lead-detail", assignmentId],
    queryFn: () => fetchContractorAssignedLeadDetail(assignmentId),
    staleTime: 60_000,
  });

  if (isLoading || !result) {
    return (
      <div className="rounded-lg border border-slate-300 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 text-slate-800"><Loader2 className="h-5 w-5 animate-spin" aria-hidden /><span className="text-sm font-extrabold uppercase tracking-wide">Loading redacted detail</span></div>
      </div>
    );
  }

  if (result.state !== "allowed" || !result.lead) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-amber-950 shadow-sm">
        <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-sm font-extrabold"><ArrowLeft className="h-4 w-4" aria-hidden />Back to opportunities</button>
        <div className="flex items-start gap-3"><AlertCircle className="mt-1 h-5 w-5" aria-hidden /><div><h2 className="text-xl font-black tracking-tight">Opportunity unavailable</h2><p className="mt-2 text-sm font-semibold leading-6">{result.message}</p></div></div>
      </div>
    );
  }

  const lead = result.lead;
  const location = [lead.county, lead.region].filter(Boolean).join(" · ") || "Location redacted";

  return (
    <div className="flex flex-col gap-5">
      <button type="button" onClick={onBack} className="inline-flex w-fit items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-extrabold text-slate-950 shadow-sm hover:bg-slate-50">
        <ArrowLeft className="h-4 w-4" aria-hidden />Back to opportunities
      </button>

      <section className="rounded-lg border border-slate-300 bg-white p-6 shadow-sm">
        <p className="font-mono text-xs font-bold text-slate-600">Assignment {lead.assignmentIdMasked}</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950">{lead.projectType ?? "Redacted opportunity detail"}</h2>
            <p className="mt-2 text-sm font-semibold text-slate-700">{location}</p>
          </div>
          <span className="inline-flex min-h-7 w-fit items-center rounded-md border border-sky-300 bg-sky-50 px-2.5 py-1 text-xs font-extrabold uppercase text-sky-950">{formatContractorLeadStatus(lead.assignmentStatus)}</span>
        </div>
      </section>

      <Panel title="Safe Project Summary"><p className="text-sm font-semibold leading-6 text-slate-700">{lead.safeProjectSummary}</p></Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Safe Findings">
          {lead.safeFindings.length > 0 ? (
            <ul className="space-y-2 text-sm font-semibold text-slate-700">
              {lead.safeFindings.map((finding) => <li key={finding} className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" aria-hidden />{finding}</li>)}
            </ul>
          ) : <p className="text-sm font-semibold text-slate-700">No additional redacted findings are published for this assignment yet.</p>}
        </Panel>

        <Panel title="Routing Timeline">
          <ol className="space-y-3 text-sm font-semibold text-slate-700">
            {lead.timeline.map((item) => <li key={`${item.label}-${item.timestamp}`} className="flex gap-2"><Route className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" aria-hidden /><span>{item.label}: {formatDate(item.timestamp)}</span></li>)}
          </ol>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Contact Release">
          <ContractorContactReleasePanel state={lead.contactRelease} />
        </Panel>
        <Panel title="Quote Files">
          <div className="flex items-start gap-3 rounded-md border border-slate-300 bg-slate-50 p-3 text-slate-800"><FileLock2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><p className="text-sm font-semibold leading-6">{lead.quoteExposureMessage}</p></div>
        </Panel>
      </div>

      <Panel title="Safe Next Step"><p className="text-sm font-semibold leading-6 text-slate-700">{lead.safeNextStep}</p></Panel>
    </div>
  );
}
