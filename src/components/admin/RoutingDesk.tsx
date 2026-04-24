/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ROUTING DESK — Phase 6: Single-Client Delivery Spine
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Operator surface for routing homeowner opportunities to one paying
 * contractor. Joins contractor_opportunities + contractor_opportunity_routes
 * + contractors + parent leads (already in memory).
 *
 * Buckets (operator-derived UI groupings, NOT backend statuses):
 *   • Ready to Route       — repo-real status='intro_requested', no route row
 *   • Routed               — repo-real routed_at != null, sub-grouped by route_status
 *   • Stale (operator)     — derived: routed >7d ago, no response, no call
 *   • Reactivation (op.)   — derived: unlocked >14d, never routed
 *
 * All mutations go through ONE canonical helper: routeLeadToContractor.
 * No parallel write paths.
 */

import { useMemo, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Send, Phone, FileText, X, ChevronDown, ChevronRight,
  Building2, Clock, AlertCircle, Loader2, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";

import {
  fetchOpportunities, fetchRoutes, fetchContractors,
  routeLeadToContractor, markOpportunityDead, invokeAdminData,
} from "@/services/adminDataService";
import {
  fetchClientResolutions, describeNoRouteReason,
  type ClientResolutionRow,
} from "@/services/dispatchHealth";
import type {
  RoutingOpportunity, RoutingRoute, RoutingContractor,
  RoutingDeskRow, OperatorBucket, RoutingLeadContext,
} from "@/types/routingDesk";
import type { CRMLead } from "@/components/admin/types";
import { OpportunityRouteTimeline } from "./OpportunityRouteTimeline";
import { LeadDossierSheet } from "./LeadDossierSheet";
import { DispatchHealthCard } from "./DispatchHealthCard";
import { deriveOwnershipBadges } from "./OwnershipBlock";
import type { OwnershipBadge } from "@/types/routingDesk";
import {
  timelineShortChip,
  handoffConsentLabel,
  motivationLabelFromDiagnosis,
} from "@/lib/humanContext";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

// Phase 8 — safe operator-facing fallback for null/empty geography.
const UNKNOWN_COUNTY = "Unknown County";

function marketLabel(county: string | null | undefined): string {
  const c = county?.trim();
  return c && c.length > 0 ? c : UNKNOWN_COUNTY;
}

interface Props {
  leads: CRMLead[];
}

const BUCKET_LABEL: Record<OperatorBucket, string> = {
  ready_to_route: "Ready to Route",
  routed: "Routed",
  stale_operator_view: "Stale (operator view)",
  reactivation_operator_view: "Reactivation Candidates (operator view)",
};

const BUCKET_TONE: Record<OperatorBucket, string> = {
  ready_to_route: "border-cyan-500/40 text-cyan-700 bg-cyan-500/10",
  routed: "border-emerald-500/40 text-emerald-700 bg-emerald-500/10",
  stale_operator_view: "border-amber-500/40 text-amber-700 bg-amber-500/10",
  reactivation_operator_view: "border-amber-500/40 text-amber-700 bg-amber-500/10",
};

function leadCtxFromCRM(lead: CRMLead): RoutingLeadContext {
  return {
    id: lead.id,
    first_name: lead.first_name,
    last_name: lead.last_name,
    phone_e164: lead.phone_e164,
    county: lead.county,
    report_unlocked_at: lead.report_unlocked_at,
    routed_to_contractor_at: (lead as any).routed_to_contractor_at ?? null,
    appointment_booked_at: (lead as any).appointment_booked_at ?? null,
    last_call_completed_at: (lead as any).last_call_completed_at ?? null,
    latest_opportunity_id: lead.latest_opportunity_id,
    latest_scan_session_id: lead.latest_scan_session_id,
  };
}

function ownershipBadgeLabel(b: OwnershipBadge): string {
  switch (b) {
    case "currently_assigned": return "Assigned";
    case "released": return "Released";
    case "previously_assigned": return "Has Prior Owner";
    case "recovery_candidate": return "Recovery Candidate";
    case "reassignable": return "Reassignable";
  }
}

export function RoutingDesk({ leads }: Props) {
  const queryClient = useQueryClient();
  const [selectedContractor, setSelectedContractor] = useState<Record<string, string>>({});
  const [pendingRow, setPendingRow] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [dossierLead, setDossierLead] = useState<CRMLead | null>(null);
  const [dossierOpen, setDossierOpen] = useState(false);
  const [marketFilter, setMarketFilter] = useState<string>("all");

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

  // Repo-real per-client resolver state — used to explain WHY an opportunity
  // is stuck (e.g. client_inactive, no_active_assignment). Cheap; cached 60s.
  const resolutionsQuery = useQuery({
    queryKey: ["admin", "client-resolutions"],
    queryFn: fetchClientResolutions,
    staleTime: 60_000,
  });

  const isLoading = oppsQuery.isLoading || routesQuery.isLoading || contractorsQuery.isLoading;
  const error = oppsQuery.error || routesQuery.error || contractorsQuery.error;

  // Map client_slug → resolver row. Falls back gracefully when missing.
  const resolutionBySlug = useMemo(() => {
    const map = new Map<string, ClientResolutionRow>();
    for (const r of (resolutionsQuery.data ?? [])) map.set(r.client_slug, r);
    return map;
  }, [resolutionsQuery.data]);

  // ── Derive rows + buckets ──────────────────────────────────────────────
  const { rowsByBucket, reactivationLeads } = useMemo(() => {
    const opps = (oppsQuery.data as RoutingOpportunity[] | undefined) ?? [];
    const routes = (routesQuery.data as RoutingRoute[] | undefined) ?? [];
    const contractors = (contractorsQuery.data as RoutingContractor[] | undefined) ?? [];
    const now = Date.now();

    const leadById = new Map(leads.map((l) => [l.id, l]));
    const contractorById = new Map(contractors.map((c) => [c.id, c]));

    // Latest route per opportunity.
    const latestRouteByOpp = new Map<string, RoutingRoute>();
    for (const r of routes) {
      const existing = latestRouteByOpp.get(r.opportunity_id);
      const t = (x: RoutingRoute) => new Date(x.sent_at ?? x.created_at).getTime();
      if (!existing || t(r) > t(existing)) latestRouteByOpp.set(r.opportunity_id, r);
    }

    const buckets: Record<OperatorBucket, RoutingDeskRow[]> = {
      ready_to_route: [],
      routed: [],
      stale_operator_view: [],
      reactivation_operator_view: [],
    };

    for (const opp of opps) {
      const route = latestRouteByOpp.get(opp.id) ?? null;
      const contractor = route ? contractorById.get(route.contractor_id) ?? null : null;

      let bucket: OperatorBucket | null = null;

      // Ready-to-route covers BOTH `intro_requested` AND `brief_ready`
      // (the brief generator's terminal state) — neither is "routed yet".
      // Without this, brief_ready opps stayed invisible to operators.
      if (!route && (opp.status === "intro_requested" || opp.status === "brief_ready")) {
        bucket = "ready_to_route";
      } else if (opp.routed_at) {
        bucket = "routed";

        // Also check stale derivation.
        const lead = leadById.get(opp.lead_id);
        const lastCallCompleted = (lead as any)?.last_call_completed_at ?? null;
        const routedTime = new Date(opp.routed_at).getTime();
        if (now - routedTime > SEVEN_DAYS_MS && !route?.responded_at && !lastCallCompleted) {
          buckets.stale_operator_view.push({ opportunity: opp, latestRoute: route, contractor, bucket: "stale_operator_view" });
        }
      }

      if (bucket) {
        buckets[bucket].push({ opportunity: opp, latestRoute: route, contractor, bucket });
      }
    }

    // Reactivation candidates from leads (no opportunity needed).
    const reactivation: RoutingLeadContext[] = leads
      .filter((l) => {
        const unlocked = l.report_unlocked_at ? new Date(l.report_unlocked_at).getTime() : null;
        if (!unlocked) return false;
        const routedToContractor = (l as any).routed_to_contractor_at ?? null;
        return now - unlocked > FOURTEEN_DAYS_MS && !routedToContractor;
      })
      .map(leadCtxFromCRM);

    return { rowsByBucket: buckets, reactivationLeads: reactivation };
  }, [oppsQuery.data, routesQuery.data, contractorsQuery.data, leads]);

  // Phase 8 — Market options derived from opportunities + reactivation leads.
  // Uses safe Unknown County fallback. Pure UI grouping; no routing implied.
  const marketOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const bucket of Object.values(rowsByBucket)) {
      for (const row of bucket) {
        const key = marketLabel(row.opportunity.county);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    for (const lc of reactivationLeads) {
      const key = marketLabel(lc.county);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [rowsByBucket, reactivationLeads]);

  // Phase 8 — Apply market filter to bucket rows + reactivation list.
  const filteredRowsByBucket = useMemo(() => {
    if (marketFilter === "all") return rowsByBucket;
    const out: Record<OperatorBucket, RoutingDeskRow[]> = {
      ready_to_route: [], routed: [], stale_operator_view: [], reactivation_operator_view: [],
    };
    for (const [b, rows] of Object.entries(rowsByBucket) as [OperatorBucket, RoutingDeskRow[]][]) {
      out[b] = rows.filter((row) => marketLabel(row.opportunity.county) === marketFilter);
    }
    return out;
  }, [rowsByBucket, marketFilter]);

  const filteredReactivationLeads = useMemo(() => {
    if (marketFilter === "all") return reactivationLeads;
    return reactivationLeads.filter((lc) => marketLabel(lc.county) === marketFilter);
  }, [reactivationLeads, marketFilter]);

  const contractors = (contractorsQuery.data as RoutingContractor[] | undefined) ?? [];
  const activeContractors = contractors.filter((c) => c.status === "active");
  const canonicalContractorId = activeContractors.length === 1 ? activeContractors[0].id : null;

  // ── Mutations ──────────────────────────────────────────────────────────
  const handleRoute = useCallback(async (row: RoutingDeskRow, contractorId: string) => {
    setPendingRow(row.opportunity.id);
    try {
      const result = await routeLeadToContractor(
        row.opportunity.lead_id,
        contractorId,
        row.opportunity.scan_session_id,
      );
      if (result.success) {
        if (result.warning) toast.warning(result.warning);
        else toast.success("Routed to contractor");
        queryClient.invalidateQueries({ queryKey: ["admin", "opportunities"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "routes", "all"] });
      } else {
        toast.error(result.warning ?? "Routing failed");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Routing failed");
    } finally {
      setPendingRow(null);
    }
  }, [queryClient]);

  const handleMarkDead = useCallback(async (row: RoutingDeskRow) => {
    setPendingRow(row.opportunity.id);
    try {
      await markOpportunityDead({
        opportunity_id: row.opportunity.id,
        scan_session_id: row.opportunity.scan_session_id,
      });
      toast.success("Marked dead");
      queryClient.invalidateQueries({ queryKey: ["admin", "opportunities"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to mark dead");
    } finally {
      setPendingRow(null);
    }
  }, [queryClient]);

  const handleVoiceFollowup = useCallback(async (row: RoutingDeskRow) => {
    const lead = leads.find((l) => l.id === row.opportunity.lead_id);
    if (!lead?.phone_e164) {
      toast.error("Lead has no phone number");
      return;
    }
    setPendingRow(row.opportunity.id);
    try {
      await invokeAdminData("trigger_voice_followup", {
        scan_session_id: row.opportunity.scan_session_id,
        phone_e164: lead.phone_e164,
        opportunity_id: row.opportunity.id,
      });
      toast.success("Voice follow-up queued");
    } catch (err: any) {
      toast.error(err?.message ?? "Voice follow-up failed");
    } finally {
      setPendingRow(null);
    }
  }, [leads]);

  const openDossier = useCallback((leadId: string) => {
    const lead = leads.find((l) => l.id === leadId);
    if (lead) {
      setDossierLead(lead);
      setDossierOpen(true);
    }
  }, [leads]);

  // ── Loading / error ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-destructive" />
        <span className="text-sm text-destructive">Failed to load routing data.</span>
        <Button variant="ghost" size="sm" onClick={() => {
          oppsQuery.refetch(); routesQuery.refetch(); contractorsQuery.refetch();
        }}>
          Retry
        </Button>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Live dispatch healthcheck — reads webhook_deliveries directly.
          NOT a new tab; it sits inside the existing Routing surface. */}
      <DispatchHealthCard />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold">Routing Desk</h2>
          <p className="text-xs text-muted-foreground">
            Single-client delivery spine — route verified leads to {activeContractors[0]?.company_name ?? "your contractor"}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeContractors.length === 0 && (
            <Badge variant="destructive" className="text-[10px]">
              No active contractor
            </Badge>
          )}
          {/* Phase 8 — Market filter (county). Pure UI grouping; no routing implied.
              Always exposes an explicit "Unknown County" option as a safe fallback
              for null/empty geography, even when no current rows match. */}
          <Select value={marketFilter} onValueChange={setMarketFilter}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue placeholder="All Markets" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Markets</SelectItem>
              {marketOptions.map(([market, count]) => (
                <SelectItem key={market} value={market}>
                  {market} ({count})
                </SelectItem>
              ))}
              {!marketOptions.some(([m]) => m === UNKNOWN_COUNTY) && (
                <SelectItem value={UNKNOWN_COUNTY}>{UNKNOWN_COUNTY} (0)</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="ready_to_route" className="space-y-4">
        <TabsList className="grid grid-cols-2 lg:grid-cols-4 w-full max-w-3xl">
          {(Object.keys(BUCKET_LABEL) as OperatorBucket[]).map((b) => {
            const count = b === "reactivation_operator_view"
              ? filteredReactivationLeads.length
              : filteredRowsByBucket[b].length;
            return (
              <TabsTrigger key={b} value={b} className="text-xs gap-1.5">
                {BUCKET_LABEL[b]}
                {count > 0 && (
                  <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold border ${BUCKET_TONE[b]}`}>
                    {count}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {(["ready_to_route", "routed", "stale_operator_view"] as OperatorBucket[]).map((b) => (
          <TabsContent key={b} value={b} className="space-y-2">
            {filteredRowsByBucket[b].length === 0 ? (
              <EmptyBucket bucket={b} />
            ) : (
              filteredRowsByBucket[b].map((row) => {
                const lead = leads.find((l) => l.id === row.opportunity.lead_id);
                const isExpanded = expandedRow === row.opportunity.id;
                const isPending = pendingRow === row.opportunity.id;
                const chosenContractor = selectedContractor[row.opportunity.id]
                  ?? canonicalContractorId
                  ?? activeContractors[0]?.id
                  ?? "";

                return (
                  <div
                    key={row.opportunity.id}
                    className="rounded-lg border border-border bg-card overflow-hidden"
                  >
                    {/* Row header */}
                    <div className="p-3 flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => setExpandedRow(isExpanded ? null : row.opportunity.id)}
                        className="shrink-0 p-1 hover:bg-muted rounded"
                        aria-label={isExpanded ? "Collapse" : "Expand"}
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold truncate">
                            {[lead?.first_name, lead?.last_name].filter(Boolean).join(" ") || "Unknown"}
                          </p>
                          {row.opportunity.grade && (
                            <Badge className={`text-[10px] ${gradeColor(row.opportunity.grade)}`}>
                              {row.opportunity.grade}
                            </Badge>
                          )}
                          {/* Phase 8 — Always render a county label, with safe fallback. */}
                          <span className="text-[11px] text-muted-foreground">
                            {marketLabel(row.opportunity.county)}
                          </span>
                          {row.opportunity.window_count != null && (
                            <span className="text-[11px] text-muted-foreground">
                              {row.opportunity.window_count} windows
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {row.contractor && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-cyan-700">
                              <Building2 className="h-3 w-3" />
                              {row.contractor.company_name}
                            </span>
                          )}
                          {row.opportunity.routed_at && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
                              <Clock className="h-3 w-3" />
                              {format(new Date(row.opportunity.routed_at), "MMM d, h:mm a")}
                            </span>
                          )}
                          {row.latestRoute && (
                            <Badge variant="outline" className="text-[10px]">
                              {row.latestRoute.route_status}
                            </Badge>
                          )}
                          {/* Phase 10 — Human Context compact badges (sales-ready signals). */}
                          {(() => {
                            const tl = timelineShortChip((lead as any)?.timeline_bucket);
                            const consent = handoffConsentLabel((lead as any)?.handoff_consent_status);
                            const propDetail = (lead as any)?.property_type_detail as string | null;
                            const hoa = (lead as any)?.hoa_or_condo_complexity as string | null;
                            const motiv = motivationLabelFromDiagnosis(
                              (lead as any)?.primary_diagnosis ?? null,
                            );
                            const isReportOnly = (lead as any)?.handoff_consent_status === "report_only";
                            return (
                              <>
                                {tl && (
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${
                                      tl === "ASAP" || tl === "This month"
                                        ? "border-orange-400/60 text-orange-700 bg-orange-50"
                                        : "border-border"
                                    }`}
                                    title={`Timeline: ${tl}`}
                                  >
                                    {tl}
                                  </Badge>
                                )}
                                {(propDetail === "condo" || propDetail === "high_rise" ||
                                  hoa === "hoa_complex" || hoa === "high_rise_engineering") && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] border-amber-400/60 text-amber-800 bg-amber-50"
                                    title="Complex approval path — confirm HOA/engineering before quoting."
                                  >
                                    {propDetail === "high_rise" ? "High-rise" : "Condo / HOA"}
                                  </Badge>
                                )}
                                {consent && (
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${
                                      isReportOnly
                                        ? "border-destructive/40 text-destructive bg-destructive/5"
                                        : "border-emerald-500/40 text-emerald-700 bg-emerald-50"
                                    }`}
                                    title={consent.full}
                                  >
                                    {consent.short}
                                  </Badge>
                                )}
                                {motiv && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] border-cyan-500/30 text-cyan-700 bg-cyan-500/5"
                                    title={motiv.long}
                                  >
                                    {motiv.short}
                                  </Badge>
                                )}
                              </>
                            );
                          })()}
                          {/* Phase 7: Ownership badges derived from full route history */}
                          {(() => {
                            const allRoutes = (routesQuery.data as RoutingRoute[] | undefined) ?? [];
                            const oppRoutes = allRoutes.filter((r) => r.opportunity_id === row.opportunity.id);
                            const badges = deriveOwnershipBadges({
                              routes: oppRoutes,
                              reportUnlockedAt: lead?.report_unlocked_at ?? null,
                              routedToContractorAt: (lead as any)?.routed_to_contractor_at ?? null,
                            });
                            return badges
                              .filter((b: OwnershipBadge) => b !== "currently_assigned") // already shown via contractor name
                              .map((b: OwnershipBadge) => (
                                <Badge
                                  key={b}
                                  variant="outline"
                                  className="text-[10px] border-violet-500/40 text-violet-700 bg-violet-500/10"
                                >
                                  {ownershipBadgeLabel(b)}
                                </Badge>
                              ));
                          })()}

                          {/* Blocked-reason chip — only shown for ready-to-route rows
                              that have no contractor route AND no resolved tenant.
                              Reason text comes from the canonical resolver
                              (v_admin_routing_resolution). NEVER invented. */}
                          {b === "ready_to_route" && !row.latestRoute && (() => {
                            const slug = row.opportunity.client_slug ?? (lead as any)?.client_slug ?? null;
                            const res = slug ? resolutionBySlug.get(slug) : undefined;
                            // Routable ⇒ no chip needed (operator just needs to click Route).
                            if (res?.resolved) return null;
                            const reason = res?.no_route_reason ?? (slug ? null : "lead_has_no_slug");
                            return (
                              <Badge
                                variant="outline"
                                className="text-[10px] border-destructive/50 text-destructive bg-destructive/5"
                                title={describeNoRouteReason(reason)}
                              >
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Blocked: {describeNoRouteReason(reason)}
                              </Badge>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {b === "ready_to_route" && (
                          <>
                            {activeContractors.length > 1 && (
                              <Select
                                value={chosenContractor}
                                onValueChange={(v) => setSelectedContractor((prev) => ({ ...prev, [row.opportunity.id]: v }))}
                              >
                                <SelectTrigger className="h-8 w-[180px] text-xs">
                                  <SelectValue placeholder="Choose contractor" />
                                </SelectTrigger>
                                <SelectContent>
                                  {activeContractors.map((c) => (
                                    <SelectItem key={c.id} value={c.id} className="text-xs">
                                      {c.company_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            <Button
                              size="sm"
                              variant="default"
                              className="h-8 gap-1.5 text-xs"
                              disabled={!chosenContractor || isPending}
                              onClick={() => handleRoute(row, chosenContractor)}
                            >
                              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                              Route
                            </Button>
                          </>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1.5 text-xs"
                          onClick={() => handleVoiceFollowup(row)}
                          disabled={isPending || !lead?.phone_e164}
                        >
                          <Phone className="h-3 w-3" />
                          Voice
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1.5 text-xs"
                          onClick={() => openDossier(row.opportunity.lead_id)}
                        >
                          <FileText className="h-3 w-3" />
                          Dossier
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive"
                          onClick={() => handleMarkDead(row)}
                          disabled={isPending}
                        >
                          <X className="h-3 w-3" />
                          Dead
                        </Button>
                      </div>
                    </div>

                    {/* Row expansion */}
                    {isExpanded && (
                      <div className="border-t border-border bg-muted/20 p-4">
                        <OpportunityRouteTimeline opportunityId={row.opportunity.id} />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </TabsContent>
        ))}

        {/* ── Reactivation Candidates ── */}
        <TabsContent value="reactivation_operator_view" className="space-y-2">
          {filteredReactivationLeads.length === 0 ? (
            <EmptyBucket bucket="reactivation_operator_view" />
          ) : (
            filteredReactivationLeads.map((lc) => {
              const fullLead = leads.find((l) => l.id === lc.id);
              return (
                <div key={lc.id} className="rounded-lg border border-border bg-card p-3 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">
                      {[lc.first_name, lc.last_name].filter(Boolean).join(" ") || "Unknown"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {marketLabel(lc.county)} · Unlocked {lc.report_unlocked_at ? format(new Date(lc.report_unlocked_at), "MMM d") : "—"} · Never routed
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => openDossier(lc.id)}
                  >
                    <FileText className="h-3 w-3" />
                    Dossier
                  </Button>
                  {canonicalContractorId && fullLead?.latest_opportunity_id && (
                    <Button
                      size="sm"
                      variant="default"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => fullLead && handleRoute({
                        opportunity: { id: fullLead.latest_opportunity_id!, lead_id: lc.id, scan_session_id: lc.latest_scan_session_id ?? "" } as any,
                        latestRoute: null, contractor: null, bucket: "reactivation_operator_view",
                      }, canonicalContractorId)}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Route Now
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* Dossier sheet */}
      <LeadDossierSheet lead={dossierLead} open={dossierOpen} onOpenChange={setDossierOpen} />
    </div>
  );
}

function EmptyBucket({ bucket }: { bucket: OperatorBucket }) {
  return (
    <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-8 text-center">
      <p className="text-sm text-muted-foreground">No leads in {BUCKET_LABEL[bucket]}.</p>
    </div>
  );
}

function gradeColor(grade: string | null): string {
  switch (grade) {
    case "A": return "bg-green-600 text-white";
    case "B": return "bg-emerald-500 text-white";
    case "C": return "bg-amber-500 text-white";
    case "D": return "bg-orange-600 text-white";
    case "F": return "bg-destructive text-destructive-foreground";
    default: return "bg-muted text-muted-foreground";
  }
}
