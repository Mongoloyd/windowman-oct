/**
 * ═══════════════════════════════════════════════════════════════════════════
 * OPPORTUNITY ROUTE TIMELINE — Operator-safe handoff context block
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Reusable read-only block that surfaces:
 *   • Assigned Contractor / Partner
 *   • Handoff Status (mapped to plain English)
 *   • Routed At
 *   • Route activity timeline (sent → viewed → responded → interested → released)
 *   • Operator-safe contractor brief summary (brief_text only)
 *   • One-line strongest closing angle (string only)
 *
 * Operator-safe by design: never renders raw brief_json, prompts, rubric
 * weights, or extraction internals.
 */

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Building2, Clock, FileText, Send, Eye, MessageSquare, ThumbsUp, Unlock, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchOpportunities, fetchRoutes, fetchContractors } from "@/services/adminDataService";
import type { RoutingOpportunity, RoutingRoute, RoutingContractor } from "@/types/routingDesk";

interface OpportunityRouteTimelineProps {
  opportunityId: string | null;
}

const STATUS_LABEL: Record<string, { label: string; tone: "neutral" | "info" | "ok" | "warn" | "danger" }> = {
  intro_requested: { label: "Ready to Route", tone: "info" },
  sent_to_contractor: { label: "Sent", tone: "info" },
  viewed: { label: "Viewed", tone: "info" },
  interested: { label: "Interested", tone: "ok" },
  declined: { label: "Declined", tone: "warn" },
  released: { label: "Contact Released", tone: "ok" },
  closed: { label: "Closed", tone: "neutral" },
  dead: { label: "Dead", tone: "danger" },
};

