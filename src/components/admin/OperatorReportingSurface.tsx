/**
 * ═══════════════════════════════════════════════════════════════════════════
 * OPERATOR REPORTING / EXPORT LAYER — Phase 14
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Internal operator surface for honest current-state reporting and lightweight
 * client-side export. Composed entirely of:
 *
 *   • Repo-real reads via TanStack Query (`fetchContractors`,
 *     `fetchOpportunities`, `fetchRoutes`) and the in-page `leads` prop.
 *   • Pure useMemo derivations (counts, breakdowns, observed coverage).
 *   • Static copy describing what is known vs operator-derived.
 *   • Copy-to-clipboard + client-side CSV download (no backend exports).
 *   • Read-only quick links into existing admin tabs.
 *
 * STRICT CONSTRAINTS (Phase 14):
 *   • No new edge functions. No new endpoints. No schema changes.
 *   • No backend persistence for reports, exports, or notes.
 *   • No fabricated ROI / revenue / contractor scoring.
 *   • Reuses existing surfaces; does not duplicate logic.
 */

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Info,
  MapPin,
  Users,
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

// ─── Derivation thresholds ─────────────────────────────────────────────
// Mirrored from OutcomeTrackingReport / PilotOps so reporting stays
// consistent with what the operator sees elsewhere.
const STALE_HOURS = 72;

interface Props {
  leads: CRMLead[];
  onNavigateTab?: (tab: string) => void;
}

