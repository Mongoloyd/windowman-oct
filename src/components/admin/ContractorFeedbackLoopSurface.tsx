/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CONTRACTOR FEEDBACK LOOP — Phase 16
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Internal operator surface that surfaces contractor-side response/disposition
 * signals on routed opportunities. Purely read-only + operator guidance. No
 * new mutations, no contractor portal, no CRM sync, no automated reminders.
 *
 * STRICT CONSTRAINTS (Phase 16):
 *   • Frontend only. Reads via `adminDataService` (invokeAdminData).
 *   • All disposition buckets are deterministic operator-view derivations
 *     from real route fields (sent_at, viewed_at, responded_at,
 *     interested_at, contact_released_at, release_status, route_status)
 *     plus parent lead fields (appointment_booked_at, closed_at,
 *     deal_status). Comments inline below.
 *   • Local-only collapse + clipboard. No persisted feedback notes.
 *   • Does not duplicate Outcome Tracking / Routing Desk / Lifecycle logic;
 *     it focuses specifically on the contractor-side response funnel.
 */

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Copy,
  Eye,
  ExternalLink,
  HelpCircle,
  Inbox,
  Info,
  MessageSquare,
  Send,
  ThumbsUp,
  Unlock,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

import {
  fetchContractors,
  fetchOpportunities,
  fetchRoutes,
} from "@/services/adminDataService";
import type {
  RoutingContractor,
  RoutingOpportunity,
  RoutingRoute,
} from "@/types/routingDesk";
import type { CRMLead } from "@/components/admin/types";

interface Props {
  leads: CRMLead[];
  onNavigateTab?: (tab: string) => void;
}

type DispositionKey =
  | "sent_not_viewed"
  | "viewed_not_responded"
  | "responded_not_interested"
  | "interested_not_booked"
  | "released"
  | "booked"
  | "closed"
  | "unresolved";

interface DispositionRow {
  bucket: DispositionKey;
  reason: string;
  route: RoutingRoute;
  opportunity: RoutingOpportunity;
  contractor?: RoutingContractor;
  lead?: CRMLead;
  lastSignalAt: number;
}

const DISPOSITION_META: Record<
  DispositionKey,
  { label: string; icon: React.ReactNode; describe: string }
> = {
  sent_not_viewed: {
    label: "Sent, not viewed",
    icon: <Send className="h-4 w-4" />,
    describe: "Route sent but no viewed_at signal yet.",
  },
  viewed_not_responded: {
    label: "Viewed, not responded",
    icon: <Eye className="h-4 w-4" />,
    describe: "Contractor opened but has not responded.",
  },
  responded_not_interested: {
    label: "Responded, not interested",
    icon: <MessageSquare className="h-4 w-4" />,
    describe: "Contractor responded but did not mark interest.",
  },
  interested_not_booked: {
    label: "Interested, not booked",
    icon: <ThumbsUp className="h-4 w-4" />,
    describe: "Contractor expressed interest; no homeowner appointment yet.",
  },
  released: {
    label: "Contact released",
    icon: <Unlock className="h-4 w-4" />,
    describe: "Homeowner contact released to contractor.",
  },
  booked: {
    label: "Appointment booked",
    icon: <CheckCircle2 className="h-4 w-4" />,
    describe: "Homeowner appointment booked on the parent lead.",
  },
  closed: {
    label: "Closed",
    icon: <XCircle className="h-4 w-4" />,
    describe: "Lead has a closed_at or terminal deal_status.",
  },
  unresolved: {
    label: "Unresolved / needs review",
    icon: <HelpCircle className="h-4 w-4" />,
    describe: "Mixed or missing signals; operator judgment required.",
  },
};

