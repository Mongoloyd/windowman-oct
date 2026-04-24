/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MASTER COMMAND CENTER — Phase 25: Final Synthesis
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * One operator screen that compresses the highest-signal truth from the
 * existing admin system. Pure read-and-compose: no new edge functions,
 * no schema changes, no fabricated metrics.
 *
 * Composes:
 *   • Lead-level lifecycle counts (repo-real timestamps on `leads`)
 *   • LaunchReadiness-style health signals (operational/attention/unknown)
 *   • MarketOpsFeed (existing global event feed)
 *   • DataQualityFieldIntegrity classifier (sparse field roll-up)
 *   • OutcomeTrackingReport bucket derivation (revenue-integrity roll-up)
 *   • Webhook delivery health (already loaded by AdminDashboard)
 *
 * Quick actions navigate to existing surfaces via onNavigateTab() or <Link>.
 *
 * Single question this screen must answer instantly:
 *   "Is the business healthy right now, and where do I need to act next?"
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Database,
  ExternalLink,
  FileBarChart,
  HelpCircle,
  Inbox,
  MapPin,
  Route as RouteIcon,
  ScanSearch,
  Send,
  Settings,
  ShieldCheck,
  Target,
  Unlock,
  Users,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
import type { CRMLead, WebhookDelivery } from "@/components/admin/types";

import { MarketOpsFeed } from "@/components/admin/MarketOpsFeed";
import { classify, nonEmpty } from "@/components/admin/DataQualityFieldIntegritySurface";
import {
  deriveBucket,
  pickLatestRoute,
  type PostRouteBucket,
} from "@/components/admin/OutcomeTrackingReport";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

interface MasterCommandCenterProps {
  leads: CRMLead[];
  deliveries: WebhookDelivery[];
  ghosts: CRMLead[];
  needsReviewCount: number;
  onNavigateTab: (tab: string) => void;
}

type ReadinessStatus = "operational" | "attention" | "unknown";

interface ReadinessSignal {
  key: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
}

/* ─── Tone tokens — semantic, never raw colors ───────────────────────── */
function toneForStatus(status: ReadinessStatus) {
  if (status === "operational") {
    return {
      badge:
        "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
      dot: "bg-emerald-500",
      icon: CheckCircle2,
    };
  }
  if (status === "attention") {
    return {
      badge:
        "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
      dot: "bg-amber-500",
      icon: AlertTriangle,
    };
  }
  return {
    badge: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground/40",
    icon: HelpCircle,
  };
}

/* ─── KPI tile ───────────────────────────────────────────────────────── */
interface KpiTileProps {
  label: string;
  value: number;
  hint: string;
  icon: typeof Activity;
}
function KpiTile({ label, value, hint, icon: Icon }: KpiTileProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-1.5">
        <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-2xl font-bold tabular-nums tracking-tight">
          {value.toLocaleString()}
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
          {hint}
        </p>
      </CardContent>
    </Card>
  );
}

/* ─── Helper: pct ────────────────────────────────────────────────────── */
function pct(n: number, d: number): number {
  if (d <= 0) return 0;
  return Math.round((n / d) * 100);
}

