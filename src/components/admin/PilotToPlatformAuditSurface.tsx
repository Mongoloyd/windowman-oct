/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PILOT-TO-PLATFORM AUDIT — Phase 19
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Internal operator-facing audit surface. The goal is NOT to invent a
 * roadmap engine, NOT to persist audit state, NOT to score maturity.
 * It is a single read-only place where the operator can answer:
 *
 *   • What is genuinely ready today?
 *   • What is pilot-only / manual operator control?
 *   • What is multi-contractor / shared-market ready?
 *   • What reporting is honest enough to share today?
 *   • What platform gaps remain intentionally unbuilt?
 *
 * CLASSIFICATION SOURCE
 * ─────────────────────
 * Capability classifications are STATIC and reflect what the current repo
 * actually ships today (admin surfaces, canonical routing, ownership
 * visibility, etc.). They are not derived from a backend "readiness" table
 * because no such table exists — and inventing one would be drift.
 *
 * Where light operator-view counts are shown (contractors present,
 * opportunities visible, observed counties), they come from the same
 * repo-real reads (`fetchContractors`, `fetchOpportunities`, `fetchRoutes`)
 * the rest of admin already uses. They are clearly labeled "observed".
 *
 * NO new edge functions. NO new tables. NO billing. NO portal. NO automation.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardList,
  CheckCircle2,
  Wrench,
  Users,
  FileBarChart2,
  Lock,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Copy,
  Activity,
  AlertTriangle,
  Layers,
  ShieldCheck,
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

interface Props {
  leads: CRMLead[];
  onNavigateTab?: (tab: string) => void;
}

/**
 * Capability classification labels.
 * These map to the spec's Phase-19 buckets and are intentionally static.
 */
type ReadinessLabel =
  | "Ready Today"
  | "Pilot Only"
  | "Manual Operator Control"
  | "Informational / Not Yet Automated"
  | "Future Platform Work";

interface CapabilityRow {
  name: string;
  area:
    | "Intake"
    | "Routing"
    | "Ownership"
    | "Outcomes"
    | "Onboarding"
    | "Reporting"
    | "Shared Market"
    | "Lifecycle"
    | "Feedback"
    | "Platform";
  readiness: ReadinessLabel;
  notes: string;
  /** Optional admin tab to jump to. */
  tab?: string;
}

/**
 * STATIC capability map — reflects the real shipped admin surfaces.
 * Each row is a thing the operator can (or cannot) actually do today.
 */
