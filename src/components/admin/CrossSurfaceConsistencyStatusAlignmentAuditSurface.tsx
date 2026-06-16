import { useMemo, useState } from "react";
import {
  GitCompare,
  Database,
  Eye,
  Layers,
  AlertTriangle,
  BookOpen,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  adminSurfaceLabelBadgeClass,
  getAdminSurfaceLabel,
} from "@/routes/adminDashboardTabs";

/**
 * Phase 32 — Cross-Surface Consistency / Status Alignment Audit
 *
 * INTERNAL READ-ONLY surface. No backend, no persistence, no automation.
 *
 * CLASSIFICATION LOGIC (deterministic, current-state only):
 *
 * - "Repo-Real" = concept directly backed by a column or set of columns
 *   on a canonical table (leads, contractor_opportunity_routes,
 *   contractor_outcomes, billable_intros, etc.).
 *
 * - "Operator-View" = concept assembled in the frontend by interpreting
 *   one or more raw fields (timestamps, flag counts, status strings).
 *   Honest for pilot — surfaces label these as derived.
 *
 * - "Surface-Specific" = a label used in one tab to make a list scannable
 *   for the operator. Useful locally, not globally canonical.
 *
 * - "Canonical (current)" = the best current reading of a concept based on
 *   what the repo actually stores plus how the admin UI interprets it.
 *   This is current-state guidance only, not enforced product doctrine.
 *
 * No state harmonization is performed. Categories are hand-curated from
 * the established Phase 6–31 admin surfaces.
 */

type TabKey = string;

interface Props {
  onNavigateTab?: (tab: TabKey) => void;
}

/* ───────────── Canonical concepts overview ───────────── */

interface CanonicalConcept {
  concept: string;
  canonicalReading: string;
  backedBy: string;
  kind: "Repo-Real" | "Operator-View" | "Mixed";
}

const CANONICAL_CONCEPTS: CanonicalConcept[] = [
  {
    concept: "Active",
    canonicalReading:
      "Lead has a recent touch and is not yet closed, dead, or fully released.",
    backedBy: "leads.status + leads.updated_at + absence of closed/dead markers",
    kind: "Mixed",
  },
  {
    concept: "Routed",
    canonicalReading:
      "An opportunity has a contractor_opportunity_routes row with route_status set and sent_at populated.",
    backedBy: "contractor_opportunity_routes.route_status, sent_at",
    kind: "Repo-Real",
  },
  {
    concept: "Viewed",
    canonicalReading: "Route has viewed_at populated by the contractor surface.",
    backedBy: "contractor_opportunity_routes.viewed_at",
    kind: "Repo-Real",
  },
  {
    concept: "Responded",
    canonicalReading: "Route has responded_at populated, with optional response_notes.",
    backedBy: "contractor_opportunity_routes.responded_at",
    kind: "Repo-Real",
  },
  {
    concept: "Interested",
    canonicalReading: "Route has interested_at populated.",
    backedBy: "contractor_opportunity_routes.interested_at",
    kind: "Repo-Real",
  },
  {
    concept: "Booked",
    canonicalReading: "Outcome row records appointment_booked_at.",
    backedBy: "contractor_outcomes.appointment_booked_at, leads.appointment_booked_at",
    kind: "Repo-Real",
  },
  {
    concept: "Closed",
    canonicalReading: "Outcome row has closed_at populated and a deal_status of closed_*.",
    backedBy: "contractor_outcomes.closed_at, deal_status; leads.closed_at",
    kind: "Repo-Real",
  },
  {
    concept: "Dead",
    canonicalReading:
      "Operator-judged terminal state for a lead with no realistic recovery path.",
    backedBy: "leads.status + operator judgment in Lifecycle surface",
    kind: "Operator-View",
  },
  {
    concept: "Stale",
    canonicalReading:
      "No qualifying activity for a recency window; not yet declared dead.",
    backedBy: "leads.updated_at + Lifecycle surface windowing",
    kind: "Operator-View",
  },
  {
    concept: "Unresolved",
    canonicalReading:
      "Lead or opportunity that needs operator attention before any further routing decision.",
    backedBy: "Needs Review + Exceptions composition",
    kind: "Operator-View",
  },
  {
    concept: "Recovery candidate",
    canonicalReading:
      "Stale-but-not-dead lead that the operator considers worth one more touch.",
    backedBy: "Lifecycle surface judgment",
    kind: "Operator-View",
  },
  {
    concept: "Released",
    canonicalReading:
      "Homeowner contact has been explicitly released to a contractor route.",
    backedBy:
      "contractor_opportunity_routes.contact_released, contact_released_at; opportunity.homeowner_contact_released_at",
    kind: "Repo-Real",
  },
  {
    concept: "Current owner",
    canonicalReading:
      "The contractor currently authorized on the active route or billable intro.",
    backedBy: "billable_intros.contractor_id, contractor_opportunity_routes.contractor_id",
    kind: "Repo-Real",
  },
  {
    concept: "Prior owner",
    canonicalReading:
      "Earlier contractor association implied by historical routes for the same opportunity.",
    backedBy: "contractor_opportunity_routes history (no dedicated field)",
    kind: "Operator-View",
  },
  {
    concept: "Contractor-safe reporting",
    canonicalReading:
      "Reporting view that excludes PII and internal-only fields, suitable to share externally.",
    backedBy: "Operator Reporting / Report Prep composition",
    kind: "Operator-View",
  },
];

