import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Webhook, AlertCircle } from "lucide-react";
import type { WebhookDelivery } from "./types";

interface EngineRoomProps {
  deliveries: WebhookDelivery[];
  isLoading?: boolean;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  delivered: "default",
  mock_delivered: "default",
  failed: "destructive",
  dead_letter: "outline",
};

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function EngineRoom({ deliveries, isLoading }: EngineRoomProps) {
  const counts = {
    pending: deliveries.filter((d) => d.status === "pending").length,
    delivered: deliveries.filter((d) => ["delivered", "mock_delivered"].includes(d.status)).length,
    failed: deliveries.filter((d) => d.status === "failed").length,
    dead_letter: deliveries.filter((d) => d.status === "dead_letter").length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-700">
        Loading engine room…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {([
          { label: "Pending", count: counts.pending, variant: "secondary" as const },
          { label: "Delivered", count: counts.delivered, variant: "default" as const },
          { label: "Failed", count: counts.failed, variant: "destructive" as const },
          { label: "Dead Letter", count: counts.dead_letter, variant: "outline" as const },
        ]).map((item) => (
          <Card key={item.label}>
            <CardContent className="flex flex-col items-center gap-1 py-4">
              <Badge variant={item.variant} className="text-xs">{item.label}</Badge>
              <span className="text-2xl font-bold font-mono tabular-nums">{item.count}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Deliveries Table */}
      {deliveries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Webhook className="h-12 w-12 text-slate-700" />
            <p className="text-lg font-medium text-slate-700">No webhook deliveries</p>
            <p className="text-sm text-slate-700">
              Deliveries will appear once leads pass the dual-gate trigger.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-700 uppercase tracking-wider">
              Recent Deliveries
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Attempts</TableHead>
                    <TableHead className="text-center">HTTP</TableHead>
                    <TableHead>Last Error</TableHead>
                    <TableHead className="text-right">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs">{d.event_type}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[d.status] ?? "secondary"} className="text-xs">
                          {d.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm">
                        {d.attempt_count}/{d.max_attempts}
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm">
                        {d.last_http_status ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {d.last_error ? (
                          <span className="text-xs text-destructive truncate block" title={d.last_error}>
                            <AlertCircle className="h-3 w-3 inline mr-1" />
                            {d.last_error}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-700">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs text-slate-700 whitespace-nowrap">
                        {formatTime(d.updated_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
