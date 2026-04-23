/**
 * Sprint 6 PR-1 — Immutable attempt-log viewer (READ-ONLY drawer).
 * Lazily fetches webhook_delivery_attempts for the selected delivery only.
 */

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { fetchAttemptsForDelivery } from "@/services/leadDelivery";
import type { DeliveryAttemptRow, AttemptOutcome } from "@/types/leadDelivery";

interface Props {
  deliveryId: string | null;
  onClose: () => void;
}

export function DeliveryAttemptLogDrawer({ deliveryId, onClose }: Props) {
  const [attempts, setAttempts] = useState<DeliveryAttemptRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deliveryId) {
      setAttempts([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetchAttemptsForDelivery(deliveryId)
      .then((rows) => {
        if (!cancelled) setAttempts(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deliveryId]);

  return (
    <Sheet open={deliveryId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Delivery attempt log</SheetTitle>
          <SheetDescription>
            {deliveryId ? (
              <span className="font-mono text-xs">delivery_id: {deliveryId}</span>
            ) : (
              "Select a delivery to view its immutable attempt log."
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {isLoading && (
            <Card className="p-4 text-sm text-muted-foreground">Loading attempts…</Card>
          )}

          {error && (
            <Card className="p-4 border-destructive/40 bg-destructive/5 text-sm">
              <div className="font-semibold text-destructive">Failed to load attempts</div>
              <div className="text-xs text-muted-foreground mt-1 break-all">{error}</div>
            </Card>
          )}

          {!isLoading && !error && attempts.length === 0 && deliveryId && (
            <Card className="p-4 text-sm text-muted-foreground">
              No attempts recorded yet for this delivery.
            </Card>
          )}

          {attempts.map((a) => (
            <Card key={a.id} className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    Attempt #{a.attempt_number}
                  </Badge>
                  <OutcomeBadge outcome={a.outcome} success={a.success} />
                  {a.response_status_code !== null && (
                    <Badge variant="secondary" className="text-[10px] tabular-nums">
                      HTTP {a.response_status_code}
                    </Badge>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground tabular-nums">
                  {a.duration_ms !== null ? `${a.duration_ms}ms` : "—"}
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground">
                Started {format(new Date(a.request_started_at), "PP pp")}
                {a.request_completed_at && (
                  <> · Completed {format(new Date(a.request_completed_at), "pp")}</>
                )}
              </div>

              <div className="text-xs space-y-0.5">
                <div>
                  <span className="text-muted-foreground">Method:</span>{" "}
                  <span className="capitalize">{a.dispatch_method}</span>
                </div>
                {a.error_class && (
                  <div className="text-destructive">
                    <span className="text-muted-foreground">Error:</span> {a.error_class}
                    {a.error_message && <> — {a.error_message}</>}
                  </div>
                )}
                {a.response_body_snippet && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      Response snippet
                    </summary>
                    <pre className="mt-1 p-2 bg-muted rounded text-[10px] overflow-x-auto whitespace-pre-wrap break-all">
                      {a.response_body_snippet}
                    </pre>
                  </details>
                )}
              </div>
            </Card>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function OutcomeBadge({ outcome, success }: { outcome: AttemptOutcome; success: boolean }) {
  const variant: "default" | "secondary" | "destructive" | "outline" = success
    ? "default"
    : outcome.startsWith("http_5") || outcome === "timeout" || outcome === "network_error" || outcome === "exception"
      ? "destructive"
      : "outline";
  return (
    <Badge variant={variant} className="text-[10px] font-mono">
      {outcome}
    </Badge>
  );
}
