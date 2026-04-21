/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CLIENT-FACING REPORTING PREP — Phase 18
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Internal operator-prep surface that organizes existing repo-real reporting
 * into two clearly separated buckets:
 *
 *   1. CONTRACTOR-SAFE — honest current-state summaries that a contractor
 *      could reasonably be shown today (routed / booked / unresolved /
 *      stale / recovery counts; counties covered).
 *
 *   2. INTERNAL-ONLY — operator-view derivations, ambiguity buckets,
 *      lifecycle interpretation that should NOT be exposed externally.
 *
 * This is a READ-ONLY preparation layer. There is NO contractor portal,
 * NO sharing system, NO publish/email workflow, and NO backend-persisted
 * draft state. All derivations come from real fields already present on
 * `leads`, `contractor_opportunities`, and `contractor_opportunity_routes`.
 *
 * Operators get:
 *   - Contractor-safe summary block (shareable copy)
 *   - Internal-only summary block (kept separated)
 *   - "What can be shared today" guidance
 *   - Current limits / disclosure notes
 *   - Future contractor report preview structure (informational)
 *   - Quick links into existing canonical surfaces
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardCheck,
  Eye,
  EyeOff,
  Copy,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  FileText,
  MapPin,
  Activity,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { fetchOpportunities, fetchRoutes } from "@/services/adminDataService";
import type {
  RoutingOpportunity,
  RoutingRoute,
} from "@/types/routingDesk";
import type { CRMLead } from "@/components/admin/types";

// Operator-view derivation thresholds — kept consistent with Phase 15 lifecycle surface.
const STALE_HOURS = 72;
const REVIEW_BEFORE_DEAD_HOURS = 168; // 7 days

interface Props {
  leads: CRMLead[];
  onNavigateTab?: (tab: string) => void;
}

interface ContractorSafeCounts {
  routed: number;
  booked: number;
  unresolved: number;
  staleOperatorView: number;
  recoveryOperatorView: number;
  countiesCovered: number;
}

interface InternalOnlyCounts {
  ambiguousNeedsReview: number;
  releasedAwaitingNextStep: number;
  routedNoDownstreamSignal: number;
  manualReviewQueue: number;
}

