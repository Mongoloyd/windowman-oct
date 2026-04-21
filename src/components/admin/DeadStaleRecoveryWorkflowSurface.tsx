/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DEAD / STALE / RECOVERY WORKFLOW HARDENING — Phase 15
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Internal operator surface that hardens the manual lifecycle handling of
 * leads/opportunities. Purely read-only + operator guidance. No automation,
 * no new mutations. The canonical `mark_dead` path (admin-data) remains the
 * single source of truth for marking opportunities dead — this surface only
 * clarifies WHEN/WHY to use it and surfaces ambiguous cases for review.
 *
 * STRICT CONSTRAINTS (Phase 15):
 *   • Frontend only. No edge functions, no schema changes.
 *   • Reuses repo-real reads via `adminDataService` only.
 *   • All "stale", "recovery", "ambiguous" groupings are deterministic
 *     operator-view derivations from real fields, clearly commented.
 *   • Local-only expand/collapse + clipboard. No persisted review state.
 *   • Does not duplicate or re-implement `mark_dead`.
 */

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  HelpCircle,
  Info,
  LifeBuoy,
  ListChecks,
  Skull,
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
} from "@/services/adminDataService";
import type {
  RoutingOpportunity,
  RoutingRoute,
} from "@/types/routingDesk";
import type { CRMLead } from "@/components/admin/types";

// ─── Derivation thresholds ─────────────────────────────────────────────
// Mirrors thresholds used in OperatorReportingSurface / OutcomeTracking
// so lifecycle states stay consistent across the admin shell.
const STALE_HOURS = 72;            // operator-view: no activity > 72h on routed/active opp
const REVIEW_BEFORE_DEAD_HOURS = 168; // operator-view: 7d+ stale + no terminal signal => review

interface Props {
  leads: CRMLead[];
  onNavigateTab?: (tab: string) => void;
}

type BucketKey = "active" | "stale" | "dead" | "recovery" | "ambiguous";

interface LifecycleRow {
  bucket: BucketKey;
  reason: string;
  lead: CRMLead;
  opportunity?: RoutingOpportunity;
  lastActivityAt: number; // epoch ms; 0 if unknown
}