function toneClass(tone: "neutral" | "info" | "ok" | "warn" | "danger"): string {
  switch (tone) {
    case "ok": return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
    case "info": return "bg-cyan-500/15 text-cyan-700 border-cyan-500/30";
    case "warn": return "bg-amber-500/15 text-amber-700 border-amber-500/30";
    case "danger": return "bg-destructive/15 text-destructive border-destructive/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

function fmtTs(ts: string | null): string {
  if (!ts) return "—";
  return format(new Date(ts), "MMM d, yyyy h:mm a");
}

function pickClosingAngle(briefJson: Record<string, unknown> | null | undefined): string | null {
  if (!briefJson || typeof briefJson !== "object") return null;
  const angles = (briefJson as any).closing_angles;
  if (Array.isArray(angles) && angles.length > 0 && typeof angles[0] === "string") {
    return angles[0] as string;
  }
  return null;
}

export function OpportunityRouteTimeline({ opportunityId }: OpportunityRouteTimelineProps) {
  const { data: opps, isLoading: oppsLoading, error: oppsError } = useQuery({
    queryKey: ["admin", "opportunities"],
    queryFn: fetchOpportunities,
    enabled: !!opportunityId,
    staleTime: 30_000,
  });

  const { data: routes, isLoading: routesLoading } = useQuery({
    queryKey: ["admin", "routes", opportunityId],
    queryFn: () => fetchRoutes(opportunityId ?? undefined),
    enabled: !!opportunityId,
    staleTime: 30_000,
  });

  const { data: contractors } = useQuery({
    queryKey: ["admin", "contractors"],
    queryFn: fetchContractors,
    enabled: !!opportunityId,
    staleTime: 60_000,
  });

  if (!opportunityId) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-4 text-center">
        <Building2 className="h-5 w-5 mx-auto text-muted-foreground mb-1.5" />
        <p className="text-xs text-muted-foreground">
          No opportunity yet — route this lead from the Routing tab or use Send to Contractor above.
        </p>
      </div>
    );
  }

  if (oppsLoading || routesLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (oppsError) {
    return (
      <div className="flex items-center gap-2 text-xs text-destructive">
        <AlertCircle className="h-3.5 w-3.5" />
        Failed to load contractor delivery context.
      </div>
    );
  }

  const opp: RoutingOpportunity | undefined = (opps as RoutingOpportunity[] | undefined)?.find(
    (o) => o.id === opportunityId,
  );

  if (!opp) {
    return (
      <p className="text-xs text-muted-foreground">Opportunity record not found.</p>
    );
  }

  const oppRoutes = (routes as RoutingRoute[] | undefined) ?? [];
  // Latest route — sort by sent_at desc, fall back to created_at.
  const latestRoute: RoutingRoute | null = [...oppRoutes].sort((a, b) => {
    const at = a.sent_at ?? a.created_at;
    const bt = b.sent_at ?? b.created_at;
    return new Date(bt).getTime() - new Date(at).getTime();
  })[0] ?? null;

  const assignedContractor: RoutingContractor | null = latestRoute
    ? (contractors as RoutingContractor[] | undefined)?.find((c) => c.id === latestRoute.contractor_id) ?? null
    : null;

  const statusMeta = STATUS_LABEL[opp.status] ?? { label: opp.status ?? "Unknown", tone: "neutral" as const };
  const closingAngle = pickClosingAngle(opp.brief_json);

  return (
    <div className="space-y-3">
      {/* ── Header row: contractor + status ── */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={`text-[10px] uppercase tracking-wide border ${toneClass(statusMeta.tone)}`}>
          {statusMeta.label}
        </Badge>
        {assignedContractor ? (
          <span className="inline-flex items-center gap-1.5 text-xs">
            <Building2 className="h-3.5 w-3.5 text-cyan-600" />
            <span className="font-medium">{assignedContractor.company_name}</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground italic">No partner assigned yet</span>
        )}
        {opp.routed_at && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground ml-auto font-mono">
            <Clock className="h-3 w-3" />
            Routed {fmtTs(opp.routed_at)}
          </span>
        )}
      </div>

      {/* ── Activity timeline (only if route exists) ── */}
      {latestRoute && (
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-1.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">
            Route Activity
          </p>
          <ActivityRow icon={Send} label="Sent" timestamp={latestRoute.sent_at} />
          <ActivityRow icon={Eye} label="Viewed" timestamp={latestRoute.viewed_at} />
          <ActivityRow icon={MessageSquare} label="Responded" timestamp={latestRoute.responded_at} />
          <ActivityRow icon={ThumbsUp} label="Interested" timestamp={latestRoute.interested_at} />
          <ActivityRow icon={Unlock} label="Contact Released" timestamp={latestRoute.contact_released_at} />
        </div>
      )}

      {/* ── Brief summary (operator-safe text only) ── */}
      {(opp.brief_text || closingAngle) && (
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-cyan-600" />
            <p className="text-[10px] uppercase tracking-wide text-cyan-700 font-semibold">
              Contractor Brief
            </p>
            {opp.brief_version && (
              <span className="text-[10px] text-muted-foreground font-mono ml-auto">
                v{opp.brief_version}
              </span>
            )}
          </div>
          {opp.brief_text && (
            <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed line-clamp-6">
              {opp.brief_text}
            </p>
          )}
          {closingAngle && (
            <div className="border-t border-cyan-500/20 pt-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">
                Strongest Closing Angle
              </p>
              <p className="text-xs text-foreground/90 italic">"{closingAngle}"</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ActivityRow({
  icon: Icon, label, timestamp,
}: { icon: React.ElementType; label: string; timestamp: string | null }) {
  const done = !!timestamp;
  return (
    <div className={`flex items-center gap-2 text-xs ${done ? "" : "opacity-50"}`}>
      <Icon className={`h-3 w-3 ${done ? "text-emerald-600" : "text-muted-foreground"}`} />
      <span className={done ? "font-medium" : "text-muted-foreground"}>{label}</span>
      <span className="ml-auto font-mono text-[10px] text-muted-foreground">
        {fmtTs(timestamp)}
      </span>
    </div>
  );
}
