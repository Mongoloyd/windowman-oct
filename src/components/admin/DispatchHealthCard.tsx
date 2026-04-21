/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DispatchHealthCard — Live operator visibility into the dispatch path.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Renders inside the existing RoutingDesk surface. NOT a new tab.
 * Reads `webhook_deliveries` directly via the existing internal-operator RLS
 * policy — no edge function changes, no new dispatch worker.
 *
 * Source of truth:
 *   • public.webhook_deliveries.status
 *   • public.webhook_deliveries.created_at / last_attempt_at
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Activity, AlertTriangle, CheckCircle2, Loader2, PauseCircle, RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  fetchDispatchHealth, type DispatchHealthState,
} from "@/services/dispatchHealth";

const STATE_TONE: Record<DispatchHealthState, string> = {
  healthy:               "border-emerald-500/40 bg-emerald-500/5  text-emerald-700",
  draining:              "border-cyan-500/40    bg-cyan-500/5     text-cyan-700",
  idle_no_traffic:       "border-border         bg-muted/40       text-muted-foreground",
  queue_idle:            "border-amber-500/40   bg-amber-500/5    text-amber-700",
  blocked_dead_letter:   "border-destructive/50 bg-destructive/5  text-destructive",
  blocked_unroutable:    "border-destructive/50 bg-destructive/5  text-destructive",
};

const STATE_ICON: Record<DispatchHealthState, JSX.Element> = {
  healthy:             <CheckCircle2 className="h-4 w-4" />,
  draining:            <Loader2 className="h-4 w-4 animate-spin" />,
  idle_no_traffic:     <PauseCircle className="h-4 w-4" />,
  queue_idle:          <PauseCircle className="h-4 w-4" />,
  blocked_dead_letter: <AlertTriangle className="h-4 w-4" />,
  blocked_unroutable:  <AlertTriangle className="h-4 w-4" />,
};

const STATE_LABEL: Record<DispatchHealthState, string> = {
  healthy:             "Healthy",
  draining:            "Draining",
  idle_no_traffic:     "Idle — no traffic",
  queue_idle:          "Queue idle",
  blocked_dead_letter: "Blocked — dead-letter",
  blocked_unroutable:  "Blocked — unroutable",
};

function relTime(iso: string | null): string {
  if (!iso) return "never";
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

export function DispatchHealthCard() {
  const healthQuery = useQuery({
    queryKey: ["admin", "dispatch-health"],
    queryFn: fetchDispatchHealth,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  if (healthQuery.isLoading) {
    return (
      <Card className="p-3 flex items-center gap-2 border-dashed">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading dispatch health…</span>
      </Card>
    );
  }

  if (healthQuery.error || !healthQuery.data) {
    return (
      <Card className="p-3 flex items-center gap-2 border-destructive/30 bg-destructive/5">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <span className="text-xs text-destructive">Failed to load dispatch health.</span>
        <Button
          size="sm" variant="ghost" className="h-7 ml-auto text-xs"
          onClick={() => healthQuery.refetch()}
        >
          <RefreshCw className="h-3 w-3 mr-1" /> Retry
        </Button>
      </Card>
    );
  }

  const h = healthQuery.data;
  const tone = STATE_TONE[h.state];

  return (
    <Card className={`p-4 border ${tone}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="mt-0.5 shrink-0">{STATE_ICON[h.state]}</div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold uppercase tracking-wider">
                Dispatch Health
              </h3>
              <Badge variant="outline" className={`text-[10px] ${tone}`}>
                {STATE_LABEL[h.state]}
              </Badge>
            </div>
            <p className="text-xs mt-1 leading-snug">{h.stateReason}</p>
            <p className="text-[11px] mt-1 text-muted-foreground font-mono">
              Last enqueue: {relTime(h.mostRecentEnqueueAt)} · Last worker attempt: {relTime(h.mostRecentAttemptAt)}
            </p>
          </div>
        </div>

        <Button
          size="sm" variant="ghost" className="h-7 text-xs shrink-0"
          onClick={() => healthQuery.refetch()}
          disabled={healthQuery.isFetching}
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${healthQuery.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Counts strip — repo-real status enum from webhook_deliveries */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-3">
        <CountTile label="Pending"     value={h.counts.pending}     tone="text-cyan-700" />
        <CountTile label="Processing"  value={h.counts.processing}  tone="text-cyan-700" />
        <CountTile label="Delivered"   value={h.counts.delivered}   tone="text-emerald-700" />
        <CountTile label="Failed"      value={h.counts.failed}      tone="text-amber-700" />
        <CountTile label="Dead-letter" value={h.counts.dead_letter} tone="text-destructive" />
        <CountTile label="Unroutable"  value={h.counts.unroutable}  tone="text-destructive" />
      </div>
    </Card>
  );
}

function CountTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-card px-2 py-1.5 flex flex-col items-center">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`text-base font-bold font-mono tabular-nums ${value > 0 ? tone : "text-muted-foreground"}`}>
        {value}
      </span>
    </div>
  );
}
