import { cn } from "@/lib/utils";
import type { RevenueSignalDryRunReport } from "@/services/revenueSignalDryRunAudit";

interface DryRunKpiStripProps {
  report: RevenueSignalDryRunReport;
}

const KPI_DEFINITIONS = [
  {
    key: "candidateCount",
    label: "Candidate Count",
    description: "Total evaluated candidates",
    tone: "slate",
  },
  {
    key: "wouldInsert",
    label: "Would Insert",
    description: "Eligible internal sold signal candidates",
    tone: "amber",
  },
  {
    key: "blocked",
    label: "Blocked",
    description: "Prevented by eligibility, key, value, or integrity reasons",
    tone: "rose",
  },
  {
    key: "duplicateProtected",
    label: "Duplicate Protected",
    description: "Already protected by existing signal controls",
    tone: "blue",
  },
  {
    key: "weakLifecycleKey",
    label: "Weak Lifecycle Key",
    description: "Using weak fallback identity",
    tone: "amber",
  },
  {
    key: "lifecycleDuplicateClaim",
    label: "Duplicate Lifecycle Claim",
    description: "Competing active sold lifecycle claims",
    tone: "rose",
  },
  {
    key: "duplicateRevenueSignalKey",
    label: "Duplicate Revenue Signal Key",
    description: "Existing matching revenue signal key",
    tone: "blue",
  },
] as const;

const toneClasses: Record<(typeof KPI_DEFINITIONS)[number]["tone"], string> = {
  slate: "border-slate-300 bg-white text-slate-950",
  amber: "border-amber-300 bg-amber-50 text-amber-950",
  rose: "border-rose-300 bg-rose-50 text-rose-950",
  blue: "border-blue-300 bg-blue-50 text-blue-950",
};

export function DryRunKpiStrip({ report }: DryRunKpiStripProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {KPI_DEFINITIONS.map((kpi) => (
        <div key={kpi.key} className={cn("rounded-2xl border p-4 shadow-sm", toneClasses[kpi.tone])}>
          <div className="text-xs font-black uppercase tracking-wide text-current/75">{kpi.label}</div>
          <div className="mt-2 text-3xl font-black tabular-nums">{report[kpi.key]}</div>
          <div className="mt-2 text-xs font-bold leading-snug text-current/70">{kpi.description}</div>
        </div>
      ))}
    </div>
  );
}
