/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PILOT READINESS — Phase 9: Contractor Demo Surface (read-only)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Internal admin surface designed to help the operator walk a contractor
 * through what WindowMan does TODAY. Composed entirely of:
 *
 *   • Static explainer copy tied to the live product
 *   • Existing repo-real components (OneContractorSummaryStrip,
 *     MarketOpsFeed, SharedMarketReadinessSection)
 *   • Pure read-only useMemo derivations over the `leads` prop already
 *     loaded by AdminDashboard
 *
 * STRICT CONSTRAINTS (Phase 9):
 *   • No new data fetches.
 *   • No new endpoints.
 *   • No new types.
 *   • No interactive controls (no buttons, no toggles, no exports, no
 *     refresh, no share).
 *   • No fabricated KPIs, ROI math, revenue projections, or close-rate
 *     claims.
 *   • Future-direction copy is informational only and lives in the existing
 *     SharedMarketReadinessSection component.
 */

import { useMemo } from "react";
import {
  Upload, ScanSearch, Send, Briefcase,
  CheckCircle2, MapPin, ArrowRight, FileText,
  Phone, History, Eye, Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { OneContractorSummaryStrip } from "@/components/admin/OneContractorSummaryStrip";
import { MarketOpsFeed } from "@/components/admin/MarketOpsFeed";
import { SharedMarketReadinessSection } from "@/components/admin/SharedMarketReadinessSection";

import type { CRMLead } from "@/components/admin/types";

// Safe operator-facing fallback for null/empty geography.
const UNKNOWN_COUNTY = "Unknown County";

interface Props {
  leads: CRMLead[];
}

export function PilotReadiness({ leads }: Props) {
  // ── Step 5: Routing flow counts (repo-real timestamps on `leads`) ──────
  const flowCounts = useMemo(() => {
    let captured = 0;
    let verified = 0;
    let unlocked = 0;
    let routed = 0;
    let booked = 0;
    let closed = 0;
    for (const l of leads) {
      captured++;
      if (l.phone_verified_at) verified++;
      if (l.report_unlocked_at) unlocked++;
      if (l.routed_to_contractor_at) routed++;
      if (l.appointment_booked_at) booked++;
      if (l.closed_at) closed++;
    }
    return { captured, verified, unlocked, routed, booked, closed };
  }, [leads]);

  // ── Step 4: Market coverage (counties with any repo-real activity) ────
  const marketCoverage = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of leads) {
      const hasActivity = !!(
        l.report_unlocked_at ||
        l.routed_to_contractor_at ||
        l.latest_analysis_id
      );
      if (!hasActivity) continue;
      const county = l.county?.trim();
      const key = county && county.length > 0 ? county : UNKNOWN_COUNTY;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [leads]);

  return (
    <div className="w-full space-y-6">
      {/* ── Header strip ────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-base font-bold tracking-tight">
              Pilot Readiness — Contractor Demo Surface
            </CardTitle>
            <Badge variant="outline" className="text-sm">
              Read-only
            </Badge>
          </div>
          <p className="text-sm font-semibold text-slate-700 mt-1.5 leading-relaxed">
            Internal operator view. Use this surface to walk a contractor
            through what the system does today using live, repo-real data.
            Nothing here is interactive.
          </p>
        </CardHeader>
      </Card>

      {/* ── Step 2: What WindowMan Does ─────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-extrabold text-slate-950 uppercase tracking-wider">
            What WindowMan Does
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <ExplainerCard
              icon={Upload}
              step="01"
              title="Capture"
              body="Homeowner uploads their impact window/door quote through the public funnel. The system persists the lead, file, and attribution context."
            />
            <ExplainerCard
              icon={ScanSearch}
              step="02"
              title="Analyze"
              body="The deterministic Scanner Brain extracts and grades the quote across five forensic pillars. AI extracts; TypeScript scores."
            />
            <ExplainerCard
              icon={Send}
              step="03"
              title="Route"
              body="Operator-reviewed opportunities are routed from the Routing Desk to the assigned contractor with full context preserved."
            />
            <ExplainerCard
              icon={Briefcase}
              step="04"
              title="Deliver"
              body="Contractor receives a structured brief and homeowner contact (after release). Ownership and lifecycle are tracked end-to-end."
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Step 3: Current Operational Counts (reuse) ──────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-extrabold text-slate-950 uppercase tracking-wider">
            Current Operational Counts
          </CardTitle>
          <p className="text-sm text-slate-700 mt-1">
            Live counts from repo-real lifecycle timestamps. Identical to the
            Command Center summary strip.
          </p>
        </CardHeader>
        <CardContent>
          <OneContractorSummaryStrip leads={leads} />
        </CardContent>
      </Card>

      {/* ── Step 5: Current Routing Flow ────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-extrabold text-slate-950 uppercase tracking-wider">
            Current Routing Flow
          </CardTitle>
          <p className="text-sm text-slate-700 mt-1">
            Counts derived from repo-real timestamps on the leads table.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-stretch gap-2 pb-2">
            <FlowStep label="Captured" value={flowCounts.captured} />
            <FlowArrow />
            <FlowStep label="Verified" value={flowCounts.verified} />
            <FlowArrow />
            <FlowStep label="Report Unlocked" value={flowCounts.unlocked} />
            <FlowArrow />
            <FlowStep label="Routed" value={flowCounts.routed} accent />
            <FlowArrow />
            <FlowStep label="Booked" value={flowCounts.booked} accent />
            <FlowArrow />
            <FlowStep label="Closed" value={flowCounts.closed} />
          </div>
        </CardContent>
      </Card>

      {/* ── Step 4: Current Market Coverage ─────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-slate-700" />
            <CardTitle className="text-base font-extrabold text-slate-950 uppercase tracking-wider">
              Current Market Coverage
            </CardTitle>
          </div>
          <p className="text-sm text-slate-700 mt-1">
            Counties with at least one repo-real lifecycle event (report
            unlocked, routed, or analysis present).
          </p>
        </CardHeader>
        <CardContent>
          {marketCoverage.length === 0 ? (
            <p className="text-sm text-slate-700 text-center py-6">
              No county-level activity yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {marketCoverage.map(([county, count]) => (
                <div
                  key={county}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 flex items-center justify-between gap-2"
                >
                  <span className="text-sm font-semibold truncate">{county}</span>
                  <Badge variant="outline" className="text-sm tabular-nums shrink-0">
                    {count}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Step 6: What the Contractor Receives ────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-extrabold text-slate-950 uppercase tracking-wider">
            What the Contractor Receives
          </CardTitle>
          <p className="text-sm text-slate-700 mt-1">
            Live product truth — these surfaces already exist in admin today.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ReceiveRow
              icon={FileText}
              title="Routed Homeowner Opportunity"
              body="Structured brief with project type, window count, county, grade, and forensic flags — viewable in the Lead Dossier."
            />
            <ReceiveRow
              icon={Phone}
              title="Homeowner Contact (after release)"
              body="Verified phone and email released to the contractor through the operator-controlled release workflow."
            />
            <ReceiveRow
              icon={History}
              title="Ownership & Routing History"
              body="Full assignment, view, response, and release history visible on the Routing Desk timeline."
            />
            <ReceiveRow
              icon={Eye}
              title="Follow-up Visibility"
              body="Dialer activity, voice follow-ups, and reactivation signals surfaced through the Active Pipeline."
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Step 7: Market Activity Snapshot (reuse) ────────────────── */}
      <MarketOpsFeed leads={leads} />

      {/* ── Step 8: Future Shared Market Direction (reuse) ──────────── */}
      <SharedMarketReadinessSection />
    </div>
  );
}

