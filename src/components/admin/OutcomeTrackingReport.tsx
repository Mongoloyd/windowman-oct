/**
 * ═══════════════════════════════════════════════════════════════════════════
 * OUTCOME TRACKING / CLOSE-LOOP REPORTING — Phase 11
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Internal operator-facing surface to understand what happened after routing.
 * Pure read-only:
 *
 *   • Outcome Summary — repo-real counts + clearly-labeled operator-view
 *     derivations
 *   • Post-Route Status Breakdown — buckets by route lifecycle field state
 *   • Unresolved / Needs Attention — derived priority lists
 *   • Close-Loop Reporting — honest known-vs-unknown summary
 *   • Quick Links — read-only navigation to existing surfaces
 *
 * STRICT CONSTRAINTS (Phase 11):
 *   • No new endpoints, no new types in shared files.
 *   • No backend persistence.
 *   • No invented metrics, no ROI/revenue/close-rate hype.
 *   • Reuses fetchOpportunities/fetchRoutes/fetchContractors via TanStack Query.
 *
 * DERIVATION NOTES (operator-view, frontend-only):
 *   • "Sent, not viewed"          → route.sent_at AND NOT route.viewed_at
 *   • "Viewed, no response"       → route.viewed_at AND NOT route.responded_at
 *   • "Responded, not interested" → route.responded_at AND NOT route.interested_at
 *   • "Interested, not booked"    → route.interested_at AND NOT lead.appointment_booked_at
 *   • "Released"                  → route.contact_released OR release_status='approved'
 *   • "Booked"                    → lead.appointment_booked_at IS NOT NULL
 *   • "Closed"                    → lead.closed_at IS NOT NULL OR opp.status='closed'
 *   • "Dead"                      → opp.status='dead' OR lead.deal_status='dead'
 *   • "Stale (operator view)"     → routed >STALE_HOURS ago, no booking, no closed/dead
 *   • "Unresolved"                → routed exists, no terminal outcome (booked/closed/dead) yet
 */

import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  FileBarChart,
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
  fetchOpportunities,
  fetchRoutes,
  fetchContractors,
} from "@/services/adminDataService";
import type {
  RoutingOpportunity,
  RoutingRoute,
  RoutingContractor,
} from "@/types/routingDesk";
import type { CRMLead } from "@/components/admin/types";

export const STALE_HOURS = 72;

// ─── Helpers ───────────────────────────────────────────────────────────

export function hoursSince(ts: string | null | undefined): number | null {
  if (!ts) return null;
  const t = new Date(ts).getTime();
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / (1000 * 60 * 60);
}

export function pickLatestRoute(routes: RoutingRoute[]): RoutingRoute | null {
  if (routes.length === 0) return null;
  return [...routes].sort((a, b) => {
    const at = a.sent_at ?? a.created_at;
    const bt = b.sent_at ?? b.created_at;
    return new Date(bt).getTime() - new Date(at).getTime();
  })[0];
}

// ─── Per-opportunity derivation (operator-view, frontend-only) ────────

export type PostRouteBucket =
  | "sent_not_viewed"
  | "viewed_no_response"
  | "responded_not_interested"
  | "interested_not_booked"
  | "released"
  | "booked"
  | "closed"
  | "dead"
  | "stale_unresolved";

interface OutcomeRow {
  opp: RoutingOpportunity;
  latestRoute: RoutingRoute | null;
  contractor: RoutingContractor | null;
  lead: CRMLead | null;
  bucket: PostRouteBucket | null; // null = pre-route (no route yet)
  isUnresolved: boolean;
  ageHours: number | null;
}

