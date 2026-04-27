import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDryRunReason } from "@/services/revenueSignalDryRunAudit";

interface DryRunReasonBreakdownProps {
  rows: Record<string, number>;
}

type ReasonSeverity = "critical" | "warning" | "manual_review";

const CRITICAL_REASONS = new Set([
  "duplicate_sold_lifecycle_claim",
  "duplicate_active_sold_signal",
  "missing_client_slug",
  "missing_lifecycle_key",
  "sold_missing_or_invalid_value",
  "outcome_integrity_blocked",
]);

const WARNING_REASONS = new Set([
  "weak_lifecycle_key",
  "sold_missing_value_basis",
  "outcome_integrity_not_valid",
]);

const SUGGESTED_FIXES: Record<string, string> = {
  duplicate_sold_lifecycle_claim: "Resolve competing sold claims before materialization.",
  duplicate_active_sold_signal: "Confirm the existing active sold signal is canonical.",
  missing_client_slug: "Backfill client_slug from the canonical tenant source.",
  missing_lifecycle_key: "Repair lifecycle identity before sync eligibility.",
  weak_lifecycle_key: "Prefer assignment, opportunity, lead, or scan identity over fallback outcome identity.",
  sold_missing_or_invalid_value: "Correct final sold value and currency on the contractor outcome.",
  sold_missing_value_basis: "Add the sold value basis before future dispatch review.",
  outcome_integrity_not_valid: "Complete outcome integrity validation before sync.",
  outcome_integrity_blocked: "Clear the integrity blocker at the outcome source.",
  blocked_unknown_reason: "Route to manual revenue-ops review.",
};

export function getDryRunReasonSeverity(code: string): ReasonSeverity {
  if (CRITICAL_REASONS.has(code)) return "critical";
  if (WARNING_REASONS.has(code)) return "warning";
  return "manual_review";
}

export function hasUnmappedReasons(rows: Record<string, number>): boolean {
  return Object.keys(rows).some((code) => !CRITICAL_REASONS.has(code) && !WARNING_REASONS.has(code) && code !== "blocked_unknown_reason");
}

const severityClasses: Record<ReasonSeverity, string> = {
  critical: "border-rose-300 bg-rose-100 text-rose-950",
  warning: "border-amber-300 bg-amber-100 text-amber-950",
  manual_review: "border-slate-300 bg-slate-100 text-slate-800",
};

export function DryRunReasonBreakdown({ rows }: DryRunReasonBreakdownProps) {
  const entries = Object.entries(rows)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-4">
        <h3 className="text-lg font-black text-slate-950">Reason Code Breakdown</h3>
        <p className="mt-1 text-sm font-semibold text-slate-700">Blockers and review reasons translated through the dry-run service formatter.</p>
      </div>
      {entries.length === 0 ? (
        <div className="p-5 text-sm font-bold text-slate-700">No reason-code blockers returned for this dry-run.</div>
      ) : (
        <div className="wm-slim-scrollbar overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="border-b border-slate-300 bg-slate-50 text-left text-xs font-black uppercase text-slate-800">
              <tr>
                <th className="px-4 py-3">reason_code</th>
                <th className="px-4 py-3">count</th>
                <th className="px-4 py-3">severity</th>
                <th className="px-4 py-3">explanation</th>
                <th className="px-4 py-3">suggested_fix</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {entries.map(([code, count]) => {
                const severity = getDryRunReasonSeverity(code);
                return (
                  <tr key={code} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs font-black text-slate-950">{code}</td>
                    <td className="px-4 py-3 font-bold tabular-nums text-slate-900">{count}</td>
                    <td className="px-4 py-3">
                      <Badge className={cn("rounded-full border px-2.5 py-1 text-xs font-black uppercase", severityClasses[severity])}>{severity}</Badge>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{formatDryRunReason(code)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{SUGGESTED_FIXES[code] ?? "Route to manual revenue-ops review before materialization."}</td>
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