/* ── Subcomponents (presentation only) ────────────────────────────── */

function ExplainerCard({
  icon: Icon, step, title, body,
}: {
  icon: React.ElementType;
  step: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-slate-300 bg-white p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center">
          <Icon className="h-4 w-4 text-foreground" />
        </div>
        <span className="text-sm font-mono text-slate-700 tracking-wider">
          {step}
        </span>
      </div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-sm font-semibold text-slate-700 leading-relaxed">{body}</p>
    </div>
  );
}

function FlowStep({
  label, value, accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`w-full sm:w-auto sm:shrink-0 min-w-[120px] rounded-lg border p-3 flex flex-col items-center justify-center text-center ${
        accent
          ? "border-cyan-500/30 bg-cyan-500/5"
          : "border-border bg-card"
      }`}
    >
      <p className="text-2xl font-bold tabular-nums leading-none">{value}</p>
      <p className="text-sm uppercase tracking-wide text-slate-700 mt-1.5 font-semibold">
        {label}
      </p>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="shrink-0 flex items-center justify-center py-1 sm:py-0">
      <ArrowRight className="h-4 w-4 text-slate-700 rotate-90 sm:rotate-0" />
    </div>
  );
}

function ReceiveRow({
  icon: Icon, title, body,
}: {
  icon: React.ElementType;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-300 bg-white">
      <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-foreground" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold">{title}</p>
          <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
        </div>
        <p className="text-sm font-semibold text-slate-700 mt-1 leading-relaxed">
          {body}
        </p>
      </div>
    </div>
  );
}

// Suppress unused import warning — Info is intentionally available for future
// inline annotations without re-importing.
void Info;
