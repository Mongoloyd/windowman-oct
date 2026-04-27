import type { RevenueSignalDryRunClientBreakdown } from "@/services/revenueSignalDryRunAudit";

interface DryRunClientBreakdownProps {
  rows: Record<string, RevenueSignalDryRunClientBreakdown>;
}

export function DryRunClientBreakdown({ rows }: DryRunClientBreakdownProps) {
  const entries = Object.entries(rows).sort(([a], [b]) => a.localeCompare(b));

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-4">
        <h3 className="text-lg font-black text-slate-950">Client Breakdown</h3>
        <p className="mt-1 text-sm font-semibold text-slate-700">Per-client dry-run rollup without homeowner PII.</p>
      </div>
      {entries.length === 0 ? (
        <div className="p-5 text-sm font-bold text-slate-700">No client breakdown returned for this dry-run.</div>
      ) : (
        <div className="wm-slim-scrollbar overflow-x-auto">
          <table className="w-full min-w-[1040px] text-sm">
            <thead className="border-b border-slate-300 bg-slate-50 text-left text-xs font-black uppercase text-slate-800">
              <tr>
                <th className="px-4 py-3">client_slug</th>
                <th className="px-4 py-3">candidate_count</th>
                <th className="px-4 py-3">would_insert</th>
                <th className="px-4 py-3">blocked</th>
                <th className="px-4 py-3">duplicate_protected</th>
                <th className="px-4 py-3">weak_lifecycle_key</th>
                <th className="px-4 py-3">lifecycle_duplicate_claim</th>
                <th className="px-4 py-3">duplicate_revenue_signal_key</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {entries.map(([clientSlug, row]) => (
                <tr key={clientSlug} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs font-black text-slate-950">{clientSlug}</td>
                  <td className="px-4 py-3 font-bold tabular-nums text-slate-900">{row.candidateCount}</td>
                  <td className="px-4 py-3 font-bold tabular-nums text-amber-900">{row.wouldInsert}</td>
                  <td className="px-4 py-3 font-bold tabular-nums text-rose-900">{row.blocked}</td>
                  <td className="px-4 py-3 font-bold tabular-nums text-slate-900">{row.duplicateProtected}</td>
                  <td className="px-4 py-3 font-bold tabular-nums text-amber-900">{row.weakLifecycleKey}</td>
                  <td className="px-4 py-3 font-bold tabular-nums text-rose-900">{row.lifecycleDuplicateClaim}</td>
                  <td className="px-4 py-3 font-bold tabular-nums text-slate-900">{row.duplicateRevenueSignalKey}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