export function DeadStaleRecoveryWorkflowSurface({ leads, onNavigateTab }: Props) {
  const [openSection, setOpenSection] = useState<Record<string, boolean>>({
    definitions: true,
    snapshot: true,
    nextAction: true,
    ambiguous: true,
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

  const oppsArr = (opps as RoutingOpportunity[] | undefined) ?? [];
  const routesArr = (routes as RoutingRoute[] | undefined) ?? [];

  // ─── Lifecycle bucketing (deterministic, operator-view) ─────────────
  // For each lead with at least one routed opportunity OR a verified state,
  // assign a single bucket using real fields:
  //
  //   • DEAD       = lead.deal_status === 'dead' OR lead.closed_at present
  //                  (canonical model fields; mark_dead writes here)
  //   • ACTIVE     = routed/booked/responded recently (within STALE_HOURS)
  //                  AND no terminal signal
  //   • STALE      = routed but no activity for > STALE_HOURS, no terminal
  //   • RECOVERY   = opportunity exists but lead never phone_verified
  //                  (homeowner abandoned before unlock)
  //   • AMBIGUOUS  = released or routed-without-signal AND >7d stale,
  //                  OR mixed/contradictory timestamps the operator should
  //                  judge before applying a clean label
  //
  // A lead can match multiple raw conditions; precedence is:
  //   dead > recovery > ambiguous > stale > active
  const lifecycle = useMemo(() => {
    const oppByLeadId = new Map<string, RoutingOpportunity>();
    for (const o of oppsArr) {
      // Keep latest opp per lead by created_at
      const existing = oppByLeadId.get(o.lead_id);
      if (
        !existing ||
        new Date(o.created_at).getTime() > new Date(existing.created_at).getTime()
      ) {
        oppByLeadId.set(o.lead_id, o);
      }
    }

    const routesByOppId = new Map<string, RoutingRoute[]>();
    for (const r of routesArr) {
      const arr = routesByOppId.get(r.opportunity_id) ?? [];
      arr.push(r);
      routesByOppId.set(r.opportunity_id, arr);
    }

    const now = Date.now();
    const rows: LifecycleRow[] = [];

    for (const lead of leads) {
      const opp = oppByLeadId.get(lead.id);
      const oppRoutes = opp ? routesByOppId.get(opp.id) ?? [] : [];

      // Compute most recent activity timestamp from real fields
      const candidates: number[] = [];
      const push = (v: string | null | undefined) => {
        if (v) {
          const t = new Date(v).getTime();
          if (!Number.isNaN(t)) candidates.push(t);
        }
      };
      push(lead.routed_to_contractor_at);
      push(lead.appointment_booked_at);
      push(lead.replacement_quote_submitted_at);
      push(lead.last_call_completed_at);
      push(lead.reactivation_email_sent_at);
      push(lead.intro_requested_at);
      for (const r of oppRoutes) {
        push(r.created_at);
        push(r.sent_at);
        push(r.viewed_at);
        push(r.responded_at);
        push(r.interested_at);
        push(r.contact_released_at);
      }
      const lastActivityAt = candidates.length ? Math.max(...candidates) : 0;
      const hoursSince = lastActivityAt
        ? (now - lastActivityAt) / 36e5
        : Number.POSITIVE_INFINITY;

      // 1) DEAD — explicit modeled outcome (canonical mark_dead writes here)
      if (lead.deal_status === "dead" || lead.closed_at) {
        rows.push({
          bucket: "dead",
          reason:
            lead.deal_status === "dead"
              ? "deal_status = dead"
              : "closed_at present",
          lead,
          opportunity: opp,
          lastActivityAt,
        });
        continue;
      }

      // 2) RECOVERY — opp exists but homeowner never verified
      if (opp && !lead.phone_verified) {
        rows.push({
          bucket: "recovery",
          reason: "opportunity exists but lead never phone_verified",
          lead,
          opportunity: opp,
          lastActivityAt,
        });
        continue;
      }

      // Only continue lifecycle bucketing if there is real downstream activity
      if (!opp && !lead.routed_to_contractor_at) continue;

      const hasResponseSignal =
        oppRoutes.some(
          (r) =>
            !!r.viewed_at ||
            !!r.responded_at ||
            !!r.interested_at ||
            !!r.contact_released_at
        ) || !!lead.appointment_booked_at;

      // 3) AMBIGUOUS — routed/released but no clean terminal signal
      // and stale beyond the review threshold (operator should decide)
      const releasedNoFollowup = oppRoutes.some(
        (r) => !!r.contact_released_at && !r.responded_at && !r.interested_at
      );
      if (
        hoursSince > REVIEW_BEFORE_DEAD_HOURS &&
        !lead.appointment_booked_at &&
        (releasedNoFollowup || (opp && !hasResponseSignal))
      ) {
        rows.push({
          bucket: "ambiguous",
          reason: releasedNoFollowup
            ? "released >7d ago, no contractor follow-up signal"
            : "routed >7d ago, no downstream signal",
          lead,
          opportunity: opp,
          lastActivityAt,
        });
        continue;
      }

      // 4) STALE — no activity for > STALE_HOURS, no terminal
      if (hoursSince > STALE_HOURS) {
        rows.push({
          bucket: "stale",
          reason: `no activity for >${STALE_HOURS}h`,
          lead,
          opportunity: opp,
          lastActivityAt,
        });
        continue;
      }

      // 5) ACTIVE — recent activity, no terminal
      rows.push({
        bucket: "active",
        reason: "recent activity, no terminal signal",
        lead,
        opportunity: opp,
        lastActivityAt,
      });
    }

    const counts: Record<BucketKey, number> = {
      active: 0,
      stale: 0,
      dead: 0,
      recovery: 0,
      ambiguous: 0,
    };
    for (const r of rows) counts[r.bucket]++;

    return { rows, counts };
  }, [leads, oppsArr, routesArr]);

  const ambiguousRows = useMemo(
    () =>
      lifecycle.rows
        .filter((r) => r.bucket === "ambiguous")
        .sort((a, b) => a.lastActivityAt - b.lastActivityAt)
        .slice(0, 25),
    [lifecycle.rows]
  );

  const copyText = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  }, []);

  const sopText = useMemo(
    () =>
      [
        `WindowMan — Lifecycle SOP (operator)`,
        ``,
        `ACTIVE     → Leave in Active Pipeline / Routing Desk. No action needed.`,
        `STALE      → Open the Lead Dossier. Decide: nudge contractor, recover`,
        `             homeowner, or escalate to Ambiguous review.`,
        `DEAD       → Use the canonical mark_dead action only after manual`,
        `             review (Routing Desk → opportunity → mark dead).`,
        `RECOVERY   → Lead never verified phone. Treat as homeowner recovery,`,
        `             not contractor follow-up. Visit Ghost Recovery.`,
        `AMBIGUOUS  → Operator judgment required. Open the dossier and either`,
        `             route to a clean state or apply mark_dead manually.`,
        ``,
        `Notes:`,
        `  • Stale = no activity >${STALE_HOURS}h on a routed/active opp.`,
        `  • Ambiguous = >${REVIEW_BEFORE_DEAD_HOURS}h stale AND released-without-followup`,
        `    OR routed-without-signal. Always reviewed by a human.`,
        `  • There is no automated dead/recovery engine. Every transition`,
        `    is operator-driven.`,
      ].join("\n"),
    []
  );

  const goTab = useCallback(
    (tab: string) => {
      if (onNavigateTab) onNavigateTab(tab);
      else toast.info(`Open the “${tab}” tab to continue`);
    },
    [onNavigateTab]
  );

  const isLoading = oppsLoading || routesLoading;

  if (isLoading && leads.length === 0) {
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
              <LifeBuoy className="h-5 w-5 text-primary" />
              Lifecycle Workflow — Dead · Stale · Recovery
            </h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
              Internal operator surface that hardens manual handling of dead,
              stale, and recovery candidates. All groupings are deterministic
              operator-view derivations from real fields. The canonical{" "}
              <code className="px-1 py-0.5 rounded bg-muted text-[10px]">mark_dead</code>{" "}
              action remains the single dead-marking path — this surface only
              clarifies <em>when</em> to use it.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
              Internal · Operator Use
            </Badge>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => copyText(sopText, "Lifecycle SOP")}
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Copy SOP
            </Button>
          </div>
        </div>
      </div>

      {/* ── State Definitions / Current Truth ────────────────────── */}
      <Card>
        <CardHeader
          className="pb-3 cursor-pointer select-none"
          onClick={() => toggleSection("definitions")}
        >
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="h-4 w-4" />
            State Definitions
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-normal ml-1">
              current truth
            </span>
            <ChevronRight
              className={`h-4 w-4 ml-auto transition-transform ${
                openSection.definitions ? "rotate-90" : ""
              }`}
            />
          </CardTitle>
        </CardHeader>
        {openSection.definitions && (
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Definition
              icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              label="Active"
              modeled
              text="Routed and showing recent downstream activity within the last 72h. No terminal signal yet."
            />
            <Definition
              icon={<Clock className="h-4 w-4 text-amber-600" />}
              label="Stale"
              text="Routed but no activity for >72h and no terminal signal. Operator-view derivation from route + lead timestamps."
            />
            <Definition
              icon={<Skull className="h-4 w-4 text-rose-600" />}
              label="Dead"
              modeled
              text="Explicitly modeled: deal_status = 'dead' or closed_at is set. Written by the canonical mark_dead path only."
            />
            <Definition
              icon={<LifeBuoy className="h-4 w-4 text-blue-600" />}
              label="Recovery Candidate"
              text="Opportunity exists but the homeowner never phone_verified. Treat as homeowner recovery — see Ghost Recovery."
            />
            <Definition
              icon={<HelpCircle className="h-4 w-4 text-violet-600" />}
              label="Ambiguous / Needs Review"
              text="Routed or released >7d ago with no clean downstream signal. Requires operator judgment before any clean label is applied."
            />
          </CardContent>
        )}
      </Card>

      {/* ── State Separation / Queue Snapshot ────────────────────── */}
      <Card>
        <CardHeader
          className="pb-3 cursor-pointer select-none"
          onClick={() => toggleSection("snapshot")}
        >
          <CardTitle className="text-sm flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            Queue Snapshot
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-normal ml-1">
              operator view
            </span>
            <ChevronRight
              className={`h-4 w-4 ml-auto transition-transform ${
                openSection.snapshot ? "rotate-90" : ""
              }`}
            />
          </CardTitle>
        </CardHeader>
        {openSection.snapshot && (
          <CardContent className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Stat label="Active" value={lifecycle.counts.active} tone="emerald" />
            <Stat label="Stale" value={lifecycle.counts.stale} tone="amber" />
            <Stat label="Dead" value={lifecycle.counts.dead} tone="rose" />
            <Stat label="Recovery" value={lifecycle.counts.recovery} tone="blue" />
            <Stat
              label="Ambiguous"
              value={lifecycle.counts.ambiguous}
              tone="violet"
            />
          </CardContent>
        )}
      </Card>

      {/* ── Next Action Guidance ─────────────────────────────────── */}
      <Card>
        <CardHeader
          className="pb-3 cursor-pointer select-none"
          onClick={() => toggleSection("nextAction")}
        >
          <CardTitle className="text-sm flex items-center gap-2">
            <ChevronRight className="h-4 w-4" />
            Next Action Guidance
          </CardTitle>
        </CardHeader>
        {openSection.nextAction && (
          <CardContent className="space-y-2 text-sm">
            <ActionRow
              label="Route now"
              when="A new verified lead with a routable opportunity and no current contractor assignment."
              go={() => goTab("routing")}
              goLabel="Routing Desk"
            />
            <ActionRow
              label="Follow up"
              when="Routed opp with viewed/responded but no booking yet, within 72h window."
              go={() => goTab("pipeline")}
              goLabel="Active Pipeline"
            />
            <ActionRow
              label="Hold / observe"
              when="Routed opp with recent contractor signal but homeowner not yet engaged."
              go={() => goTab("outcomes")}
              goLabel="Outcomes"
            />
            <ActionRow
              label="Mark dead (canonical)"
              when="Explicit confirmation lead is unworkable. Use the canonical mark_dead action in Routing Desk → opportunity menu. Never simulate dead state in UI only."
              go={() => goTab("routing")}
              goLabel="Routing Desk"
            />
            <ActionRow
              label="Keep visible but stale"
              when="No activity >72h but not yet >7d. Leave in Stale; revisit before escalating."
              go={() => goTab("pipeline")}
              goLabel="Active Pipeline"
            />
            <ActionRow
              label="Treat as recovery"
              when="Opportunity exists but homeowner never verified. Use Ghost Recovery; do not route to a contractor."
              go={() => goTab("ghosts")}
              goLabel="Ghost Recovery"
            />
            <ActionRow
              label="Escalate to operator judgment"
              when="Released-without-followup or routed-without-signal beyond 7d. Open dossier, decide manually."
              go={() => goTab("routing")}
              goLabel="Routing Desk"
            />
          </CardContent>
        )}
      </Card>

      {/* ── Ambiguous / Needs Review ─────────────────────────────── */}
      <Card>
        <CardHeader
          className="pb-3 cursor-pointer select-none"
          onClick={() => toggleSection("ambiguous")}
        >
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-violet-600" />
            Ambiguous / Needs Operator Review
            <Badge variant="outline" className="ml-2 h-5 text-[10px]">
              {ambiguousRows.length}
            </Badge>
            <ChevronRight
              className={`h-4 w-4 ml-auto transition-transform ${
                openSection.ambiguous ? "rotate-90" : ""
              }`}
            />
          </CardTitle>
          <p className="text-[11px] text-muted-foreground mt-1">
            Leads that do not cleanly belong to active/stale/dead/recovery.
            Open the dossier, then either nudge the right party or apply{" "}
            <code className="px-1 rounded bg-muted text-[10px]">mark_dead</code>{" "}
            via Routing Desk.
          </p>
        </CardHeader>
        {openSection.ambiguous && (
          <CardContent>
            {ambiguousRows.length === 0 ? (
              <div className="text-xs text-muted-foreground py-6 text-center">
                No ambiguous lifecycle cases right now.
              </div>
            ) : (
              <div className="divide-y divide-border rounded-md border">
                {ambiguousRows.map((r) => {
                  const name =
                    [r.lead.first_name, r.lead.last_name]
                      .filter(Boolean)
                      .join(" ") || "Unnamed lead";
                  const county = r.lead.county || "Unknown County";
                  const ageHours = r.lastActivityAt
                    ? Math.round((Date.now() - r.lastActivityAt) / 36e5)
                    : null;
                  return (
                    <div
                      key={r.lead.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{name}</div>
                        <div className="text-muted-foreground truncate">
                          {county} · {r.reason}
                          {ageHours !== null && ` · ${ageHours}h since last activity`}
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

      {/* ── Dead / Recovery Safety Notes ─────────────────────────── */}
      <Card>
        <CardHeader
          className="pb-3 cursor-pointer select-none"
          onClick={() => toggleSection("notes")}
        >
          <CardTitle className="text-sm flex items-center gap-2">
            <XCircle className="h-4 w-4 text-muted-foreground" />
            Safety Notes / What This Workflow Does Not Do
          </CardTitle>
        </CardHeader>
        {openSection.notes && (
          <CardContent className="text-xs text-muted-foreground leading-relaxed space-y-2">
            <p>
              • There is <strong>no automated</strong> dead-marking, recovery
              campaign, reactivation drip, or task queue. Every lifecycle
              transition is operator-driven.
            </p>
            <p>
              • Stale, Recovery, and Ambiguous are{" "}
              <strong>operator-view derivations</strong> from real fields. They
              are not backend statuses and do not write anywhere.
            </p>
            <p>
              • The only canonical dead-marking path is the existing{" "}
              <code className="px-1 rounded bg-muted">mark_dead</code> admin
              action (Routing Desk → opportunity menu). This surface does not
              create a second dead-marking mechanism.
            </p>
            <p>
              • Recovery here means the homeowner abandoned before
              verification. Contractor-side reactivation is not modeled.
            </p>
            <p>
              • Counts and groupings reflect what is observable today; absence
              of signal does not prove a lead is dead.
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
          <QuickLink label="Ghost Recovery" onClick={() => goTab("ghosts")} />
          <QuickLink label="Outcome Tracking" onClick={() => goTab("outcomes")} />
          <QuickLink label="Operator Reporting" onClick={() => goTab("reporting")} />
          <QuickLink label="Launch Control" onClick={() => goTab("launch")} />
          <QuickLink label="Pilot Readiness" onClick={() => goTab("pilot")} />
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Subcomponents ─────────────────────────────────────────────────── */

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "emerald" | "amber" | "rose" | "blue" | "violet";
}) {
  const toneCls: Record<string, string> = {
    default: "text-foreground",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    rose: "text-rose-600",
    blue: "text-blue-600",
    violet: "text-violet-600",
  };
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <div className={`text-2xl font-semibold leading-none ${toneCls[tone]}`}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
        {label}
      </div>
    </div>
  );
}

function Definition({
  icon,
  label,
  text,
  modeled = false,
}: {
  icon: React.ReactNode;
  label: string;
  text: string;
  modeled?: boolean;
}) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-sm font-medium">{label}</span>
        <Badge
          variant="outline"
          className="ml-auto text-[9px] uppercase tracking-wider"
        >
          {modeled ? "modeled" : "operator view"}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}

function ActionRow({
  label,
  when,
  go,
  goLabel,
}: {
  label: string;
  when: string;
  go: () => void;
  goLabel: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border bg-card px-3 py-2">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
          {when}
        </div>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-[11px] shrink-0"
        onClick={go}
      >
        {goLabel}
        <ChevronRight className="h-3 w-3 ml-0.5" />
      </Button>
    </div>
  );
}

function QuickLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-8 text-xs"
      onClick={onClick}
    >
      {label}
      <ChevronRight className="h-3 w-3 ml-1" />
    </Button>
  );
}
