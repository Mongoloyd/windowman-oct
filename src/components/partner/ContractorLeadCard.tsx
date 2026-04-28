import { CalendarDays, ChevronRight, MapPin, ShieldOff } from "lucide-react";
import type { ContractorAssignedLeadSummary } from "@/services/contractorLeads";
import { formatContractorLeadStatus } from "@/services/contractorLeads";

function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "green" | "amber" | "blue" }) {
  const tones = {
    slate: "border-slate-300 bg-white text-slate-950",
    green: "border-emerald-300 bg-emerald-50 text-emerald-950",
    amber: "border-amber-300 bg-amber-50 text-amber-950",
    blue: "border-sky-300 bg-sky-50 text-sky-950",
  };
  return <span className={`inline-flex min-h-6 items-center rounded-md border px-2 py-0.5 text-xs font-extrabold uppercase ${tones[tone]}`}>{children}</span>;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export function ContractorLeadCard({ lead, onSelect }: { lead: ContractorAssignedLeadSummary; onSelect: (assignmentId: string) => void }) {
  const location = [lead.county, lead.region].filter(Boolean).join(" · ");

  return (
    <article className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-xs font-bold text-slate-600">Assignment {lead.assignmentIdMasked}</p>
            <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">
              {lead.projectType ?? "Assigned opportunity"}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-700">
              <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" aria-hidden />{formatDate(lead.assignedAt)}</span>
              {location && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" aria-hidden />{location}</span>}
            </div>
          </div>
          <Badge tone="blue">{formatContractorLeadStatus(lead.assignmentStatus)}</Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-extrabold uppercase text-slate-600">Scope</p>
            <p className="mt-1 text-sm font-bold text-slate-950">{lead.windowCountRange ?? "Scope not published"}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-extrabold uppercase text-slate-600">Quote Band</p>
            <p className="mt-1 text-sm font-bold text-slate-950">{lead.quoteRange ?? "Not exposed"}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-extrabold uppercase text-slate-600">Signal</p>
            <p className="mt-1 text-sm font-bold text-slate-950">{lead.safeScoreBand ?? "Redacted"}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Badge tone="amber"><ShieldOff className="mr-1 h-3.5 w-3.5" aria-hidden />Contact redacted</Badge>
            {lead.warnings.map((warning) => <Badge key={warning} tone="amber">{warning.replace(/_/g, " ")}</Badge>)}
          </div>
          <button
            type="button"
            onClick={() => onSelect(lead.assignmentId)}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-extrabold text-white transition-colors hover:bg-slate-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
          >
            View Details <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </article>
  );
}