export function MasterCommandCenter({
  leads,
  deliveries,
  ghosts,
  needsReviewCount,
  onNavigateTab,
}: MasterCommandCenterProps) {
  /* ── Live reads (TanStack — same cache keys as other surfaces) ───── */
  const oppsQ = useQuery({
    queryKey: ["admin", "opportunities"],
    queryFn: fetchOpportunities,
    staleTime: 30_000,
  });
  const routesQ = useQuery({
    queryKey: ["admin", "routes", "all"],
    queryFn: () => fetchRoutes(),
    staleTime: 30_000,
  });
  const contractorsQ = useQuery({
    queryKey: ["admin", "contractors"],
    queryFn: fetchContractors,
    staleTime: 60_000,
  });

  const opps = (oppsQ.data as RoutingOpportunity[] | undefined) ?? [];
  const routes = (routesQ.data as RoutingRoute[] | undefined) ?? [];
  const contractors = (contractorsQ.data as RoutingContractor[] | undefined) ?? [];

  /* ── KPI funnel (lead-level repo-real timestamps) ────────────────── */
  const flow = useMemo(() => {
    let captured = 0;
    let verified = 0;
    let scanned = 0;
    let routed = 0;
    let booked = 0;
    let closed = 0;
    for (const l of leads) {
      captured++;
      if (l.phone_verified_at) verified++;
      if (l.latest_analysis_id) scanned++;
      if (l.routed_to_contractor_at) routed++;
      if (l.appointment_booked_at) booked++;
      if (l.closed_at) closed++;
    }
    return { captured, verified, scanned, routed, booked, closed };
  }, [leads]);

  /* ── Outcome bucket roll-up (revenue integrity) ──────────────────── */
  const outcomeRollup = useMemo(() => {
    const leadById = new Map(leads.map((l) => [l.id, l]));
    const routesByOpp = new Map<string, RoutingRoute[]>();
    for (const r of routes) {
      const arr = routesByOpp.get(r.opportunity_id) ?? [];
      arr.push(r);
      routesByOpp.set(r.opportunity_id, arr);
    }

    const counts: Record<PostRouteBucket, number> = {
      sent_not_viewed: 0,
      viewed_no_response: 0,
      responded_not_interested: 0,
      interested_not_booked: 0,
      released: 0,
      booked: 0,
      closed: 0,
      dead: 0,
      stale_unresolved: 0,
    };
    let unresolved = 0;
    let recentHandoffs = 0;
    const now = Date.now();

    for (const o of opps) {
      const oppRoutes = routesByOpp.get(o.id) ?? [];
      const latest = pickLatestRoute(oppRoutes);
      const lead = leadById.get(o.lead_id) ?? null;
      const { bucket, isUnresolved } = deriveBucket(o, latest, lead);
      if (bucket) counts[bucket]++;
      if (isUnresolved) unresolved++;

      // Recent handoffs (last 24h) — repo-real contact_released_at
      if (latest?.contact_released_at) {
        const t = new Date(latest.contact_released_at).getTime();
        if (!Number.isNaN(t) && now - t <= TWENTY_FOUR_HOURS_MS) {
          recentHandoffs++;
        }
      }
    }
    return { counts, unresolved, recentHandoffs };
  }, [opps, routes, leads]);

  /* ── Data quality roll-up (sparse field count across key surfaces) ─ */
  const dataQuality = useMemo(() => {
    // Lead-level critical fields
    const leadFields: Array<[string, (l: CRMLead) => unknown]> = [
      ["county", (l) => l.county],
      ["phone_e164", (l) => l.phone_e164],
      ["email", (l) => l.email],
      ["grade", (l) => l.grade],
      ["project_type", (l) => l.project_type],
    ];
    let sparse = 0;
    let partial = 0;
    let strong = 0;

    for (const [, get] of leadFields) {
      const present = leads.filter((l) => nonEmpty(get(l))).length;
      const c = classify(present, leads.length);
      if (c === "sparse") sparse++;
      else if (c === "partial") partial++;
      else if (c === "strong") strong++;
    }

    // Contractor-level (only fields surfaced by RoutingContractor type)
    if (contractors.length > 0) {
      const contractorFields: Array<(c: RoutingContractor) => unknown> = [
        (c) => c.email,
        (c) => c.contact_name,
      ];
      for (const get of contractorFields) {
        const present = contractors.filter((c) => nonEmpty(get(c))).length;
        const k = classify(present, contractors.length);
        if (k === "sparse") sparse++;
        else if (k === "partial") partial++;
        else if (k === "strong") strong++;
      }
    }

    // Fallback labels — leads missing county
    const missingCounty = leads.filter((l) => !nonEmpty(l.county)).length;
    // Linkage mismatches — opportunities whose lead_id is not in current leads
    const leadIds = new Set(leads.map((l) => l.id));
    const orphanedOpps = opps.filter((o) => !leadIds.has(o.lead_id)).length;

    return { sparse, partial, strong, missingCounty, orphanedOpps };
  }, [leads, contractors, opps]);

  /* ── Webhook health (already-loaded deliveries from dashboard) ───── */
  const webhook = useMemo(() => {
    const pending = deliveries.filter((d) => d.status === "pending").length;
    const failed = deliveries.filter((d) => d.status === "failed").length;
    const dead = deliveries.filter((d) => d.status === "dead_letter").length;
    const delivered = deliveries.filter((d) =>
      ["delivered", "mock_delivered"].includes(d.status),
    ).length;
    return { pending, failed, dead, delivered };
  }, [deliveries]);

  /* ── Readiness signal roll-up ────────────────────────────────────── */
  const signals: ReadinessSignal[] = useMemo(() => {
    const out: ReadinessSignal[] = [];

    // Contractors loaded + ≥1 active
    const activeContractors = contractors.filter((c) => c.status === "active").length;
    if (contractorsQ.isLoading) {
      out.push({
        key: "contractors",
        label: "Contractor roster",
        status: "unknown",
        detail: "Loading…",
      });
    } else if (activeContractors === 0) {
      out.push({
        key: "contractors",
        label: "Contractor roster",
        status: "attention",
        detail: "No active contractors found",
      });
    } else {
      out.push({
        key: "contractors",
        label: "Contractor roster",
        status: "operational",
        detail: `${activeContractors} active`,
      });
    }

    // Opportunities loaded
    if (oppsQ.isLoading) {
      out.push({
        key: "opps",
        label: "Opportunities feed",
        status: "unknown",
        detail: "Loading…",
      });
    } else if (oppsQ.isError) {
      out.push({
        key: "opps",
        label: "Opportunities feed",
        status: "attention",
        detail: "Read failed",
      });
    } else {
      out.push({
        key: "opps",
        label: "Opportunities feed",
        status: "operational",
        detail: `${opps.length} opportunities`,
      });
    }

    // Routes loaded
    if (routesQ.isLoading) {
      out.push({
        key: "routes",
        label: "Routing path",
        status: "unknown",
        detail: "Loading…",
      });
    } else if (routesQ.isError) {
      out.push({
        key: "routes",
        label: "Routing path",
        status: "attention",
        detail: "Read failed",
      });
    } else {
      out.push({
        key: "routes",
        label: "Routing path",
        status: "operational",
        detail: `${routes.length} routes`,
      });
    }

    // Webhook dead letter
    if (webhook.dead > 0) {
      out.push({
        key: "webhooks",
        label: "Webhook delivery",
        status: "attention",
        detail: `${webhook.dead} dead-letter, ${webhook.failed} failed`,
      });
    } else if (webhook.failed > 0) {
      out.push({
        key: "webhooks",
        label: "Webhook delivery",
        status: "attention",
        detail: `${webhook.failed} failed`,
      });
    } else {
      out.push({
        key: "webhooks",
        label: "Webhook delivery",
        status: "operational",
        detail: `${webhook.delivered} delivered, ${webhook.pending} pending`,
      });
    }

    // Ghost rate
    const ghostRate = pct(ghosts.length, flow.scanned);
    if (flow.scanned === 0) {
      out.push({
        key: "ghosts",
        label: "Verification rate",
        status: "unknown",
        detail: "No scans yet",
      });
    } else if (ghostRate >= 50) {
      out.push({
        key: "ghosts",
        label: "Verification rate",
        status: "attention",
        detail: `${ghostRate}% ghost rate (${ghosts.length}/${flow.scanned})`,
      });
    } else {
      out.push({
        key: "ghosts",
        label: "Verification rate",
        status: "operational",
        detail: `${100 - ghostRate}% verified after scan`,
      });
    }

    // Stale unresolved opportunities
    if (outcomeRollup.counts.stale_unresolved >= 5) {
      out.push({
        key: "stale",
        label: "Outcome backlog",
        status: "attention",
        detail: `${outcomeRollup.counts.stale_unresolved} stale unresolved`,
      });
    } else {
      out.push({
        key: "stale",
        label: "Outcome backlog",
        status: "operational",
        detail: `${outcomeRollup.unresolved} unresolved (acceptable)`,
      });
    }

    // Data quality
    if (dataQuality.sparse >= 1) {
      out.push({
        key: "data-quality",
        label: "Data integrity",
        status: "attention",
        detail: `${dataQuality.sparse} sparse field group(s)`,
      });
    } else {
      out.push({
        key: "data-quality",
        label: "Data integrity",
        status: "operational",
        detail: `${dataQuality.strong} strong, ${dataQuality.partial} partial`,
      });
    }

    return out;
  }, [
    contractors,
    contractorsQ.isLoading,
    oppsQ.isLoading,
    oppsQ.isError,
    routesQ.isLoading,
    routesQ.isError,
    opps.length,
    routes.length,
    webhook,
    ghosts.length,
    flow.scanned,
    outcomeRollup,
    dataQuality,
  ]);

  /* ── Aggregate readiness ─────────────────────────────────────────── */
  const overall: ReadinessStatus = useMemo(() => {
    if (signals.some((s) => s.status === "attention")) return "attention";
    if (signals.every((s) => s.status === "unknown")) return "unknown";
    if (signals.some((s) => s.status === "unknown")) return "unknown";
    return "operational";
  }, [signals]);

  const overallTone = toneForStatus(overall);
  const OverallIcon = overallTone.icon;
  const overallLabel =
    overall === "operational"
      ? "System Healthy"
      : overall === "attention"
      ? "Needs Attention"
      : "Status Unknown";

  /* ── Quick actions ───────────────────────────────────────────────── */
  const quickActions: Array<
    | { kind: "tab"; tab: string; label: string; desc: string; icon: typeof Activity }
    | { kind: "route"; to: string; label: string; desc: string; icon: typeof Activity }
  > = [
    { kind: "route", to: "/admin/leads", label: "Lead Inbox", desc: "Open the homeowner inbox", icon: Inbox },
    { kind: "tab", tab: "routing", label: "Routing Desk", desc: "Assign / release contractors", icon: RouteIcon },
    { kind: "tab", tab: "pipeline", label: "Active Pipeline", desc: "Live opportunities + ownership", icon: Target },
    { kind: "tab", tab: "needs-review", label: "Needs Review", desc: "Operator triage queue", icon: ClipboardList },
    { kind: "tab", tab: "outcomes", label: "Outcomes", desc: "Booked / closed / unresolved", icon: CalendarCheck },
    { kind: "tab", tab: "data-quality", label: "Data Quality", desc: "Field integrity audit", icon: Database },
    { kind: "tab", tab: "readiness", label: "Launch Readiness", desc: "Pre-launch system checks", icon: ShieldCheck },
    { kind: "route", to: "/admin/settings", label: "Settings", desc: "Admin & integrations", icon: Settings },
  ];

  /* ─────────────────────────────────────────────────────────────────── */
  return (
    <div className="w-full px-2 sm:px-6 pt-4 space-y-6">
      {/* ── Readiness banner ───────────────────────────────────────── */}
      <Card className="border-l-4" style={{ borderLeftColor: "hsl(var(--primary))" }}>
        <CardContent className="py-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full ${overallTone.badge} border`}
            >
              <OverallIcon className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold tracking-tight">
                  {overallLabel}
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] uppercase tracking-wider"
                >
                  Mission Control · derived
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Roll-up of {signals.length} live signals across roster, routing,
                webhooks, verification, outcomes, and data integrity.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 lg:max-w-[60%]">
            {signals.map((s) => {
              const tone = toneForStatus(s.status);
              return (
                <div
                  key={s.key}
                  className="flex items-center gap-1.5 rounded-md border border-border/60 bg-card px-2 py-1.5 min-w-0"
                  title={s.detail}
                >
                  <span
                    className={`inline-block h-2 w-2 shrink-0 rounded-full ${tone.dot}`}
                    aria-hidden
                  />
                  <span className="truncate text-[10px] font-medium">
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── KPI strip ──────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Funnel — last all-time
          </h2>
          <span className="text-[10px] text-muted-foreground font-mono">
            {leads.length} leads in scope
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiTile label="Captured" value={flow.captured} hint="All leads recorded" icon={Inbox} />
          <KpiTile
            label="Verified"
            value={flow.verified}
            hint={`${pct(flow.verified, flow.captured)}% of captured`}
            icon={ShieldCheck}
          />
          <KpiTile
            label="Scanned"
            value={flow.scanned}
            hint={`${pct(flow.scanned, flow.captured)}% of captured`}
            icon={ScanSearch}
          />
          <KpiTile
            label="Routed"
            value={flow.routed}
            hint={`${pct(flow.routed, flow.verified)}% of verified`}
            icon={Send}
          />
          <KpiTile
            label="Booked"
            value={flow.booked}
            hint={`${pct(flow.booked, flow.routed)}% of routed`}
            icon={CalendarCheck}
          />
          <KpiTile
            label="Closed"
            value={flow.closed}
            hint={`${pct(flow.closed, flow.booked)}% of booked`}
            icon={CheckCircle2}
          />
        </div>
      </div>

      {/* ── Feed (left, 2/3) + Quick actions (right, 1/3) ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 min-w-0">
          <MarketOpsFeed leads={leads} />
        </div>
        <div className="min-w-0">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Quick Actions
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {quickActions.map((a) => {
                  const Icon = a.icon;
                  const inner = (
                    <>
                      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs font-semibold truncate">
                          {a.label}
                        </span>
                        <span className="block text-[10px] text-muted-foreground truncate">
                          {a.desc}
                        </span>
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    </>
                  );
                  if (a.kind === "route") {
                    return (
                      <li key={a.label}>
                        <Link
                          to={a.to}
                          className="flex items-center gap-2.5 rounded-md border border-border/60 bg-card px-2.5 py-2 hover:bg-muted/50 transition-colors"
                        >
                          {inner}
                        </Link>
                      </li>
                    );
                  }
                  return (
                    <li key={a.label}>
                      <button
                        type="button"
                        onClick={() => onNavigateTab(a.tab)}
                        className="w-full flex items-center gap-2.5 rounded-md border border-border/60 bg-card px-2.5 py-2 hover:bg-muted/50 transition-colors text-left"
                      >
                        {inner}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Bottom row: Data Quality + Revenue Integrity ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Data Quality Snapshot */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Data Quality Snapshot
                </CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px]">
                Derived
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md border border-border/60 bg-card p-2.5">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Strong
                </div>
                <div className="text-xl font-bold tabular-nums">
                  {dataQuality.strong}
                </div>
              </div>
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5">
                <div className="text-[10px] text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                  Partial
                </div>
                <div className="text-xl font-bold tabular-nums">
                  {dataQuality.partial}
                </div>
              </div>
              <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-2.5">
                <div className="text-[10px] text-rose-700 dark:text-rose-400 uppercase tracking-wider">
                  Sparse
                </div>
                <div className="text-xl font-bold tabular-nums">
                  {dataQuality.sparse}
                </div>
              </div>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" /> Leads missing county fallback
                </span>
                <span className="font-mono tabular-nums">
                  {dataQuality.missingCounty}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3" /> Orphaned opportunities
                  (linkage)
                </span>
                <span className="font-mono tabular-nums">
                  {dataQuality.orphanedOpps}
                </span>
              </li>
            </ul>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between text-xs"
              onClick={() => onNavigateTab("data-quality")}
            >
              <span>Open Data Quality Audit</span>
              <ExternalLink className="h-3 w-3" />
            </Button>
          </CardContent>
        </Card>

        {/* Revenue Integrity Snapshot */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileBarChart className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Revenue Integrity Snapshot
                </CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px]">
                Derived
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md border border-border/60 bg-card p-2.5">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Booked
                </div>
                <div className="text-xl font-bold tabular-nums">
                  {outcomeRollup.counts.booked}
                </div>
              </div>
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5">
                <div className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                  Closed
                </div>
                <div className="text-xl font-bold tabular-nums">
                  {outcomeRollup.counts.closed}
                </div>
              </div>
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5">
                <div className="text-[10px] text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                  Stale
                </div>
                <div className="text-xl font-bold tabular-nums">
                  {outcomeRollup.counts.stale_unresolved}
                </div>
              </div>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Unlock className="h-3 w-3" /> Recent handoffs (24h)
                </span>
                <span className="font-mono tabular-nums">
                  {outcomeRollup.recentHandoffs}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ClipboardList className="h-3 w-3" /> Interested, not booked
                </span>
                <span className="font-mono tabular-nums">
                  {outcomeRollup.counts.interested_not_booked}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3" /> Total unresolved
                </span>
                <span className="font-mono tabular-nums">
                  {outcomeRollup.unresolved}
                </span>
              </li>
              {needsReviewCount > 0 && (
                <li className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3 w-3" /> Needs operator review
                  </span>
                  <span className="font-mono tabular-nums">
                    {needsReviewCount}
                  </span>
                </li>
              )}
            </ul>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between text-xs"
              onClick={() => onNavigateTab("outcomes")}
            >
              <span>Open Outcome Tracking</span>
              <ExternalLink className="h-3 w-3" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
