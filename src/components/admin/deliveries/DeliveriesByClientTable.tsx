import { Card } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import type { DeliveriesByClientRow } from "@/types/leadDelivery";

interface Props {
  rows: DeliveriesByClientRow[];
  isLoading: boolean;
}

export function DeliveriesByClientTable({ rows, isLoading }: Props) {
  if (isLoading && rows.length === 0) {
    return <Card className="p-6 text-sm text-slate-700">Loading client breakdown…</Card>;
  }
  if (rows.length === 0) {
    return <Card className="p-6 text-sm text-slate-700">No deliveries grouped by client yet.</Card>;
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-slate-700">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Client</th>
              <th className="text-right px-3 py-2 font-medium">Total</th>
              <th className="text-right px-3 py-2 font-medium">Delivered</th>
              <th className="text-right px-3 py-2 font-medium">Pending</th>
              <th className="text-right px-3 py-2 font-medium">Processing</th>
              <th className="text-right px-3 py-2 font-medium">Failed</th>
              <th className="text-right px-3 py-2 font-medium">Dead</th>
              <th className="text-right px-3 py-2 font-medium">Unroutable</th>
              <th className="text-left px-3 py-2 font-medium">Most recent</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.client_slug} className="border-t border-border hover:bg-muted/40 transition-colors">
                <td className="px-3 py-2 font-medium">{r.client_slug}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.total}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.delivered}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.pending}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.processing}</td>
                <td className="px-3 py-2 text-right tabular-nums text-destructive">{r.failed}</td>
                <td className="px-3 py-2 text-right tabular-nums text-destructive">{r.dead_letter}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.unroutable}</td>
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
