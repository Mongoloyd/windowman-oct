/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SHARED MARKET MANUAL CONTROLS — Phase 17
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Internal operator surface that exposes manual shared-market visibility:
 * current owner, prior owner(s), release/recovery context, observed contractor
 * overlap by county, and which opportunities appear manually reassignable.
 *
 * STRICT CONSTRAINTS (Phase 17):
 *   • Frontend only. Reads via `adminDataService` (invokeAdminData).
 *   • All shared-market labels are deterministic operator-view derivations
 *     from real route + lead + contractor fields. Comments inline below.
 *   • No new mutation paths. Routing actions are deferred to the canonical
 *     `RoutingDesk` via quick links — this surface does not invent a second
 *     routing or release mechanism.
 *   • No round-robin, no fairness engine, no territory enforcement, no
 *     seat / billing / portal logic. Everything not modeled is called out
 *     in "Current System Limits".
 *   • Local-only collapse + clipboard. No persisted control state.
 */

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRightLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Info,
  Lock,
  MapPin,
  Network,
  Unlock,
  Users,
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

type OwnershipBucket =
  | "locked_to_one_owner"        // single active route, contact not released, no closed/booked downstream
  | "released"                   // route.contact_released OR release_status='approved'
  | "manually_reassignable"      // released OR (≥2 historical routes AND no active terminal state)
  | "needs_review";              // mixed signals — operator must judge

interface OppRow {
  opportunity: RoutingOpportunity;
  routes: RoutingRoute[];
  currentOwner: RoutingContractor | null;
  priorOwners: RoutingContractor[];
  bucket: OwnershipBucket;
  reason: string;
  lead?: CRMLead;
}

const UNKNOWN_COUNTY = "Unknown County";

