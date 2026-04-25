/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EXCEPTION HANDLING / MANUAL ESCALATION REVIEW — Phase 24
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Internal operator surface for reviewing records that do not fit cleanly
 * into routing/outcome/recovery buckets and require manual judgment.
 *
 * This is NOT a ticket system, NOT a backend escalation queue, NOT an
 * automated assignment engine. It composes existing repo-real reads
 * (`leads`, `contractor_opportunities`, `contractor_opportunity_routes`)
 * and exposes deterministic, frontend-only exception classifications.
 *
 * EXCEPTION CATEGORIES (deterministic, repo-real):
 *
 *   1. Ownership / Release ambiguities
 *      • opportunity has `intro_requested_at` but no route record
 *      • multiple non-terminal routes on the same opportunity
 *      • route has `release_requested_at` but `release_status` ≠ approved/denied
 *      • opportunity `homeowner_contact_released_at` set but no
 *        corresponding route with `contact_released = true`
 *
 *   2. Outcome / Feedback ambiguities
 *      • lead has `appointment_booked_at` but no `closed_at` for ≥30 days
 *      • lead has `replacement_quote_submitted_at` but no
 *        `appointment_booked_at` (out-of-order signals)
 *      • lead `closed_at` set but no `deal_status`
 *
 *   3. Dead / Stale / Recovery ambiguities
 *      • lead `report_unlocked_at` >14d ago, never `routed_to_contractor_at`,
 *        never `reactivation_email_sent_at`
 *      • lead `routed_to_contractor_at` >21d ago, no
 *        `appointment_booked_at`, no `closed_at`
 *      • lead `last_call_completed_at` >14d ago and `last_call_outcome`
 *        is null/empty
 *
 *   4. Reporting / Contractor-safe ambiguities
 *      • lead has analysis but `phone_verified` is false (visible only as
 *        ghost — should never be reported as a real handoff)
 *      • opportunity has no `county` (will land under Unknown County in any
 *        market-grouped report)
 *      • lead has `intro_requested_at` but no `latest_analysis_id` (cannot
 *        produce a contractor-safe brief)
 *
 * NO new edge functions. NO schema changes. NO persisted review state.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  Inbox,
  Route as RouteIcon,
  ClipboardList,
  Activity,
  FileText,
  ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  fetchOpportunities,
  fetchRoutes,
} from "@/services/adminDataService";
import type {
  RoutingOpportunity,
  RoutingRoute,
} from "@/types/routingDesk";
import type { CRMLead } from "@/components/admin/types";

interface ExceptionItem {
  key: string;
  /** Human-readable identifier for this record (lead name / opportunity id slice). */
  label: string;
  /** Why the record is ambiguous, in plain operator language. */
  reason: string;
  /** Suggested manual next action (no automation implied). */
  nextAction: string;
  /** Which admin tab the operator should jump to next. */
  jumpTab?: string;
}

interface ExceptionCategory {
  id: string;
  title: string;
  intent: string;
  icon: typeof AlertTriangle;
  jumpToTab?: { tab: string; label: string };
  items: ExceptionItem[];
}

interface ExceptionHandlingManualEscalationSurfaceProps {
  leads: CRMLead[];
  onNavigateTab?: (tab: string) => void;
}

const QUICK_LINKS: Array<{ tab: string; label: string; desc: string }> = [
  { tab: "routing", label: "Routing Desk", desc: "Resolve ownership / release ambiguities." },
  { tab: "lifecycle", label: "Dead / Stale / Recovery", desc: "Work stale + reactivation candidates." },
  { tab: "outcomes", label: "Outcome Tracking", desc: "Confirm booked / closed states." },
  { tab: "feedback", label: "Contractor Feedback Loop", desc: "Capture contractor-side signals." },
  { tab: "shared-market", label: "Shared Market Manual Controls", desc: "Override market grouping." },
  { tab: "reporting", label: "Operator Reporting / Export", desc: "Cross-check exception counts." },
  { tab: "data-quality", label: "Data Quality / Field Integrity", desc: "Field coverage context." },
  { tab: "pipeline", label: "Active Pipeline", desc: "Open the lead in dossier view." },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function nonEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return Number.isFinite(v);
  return true;
}

