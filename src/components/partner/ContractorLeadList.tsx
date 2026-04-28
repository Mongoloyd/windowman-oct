import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2, ShieldAlert } from "lucide-react";
import { fetchContractorAssignedLeads } from "@/services/contractorLeads";
import { ContractorLeadCard } from "./ContractorLeadCard";
import { ContractorLeadEmptyState } from "./ContractorLeadEmptyState";

function AccessPanel({ title, message, tone = "amber" }: { title: string; message: string; tone?: "amber" | "red" }) {
  const classes = tone === "red" ? "border-red-300 bg-red-50 text-red-950" : "border-amber-300 bg-amber-50 text-amber-950";
  return (
    <div className={`rounded-lg border p-6 shadow-sm ${classes}`}>
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-1 h-5 w-5" aria-hidden />
        <div>
          <h2 className="text-xl font-black tracking-tight">{title}</h2>
          <p className="mt-2 text-sm font-semibold leading-6">{message}</p>
        </div>
      </div>
    </div>
  );
}

export function ContractorLeadList({ onSelectLead }: { onSelectLead: (assignmentId: string) => void }) {
  const { data: result, isLoading } = useQuery({
    queryKey: ["contractor-assigned-leads"],
    queryFn: fetchContractorAssignedLeads,
    staleTime: 60_000,
  });

  if (isLoading || !result) {
    return (
      <section className="rounded-lg border border-slate-300 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 text-slate-800">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          <span className="text-sm font-extrabold uppercase tracking-wide">Loading assigned opportunities</span>
        </div>
      </section>
    );
  }

  if (["not_linked", "pending", "suspended", "revoked", "forbidden"].includes(result.state)) {
    return <AccessPanel title="Assigned opportunities unavailable" message={result.message} />;
  }

  if (result.state === "error") {
    return <AccessPanel title="Assigned opportunities unavailable" message={result.message} tone="red" />;
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-950">Assigned Opportunities</h2>
          <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-700">
            Redacted assignment context scoped to your authenticated contractor account. Contact information and quote files stay withheld.
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-extrabold text-slate-950 shadow-sm">
          {result.leads.length} visible
        </div>
      </div>

      {result.state === "empty" ? (
        <ContractorLeadEmptyState message={result.message} />
      ) : result.leads.length > 0 ? (
        <div className="grid gap-4">
          {result.leads.map((lead) => <ContractorLeadCard key={lead.assignmentId} lead={lead} onSelect={onSelectLead} />)}
        </div>
      ) : (
        <div className="rounded-lg border border-red-300 bg-red-50 p-6 text-red-950 shadow-sm">
          <div className="flex items-start gap-3"><AlertCircle className="mt-1 h-5 w-5" aria-hidden /><p className="text-sm font-semibold leading-6">Assigned opportunities could not be displayed safely.</p></div>
        </div>
      )}
    </section>
  );
}
