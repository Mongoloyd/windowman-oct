/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MARKET OPS FEED — Phase 8: Shared-Market Pilot Readiness (read-only)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Lightweight chronological "what just happened in the market" feed for
 * operators. Derived ENTIRELY from existing repo-real timestamps on:
 *
 *   • leads                          (routed_to_contractor_at,
 *                                     appointment_booked_at, closed_at,
 *                                     reactivation_email_sent_at,
 *                                     report_unlocked_at)
 *   • contractor_opportunities       (routed_at)
 *   • contractor_opportunity_routes  (sent_at, viewed_at, responded_at,
 *                                     interested_at, contact_released_at,
 *                                     release_requested_at,
 *                                     release_reviewed_at)
 *
 * NO new tables. NO new columns. NO fabricated event types.
 *
 * Markets / counties:
 *   Each event is tagged with the parent lead's `county` if known, otherwise
 *   the safe operator-facing fallback `Unknown County`. The feed is filterable
 *   by market — this is pure UI grouping; no routing logic is implied.
 *
 * Reads come through the centralized TanStack Query keys already in use
 * (`["admin","opportunities"]`, `["admin","routes","all"]`,
 * `["admin","contractors"]`) — NO direct edge-function calls, NO bypass of
 * the centralized admin client.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Activity, Send, Eye, MessageSquare, ThumbsUp, Unlock,
  CalendarCheck, RotateCcw, CheckCircle2, ShieldQuestion, MapPin,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchOpportunities, fetchRoutes, fetchContractors,
} from "@/services/adminDataService";
import type {
  RoutingOpportunity, RoutingRoute, RoutingContractor,
} from "@/types/routingDesk";
import type { CRMLead } from "@/components/admin/types";

// Safe fallback for null/empty geography. Never block UI on missing county.
const UNKNOWN_COUNTY = "Unknown County";

const MAX_EVENTS = 60;

interface Props {
  leads: CRMLead[];
}

type FeedEventKind =
  | "lead_routed"
  | "route_sent"
  | "route_viewed"
  | "route_responded"
  | "route_interested"
  | "contact_released"
  | "release_requested"
  | "release_reviewed"
  | "appointment_booked"
  | "lead_closed"
  | "reactivation_email_sent"
  | "report_unlocked";

interface FeedEvent {
  id: string;            // unique per event row
  kind: FeedEventKind;
  at: string;            // ISO timestamp from repo-real source
  county: string;        // safe fallback already applied
  leadId: string;
  leadName: string;
  contractorName: string | null;
}

const KIND_META: Record<FeedEventKind, { label: string; icon: React.ElementType; tone: string }> = {
  lead_routed:             { label: "Lead Routed",            icon: Send,          tone: "text-cyan-600" },
  route_sent:              { label: "Route Sent",             icon: Send,          tone: "text-cyan-600" },
  route_viewed:            { label: "Route Viewed",           icon: Eye,           tone: "text-cyan-600" },
  route_responded:         { label: "Contractor Responded",   icon: MessageSquare, tone: "text-cyan-600" },
  route_interested:        { label: "Contractor Interested",  icon: ThumbsUp,      tone: "text-emerald-600" },
  contact_released:        { label: "Contact Released",       icon: Unlock,        tone: "text-emerald-600" },
  release_requested:       { label: "Release Requested",      icon: ShieldQuestion,tone: "text-amber-600" },
  release_reviewed:        { label: "Release Reviewed",       icon: CheckCircle2,  tone: "text-amber-600" },
  appointment_booked:      { label: "Appointment Booked",     icon: CalendarCheck, tone: "text-emerald-600" },
  lead_closed:             { label: "Lead Closed",            icon: CheckCircle2,  tone: "text-slate-700" },
  reactivation_email_sent: { label: "Reactivation Email",     icon: RotateCcw,     tone: "text-amber-600" },
  report_unlocked:         { label: "Report Unlocked",        icon: Unlock,        tone: "text-violet-600" },
};

