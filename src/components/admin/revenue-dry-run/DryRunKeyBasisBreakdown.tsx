import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDryRunBasis, type RevenueSignalDryRunBasisBreakdown } from "@/services/revenueSignalDryRunAudit";

interface DryRunKeyBasisBreakdownProps {
  rows: Record<string, RevenueSignalDryRunBasisBreakdown>;
}

type BasisStrength = "strong" | "medium" | "weak" | "blocked_weak" | "unknown";

const STRENGTH_BY_BASIS: Record<string, BasisStrength> = {
  lead_assignment_id: "strong",
  opportunity_id: "strong",
  lead_id: "medium",
  scan_session_id: "medium",
  analysis_id: "weak",
  contractor_outcome_id: "blocked_weak",
  missing_key_basis: "blocked_weak",
};

const INTERPRETATION_BY_STRENGTH: Record<BasisStrength, string> = {
  strong: "Best lifecycle identity for sold signal materialization.",
  medium: "Acceptable identity when stronger operational IDs are unavailable.",
  weak: "Review before materialization; analysis identity is less durable.",
  blocked_weak: "Blocked or fallback identity that needs repair before sync.",
  unknown: "Unmapped identity basis; route to manual review.",
};

const strengthClasses: Record<BasisStrength, string> = {
  strong: "border-emerald-300 bg-emerald-100 text-emerald-950",
  medium: "border-blue-300 bg-blue-100 text-blue-950",
  weak: "border-amber-300 bg-amber-100 text-amber-950",
  blocked_weak: "border-rose-300 bg-rose-100 text-rose-950",
  unknown: "border-slate-300 bg-slate-100 text-slate-800",
};

export function getDryRunBasisStrength(basis: string): BasisStrength {
  return STRENGTH_BY_BASIS[basis] ?? "unknown";
}

export function DryRunKeyBasisBreakdown({ rows }: DryRunKeyBasisBreakdownProps) {
  const entries = Object.entries(rows)
    .filter(([, row]) => row.candidateCount > 0)
    .sort((a, b) => b[1].candidateCount - a[1].candidateCount || a[0].localeCompare(b[0]));

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-4">
        <h3 className="text-lg font-black text-slate-950">Lifecycle Key-Basis Breakdown</h3>
        <p className="mt-1 text-sm font-semibold text-slate-700">Identity strength behind each candidate lifecycle key.</p>
      </div>
      {entries.length === 0 ? (
        <div className="p-5 text-sm font-bold text-slate-700">No lifecycle key-basis breakdown returned for this dry-run.</div>
      ) : (
        <div className="wm-slim-scrollbar overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-slate-300 bg-slate-50 text-left text-xs font-black uppercase text-slate-800">
              <tr>
                <th className="px-4 py-3">basis</th>
                <th className="px-4 py-3">count</th>
                <th className="px-4 py-3">strength</th>
                <th className="px-4 py-3">interpretation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {entries.map(([basis, row]) => {
                const strength = getDryRunBasisStrength(basis);
                return (
                  <tr key={basis} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs font-black text-slate-950">{formatDryRunBasis(basis)}</td>
                    <td className="px-4 py-3 font-bold tabular-nums text-slate-900">{row.candidateCount}</td>
                    <td className="px-4 py-3"><Badge className={cn("rounded-full border px-2.5 py-1 text-xs font-black uppercase", strengthClasses[strength])}>{strength}</Badge></td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{INTERPRETATION_BY_STRENGTH[strength]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
