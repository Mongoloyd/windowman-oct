import { Card } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import type { DeliveriesByContractorRow } from "@/types/leadDelivery";

interface Props {
  rows: DeliveriesByContractorRow[];
  isLoading: boolean;
}

export function DeliveriesByContractorTable({ rows, isLoading }: Props) {
  if (isLoading && rows.length === 0) {
    return <Card className="p-6 text-sm text-slate-700">Loading contractor breakdown…</Card>;
  }
  if (rows.length === 0) {
    return <Card className="p-6 text-sm text-slate-700">No deliveries grouped by contractor yet.</Card>;
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-slate-700">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Contractor</th>
              <th className="text-right px-3 py-2 font-medium">Total</th>
              <th className="text-right px-3 py-2 font-medium">Delivered</th>
              <th className="text-right px-3 py-2 font-medium">Pending</th>
              <th className="text-right px-3 py-2 font-medium">Failed / dead</th>
              <th className="text-right px-3 py-2 font-medium">Clients</th>
              <th className="text-left px-3 py-2 font-medium">Most recent</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.contractor_id} className="border-t border-border hover:bg-muted/40 transition-colors">
                <td className="px-3 py-2 font-medium">
                  {r.company_name ?? (
                    <span className="font-mono text-xs text-slate-700">
                      {r.contractor_id.slice(0, 8)}…
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.total}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.delivered}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.pending}</td>
                <td className="px-3 py-2 text-right tabular-nums text-destructive">{r.failed_or_dead}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.distinct_clients}</td>
                <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                  {r.most_recent_at
                    ? formatDistanceToNow(new Date(r.most_recent_at), { addSuffix: true })
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