export function SharedMarketManualControlsSurface({ leads, onNavigateTab }: Props) {
  const [openSection, setOpenSection] = useState<Record<string, boolean>>({
    ownership: true,
    overlap: true,
    reassignable: true,
    limits: true,
  });

  const toggleSection = useCallback((key: string) => {
    setOpenSection((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // ─── Repo-real reads ──────────────────────────────────────────────
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

  // ─── Ownership bucketing (deterministic, operator-view) ───────────
  // For each opportunity:
  //   currentOwner    = contractor on the most-recent active route (no
  //                     contact_released and no terminal lead state).
  //                     If no active route, falls back to most-recent route.
  //   priorOwners     = contractors from older routes (deduped, excluding
  //                     currentOwner).
  //
  // Bucket precedence:
  //   locked_to_one_owner  = exactly one route, not released, lead not
  //                          closed and not booked
  //   released             = any route has contact_released OR
  //                          release_status='approved' (and no later active
  //                          owner without release)
  //   manually_reassignable= released OR (priorOwners.length ≥ 1 AND no
  //                          currently-locked active route)
  //   needs_review         = everything else (mixed signals, e.g. released
  //                          + new active route, or no routes at all)
  const computed = useMemo(() => {
    const oppRoutes = new Map<string, RoutingRoute[]>();
    for (const r of routesArr) {
      const list = oppRoutes.get(r.opportunity_id) ?? [];
      list.push(r);
      oppRoutes.set(r.opportunity_id, list);
    }
    const contractorById = new Map(contractorsArr.map((c) => [c.id, c]));
    const leadById = new Map(leads.map((l) => [l.id, l]));

    const rows: OppRow[] = [];

    for (const opp of oppsArr) {
      const list = (oppRoutes.get(opp.id) ?? []).slice().sort((a, b) => {
        const at = new Date(a.created_at).getTime();
        const bt = new Date(b.created_at).getTime();
        return bt - at; // newest first
      });

      const lead = leadById.get(opp.lead_id);
      const leadClosed =
        !!lead?.closed_at ||
        ["dead", "won", "lost"].includes(String(lead?.deal_status ?? ""));
      const leadBooked = !!lead?.appointment_booked_at;

      // current owner = newest non-released, non-terminal route
      const activeRoute =
        list.find(
          (r) =>
            !r.contact_released &&
            !r.contact_released_at &&
            r.release_status !== "approved" &&
            !leadClosed &&
            !leadBooked,
        ) ?? null;

      const newestRoute = list[0] ?? null;
      const ownerRoute = activeRoute ?? newestRoute;
      const currentOwner = ownerRoute
        ? contractorById.get(ownerRoute.contractor_id) ?? null
        : null;

      const priorOwnerIds = new Set<string>();
      for (const r of list) {
        if (ownerRoute && r.id === ownerRoute.id) continue;
        priorOwnerIds.add(r.contractor_id);
      }
      if (currentOwner) priorOwnerIds.delete(currentOwner.id);
      const priorOwners = Array.from(priorOwnerIds)
        .map((id) => contractorById.get(id))
        .filter((c): c is RoutingContractor => !!c);

      const anyReleased = list.some(
        (r) =>
          r.contact_released ||
          !!r.contact_released_at ||
          r.release_status === "approved",
      );

      let bucket: OwnershipBucket;
      let reason: string;

      if (list.length === 0) {
        bucket = "needs_review";
        reason = "no routes recorded for this opportunity";
      } else if (activeRoute && !anyReleased && list.length === 1) {
        bucket = "locked_to_one_owner";
        reason = "single active route, no release, no booking/closure";
      } else if (anyReleased && !activeRoute) {
        bucket = "released";
        reason = "release recorded and no current active owner";
      } else if (anyReleased && activeRoute) {
        // released history + a new active owner = mixed
        bucket = "needs_review";
        reason = "release recorded but a new active owner exists";
      } else if (!activeRoute && priorOwners.length >= 1) {
        bucket = "manually_reassignable";
        reason = "prior route history with no current active owner";
      } else if (activeRoute && list.length > 1) {
        bucket = "needs_review";
        reason = "multiple route rows; verify current ownership";
      } else {
        bucket = "needs_review";
        reason = "ambiguous ownership signals";
      }

      // Promote `released` to `manually_reassignable` for the operator
      // workflow surface (released contacts are by definition eligible
      // for manual reassignment even if no prior owner exists yet).
      if (bucket === "released") {
        bucket = "manually_reassignable";
        reason = `${reason} → eligible for manual reassignment`;
      }

      rows.push({
        opportunity: opp,
        routes: list,
        currentOwner,
        priorOwners,
        bucket,
        reason,
        lead,
      });
    }

    const counts: Record<OwnershipBucket, number> = {
      locked_to_one_owner: 0,
      released: 0,
      manually_reassignable: 0,
      needs_review: 0,
    };
    for (const r of rows) counts[r.bucket]++;

    return { rows, counts };
  }, [oppsArr, routesArr, contractorsArr, leads]);

  // ─── Observed contractor overlap by county ────────────────────────
  // Source of truth: contractors that appear in routes for opportunities
  // tied to a given county. This is *observed* overlap from real routing
  // data — NOT a formal territory map. `service_counties` on contractors
  // is intentionally not used here to avoid implying a configured policy.
  const overlap = useMemo(() => {
    const oppById = new Map(oppsArr.map((o) => [o.id, o]));
    const contractorById = new Map(contractorsArr.map((c) => [c.id, c]));

    // county → Map<contractorId, { contractor, oppCount }>
    const byCounty = new Map<
      string,
      Map<string, { contractor: RoutingContractor; oppIds: Set<string> }>
    >();

    for (const route of routesArr) {
      const opp = oppById.get(route.opportunity_id);
      if (!opp) continue;
      const county = (opp.county || "").trim() || UNKNOWN_COUNTY;
      const contractor = contractorById.get(route.contractor_id);
      if (!contractor) continue;

      let cMap = byCounty.get(county);
      if (!cMap) {
        cMap = new Map();
        byCounty.set(county, cMap);
      }
      let entry = cMap.get(contractor.id);
      if (!entry) {
        entry = { contractor, oppIds: new Set() };
        cMap.set(contractor.id, entry);
      }
      entry.oppIds.add(opp.id);
    }

    const rows = Array.from(byCounty.entries())
      .map(([county, cMap]) => ({
        county,
        contractors: Array.from(cMap.values())
          .map((e) => ({
            contractor: e.contractor,
            opportunityCount: e.oppIds.size,
          }))
          .sort((a, b) => b.opportunityCount - a.opportunityCount),
      }))
      .sort((a, b) => {
        // multi-contractor counties first, then by total volume
        const am = a.contractors.length > 1 ? 0 : 1;
        const bm = b.contractors.length > 1 ? 0 : 1;
        if (am !== bm) return am - bm;
        const av = a.contractors.reduce((s, x) => s + x.opportunityCount, 0);
        const bv = b.contractors.reduce((s, x) => s + x.opportunityCount, 0);
        return bv - av;
      });

    const multiContractorCounties = rows.filter(
      (r) => r.contractors.length > 1,
    ).length;

    return { rows, multiContractorCounties };
  }, [routesArr, oppsArr, contractorsArr]);

  const reassignableRows = useMemo(
    () =>
      computed.rows
        .filter(
          (r) =>
            r.bucket === "manually_reassignable" || r.bucket === "needs_review",
        )
        .sort((a, b) => {
          // manually_reassignable first
          if (a.bucket !== b.bucket) {
            return a.bucket === "manually_reassignable" ? -1 : 1;
          }
          return (
            new Date(b.opportunity.updated_at).getTime() -
            new Date(a.opportunity.updated_at).getTime()
          );
        })
        .slice(0, 30),
    [computed.rows],
  );

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
    return [
      `WindowMan — Shared Market Manual Controls (operator)`,
      ``,
      `Ownership buckets (operator-view, derived from real routes):`,
      `  locked to one owner:        ${c.locked_to_one_owner}`,
      `  manually reassignable:      ${c.manually_reassignable}`,
      `  needs operator review:      ${c.needs_review}`,
      ``,
      `Observed county overlap:`,
      `  counties with routing:      ${overlap.rows.length}`,
      `  counties with > 1 contractor observed: ${overlap.multiContractorCounties}`,
      ``,
      `Notes: This is observed overlap from real routing history, not a`,
      `formal territory map. Manual reassignment uses the canonical Routing`,
      `Desk — there is no automated round-robin, fairness engine, release-`,
      `to-network automation, or seat/billing model.`,
    ].join("\n");
  }, [computed, overlap]);

  const goTab = useCallback(
    (tab: string) => {
      if (onNavigateTab) onNavigateTab(tab);
      else toast.info(`Open the "${tab}" tab to continue`);
    },
    [onNavigateTab],
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
              <Network className="h-5 w-5 text-primary" />
              Shared Market — Manual Controls
            </h2>
            <p className="text-xs text-slate-700 mt-1 max-w-2xl leading-relaxed">
              Internal operator surface for shared-market visibility and manual
              review. Read-only. All ownership and overlap groupings are
              deterministic operator-view derivations from real route + lead
              data — there is no auto-routing, no round-robin, no fairness
              engine, and no territory enforcement.
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
              onClick={() => copyText(summaryText, "Shared market summary")}
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Copy Summary
            </Button>
          </div>
        </div>
      </div>

      {/* ── Ownership Snapshot ───────────────────────────────────── */}
      <Card>
        <CardHeader
          className="pb-3 cursor-pointer select-none"
          onClick={() => toggleSection("ownership")}
        >
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />
            Current Owner / Prior Owner / Release Context
            <ChevronRight
              className={`h-4 w-4 ml-auto transition-transform ${
                openSection.ownership ? "rotate-90" : ""
              }`}
            />
          </CardTitle>
          <p className="text-[11px] text-slate-700 mt-1">
            Per-opportunity ownership bucket derived from route history,
            release flags, and parent-lead terminal state.
          </p>
        </CardHeader>
        {openSection.ownership && (
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat
              label="Locked to one owner"
              value={computed.counts.locked_to_one_owner}
              icon={<Lock className="h-3.5 w-3.5" />}
            />
            <Stat
              label="Manually reassignable"
              value={computed.counts.manually_reassignable}
              icon={<ArrowRightLeft className="h-3.5 w-3.5" />}
            />
            <Stat
              label="Needs review"
              value={computed.counts.needs_review}
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
            />
            <Stat
              label="Total opportunities"
              value={computed.rows.length}
              icon={<Info className="h-3.5 w-3.5" />}
            />
          </CardContent>
        )}
      </Card>

      {/* ── Observed Contractor Overlap ──────────────────────────── */}
      <Card>
        <CardHeader
          className="pb-3 cursor-pointer select-none"
          onClick={() => toggleSection("overlap")}
        >
          <CardTitle className="text-sm flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Observed Contractor Overlap by County
            <Badge variant="outline" className="ml-2 h-5 text-[10px]">
              {overlap.multiContractorCounties} multi-contractor
            </Badge>
            <ChevronRight
              className={`h-4 w-4 ml-auto transition-transform ${
                openSection.overlap ? "rotate-90" : ""
              }`}
            />
          </CardTitle>
          <p className="text-[11px] text-slate-700 mt-1">
            Observed from real routing history — NOT a formal territory map.
            Counties with more than one contractor present surface first.
            <code className="px-1 rounded bg-muted ml-1">{UNKNOWN_COUNTY}</code>{" "}
            shown when opportunity county is missing.
          </p>
        </CardHeader>
        {openSection.overlap && (
          <CardContent>
            {overlap.rows.length === 0 ? (
              <div className="text-xs text-slate-700 py-6 text-center">
                No routed opportunities yet — overlap view is empty.
              </div>
            ) : (
              <div className="divide-y divide-border rounded-md border">
                {overlap.rows.map((row) => (
                  <div
                    key={row.county}
                    className="flex items-start gap-3 px-3 py-2.5 text-xs"
                  >
                    <div className="min-w-[140px] flex items-center gap-1.5 shrink-0">
                      <MapPin className="h-3.5 w-3.5 text-slate-700" />
                      <span className="font-medium">{row.county}</span>
                      {row.contractors.length > 1 && (
                        <Badge
                          variant="secondary"
                          className="h-4 text-[9px] ml-1"
                        >
                          overlap
                        </Badge>
                      )}
                    </div>
                    <div className="flex-1 flex flex-wrap gap-1.5">
                      {row.contractors.map((c) => (
                        <Badge
                          key={c.contractor.id}
                          variant="outline"
                          className="text-[10px] font-normal"
                        >
                          {c.contractor.company_name}
                          <span className="ml-1 text-slate-700">
                            · {c.opportunityCount}
                          </span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* ── Manual Reassignable / Needs Review Queue ─────────────── */}
      <Card>
        <CardHeader
          className="pb-3 cursor-pointer select-none"
          onClick={() => toggleSection("reassignable")}
        >
          <CardTitle className="text-sm flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Manual Reassignment / Needs Review Queue
            <Badge variant="outline" className="ml-2 h-5 text-[10px]">
              {reassignableRows.length}
            </Badge>
            <ChevronRight
              className={`h-4 w-4 ml-auto transition-transform ${
                openSection.reassignable ? "rotate-90" : ""
              }`}
            />
          </CardTitle>
          <p className="text-[11px] text-slate-700 mt-1">
            Opportunities the operator may want to move manually. All actual
            routing happens in the canonical Routing Desk — this view is
            visibility only. Verify ownership and release context before
            taking action.
          </p>
        </CardHeader>
        {openSection.reassignable && (
          <CardContent>
            {reassignableRows.length === 0 ? (
              <div className="text-xs text-slate-700 py-6 text-center">
                Nothing flagged for manual reassignment right now.
              </div>
            ) : (
              <div className="divide-y divide-border rounded-md border">
                {reassignableRows.map((r) => {
                  const homeownerName =
                    [r.lead?.first_name, r.lead?.last_name]
                      .filter(Boolean)
                      .join(" ") || "Unnamed lead";
                  const county = r.opportunity.county || UNKNOWN_COUNTY;
                  const ownerLabel = r.currentOwner
                    ? r.currentOwner.company_name
                    : "— no current owner —";
                  return (
                    <div
                      key={r.opportunity.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate flex items-center gap-2">
                          {homeownerName}
                          <Badge
                            variant={
                              r.bucket === "manually_reassignable"
                                ? "default"
                                : "outline"
                            }
                            className="h-4 text-[9px] font-normal"
                          >
                            {r.bucket === "manually_reassignable" ? (
                              <Unlock className="h-2.5 w-2.5 mr-0.5" />
                            ) : (
                              <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                            )}
                            {r.bucket === "manually_reassignable"
                              ? "reassignable"
                              : "needs review"}
                          </Badge>
                        </div>
                        <div className="text-slate-700 truncate">
                          {county} · current: {ownerLabel}
                          {r.priorOwners.length > 0 &&
                            ` · prior: ${r.priorOwners
                              .map((p) => p.company_name)
                              .join(", ")}`}
                        </div>
                        <div className="text-slate-700/80 truncate text-[10px] mt-0.5 italic">
                          {r.reason}
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

      {/* ── Current System Limits ────────────────────────────────── */}
      <Card>
        <CardHeader
          className="pb-3 cursor-pointer select-none"
          onClick={() => toggleSection("limits")}
        >
          <CardTitle className="text-sm flex items-center gap-2">
            <XCircle className="h-4 w-4 text-slate-700" />
            Current System Limits — Not Yet Automated
          </CardTitle>
        </CardHeader>
        {openSection.limits && (
          <CardContent className="text-xs text-slate-700 leading-relaxed space-y-2">
            <p>
              <strong>Manual today:</strong> contractor selection on a route
              happens in the canonical Routing Desk. Release/recovery handling
              is operator-driven. There is no background reassignment.
            </p>
            <p>
              <strong>Not modeled:</strong> round-robin allocation, fairness
              balancing across contractors, formal territory enforcement,
              exclusivity windows, release-to-network automation, contractor
              self-serve portal, seat purchases, or billing entitlements. None
              of these exist in the system today.
            </p>
            <p>
              <strong>Observed vs configured:</strong> the overlap view above
              is observed from real routing history. It does not consult any
              configured service area, and a contractor appearing in a county
              here only means at least one route exists there.
            </p>
            <p>
              <strong>What this surface does NOT claim:</strong> guaranteed
              contractor distribution, equal access, automatic recovery, or
              any predictive market intelligence. Manual reassignment requires
              operator judgment in the Routing Desk.
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
          <QuickLink label="Feedback Loop" onClick={() => goTab("feedback")} />
          <QuickLink label="Lifecycle" onClick={() => goTab("lifecycle")} />
          <QuickLink label="Operator Reporting" onClick={() => goTab("reporting")} />
          <QuickLink label="Onboarding" onClick={() => goTab("onboarding")} />
          <QuickLink label="Contractors" onClick={() => goTab("contractors")} />
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Subcomponents ─────────────────────────────────────────────────── */

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <div className="text-2xl font-semibold leading-none text-foreground">
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-slate-700 mt-1 flex items-center gap-1">
        {icon}
        {label}
      </div>
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
