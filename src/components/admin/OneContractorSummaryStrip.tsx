/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ONE-CONTRACTOR SUMMARY STRIP — Operational counts only
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Five compact KPI tiles on the Command Center. Counts of repo-real
 * timestamps + operator-derived UI groupings. NEVER displays revenue,
 * close rate, contractor score, or any fake analytics.
 *
 *   • Routed         — opportunity.routed_at != null
 *   • Contacted      — route has viewed_at OR responded_at
 *   • Booked         — lead.appointment_booked_at != null
 *   • Stale          — operator-derived (routed >7d, no response, no call completed)
 *   • Reactivation   — operator-derived (report_unlocked >14d, never routed)
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Send, Eye, CalendarCheck, Clock, RotateCcw, MapPin } from "lucide-react";
import { fetchOpportunities, fetchRoutes } from "@/services/adminDataService";
import type { RoutingOpportunity, RoutingRoute, OneContractorSummaryCounts } from "@/types/routingDesk";
import type { CRMLead } from "@/components/admin/types";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

interface Props {
  leads: CRMLead[];
  surface?: "canvas" | "card";
}

type OperationalLead = CRMLead & {
  appointment_booked_at?: string | null;
  last_call_completed_at?: string | null;
  routed_to_contractor_at?: string | null;
};

export function OneContractorSummaryStrip({ leads, surface = "canvas" }: Props) {
  const { data: opps } = useQuery({
    queryKey: ["admin", "opportunities"],
    queryFn: fetchOpportunities,
    staleTime: 30_000,
  });

  const { data: routes } = useQuery({
    queryKey: ["admin", "routes", "all"],
    queryFn: () => fetchRoutes(),
    staleTime: 30_000,
  });

  const counts: OneContractorSummaryCounts = useMemo(() => {
    const oppsArr = (opps as RoutingOpportunity[] | undefined) ?? [];
    const routesArr = (routes as RoutingRoute[] | undefined) ?? [];
    const now = Date.now();

    // Index leads by id for derivations.
    const operationalLeads = leads as OperationalLead[];
    const leadById = new Map(operationalLeads.map((lead) => [lead.id, lead]));

    // Latest route per opportunity.
    const latestRouteByOpp = new Map<string, RoutingRoute>();
    for (const r of routesArr) {
      const existing = latestRouteByOpp.get(r.opportunity_id);
      const t = (x: RoutingRoute) => new Date(x.sent_at ?? x.created_at).getTime();
      if (!existing || t(r) > t(existing)) latestRouteByOpp.set(r.opportunity_id, r);
    }

    let routed = 0;
    let contacted = 0;
    let staleOperatorView = 0;

    for (const o of oppsArr) {
      if (!o.routed_at) continue;
      routed++;
      const r = latestRouteByOpp.get(o.id);
      if (r && (r.viewed_at || r.responded_at)) contacted++;

      // Stale (operator-derived): routed >7d, no responded_at, parent lead has no last_call_completed_at.
      const routedTime = new Date(o.routed_at).getTime();
      const lead = leadById.get(o.lead_id);
      const lastCallCompleted = lead?.last_call_completed_at ?? null;
      if (now - routedTime > SEVEN_DAYS_MS && !r?.responded_at && !lastCallCompleted) {
        staleOperatorView++;
      }
    }

    // Booked — from leads in memory.
    const booked = operationalLeads.filter((lead) => lead.appointment_booked_at).length;

    // Reactivation candidates (operator-derived): report_unlocked_at >14d ago AND not routed.
    const reactivationOperatorView = operationalLeads.filter((l) => {
      const unlocked = l.report_unlocked_at ? new Date(l.report_unlocked_at).getTime() : null;
      if (!unlocked) return false;
      const routedToContractor = l.routed_to_contractor_at ?? null;
      return now - unlocked > FOURTEEN_DAYS_MS && !routedToContractor;
    }).length;

    return { routed, contacted, booked, staleOperatorView, reactivationOperatorView };
  }, [opps, routes, leads]);

  // Phase 8 — Market-aware tile.
  // Counties Covered = distinct non-empty `lead.county` values across leads
  // that have at least one repo-real lifecycle event (unlocked OR routed OR
  // a verified analysis). Operator-view metric only — no routing logic.
  const countiesCovered = useMemo(() => {
    const set = new Set<string>();
    for (const l of leads) {
      const hasActivity = !!(l.report_unlocked_at || l.routed_to_contractor_at || l.latest_analysis_id);
      if (!hasActivity) continue;
      const county = l.county?.trim();
      if (county && county.length > 0) set.add(county);
    }
    return set.size;
  }, [leads]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
      <Tile icon={Send} label="Leads Routed" value={counts.routed} tone="cyan" surface={surface} />
      <Tile icon={Eye} label="Contacted" value={counts.contacted} tone="cyan" surface={surface} />
      <Tile icon={CalendarCheck} label="Booked" value={counts.booked} tone="emerald" surface={surface} />
      <Tile
        icon={Clock}
        label="Stale"
        sublabel="(operator view)"
        value={counts.staleOperatorView}
        tone="amber"
        surface={surface}
      />
      <Tile
        icon={RotateCcw}
        label="Reactivation"
        sublabel="(operator view)"
        value={counts.reactivationOperatorView}
        tone="amber"
        surface={surface}
      />
      <Tile
        icon={MapPin}
        label="Counties Covered"
        sublabel="(active markets)"
        value={countiesCovered}
        tone="cyan"
        surface={surface}
      />
    </div>
  );
}

function Tile({
  icon: Icon, label, sublabel, value, tone, surface,
}: {
  icon: React.ElementType;
  label: string;
  sublabel?: string;
  value: number;
  tone: "cyan" | "emerald" | "amber" | "rose";
  surface: "canvas" | "card";
}) {
  const toneStyles: Record<string, string> = {
    cyan: "border-cyan-500/30 bg-cyan-500/5",
    emerald: "border-emerald-500/30 bg-emerald-500/5",
    amber: "border-amber-500/30 bg-amber-500/5",
    rose: "border-rose-500/30 bg-rose-500/5",
  };
  const iconStyles: Record<string, string> = {
    cyan: surface === "canvas" ? "text-cyan-300" : "text-cyan-700",
    emerald: surface === "canvas" ? "text-emerald-300" : "text-emerald-700",
    amber: surface === "canvas" ? "text-amber-300" : "text-amber-700",
    rose: surface === "canvas" ? "text-rose-300" : "text-rose-700",
  };
  const tileClass = surface === "canvas" ? "wm-on-canvas-tile" : "text-slate-950";
  const titleClass = surface === "canvas" ? "wm-on-canvas-tile-title" : "text-slate-700";
  const mutedClass = surface === "canvas" ? "wm-on-canvas-tile-muted" : "text-slate-600";
  return (
    <div className={`${tileClass} rounded-lg border ${toneStyles[tone]} p-3 flex items-start gap-3`}>
      <div className={`shrink-0 mt-0.5 ${iconStyles[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold tabular-nums leading-none">{value}</p>
        <p className={`${titleClass} text-sm uppercase tracking-wide mt-1 font-semibold`}>
          {label}
        </p>
        {sublabel && (
          <p className={`${mutedClass} text-sm italic`}>{sublabel}</p>
        )}
      </div>
    </div>
  );
}
