import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import type { RecentDeliveryRow, DeliveryStatus } from "@/types/leadDelivery";

interface Props {
  rows: RecentDeliveryRow[];
  isLoading: boolean;
  onSelectDelivery: (deliveryId: string) => void;
}

export function RecentDeliveriesTable({ rows, isLoading, onSelectDelivery }: Props) {
  if (isLoading && rows.length === 0) {
    return <Card className="p-6 text-sm text-slate-700">Loading recent deliveries…</Card>;
  }
  if (rows.length === 0) {
    return (
      <Card className="p-6 text-sm text-slate-700">
        No recent deliveries. Once a verified lead is dispatched, it will appear here.
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-slate-700">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Created</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
              <th className="text-left px-3 py-2 font-medium">Client</th>
              <th className="text-left px-3 py-2 font-medium">Contractor</th>
              <th className="text-left px-3 py-2 font-medium">Method</th>
              <th className="text-left px-3 py-2 font-medium">Event</th>
              <th className="text-left px-3 py-2 font-medium">Lead</th>
              <th className="text-right px-3 py-2 font-medium">Attempts</th>
              <th className="text-right px-3 py-2 font-medium">HTTP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.delivery_id}
                onClick={() => onSelectDelivery(r.delivery_id)}
                className="border-t border-border hover:bg-muted/40 cursor-pointer transition-colors"
              >
                <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                  {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                </td>
                <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                <td className="px-3 py-2">{r.client_slug ?? <Muted />}</td>
                <td className="px-3 py-2">{r.company_name ?? <Muted />}</td>
                <td className="px-3 py-2 capitalize">{r.dispatch_method ?? <Muted />}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.event_type}</td>
                <td className="px-3 py-2">
                  {r.lead_first_name ?? r.lead_email ?? (
                    <span className="font-mono text-xs text-slate-700">
                      {r.lead_id.slice(0, 8)}…
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.attempt_count}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.last_http_status ?? <Muted />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Muted() {
  return <span className="text-slate-700/60">—</span>;
}

export function StatusBadge({ status }: { status: DeliveryStatus }) {
  const map: Record<DeliveryStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending: { label: "pending", variant: "secondary" },
    processing: { label: "processing", variant: "secondary" },
    delivered: { label: "delivered", variant: "default" },
    failed: { label: "failed", variant: "destructive" },
    dead_letter: { label: "dead letter", variant: "destructive" },
    unroutable: { label: "unroutable", variant: "outline" },
    mock_delivered: { label: "mock", variant: "outline" },
  };
  const cfg = map[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={cfg.variant} className="text-[10px]">{cfg.label}</Badge>;
}