export function OperatorReportingSurface({ leads, onNavigateTab }: Props) {
  // ─── Repo-real reads ────────────────────────────────────────────────
  const { data: contractors, isLoading: contractorsLoading } = useQuery({
    queryKey: ["admin", "contractors"],
    queryFn: fetchContractors,
    staleTime: 30_000,
  });

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
  const contractorsArr = (contractors as RoutingContractor[] | undefined) ?? [];

  // ─── Top-line counts (repo-real fields only) ────────────────────────
  const topLine = useMemo(() => {
    const captured = leads.length;
    const verified = leads.filter((l) => l.phone_verified).length;
    const unlocked = leads.filter((l) => !!l.report_unlocked_at).length;
    const routed = leads.filter((l) => !!l.routed_to_contractor_at).length;
    const booked = leads.filter((l) => !!l.appointment_booked_at).length;
    const closed = leads.filter((l) => !!l.closed_at).length;

    // Counties from leads (real + observed)
    const counties = new Set<string>();
    for (const l of leads) {
      const c = l.county?.trim();
      if (c) counties.add(c);
    }
    return { captured, verified, unlocked, routed, booked, closed, counties: counties.size };
  }, [leads]);

  // ─── Outcome breakdown (deterministic, mirrors OutcomeTrackingReport) ─
  // Operator-view derivations:
  //   • unresolved = routed exists, no booked/closed/dead signal
  //   • stale      = no activity for > STALE_HOURS on a routed/active opp
  //   • recovery   = opportunity exists but lead never verified
  const outcomeBreakdown = useMemo(() => {
    const oppById = new Map(oppsArr.map((o) => [o.id, o]));
    const leadById = new Map(leads.map((l) => [l.id, l]));

    let viewed = 0;
    let responded = 0;
    let interested = 0;
    let released = 0;
    let stale = 0;
    let unresolved = 0;

    const now = Date.now();

    for (const r of routesArr) {
      if (r.viewed_at) viewed++;
      if (r.responded_at) responded++;
      if (r.interested_at) interested++;
      if (r.contact_released_at) released++;

      const opp = oppById.get(r.opportunity_id);
      if (!opp) continue;
      const lead = leadById.get(opp.lead_id);
      const terminal =
        !!lead?.appointment_booked_at ||
        !!lead?.closed_at ||
        lead?.deal_status === "dead";

      if (!terminal) {
        unresolved++;
        const last = Math.max(
          r.contact_released_at ? new Date(r.contact_released_at).getTime() : 0,
          r.interested_at ? new Date(r.interested_at).getTime() : 0,
          r.responded_at ? new Date(r.responded_at).getTime() : 0,
          r.viewed_at ? new Date(r.viewed_at).getTime() : 0,
          r.sent_at ? new Date(r.sent_at).getTime() : 0,
          r.created_at ? new Date(r.created_at).getTime() : 0
        );
        if (last && (now - last) / 36e5 > STALE_HOURS) stale++;
      }
    }

    // Recovery candidates: opportunity exists but lead never verified.
    let recovery = 0;
    for (const o of oppsArr) {
      const lead = leadById.get(o.lead_id);
      if (lead && !lead.phone_verified) recovery++;
    }

    return { viewed, responded, interested, released, stale, unresolved, recovery };
  }, [oppsArr, routesArr, leads]);

  // ─── Contractor breakdown (observed routes per contractor) ──────────
  const contractorBreakdown = useMemo(() => {
    const byId = new Map<
      string,
      { name: string; routes: number; counties: Set<string> }
    >();
    for (const c of contractorsArr) {
      byId.set(c.id, { name: c.company_name, routes: 0, counties: new Set() });
    }
    const oppById = new Map(oppsArr.map((o) => [o.id, o]));
    for (const r of routesArr) {
      const bucket = byId.get(r.contractor_id);
      if (!bucket) continue;
      bucket.routes++;
      const county = oppById.get(r.opportunity_id)?.county?.trim();
      if (county) bucket.counties.add(county);
    }
    return Array.from(byId.entries())
      .map(([id, v]) => ({
        id,
        name: v.name,
        routes: v.routes,
        counties: Array.from(v.counties).sort(),
      }))
      .sort((a, b) => b.routes - a.routes);
  }, [contractorsArr, oppsArr, routesArr]);

  // ─── County breakdown (from leads) ──────────────────────────────────
  const countyBreakdown = useMemo(() => {
    const map = new Map<string, { captured: number; verified: number; routed: number }>();
    let unknown = 0;
    for (const l of leads) {
      const key = l.county?.trim() || null;
      if (!key) {
        unknown++;
        continue;
      }
      const cur = map.get(key) ?? { captured: 0, verified: 0, routed: 0 };
      cur.captured++;
      if (l.phone_verified) cur.verified++;
      if (l.routed_to_contractor_at) cur.routed++;
      map.set(key, cur);
    }
    const rows = Array.from(map.entries())
      .map(([county, v]) => ({ county, ...v }))
      .sort((a, b) => b.captured - a.captured);
    return { rows, unknown };
  }, [leads]);

  // ─── Helpers: clipboard + CSV ───────────────────────────────────────
  const copyText = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  }, []);

  const downloadCSV = useCallback((filename: string, rows: (string | number)[][]) => {
    const escape = (v: string | number) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = rows.map((r) => r.map(escape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`${filename} downloaded`);
  }, []);

  const summaryText = useMemo(() => {
    const t = topLine;
    const o = outcomeBreakdown;
    return [
      `WindowMan — Operator Reporting Snapshot`,
      `Generated: ${new Date().toLocaleString()}`,
      ``,
      `TOP-LINE`,
      `  Captured:    ${t.captured}`,
      `  Verified:    ${t.verified}`,
      `  Unlocked:    ${t.unlocked}`,
      `  Routed:      ${t.routed}`,
      `  Booked:      ${t.booked}`,
      `  Closed:      ${t.closed}`,
      `  Counties:    ${t.counties}`,
      ``,
      `OUTCOMES (operator-view derivations)`,
      `  Viewed:      ${o.viewed}`,
      `  Responded:   ${o.responded}`,
      `  Interested:  ${o.interested}`,
      `  Released:    ${o.released}`,
      `  Unresolved:  ${o.unresolved}`,
      `  Stale:       ${o.stale} (>${STALE_HOURS}h no activity)`,
      `  Recovery:    ${o.recovery}`,
      ``,
      `Notes:`,
      `  • Operator-view categories (unresolved/stale/recovery) are`,
      `    derived deterministically from real fields. They are not a`,
      `    backend state machine.`,
      `  • No revenue, ROI, or contractor scoring is implied.`,
    ].join("\n");
  }, [topLine, outcomeBreakdown]);

  const exportTopLineCSV = useCallback(() => {
    const t = topLine;
    const o = outcomeBreakdown;
    downloadCSV("operator_reporting_topline.csv", [
      ["metric", "value"],
      ["captured", t.captured],
      ["verified", t.verified],
      ["unlocked", t.unlocked],
      ["routed", t.routed],
      ["booked", t.booked],
      ["closed", t.closed],
      ["counties", t.counties],
      ["outcome_viewed", o.viewed],
      ["outcome_responded", o.responded],
      ["outcome_interested", o.interested],
      ["outcome_released", o.released],
      ["outcome_unresolved", o.unresolved],
      ["outcome_stale", o.stale],
      ["outcome_recovery", o.recovery],
    ]);
  }, [topLine, outcomeBreakdown, downloadCSV]);

  const exportContractorsCSV = useCallback(() => {
    const rows: (string | number)[][] = [
      ["contractor_id", "contractor_name", "routes_observed", "counties_observed", "counties"],
    ];
    for (const c of contractorBreakdown) {
      rows.push([c.id, c.name, c.routes, c.counties.length, c.counties.join("|")]);
    }
    downloadCSV("operator_reporting_by_contractor.csv", rows);
  }, [contractorBreakdown, downloadCSV]);

  const exportCountiesCSV = useCallback(() => {
    const rows: (string | number)[][] = [["county", "captured", "verified", "routed"]];
    for (const r of countyBreakdown.rows) {
      rows.push([r.county, r.captured, r.verified, r.routed]);
    }
    if (countyBreakdown.unknown > 0) {
      rows.push(["Unknown County", countyBreakdown.unknown, 0, 0]);
    }
    downloadCSV("operator_reporting_by_county.csv", rows);
  }, [countyBreakdown, downloadCSV]);

  const goTab = useCallback(
    (tab: string) => {
      if (onNavigateTab) onNavigateTab(tab);
      else toast.info(`Open the “${tab}” tab to continue`);
    },
    [onNavigateTab]
  );

  const isLoading = contractorsLoading || oppsLoading || routesLoading;

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
              <BarChart3 className="h-5 w-5 text-primary" />
              Operator Reporting
            </h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
              Honest current-state reporting from repo-real fields. Use Copy /
              CSV for internal recaps and contractor conversations. No revenue,
              ROI, or contractor scoring is implied.
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
              onClick={() => copyText(summaryText, "Reporting summary")}
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Copy Summary
            </Button>
          </div>
        </div>
      </div>

      {/* ── Top-Line Honest Counts ───────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Top-Line Counts
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={exportTopLineCSV}
          >
            <Download className="h-3 w-3 mr-1.5" />
            CSV
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <Stat label="Captured" value={topLine.captured} />
          <Stat label="Verified" value={topLine.verified} />
          <Stat label="Unlocked" value={topLine.unlocked} />
          <Stat label="Routed" value={topLine.routed} />
          <Stat label="Booked" value={topLine.booked} />
          <Stat label="Closed" value={topLine.closed} />
          <Stat label="Counties" value={topLine.counties} />
        </CardContent>
      </Card>

      {/* ── Status / Outcome Breakdown ───────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Outcome Breakdown{" "}
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-normal">
              (operator view)
            </span>
          </CardTitle>
          <p className="text-[11px] text-muted-foreground mt-1">
            Derived deterministically from route + lead fields. Mirrors the
            categories used in Outcome Tracking and Pilot Ops.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <Stat label="Viewed" value={outcomeBreakdown.viewed} />
          <Stat label="Responded" value={outcomeBreakdown.responded} />
          <Stat label="Interested" value={outcomeBreakdown.interested} />
          <Stat label="Released" value={outcomeBreakdown.released} />
          <Stat label="Unresolved" value={outcomeBreakdown.unresolved} />
          <Stat label={`Stale >${STALE_HOURS}h`} value={outcomeBreakdown.stale} />
          <Stat label="Recovery" value={outcomeBreakdown.recovery} />
        </CardContent>
      </Card>

      {/* ── Contractor Breakdown ─────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              By Contractor{" "}
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-normal">
                (observed)
              </span>
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-1">
              Routes observed per contractor + counties seen on those routes.
              Contractor-declared service area is not separately modeled.
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={exportContractorsCSV}
            disabled={contractorBreakdown.length === 0}
          >
            <Download className="h-3 w-3 mr-1.5" />
            CSV
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {contractorBreakdown.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              No contractors found in registry.
            </p>
          ) : (
            contractorBreakdown.map((c) => (
              <div
                key={c.id}
                className="rounded-md border bg-background p-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {c.counties.length > 0 ? (
                      c.counties.map((county) => (
                        <Badge key={county} variant="outline" className="text-[10px]">
                          {county}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-[11px] text-muted-foreground italic">
                        No counties observed yet
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold tabular-nums leading-none">
                    {c.routes}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1 font-semibold">
                    routes
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* ── County Breakdown ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              By County
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-1">
              Derived from `leads.county`. Unknown County rolls up leads with
              no county on file.
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={exportCountiesCSV}
            disabled={countyBreakdown.rows.length === 0 && countyBreakdown.unknown === 0}
          >
            <Download className="h-3 w-3 mr-1.5" />
            CSV
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-semibold uppercase tracking-wider text-[10px]">
                    County
                  </th>
                  <th className="py-2 font-semibold uppercase tracking-wider text-[10px] text-right">
                    Captured
                  </th>
                  <th className="py-2 font-semibold uppercase tracking-wider text-[10px] text-right">
                    Verified
                  </th>
                  <th className="py-2 font-semibold uppercase tracking-wider text-[10px] text-right">
                    Routed
                  </th>
                </tr>
              </thead>
              <tbody>
                {countyBreakdown.rows.map((r) => (
                  <tr key={r.county} className="border-b last:border-0">
                    <td className="py-2 text-foreground">{r.county}</td>
                    <td className="py-2 text-right tabular-nums">{r.captured}</td>
                    <td className="py-2 text-right tabular-nums">{r.verified}</td>
                    <td className="py-2 text-right tabular-nums">{r.routed}</td>
                  </tr>
                ))}
                {countyBreakdown.unknown > 0 && (
                  <tr className="border-b last:border-0">
                    <td className="py-2 text-muted-foreground italic">
                      Unknown County
                    </td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">
                      {countyBreakdown.unknown}
                    </td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">
                      —
                    </td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">
                      —
                    </td>
                  </tr>
                )}
                {countyBreakdown.rows.length === 0 && countyBreakdown.unknown === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-muted-foreground italic">
                      No county data captured yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Unresolved / Needs Attention ─────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Unresolved · Needs Attention
          </CardTitle>
          <p className="text-[11px] text-muted-foreground mt-1">
            Routed opportunities with no terminal outcome yet, plus stale and
            recovery candidates derived from real timestamps.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <NeedsBlock
            label="Unresolved"
            value={outcomeBreakdown.unresolved}
            hint="Routed but no booked / closed / dead signal."
            tone="amber"
          />
          <NeedsBlock
            label={`Stale >${STALE_HOURS}h`}
            value={outcomeBreakdown.stale}
            hint="No route activity in over 72 hours."
            tone="amber"
          />
          <NeedsBlock
            label="Recovery"
            value={outcomeBreakdown.recovery}
            hint="Opportunity exists but lead never verified."
            tone="muted"
          />
        </CardContent>
      </Card>

      {/* ── Reporting Notes / Current Limits ─────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="h-4 w-4" />
            Reporting Notes · Current Limits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs leading-relaxed text-muted-foreground">
          <Note>
            All counts come from real fields on{" "}
            <code className="text-[11px]">leads</code>,{" "}
            <code className="text-[11px]">contractor_opportunities</code>, and{" "}
            <code className="text-[11px]">contractor_opportunity_routes</code>.
          </Note>
          <Note>
            Operator-view categories (Unresolved, Stale, Recovery) are{" "}
            <span className="text-foreground">deterministic frontend</span>{" "}
            groupings — not a backend state machine.
          </Note>
          <Note>
            County breakdown reflects leads only. Contractor-specific service
            area is observed from routes, not from a declared coverage table.
          </Note>
          <Note>
            This report does <span className="text-foreground">not claim</span>{" "}
            revenue, ROI, contractor scoring, or close-rate completeness.
          </Note>
          <Note>
            Exports are client-side only. Nothing is persisted or shared
            outside this browser tab.
          </Note>
        </CardContent>
      </Card>

      {/* ── Quick Links ──────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            Quick Links
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <QuickLink label="Routing Desk" onClick={() => goTab("routing")} />
          <QuickLink label="Active Pipeline" onClick={() => goTab("pipeline")} />
          <QuickLink label="Outcome Tracking" onClick={() => goTab("outcomes")} />
          <QuickLink label="Pilot Ops / Launch Control" onClick={() => goTab("launch")} />
          <QuickLink label="Pilot Readiness" onClick={() => goTab("pilot")} />
          <QuickLink label="Contractor Onboarding" onClick={() => goTab("onboarding")} />
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="text-2xl font-bold tabular-nums leading-none">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1.5 font-semibold">
        {label}
      </p>
    </div>
  );
}

function NeedsBlock({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "amber" | "muted";
}) {
  const toneClass =
    tone === "amber"
      ? "border-amber-500/30 bg-amber-500/5"
      : "border-border bg-muted/20";
  return (
    <div className={`rounded-md border p-3 ${toneClass}`}>
      <p className="text-2xl font-bold tabular-nums leading-none">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1.5 font-semibold">
        {label}
      </p>
      <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">{hint}</p>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
      <p>{children}</p>
    </div>
  );
}

function QuickLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between rounded-md border bg-background hover:bg-muted/40 px-3 py-2 text-xs text-foreground transition-colors"
    >
      <span>{label}</span>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
    </button>
  );
}