function leadDisplayName(l: CRMLead): string {
  const parts = [l.first_name, l.last_name].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return l.email ?? `Lead ${l.id.slice(0, 8)}`;
}

export function MarketOpsFeed({ leads }: Props) {
  const [marketFilter, setMarketFilter] = useState<string>("all");

  const { data: opps, isLoading: oppsLoading } = useQuery({
    queryKey: ["admin", "opportunities"],
    queryFn: fetchOpportunities,
    staleTime: 30_000,
  });

  const { data: routes, isLoading: routesLoading } = useQuery({
    queryKey: ["admin", "routes", "all"],
    queryFn: () => fetchRoutes(),
    staleTime: 30_000,
  });

  const { data: contractors } = useQuery({
    queryKey: ["admin", "contractors"],
    queryFn: fetchContractors,
    staleTime: 60_000,
  });

  const { allEvents, marketCounts } = useMemo(() => {
    const oppsArr = (opps as RoutingOpportunity[] | undefined) ?? [];
    const routesArr = (routes as RoutingRoute[] | undefined) ?? [];
    const contractorsArr = (contractors as RoutingContractor[] | undefined) ?? [];

    const leadById = new Map(leads.map((l) => [l.id, l]));
    const oppById = new Map(oppsArr.map((o) => [o.id, o]));
    const contractorById = new Map(contractorsArr.map((c) => [c.id, c]));

    // Resolve a lead's safe market label.
    const marketFor = (leadId: string | null | undefined): string => {
      if (!leadId) return UNKNOWN_COUNTY;
      const lead = leadById.get(leadId);
      const county = lead?.county?.trim();
      return county && county.length > 0 ? county : UNKNOWN_COUNTY;
    };

    const events: FeedEvent[] = [];

    const pushEvent = (
      kind: FeedEventKind,
      at: string | null | undefined,
      leadId: string | null | undefined,
      contractorId: string | null = null,
      idSalt = "",
    ) => {
      // Skip silently when required fields are missing — never crash the feed.
      if (!at || !leadId) return;
      // Validate timestamp before sorting on it; skip invalid dates safely.
      const ts = new Date(at).getTime();
      if (Number.isNaN(ts)) return;
      const lead = leadById.get(leadId);
      if (!lead) return;
      events.push({
        id: `${kind}:${leadId}:${at}:${idSalt}`,
        kind,
        at,
        county: marketFor(leadId),
        leadId,
        leadName: leadDisplayName(lead),
        contractorName: contractorId ? contractorById.get(contractorId)?.company_name ?? null : null,
      });
    };

    // ── Lead-level lifecycle (repo-real columns on `leads`) ──
    for (const l of leads) {
      pushEvent("report_unlocked", l.report_unlocked_at, l.id);
      pushEvent("lead_routed", l.routed_to_contractor_at, l.id);
      pushEvent("appointment_booked", l.appointment_booked_at, l.id);
      pushEvent("lead_closed", l.closed_at, l.id);
      pushEvent("reactivation_email_sent", l.reactivation_email_sent_at, l.id);
    }

    // ── Opportunity-level routing (repo-real `routed_at`) ──
    // We already cover lead.routed_to_contractor_at above; opportunity-level
    // routed_at provides the contractor pairing context when present.
    for (const o of oppsArr) {
      if (o.routed_at) {
        // Find the latest route to attach contractor name.
        const latestRoute = routesArr
          .filter((r) => r.opportunity_id === o.id)
          .sort((a, b) =>
            new Date(b.sent_at ?? b.created_at).getTime() -
            new Date(a.sent_at ?? a.created_at).getTime(),
          )[0];
        // Use a salt with opp id so it doesn't collide with the lead-level row.
        if (latestRoute && latestRoute.contractor_id) {
          pushEvent("lead_routed", o.routed_at, o.lead_id, latestRoute.contractor_id, `opp:${o.id}`);
        }
      }
    }

    // ── Route-level activity (repo-real timestamps) ──
    for (const r of routesArr) {
      const opp = oppById.get(r.opportunity_id);
      if (!opp) continue;
      pushEvent("route_sent",        r.sent_at,             opp.lead_id, r.contractor_id, `r:${r.id}`);
      pushEvent("route_viewed",      r.viewed_at,           opp.lead_id, r.contractor_id, `r:${r.id}`);
      pushEvent("route_responded",   r.responded_at,        opp.lead_id, r.contractor_id, `r:${r.id}`);
      pushEvent("route_interested",  r.interested_at,       opp.lead_id, r.contractor_id, `r:${r.id}`);
      pushEvent("contact_released",  r.contact_released_at, opp.lead_id, r.contractor_id, `r:${r.id}`);
      pushEvent("release_requested", r.release_requested_at,opp.lead_id, r.contractor_id, `r:${r.id}`);
      pushEvent("release_reviewed",  r.release_reviewed_at, opp.lead_id, r.contractor_id, `r:${r.id}`);
    }

    // Sort newest first; pushEvent already validated timestamps.
    events.sort((a, b) => {
      const tb = new Date(b.at).getTime();
      const ta = new Date(a.at).getTime();
      return tb - ta;
    });

    // Market counts (post-derivation, pre-filter) for the dropdown.
    const counts = new Map<string, number>();
    for (const e of events) {
      counts.set(e.county, (counts.get(e.county) ?? 0) + 1);
    }
    const sortedMarkets = [...counts.entries()].sort((a, b) => b[1] - a[1]);

    return { allEvents: events, marketCounts: sortedMarkets };
  }, [opps, routes, contractors, leads]);

  const visibleEvents = useMemo(() => {
    const base = marketFilter === "all"
      ? allEvents
      : allEvents.filter((e) => e.county === marketFilter);
    return base.slice(0, MAX_EVENTS);
  }, [allEvents, marketFilter]);

  const isLoading = oppsLoading || routesLoading;

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-slate-700" />
          <CardTitle className="text-sm font-medium text-slate-700 uppercase tracking-wider">
            Market Ops Feed
          </CardTitle>
          <Badge variant="outline" className="text-[10px]">
            Read-only · derived from existing data
          </Badge>
        </div>
        <Select value={marketFilter} onValueChange={setMarketFilter}>
          <SelectTrigger className="h-8 w-[200px] text-xs">
            <MapPin className="h-3 w-3 mr-1" />
            <SelectValue placeholder="All Markets" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Markets ({allEvents.length})</SelectItem>
            {marketCounts.map(([market, count]) => (
              <SelectItem key={market} value={market}>
                {market} ({count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading && allEvents.length === 0 ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : visibleEvents.length === 0 ? (
          <div className="text-center py-10 text-sm text-slate-700">
            No market activity yet
            {marketFilter !== "all" && ` in ${marketFilter}`}.
          </div>
        ) : (
          <ol className="divide-y divide-border/40">
            {visibleEvents.map((e) => {
              const meta = KIND_META[e.kind];
              const Icon = meta.icon;
              return (
                <li key={e.id} className="flex items-start gap-3 py-2.5">
                  <div className={`shrink-0 mt-0.5 ${meta.tone}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold">{meta.label}</span>
                      <span className="text-xs text-slate-700">·</span>
                      <span className="text-xs font-medium truncate">{e.leadName}</span>
                      {e.contractorName && (
                        <>
                          <span className="text-xs text-slate-700">→</span>
                          <span className="text-xs text-cyan-700">{e.contractorName}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <MapPin className="h-2.5 w-2.5" />
                        {e.county}
                      </Badge>
                      <span className="text-[10px] text-slate-700 font-mono">
                        {format(new Date(e.at), "MMM d, h:mm a")}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {allEvents.length > visibleEvents.length && (
          <p className="text-[10px] text-slate-700 text-center mt-3">
            Showing {visibleEvents.length} of {allEvents.length} most recent market events.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