function leadDisplayName(l: CRMLead): string {
  const first = (l.first_name ?? "").trim();
  const last = (l.last_name ?? "").trim();
  const full = `${first} ${last}`.trim();
  if (full) return full;
  if (l.email) return l.email;
  if (l.phone_e164) return l.phone_e164;
  return `Lead ${l.id.slice(0, 8)}`;
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / DAY_MS);
}

export function ExceptionHandlingManualEscalationSurface({
  leads,
  onNavigateTab,
}: ExceptionHandlingManualEscalationSurfaceProps) {
  const { toast } = useToast();
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    ownership: true,
    outcome: true,
    lifecycle: false,
    reporting: false,
  });

  const opportunitiesQuery = useQuery<RoutingOpportunity[]>({
    queryKey: ["exc.opportunities"],
    queryFn: () => fetchOpportunities(),
    staleTime: 60_000,
  });
  const routesQuery = useQuery<RoutingRoute[]>({
    queryKey: ["exc.routes"],
    queryFn: () => fetchRoutes(),
    staleTime: 60_000,
  });

  const opportunities: RoutingOpportunity[] = opportunitiesQuery.data ?? [];
  const routes: RoutingRoute[] = routesQuery.data ?? [];

  const refetchAll = () => {
    opportunitiesQuery.refetch();
    routesQuery.refetch();
  };

  const leadsById = useMemo(() => {
    const m = new Map<string, CRMLead>();
    for (const l of leads) m.set(l.id, l);
    return m;
  }, [leads]);

  const routesByOpportunity = useMemo(() => {
    const m = new Map<string, RoutingRoute[]>();
    for (const r of routes) {
      const arr = m.get(r.opportunity_id) ?? [];
      arr.push(r);
      m.set(r.opportunity_id, arr);
    }
    return m;
  }, [routes]);

  /* ── Deterministic exception derivations ─────────────────────────── */
  const categories: ExceptionCategory[] = useMemo(() => {
    /* 1. Ownership / Release ambiguities */
    const ownership: ExceptionItem[] = [];
    for (const opp of opportunities) {
      const oppRoutes = routesByOpportunity.get(opp.id) ?? [];
      const lead = opp.lead_id ? leadsById.get(opp.lead_id) : undefined;
      const labelBase = lead
        ? leadDisplayName(lead)
        : `Opportunity ${opp.id.slice(0, 8)}`;

      // intro requested but no route created
      if (opp.intro_requested_at && oppRoutes.length === 0) {
        ownership.push({
          key: `own.no-route.${opp.id}`,
          label: labelBase,
          reason:
            "Intro was requested but no route record exists yet. Operator has not selected a contractor.",
          nextAction:
            "Open Routing Desk → assign or decline a contractor for this opportunity.",
          jumpTab: "routing",
        });
      }

      // multiple non-terminal routes (interested + still open) — ambiguous active ownership
      const nonTerminal = oppRoutes.filter(
        (r) =>
          r.route_status !== "declined" &&
          r.route_status !== "expired" &&
          r.route_status !== "withdrawn",
      );
      if (nonTerminal.length > 1) {
        ownership.push({
          key: `own.multi-active.${opp.id}`,
          label: labelBase,
          reason: `${nonTerminal.length} non-terminal routes exist on this opportunity. Active ownership is ambiguous.`,
          nextAction:
            "Open Routing Desk → close out stale routes so a single owner is clear.",
          jumpTab: "routing",
        });
      }

      // release requested but not reviewed
      for (const r of oppRoutes) {
        if (
          r.release_requested_at &&
          r.release_status !== "approved" &&
          r.release_status !== "denied"
        ) {
          ownership.push({
            key: `own.release-pending.${r.id}`,
            label: labelBase,
            reason:
              "A contact-release was requested on this route but has not been approved or denied.",
            nextAction:
              "Open Routing Desk → review the release request and approve or deny with reason.",
            jumpTab: "routing",
          });
        }
      }

      // opportunity says contact released, but no route confirms it
      if (
        opp.homeowner_contact_released_at &&
        !oppRoutes.some((r) => r.contact_released === true)
      ) {
        ownership.push({
          key: `own.release-mismatch.${opp.id}`,
          label: labelBase,
          reason:
            "Opportunity is flagged as contact-released, but no route record has contact_released=true.",
          nextAction:
            "Open Routing Desk → confirm which contractor owns the release and update the route.",
          jumpTab: "routing",
        });
      }
    }

    /* 2. Outcome / Feedback ambiguities */
    const outcome: ExceptionItem[] = [];
    for (const l of leads) {
      const labelBase = leadDisplayName(l);

      // booked >30d but never closed
      const sinceBooked = daysSince(l.appointment_booked_at);
      if (
        l.appointment_booked_at &&
        !l.closed_at &&
        sinceBooked !== null &&
        sinceBooked >= 30
      ) {
        outcome.push({
          key: `out.booked-no-close.${l.id}`,
          label: labelBase,
          reason: `Booked ${sinceBooked}d ago with no closed_at recorded.`,
          nextAction:
            "Open Outcome Tracking → confirm with the contractor whether this closed won/lost or fell through.",
          jumpTab: "outcomes",
        });
      }

      // replacement quote submitted but never booked
      if (l.replacement_quote_submitted_at && !l.appointment_booked_at) {
        outcome.push({
          key: `out.quote-no-book.${l.id}`,
          label: labelBase,
          reason:
            "Replacement quote submitted but no appointment was booked. Out-of-order outcome signals.",
          nextAction:
            "Open Outcome Tracking → confirm whether an appointment actually occurred and backfill the timestamp, or correct the quote signal.",
          jumpTab: "outcomes",
        });
      }

      // closed but no deal_status
      if (l.closed_at && !nonEmpty(l.deal_status)) {
        outcome.push({
          key: `out.closed-no-status.${l.id}`,
          label: labelBase,
          reason: "Lead is closed but deal_status is empty (won / lost / dead unknown).",
          nextAction:
            "Open Active Pipeline → set the deal status so reporting reflects the true outcome.",
          jumpTab: "pipeline",
        });
      }
    }

    /* 3. Dead / Stale / Recovery ambiguities */
    const lifecycle: ExceptionItem[] = [];
    for (const l of leads) {
      const labelBase = leadDisplayName(l);

      // unlocked >14d, never routed, never reactivated
      const sinceUnlock = daysSince(l.report_unlocked_at);
      if (
        sinceUnlock !== null &&
        sinceUnlock >= 14 &&
        !l.routed_to_contractor_at &&
        !l.reactivation_email_sent_at
      ) {
        lifecycle.push({
          key: `life.unlock-no-action.${l.id}`,
          label: labelBase,
          reason: `Unlocked ${sinceUnlock}d ago, never routed, never reactivated.`,
          nextAction:
            "Open Dead / Stale / Recovery → decide whether to route, reactivate, or mark dead.",
          jumpTab: "lifecycle",
        });
      }

      // routed >21d, no booking, no close
      const sinceRouted = daysSince(l.routed_to_contractor_at);
      if (
        sinceRouted !== null &&
        sinceRouted >= 21 &&
        !l.appointment_booked_at &&
        !l.closed_at
      ) {
        lifecycle.push({
          key: `life.routed-no-progress.${l.id}`,
          label: labelBase,
          reason: `Routed ${sinceRouted}d ago with no booking or close on record.`,
          nextAction:
            "Open Dead / Stale / Recovery → ping the contractor or reassign manually.",
          jumpTab: "lifecycle",
        });
      }

      // last call >14d ago and outcome empty
      const sinceCall = daysSince(l.last_call_completed_at);
      if (
        sinceCall !== null &&
        sinceCall >= 14 &&
        !nonEmpty(l.last_call_outcome)
      ) {
        lifecycle.push({
          key: `life.call-no-outcome.${l.id}`,
          label: labelBase,
          reason: `Last call completed ${sinceCall}d ago but no outcome was captured.`,
          nextAction:
            "Open Active Pipeline → log the outcome of the last call so it stops surfacing as ambiguous.",
          jumpTab: "pipeline",
        });
      }
    }

    /* 4. Reporting / Contractor-safe ambiguities */
    const reporting: ExceptionItem[] = [];
    for (const l of leads) {
      const labelBase = leadDisplayName(l);

      // analysis exists but phone_verified is false → ghost; must not be reported as a handoff
      if (l.latest_analysis_id && l.phone_verified !== true) {
        reporting.push({
          key: `rep.unverified-analysis.${l.id}`,
          label: labelBase,
          reason:
            "Analysis exists but phone is not verified. Lead is a ghost and is not safe to report as a real handoff.",
          nextAction:
            "Leave gated. If you intend to route, treat as a recovery candidate from Dead / Stale / Recovery.",
          jumpTab: "lifecycle",
        });
      }
    }

    for (const opp of opportunities) {
      const lead = opp.lead_id ? leadsById.get(opp.lead_id) : undefined;
      const labelBase = lead
        ? leadDisplayName(lead)
        : `Opportunity ${opp.id.slice(0, 8)}`;

      // opportunity without county → falls into Unknown County in market-grouped reports
      if (!nonEmpty(opp.county)) {
        reporting.push({
          key: `rep.no-county.${opp.id}`,
          label: labelBase,
          reason:
            "Opportunity has no county. It will appear under Unknown County in any market-grouped report.",
          nextAction:
            "Open Shared Market Manual Controls → assign a county manually or confirm the lead is out of region.",
          jumpTab: "shared-market",
        });
      }

      // intro requested but no analysis → cannot produce a contractor-safe brief
      if (opp.intro_requested_at && lead && !nonEmpty(lead.latest_analysis_id)) {
        reporting.push({
          key: `rep.no-analysis.${opp.id}`,
          label: labelBase,
          reason:
            "Intro requested but the lead has no latest analysis. A contractor-safe brief cannot be generated.",
          nextAction:
            "Open Active Pipeline → confirm whether the scan failed or the lead never uploaded a quote.",
          jumpTab: "pipeline",
        });
      }
    }

    return [
      {
        id: "ownership",
        title: "Ownership / release ambiguities",
        icon: RouteIcon,
        intent:
          "Records where the active owner or release status cannot be determined from existing route data.",
        jumpToTab: { tab: "routing", label: "Open Routing Desk" },
        items: ownership,
      },
      {
        id: "outcome",
        title: "Outcome / feedback ambiguities",
        icon: ClipboardList,
        intent:
          "Records where booked / closed / quote-submitted signals conflict or are incomplete.",
        jumpToTab: { tab: "outcomes", label: "Open Outcome Tracking" },
        items: outcome,
      },
      {
        id: "lifecycle",
        title: "Dead / stale / recovery ambiguities",
        icon: Activity,
        intent:
          "Records that have aged past expected milestones with no clean dead/stale/recovery decision recorded.",
        jumpToTab: { tab: "lifecycle", label: "Open Dead / Stale / Recovery" },
        items: lifecycle,
      },
      {
        id: "reporting",
        title: "Reporting / contractor-safe ambiguities",
        icon: FileText,
        intent:
          "Records that would distort reporting or cannot be safely surfaced to a contractor in current state.",
        jumpToTab: { tab: "reporting", label: "Open Operator Reporting" },
        items: reporting,
      },
    ];
  }, [leads, opportunities, routesByOpportunity, leadsById]);

  const totals = useMemo(() => {
    const counts = categories.map((c) => c.items.length);
    const total = counts.reduce((a, b) => a + b, 0);
    return { total, byCategory: counts };
  }, [categories]);

  const suggestedActions = useMemo(() => {
    const out: string[] = [];
    if (categories[0].items.length > 0) {
      out.push(
        `Resolve ownership/release ambiguity on ${categories[0].items.length} record(s) before any routing decisions today.`,
      );
    }
    if (categories[1].items.length > 0) {
      out.push(
        `Confirm outcome state on ${categories[1].items.length} record(s) so reporting reflects reality.`,
      );
    }
    if (categories[2].items.length > 0) {
      out.push(
        `Make a manual dead/stale/recovery call on ${categories[2].items.length} aged record(s).`,
      );
    }
    if (categories[3].items.length > 0) {
      out.push(
        `Address ${categories[3].items.length} reporting/contractor-safe ambiguity item(s) before generating an external snapshot.`,
      );
    }
    if (out.length === 0) {
      out.push("No exceptions surfaced from current repo-real signals.");
    }
    return out;
  }, [categories]);

  const copySnapshot = async () => {
    const lines: string[] = [];
    lines.push("Exception Handling / Manual Escalation — Operator Snapshot");
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push("");
    lines.push(`Total exceptions: ${totals.total}`);
    lines.push("");
    for (const c of categories) {
      lines.push(`## ${c.title} (${c.items.length})`);
      if (c.items.length === 0) {
        lines.push("- none");
      } else {
        // Limit to first 25 per category so the snippet stays readable.
        const slice = c.items.slice(0, 25);
        for (const it of slice) {
          lines.push(`- ${it.label} — ${it.reason}`);
          lines.push(`  next: ${it.nextAction}`);
        }
        if (c.items.length > slice.length) {
          lines.push(`- (+${c.items.length - slice.length} more — review in app)`);
        }
      }
      lines.push("");
    }
    lines.push("## Suggested manual next actions");
    for (const s of suggestedActions) lines.push(`- ${s}`);

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast({
        title: "Snapshot copied",
        description: "Plain-text exception summary on clipboard.",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Clipboard unavailable in this context.",
        variant: "destructive",
      });
    }
  };

  const toggleCategory = (id: string) =>
    setOpenCategories((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border bg-card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5 mt-0.5">
              <ShieldAlert className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-semibold tracking-tight">
                Exception Handling / Manual Escalation Review
              </h2>
              <p className="text-sm text-slate-700 mt-1 max-w-2xl">
                Read-only operator view of records that don't fit cleanly into routing, outcome, or lifecycle
                buckets and need manual judgment. Derived deterministically from existing repo-real fields. No
                ticket queue, no automated escalation — just an honest list of what needs a human decision.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={refetchAll} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button size="sm" variant="outline" onClick={copySnapshot} className="gap-1.5">
              <Copy className="h-3.5 w-3.5" />
              Copy snapshot
            </Button>
          </div>
        </div>

        {/* Summary chips */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <div className="rounded-lg border bg-muted/40 px-3 py-2.5">
            <div className="text-[11px] uppercase tracking-wide text-slate-700 font-semibold">
              Total
            </div>
            <div className="text-xl font-semibold mt-0.5">{totals.total}</div>
          </div>
          {categories.map((c, i) => (
            <div
              key={c.id}
              className="rounded-lg border px-3 py-2.5 bg-background"
            >
              <div className="text-[11px] uppercase tracking-wide text-slate-700 font-semibold line-clamp-1">
                {c.title.split(" / ")[0]}
              </div>
              <div className="text-xl font-semibold mt-0.5">{totals.byCategory[i]}</div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-slate-700 mt-3 leading-relaxed">
          Classifications are deterministic from repo-real fields on{" "}
          <span className="font-mono">leads</span>,{" "}
          <span className="font-mono">contractor_opportunities</span>, and{" "}
          <span className="font-mono">contractor_opportunity_routes</span>. No persistence, no automation.
        </p>
      </div>

      {/* Categories */}
      <div className="space-y-4">
        {categories.map((c) => {
          const open = openCategories[c.id] ?? false;
          const Icon = c.icon;
          return (
            <div key={c.id} className="rounded-xl border bg-card overflow-hidden">
              <button
                type="button"
                onClick={() => toggleCategory(c.id)}
                className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 hover:bg-muted/40 transition-colors text-left"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="rounded-md bg-primary/10 p-1.5 mt-0.5 shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm flex items-center gap-2">
                      {c.title}
                      <Badge
                        variant="outline"
                        className={
                          c.items.length === 0
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                            : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                        }
                      >
                        {c.items.length}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-700 mt-0.5 line-clamp-2">{c.intent}</div>
                  </div>
                </div>
                <div className="shrink-0 text-slate-700">
                  {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </div>
              </button>
              {open && (
                <div className="border-t">
                  {c.items.length === 0 ? (
                    <div className="px-4 sm:px-5 py-6 text-sm text-slate-700 text-center">
                      No exceptions surfaced for this category from current repo-real signals.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {c.items.slice(0, 50).map((it) => (
                        <div
                          key={it.key}
                          className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium flex items-center gap-2">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                              <span className="truncate">{it.label}</span>
                            </div>
                            <div className="text-xs text-slate-700 mt-1 leading-relaxed">{it.reason}</div>
                            <div className="text-xs mt-1.5 leading-relaxed">
                              <span className="font-semibold text-foreground">Manual next: </span>
                              <span className="text-slate-700">{it.nextAction}</span>
                            </div>
                          </div>
                          {it.jumpTab && onNavigateTab && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onNavigateTab(it.jumpTab!)}
                              className="gap-1.5 text-xs shrink-0"
                            >
                              Jump
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                      {c.items.length > 50 && (
                        <div className="px-4 sm:px-5 py-3 text-xs text-slate-700 text-center bg-muted/20">
                          Showing first 50 of {c.items.length}. Resolve top items first, refresh to re-evaluate.
                        </div>
                      )}
                    </div>
                  )}
                  {c.jumpToTab && onNavigateTab && (
                    <div className="px-4 sm:px-5 py-3 border-t bg-muted/20 flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onNavigateTab(c.jumpToTab!.tab)}
                        className="gap-1.5 text-xs"
                      >
                        {c.jumpToTab.label}
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Suggested manual next actions */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-primary/10 p-1.5 mt-0.5">
            <ListChecks className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm">Suggested manual next actions</h3>
            <p className="text-xs text-slate-700 mt-0.5">
              Operator-priority list. No automation — these are decisions you take inside the relevant surfaces.
            </p>
          </div>
        </div>
        <ul className="mt-3 space-y-1.5 text-sm">
          {suggestedActions.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-slate-700">
              <span className="text-primary mt-0.5">•</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Quick links */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-muted p-1.5 mt-0.5">
            <Inbox className="h-4 w-4 text-slate-700" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm">Jump to relevant admin surfaces</h3>
            <p className="text-xs text-slate-700 mt-0.5">
              Surfaces where exceptions are actually resolved.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {QUICK_LINKS.map((q) => (
            <button
              key={q.tab}
              type="button"
              onClick={() => onNavigateTab?.(q.tab)}
              disabled={!onNavigateTab}
              className="text-left rounded-lg border bg-background hover:bg-muted/40 transition-colors px-3 py-2.5 disabled:opacity-100 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium">{q.label}</div>
                <ExternalLink className="h-3.5 w-3.5 text-slate-700 shrink-0" />
              </div>
              <div className="text-xs text-slate-700 mt-0.5">{q.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