/* ───────────── Surface alignment matrix ───────────── */

interface SurfaceAlignmentRow {
  concept: string;
  perSurface: { surface: string; tab: TabKey; label: string; note?: string }[];
}

const SURFACE_ALIGNMENT: SurfaceAlignmentRow[] = [
  {
    concept: "Active",
    perSurface: [
      { surface: "Active Pipeline", tab: "pipeline", label: "Active row in pipeline list" },
      { surface: "Routing Desk", tab: "routing", label: "Active opportunity awaiting routing" },
      { surface: "Lifecycle", tab: "lifecycle", label: "Not in stale/dead bucket", note: "Operator-view negation" },
      { surface: "Reporting", tab: "reporting", label: "Counted under active leads" },
    ],
  },
  {
    concept: "Routed",
    perSurface: [
      { surface: "Routing Desk", tab: "routing", label: "Has route row with sent_at" },
      { surface: "Active Pipeline", tab: "pipeline", label: "Status badge: routed" },
      { surface: "Outcomes", tab: "outcomes", label: "Eligible for outcome capture" },
      { surface: "Reporting", tab: "reporting", label: "Counted under routed total" },
    ],
  },
  {
    concept: "Stale",
    perSurface: [
      { surface: "Lifecycle", tab: "lifecycle", label: "Stale bucket (recency window)" },
      { surface: "Ghost Recovery", tab: "ghosts", label: "Surfaced as recovery candidate", note: "Surface-specific framing" },
      { surface: "Pipeline", tab: "pipeline", label: "Aging tag on row", note: "Surface-specific convenience" },
    ],
  },
  {
    concept: "Dead",
    perSurface: [
      { surface: "Lifecycle", tab: "lifecycle", label: "Closed-out with reason" },
      { surface: "Reporting", tab: "reporting", label: "Excluded from active counts" },
      { surface: "Exceptions", tab: "exceptions", label: "Eligible for archival review" },
    ],
  },
  {
    concept: "Released",
    perSurface: [
      { surface: "Routing Desk", tab: "routing", label: "Contact released flag on route" },
      { surface: "Lead Dossier", tab: "engine", label: "Release timestamp shown" },
      { surface: "Outcomes", tab: "outcomes", label: "Required precondition for outcome" },
      { surface: "Shared Market", tab: "shared-market", label: "Drives current-owner attribution" },
    ],
  },
  {
    concept: "Current owner",
    perSurface: [
      { surface: "Routing Desk", tab: "routing", label: "Assigned contractor on route" },
      { surface: "Contractors", tab: "contractors", label: "Account view of owned leads" },
      { surface: "Shared Market", tab: "shared-market", label: "Allocation visibility" },
      { surface: "Outcomes", tab: "outcomes", label: "Attributed contractor on outcome" },
    ],
  },
  {
    concept: "Contractor-safe reporting",
    perSurface: [
      { surface: "Reporting", tab: "reporting", label: "Internal export view" },
      { surface: "Report Prep", tab: "report-prep", label: "Externally-shareable view" },
      { surface: "Data Quality", tab: "data-quality", label: "Field integrity prerequisite" },
    ],
  },
];

