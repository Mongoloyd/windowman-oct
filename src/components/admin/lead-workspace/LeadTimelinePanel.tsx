/**
 * LeadTimelinePanel — Sprint 4
 *
 * Renders a chronological list of `lead_events` for a single lead. Used
 * inside the new full-page Lead Dossier route.
 */

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, AlertCircle, Clock, Circle } from "lucide-react";
import { fetchLeadEvents, getErrorMessage } from "@/services/adminDataService";
import type { LeadEvent } from "../types";

interface LeadTimelinePanelProps {
  leadId: string;
}

const EVENT_LABELS: Record<string, string> = {
  lead_created: "Lead created",
  scan_started: "Scan started",
  scan_complete: "Scan complete",
  otp_sent: "OTP sent",
  otp_verified: "Phone verified",
  report_unlocked: "Report unlocked",
  crm_handoff_queued: "Routed to contractor",
  crm_handoff_unroutable: "Routing failed",
  funnel_stage_changed: "Stage changed",
  call_queued: "Call queued",
  call_completed: "Call completed",
};

function labelFor(event: LeadEvent): string {
  return EVENT_LABELS[event.event_name] ?? event.event_name.replace(/_/g, " ");
}

export function LeadTimelinePanel({ leadId }: LeadTimelinePanelProps) {
  const { data: events = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin", "lead-events", leadId],
    queryFn: () => fetchLeadEvents(leadId, 100),
    enabled: !!leadId,
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <header className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Activity
          </p>
          <h3 className="font-display text-lg font-extrabold tracking-tight text-foreground mt-0.5">
            Timeline
          </h3>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {events.length} event{events.length === 1 ? "" : "s"}
        </span>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p>{getErrorMessage(error)}</p>
            <button onClick={() => refetch()} className="mt-1 text-xs underline">
              Try again
            </button>
          </div>
        </div>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-3">
          No events recorded for this lead yet.
        </p>
      ) : (
        <ol className="relative border-l border-border ml-2 space-y-4">
          {events.map((e: LeadEvent) => (
            <li key={e.id} className="pl-5 relative">
              <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-card bg-primary" />
              <p className="text-sm font-semibold text-foreground capitalize">{labelFor(e)}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground font-mono">
                {format(new Date(e.created_at), "MMM d, yyyy · h:mm:ss a")}
                {e.event_source && <span className="ml-2 opacity-70">· {e.event_source}</span>}
              </p>
              {e.metadata && Object.keys(e.metadata).length > 0 && (
                <pre className="mt-1.5 rounded-md bg-muted/40 px-2 py-1.5 text-[10px] font-mono leading-tight text-muted-foreground overflow-x-auto">
                  {JSON.stringify(e.metadata, null, 2)}
                </pre>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
