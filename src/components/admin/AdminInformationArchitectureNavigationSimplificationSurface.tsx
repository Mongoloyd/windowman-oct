import { useMemo, useState } from "react";
import {
  Map as MapIcon,
  Activity,
  ClipboardList,
  ShieldCheck,
  GraduationCap,
  AlertTriangle,
  Compass,
  ExternalLink,
  Search,
  Star,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

/**
 * Phase 33 — Admin Information Architecture / Navigation Simplification
 *
 * INTERNAL READ-ONLY surface. No backend, no router rewrite, no persistence.
 *
 * GROUPING LOGIC (deterministic, current-state only):
 *
 * - "Operations"       = surfaces touched during daily lead handling
 *   (live pipeline, routing, dialer, ghosts, needs-review, contractors).
 *
 * - "Reporting"        = surfaces that summarize state for review or
 *   external sharing (reporting, report prep, outcomes, attribution,
 *   feedback).
 *
 * - "Audit / Readiness" = surfaces used for periodic checks, integrity,
 *   and decision boundaries (audit, health check, data quality,
 *   exceptions, governance, consistency, tech debt, learnings,
 *   shared market, lifecycle, change mgmt, pilot readiness).
 *
 * - "Planning / Training" = surfaces used to onboard, document, drill,
 *   plan rollouts, or expand (onboarding, training, rollout, docs,
 *   drills, expansion, launch control).
 *
 * Each surface has a "primary" flag: surfaces frequently used for daily
 * operation are marked primary (Core). Everything else is Supporting.
 *
 * No router or tab semantics are changed by this surface. It only
 * navigates by calling the existing setActiveTab handler.
 */

type TabKey = string;

interface Props {
  onNavigateTab?: (tab: TabKey) => void;
  activeTab?: TabKey;
}

type GroupKey = "operations" | "reporting" | "audit" | "planning";

interface SurfaceEntry {
  tab: TabKey;
  label: string;
  description: string;
  group: GroupKey;
  primary: boolean;
}

// Hand-curated registry mirroring the current AdminDashboard tabs.
// Order within each group is intentional (most used first).
const SURFACES: SurfaceEntry[] = [
  // Operations
  { tab: "launch", label: "Launch Control", description: "Pilot ops command surface for the current day.", group: "operations", primary: true },
  { tab: "command", label: "Command Center", description: "KPIs, market feed, and one-contractor summary.", group: "operations", primary: true },
  { tab: "pipeline", label: "Active Pipeline", description: "Working list of live leads with filters.", group: "operations", primary: true },
  { tab: "routing", label: "Routing Desk", description: "Decide and confirm contractor routing.", group: "operations", primary: true },
  { tab: "ghosts", label: "Ghost Recovery", description: "Stale-but-recoverable leads worth one more touch.", group: "operations", primary: true },
  { tab: "needs-review", label: "Needs Review", description: "Leads missing analyses or with invalid documents.", group: "operations", primary: true },
  { tab: "engine", label: "Dialer Desk", description: "Internal CRM desk for manual outreach.", group: "operations", primary: false },
  { tab: "contractors", label: "Contractors", description: "Contractor accounts, credits, and health.", group: "operations", primary: false },

  // Reporting
  { tab: "reporting", label: "Reporting", description: "Internal operator reporting and exports.", group: "reporting", primary: true },
  { tab: "report-prep", label: "Report Prep", description: "Externally-shareable contractor-safe view.", group: "reporting", primary: false },
  { tab: "outcomes", label: "Outcomes", description: "Close-loop outcomes per opportunity.", group: "reporting", primary: true },
  { tab: "feedback", label: "Feedback", description: "Contractor feedback loop on routed leads.", group: "reporting", primary: false },
  { tab: "attribution", label: "Attribution", description: "Source/UTM attribution for leads.", group: "reporting", primary: false },

  // Audit / Readiness
  { tab: "audit", label: "Pilot-to-Platform Audit", description: "Honest gap audit between pilot and platform.", group: "audit", primary: false },
  { tab: "readiness", label: "Health Check", description: "Launch-readiness and system health.", group: "audit", primary: true },
  { tab: "data-quality", label: "Data Quality", description: "Field integrity audit on lead snapshot.", group: "audit", primary: false },
  { tab: "exceptions", label: "Exceptions", description: "Manual escalation and edge-case review.", group: "audit", primary: false },
  { tab: "lifecycle", label: "Lifecycle", description: "Dead/stale/recovery workflow hardening.", group: "audit", primary: false },
  { tab: "shared-market", label: "Shared Market", description: "Manual controls for shared-market clarity.", group: "audit", primary: false },
  { tab: "governance", label: "Governance", description: "Decision boundaries: operator vs system vs not-yet.", group: "audit", primary: false },
  { tab: "consistency", label: "Consistency", description: "Cross-surface status alignment audit.", group: "audit", primary: false },
  { tab: "tech-debt", label: "Tech Debt", description: "Refactor readiness review across admin.", group: "audit", primary: false },
  { tab: "learnings", label: "Pilot Learnings", description: "What the pilot is teaching us.", group: "audit", primary: false },
  { tab: "change-mgmt", label: "Change Mgmt", description: "Safe-update readiness and protected boundaries.", group: "audit", primary: false },
  { tab: "pilot", label: "Pilot Readiness", description: "Overall pilot readiness summary.", group: "audit", primary: false },

  // Planning / Training
  { tab: "onboarding", label: "Onboarding", description: "Contractor onboarding workflow.", group: "planning", primary: false },
  { tab: "training", label: "Training / SOP", description: "Operator training and standard operating procedures.", group: "planning", primary: false },
  { tab: "rollout", label: "Rollout", description: "Rollout planning and execution readiness.", group: "planning", primary: false },
  { tab: "docs", label: "Docs / Handoff", description: "Documentation and handoff readiness.", group: "planning", primary: false },
  { tab: "drills", label: "Scenario Drills", description: "Manual simulation drills for edge cases.", group: "planning", primary: false },
  { tab: "expansion", label: "Expansion", description: "Preconditions for additional market entry.", group: "planning", primary: false },
];

const GROUP_META: Record<
  GroupKey,
  { label: string; description: string; icon: React.ReactNode; accent: Accent }
> = {
  operations: {
    label: "Core Daily Operations",
    description: "Surfaces you touch every day to handle live leads.",
    icon: <Activity className="h-4 w-4" />,
    accent: "emerald",
  },
  reporting: {
    label: "Reporting / Review",
    description: "Internal summaries and contractor-safe shareables.",
    icon: <ClipboardList className="h-4 w-4" />,
    accent: "sky",
  },
  audit: {
    label: "Audit / Readiness",
    description: "Periodic checks, integrity, and decision boundaries.",
    icon: <ShieldCheck className="h-4 w-4" />,
    accent: "amber",
  },
  planning: {
    label: "Training / Documentation / Planning",
    description: "Onboarding, SOPs, drills, rollout, and expansion prep.",
    icon: <GraduationCap className="h-4 w-4" />,
    accent: "sky",
  },
};

/* ───────────── Navigation friction + suggested paths ───────────── */

interface FrictionItem {
  title: string;
  detail: string;
  why: string;
}

const NAV_FRICTION: FrictionItem[] = [
  {
    title: "Tab strip is long and wraps",
    detail: "30+ tabs render as a wrapping strip; targets are easy to miss.",
    why: "Use this Surface Map as the primary jump hub between unrelated areas.",
  },
  {
    title: "Audit/readiness surfaces blend together",
    detail: "Audit, Health Check, Data Quality, Consistency, Tech Debt look similar in the strip.",
    why: "Group them mentally as 'periodic review' and reach them from the Audit / Readiness section below.",
  },
  {
    title: "Reporting vs Report Prep is easy to confuse",
    detail: "Two reporting surfaces serve different audiences (internal vs external).",
    why: "Reporting = ops view. Report Prep = shareable view. Treat them as a pair, not duplicates.",
  },
  {
    title: "Outcomes and Feedback both close the loop",
    detail: "Different signals (deal outcomes vs contractor feedback) feed the same review cycle.",
    why: "After routing, walk Outcomes → Feedback in order to keep mental ordering stable.",
  },
];

interface SuggestedPath {
  title: string;
  description: string;
  steps: { label: string; tab: TabKey }[];
}

const SUGGESTED_PATHS: SuggestedPath[] = [
  {
    title: "Start of day",
    description: "Quickly orient on what changed and what needs attention.",
    steps: [
      { label: "Launch Control", tab: "launch" },
      { label: "Command Center", tab: "command" },
      { label: "Needs Review", tab: "needs-review" },
      { label: "Active Pipeline", tab: "pipeline" },
    ],
  },
  {
    title: "Routing pass",
    description: "Move qualified leads to a contractor and confirm release.",
    steps: [
      { label: "Active Pipeline", tab: "pipeline" },
      { label: "Routing Desk", tab: "routing" },
      { label: "Contractors", tab: "contractors" },
    ],
  },
  {
    title: "Recovery sweep",
    description: "Decide on stale leads before they go cold.",
    steps: [
      { label: "Ghost Recovery", tab: "ghosts" },
      { label: "Lifecycle", tab: "lifecycle" },
      { label: "Exceptions", tab: "exceptions" },
    ],
  },
  {
    title: "End of day reporting",
    description: "Summarize, capture outcomes, and prep anything shareable.",
    steps: [
      { label: "Outcomes", tab: "outcomes" },
      { label: "Feedback", tab: "feedback" },
      { label: "Reporting", tab: "reporting" },
      { label: "Report Prep", tab: "report-prep" },
    ],
  },
  {
    title: "Periodic readiness review",
    description: "Run when planning a change or onboarding someone new.",
    steps: [
      { label: "Health Check", tab: "readiness" },
      { label: "Data Quality", tab: "data-quality" },
      { label: "Consistency", tab: "consistency" },
      { label: "Audit", tab: "audit" },
      { label: "Change Mgmt", tab: "change-mgmt" },
    ],
  },
];

/* ───────────── Component ───────────── */

const SECTION_KEYS = ["operations", "reporting", "audit", "planning", "friction", "paths"] as const;
type SectionKey = (typeof SECTION_KEYS)[number];

export function AdminInformationArchitectureNavigationSimplificationSurface({
  onNavigateTab,
  activeTab,
}: Props) {
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    operations: true,
    reporting: true,
    audit: true,
    planning: true,
    friction: false,
    paths: true,
  });
  const [query, setQuery] = useState("");

  const toggle = (key: SectionKey) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const normalizedQuery = query.trim().toLowerCase();
  const filteredSurfaces = useMemo(() => {
    if (!normalizedQuery) return SURFACES;
    return SURFACES.filter(
      (s) =>
        s.label.toLowerCase().includes(normalizedQuery) ||
        s.description.toLowerCase().includes(normalizedQuery) ||
        s.tab.toLowerCase().includes(normalizedQuery),
    );
  }, [normalizedQuery]);

  const grouped = useMemo(() => {
    const buckets: Record<GroupKey, SurfaceEntry[]> = {
      operations: [],
      reporting: [],
      audit: [],
      planning: [],
    };
    filteredSurfaces.forEach((s) => buckets[s.group].push(s));
    return buckets;
  }, [filteredSurfaces]);

  const totalShown = filteredSurfaces.length;

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-primary/10 p-2 text-primary">
                <MapIcon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">
                  Admin Information Architecture / Navigation
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                  A jump hub for the growing admin. Surfaces are grouped by purpose:
                  daily operations, reporting, audit/readiness, and training/planning.
                  No router changes — every entry just opens the existing tab.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Read-only</Badge>
              <Badge variant="outline">{SURFACES.length} surfaces</Badge>
            </div>
          </div>

          {/* Search */}
          <div className="mt-4 flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search surfaces…"
                className="pl-8"
              />
            </div>
            {normalizedQuery && (
              <span className="text-xs text-muted-foreground">
                {totalShown} match{totalShown === 1 ? "" : "es"}
              </span>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* ── Groups ──────────────────────────────────────────────── */}
      {(["operations", "reporting", "audit", "planning"] as GroupKey[]).map((group) => {
        const meta = GROUP_META[group];
        const items = grouped[group];
        return (
          <SectionCard
            key={group}
            icon={meta.icon}
            title={meta.label}
            description={meta.description}
            open={openSections[group]}
            onToggle={() => toggle(group)}
            accent={meta.accent}
            count={items.length}
          >
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No surfaces match this filter.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((s) => (
                  <SurfaceCard
                    key={s.tab}
                    surface={s}
                    active={activeTab === s.tab}
                    onNavigateTab={onNavigateTab}
                  />
                ))}
              </div>
            )}
          </SectionCard>
        );
      })}

      {/* ── Suggested paths ─────────────────────────────────────── */}
      <SectionCard
        icon={<Compass className="h-4 w-4" />}
        title="Suggested Navigation Paths"
        description="Common operator routines, expressed as step-by-step jumps between surfaces."
        open={openSections.paths}
        onToggle={() => toggle("paths")}
        accent="sky"
      >
        <div className="space-y-3">
          {SUGGESTED_PATHS.map((path) => (
            <div
              key={path.title}
              className="rounded-md border border-border/60 bg-card/40 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-foreground">{path.title}</div>
                  <p className="text-sm text-muted-foreground mt-1">{path.description}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {path.steps.map((step, idx) => (
                  <span key={`${path.title}-${step.tab}`} className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 px-2"
                      onClick={() => onNavigateTab?.(step.tab)}
                      disabled={!onNavigateTab}
                    >
                      {step.label}
                      <ExternalLink className="h-3 w-3 opacity-60" />
                    </Button>
                    {idx < path.steps.length - 1 && (
                      <span className="text-muted-foreground/60 text-xs">→</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── Friction ────────────────────────────────────────────── */}
      <SectionCard
        icon={<AlertTriangle className="h-4 w-4" />}
        title="Current Navigation Friction"
        description="Honest notes on where the admin is hard to scan today, and how to work around it."
        open={openSections.friction}
        onToggle={() => toggle("friction")}
        accent="amber"
      >
        <ul className="space-y-3">
          {NAV_FRICTION.map((f) => (
            <li key={f.title} className="rounded-md border border-border/60 bg-card/40 p-3">
              <div className="text-sm font-medium text-foreground">{f.title}</div>
              <p className="text-sm text-muted-foreground mt-1">{f.detail}</p>
              <p className="text-xs text-muted-foreground/80 mt-1.5">
                <span className="font-medium text-foreground/70">Workaround: </span>
                {f.why}
              </p>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}

/* ───────────────────── helpers ───────────────────── */

type Accent = "emerald" | "amber" | "rose" | "sky";

const ACCENT_RING: Record<Accent, string> = {
  emerald: "border-l-4 border-l-emerald-500/60",
  amber: "border-l-4 border-l-amber-500/60",
  rose: "border-l-4 border-l-rose-500/60",
  sky: "border-l-4 border-l-sky-500/60",
};

function SectionCard({
  icon,
  title,
  description,
  open,
  onToggle,
  accent,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  open: boolean;
  onToggle: () => void;
  accent: Accent;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <Card className={ACCENT_RING[accent]}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-muted p-2 text-foreground/70">{icon}</div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{title}</CardTitle>
                {typeof count === "number" && (
                  <Badge variant="secondary" className="text-[10px]">
                    {count}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{description}</p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={onToggle} className="gap-1.5">
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {open ? "Collapse" : "Expand"}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent>
          <Separator className="mb-4" />
          {children}
        </CardContent>
      )}
    </Card>
  );
}

function SurfaceCard({
  surface,
  active,
  onNavigateTab,
}: {
  surface: SurfaceEntry;
  active?: boolean;
  onNavigateTab?: (tab: TabKey) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onNavigateTab?.(surface.tab)}
      disabled={!onNavigateTab}
      className={`group text-left rounded-md border bg-card/40 p-3 transition-colors hover:bg-card/70 hover:border-primary/40 disabled:opacity-60 ${
        active ? "border-primary/60 ring-1 ring-primary/30" : "border-border/60"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-foreground truncate">
              {surface.label}
            </span>
            {surface.primary && (
              <Star
                className="h-3 w-3 text-primary shrink-0 fill-current"
                aria-label="Core surface"
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {surface.description}
          </p>
        </div>
        <ExternalLink className="h-3.5 w-3.5 opacity-50 shrink-0 group-hover:opacity-90" />
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <Badge variant="outline" className="text-[10px]">
          {surface.primary ? "Core" : "Supporting"}
        </Badge>
        <Badge variant="secondary" className="text-[10px]">
          {surface.tab}
        </Badge>
      </div>
    </button>
  );
}