export function ContractorFeedbackLoopSurface({ leads, onNavigateTab }: Props) {
  const [openSection, setOpenSection] = useState<Record<string, boolean>>({
    signals: true,
    disposition: true,
    missing: true,
    notes: true,
  });

  const toggleSection = useCallback((key: string) => {
    setOpenSection((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // ─── Repo-real reads ────────────────────────────────────────────────
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

  const oppsArr = (opps as RoutingOpportunity[] | undefined) ?? [];
  const routesArr = (routes as RoutingRoute[] | undefined) ?? [];
  const contractorsArr = (contractors as RoutingContractor[] | undefined) ?? [];

  // ─── Disposition bucketing (deterministic, operator-view) ───────────
  // For each route, classify into ONE bucket using real fields with this
  // precedence (most-progressed wins, except "closed" which trumps all):
  //
  //   closed       = lead.closed_at OR lead.deal_status in ('dead','won','lost')
  //   booked       = lead.appointment_booked_at present
  //   released     = route.contact_released OR route.contact_released_at
  //                  OR route.release_status === 'approved'
  //   interested_not_booked      = route.interested_at present
  //   responded_not_interested   = route.responded_at present
  //   viewed_not_responded       = route.viewed_at present
  //   sent_not_viewed            = route.sent_at present
  //   unresolved   = none of the above signals present (e.g. suggested-only,
  //                  or route_status mismatch with timestamps)
  const computed = useMemo(() => {
    const oppById = new Map(oppsArr.map((o) => [o.id, o]));
    const contractorById = new Map(contractorsArr.map((c) => [c.id, c]));
    const leadById = new Map(leads.map((l) => [l.id, l]));

    const rows: DispositionRow[] = [];
    const counts: Record<DispositionKey, number> = {
      sent_not_viewed: 0,
      viewed_not_responded: 0,
      responded_not_interested: 0,
      interested_not_booked: 0,
      released: 0,
      booked: 0,
      closed: 0,
      unresolved: 0,
    };

    let totalSent = 0;
    let totalViewed = 0;
    let totalResponded = 0;
    let totalInterested = 0;
    let totalReleased = 0;
    let totalBooked = 0;
    let totalClosed = 0;

    for (const route of routesArr) {
      const opp = oppById.get(route.opportunity_id);
      if (!opp) continue;

      const lead = leadById.get(opp.lead_id);
      const contractor = contractorById.get(route.contractor_id);

      const tStamps: number[] = [];
      const push = (v: string | null | undefined) => {
        if (v) {
          const t = new Date(v).getTime();
          if (!Number.isNaN(t)) tStamps.push(t);
        }
      };
      push(route.sent_at);
      push(route.viewed_at);
      push(route.responded_at);
      push(route.interested_at);
      push(route.contact_released_at);
      push(lead?.appointment_booked_at);
      push(lead?.closed_at);
      const lastSignalAt = tStamps.length ? Math.max(...tStamps) : 0;

      // Tally raw signal totals (a route can advance through several stages)
      if (route.sent_at) totalSent++;
      if (route.viewed_at) totalViewed++;
      if (route.responded_at) totalResponded++;
      if (route.interested_at) totalInterested++;
      if (route.contact_released || route.contact_released_at) totalReleased++;
      if (lead?.appointment_booked_at) totalBooked++;
      const isClosed =
        !!lead?.closed_at ||
        ["dead", "won", "lost"].includes(String(lead?.deal_status ?? ""));
      if (isClosed) totalClosed++;

      // Bucket assignment (precedence: closed > booked > released > interested
      //                    > responded > viewed > sent > unresolved)
      let bucket: DispositionKey = "unresolved";
      let reason = "no contractor-side signals on this route";

      if (isClosed) {
        bucket = "closed";
        reason = lead?.closed_at
          ? "lead.closed_at present"
          : `lead.deal_status = ${lead?.deal_status}`;
      } else if (lead?.appointment_booked_at) {
        bucket = "booked";
        reason = "lead.appointment_booked_at present";
      } else if (
        route.contact_released ||
        route.contact_released_at ||
        route.release_status === "approved"
      ) {
        bucket = "released";
        reason = route.contact_released_at
          ? "route.contact_released_at present"
          : "release_status = approved";
      } else if (route.interested_at) {
        bucket = "interested_not_booked";
        reason = "interested_at present, no booking yet";
      } else if (route.responded_at) {
        bucket = "responded_not_interested";
        reason = "responded_at present, no interested_at";
      } else if (route.viewed_at) {
        bucket = "viewed_not_responded";
        reason = "viewed_at present, no responded_at";
      } else if (route.sent_at) {
        bucket = "sent_not_viewed";
        reason = "sent_at present, no viewed_at";
      }

      counts[bucket]++;
      rows.push({
        bucket,
        reason,
        route,
        opportunity: opp,
        contractor,
        lead,
        lastSignalAt,
      });
    }

    return {
      rows,
      counts,
      signals: {
        totalRoutes: routesArr.length,
        totalSent,
        totalViewed,
        totalResponded,
        totalInterested,
        totalReleased,
        totalBooked,
        totalClosed,
      },
    };
  }, [routesArr, oppsArr, contractorsArr, leads]);

  // Missing-feedback queue: routes where contractor-side signal is incomplete
  // and the route is not yet booked/closed. Sorted by oldest-stale-first.
  const missingFeedback = useMemo(() => {
    const target: DispositionKey[] = [
      "sent_not_viewed",
      "viewed_not_responded",
      "responded_not_interested",
      "interested_not_booked",
      "unresolved",
    ];
    return computed.rows
      .filter((r) => target.includes(r.bucket))
      .sort((a, b) => a.lastSignalAt - b.lastSignalAt)
      .slice(0, 30);
  }, [computed.rows]);

  const copyText = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  }, []);

  const summaryText = useMemo(() => {
    const c = computed.counts;
    const s = computed.signals;
    return [
      `WindowMan — Contractor Feedback Snapshot (operator)`,
      ``,
      `Routes total:      ${s.totalRoutes}`,
      `  sent:            ${s.totalSent}`,
      `  viewed:          ${s.totalViewed}`,
      `  responded:       ${s.totalResponded}`,
      `  interested:      ${s.totalInterested}`,
      `  released:        ${s.totalReleased}`,
      `  booked:          ${s.totalBooked}`,
      `  closed:          ${s.totalClosed}`,
      ``,
      `Disposition (one bucket per route):`,
      `  sent, not viewed:           ${c.sent_not_viewed}`,
      `  viewed, not responded:      ${c.viewed_not_responded}`,
      `  responded, not interested:  ${c.responded_not_interested}`,
      `  interested, not booked:     ${c.interested_not_booked}`,
      `  released:                   ${c.released}`,
      `  booked:                     ${c.booked}`,
      `  closed:                     ${c.closed}`,
      `  unresolved / needs review:  ${c.unresolved}`,
      ``,
      `Notes: All buckets are operator-view derivations from real route /`,
      `lead fields. There is no automated contractor reminder, no portal,`,
      `and no CRM sync. Missing signals do not imply contractor failure.`,
    ].join("\n");
  }, [computed]);

  const goTab = useCallback(
    (tab: string) => {
      if (onNavigateTab) onNavigateTab(tab);
      else toast.info(`Open the “${tab}” tab to continue`);
    },
    [onNavigateTab]
  );

  const isLoading = oppsLoading || routesLoading;

  if (isLoading && computed.rows.length === 0) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <Inbox className="h-5 w-5 text-primary" />
              Contractor Feedback Loop
            </h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
              Internal operator surface for contractor-side response and
              disposition signals on routed opportunities. Read-only. All
              groupings are deterministic operator-view derivations from real
              route and lead fields — no contractor portal, no CRM sync, no
              automated reminders.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-[10px] uppercase tracking-wider"
            >
              Internal · Operator Use
            </Badge>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => copyText(summaryText, "Feedback summary")}
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Copy Summary
            </Button>
          </div>
        </div>
      </div>

      {/* ── Known Feedback Signals ───────────────────────────────── */}
      <Card>
        <CardHeader
          className="pb-3 cursor-pointer select-none"
          onClick={() => toggleSection("signals")}
        >
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="h-4 w-4" />
            Known Feedback Signals
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-normal ml-1">
              raw counts
            </span>
            <ChevronRight
              className={`h-4 w-4 ml-auto transition-transform ${
                openSection.signals ? "rotate-90" : ""
              }`}
            />
          </CardTitle>
          <p className="text-[11px] text-muted-foreground mt-1">
            Per-route signal totals. A single route can advance through several
            stages, so totals overlap (a viewed route is also a sent route).
          </p>
        </CardHeader>
        {openSection.signals && (
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Routes total" value={computed.signals.totalRoutes} />
            <Stat label="Sent" value={computed.signals.totalSent} />
            <Stat label="Viewed" value={computed.signals.totalViewed} />
            <Stat label="Responded" value={computed.signals.totalResponded} />
            <Stat label="Interested" value={computed.signals.totalInterested} />
            <Stat label="Released" value={computed.signals.totalReleased} />
            <Stat label="Booked" value={computed.signals.totalBooked} />
            <Stat label="Closed" value={computed.signals.totalClosed} />
          </CardContent>
        )}
      </Card>

      {/* ── Disposition Breakdown ────────────────────────────────── */}
      <Card>
        <CardHeader
          className="pb-3 cursor-pointer select-none"
          onClick={() => toggleSection("disposition")}
        >
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Disposition Breakdown
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-normal ml-1">
              one bucket per route
            </span>
            <ChevronRight
              className={`h-4 w-4 ml-auto transition-transform ${
                openSection.disposition ? "rotate-90" : ""
              }`}
            />
          </CardTitle>
          <p className="text-[11px] text-muted-foreground mt-1">
            Each route is assigned exactly one most-progressed bucket. Closed
            and Booked trump all earlier signals.
          </p>
        </CardHeader>
        {openSection.disposition && (
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(Object.keys(DISPOSITION_META) as DispositionKey[]).map((key) => (
              <DispositionRowCard
                key={key}
                meta={DISPOSITION_META[key]}
                count={computed.counts[key]}
              />
            ))}
          </CardContent>
        )}
      </Card>

      {/* ── Missing Feedback / Needs Review ──────────────────────── */}
      <Card>
        <CardHeader
          className="pb-3 cursor-pointer select-none"
          onClick={() => toggleSection("missing")}
        >
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            Missing Feedback / Needs Operator Review
            <Badge variant="outline" className="ml-2 h-5 text-[10px]">
              {missingFeedback.length}
            </Badge>
            <ChevronRight
              className={`h-4 w-4 ml-auto transition-transform ${
                openSection.missing ? "rotate-90" : ""
              }`}
            />
          </CardTitle>
          <p className="text-[11px] text-muted-foreground mt-1">
            Routes where contractor-side feedback is incomplete and the lead
            is not yet booked or closed. Oldest signal first. Open the
            opportunity in Routing Desk to act.
          </p>
        </CardHeader>
        {openSection.missing && (
          <CardContent>
            {missingFeedback.length === 0 ? (
              <div className="text-xs text-muted-foreground py-6 text-center">
                No incomplete contractor feedback right now.
              </div>
            ) : (
              <div className="divide-y divide-border rounded-md border">
                {missingFeedback.map((r) => {
                  const homeownerName =
                    [r.lead?.first_name, r.lead?.last_name]
                      .filter(Boolean)
                      .join(" ") || "Unnamed lead";
                  const contractorName =
                    r.contractor?.company_name ?? "Unknown contractor";
                  const county = r.opportunity.county || "Unknown County";
                  const ageHours = r.lastSignalAt
                    ? Math.round((Date.now() - r.lastSignalAt) / 36e5)
                    : null;
                  const meta = DISPOSITION_META[r.bucket];
                  return (
                    <div
                      key={r.route.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {homeownerName}{" "}
                          <span className="text-muted-foreground font-normal">
                            → {contractorName}
                          </span>
                        </div>
                        <div className="text-muted-foreground truncate">
                          {county} · {meta.label} · {r.reason}
                          {ageHours !== null &&
                            ` · ${ageHours}h since last signal`}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[11px] shrink-0"
                        onClick={() => goTab("routing")}
                      >
                        Open in Routing
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* ── What We Know vs What We Do Not Know ──────────────────── */}
      <Card>
        <CardHeader
          className="pb-3 cursor-pointer select-none"
          onClick={() => toggleSection("notes")}
        >
          <CardTitle className="text-sm flex items-center gap-2">
            <XCircle className="h-4 w-4 text-muted-foreground" />
            What We Know vs What We Do Not Know
          </CardTitle>
        </CardHeader>
        {openSection.notes && (
          <CardContent className="text-xs text-muted-foreground leading-relaxed space-y-2">
            <p>
              <strong>Modeled today:</strong> route-level{" "}
              <code className="px-1 rounded bg-muted">sent_at</code>,{" "}
              <code className="px-1 rounded bg-muted">viewed_at</code>,{" "}
              <code className="px-1 rounded bg-muted">responded_at</code>,{" "}
              <code className="px-1 rounded bg-muted">interested_at</code>,{" "}
              <code className="px-1 rounded bg-muted">contact_released_at</code>,{" "}
              <code className="px-1 rounded bg-muted">release_status</code>;
              lead-level{" "}
              <code className="px-1 rounded bg-muted">appointment_booked_at</code>,{" "}
              <code className="px-1 rounded bg-muted">closed_at</code>,{" "}
              <code className="px-1 rounded bg-muted">deal_status</code>.
            </p>
            <p>
              <strong>Operator-derived (not stored):</strong> the disposition
              bucket and the “missing feedback” queue are computed in the
              browser from the fields above. They are not backend statuses
              and do not write anywhere.
            </p>
            <p>
              <strong>Not modeled:</strong> contractor-side notes,
              call-attempt counts, scheduling conversations, no-show events,
              homeowner sentiment, or any contractor performance grade.
              Anything not in the fields above is unknown to the system.
            </p>
            <p>
              <strong>What this surface does NOT claim:</strong> contractor
              compliance, automated reminders, CRM sync, or predictive
              scoring. Missing signals do not imply contractor failure —
              they only mean the system has not observed a signal yet.
            </p>
          </CardContent>
        )}
      </Card>

      {/* ── Quick Links ──────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            Quick Links
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <QuickLink label="Routing Desk" onClick={() => goTab("routing")} />
          <QuickLink label="Active Pipeline" onClick={() => goTab("pipeline")} />
          <QuickLink label="Outcome Tracking" onClick={() => goTab("outcomes")} />
          <QuickLink label="Lifecycle" onClick={() => goTab("lifecycle")} />
          <QuickLink label="Operator Reporting" onClick={() => goTab("reporting")} />
          <QuickLink label="Onboarding" onClick={() => goTab("onboarding")} />
          <QuickLink label="Launch Control" onClick={() => goTab("launch")} />
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Subcomponents ─────────────────────────────────────────────────── */

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <div className="text-2xl font-semibold leading-none text-foreground">
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
        {label}
      </div>
    </div>
  );
}

function DispositionRowCard({
  meta,
  count,
}: {
  meta: { label: string; icon: React.ReactNode; describe: string };
  count: number;
}) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{meta.icon}</span>
        <span className="text-sm font-medium">{meta.label}</span>
        <Badge variant="outline" className="ml-auto text-[10px]">
          {count}
        </Badge>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
        {meta.describe}
      </p>
    </div>
  );
}

function QuickLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onClick}>
      {label}
      <ChevronRight className="h-3 w-3 ml-1" />
    </Button>
  );
}