/* ───────────── Surface-specific convenience labels ───────────── */

interface ConvenienceLabel {
  label: string;
  surface: string;
  tab: TabKey;
  meaning: string;
  warning: string;
}

const CONVENIENCE_LABELS: ConvenienceLabel[] = [
  {
    label: "Aging",
    surface: "Active Pipeline",
    tab: "pipeline",
    meaning: "Row is approaching stale window but not yet stale.",
    warning: "Local convenience — do not treat as canonical lifecycle state.",
  },
  {
    label: "Recovery candidate",
    surface: "Ghost Recovery",
    tab: "ghosts",
    meaning: "Stale lead the operator may want to touch one more time.",
    warning: "Operator-view framing; no dedicated repo column.",
  },
  {
    label: "Needs review",
    surface: "Needs Review",
    tab: "needs-review",
    meaning: "Composition of leads missing analyses + invalid documents.",
    warning: "Composed list; not a single repo-real status.",
  },
  {
    label: "Unresolved exception",
    surface: "Exceptions",
    tab: "exceptions",
    meaning: "Cases requiring manual escalation before normal flow.",
    warning: "Operator-view bucket; backed by mixed signals.",
  },
  {
    label: "Externally shareable",
    surface: "Report Prep",
    tab: "report-prep",
    meaning: "Filtered view safe to send outside the operator team.",
    warning: "Composed view; not a backend permission boundary.",
  },
];

/* ───────────── Drift risks ───────────── */

interface DriftRisk {
  title: string;
  detail: string;
  why: string;
  surface?: { label: string; tab: TabKey };
}

const DRIFT_RISKS: DriftRisk[] = [
  {
    title: "Stale window definition is per-surface",
    detail:
      "Lifecycle, Ghost Recovery, and Pipeline each interpret recency slightly differently.",
    why: "No shared selector. Numbers can disagree without anyone being wrong.",
    surface: { label: "Lifecycle", tab: "lifecycle" },
  },
  {
    title: "Active vs Routed used interchangeably",
    detail:
      "Some surfaces show 'active' totals that include routed leads; others separate them.",
    why: "Both are valid framings. Pick the one that matches the question being asked.",
    surface: { label: "Reporting", tab: "reporting" },
  },
  {
    title: "Released has two anchors",
    detail:
      "Both contractor_opportunity_routes.contact_released_at and opportunity.homeowner_contact_released_at exist.",
    why: "Route-level is the operational anchor; opportunity-level is summary. Prefer route-level for truth.",
    surface: { label: "Routing", tab: "routing" },
  },
  {
    title: "Prior-owner has no dedicated field",
    detail: "Inferred from route history; surfaces may show or omit it.",
    why: "Acceptable for one contractor; will need an explicit field before multi-owner becomes common.",
    surface: { label: "Shared Market", tab: "shared-market" },
  },
  {
    title: "Outcome 'closed' vs lifecycle 'dead'",
    detail:
      "Outcome closure is a deal status; lifecycle dead is an operator decision about the lead.",
    why: "Don't conflate. A lead can be lifecycle-dead without an outcome closed_*, and vice versa.",
    surface: { label: "Outcomes", tab: "outcomes" },
  },
];

/* ───────────── Canonical guidance ───────────── */