export function deriveBucket(
  opp: RoutingOpportunity,
  latestRoute: RoutingRoute | null,
  lead: CRMLead | null,
): { bucket: PostRouteBucket | null; isUnresolved: boolean } {
  // Terminal outcomes first
  if (opp.status === "dead" || lead?.deal_status === "dead") {
    return { bucket: "dead", isUnresolved: false };
  }
  if (lead?.closed_at || opp.status === "closed") {
    return { bucket: "closed", isUnresolved: false };
  }
  if (lead?.appointment_booked_at) {
    return { bucket: "booked", isUnresolved: false };
  }

  if (!latestRoute) {
    // No route yet — not part of post-route reporting
    return { bucket: null, isUnresolved: false };
  }

  if (
    latestRoute.contact_released ||
    latestRoute.release_status === "approved"
  ) {
    return { bucket: "released", isUnresolved: true };
  }

  if (latestRoute.interested_at) {
    return { bucket: "interested_not_booked", isUnresolved: true };
  }

  if (latestRoute.responded_at) {
    return { bucket: "responded_not_interested", isUnresolved: true };
  }

  if (latestRoute.viewed_at) {
    return { bucket: "viewed_no_response", isUnresolved: true };
  }

  if (latestRoute.sent_at) {
    const ageH = hoursSince(latestRoute.sent_at) ?? 0;
    if (ageH >= STALE_HOURS) {
      return { bucket: "stale_unresolved", isUnresolved: true };
    }
    return { bucket: "sent_not_viewed", isUnresolved: true };
  }

  return { bucket: null, isUnresolved: false };
}

const BUCKET_META: Record<
  PostRouteBucket,
  { label: string; icon: React.ElementType; tone: string }
> = {
  sent_not_viewed: {
    label: "Sent, not viewed",
    icon: Send,
    tone: "border-cyan-500/30 bg-cyan-500/5",
  },
  viewed_no_response: {
    label: "Viewed, no response",
    icon: Eye,
    tone: "border-amber-500/30 bg-amber-500/5",
  },
  responded_not_interested: {
    label: "Responded, not interested",
    icon: MessageSquare,
    tone: "border-amber-500/30 bg-amber-500/5",
  },
  interested_not_booked: {
    label: "Interested, not booked",
    icon: ThumbsUp,
    tone: "border-emerald-500/30 bg-emerald-500/5",
  },
  released: {
    label: "Contact released",
    icon: Unlock,
    tone: "border-emerald-500/30 bg-emerald-500/5",
  },
  booked: {
    label: "Booked",
    icon: CheckCircle2,
    tone: "border-emerald-500/30 bg-emerald-500/5",
  },
  closed: {
    label: "Closed",
    icon: CheckCircle2,
    tone: "border-border bg-card",
  },
  dead: {
    label: "Dead",
    icon: XCircle,
    tone: "border-destructive/30 bg-destructive/5",
  },
  stale_unresolved: {
    label: "Stale / unresolved",
    icon: Clock,
    tone: "border-amber-500/30 bg-amber-500/5",
  },
};

// ─── Operator reporting snippets ──────────────────────────────────────

const REPORTING_SNIPPETS: { id: string; label: string; build: (s: Summary) => string }[] = [
  {
    id: "weekly_recap",
    label: "Weekly outcome recap (template)",
    build: (s) =>
      `Pilot outcome recap (last update):\n` +
      `• Routed: ${s.routedCount}\n` +
      `• Viewed: ${s.viewedCount}\n` +
      `• Responded: ${s.respondedCount}\n` +
      `• Interested: ${s.interestedCount}\n` +
      `• Released: ${s.releasedCount}\n` +
      `• Booked: ${s.bookedCount}\n` +
      `• Closed: ${s.closedCount}\n` +
      `• Unresolved: ${s.unresolvedCount}\n` +
      `• Stale (op-view): ${s.staleCount}`,
  },
  {
    id: "contractor_followup",
    label: "Contractor follow-up note",
    build: (s) =>
      `Quick follow-up: ${s.unresolvedCount} routed opportunit${s.unresolvedCount === 1 ? "y is" : "ies are"} ` +
      `still open. ${s.staleCount} are stale (no movement in >${STALE_HOURS}h). ` +
      `Can we walk through them and close the loop?`,
  },
];

// ─── Component ─────────────────────────────────────────────────────────

interface Props {
  leads: CRMLead[];
  onNavigateTab?: (tab: string) => void;
}

interface Summary {
  totalOpportunities: number;
  routedCount: number;
  viewedCount: number;
  respondedCount: number;
  interestedCount: number;
  releasedCount: number;
  bookedCount: number;
  closedCount: number;
  deadCount: number;
  unresolvedCount: number;
  staleCount: number;
}

