import { Card } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import type { FailedDeliveryRow } from "@/types/leadDelivery";
import { StatusBadge } from "./RecentDeliveriesTable";

interface Props {
  rows: FailedDeliveryRow[];
  isLoading: boolean;
  onSelectDelivery: (deliveryId: string) => void;
}

export function FailedDeliveriesTable({ rows, isLoading, onSelectDelivery }: Props) {
  if (isLoading && rows.length === 0) {
    return <Card className="p-6 text-sm text-muted-foreground">Loading failed deliveries…</Card>;
  }
  if (rows.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        No failed or dead-letter deliveries. ✓
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Last attempt</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
              <th className="text-left px-3 py-2 font-medium">Client</th>
              <th className="text-left px-3 py-2 font-medium">Contractor</th>
              <th className="text-left px-3 py-2 font-medium">Method</th>
              <th className="text-right px-3 py-2 font-medium">Attempts</th>
              <th className="text-right px-3 py-2 font-medium">HTTP</th>
              <th className="text-left px-3 py-2 font-medium">Error</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.delivery_id}
                onClick={() => onSelectDelivery(r.delivery_id)}
                className="border-t border-border hover:bg-muted/40 cursor-pointer transition-colors"
              >
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                  {r.last_attempt_at
                    ? formatDistanceToNow(new Date(r.last_attempt_at), { addSuffix: true })
                    : "—"}
                </td>
                <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                <td className="px-3 py-2">{r.client_slug ?? "—"}</td>
                <td className="px-3 py-2">{r.company_name ?? "—"}</td>
                <td className="px-3 py-2 capitalize">{r.dispatch_method ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.attempt_count}
                  <span className="text-muted-foreground/60 text-xs"> / {r.attempt_log_count}</span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.last_http_status ?? "—"}</td>
                <td className="px-3 py-2 max-w-[280px] truncate text-xs text-destructive/90">
                  {r.last_error ?? r.no_route_reason ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
