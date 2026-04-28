import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchLeadReleaseQueue, formatLeadReleaseStatus, type LeadReleaseQueueItem, type LeadReleaseStatus } from "@/services/leadReleaseQueue";
import { LeadReleaseQueueTable } from "@/components/admin/lead-release/LeadReleaseQueueTable";
import { LeadReleaseDecisionDrawer } from "@/components/admin/lead-release/LeadReleaseDecisionDrawer";

const STATUSES: Array<LeadReleaseStatus | "all"> = ["all", "not_released", "approved", "held", "blocked", "revoked", "manual_review"];

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

export function LeadReleaseQueue() {
  const [status, setStatus] = useState<LeadReleaseStatus | "all">("all");
  const [clientSlug, setClientSlug] = useState("all");
  const [contractor, setContractor] = useState("all");
  const [assignmentStatus, setAssignmentStatus] = useState("all");
  const [needsAttention, setNeedsAttention] = useState("all");
  const [selected, setSelected] = useState<LeadReleaseQueueItem | null>(null);

  const query = useQuery({ queryKey: ["lead-release-queue"], queryFn: fetchLeadReleaseQueue, staleTime: 60_000 });
  const rows = query.data ?? [];

  const clientOptions = useMemo(() => Array.from(new Set(rows.map((row) => row.clientSlug))).sort(), [rows]);
  const contractorOptions = useMemo(() => Array.from(new Set(rows.map((row) => row.contractorDisplayName))).sort(), [rows]);
  const assignmentStatusOptions = useMemo(() => Array.from(new Set(rows.map((row) => row.assignmentStatus))).sort(), [rows]);

  const filtered = rows.filter((row) => {
    if (status !== "all" && row.releaseStatus !== status) return false;
    if (clientSlug !== "all" && row.clientSlug !== clientSlug) return false;
    if (contractor !== "all" && row.contractorDisplayName !== contractor) return false;
    if (assignmentStatus !== "all" && row.assignmentStatus !== assignmentStatus) return false;
    if (needsAttention === "yes" && row.riskWarnings.length === 0 && row.releaseStatus !== "not_released" && row.releaseStatus !== "manual_review") return false;
    return true;
  });

  const count = (target: LeadReleaseStatus) => rows.filter((row) => row.releaseStatus === target).length;

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-sm">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div>
            <h2 className="text-lg font-black tracking-tight">Lead Release Queue</h2>
            <p className="mt-1 text-sm font-semibold leading-6">Lead Release controls whether assigned contractors can see limited homeowner contact details. Release decisions are audited and do not expose quote files.</p>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Kpi label="Pending Release" value={count("not_released")} />
        <Kpi label="Approved" value={count("approved")} />
        <Kpi label="Held" value={count("held")} />
        <Kpi label="Blocked" value={count("blocked")} />
        <Kpi label="Revoked" value={count("revoked")} />
        <Kpi label="Manual Review" value={count("manual_review")} />
      </div>

      <section className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-5">
          <Select value={status} onValueChange={(value) => setStatus(value as LeadReleaseStatus | "all")}><SelectTrigger className="border-slate-300 bg-white font-bold text-slate-950"><SelectValue placeholder="Release status" /></SelectTrigger><SelectContent>{STATUSES.map((value) => <SelectItem key={value} value={value}>{value === "all" ? "All release statuses" : formatLeadReleaseStatus(value)}</SelectItem>)}</SelectContent></Select>
          <Select value={clientSlug} onValueChange={setClientSlug}><SelectTrigger className="border-slate-300 bg-white font-bold text-slate-950"><SelectValue placeholder="Client" /></SelectTrigger><SelectContent><SelectItem value="all">All clients</SelectItem>{clientOptions.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
          <Select value={contractor} onValueChange={setContractor}><SelectTrigger className="border-slate-300 bg-white font-bold text-slate-950"><SelectValue placeholder="Contractor" /></SelectTrigger><SelectContent><SelectItem value="all">All contractors</SelectItem>{contractorOptions.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
          <Select value={assignmentStatus} onValueChange={setAssignmentStatus}><SelectTrigger className="border-slate-300 bg-white font-bold text-slate-950"><SelectValue placeholder="Assignment status" /></SelectTrigger><SelectContent><SelectItem value="all">All assignment statuses</SelectItem>{assignmentStatusOptions.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
          <Select value={needsAttention} onValueChange={setNeedsAttention}><SelectTrigger className="border-slate-300 bg-white font-bold text-slate-950"><SelectValue placeholder="Attention" /></SelectTrigger><SelectContent><SelectItem value="all">All rows</SelectItem><SelectItem value="yes">Needs attention</SelectItem></SelectContent></Select>
        </div>
      </section>

      {query.isError ? (
        <div className="flex items-start gap-3 rounded-lg border border-rose-300 bg-rose-50 p-4 text-rose-950"><AlertTriangle className="mt-0.5 h-5 w-5" aria-hidden /><p className="text-sm font-semibold">Release queue could not be loaded. Verify internal operator access and RLS policies.</p></div>
      ) : query.isLoading ? (
        <div className="rounded-lg border border-slate-300 bg-white p-6 text-sm font-semibold text-slate-700 shadow-sm">Loading release queue…</div>
      ) : (
        <LeadReleaseQueueTable rows={filtered} onOpen={setSelected} />
      )}

      <LeadReleaseDecisionDrawer row={selected} open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}
