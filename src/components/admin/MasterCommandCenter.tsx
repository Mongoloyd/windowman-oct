/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MASTER COMMAND CENTER — Phase 25 Master Polish
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Operator Command Center synthesizing the highest-signal truth from the
 * existing admin system into one screen. Pure read-and-compose: no new
 * edge functions, no schema changes, no fabricated metrics.
 *
 *   Funnel · Daily Revenue Target · Readiness (with critical tier) ·
 *   Webhook legend · Expandable signals · Quick-Action HUD ·
 *   Snapshot CSV export
 */

import { useMemo, useState } from "react";
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
  Download,
  ExternalLink,
  FileBarChart,
  HelpCircle,
  Inbox,
  MapPin,
  Pencil,
  Route as RouteIcon,
  ScanSearch,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  Unlock,
  Users,
  XCircle,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
import { downloadSnapshotCsv } from "@/components/admin/missionControl/exportSnapshot";
import {
  computeFunnelMetrics,
  computeTodayRevenue,
  CLOSED_STATUSES,
  type Scope,
  type StageKey,
  type FunnelMetrics,
  type StageMetric,
} from "@/components/admin/missionControl/funnelMetrics";
import { TruthStripDrilldown } from "@/components/admin/TruthStripDrilldown";
import { LeadDossierSheet } from "@/components/admin/LeadDossierSheet";
import type { StageLeadRow } from "@/components/admin/types";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const DAILY_GOAL_KEY = "wm_admin_daily_revenue_goal";
const DEFAULT_DAILY_GOAL = 25_000;

interface MasterCommandCenterProps {
  leads: CRMLead[];
  deliveries: WebhookDelivery[];
  ghosts: CRMLead[];
  needsReviewCount: number;
  onNavigateTab: (tab: string) => void;
}

type ReadinessStatus = "operational" | "attention" | "critical" | "unknown";

