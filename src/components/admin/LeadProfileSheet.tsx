import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  AlertTriangle,
  Clock,
} from "lucide-react";
import type { CRMLead, LeadEvent } from "./types";
import { derivePipelineStatus } from "./types";

interface LeadProfileSheetProps {
  lead: CRMLead;
  events: LeadEvent[];
  isLoadingEvents?: boolean;
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const EVENT_ICONS: Record<string, string> = {
  crm_handoff_queued: "📤",
  crm_handoff_delivered: "✅",
  crm_handoff_mock_delivered: "🧪",
  crm_handoff_failed: "❌",
  otp_verified: "🔐",
  quote_uploaded: "📄",
  scan_started: "🔍",
  scan_completed: "🎯",
  report_viewed: "👁️",
  contractor_match_requested: "🤝",
};

/* ── Component ───────────────────────────────────────────────────────── */

export function LeadProfileSheet({ lead, events, isLoadingEvents }: LeadProfileSheetProps) {
  const status = derivePipelineStatus(lead);

  return (
    <div className="space-y-6 pt-4">
      {/* Contact Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg">
              {(lead.first_name?.[0] ?? lead.email?.[0] ?? "?").toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-sm">
                {[lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown"}
              </p>
              <Badge variant={status === "verified" ? "default" : "secondary"} className="text-xs mt-0.5">
                {status.replace("_", " ").toUpperCase()}
              </Badge>
            </div>
          </div>

          <Separator />

          <div className="space-y-2 text-sm">
            {lead.email && (
              <div className="flex items-center gap-2 text-slate-700">
                <Mail className="h-4 w-4" />
                <span>{lead.email}</span>
              </div>
            )}
            {lead.phone_e164 && (
              <div className="flex items-center gap-2 text-slate-700">
                <Phone className="h-4 w-4" />
                <span className="font-mono">
                  {lead.phone_verified ? lead.phone_e164 : `•••-•••-${lead.phone_e164.slice(-4)}`}
                </span>
                {lead.phone_verified && (
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                )}
              </div>
            )}
            {(lead.county || lead.state || lead.zip) && (
              <div className="flex items-center gap-2 text-slate-700">
                <MapPin className="h-4 w-4" />
                <span>{[lead.county, lead.state, lead.zip].filter(Boolean).join(", ")}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* AI Audit Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">AI Audit Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {lead.latest_analysis_id ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col items-center rounded-md border p-3">
                <span className="text-xs text-slate-700">Grade</span>
                <span className="text-2xl font-bold">{lead.grade ?? "—"}</span>
              </div>
              <div className="flex flex-col items-center rounded-md border p-3">
                <span className="text-xs text-slate-700">Confidence</span>
                <span className="text-2xl font-bold font-mono">
                  {lead.confidence_score != null ? `${lead.confidence_score}%` : "—"}
                </span>
              </div>
              <div className="flex flex-col items-center rounded-md border p-3">
                <span className="text-xs text-slate-700 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-destructive" /> Red Flags
                </span>
                <span className="text-xl font-bold text-destructive">{lead.red_flag_count}</span>
              </div>
              <div className="flex flex-col items-center rounded-md border p-3">
                <span className="text-xs text-slate-700">Windows</span>
                <span className="text-xl font-bold">{lead.window_count ?? "—"}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-700 text-center py-4">
              No analysis completed yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* System Timeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" /> System Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingEvents ? (
            <p className="text-sm text-slate-700 animate-pulse text-center py-4">
              Loading timeline…
            </p>
          ) : events.length === 0 ? (
            <p className="text-sm text-slate-700 text-center py-4">
              No events recorded yet.
            </p>
          ) : (
            <div className="relative space-y-0">
              {/* Vertical timeline line */}
              <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />

              {events.map((event, i) => (
                <div key={event.id} className="relative flex gap-3 py-2">
                  {/* Dot */}
                  <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card border text-sm">
                    {EVENT_ICONS[event.event_name] ?? "•"}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">
                      {event.event_name.replace(/_/g, " ")}
                    </p>
                    {event.event_source && (
                      <span className="text-xs text-slate-700">
                        via {event.event_source}
                      </span>
                    )}
                    <p className="text-xs text-slate-700 mt-0.5">
                      {formatTimestamp(event.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
