/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LAUNCH READINESS / SYSTEM HEALTH VERIFICATION — Phase 20
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Internal operator surface for verifying that the current system looks
 * healthy enough to run live pilot operations today.
 *
 * This is NOT a monitoring backend, NOT an alerting engine, NOT a synthetic
 * test runner. It composes existing repo-real reads and exposes them as
 * honest, deterministic operator-view signals + a local-only checklist.
 *
 * SIGNAL CLASSIFICATION (operator-view, deterministic, frontend-only):
 *   • "operational"  — repo-real read returned data and matches expectation
 *   • "attention"    — read returned but data is sparse or borderline
 *   • "unknown"      — read failed or has not yet returned (preview/auth-expired)
 *
 * Signals are derived from:
 *   • leads (passed in from the dashboard)
 *   • fetchOpportunities / fetchRoutes / fetchContractors
 *
 * NO new edge functions. NO schema changes. NO persisted checklist state.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ClipboardCheck,
  ExternalLink,
  RefreshCw,
  Copy,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Users,
  MapPin,
  FileBarChart2,
  Route as RouteIcon,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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

type SignalStatus = "operational" | "attention" | "unknown";

interface HealthSignal {
  key: string;
  title: string;
  status: SignalStatus;
  value: string;
  detail: string;
  /** Optional admin tab to jump to. */
  tab?: string;
  icon: typeof Activity;
}

interface ManualCheck {
  key: string;
  label: string;
  hint: string;
}

const MANUAL_CHECKS: ManualCheck[] = [
  {
    key: "scan_smoke",
    label: "Run a homeowner scan smoke test",
    hint: "Upload a known-good quote on the public funnel and confirm the report unlocks via OTP.",
  },
  {
    key: "routing_dry",
    label: "Open Routing Desk and confirm contractors load",
    hint: "Active contractors should appear with no auth-expired banner.",
  },
  {
    key: "dossier_open",
    label: "Open one Lead Dossier and confirm history loads",
    hint: "Owner / prior owner / route timeline should render.",
  },
  {
    key: "outcomes_review",
    label: "Review Outcome Tracking for unresolved items",
    hint: "Confirm no obviously stuck booked / closed items.",
  },
  {
    key: "lifecycle_review",
    label: "Skim Dead / Stale / Recovery surface",
    hint: "Make sure the operator-view stale buckets look reasonable today.",
  },
  {
    key: "report_prep_glance",
    label: "Glance at contractor-safe reporting prep",
    hint: "Confirm contractor-safe vs internal-only buckets read cleanly.",
  },
];

const QUICK_LINKS: Array<{ tab: string; label: string; desc: string }> = [
  { tab: "launch", label: "Pilot Ops / Launch Control", desc: "Day-of operator launch surface." },
  { tab: "routing", label: "Routing Desk", desc: "Canonical routing path." },
  { tab: "pipeline", label: "Active Pipeline", desc: "Live opportunities + ownership." },
  { tab: "outcomes", label: "Outcome Tracking", desc: "Booked / unresolved / closed visibility." },
  { tab: "reporting", label: "Operator Reporting / Export", desc: "Composed reads + client-side export." },
  { tab: "lifecycle", label: "Dead / Stale / Recovery", desc: "Operator lifecycle review." },
  { tab: "report-prep", label: "Client-Facing Reporting Prep", desc: "Contractor-safe vs internal-only." },
  { tab: "audit", label: "Pilot-to-Platform Audit", desc: "Capability + readiness map." },
];

const STATUS_STYLES: Record<
  SignalStatus,
  { badge: string; icon: typeof CheckCircle2; label: string }
> = {
  operational: {
    badge: "bg-emerald-500/15 text-emerald-950 border-emerald-500/30",
    icon: CheckCircle2,
    label: "Operational",
  },
  attention: {
    badge: "bg-amber-500/15 text-amber-950 border-amber-500/30",
    icon: AlertTriangle,
    label: "Needs attention",
  },
  unknown: {
    badge: "bg-muted text-slate-700 border-border",
    icon: HelpCircle,
    label: "Unknown",
  },
};

interface Props {
  leads: CRMLead[];
  onNavigateTab?: (tab: string) => void;
}