export function OutcomeTrackingReport({ leads, onNavigateTab }: Props) {
  // Reuse centralized admin data fetchers (TanStack Query, bearer-tokened).
  const oppsQuery = useQuery({
    queryKey: ["admin", "opportunities"],
    queryFn: fetchOpportunities,
    staleTime: 30_000,
  });
  const routesQuery = useQuery({
    queryKey: ["admin", "routes", "all"],
    queryFn: () => fetchRoutes(),
    staleTime: 30_000,
  });
  const contractorsQuery = useQuery({
    queryKey: ["admin", "contractors"],
    queryFn: fetchContractors,
    staleTime: 60_000,
  });

  const isLoading =
    oppsQuery.isLoading || routesQuery.isLoading || contractorsQuery.isLoading;
  const hasError =
    oppsQuery.isError || routesQuery.isError || contractorsQuery.isError;

  const leadsById = useMemo(() => {
    const m = new Map<string, CRMLead>();
    for (const l of leads) m.set(l.id, l);
    return m;
  }, [leads]);

  const routesByOpp = useMemo(() => {
    const m = new Map<string, RoutingRoute[]>();
    const all = (routesQuery.data ?? []) as RoutingRoute[];
    for (const r of all) {
      const arr = m.get(r.opportunity_id) ?? [];
      arr.push(r);
      m.set(r.opportunity_id, arr);
    }
    return m;
  }, [routesQuery.data]);

  const contractorsById = useMemo(() => {
    const m = new Map<string, RoutingContractor>();
    for (const c of (contractorsQuery.data ?? []) as RoutingContractor[]) {
      m.set(c.id, c);
    }
    return m;
  }, [contractorsQuery.data]);

  const rows: OutcomeRow[] = useMemo(() => {
    const opps = (oppsQuery.data ?? []) as RoutingOpportunity[];
    return opps.map((opp) => {
      const oppRoutes = routesByOpp.get(opp.id) ?? [];
      const latestRoute = pickLatestRoute(oppRoutes);
      const contractor = latestRoute
        ? contractorsById.get(latestRoute.contractor_id) ?? null
        : null;
      const lead = leadsById.get(opp.lead_id) ?? null;
      const { bucket, isUnresolved } = deriveBucket(opp, latestRoute, lead);
      const ageHours = hoursSince(
        latestRoute?.sent_at ?? opp.routed_at ?? opp.updated_at,
      );
      return { opp, latestRoute, contractor, lead, bucket, isUnresolved, ageHours };
    });
  }, [oppsQuery.data, routesByOpp, contractorsById, leadsById]);

  const summary: Summary = useMemo(() => {
    let routed = 0;
    let viewed = 0;
    let responded = 0;
    let interested = 0;
    let released = 0;
    let booked = 0;
    let closed = 0;
    let dead = 0;
    let unresolved = 0;
    let stale = 0;

    for (const r of rows) {
      if (!r.latestRoute) continue;
      if (r.latestRoute.sent_at) routed++;
      if (r.latestRoute.viewed_at) viewed++;
      if (r.latestRoute.responded_at) responded++;
      if (r.latestRoute.interested_at) interested++;
      if (
        r.latestRoute.contact_released ||
        r.latestRoute.release_status === "approved"
      )
        released++;
      if (r.bucket === "booked") booked++;
      if (r.bucket === "closed") closed++;
      if (r.bucket === "dead") dead++;
      if (r.isUnresolved) unresolved++;
      if (r.bucket === "stale_unresolved") stale++;
    }

    return {
      totalOpportunities: rows.length,
      routedCount: routed,
      viewedCount: viewed,
      respondedCount: responded,
      interestedCount: interested,
      releasedCount: released,
      bookedCount: booked,
      closedCount: closed,
      deadCount: dead,
      unresolvedCount: unresolved,
      staleCount: stale,
    };
  }, [rows]);

  const breakdown = useMemo(() => {
    const counts: Record<PostRouteBucket, OutcomeRow[]> = {
      sent_not_viewed: [],
      viewed_no_response: [],
      responded_not_interested: [],
      interested_not_booked: [],
      released: [],
      booked: [],
      closed: [],
      dead: [],
      stale_unresolved: [],
    };
    for (const r of rows) {
      if (r.bucket) counts[r.bucket].push(r);
    }
    return counts;
  }, [rows]);

  const needsAttention = useMemo(() => {
    return rows
      .filter((r) => r.isUnresolved)
      .sort((a, b) => (b.ageHours ?? 0) - (a.ageHours ?? 0))
      .slice(0, 10);
  }, [rows]);

  const copySnippet = useCallback(
    async (body: string, label: string) => {
      try {
        await navigator.clipboard.writeText(body);
        toast.success(`Copied: ${label}`);
      } catch {
        toast.error("Clipboard unavailable");
      }
    },
    [],
  );

  return (
    <div className="w-full space-y-6">
      {/* ── Header ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <FileBarChart className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-bold tracking-tight">
              Outcome Tracking — Close-Loop Reporting
            </CardTitle>
            <Badge variant="outline" className="text-[10px]">
              Internal · Read-only
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            What happened after routing. All counts come from repo-real
            opportunity, route, and lead lifecycle fields. Operator-view
            groupings (unresolved / stale) are deterministic frontend
            derivations from those same fields — no backend writes.
          </p>
        </CardHeader>
      </Card>

      {/* ── Loading / Error ───────────────────────────────────────── */}
      {isLoading && (
        <Card>
          <CardContent className="py-6 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      )}

      {hasError && (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Failed to load outcome data. Centralized admin fetchers may need
              re-auth — check the Command Center.
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && !hasError && (
        <>
          {/* ── Outcome Summary ──────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <SummaryTile label="Routed" value={summary.routedCount} icon={Send} />
            <SummaryTile label="Viewed" value={summary.viewedCount} icon={Eye} />
            <SummaryTile
              label="Responded"
              value={summary.respondedCount}
              icon={MessageSquare}
            />
            <SummaryTile
              label="Interested"
              value={summary.interestedCount}
              icon={ThumbsUp}
            />
            <SummaryTile
              label="Released"
              value={summary.releasedCount}
              icon={Unlock}
              accent="emerald"
            />
            <SummaryTile
              label="Booked"
              value={summary.bookedCount}
              icon={CheckCircle2}
              accent="emerald"
            />
            <SummaryTile
              label="Closed"
              value={summary.closedCount}
              icon={CheckCircle2}
            />
            <SummaryTile label="Dead" value={summary.deadCount} icon={XCircle} accent="danger" />
            <SummaryTile
              label="Unresolved"
              value={summary.unresolvedCount}
              icon={AlertTriangle}
              accent="amber"
              hint="op-view"
            />
            <SummaryTile
              label="Stale"
              value={summary.staleCount}
              icon={Clock}
              accent="amber"
              hint={`>${STALE_HOURS}h, op-view`}
            />
          </div>

          {/* ── Post-Route Status Breakdown ──────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Post-Route Status Breakdown
              </CardTitle>
              <p className="text-[11px] text-muted-foreground mt-1">
                Each opportunity is bucketed by its latest route's lifecycle
                fields. Buckets are mutually exclusive per opportunity.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {(Object.keys(breakdown) as PostRouteBucket[]).map((key) => {
                  const meta = BUCKET_META[key];
                  const Icon = meta.icon;
                  const count = breakdown[key].length;
                  return (
                    <div
                      key={key}
                      className={`rounded-lg border p-3 flex items-center justify-between gap-3 ${meta.tone}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-xs font-medium truncate">
                          {meta.label}
                        </span>
                      </div>
                      <span className="text-lg font-bold tabular-nums shrink-0">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* ── Unresolved / Needs Attention ─────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Unresolved / Needs Attention
                  </CardTitle>
                </div>
                <Badge variant="outline" className="text-[10px] tabular-nums">
                  {summary.unresolvedCount} unresolved
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Routed opportunities with no terminal outcome (booked / closed
                / dead). Top 10 by oldest activity.
              </p>
            </CardHeader>
            <CardContent>
              {needsAttention.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nothing unresolved right now.
                </p>
              ) : (
                <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                  {needsAttention.map((row) => (
                    <UnresolvedRow key={row.opp.id} row={row} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Close-Loop Reporting ──────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Close-Loop Reporting
              </CardTitle>
              <p className="text-[11px] text-muted-foreground mt-1">
                Honest, current-state summary. No revenue math, no projected
                close rates.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <ReportRow
                  title="What is clearly known"
                  body={
                    `${summary.routedCount} routed · ${summary.viewedCount} viewed · ` +
                    `${summary.respondedCount} responded · ${summary.interestedCount} interested · ` +
                    `${summary.releasedCount} released · ${summary.bookedCount} booked · ` +
                    `${summary.closedCount} closed · ${summary.deadCount} dead.`
                  }
                />
                <ReportRow
                  title="What is unresolved"
                  body={
                    `${summary.unresolvedCount} routed opportunities have no terminal ` +
                    `outcome yet. ${summary.staleCount} of those have had no route ` +
                    `activity in >${STALE_HOURS}h (operator-view stale).`
                  }
                />
                <ReportRow
                  title="What is unknown today"
                  body={
                    `Outcomes that depend on contractor self-reporting (final ` +
                    `appointment status, deal value, won/lost) are only as good ` +
                    `as what the operator records via the Lead Dossier. ` +
                    `Automated capture is future direction.`
                  }
                />
                <ReportRow
                  title="How to read these numbers"
                  body={
                    `Lifecycle counts are non-exclusive (e.g. a booked lead was ` +
                    `also routed, viewed, responded, interested). Bucket counts ` +
                    `above are exclusive per opportunity.`
                  }
                />
              </div>

              <div className="mt-4 space-y-2">
                {REPORTING_SNIPPETS.map((s) => {
                  const body = s.build(summary);
                  return (
                    <div
                      key={s.id}
                      className="rounded-lg border border-border bg-card p-3 flex items-start gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{s.label}</p>
                        <pre className="text-xs text-muted-foreground mt-1 leading-relaxed whitespace-pre-wrap font-sans">
                          {body}
                        </pre>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 shrink-0"
                        onClick={() => copySnippet(body, s.label)}
                      >
                        <Copy className="h-3.5 w-3.5 mr-1.5" />
                        Copy
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* ── Quick Links ──────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Quick Links
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                <QuickLink label="Routing Desk" tab="routing" onNavigateTab={onNavigateTab} />
                <QuickLink label="Active Pipeline" tab="pipeline" onNavigateTab={onNavigateTab} />
                <QuickLink label="Launch Control" tab="launch" onNavigateTab={onNavigateTab} />
                <QuickLink label="Pilot Readiness" tab="pilot" onNavigateTab={onNavigateTab} />
                <QuickLink label="Command Center" tab="command" onNavigateTab={onNavigateTab} />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

/* ── Subcomponents ──────────────────────────────────────────────────── */

function SummaryTile({
  label,
  value,
  icon: Icon,
  accent = "neutral",
  hint,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  accent?: "neutral" | "emerald" | "amber" | "danger";
  hint?: string;
}) {
  const accentClass =
    accent === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : accent === "amber"
        ? "border-amber-500/30 bg-amber-500/5"
        : accent === "danger"
          ? "border-destructive/30 bg-destructive/5"
          : "border-border bg-card";
  return (
    <div className={`rounded-lg border p-3 flex flex-col gap-1 ${accentClass}`}>
      <div className="flex items-center justify-between gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-2xl font-bold tabular-nums leading-none">
          {value}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
          {label}
        </p>
        {hint && (
          <span className="text-[9px] text-muted-foreground italic">{hint}</span>
        )}
      </div>
    </div>
  );
}

function UnresolvedRow({ row }: { row: OutcomeRow }) {
  const meta = row.bucket ? BUCKET_META[row.bucket] : null;
  const name =
    [row.lead?.first_name, row.lead?.last_name].filter(Boolean).join(" ") ||
    "Unnamed lead";
  const hours = row.ageHours;
  return (
    <div className="px-3 py-2.5 bg-card flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate">{name}</p>
          {meta && (
            <Badge variant="outline" className="text-[10px]">
              {meta.label}
            </Badge>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
          {row.opp.county || row.lead?.county || "Unknown county"}
          {row.contractor ? ` · ${row.contractor.company_name}` : ""}
          {hours !== null ? ` · ${hours.toFixed(0)}h since last activity` : ""}
        </p>
      </div>
    </div>
  );
}

function ReportRow({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
        {body}
      </p>
    </div>
  );
}

function QuickLink({
  label,
  tab,
  onNavigateTab,
}: {
  label: string;
  tab: string;
  onNavigateTab?: (tab: string) => void;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-9 justify-between text-xs"
      onClick={() => onNavigateTab?.(tab)}
      disabled={!onNavigateTab}
    >
      <span className="truncate">{label}</span>
      <ExternalLink className="h-3 w-3 shrink-0 ml-1.5" />
    </Button>
  );
}
