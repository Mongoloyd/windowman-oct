/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LEAD LIFECYCLE TIMELINE — Phase 7
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Renders ONLY repo-real timestamps. Empty milestones are filtered out —
 * never synthesized. Sourced entirely from the in-memory CRMLead +
 * latest opportunity + latest route already loaded by the dossier.
 */

import { Clock } from "lucide-react";
import { format } from "date-fns";
import type { CRMLead } from "./types";
import type { RoutingOpportunity, RoutingRoute } from "@/types/routingDesk";

interface Props {
  lead: CRMLead;
  opportunity?: RoutingOpportunity | null;
  latestRoute?: RoutingRoute | null;
}

interface Milestone { label: string; ts: string | null; }

export function LeadLifecycleTimeline({ lead, opportunity, latestRoute }: Props) {
  const milestones: Milestone[] = [
    { label: "Lead Created", ts: lead.created_at },
    { label: "Phone Verified", ts: lead.phone_verified_at },
    { label: "Report Unlocked", ts: lead.report_unlocked_at },
    { label: "Intro Requested", ts: lead.intro_requested_at },
    { label: "Handoff Sent", ts: opportunity?.sent_at ?? null },
    { label: "Routed to Contractor", ts: lead.routed_to_contractor_at ?? opportunity?.routed_at ?? null },
    { label: "Viewed by Contractor", ts: latestRoute?.viewed_at ?? null },
    { label: "Contractor Responded", ts: latestRoute?.responded_at ?? null },
    { label: "Contractor Interested", ts: latestRoute?.interested_at ?? null },
    { label: "Contact Released", ts: latestRoute?.contact_released_at ?? null },
    { label: "Last Call Completed", ts: lead.last_call_completed_at },
    { label: "Appointment Booked", ts: lead.appointment_booked_at },
    { label: "Replacement Quote Submitted", ts: lead.replacement_quote_submitted_at },
    { label: "Reactivation Email Sent", ts: lead.reactivation_email_sent_at },
    { label: "Closed", ts: lead.closed_at },
  ];

  const real = milestones
    .filter((m): m is { label: string; ts: string } => !!m.ts)
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  if (real.length === 0) {
    return <p className="text-xs text-slate-700 italic">No lifecycle events yet.</p>;
  }

  return (
    <ol className="space-y-1.5 relative">
      {real.map((m, i) => (
        <li key={`${m.label}-${i}`} className="flex items-center gap-2 text-xs">
          <Clock className="h-3 w-3 text-emerald-600 shrink-0" />
          <span className="font-medium">{m.label}</span>
          <span className="ml-auto font-mono text-sm text-slate-700">
            {format(new Date(m.ts), "MMM d, yyyy h:mm a")}
          </span>
        </li>
      ))}
    </ol>
  );
}