const CAPABILITY_MAP: CapabilityRow[] = [
  // Intake / scan
  {
    name: "Live homeowner intake + scan loop",
    area: "Intake",
    readiness: "Ready Today",
    notes: "Public funnel, OTP gate, scan-quote, preview/full report split is live and protected.",
  },

  // Routing
  {
    name: "Canonical routing path (route a lead to a contractor)",
    area: "Routing",
    readiness: "Ready Today",
    notes: "RoutingDesk + canonical route action; explicit contractor choice supported today.",
    tab: "routing",
  },
  {
    name: "Active pipeline visibility",
    area: "Routing",
    readiness: "Ready Today",
    notes: "ActivePipeline shows current opportunities, owners, and movement.",
    tab: "pipeline",
  },

  // Ownership / history
  {
    name: "Current owner / prior owner visibility",
    area: "Ownership",
    readiness: "Ready Today",
    notes: "OwnershipBlock + OpportunityRouteTimeline expose route history per opportunity.",
  },
  {
    name: "Release / recovery context visibility",
    area: "Ownership",
    readiness: "Manual Operator Control",
    notes: "Release status, contact_released, and route history are visible; reassignment is operator-driven.",
    tab: "shared-market",
  },

  // Outcomes / feedback
  {
    name: "Outcome tracking (booked / unresolved / closed)",
    area: "Outcomes",
    readiness: "Ready Today",
    notes: "OutcomeTrackingReport reflects real lead lifecycle fields.",
    tab: "outcomes",
  },
  {
    name: "Contractor feedback loop visibility",
    area: "Feedback",
    readiness: "Pilot Only",
    notes: "Operator-facing review surface; no contractor-side input mechanism yet.",
    tab: "feedback",
  },

  // Onboarding
  {
    name: "Contractor onboarding visibility",
    area: "Onboarding",
    readiness: "Ready Today",
    notes: "ContractorOnboardingSurface shows real contractor records and handoff state.",
    tab: "onboarding",
  },

  // Reporting
  {
    name: "Operator reporting + client-side export",
    area: "Reporting",
    readiness: "Ready Today",
    notes: "OperatorReportingSurface composes repo-real reads; export is client-side.",
    tab: "reporting",
  },
  {
    name: "Contractor-safe reporting prep",
    area: "Reporting",
    readiness: "Manual Operator Control",
    notes: "ClientFacingReportingPrepSurface separates contractor-safe vs internal-only summaries.",
    tab: "report-prep",
  },
  {
    name: "Server-side report generation / scheduled exports",
    area: "Reporting",
    readiness: "Future Platform Work",
    notes: "No background job system. Exports remain client-side and on-demand today.",
  },

  // Shared market / multi-contractor
  {
    name: "Observed contractor overlap by county",
    area: "Shared Market",
    readiness: "Informational / Not Yet Automated",
    notes: "Derived from current routed/opportunity data only. Not a formal territory model.",
    tab: "shared-market",
  },
  {
    name: "Manual multi-contractor expansion",
    area: "Shared Market",
    readiness: "Manual Operator Control",
    notes: "Operator can manually add/route to additional contractors. No automation.",
    tab: "onboarding",
  },
  {
    name: "Round-robin / fairness / territory enforcement",
    area: "Shared Market",
    readiness: "Future Platform Work",
    notes: "Not built. Intentionally deferred until pilot signal supports it.",
  },
  {
    name: "Release-to-network automation",
    area: "Shared Market",
    readiness: "Future Platform Work",
    notes: "Releases are reviewed manually; no auto-network broadcast exists.",
  },

  // Lifecycle / recovery
  {
    name: "Dead / stale / recovery review",
    area: "Lifecycle",
    readiness: "Manual Operator Control",
    notes: "Lifecycle classifications are operator-view derivations from real timestamps.",
    tab: "lifecycle",
  },

  // Platform-level gaps
  {
    name: "Contractor self-serve portal (login + dashboard)",
    area: "Platform",
    readiness: "Future Platform Work",
    notes: "No contractor-facing auth surface in the audit scope of this phase.",
  },
  {
    name: "Billing / Stripe / seat model",
    area: "Platform",
    readiness: "Future Platform Work",
    notes: "Out of scope. No Stripe wiring or seat enforcement exists.",
  },
  {
    name: "Master pixel / operator ad-control UI",
    area: "Platform",
    readiness: "Future Platform Work",
    notes: "Tracking is preserved at the canonical layer; no operator pixel UI is built.",
  },
];

/* ── Static groupings for rendering ───────────────────────────────────── */

const READINESS_ORDER: ReadinessLabel[] = [
  "Ready Today",
  "Manual Operator Control",
  "Pilot Only",
  "Informational / Not Yet Automated",
  "Future Platform Work",
];

const READINESS_STYLES: Record<
  ReadinessLabel,
  { badge: string; icon: typeof CheckCircle2 }
> = {
  "Ready Today": {
    badge: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    icon: CheckCircle2,
  },
  "Manual Operator Control": {
    badge: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    icon: Wrench,
  },
  "Pilot Only": {
    badge: "bg-blue-500/15 text-blue-700 border-blue-500/30",
    icon: Activity,
  },
  "Informational / Not Yet Automated": {
    badge: "bg-slate-500/15 text-slate-700 border-slate-500/30",
    icon: Layers,
  },
  "Future Platform Work": {
    badge: "bg-muted text-slate-700 border-border",
    icon: Lock,
  },
};

