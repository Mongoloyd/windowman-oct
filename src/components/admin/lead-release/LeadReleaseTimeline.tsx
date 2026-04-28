import { Clock3 } from "lucide-react";
import type { LeadReleaseTimelineEvent } from "@/services/leadReleaseQueue";
import { formatAllowedContactField } from "@/services/leadReleaseQueue";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function LeadReleaseTimeline({ events }: { events: LeadReleaseTimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="rounded-md border border-slate-300 bg-slate-50 p-3 text-sm font-semibold text-slate-700">No release decisions have been recorded yet.</p>;
  }

  return (
    <ol className="space-y-3">
      {events.map((event) => (
        <li key={event.id} className="rounded-md border border-slate-300 bg-slate-50 p-3">
          <div className="flex items-start gap-2 text-sm font-semibold text-slate-800">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" aria-hidden />
            <div>
              <p className="font-black text-slate-950">{event.eventType.replace(/_/g, " ")} · {event.decision.replace(/_/g, " ")}</p>
              <p className="mt-1 text-xs font-bold uppercase text-slate-500">{formatDate(event.createdAt)}</p>
              {event.reason ? <p className="mt-2">Reason: {event.reason}</p> : null}
              {event.notes ? <p className="mt-1">Notes: {event.notes}</p> : null}
              {event.allowedContactFields.length > 0 ? <p className="mt-2 text-xs font-bold uppercase text-slate-600">Allowed fields: {event.allowedContactFields.map(formatAllowedContactField).join(", ")}</p> : null}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