const CANONICAL_GUIDANCE: { title: string; detail: string }[] = [
  {
    title: "Prefer repo-real fields when answering 'is X true?'",
    detail:
      "If a question can be answered by a column (sent_at, viewed_at, contact_released_at, closed_at), use that column.",
  },
  {
    title: "Treat operator-view buckets as judgment, not state",
    detail:
      "Stale, dead, recovery candidate, unresolved are operator interpretations. Document the window or rule in the surface.",
  },
  {
    title: "Route-level beats opportunity-level for ownership truth",
    detail:
      "When in doubt about who currently owns a lead, read contractor_opportunity_routes (and billable_intros) before opportunity-level summary fields.",
  },
  {
    title: "Reporting and Report Prep answer different questions",
    detail:
      "Reporting is for internal operations. Report Prep is for shareability. They will not always show the same totals.",
  },
];

/* ───────────── Component ───────────── */

const SECTION_KEYS = [
  "canonical",
  "repoVsView",
  "alignment",
  "convenience",
  "drift",
  "guidance",
] as const;
type SectionKey = (typeof SECTION_KEYS)[number];

export function CrossSurfaceConsistencyStatusAlignmentAuditSurface({ onNavigateTab }: Props) {
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    canonical: true,
    repoVsView: true,
    alignment: true,
    convenience: false,
    drift: false,
    guidance: false,
  });
  const [copied, setCopied] = useState(false);

  const toggle = (key: SectionKey) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const repoReal = CANONICAL_CONCEPTS.filter((c) => c.kind === "Repo-Real");
  const operatorView = CANONICAL_CONCEPTS.filter((c) => c.kind === "Operator-View");
  const mixed = CANONICAL_CONCEPTS.filter((c) => c.kind === "Mixed");

  const snapshot = useMemo(() => {
    const lines: string[] = [];
    lines.push("# Cross-Surface Consistency / Status Alignment — current snapshot", "");

    lines.push("## Canonical concepts");
    CANONICAL_CONCEPTS.forEach((c) => {
      lines.push(`- ${c.concept} [${c.kind}]`);
      lines.push(`  reading: ${c.canonicalReading}`);
      lines.push(`  backed by: ${c.backedBy}`);
    });
    lines.push("");

    lines.push("## Surface alignment");
    SURFACE_ALIGNMENT.forEach((row) => {
      lines.push(`- ${row.concept}`);
      row.perSurface.forEach((s) => {
        lines.push(`  • ${s.surface}: ${s.label}${s.note ? ` (${s.note})` : ""}`);
      });
    });
    lines.push("");

    lines.push("## Surface-specific convenience labels");
    CONVENIENCE_LABELS.forEach((c) => {
      lines.push(`- ${c.label} (${c.surface}) — ${c.meaning}`);
      lines.push(`  warning: ${c.warning}`);
    });
    lines.push("");

    lines.push("## Drift risks");
    DRIFT_RISKS.forEach((d) => {
      lines.push(`- ${d.title} — ${d.detail}`);
      lines.push(`  why: ${d.why}`);
    });
    lines.push("");

    lines.push("## Canonical guidance");
    CANONICAL_GUIDANCE.forEach((g) => {
      lines.push(`- ${g.title} — ${g.detail}`);
    });

    return lines.join("\n");
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snapshot);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable — local-only convenience, no backend fallback */
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-primary/10 p-2 text-primary">
                <GitCompare className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">
                  Cross-Surface Consistency / Status Alignment Audit
                </CardTitle>
                <p className="text-sm text-slate-700 mt-1 max-w-2xl">
                  Compares how key lead and opportunity concepts are represented across
                  admin surfaces. Highlights repo-real vs operator-view labels and current
                  drift risks. Read-only, current-state only — no backend harmonization.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(() => {
                const label = getAdminSurfaceLabel("consistency");
                if (!label) return null;
                return (
                  <Badge
                    variant="outline"
                    className={`text-xs font-extrabold uppercase tracking-wide ${adminSurfaceLabelBadgeClass(label)}`}
                  >
                    {label}
                  </Badge>
                );
              })()}
              <Badge variant="outline">Current-state</Badge>
              <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1.5">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy snapshot"}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* ── Canonical concepts overview ─────────────────────── */}
      <SectionCard
        icon={<BookOpen className="h-4 w-4" />}
        title="Canonical Concepts Overview"
        description="The current best reading of each major concept, and whether it is backed by repo fields or operator interpretation."
        open={openSections.canonical}
        onToggle={() => toggle("canonical")}
        accent="sky"
      >
        <ul className="space-y-3">
          {CANONICAL_CONCEPTS.map((c) => (
            <li key={c.concept} className="rounded-md border border-border/60 bg-card/40 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{c.concept}</span>
                    <KindBadge kind={c.kind} />
                  </div>
                  <p className="text-sm text-slate-700 mt-1">{c.canonicalReading}</p>
                  <p className="text-xs text-slate-700/80 mt-1.5">
                    <span className="font-medium text-foreground/70">Backed by: </span>
                    <code className="text-sm">{c.backedBy}</code>
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>

      {/* ── Repo-Real vs Operator-View map ──────────────────── */}
      <SectionCard
        icon={<Database className="h-4 w-4" />}
        title="Repo-Real vs Operator-View Map"
        description="Quick split of which concepts are columns versus interpretations."
        open={openSections.repoVsView}
        onToggle={() => toggle("repoVsView")}
        accent="emerald"
      >
        <div className="grid gap-3 md:grid-cols-3">
          <ConceptColumn title="Repo-Real" concepts={repoReal} icon={<Database className="h-4 w-4" />} />
          <ConceptColumn title="Operator-View" concepts={operatorView} icon={<Eye className="h-4 w-4" />} />
          <ConceptColumn title="Mixed" concepts={mixed} icon={<Layers className="h-4 w-4" />} />
        </div>
      </SectionCard>

      {/* ── Surface-by-surface alignment ────────────────────── */}
      <SectionCard
        icon={<Layers className="h-4 w-4" />}
        title="Surface-by-Surface Status Alignment"
        description="How the same concept appears in each surface today."
        open={openSections.alignment}
        onToggle={() => toggle("alignment")}
        accent="sky"
      >
        <div className="space-y-4">
          {SURFACE_ALIGNMENT.map((row) => (
            <div key={row.concept} className="rounded-md border border-border/60 bg-card/40 p-3">
              <div className="text-sm font-medium text-foreground mb-2">{row.concept}</div>
              <ul className="space-y-1.5">
                {row.perSurface.map((s) => (
                  <li
                    key={`${row.concept}-${s.surface}`}
                    className="flex items-start justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <span className="text-slate-700">{s.surface}:</span>{" "}
                      <span className="text-foreground/90">{s.label}</span>
                      {s.note && (
                        <span className="text-xs text-slate-700/80 ml-1">
                          ({s.note})
                        </span>
                      )}
                    </div>
                    {onNavigateTab && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1 px-2 shrink-0"
                        onClick={() => onNavigateTab(s.tab)}
                      >
                        Open
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── Convenience labels ──────────────────────────────── */}
      <SectionCard
        icon={<Eye className="h-4 w-4" />}
        title="Surface-Specific Convenience Labels"
        description="Useful in one tab — not globally canonical. Don't propagate without thought."
        open={openSections.convenience}
        onToggle={() => toggle("convenience")}
        accent="amber"
      >
        <ul className="space-y-3">
          {CONVENIENCE_LABELS.map((c) => (
            <li
              key={`${c.surface}-${c.label}`}
              className="rounded-md border border-border/60 bg-card/40 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{c.label}</span>
                    <Badge variant="secondary" className="text-sm">
                      {c.surface}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-700 mt-1">{c.meaning}</p>
                  <p className="text-xs text-slate-700/80 mt-1.5">
                    <span className="font-medium text-foreground/70">Watch out: </span>
                    {c.warning}
                  </p>
                </div>
                {onNavigateTab && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1.5"
                    onClick={() => onNavigateTab(c.tab)}
                  >
                    {c.surface}
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>

      {/* ── Drift risks ─────────────────────────────────────── */}
      <SectionCard
        icon={<AlertTriangle className="h-4 w-4" />}
        title="Current Inconsistencies / Drift Risks"
        description="Places where two surfaces can disagree without anyone being wrong."
        open={openSections.drift}
        onToggle={() => toggle("drift")}
        accent="amber"
      >
        <ul className="space-y-3">
          {DRIFT_RISKS.map((d) => (
            <li key={d.title} className="rounded-md border border-border/60 bg-card/40 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">{d.title}</div>
                  <p className="text-sm text-slate-700 mt-1">{d.detail}</p>
                  <p className="text-xs text-slate-700/80 mt-1.5">
                    <span className="font-medium text-foreground/70">Why: </span>
                    {d.why}
                  </p>
                </div>
                {d.surface && onNavigateTab && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1.5"
                    onClick={() => onNavigateTab(d.surface!.tab)}
                  >
                    {d.surface.label}
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>

      {/* ── Canonical guidance ──────────────────────────────── */}
      <SectionCard
        icon={<BookOpen className="h-4 w-4" />}
        title="Current Canonical Guidance"
        description="When two surfaces disagree, prefer these readings."
        open={openSections.guidance}
        onToggle={() => toggle("guidance")}
        accent="emerald"
      >
        <ul className="space-y-3">
          {CANONICAL_GUIDANCE.map((g) => (
            <li key={g.title} className="rounded-md border border-border/60 bg-card/40 p-3">
              <div className="text-sm font-medium text-foreground">{g.title}</div>
              <p className="text-sm text-slate-700 mt-1">{g.detail}</p>
            </li>
          ))}
        </ul>
      </SectionCard>

      {/* ── Quick links ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            Aligned surfaces
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <QuickLink label="Routing Desk" tab="routing" onNavigateTab={onNavigateTab} />
            <QuickLink label="Active Pipeline" tab="pipeline" onNavigateTab={onNavigateTab} />
            <QuickLink label="Lifecycle" tab="lifecycle" onNavigateTab={onNavigateTab} />
            <QuickLink label="Outcomes" tab="outcomes" onNavigateTab={onNavigateTab} />
            <QuickLink label="Reporting" tab="reporting" onNavigateTab={onNavigateTab} />
            <QuickLink label="Report Prep" tab="report-prep" onNavigateTab={onNavigateTab} />
            <QuickLink label="Shared Market" tab="shared-market" onNavigateTab={onNavigateTab} />
            <QuickLink label="Data Quality" tab="data-quality" onNavigateTab={onNavigateTab} />
            <QuickLink label="Exceptions" tab="exceptions" onNavigateTab={onNavigateTab} />
          </div>
        </CardContent>
      </Card>
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
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  open: boolean;
  onToggle: () => void;
  accent: Accent;
  children: React.ReactNode;
}) {
  return (
    <Card className={ACCENT_RING[accent]}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-muted p-2 text-foreground/70">{icon}</div>
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <p className="text-sm text-slate-700 mt-1 max-w-2xl">{description}</p>
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

function KindBadge({ kind }: { kind: CanonicalConcept["kind"] }) {
  const styles =
    kind === "Repo-Real"
      ? "border-emerald-500/40 text-emerald-950"
      : kind === "Operator-View"
        ? "border-amber-500/40 text-amber-950"
        : "border-sky-500/40 text-sky-950";
  return (
    <Badge variant="outline" className={`text-sm ${styles}`}>
      {kind}
    </Badge>
  );
}

function ConceptColumn({
  title,
  concepts,
  icon,
}: {
  title: string;
  concepts: CanonicalConcept[];
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-card/40 p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-foreground/70">{icon}</span>
        <span className="text-sm font-medium text-foreground">{title}</span>
        <Badge variant="secondary" className="text-sm ml-auto">
          {concepts.length}
        </Badge>
      </div>
      <ul className="space-y-1.5">
        {concepts.map((c) => (
          <li key={c.concept} className="text-sm text-slate-700">
            • <span className="text-foreground/90">{c.concept}</span>
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
  tab: TabKey;
  onNavigateTab?: (tab: TabKey) => void;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="justify-between"
      onClick={() => onNavigateTab?.(tab)}
      disabled={!onNavigateTab}
    >
      <span>{label}</span>
      <ExternalLink className="h-3.5 w-3.5 opacity-100" />
    </Button>
  );
}
