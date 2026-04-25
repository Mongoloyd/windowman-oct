/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DATA QUALITY / FIELD INTEGRITY AUDIT — Phase 23
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Internal operator surface for reviewing where current repo-real data is
 * clean, sparse, or relying on operator-derived fallbacks.
 *
 * This is NOT a validation backend, NOT a repair workflow, NOT a scoring
 * engine. It composes existing repo-real reads (leads, opportunities, routes,
 * contractors) and exposes deterministic completeness summaries.
 *
 * COMPLETENESS LABELS (operator-view, deterministic, frontend-only):
 *   • "strong"     — field present on ≥80% of in-scope records
 *   • "partial"    — field present on 40–79% of in-scope records
 *   • "sparse"     — field present on <40% of in-scope records
 *   • "n/a"        — no records in scope to evaluate
 *
 * NO new edge functions. NO schema changes. NO persisted audit notes.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  RefreshCw,
  MapPin,
  Users,
  Route as RouteIcon,
  Inbox,
  ShieldAlert,
  ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  fetchContractors,
  fetchOpportunities,
  fetchRoutes,
} from "@/services/adminDataService";
import type {
  RoutingOpportunity,
  RoutingRoute,
  RoutingContractor,
} from "@/types/routingDesk";
import type { CRMLead } from "@/components/admin/types";

type Completeness = "strong" | "partial" | "sparse" | "n/a";

interface FieldRow {
  key: string;
  label: string;
  detail: string;
  present: number;
  total: number;
}

interface FieldGroup {
  id: string;
  title: string;
  icon: typeof Database;
  intent: string;
  jumpToTab?: { tab: string; label: string };
  rows: FieldRow[];
}

interface FallbackRow {
  key: string;
  label: string;
  detail: string;
  count: number;
  total: number;
}

interface DataQualityFieldIntegritySurfaceProps {
  leads: CRMLead[];
  onNavigateTab?: (tab: string) => void;
}

const QUICK_LINKS: Array<{ tab: string; label: string; desc: string }> = [
  { tab: "pipeline", label: "Active Pipeline", desc: "Live opportunities + ownership." },
  { tab: "routing", label: "Routing Desk", desc: "Canonical routing path." },
  { tab: "contractors", label: "Contractors", desc: "Contractor account directory." },
  { tab: "outcomes", label: "Outcome Tracking", desc: "Booked / closed visibility." },
  { tab: "reporting", label: "Operator Reporting / Export", desc: "Composed reads + export." },
  { tab: "shared-market", label: "Shared Market Manual Controls", desc: "Manual market overrides." },
  { tab: "audit", label: "Pilot-to-Platform Audit", desc: "Honest pilot vs platform read." },
  { tab: "readiness", label: "Launch Readiness", desc: "Operator pre-launch checks." },
];

/**
 * Deterministic completeness classifier.
 * Strong ≥ 80%, Partial ≥ 40%, Sparse otherwise. No samples → n/a.
 * This is operator-view only and intentionally simple.
 */
export function classify(present: number, total: number): Completeness {
  if (total === 0) return "n/a";
  const ratio = present / total;
  if (ratio >= 0.8) return "strong";
  if (ratio >= 0.4) return "partial";
  return "sparse";
}

export function nonEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return Number.isFinite(v);
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function StatusBadge({ status }: { status: Completeness }) {
  if (status === "strong") {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/15">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Strong
      </Badge>
    );
  }
  if (status === "partial") {
    return (
      <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/15">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Partial
      </Badge>
    );
  }
  if (status === "sparse") {
    return (
      <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/15">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Sparse
      </Badge>
    );
  }
  return (
    <Badge className="bg-muted text-slate-700 border-border hover:bg-muted">
      <HelpCircle className="h-3 w-3 mr-1" />
      No data
    </Badge>
  );
}