/* ── Quick-link targets ───────────────────────────────────────────────── */

const QUICK_LINKS: Array<{ tab: string; label: string; desc: string }> = [
  { tab: "pilot", label: "Pilot Readiness", desc: "Demo-ready summary of current pilot state." },
  { tab: "launch", label: "Pilot Ops / Launch Control", desc: "Day-of operator launch surface." },
  { tab: "outcomes", label: "Outcome Tracking", desc: "Close-loop outcome visibility." },
  { tab: "onboarding", label: "Contractor Onboarding", desc: "Onboarding + handoff visibility." },
  { tab: "reporting", label: "Operator Reporting / Export", desc: "Composed reads + client-side export." },
  { tab: "lifecycle", label: "Dead / Stale / Recovery", desc: "Lifecycle review workflow." },
  { tab: "feedback", label: "Contractor Feedback Loop", desc: "Operator review of contractor signals." },
  { tab: "shared-market", label: "Shared Market Manual Controls", desc: "Manual reassignment + observed overlap." },
  { tab: "report-prep", label: "Client-Facing Reporting Prep", desc: "Contractor-safe vs internal-only split." },
];

/* ── Component ────────────────────────────────────────────────────────── */

export function PilotToPlatformAuditSurface({ leads, onNavigateTab }: Props) {
  const { toast } = useToast();

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    capabilities: true,
    ready: true,
    manual: true,
    multi: true,
    reporting: true,
    gaps: true,
    links: true,
  });

  // Repo-real reads — same pattern as every other admin surface.
  const { data: contractors } = useQuery({
    queryKey: ["admin", "contractors"],
    queryFn: fetchContractors,
    staleTime: 60_000,
  });
  const { data: opportunities } = useQuery({
    queryKey: ["admin", "opportunities"],
    queryFn: fetchOpportunities,
    staleTime: 30_000,
  });
  const { data: routes } = useQuery({
    queryKey: ["admin", "routes"],
    queryFn: () => fetchRoutes(),
    staleTime: 30_000,
  });

  /**
   * Observed signals — purely informational counts derived from repo-real
   * reads. These never gate behavior; they only contextualize the audit.
   */
  const observed = useMemo(() => {
    const contractorList: RoutingContractor[] = contractors ?? [];
    const oppList: RoutingOpportunity[] = opportunities ?? [];
    const routeList: RoutingRoute[] = routes ?? [];

    const counties = new Set<string>();
    for (const o of oppList) {
      const c = (o.county ?? "").trim();
      if (c) counties.add(c.toLowerCase());
    }
    for (const l of leads) {
      const c = (l.county ?? "").trim();
      if (c) counties.add(c.toLowerCase());
    }

    const contractorsWithRoutes = new Set(routeList.map((r) => r.contractor_id).filter(Boolean));
    const activeContractors = contractorList.filter((c) => c.status === "active").length;

    return {
      contractorCount: contractorList.length,
      activeContractors,
      contractorsWithRoutes: contractorsWithRoutes.size,
      opportunityCount: oppList.length,
      routeCount: routeList.length,
      observedCounties: counties.size,
      leadCount: leads.length,
    };
  }, [contractors, opportunities, routes, leads]);

  /** Counts per readiness label for header summary. */
  const readinessCounts = useMemo(() => {
    const counts: Record<ReadinessLabel, number> = {
      "Ready Today": 0,
      "Manual Operator Control": 0,
      "Pilot Only": 0,
      "Informational / Not Yet Automated": 0,
      "Future Platform Work": 0,
    };
    for (const row of CAPABILITY_MAP) counts[row.readiness] += 1;
    return counts;
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<ReadinessLabel, CapabilityRow[]>();
    for (const label of READINESS_ORDER) map.set(label, []);
    for (const row of CAPABILITY_MAP) map.get(row.readiness)!.push(row);
    return map;
  }, []);

  const toggle = (key: string) =>
    setOpenSections((s) => ({ ...s, [key]: !s[key] }));

  const copyAuditSummary = async () => {
    const lines: string[] = [];
    lines.push("WindowMan — Pilot-to-Platform Audit (operator view)");
    lines.push("");
    lines.push("Observed signals:");
    lines.push(`  • Contractors: ${observed.contractorCount} (${observed.activeContractors} active)`);
    lines.push(`  • Opportunities visible: ${observed.opportunityCount}`);
    lines.push(`  • Routes recorded: ${observed.routeCount}`);
    lines.push(`  • Observed counties: ${observed.observedCounties}`);
    lines.push(`  • Leads in admin view: ${observed.leadCount}`);
    lines.push("");
    for (const label of READINESS_ORDER) {
      const rows = grouped.get(label) ?? [];
      if (!rows.length) continue;
      lines.push(`${label} (${rows.length})`);
      for (const r of rows) lines.push(`  • [${r.area}] ${r.name} — ${r.notes}`);
      lines.push("");
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast({ title: "Audit summary copied", description: "Plain-text snapshot copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Could not access clipboard.", variant: "destructive" });
    }
  };

  /* ── Render helpers ──────────────────────────────────────────────────── */

  const SectionHeader = ({
    sectionKey,
    icon: Icon,
    title,
    subtitle,
    badgeText,
  }: {
    sectionKey: string;
    icon: typeof CheckCircle2;
    title: string;
    subtitle?: string;
    badgeText?: string;
  }) => {
    const open = openSections[sectionKey];
    return (
      <button
        type="button"
        onClick={() => toggle(sectionKey)}
        className="w-full flex items-start justify-between gap-3 text-left p-4 rounded-lg border border-border bg-card hover:bg-accent/40 transition-colors"
      >
        <div className="flex items-start gap-3">
          <Icon className="h-5 w-5 mt-0.5 text-slate-700" />
          <div>
            <div className="font-semibold text-foreground flex items-center gap-2">
              {title}
              {badgeText && (
                <Badge variant="secondary" className="text-[10px]">
                  {badgeText}
                </Badge>
              )}
            </div>
            {subtitle && (
              <div className="text-xs text-slate-700 mt-0.5">{subtitle}</div>
            )}
          </div>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-slate-700 mt-1" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-700 mt-1" />
        )}
      </button>
    );
  };

  const CapabilityList = ({ rows }: { rows: CapabilityRow[] }) => (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card">
      {rows.map((row) => {
        const style = READINESS_STYLES[row.readiness];
        const Icon = style.icon;
        return (
          <li key={`${row.area}-${row.name}`} className="p-3 flex items-start gap-3">
            <Icon className="h-4 w-4 mt-1 text-slate-700 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm text-foreground">{row.name}</span>
                <Badge variant="outline" className="text-[10px]">{row.area}</Badge>
                <Badge variant="outline" className={`text-[10px] ${style.badge}`}>
                  {row.readiness}
                </Badge>
              </div>
              <p className="text-xs text-slate-700 mt-1">{row.notes}</p>
              {row.tab && onNavigateTab && (
                <button
                  type="button"
                  onClick={() => onNavigateTab(row.tab!)}
                  className="mt-1 text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  Open surface <ExternalLink className="h-3 w-3" />
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );

  /* ── Render ─────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <ClipboardList className="h-6 w-6 text-primary mt-0.5" />
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Pilot-to-Platform Audit
              </h2>
              <p className="text-sm text-slate-700 mt-1 max-w-2xl">
                Internal operator view. A read-only honest snapshot of what
                ships today, what is operator-manual, and what is intentionally
                not built yet. No backend audit state; no roadmap engine.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={copyAuditSummary} className="gap-1.5">
            <Copy className="h-3.5 w-3.5" />
            Copy audit summary
          </Button>
        </div>

        {/* Readiness counts */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {READINESS_ORDER.map((label) => {
            const style = READINESS_STYLES[label];
            return (
              <div
                key={label}
                className={`rounded-md border px-3 py-2 ${style.badge}`}
              >
                <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
                <div className="text-lg font-bold">{readinessCounts[label]}</div>
              </div>
            );
          })}
        </div>

        {/* Observed signals */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
            <div className="text-slate-700">Contractors</div>
            <div className="font-semibold text-foreground">{observed.contractorCount}</div>
          </div>
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
            <div className="text-slate-700">Active</div>
            <div className="font-semibold text-foreground">{observed.activeContractors}</div>
          </div>
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
            <div className="text-slate-700">With routes</div>
            <div className="font-semibold text-foreground">{observed.contractorsWithRoutes}</div>
          </div>
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
            <div className="text-slate-700">Opportunities</div>
            <div className="font-semibold text-foreground">{observed.opportunityCount}</div>
          </div>
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
            <div className="text-slate-700">Routes</div>
            <div className="font-semibold text-foreground">{observed.routeCount}</div>
          </div>
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
            <div className="text-slate-700">Observed counties</div>
            <div className="font-semibold text-foreground">{observed.observedCounties}</div>
          </div>
        </div>
        <p className="text-[11px] text-slate-700 mt-2 italic">
          Observed signals are read directly from current contractor / opportunity / route data.
          They contextualize the audit and never drive automation.
        </p>
      </div>

      {/* B. Current Capabilities */}
      <div className="space-y-2">
        <SectionHeader
          sectionKey="capabilities"
          icon={Layers}
          title="Current capabilities"
          subtitle="What the system can actually do today, grouped by readiness."
          badgeText={`${CAPABILITY_MAP.length} items`}
        />
        {openSections.capabilities && (
          <div className="space-y-4 pl-2">
            {READINESS_ORDER.map((label) => {
              const rows = grouped.get(label) ?? [];
              if (!rows.length) return null;
              const style = READINESS_STYLES[label];
              return (
                <div key={label} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[11px] ${style.badge}`}>
                      {label}
                    </Badge>
                    <span className="text-xs text-slate-700">
                      {rows.length} {rows.length === 1 ? "item" : "items"}
                    </span>
                  </div>
                  <CapabilityList rows={rows} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* C. Ready Today (focused view) */}
      <div className="space-y-2">
        <SectionHeader
          sectionKey="ready"
          icon={CheckCircle2}
          title="Ready today"
          subtitle="Capabilities that are genuinely usable right now for live operator work."
          badgeText={String(readinessCounts["Ready Today"])}
        />
        {openSections.ready && (
          <div className="pl-2">
            <CapabilityList rows={grouped.get("Ready Today") ?? []} />
          </div>
        )}
      </div>

      {/* D. Pilot Only / Manual Operator Control */}
      <div className="space-y-2">
        <SectionHeader
          sectionKey="manual"
          icon={Wrench}
          title="Pilot only / manual operator control"
          subtitle="Exists today, but still operator-manual. Do not present as automation."
          badgeText={String(
            (grouped.get("Manual Operator Control")?.length ?? 0) +
              (grouped.get("Pilot Only")?.length ?? 0)
          )}
        />
        {openSections.manual && (
          <div className="space-y-3 pl-2">
            <CapabilityList rows={grouped.get("Manual Operator Control") ?? []} />
            <CapabilityList rows={grouped.get("Pilot Only") ?? []} />
          </div>
        )}
      </div>

      {/* E. Multi-contractor / Shared-market readiness */}
      <div className="space-y-2">
        <SectionHeader
          sectionKey="multi"
          icon={Users}
          title="Multi-contractor / shared-market readiness"
          subtitle="What broader rollout can lean on today vs what is still missing."
        />
        {openSections.multi && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-3 text-sm text-foreground">
            <div className="flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              <p>
                <span className="font-medium">Supported today:</span>{" "}
                explicit contractor choice in the canonical route action,
                current vs prior owner visibility, route history, observed
                contractor overlap by county, and manual reassignment review.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Wrench className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p>
                <span className="font-medium">Operator-manual today:</span>{" "}
                release / recovery review, manual multi-contractor expansion,
                and shared-market routing decisions. All flow through existing
                admin surfaces — no automation is implied.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Lock className="h-4 w-4 text-slate-700 mt-0.5 shrink-0" />
              <p>
                <span className="font-medium">Not built:</span>{" "}
                round-robin, fairness balancing, formal territory enforcement,
                automatic release-to-network, and any contractor-side self-serve
                surface. These remain Future Platform Work.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* F. Reporting / contractor-safe reporting readiness */}
      <div className="space-y-2">
        <SectionHeader
          sectionKey="reporting"
          icon={FileBarChart2}
          title="Reporting & contractor-safe reporting readiness"
          subtitle="What reporting is honest enough to share today vs what stays internal."
        />
        {openSections.reporting && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-3 text-sm text-foreground">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              <p>
                <span className="font-medium">Strong internal reporting:</span>{" "}
                routed / booked / unresolved counts, county coverage, ownership
                and route history. Powered by repo-real reads with client-side
                export.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Wrench className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p>
                <span className="font-medium">Contractor-safe summaries:</span>{" "}
                supportable today via the Client-Facing Reporting Prep surface
                with clear contractor-safe vs internal-only separation. Sharing
                is still operator-manual (copy/paste).
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Lock className="h-4 w-4 text-slate-700 mt-0.5 shrink-0" />
              <p>
                <span className="font-medium">Not built:</span>{" "}
                contractor-facing report delivery, scheduled exports,
                publish/share workflows, predictive analytics, or any
                ROI/grading claims. None of these exist in the current repo.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* G. Current system limits / Future platform gaps */}
      <div className="space-y-2">
        <SectionHeader
          sectionKey="gaps"
          icon={AlertTriangle}
          title="Current limits / future platform gaps"
          subtitle="What is intentionally not built yet. Helps prevent platform myth-making."
          badgeText={String(readinessCounts["Future Platform Work"])}
        />
        {openSections.gaps && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-2">
            <ul className="text-sm text-foreground space-y-1.5 list-disc pl-5">
              <li>No contractor self-serve portal or contractor login.</li>
              <li>No billing, Stripe checkout, or seat / subscription model.</li>
              <li>No round-robin, fairness, or territory enforcement engine.</li>
              <li>No automatic release-to-network broadcast.</li>
              <li>No server-side report generation or scheduled export jobs.</li>
              <li>No master pixel / operator ad-control UI.</li>
              <li>No backend audit / roadmap state — this surface is read-only.</li>
            </ul>
            <p className="text-xs text-slate-700 italic mt-2">
              These are intentional deferrals, not bugs. They will be revisited
              once pilot signal supports broader investment.
            </p>
          </div>
        )}
      </div>

      {/* H. Quick links */}
      <div className="space-y-2">
        <SectionHeader
          sectionKey="links"
          icon={ExternalLink}
          title="Quick links"
          subtitle="Jump into the canonical surfaces this audit references."
        />
        {openSections.links && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {QUICK_LINKS.map((link) => (
              <button
                key={link.tab}
                type="button"
                onClick={() => onNavigateTab?.(link.tab)}
                disabled={!onNavigateTab}
                className="text-left p-3 rounded-lg border border-border bg-card hover:bg-accent/40 transition-colors disabled:opacity-100 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm text-foreground">{link.label}</span>
                  <ExternalLink className="h-3.5 w-3.5 text-slate-700" />
                </div>
                <p className="text-xs text-slate-700 mt-1">{link.desc}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default PilotToPlatformAuditSurface;