export function LaunchReadinessSurface({ leads, onNavigateTab }: Props) {
  const { toast } = useToast();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    signals: true,
    manual: true,
    checklist: true,
    risks: true,
    links: true,
  });
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const contractorsQuery = useQuery({
    queryKey: ["admin", "contractors"],
    queryFn: fetchContractors,
    staleTime: 60_000,
  });
  const opportunitiesQuery = useQuery({
    queryKey: ["admin", "opportunities"],
    queryFn: fetchOpportunities,
    staleTime: 30_000,
  });
  const routesQuery = useQuery({
    queryKey: ["admin", "routes"],
    queryFn: () => fetchRoutes(),
    staleTime: 30_000,
  });

  /**
   * Deterministic signal derivation. Each signal looks at one repo-real read
   * and assigns operational / attention / unknown based on simple rules:
   *   • fetch error or no data → unknown
   *   • zero or near-zero count → attention (still loadable, but sparse)
   *   • populated → operational
   */
  const signals: HealthSignal[] = useMemo(() => {
    const out: HealthSignal[] = [];

    // Leads loading
    {
      const count = leads.length;
      const status: SignalStatus = count > 0 ? "operational" : "attention";
      out.push({
        key: "leads",
        title: "Leads loading",
        status,
        value: `${count} leads in admin view`,
        detail:
          count > 0
            ? "fetch_leads returned a populated set."
            : "No leads visible. Could be a fresh environment or auth-expired admin session.",
        icon: Inbox,
        tab: "pipeline",
      });
    }

    // Scans completing (proxy: leads with latest_analysis_id)
    {
      const scanned = leads.filter((l) => !!l.latest_analysis_id).length;
      const status: SignalStatus =
        scanned > 0 ? "operational" : leads.length === 0 ? "unknown" : "attention";
      out.push({
        key: "scans",
        title: "Scans completing",
        status,
        value: `${scanned} of ${leads.length} leads have a latest analysis`,
        detail:
          scanned > 0
            ? "scan-quote is producing analyses linked back to leads."
            : "No analyses observed yet. Confirm a scan completes end-to-end.",
        icon: Activity,
        tab: "command",
      });
    }

    // Phone-verified flow
    {
      const verified = leads.filter((l) => l.phone_verified).length;
      const status: SignalStatus =
        verified > 0 ? "operational" : leads.length === 0 ? "unknown" : "attention";
      out.push({
        key: "verified",
        title: "OTP / verified reveal flow",
        status,
        value: `${verified} verified leads`,
        detail:
          verified > 0
            ? "Verified leads exist; the OTP-gated reveal is producing real verifications."
            : "No verified leads observed. Run a smoke test before live use.",
        icon: ShieldAlert,
        tab: "ghosts",
      });
    }

    // Contractor accounts
    {
      const list: RoutingContractor[] = contractorsQuery.data ?? [];
      const active = list.filter((c) => c.status === "active").length;
      const status: SignalStatus =
        contractorsQuery.isError
          ? "unknown"
          : active > 0
          ? "operational"
          : "attention";
      out.push({
        key: "contractors",
        title: "Contractor accounts",
        status,
        value: `${active} active / ${list.length} total`,
        detail:
          contractorsQuery.isError
            ? "fetch_contractors did not return. Check admin auth / network."
            : active > 0
            ? "At least one active contractor is available for routing."
            : "No active contractors. Routing will have nowhere to send work.",
        icon: Users,
        tab: "contractors",
      });
    }

    // Routing operational (routes + opportunities)
    {
      const opps: RoutingOpportunity[] = opportunitiesQuery.data ?? [];
      const routes: RoutingRoute[] = routesQuery.data ?? [];
      const errored = opportunitiesQuery.isError || routesQuery.isError;
      const status: SignalStatus = errored
        ? "unknown"
        : opps.length > 0 || routes.length > 0
        ? "operational"
        : "attention";
      out.push({
        key: "routing",
        title: "Routing visibility",
        status,
        value: `${opps.length} opportunities · ${routes.length} routes`,
        detail: errored
          ? "fetch_opportunities or fetch_routes did not return. Check admin auth."
          : opps.length > 0 || routes.length > 0
          ? "Opportunities and/or routes are visible to the admin client."
          : "No opportunities or routes yet. Expected only on a fresh environment.",
        icon: RouteIcon,
        tab: "routing",
      });
    }

    // Ownership / history visibility (proxy: any lead with routed_to_contractor_at)
    {
      const routed = leads.filter((l) => !!l.routed_to_contractor_at).length;
      const status: SignalStatus =
        routed > 0 ? "operational" : leads.length === 0 ? "unknown" : "attention";
      out.push({
        key: "ownership",
        title: "Ownership / history visibility",
        status,
        value: `${routed} leads with routing timestamp`,
        detail:
          routed > 0
            ? "Routed-to-contractor timestamps exist; ownership history will populate."
            : "No routed leads observed. Owner / prior-owner views may look empty.",
        icon: Users,
        tab: "shared-market",
      });
    }

    // Outcomes visibility (booked or closed)
    {
      const booked = leads.filter((l) => !!l.appointment_booked_at).length;
      const closed = leads.filter((l) => !!l.closed_at).length;
      const status: SignalStatus =
        booked + closed > 0 ? "operational" : leads.length === 0 ? "unknown" : "attention";
      out.push({
        key: "outcomes",
        title: "Outcome visibility",
        status,
        value: `${booked} booked · ${closed} closed`,
        detail:
          booked + closed > 0
            ? "Outcome timestamps exist on leads. Outcome Tracking will show signal."
            : "No booked/closed outcomes yet. Outcome Tracking may render empty.",
        icon: FileBarChart2,
        tab: "outcomes",
      });
    }

    // Market awareness (county coverage from leads + opportunities)
    {
      const counties = new Set<string>();
      for (const l of leads) {
        const c = (l.county ?? "").trim();
        if (c) counties.add(c.toLowerCase());
      }
      for (const o of opportunitiesQuery.data ?? []) {
        const c = (o.county ?? "").trim();
        if (c) counties.add(c.toLowerCase());
      }
      const status: SignalStatus =
        counties.size > 0
          ? "operational"
          : leads.length === 0 && (opportunitiesQuery.data ?? []).length === 0
          ? "unknown"
          : "attention";
      out.push({
        key: "market",
        title: "Market / county awareness",
        status,
        value: `${counties.size} observed counties`,
        detail:
          counties.size > 0
            ? "County data is populated on leads and/or opportunities."
            : "No counties observed. Market views will be sparse.",
        icon: MapPin,
        tab: "shared-market",
      });
    }

    return out;
  }, [
    leads,
    contractorsQuery.data,
    contractorsQuery.isError,
    opportunitiesQuery.data,
    opportunitiesQuery.isError,
    routesQuery.data,
    routesQuery.isError,
  ]);

  const counts = useMemo(() => {
    const c: Record<SignalStatus, number> = { operational: 0, attention: 0, unknown: 0 };
    for (const s of signals) c[s.status] += 1;
    return c;
  }, [signals]);

  const checklistDone = useMemo(
    () => MANUAL_CHECKS.filter((c) => checked[c.key]).length,
    [checked],
  );

  const toggle = (key: string) =>
    setOpenSections((s) => ({ ...s, [key]: !s[key] }));

  const refetchAll = async () => {
    await Promise.all([
      contractorsQuery.refetch(),
      opportunitiesQuery.refetch(),
      routesQuery.refetch(),
    ]);
    toast({ title: "Health signals refreshed", description: "Repo-real reads were re-queried." });
  };

  const copySnapshot = async () => {
    const lines: string[] = [];
    lines.push("WindowMan — Launch Readiness snapshot (operator view)");
    lines.push("");
    lines.push(
      `Signals: ${counts.operational} operational · ${counts.attention} attention · ${counts.unknown} unknown`,
    );
    lines.push("");
    for (const s of signals) {
      const label = STATUS_STYLES[s.status].label;
      lines.push(`  • [${label}] ${s.title} — ${s.value}`);
      lines.push(`      ${s.detail}`);
    }
    lines.push("");
    lines.push(`Manual checks: ${checklistDone} / ${MANUAL_CHECKS.length} complete (local-only).`);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast({ title: "Snapshot copied", description: "Plain-text readiness snapshot copied." });
    } catch {
      toast({ title: "Copy failed", description: "Could not access clipboard.", variant: "destructive" });
    }
  };

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
                <Badge variant="secondary" className="text-sm">
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <ClipboardCheck className="h-6 w-6 text-primary mt-0.5" />
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Launch Readiness / System Health Verification
              </h2>
              <p className="text-sm text-slate-700 mt-1 max-w-2xl">
                Internal operator view. Repo-real signals + a local-only
                checklist for start-of-day verification. This is not
                automated monitoring; signals reflect the same admin reads
                the rest of the dashboard already uses.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refetchAll} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh signals
            </Button>
            <Button variant="outline" size="sm" onClick={copySnapshot} className="gap-1.5">
              <Copy className="h-3.5 w-3.5" />
              Copy snapshot
            </Button>
          </div>
        </div>

        {/* Status totals */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {(["operational", "attention", "unknown"] as SignalStatus[]).map((s) => {
            const style = STATUS_STYLES[s];
            return (
              <div key={s} className={`rounded-md border px-3 py-2 ${style.badge}`}>
                <div className="text-sm uppercase tracking-wide opacity-100">{style.label}</div>
                <div className="text-lg font-bold">{counts[s]}</div>
              </div>
            );
          })}
        </div>
        <p className="text-sm text-slate-700 mt-2 italic">
          Signals are operator-view derivations from current admin reads. They
          do not replace real infrastructure monitoring.
        </p>
      </div>

      {/* Repo-real signals */}
      <div className="space-y-2">
        <SectionHeader
          sectionKey="signals"
          icon={Activity}
          title="Repo-real health signals"
          subtitle="Derived from current admin reads — leads, contractors, opportunities, routes."
          badgeText={`${signals.length} signals`}
        />
        {openSections.signals && (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {signals.map((sig) => {
              const style = STATUS_STYLES[sig.status];
              const Icon = sig.icon;
              const StatusIcon = style.icon;
              return (
                <li key={sig.key} className="p-3 flex items-start gap-3">
                  <Icon className="h-4 w-4 mt-1 text-slate-700 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground">{sig.title}</span>
                      <Badge variant="outline" className={`text-sm ${style.badge}`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {style.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-foreground mt-1">{sig.value}</p>
                    <p className="text-xs text-slate-700 mt-0.5">{sig.detail}</p>
                    {sig.tab && onNavigateTab && (
                      <button
                        type="button"
                        onClick={() => onNavigateTab(sig.tab!)}
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
        )}
      </div>

      {/* Manual operator checks (local-only checklist) */}
      <div className="space-y-2">
        <SectionHeader
          sectionKey="checklist"
          icon={ClipboardCheck}
          title="Start-of-day verification checklist"
          subtitle="Local-only operator checklist. Not persisted; resets on refresh."
          badgeText={`${checklistDone} / ${MANUAL_CHECKS.length}`}
        />
        {openSections.checklist && (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {MANUAL_CHECKS.map((c) => {
              const isChecked = !!checked[c.key];
              return (
                <li key={c.key} className="p-3 flex items-start gap-3">
                  <Checkbox
                    id={`check-${c.key}`}
                    checked={isChecked}
                    onCheckedChange={(v) =>
                      setChecked((prev) => ({ ...prev, [c.key]: v === true }))
                    }
                    className="mt-1"
                  />
                  <label htmlFor={`check-${c.key}`} className="flex-1 min-w-0 cursor-pointer">
                    <div className={`text-sm font-medium ${isChecked ? "text-slate-700 line-through" : "text-foreground"}`}>
                      {c.label}
                    </div>
                    <div className="text-xs text-slate-700 mt-0.5">{c.hint}</div>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Manual operator checks (guidance) */}
      <div className="space-y-2">
        <SectionHeader
          sectionKey="manual"
          icon={ShieldAlert}
          title="Manual operator checks"
          subtitle="Verification steps that still require operator judgment, not automation."
        />
        {openSections.manual && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-sm text-foreground">
            <p>
              Repo-real signals tell the operator whether reads are returning
              and whether expected data is present. They do not replace
              hands-on verification of the homeowner funnel, OTP flow, or
              contractor handoff.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Confirm a fresh public scan completes and the report unlocks via OTP.</li>
              <li>Open Routing Desk and confirm contractor list renders without auth-expired banners.</li>
              <li>Open one Lead Dossier to confirm history + ownership render.</li>
              <li>Skim Outcome Tracking and Lifecycle for obviously stuck items.</li>
            </ul>
          </div>
        )}
      </div>

      {/* Risks / cautions */}
      <div className="space-y-2">
        <SectionHeader
          sectionKey="risks"
          icon={AlertTriangle}
          title="Current risks / cautions"
          subtitle="What to keep in mind. None of these are automated alerts."
        />
        {openSections.risks && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-2">
            <ul className="text-sm text-foreground space-y-1.5 list-disc pl-5">
              <li>No infrastructure monitoring or alerting exists in-app — health signals here are best-effort frontend derivations.</li>
              <li>"Unknown" signals usually mean an admin read failed or the session is auth-expired. Re-auth and refresh.</li>
              <li>Lifecycle classifications (stale / recovery) are operator-view derivations, not backend statuses.</li>
              <li>OTP, scanner, and tracking systems are protected and intentionally not health-checked from the client.</li>
              <li>Outcome counts depend on operator-entered timestamps; sparse data is expected on a fresh environment.</li>
            </ul>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="space-y-2">
        <SectionHeader
          sectionKey="links"
          icon={ExternalLink}
          title="Quick links"
          subtitle="Jump into the canonical surfaces this readiness check references."
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

export default LaunchReadinessSurface;