export function DataQualityFieldIntegritySurface({
  leads,
  onNavigateTab,
}: DataQualityFieldIntegritySurfaceProps) {
  const { toast } = useToast();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    leads: true,
    routing: true,
    contractors: false,
    geography: false,
  });

  const opportunitiesQuery = useQuery<RoutingOpportunity[]>({
    queryKey: ["dq.opportunities"],
    queryFn: () => fetchOpportunities(),
    staleTime: 60_000,
  });
  const routesQuery = useQuery<RoutingRoute[]>({
    queryKey: ["dq.routes"],
    queryFn: () => fetchRoutes(),
    staleTime: 60_000,
  });
  const contractorsQuery = useQuery<RoutingContractor[]>({
    queryKey: ["dq.contractors"],
    queryFn: () => fetchContractors(),
    staleTime: 60_000,
  });

  const opportunities: RoutingOpportunity[] = opportunitiesQuery.data ?? [];
  const routes: RoutingRoute[] = routesQuery.data ?? [];
  const contractors: RoutingContractor[] = contractorsQuery.data ?? [];

  const refetchAll = () => {
    opportunitiesQuery.refetch();
    routesQuery.refetch();
    contractorsQuery.refetch();
  };

  /* ── Field groups (deterministic completeness counts) ─────────────── */
  const groups: FieldGroup[] = useMemo(() => {
    const leadTotal = leads.length;
    const oppTotal = opportunities.length;
    const routeTotal = routes.length;
    const contractorTotal = contractors.length;

    const countLeads = (pred: (l: CRMLead) => boolean) =>
      leads.reduce((acc, l) => acc + (pred(l) ? 1 : 0), 0);
    const countOpps = (pred: (o: RoutingOpportunity) => boolean) =>
      opportunities.reduce((acc, o) => acc + (pred(o) ? 1 : 0), 0);
    const countRoutes = (pred: (r: RoutingRoute) => boolean) =>
      routes.reduce((acc, r) => acc + (pred(r) ? 1 : 0), 0);
    const countContractors = (pred: (c: RoutingContractor) => boolean) =>
      contractors.reduce((acc, c) => acc + (pred(c) ? 1 : 0), 0);

    return [
      {
        id: "leads",
        title: "Lead data integrity",
        icon: Inbox,
        intent:
          "Identity, contact, and verified-state coverage on lead records used by routing, dossier, and outcome workflows.",
        jumpToTab: { tab: "pipeline", label: "Open Active Pipeline" },
        rows: [
          {
            key: "lead.first_name",
            label: "First name present",
            detail: "Used in dossier headers and contractor briefs.",
            present: countLeads((l) => nonEmpty(l.first_name)),
            total: leadTotal,
          },
          {
            key: "lead.email",
            label: "Email present",
            detail: "Required for snapshot delivery + reactivation.",
            present: countLeads((l) => nonEmpty(l.email)),
            total: leadTotal,
          },
          {
            key: "lead.phone",
            label: "Phone (E.164) present",
            detail: "Required for OTP and contractor handoff.",
            present: countLeads((l) => nonEmpty(l.phone_e164)),
            total: leadTotal,
          },
          {
            key: "lead.phone_verified",
            label: "Phone verified",
            detail: "Drives the report unlock / handoff gate.",
            present: countLeads((l) => l.phone_verified === true),
            total: leadTotal,
          },
          {
            key: "lead.latest_analysis",
            label: "Latest analysis attached",
            detail: "Required for grade/flag context in dossier and routing.",
            present: countLeads((l) => nonEmpty(l.latest_analysis_id)),
            total: leadTotal,
          },
          {
            key: "lead.grade",
            label: "Grade present",
            detail: "Operator-view triage signal in pipeline + routing.",
            present: countLeads((l) => nonEmpty(l.grade)),
            total: leadTotal,
          },
        ],
      },
      {
        id: "routing",
        title: "Routing / ownership field integrity",
        icon: RouteIcon,
        intent:
          "Fields that determine whether a lead can move through routing, contact release, and outcome capture.",
        jumpToTab: { tab: "routing", label: "Open Routing Desk" },
        rows: [
          {
            key: "lead.intro_requested",
            label: "Intro requested timestamp",
            detail: "Marks an opportunity entering the routing surface.",
            present: countLeads((l) => nonEmpty(l.intro_requested_at)),
            total: leadTotal,
          },
          {
            key: "lead.routed_to_contractor",
            label: "Routed-to-contractor timestamp",
            detail: "Indicates the lead was actively routed to a contractor.",
            present: countLeads((l) => nonEmpty(l.routed_to_contractor_at)),
            total: leadTotal,
          },
          {
            key: "lead.appointment_booked",
            label: "Appointment booked timestamp",
            detail: "Required for booked-state visibility in Outcomes.",
            present: countLeads((l) => nonEmpty(l.appointment_booked_at)),
            total: leadTotal,
          },
          {
            key: "lead.closed_at",
            label: "Closed timestamp",
            detail: "Required for closed-state lifecycle review.",
            present: countLeads((l) => nonEmpty(l.closed_at)),
            total: leadTotal,
          },
          {
            key: "opp.county",
            label: "Opportunity county",
            detail: "Used for market grouping and routing filters.",
            present: countOpps((o) => nonEmpty(o.county)),
            total: oppTotal,
          },
          {
            key: "opp.suggested_contractor",
            label: "Suggested contractor on opportunity",
            detail: "Operator-view starting point for routing decisions.",
            present: countOpps((o) => nonEmpty(o.suggested_contractor_id)),
            total: oppTotal,
          },
          {
            key: "route.contractor_id",
            label: "Route → contractor link",
            detail: "Joins the route record to a real contractor.",
            present: countRoutes((r) => nonEmpty(r.contractor_id)),
            total: routeTotal,
          },
          {
            key: "route.responded",
            label: "Route response captured",
            detail: "Indicates the contractor side of the route was acted on.",
            present: countRoutes((r) => nonEmpty(r.responded_at)),
            total: routeTotal,
          },
        ],
      },
      {
        id: "contractors",
        title: "Contractor field integrity",
        icon: Users,
        intent:
          "Coverage on the contractor records the operator references during routing and contact release.",
        jumpToTab: { tab: "contractors", label: "Open Contractors" },
        rows: [
          {
            key: "contractor.company_name",
            label: "Company name",
            detail: "Displayed in routing + dossier surfaces.",
            present: countContractors((c) => nonEmpty(c.company_name)),
            total: contractorTotal,
          },
          {
            key: "contractor.contact_name",
            label: "Contact name",
            detail: "Helpful for operator-to-contractor outreach.",
            present: countContractors((c) => nonEmpty(c.contact_name)),
            total: contractorTotal,
          },
          {
            key: "contractor.email",
            label: "Email",
            detail: "Used for handoff / contact release follow-up.",
            present: countContractors((c) => nonEmpty(c.email)),
            total: contractorTotal,
          },
          {
            key: "contractor.status_active",
            label: "Status active",
            detail: "Indicates the contractor is currently routable.",
            present: countContractors((c) => c.status === "active"),
            total: contractorTotal,
          },
        ],
      },
      {
        id: "geography",
        title: "Geography / market data integrity",
        icon: MapPin,
        intent:
          "Coverage on the geography fields used for county / market grouping in pipeline and shared-market views.",
        jumpToTab: { tab: "shared-market", label: "Open Shared Market" },
        rows: [
          {
            key: "lead.county",
            label: "Lead county",
            detail: "Required for clean market grouping; otherwise falls back to Unknown County.",
            present: countLeads((l) => nonEmpty(l.county)),
            total: leadTotal,
          },
          {
            key: "lead.city",
            label: "Lead city",
            detail: "Helps operator confirm the lead is in-region.",
            present: countLeads((l) => nonEmpty(l.city)),
            total: leadTotal,
          },
          {
            key: "lead.state",
            label: "Lead state",
            detail: "Used for service-area sanity checks.",
            present: countLeads((l) => nonEmpty(l.state)),
            total: leadTotal,
          },
          {
            key: "lead.zip",
            label: "Lead zip",
            detail: "Optional but improves market grouping precision.",
            present: countLeads((l) => nonEmpty(l.zip)),
            total: leadTotal,
          },
        ],
      },
    ];
  }, [leads, opportunities, routes, contractors]);

  /* ── Fallback / operator-derived usage (current-state visibility) ──── */
  const fallbacks: FallbackRow[] = useMemo(() => {
    const leadTotal = leads.length;
    const oppTotal = opportunities.length;

    const unknownCountyLeads = leads.filter((l) => !nonEmpty(l.county)).length;
    const unknownCountyOpps = opportunities.filter((o) => !nonEmpty(o.county)).length;
    const noGradeLeads = leads.filter((l) => !nonEmpty(l.grade)).length;
    const noOwnerOpps = opportunities.filter((o) => !nonEmpty(o.suggested_contractor_id)).length;
    const unverifiedWithAnalysis = leads.filter(
      (l) => nonEmpty(l.latest_analysis_id) && l.phone_verified !== true,
    ).length;

    return [
      {
        key: "fallback.unknown_county_lead",
        label: "Leads grouped under Unknown County",
        detail: "Falls back when lead.county is missing. Affects market grouping.",
        count: unknownCountyLeads,
        total: leadTotal,
      },
      {
        key: "fallback.unknown_county_opp",
        label: "Opportunities grouped under Unknown County",
        detail: "Falls back when opportunity.county is missing.",
        count: unknownCountyOpps,
        total: oppTotal,
      },
      {
        key: "fallback.no_grade",
        label: "Leads with no grade (operator-view triage)",
        detail: "Operator-view triage compensates for missing grade in pipeline.",
        count: noGradeLeads,
        total: leadTotal,
      },
      {
        key: "fallback.no_owner",
        label: "Opportunities without a suggested contractor",
        detail: "Operator manually selects a contractor when no suggestion exists.",
        count: noOwnerOpps,
        total: oppTotal,
      },
      {
        key: "fallback.unverified_with_analysis",
        label: "Analyses with unverified phone",
        detail: "Surfaced as ghosts; reveal stays gated behind OTP.",
        count: unverifiedWithAnalysis,
        total: leadTotal,
      },
    ];
  }, [leads, opportunities]);

  const summary = useMemo(() => {
    const all = groups.flatMap((g) => g.rows);
    const counts = { strong: 0, partial: 0, sparse: 0, na: 0 };
    for (const r of all) {
      const c = classify(r.present, r.total);
      if (c === "strong") counts.strong++;
      else if (c === "partial") counts.partial++;
      else if (c === "sparse") counts.sparse++;
      else counts.na++;
    }
    return counts;
  }, [groups]);

  const cautions = useMemo(() => {
    const out: string[] = [];
    if (leads.length === 0) {
      out.push("No leads loaded — completeness reads are not meaningful yet.");
    }
    if (contractors.length === 0) {
      out.push("No contractors loaded — contractor field coverage cannot be evaluated.");
    }
    if (opportunities.length === 0) {
      out.push("No opportunities loaded — routing field coverage cannot be evaluated.");
    }
    if (summary.sparse > 0) {
      out.push(`${summary.sparse} field(s) are sparse (<40% present) — review before broader rollout.`);
    }
    return out;
  }, [leads, contractors, opportunities, summary]);

  const copySummary = async () => {
    const lines: string[] = [];
    lines.push("Data Quality / Field Integrity — Operator Snapshot");
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push("");
    lines.push(
      `Summary: ${summary.strong} strong · ${summary.partial} partial · ${summary.sparse} sparse · ${summary.na} no-data`,
    );
    lines.push("");
    for (const g of groups) {
      lines.push(`## ${g.title}`);
      for (const r of g.rows) {
        const c = classify(r.present, r.total);
        const pct = r.total > 0 ? Math.round((r.present / r.total) * 100) : 0;
        lines.push(`- [${c}] ${r.label}: ${r.present}/${r.total} (${pct}%)`);
      }
      lines.push("");
    }
    lines.push("## Fallback / operator-derived usage");
    for (const f of fallbacks) {
      const pct = f.total > 0 ? Math.round((f.count / f.total) * 100) : 0;
      lines.push(`- ${f.label}: ${f.count}/${f.total} (${pct}%)`);
    }
    if (cautions.length) {
      lines.push("");
      lines.push("## Cautions");
      for (const c of cautions) lines.push(`- ${c}`);
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast({ title: "Snapshot copied", description: "Plain-text data quality summary on clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Clipboard unavailable in this context.", variant: "destructive" });
    }
  };

  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border bg-card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5 mt-0.5">
              <Database className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-semibold tracking-tight">
                Data Quality / Field Integrity Audit
              </h2>
              <p className="text-sm text-slate-700 mt-1 max-w-2xl">
                Read-only operator view of where current repo-real fields are present, sparse, or relying on
                operator-derived fallbacks. No validation backend, no repair workflow — just an honest field-coverage
                read across the surfaces you already use.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={refetchAll} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button size="sm" variant="outline" onClick={copySummary} className="gap-1.5">
              <Copy className="h-3.5 w-3.5" />
              Copy snapshot
            </Button>
          </div>
        </div>

        {/* Summary chips */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-lg border bg-emerald-500/5 border-emerald-500/30 px-3 py-2.5">
            <div className="text-[11px] uppercase tracking-wide text-emerald-700 dark:text-emerald-400 font-semibold">
              Strong
            </div>
            <div className="text-xl font-semibold mt-0.5">{summary.strong}</div>
          </div>
          <div className="rounded-lg border bg-amber-500/5 border-amber-500/30 px-3 py-2.5">
            <div className="text-[11px] uppercase tracking-wide text-amber-700 dark:text-amber-400 font-semibold">
              Partial
            </div>
            <div className="text-xl font-semibold mt-0.5">{summary.partial}</div>
          </div>
          <div className="rounded-lg border bg-rose-500/5 border-rose-500/30 px-3 py-2.5">
            <div className="text-[11px] uppercase tracking-wide text-rose-700 dark:text-rose-400 font-semibold">
              Sparse
            </div>
            <div className="text-xl font-semibold mt-0.5">{summary.sparse}</div>
          </div>
          <div className="rounded-lg border bg-muted/40 px-3 py-2.5">
            <div className="text-[11px] uppercase tracking-wide text-slate-700 font-semibold">
              No data
            </div>
            <div className="text-xl font-semibold mt-0.5">{summary.na}</div>
          </div>
        </div>

        <p className="text-[11px] text-slate-700 mt-3 leading-relaxed">
          Classification is operator-view: <span className="font-semibold">Strong</span> ≥80%,{" "}
          <span className="font-semibold">Partial</span> 40–79%, <span className="font-semibold">Sparse</span> &lt;40%.
          No data persistence, no validation backend.
        </p>
      </div>

      {/* Field groups */}
      <div className="space-y-4">
        {groups.map((g) => {
          const open = openGroups[g.id] ?? false;
          const Icon = g.icon;
          return (
            <div key={g.id} className="rounded-xl border bg-card overflow-hidden">
              <button
                type="button"
                onClick={() => toggleGroup(g.id)}
                className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 hover:bg-muted/40 transition-colors text-left"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="rounded-md bg-primary/10 p-1.5 mt-0.5 shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{g.title}</div>
                    <div className="text-xs text-slate-700 mt-0.5 line-clamp-2">{g.intent}</div>
                  </div>
                </div>
                <div className="shrink-0 text-slate-700">
                  {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </div>
              </button>
              {open && (
                <div className="border-t">
                  <div className="divide-y">
                    {g.rows.map((r) => {
                      const c = classify(r.present, r.total);
                      const pct = r.total > 0 ? Math.round((r.present / r.total) * 100) : 0;
                      return (
                        <div
                          key={r.key}
                          className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium">{r.label}</div>
                            <div className="text-xs text-slate-700 mt-0.5">{r.detail}</div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-xs text-slate-700 tabular-nums">
                              {r.present}/{r.total}
                              {r.total > 0 ? ` · ${pct}%` : ""}
                            </div>
                            <StatusBadge status={c} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {g.jumpToTab && onNavigateTab && (
                    <div className="px-4 sm:px-5 py-3 border-t bg-muted/20 flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onNavigateTab(g.jumpToTab!.tab)}
                        className="gap-1.5 text-xs"
                      >
                        {g.jumpToTab.label}
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

      {/* Fallback / operator-derived usage */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-amber-500/10 p-1.5 mt-0.5">
            <ListChecks className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm">Fallback / operator-derived usage</h3>
            <p className="text-xs text-slate-700 mt-0.5 max-w-2xl">
              Where the UI substitutes a safe label or an operator-derived classification because raw fields are absent.
              These are not bugs — they are honest fallbacks. They become problems only at scale.
            </p>
          </div>
        </div>
        <div className="mt-4 divide-y border-t border-b">
          {fallbacks.map((f) => {
            const pct = f.total > 0 ? Math.round((f.count / f.total) * 100) : 0;
            return (
              <div
                key={f.key}
                className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">{f.label}</div>
                  <div className="text-xs text-slate-700 mt-0.5">{f.detail}</div>
                </div>
                <div className="text-xs text-slate-700 tabular-nums shrink-0">
                  {f.count}/{f.total}
                  {f.total > 0 ? ` · ${pct}%` : ""}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cautions */}
      {cautions.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-rose-500/10 p-1.5 mt-0.5">
              <ShieldAlert className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm">Current data gaps / cautions</h3>
              <p className="text-xs text-slate-700 mt-0.5">
                Honest, current-state observations. No automated repair — review and address manually.
              </p>
            </div>
          </div>
          <ul className="mt-3 space-y-1.5 text-sm">
            {cautions.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-slate-700">
                <span className="text-rose-600 dark:text-rose-400 mt-0.5">•</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Quick links */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="font-semibold text-sm">Jump to impacted surfaces</h3>
        <p className="text-xs text-slate-700 mt-0.5">
          Surfaces whose UX depends on the field coverage above.
        </p>
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