export function ClientFacingReportingPrepSurface({ leads, onNavigateTab }: Props) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    safe: true,
    internal: true,
    share: false,
    limits: false,
    future: false,
  });

  const { data: oppsData } = useQuery({
    queryKey: ["admin", "opportunities"],
    queryFn: fetchOpportunities,
    staleTime: 30_000,
  });

  const { data: routesData } = useQuery({
    queryKey: ["admin", "routes", "all"],
    queryFn: () => fetchRoutes(),
    staleTime: 30_000,
  });

  const { contractorSafe, internalOnly } = useMemo(() => {
    const opps = (oppsData as RoutingOpportunity[] | undefined) ?? [];
    const routes = (routesData as RoutingRoute[] | undefined) ?? [];
    const now = Date.now();

    // Index latest route per opportunity for downstream-signal derivations.
    const latestRouteByOpp = new Map<string, RoutingRoute>();
    for (const r of routes) {
      const existing = latestRouteByOpp.get(r.opportunity_id);
      const t = (x: RoutingRoute) => new Date(x.sent_at ?? x.created_at).getTime();
      if (!existing || t(r) > t(existing)) latestRouteByOpp.set(r.opportunity_id, r);
    }

    // Index leads by id for cross-reference.
    const leadById = new Map(leads.map((l) => [l.id, l]));

    // ── CONTRACTOR-SAFE derivations ──────────────────────────────────────
    let routed = 0;
    let staleOperatorView = 0;
    for (const o of opps) {
      if (!o.routed_at) continue;
      routed++;
      const r = latestRouteByOpp.get(o.id);
      const routedTime = new Date(o.routed_at).getTime();
      const lead = leadById.get(o.lead_id);
      const lastCallCompleted = (lead as any)?.last_call_completed_at ?? null;
      // Stale = routed > STALE_HOURS, no responded_at, no completed call
      if (
        now - routedTime > STALE_HOURS * 60 * 60 * 1000 &&
        !r?.responded_at &&
        !lastCallCompleted
      ) {
        staleOperatorView++;
      }
    }

    const booked = leads.filter((l) => l.appointment_booked_at).length;

    // Unresolved = routed but no terminal signal (not booked, not closed, no
    // contact_released_at, no responded_at) — operator-safe contractor count.
    let unresolved = 0;
    for (const o of opps) {
      if (!o.routed_at) continue;
      const r = latestRouteByOpp.get(o.id);
      const lead = leadById.get(o.lead_id);
      const isBooked = !!lead?.appointment_booked_at;
      const isClosed = !!lead?.closed_at;
      const isReleased = !!r?.contact_released_at;
      const hasResponse = !!r?.responded_at;
      if (!isBooked && !isClosed && !isReleased && !hasResponse) {
        unresolved++;
      }
    }

    // Recovery candidates (operator-view) — report_unlocked > 14d, not routed.
    const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
    const recoveryOperatorView = leads.filter((l) => {
      const unlocked = l.report_unlocked_at ? new Date(l.report_unlocked_at).getTime() : null;
      if (!unlocked) return false;
      return now - unlocked > FOURTEEN_DAYS_MS && !l.routed_to_contractor_at;
    }).length;

    // Counties covered — distinct non-empty county across leads with activity.
    const countySet = new Set<string>();
    for (const l of leads) {
      const hasActivity = !!(
        l.report_unlocked_at ||
        l.routed_to_contractor_at ||
        l.latest_analysis_id
      );
      if (!hasActivity) continue;
      const c = l.county?.trim();
      if (c) countySet.add(c);
    }

    const safe: ContractorSafeCounts = {
      routed,
      booked,
      unresolved,
      staleOperatorView,
      recoveryOperatorView,
      countiesCovered: countySet.size,
    };

    // ── INTERNAL-ONLY derivations ────────────────────────────────────────
    // Ambiguous = routed > REVIEW_BEFORE_DEAD_HOURS, no terminal signal.
    let ambiguous = 0;
    let releasedAwaitingNextStep = 0;
    let routedNoDownstreamSignal = 0;
    for (const o of opps) {
      if (!o.routed_at) continue;
      const r = latestRouteByOpp.get(o.id);
      const lead = leadById.get(o.lead_id);
      const routedTime = new Date(o.routed_at).getTime();
      const noTerminal =
        !lead?.appointment_booked_at &&
        !lead?.closed_at &&
        !r?.responded_at &&
        !r?.contact_released_at;

      if (
        noTerminal &&
        now - routedTime > REVIEW_BEFORE_DEAD_HOURS * 60 * 60 * 1000
      ) {
        ambiguous++;
      }

      // Released but no booking / no closed signal — internal review only.
      if (
        r?.contact_released_at &&
        !lead?.appointment_booked_at &&
        !lead?.closed_at
      ) {
        releasedAwaitingNextStep++;
      }

      // Routed > 24h, no viewed/responded/interested signal at all.
      if (
        now - routedTime > 24 * 60 * 60 * 1000 &&
        !r?.viewed_at &&
        !r?.responded_at &&
        !r?.interested_at
      ) {
        routedNoDownstreamSignal++;
      }
    }

    // Manual review queue = leads with manual_entry intent or unverified
    // identity but having activity. Use existing field shape.
    const manualReviewQueue = leads.filter(
      (l) => l.latest_analysis_id && !l.phone_verified,
    ).length;

    const internal: InternalOnlyCounts = {
      ambiguousNeedsReview: ambiguous,
      releasedAwaitingNextStep,
      routedNoDownstreamSignal,
      manualReviewQueue,
    };

    return { contractorSafe: safe, internalOnly: internal };
  }, [oppsData, routesData, leads]);

  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const buildContractorSafeText = () => {
    return [
      `Window Man — Contractor-Safe Summary (current state)`,
      ``,
      `Routed opportunities: ${contractorSafe.routed}`,
      `Booked opportunities: ${contractorSafe.booked}`,
      `Unresolved (no terminal signal yet): ${contractorSafe.unresolved}`,
      `Stale (operator view, >${STALE_HOURS}h no response): ${contractorSafe.staleOperatorView}`,
      `Recovery candidates (operator view): ${contractorSafe.recoveryOperatorView}`,
      `Counties covered (active markets): ${contractorSafe.countiesCovered}`,
      ``,
      `Notes: counts reflect current-state observations from the routing/`,
      `outcome data we already track. Stale/recovery are operator-view`,
      `derivations, not automated lifecycle states. Reporting does not`,
      `claim ROI, revenue, or contractor performance grades.`,
    ].join("\n");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildContractorSafeText());
      toast({
        title: "Copied",
        description: "Contractor-safe summary copied to clipboard.",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Could not access clipboard.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <header className="border-b border-border pb-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 mt-0.5">
            <ClipboardCheck className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold tracking-tight">
              Client-Facing Reporting Prep
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Internal operator surface for separating <strong>contractor-safe</strong>{" "}
              reporting from <strong>internal-only</strong> review data. Read-only.
              No portal, no sharing system, no publication workflow.
            </p>
          </div>
        </div>
      </header>

      {/* ─── Contractor-Safe Summary ───────────────────────────────── */}
      <section className="rounded-lg border border-emerald-500/30 bg-emerald-500/5">
        <button
          onClick={() => toggle("safe")}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-emerald-500/10 transition-colors rounded-t-lg"
        >
          <div className="flex items-center gap-2">
            {expanded.safe ? (
              <ChevronDown className="h-4 w-4 text-emerald-700" />
            ) : (
              <ChevronRight className="h-4 w-4 text-emerald-700" />
            )}
            <Eye className="h-4 w-4 text-emerald-700" />
            <h3 className="font-semibold text-sm">Contractor-Safe Summary</h3>
            <Badge
              variant="outline"
              className="ml-1 border-emerald-500/40 text-emerald-700 bg-emerald-500/10 text-[10px]"
            >
              SHAREABLE
            </Badge>
          </div>
          <span className="text-[10px] uppercase tracking-wide text-emerald-700/80 font-mono">
            current state only
          </span>
        </button>

        {expanded.safe && (
          <div className="px-4 pb-4 space-y-4">
            <p className="text-xs text-muted-foreground italic">
              Honest current-state counts derived from real routing/outcome
              fields. Safe to share verbatim with a contractor today.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <SafeTile label="Routed" value={contractorSafe.routed} />
              <SafeTile label="Booked" value={contractorSafe.booked} />
              <SafeTile label="Unresolved" value={contractorSafe.unresolved} />
              <SafeTile
                label="Stale (operator view)"
                value={contractorSafe.staleOperatorView}
              />
              <SafeTile
                label="Recovery candidates"
                value={contractorSafe.recoveryOperatorView}
              />
              <SafeTile
                label="Counties covered"
                value={contractorSafe.countiesCovered}
                icon={MapPin}
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-emerald-500/20">
              <p className="text-[11px] text-muted-foreground">
                Caveat: stale and recovery are operator-view derivations, not
                automated lifecycle states.
              </p>
              <Button size="sm" variant="outline" onClick={handleCopy}>
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                Copy Summary
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* ─── Internal-Only / Operator View ─────────────────────────── */}
      <section className="rounded-lg border border-amber-500/30 bg-amber-500/5">
        <button
          onClick={() => toggle("internal")}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-amber-500/10 transition-colors rounded-t-lg"
        >
          <div className="flex items-center gap-2">
            {expanded.internal ? (
              <ChevronDown className="h-4 w-4 text-amber-700" />
            ) : (
              <ChevronRight className="h-4 w-4 text-amber-700" />
            )}
            <EyeOff className="h-4 w-4 text-amber-700" />
            <h3 className="font-semibold text-sm">Internal-Only / Operator View</h3>
            <Badge
              variant="outline"
              className="ml-1 border-amber-500/40 text-amber-700 bg-amber-500/10 text-[10px]"
            >
              DO NOT SHARE
            </Badge>
          </div>
          <span className="text-[10px] uppercase tracking-wide text-amber-700/80 font-mono">
            operator-view derivations
          </span>
        </button>

        {expanded.internal && (
          <div className="px-4 pb-4 space-y-4">
            <p className="text-xs text-muted-foreground italic">
              Ambiguity buckets and operator-only review derivations. These
              should remain inside Mission Control and not be presented to
              contractors as headline reporting.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
              <InternalTile
                label="Ambiguous / Needs Review"
                sublabel={`Routed > ${REVIEW_BEFORE_DEAD_HOURS}h, no terminal signal`}
                value={internalOnly.ambiguousNeedsReview}
              />
              <InternalTile
                label="Released, Awaiting Next Step"
                sublabel="Contact released, no booking/close yet"
                value={internalOnly.releasedAwaitingNextStep}
              />
              <InternalTile
                label="Routed, No Downstream Signal"
                sublabel=">24h, no viewed/responded/interested"
                value={internalOnly.routedNoDownstreamSignal}
              />
              <InternalTile
                label="Manual Review Queue"
                sublabel="Has analysis, identity not verified"
                value={internalOnly.manualReviewQueue}
              />
            </div>

            <p className="text-[11px] text-muted-foreground pt-2 border-t border-amber-500/20">
              These categories use repo-real fields but require operator
              interpretation. Do not paste into contractor-facing material.
            </p>
          </div>
        )}
      </section>

      {/* ─── What Can Be Shared Today ──────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card">
        <button
          onClick={() => toggle("share")}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors rounded-t-lg"
        >
          <div className="flex items-center gap-2">
            {expanded.share ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">What Can Be Shared Today</h3>
          </div>
        </button>

        {expanded.share && (
          <div className="px-4 pb-4 space-y-3 text-sm">
            <Guidance
              ok
              text="Routed / booked / unresolved counts (current-state)."
            />
            <Guidance
              ok
              text="Counties covered (markets where activity exists)."
            />
            <Guidance
              ok
              text="Honest stale/recovery candidate counts, labeled as operator-view."
            />
            <Guidance
              warn
              text="Avoid sharing ambiguity buckets without context — they require operator interpretation."
            />
            <Guidance
              warn
              text="Avoid implying ROI, revenue, win-rate, or contractor scoring."
            />
            <Guidance
              warn
              text="Avoid claiming guaranteed lifecycle correctness or automated follow-up."
            />
            <Guidance
              bad
              text="Do not share internal lifecycle interpretation, dialer notes, or operator review heuristics."
            />
          </div>
        )}
      </section>

      {/* ─── Current Limits / Disclosure Notes ─────────────────────── */}
      <section className="rounded-lg border border-border bg-card">
        <button
          onClick={() => toggle("limits")}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors rounded-t-lg"
        >
          <div className="flex items-center gap-2">
            {expanded.limits ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Current Limits / Disclosure Notes</h3>
          </div>
        </button>

        {expanded.limits && (
          <div className="px-4 pb-4 space-y-2 text-sm">
            <LimitRow text="No automated contractor-facing report publishing exists today." />
            <LimitRow text="No contractor login / portal / share-link system is live." />
            <LimitRow text="Stale and recovery groupings are operator-view only — not backend-modeled lifecycle states." />
            <LimitRow text="Revenue / ROI / contractor performance grades are intentionally NOT computed." />
            <LimitRow text="County coverage reflects observed activity, not formal territory assignment." />
            <LimitRow text="Booked counts come from lead.appointment_booked_at; ground-truth still requires manual review." />
            <LimitRow text="Anything labeled 'operator view' should be presented with that caveat if shared." />
          </div>
        )}
      </section>

      {/* ─── Future Contractor Report Preview ──────────────────────── */}
      <section className="rounded-lg border border-border bg-card">
        <button
          onClick={() => toggle("future")}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors rounded-t-lg"
        >
          <div className="flex items-center gap-2">
            {expanded.future ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <Lock className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">
              Future Contractor Report — Preview Structure
            </h3>
            <Badge variant="outline" className="ml-1 text-[10px]">
              INFORMATIONAL
            </Badge>
          </div>
        </button>

        {expanded.future && (
          <div className="px-4 pb-4 space-y-3 text-sm">
            <p className="text-xs text-muted-foreground italic">
              Reference structure for what a future contractor-facing report
              could include. Not built. No auth, no sharing, no persistence.
            </p>
            <FuturePreviewSection
              title="1. Top-line Outcomes"
              points={[
                "Routed / booked / unresolved counts (current-state)",
                "Last activity date",
              ]}
            />
            <FuturePreviewSection
              title="2. Market Coverage"
              points={[
                "Counties observed",
                "Active vs quiet markets (current-state, observed only)",
              ]}
            />
            <FuturePreviewSection
              title="3. Routed Opportunity Summary"
              points={[
                "Routed count",
                "Viewed / responded / interested counts (contractor-safe rollups only)",
              ]}
            />
            <FuturePreviewSection
              title="4. Outcome Visibility"
              points={[
                "Booked count",
                "Closed / completed (when explicitly modeled)",
              ]}
            />
            <FuturePreviewSection
              title="5. System Notes"
              points={[
                "What the system tracks today",
                "What still requires manual operator review",
                "Honest limits — no ROI claims, no scoring",
              ]}
            />
          </div>
        )}
      </section>

      {/* ─── Quick Links ───────────────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-muted/20 p-4">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          Quick Links — Existing Surfaces
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <QuickLink label="Operator Reporting" tab="reporting" onNavigateTab={onNavigateTab} />
          <QuickLink label="Outcome Tracking" tab="outcomes" onNavigateTab={onNavigateTab} />
          <QuickLink label="Pilot Readiness" tab="pilot" onNavigateTab={onNavigateTab} />
          <QuickLink label="Launch Control" tab="launch" onNavigateTab={onNavigateTab} />
          <QuickLink label="Contractor Onboarding" tab="onboarding" onNavigateTab={onNavigateTab} />
          <QuickLink label="Contractor Feedback" tab="feedback" onNavigateTab={onNavigateTab} />
          <QuickLink label="Shared Market" tab="shared-market" onNavigateTab={onNavigateTab} />
          <QuickLink label="Lifecycle Workflow" tab="lifecycle" onNavigateTab={onNavigateTab} />
          <QuickLink label="Routing Desk" tab="routing" onNavigateTab={onNavigateTab} />
        </div>
      </section>
    </div>
  );
}

/* ── Internal subcomponents ─────────────────────────────────────────── */

function SafeTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon?: React.ElementType;
}) {
  return (
    <div className="rounded-md border border-emerald-500/20 bg-background p-3">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3 text-emerald-700" />}
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
          {label}
        </p>
      </div>
      <p className="text-2xl font-bold tabular-nums mt-1">{value}</p>
    </div>
  );
}

function InternalTile({
  label,
  sublabel,
  value,
}: {
  label: string;
  sublabel: string;
  value: number;
}) {
  return (
    <div className="rounded-md border border-amber-500/20 bg-background p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
        {label}
      </p>
      <p className="text-2xl font-bold tabular-nums mt-1">{value}</p>
      <p className="text-[10px] text-muted-foreground italic mt-0.5">
        {sublabel}
      </p>
    </div>
  );
}

function Guidance({
  ok,
  warn,
  bad,
  text,
}: {
  ok?: boolean;
  warn?: boolean;
  bad?: boolean;
  text: string;
}) {
  const tone = ok
    ? "text-emerald-700"
    : warn
    ? "text-amber-700"
    : "text-rose-700";
  const Icon = ok ? Eye : warn ? AlertTriangle : EyeOff;
  const prefix = ok ? "OK" : warn ? "CAUTION" : "DO NOT";
  return (
    <div className="flex items-start gap-2">
      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${tone}`} />
      <p className="text-sm">
        <span className={`font-mono text-[10px] font-bold mr-2 ${tone}`}>
          {prefix}
        </span>
        {text}
      </p>
    </div>
  );
}

function LimitRow({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-1.5 text-xs">•</span>
      <p className="text-sm text-foreground/90">{text}</p>
    </div>
  );
}

function FuturePreviewSection({
  title,
  points,
}: {
  title: string;
  points: string[];
}) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
        {title}
      </p>
      <ul className="space-y-1">
        {points.map((p, i) => (
          <li key={i} className="text-sm flex items-start gap-2">
            <span className="text-muted-foreground mt-1 text-[10px]">▸</span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function QuickLink({
  label,
  tab,
  onNavigateTab,
}: {
  label: string;
  tab: string;
  onNavigateTab?: (tab: string) => void;
}) {
  if (!onNavigateTab) {
    return (
      <div className="rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
        {label}
      </div>
    );
  }
  return (
    <button
      onClick={() => onNavigateTab(tab)}
      className="rounded-md border border-border bg-background px-3 py-2 text-xs hover:bg-muted hover:border-primary/40 transition-colors text-left flex items-center justify-between group"
    >
      <span>{label}</span>
      <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
    </button>
  );
}