interface ReadinessSignal {
  key: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
  /** Threshold rule that fired (only for non-operational signals). */
  rule?: string;
  /** Where to jump when operator clicks "Open source". */
  jump?:
    | { kind: "tab"; tab: string }
    | { kind: "route"; to: string };
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
  if (status === "critical") {
    return {
      badge:
        "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/40",
      dot: "bg-rose-500",
      icon: XCircle,
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

/* ─── Truth Strip types — imported from funnelMetrics (canonical engine) ─ */

/* ─── KPI tile (interactive, glass) ──────────────────────────────────── */
interface KpiTileProps {
  label: string;
  metric: StageMetric;
  hint: string;        // prior-stage label, e.g. "of Captured" — empty for baseline
  icon: typeof Activity;
  onClick: () => void;
}
function KpiTile({ label, metric, hint, icon: Icon, onClick }: KpiTileProps) {
  const { count, delta, deltaPct, convPct } = metric;
  const deltaTone =
    deltaPct === null
      ? "text-muted-foreground"
      : delta > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : delta < 0
      ? "text-rose-600 dark:text-rose-400"
      : "text-muted-foreground";
  const DeltaIcon =
    deltaPct === null || delta === 0
      ? null
      : delta > 0
      ? TrendingUp
      : TrendingDown;
  const deltaLabel =
    deltaPct === null
      ? "—"
      : `${delta > 0 ? "+" : ""}${Math.round(deltaPct)}%`;
  const convLabel =
    convPct === null
      ? hint || "baseline"
      : `${convPct}% ${hint}`;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${count.toLocaleString()} leads, ${deltaLabel} vs prior period, ${convLabel}`}
      className="group relative overflow-hidden rounded-lg border border-border/60 bg-card/95 backdrop-blur-sm px-3 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground truncate">
          {label}
        </span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </div>
      <div className="text-2xl font-bold tabular-nums tracking-tight leading-none mb-1.5">
        {count.toLocaleString()}
      </div>
      <div className="flex items-center gap-1.5 text-[10px] leading-tight">
        <span className={`inline-flex items-center gap-0.5 font-semibold ${deltaTone}`}>
          {DeltaIcon ? <DeltaIcon className="h-3 w-3" aria-hidden /> : null}
          {deltaLabel}
        </span>
        <span className="text-muted-foreground/60">·</span>
        <span className="text-muted-foreground truncate">{convLabel}</span>
      </div>
    </button>
  );
}

/* ─── Helpers ────────────────────────────────────────────────────────── */
function pct(n: number, d: number): number {
  if (d <= 0) return 0;
  return Math.round((n / d) * 100);
}
function fmtMoney(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function readGoal(): number {
  if (typeof window === "undefined") return DEFAULT_DAILY_GOAL;
  const raw = window.localStorage.getItem(DAILY_GOAL_KEY);
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_DAILY_GOAL;
}

/* scopeWindows + stage probes now live in funnelMetrics.ts (canonical engine). */

export function MasterCommandCenter({
  leads,
  deliveries,
  ghosts,
  needsReviewCount,
  onNavigateTab,
}: MasterCommandCenterProps) {
  const [dailyGoal, setDailyGoal] = useState<number>(readGoal);
  const [scope, setScope] = useState<Scope>("all");

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

  /* ── Truth Strip metrics — shared canonical engine (Phase 26) ────── */
  const funnelMetrics: FunnelMetrics = useMemo(
    () => computeFunnelMetrics(leads, scope),
    [leads, scope],
  );

  /* Backward-compat shape used by signals & snapshot exporter. */
  const flow = useMemo(
    () => ({
      captured: funnelMetrics.captured.count,
      verified: funnelMetrics.verified.count,
      scanned: funnelMetrics.scanned.count,
      routed: funnelMetrics.routed.count,
      booked: funnelMetrics.booked.count,
      closed: funnelMetrics.closed.count,
    }),
    [funnelMetrics],
  );

  /* ── Phase 26 — Drilldown + Dossier state ─────────────────────────── */
  const [drilldownStage, setDrilldownStage] = useState<StageKey | null>(null);
  const [dossierLead, setDossierLead] = useState<CRMLead | null>(null);

  const handleJumpToDossier = (row: StageLeadRow) => {
    const full = leads.find((l) => l.id === row.id) ?? null;
    setDrilldownStage(null);
    if (full) setDossierLead(full);
  };

  /* ── Daily Revenue (closed today) — shared canonical engine ──────── */
  const revenueToday = useMemo(() => computeTodayRevenue(leads), [leads]);


  const goalPct = pct(revenueToday.volume, dailyGoal);
  const goalFillTone =
    goalPct >= 100
      ? "bg-emerald-500"
      : goalPct >= 50
      ? "bg-amber-500"
      : "bg-muted-foreground/50";

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
      if (latest?.contact_released_at) {
        const t = new Date(latest.contact_released_at).getTime();
        if (!Number.isNaN(t) && now - t <= TWENTY_FOUR_HOURS_MS) {
          recentHandoffs++;
        }
      }
    }
    return { counts, unresolved, recentHandoffs };
  }, [opps, routes, leads]);

  /* ── Data quality roll-up ────────────────────────────────────────── */
  const dataQuality = useMemo(() => {
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
    const missingCounty = leads.filter((l) => !nonEmpty(l.county)).length;
    const leadIds = new Set(leads.map((l) => l.id));
    const orphanedOpps = opps.filter((o) => !leadIds.has(o.lead_id)).length;
    return { sparse, partial, strong, missingCounty, orphanedOpps };
  }, [leads, contractors, opps]);

  /* ── Webhook health ──────────────────────────────────────────────── */
  const webhook = useMemo(() => {
    const pending = deliveries.filter((d) => d.status === "pending").length;
    const failed = deliveries.filter((d) => d.status === "failed").length;
    const dead = deliveries.filter((d) => d.status === "dead_letter").length;
    const delivered = deliveries.filter((d) =>
      ["delivered", "mock_delivered"].includes(d.status),
    ).length;
    return { pending, failed, dead, delivered };
  }, [deliveries]);

  /* ── Readiness signals ───────────────────────────────────────────── */
  const signals: ReadinessSignal[] = useMemo(() => {
    const out: ReadinessSignal[] = [];

    // Contractors
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
        rule: "Active contractors == 0",
        jump: { kind: "tab", tab: "contractors" },
      });
    } else {
      out.push({
        key: "contractors",
        label: "Contractor roster",
        status: "operational",
        detail: `${activeContractors} active`,
        jump: { kind: "tab", tab: "contractors" },
      });
    }

    // Opportunities
    if (oppsQ.isLoading) {
      out.push({ key: "opps", label: "Opportunities feed", status: "unknown", detail: "Loading…" });
    } else if (oppsQ.isError) {
      out.push({
        key: "opps",
        label: "Opportunities feed",
        status: "attention",
        detail: "Read failed",
        rule: "Opportunities query failed",
        jump: { kind: "tab", tab: "routing" },
      });
    } else {
      out.push({
        key: "opps",
        label: "Opportunities feed",
        status: "operational",
        detail: `${opps.length} opportunities`,
        jump: { kind: "tab", tab: "routing" },
      });
    }

    // Routes
    if (routesQ.isLoading) {
      out.push({ key: "routes", label: "Routing path", status: "unknown", detail: "Loading…" });
    } else if (routesQ.isError) {
      out.push({
        key: "routes",
        label: "Routing path",
        status: "attention",
        detail: "Read failed",
        rule: "Routes query failed",
        jump: { kind: "tab", tab: "routing" },
      });
    } else {
      out.push({
        key: "routes",
        label: "Routing path",
        status: "operational",
        detail: `${routes.length} routes`,
        jump: { kind: "tab", tab: "routing" },
      });
    }

    // Webhooks — Dead-Letter is CRITICAL
    if (webhook.dead > 0) {
      out.push({
        key: "webhooks",
        label: "Webhook delivery",
        status: "critical",
        detail: `${webhook.dead} dead-letter, ${webhook.failed} failed`,
        rule: "Dead-letter > 0 (delivery permanently abandoned)",
        jump: { kind: "tab", tab: "delivery-inspector" },
      });
    } else if (webhook.failed > 0) {
      out.push({
        key: "webhooks",
        label: "Webhook delivery",
        status: "attention",
        detail: `${webhook.failed} failed`,
        rule: "Failed > 0 (retrying)",
        jump: { kind: "tab", tab: "delivery-inspector" },
      });
    } else {
      out.push({
        key: "webhooks",
        label: "Webhook delivery",
        status: "operational",
        detail: `${webhook.delivered} delivered, ${webhook.pending} pending`,
        jump: { kind: "tab", tab: "delivery-inspector" },
      });
    }

    // Ghost rate
    const ghostRate = pct(ghosts.length, flow.scanned);
    if (flow.scanned === 0) {
      out.push({ key: "ghosts", label: "Verification rate", status: "unknown", detail: "No scans yet" });
    } else if (ghostRate >= 50) {
      out.push({
        key: "ghosts",
        label: "Verification rate",
        status: "attention",
        detail: `${ghostRate}% ghost rate (${ghosts.length}/${flow.scanned})`,
        rule: "Ghost rate ≥ 50% of scans",
        jump: { kind: "tab", tab: "ghosts" },
      });
    } else {
      out.push({
        key: "ghosts",
        label: "Verification rate",
        status: "operational",
        detail: `${100 - ghostRate}% verified after scan`,
        jump: { kind: "tab", tab: "ghosts" },
      });
    }

    // Stale unresolved
    if (outcomeRollup.counts.stale_unresolved >= 5) {
      out.push({
        key: "stale",
        label: "Outcome backlog",
        status: "attention",
        detail: `${outcomeRollup.counts.stale_unresolved} stale unresolved`,
        rule: "Stale unresolved ≥ 5 opportunities",
        jump: { kind: "tab", tab: "outcomes" },
      });
    } else {
      out.push({
        key: "stale",
        label: "Outcome backlog",
        status: "operational",
        detail: `${outcomeRollup.unresolved} unresolved (acceptable)`,
        jump: { kind: "tab", tab: "outcomes" },
      });
    }

    // Data quality
    if (dataQuality.sparse >= 1) {
      out.push({
        key: "data-quality",
        label: "Data integrity",
        status: "attention",
        detail: `${dataQuality.sparse} sparse field group(s)`,
        rule: "Sparse field groups ≥ 1",
        jump: { kind: "tab", tab: "data-quality" },
      });
    } else {
      out.push({
        key: "data-quality",
        label: "Data integrity",
        status: "operational",
        detail: `${dataQuality.strong} strong, ${dataQuality.partial} partial`,
        jump: { kind: "tab", tab: "data-quality" },
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

  /* ── Aggregate readiness — critical wins over attention ──────────── */
  const overall: ReadinessStatus = useMemo(() => {
    if (signals.some((s) => s.status === "critical")) return "critical";
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
      : overall === "critical"
      ? "Critical — Operator Action Required"
      : overall === "attention"
      ? "Needs Attention"
      : "Status Unknown";

  /* ── Quick actions — slimmed to the brief's HUD spec ─────────────── */
  const primaryActions: Array<{ tab: string; label: string; desc: string; icon: typeof Activity }> = [
    { tab: "routing", label: "Routing", desc: "Assign / release contractors", icon: RouteIcon },
    { tab: "data-quality", label: "Data Quality", desc: "Field integrity audit", icon: Database },
    { tab: "outcomes", label: "Revenue Integrity", desc: "Booked / closed / unresolved", icon: FileBarChart },
    { tab: "readiness", label: "Readiness / SOPs", desc: "Pre-launch system checks", icon: ShieldCheck },
  ];
  const secondaryActions: Array<{ to: string; label: string; desc: string; icon: typeof Activity }> = [
    { to: "/admin/leads", label: "Lead Inbox", desc: "Open the homeowner inbox", icon: Inbox },
    { to: "/admin/settings", label: "Settings", desc: "Admin & integrations", icon: Settings },
  ];

  /* ── Snapshot export ─────────────────────────────────────────────── */
  function handleExportSnapshot() {
    downloadSnapshotCsv({
      generatedAt: new Date(),
      funnel: flow,
      funnelDelta: {
        captured: { delta: funnelMetrics.captured.delta, prevCount: funnelMetrics.captured.prevCount, convPct: funnelMetrics.captured.convPct },
        verified: { delta: funnelMetrics.verified.delta, prevCount: funnelMetrics.verified.prevCount, convPct: funnelMetrics.verified.convPct },
        scanned:  { delta: funnelMetrics.scanned.delta,  prevCount: funnelMetrics.scanned.prevCount,  convPct: funnelMetrics.scanned.convPct  },
        routed:   { delta: funnelMetrics.routed.delta,   prevCount: funnelMetrics.routed.prevCount,   convPct: funnelMetrics.routed.convPct   },
        booked:   { delta: funnelMetrics.booked.delta,   prevCount: funnelMetrics.booked.prevCount,   convPct: funnelMetrics.booked.convPct   },
        closed:   { delta: funnelMetrics.closed.delta,   prevCount: funnelMetrics.closed.prevCount,   convPct: funnelMetrics.closed.convPct   },
      },
      revenue: {
        goal: dailyGoal,
        todayClosedVolume: revenueToday.volume,
        todayClosedCount: revenueToday.count,
      },
      signals: signals.map((s) => ({
        label: s.label,
        status: s.status,
        detail: s.detail,
      })),
      webhooks: webhook,
      outcomes: {
        booked: outcomeRollup.counts.booked,
        closed: outcomeRollup.counts.closed,
        stale: outcomeRollup.counts.stale_unresolved,
        unresolved: outcomeRollup.unresolved,
        recentHandoffs24h: outcomeRollup.recentHandoffs,
        interestedNotBooked: outcomeRollup.counts.interested_not_booked,
      },
      dataQuality,
    });
  }

  function handleEditGoal() {
    if (typeof window === "undefined") return;
    const next = window.prompt(
      "Set daily revenue goal (USD)",
      String(dailyGoal),
    );
    if (!next) return;
    const parsed = parseInt(next.replace(/[^0-9]/g, ""), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    window.localStorage.setItem(DAILY_GOAL_KEY, String(parsed));
    setDailyGoal(parsed);
  }

  function handleSignalJump(signal: ReadinessSignal) {
    if (!signal.jump) return;
    if (signal.jump.kind === "tab") {
      onNavigateTab(signal.jump.tab);
    } else if (typeof window !== "undefined") {
      window.location.assign(signal.jump.to);
    }
  }

  /* ─────────────────────────────────────────────────────────────────── */
  return (
    <div className="w-full px-2 sm:px-6 pt-4 space-y-6">
      {/* ── Readiness banner (glass) ───────────────────────────────── */}
      <Card
        className="border-l-4 backdrop-blur-sm bg-card/95"
        style={{ borderLeftColor: "hsl(var(--primary))" }}
      >
        <CardContent className="py-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full ${overallTone.badge} border shrink-0`}
            >
              <OverallIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold tracking-tight">
                  {overallLabel}
                </span>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                  Mission Control · derived
                </Badge>
                {overall === "critical" && (
                  <Badge className="text-[10px] uppercase tracking-wider bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/40">
                    <ShieldAlert className="h-3 w-3 mr-1" />
                    Critical
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Roll-up of {signals.length} live signals · Click any chip for the
                threshold rule and source surface.
              </p>
              {/* Webhook legend */}
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                <span className="text-muted-foreground uppercase tracking-wider">
                  Webhooks:
                </span>
                <Badge variant="secondary" className="font-mono">
                  Pending {webhook.pending}
                </Badge>
                <Badge variant="default" className="font-mono">
                  Delivered {webhook.delivered}
                </Badge>
                <Badge variant="outline" className="font-mono border-amber-500/40 text-amber-700 dark:text-amber-400">
                  Failed {webhook.failed}
                </Badge>
                <Badge
                  variant="outline"
                  className="font-mono border-rose-500/40 text-rose-700 dark:text-rose-400 bg-rose-500/5"
                >
                  Dead-Letter (Critical) {webhook.dead}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 lg:items-end lg:max-w-[60%]">
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportSnapshot}
                className="gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="text-xs">Export Snapshot</span>
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
              {signals.map((s) => {
                const tone = toneForStatus(s.status);
                return (
                  <Popover key={s.key}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-1.5 rounded-md border border-border/60 bg-card px-2 py-1.5 min-w-0 hover:bg-muted/40 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span
                          className={`inline-block h-2 w-2 shrink-0 rounded-full ${tone.dot}`}
                          aria-hidden
                        />
                        <span className="truncate text-[10px] font-medium">
                          {s.label}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-3" align="end">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge variant="outline" className={`text-[10px] uppercase ${tone.badge}`}>
                          {s.status}
                        </Badge>
                        <span className="text-xs font-semibold">{s.label}</span>
                      </div>
                      <p className="text-xs text-foreground mb-1">{s.detail}</p>
                      {s.rule && (
                        <p className="text-[11px] text-muted-foreground mb-2">
                          <span className="font-semibold">Rule:</span> {s.rule}
                        </p>
                      )}
                      {s.jump && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="w-full justify-between text-xs h-8"
                          onClick={() => handleSignalJump(s)}
                        >
                          <span>Open source surface</span>
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                    </PopoverContent>
                  </Popover>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Daily Revenue Target ───────────────────────────────────── */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <Target className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Daily Revenue Target
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleEditGoal}
                className="h-6 px-1.5 text-[10px] text-muted-foreground"
                title="Edit daily goal"
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {revenueToday.count} {revenueToday.count === 1 ? "deal" : "deals"} closed today
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-2 flex-wrap">
            <span className="text-3xl font-bold tabular-nums tracking-tight">
              {fmtMoney(revenueToday.volume)}
            </span>
            <span className="text-sm text-muted-foreground">
              of {fmtMoney(dailyGoal)} goal
            </span>
            <Badge
              variant="outline"
              className={`text-[10px] uppercase tracking-wider ${
                goalPct >= 100
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                  : goalPct >= 50
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {goalPct}%
            </Badge>
          </div>
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full ${goalFillTone} transition-all`}
              style={{ width: `${Math.min(100, goalPct)}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            {goalPct >= 100
              ? `Goal hit — ${fmtMoney(revenueToday.volume - dailyGoal)} above target.`
              : `${fmtMoney(Math.max(0, dailyGoal - revenueToday.volume))} remaining to hit goal.`}
          </p>
        </CardContent>
      </Card>

      {/* ── Truth Strip — interactive funnel ──────────────────────── */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-2 px-1 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Truth Strip — Funnel
            </h2>
            <span className="text-[10px] text-muted-foreground font-mono">
              {scope === "today" ? "today" : scope === "7d" ? "last 7 days" : "all-time · Δ vs prior 30d"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              role="group"
              aria-label="Time scope"
              className="inline-flex rounded-md border border-border/60 bg-card/95 backdrop-blur-sm p-0.5"
            >
              {(["today", "7d", "all"] as Scope[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  aria-pressed={scope === s}
                  className={`px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-sm transition-colors ${
                    scope === s
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s === "today" ? "Today" : s === "7d" ? "7D" : "All"}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">
              {leads.length} leads in scope
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <KpiTile label="Captured" metric={funnelMetrics.captured} hint=""           icon={Inbox}        onClick={() => setDrilldownStage("captured")} />
          <KpiTile label="Verified" metric={funnelMetrics.verified} hint="of Captured" icon={ShieldCheck}  onClick={() => setDrilldownStage("verified")} />
          <KpiTile label="Scanned"  metric={funnelMetrics.scanned}  hint="of Captured" icon={ScanSearch}   onClick={() => setDrilldownStage("scanned")} />
          <KpiTile label="Routed"   metric={funnelMetrics.routed}   hint="of Verified" icon={Send}         onClick={() => setDrilldownStage("routed")} />
          <KpiTile label="Booked"   metric={funnelMetrics.booked}   hint="of Routed"   icon={CalendarCheck} onClick={() => setDrilldownStage("booked")} />
          <KpiTile label="Closed"   metric={funnelMetrics.closed}   hint="of Booked"   icon={CheckCircle2} onClick={() => setDrilldownStage("closed")} />
        </div>
      </div>

      {/* ── Feed (left) + Quick-Action HUD (right) ────────────────── */}
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
                  Quick-Action HUD
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {primaryActions.map((a) => {
                  const Icon = a.icon;
                  return (
                    <button
                      key={a.tab}
                      type="button"
                      onClick={() => onNavigateTab(a.tab)}
                      className="flex flex-col items-start gap-1 rounded-md border border-border/60 bg-card px-2.5 py-2.5 hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-1.5 w-full">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs font-semibold truncate flex-1">
                          {a.label}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      </div>
                      <span className="text-[10px] text-muted-foreground line-clamp-2">
                        {a.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-border/40 pt-2 space-y-1.5">
                {secondaryActions.map((a) => {
                  const Icon = a.icon;
                  return (
                    <Link
                      key={a.to}
                      to={a.to}
                      className="flex items-center gap-2.5 rounded-md border border-border/60 bg-card px-2.5 py-1.5 hover:bg-muted/50 transition-colors"
                    >
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
                    </Link>
                  );
                })}
              </div>
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
                  <AlertTriangle className="h-3 w-3" /> Orphaned opportunities (linkage)
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
      <TruthStripDrilldown
        open={drilldownStage != null}
        onOpenChange={(o) => { if (!o) setDrilldownStage(null); }}
        stage={drilldownStage}
        scope={scope}
        onJumpToDossier={handleJumpToDossier}
      />
      <LeadDossierSheet
        lead={dossierLead}
        open={dossierLead != null}
        onOpenChange={(o) => { if (!o) setDossierLead(null); }}
      />
    </div>
  );
}
