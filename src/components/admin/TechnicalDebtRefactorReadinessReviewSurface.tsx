import { useMemo, useState } from "react";
import {
  Wrench,
  ShieldCheck,
  Layers,
  Eye,
  Lock,
  AlertTriangle,
  Sparkles,
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

/**
 * Phase 31 — Technical Debt / Refactor Readiness Review
 *
 * INTERNAL READ-ONLY surface. No backend, no persistence, no automation.
 *
 * CLASSIFICATION LOGIC (deterministic, current-state only):
 *
 * - "Stable" = surface or pattern that is structurally self-contained,
 *   reads from a single canonical source, and is not heavily wrapped in
 *   operator-derived classification logic. Safe to leave alone for pilot.
 *
 * - "Layered / Cleanup-Candidate" = surface that composes multiple
 *   operator-view derivations on top of the same base data (e.g. leads),
 *   or duplicates classification logic that lives elsewhere. Still valid
 *   for pilot use — flagged as a future cleanup target.
 *
 * - "Operator-Derived Heavy" = surface whose meaning is mostly produced
 *   in the frontend by interpreting raw fields (status, timestamps, flag
 *   counts) into operator-friendly buckets. Honest for pilot, but should
 *   eventually move closer to the data model.
 *
 * - "Protected / No-Touch" = subsystems explicitly fenced off by the
 *   project guardrails (OTP, scanner funnel, preview/full gating,
 *   tracking, public funnel). Never refactored opportunistically.
 *
 * No code analysis is performed. Categories are hand-curated from
 * repo-real structure and the established Phase 6–30 admin surfaces.
 */

type TabKey = string;

interface Props {
  onNavigateTab?: (tab: TabKey) => void;
}

interface Item {
  title: string;
  detail: string;
  why: string;
  surface?: { label: string; tab: TabKey };
}

// ── Stable / Leave-Alone ─────────────────────────────────────────────
const STABLE_AREAS: Item[] = [
  {
    title: "Deterministic scoring engine",
    detail:
      "Backend TypeScript scoring (grade + 5 pillars) is isolated from extraction and from UI.",
    why: "Single source of truth, fenced off from AI output. No operator-view logic on top.",
  },
  {
    title: "Lead snapshot table (canonical leads row)",
    detail:
      "leads is the canonical homeowner record. Most admin surfaces read from the same shape.",
    why: "Clear contract. Refactoring against it is low risk because there is no parallel store.",
  },
  {
    title: "Active Pipeline / Ghost Recovery filtering",
    detail: "Sub-component-isolated filter state, derived counts from the same lead list.",
    why: "Filter logic stays inside each tab; no shared mutable state across surfaces.",
    surface: { label: "Active Pipeline", tab: "pipeline" },
  },
  {
    title: "Partner Dossier display state model",
    detail: "Locked / unlocked / preview_locked is a single canonical display enum.",
    why: "UI states are derived from one model rather than scattered booleans.",
  },
];

// ── Layered / Cleanup-Candidate ──────────────────────────────────────
const LAYERED_AREAS: Item[] = [
  {
    title: "Phase 9+ admin readiness surfaces",
    detail:
      "Audit, Health Check, Training, Rollout, Data Quality, Docs/Handoff, Learnings, Change Mgmt, Governance, Drills, Expansion all share a similar shell pattern.",
    why: "Pattern is repeated component-by-component. A shared 'ReadinessSurface' primitive could collapse this without changing behavior.",
    surface: { label: "Pilot-to-Platform Audit", tab: "audit" },
  },
  {
    title: "Lead-derived counts across surfaces",
    detail:
      "Multiple surfaces recompute 'verified', 'routed', 'closed', 'stale' from leads inline.",
    why: "Same derivation logic is restated in several files. A shared selector would reduce drift.",
    surface: { label: "Data Quality", tab: "data-quality" },
  },
  {
    title: "AdminDashboard tab list",
    detail: "Tab triggers and tab contents are hand-wired one by one inside AdminDashboard.tsx.",
    why: "Adding a tab touches two places. A small registry would centralize it.",
  },
  {
    title: "Copy-snapshot utility duplicated per surface",
    detail:
      "Several Phase 9+ surfaces implement their own clipboard snapshot button and toast.",
    why: "Identical pattern restated. A small shared hook would remove the duplication.",
    surface: { label: "Change Mgmt", tab: "change-mgmt" },
  },
];

// ── Operator-Derived Heavy ───────────────────────────────────────────
const OPERATOR_DERIVED_AREAS: Item[] = [
  {
    title: "Lifecycle bucketing (stale / dead / recovery)",
    detail:
      "Bucket assignment is computed in the frontend from timestamps and status fields.",
    why: "There is no encoded lifecycle policy in the data model yet — operator view defines the meaning.",
    surface: { label: "Lifecycle", tab: "lifecycle" },
  },
  {
    title: "Shared-market allocation labels",
    detail:
      "Shared-market view labels are derived from observed county/contractor signals, not enforced territory.",
    why: "Honest for pilot; will need a real allocation model before scaling beyond one contractor.",
    surface: { label: "Shared Market", tab: "shared-market" },
  },
  {
    title: "Outcome / feedback completeness flags",
    detail:
      "Whether an outcome is 'complete enough' is judged in the UI from partial fields.",
    why: "Acceptable for pilot. Future product logic should encode required outcome fields directly.",
    surface: { label: "Outcomes", tab: "outcomes" },
  },
  {
    title: "Governance / decision-boundary labels",
    detail:
      "Operator vs system vs not-yet-automated classifications live as constants in the UI.",
    why: "Intentionally frontend-only today. A future policy layer would own this instead.",
    surface: { label: "Governance", tab: "governance" },
  },
];

// ── Protected / No-Touch ─────────────────────────────────────────────
const PROTECTED_AREAS: Item[] = [
  {
    title: "send-otp / verify-otp edge functions",
    detail: "Twilio Verify pipeline. Backend-only. Never refactored opportunistically.",
    why: "Project guardrail. Any change requires a deliberate, full-architecture plan.",
  },
  {
    title: "Scanner funnel + scan-quote pipeline",
    detail: "quote_files → scan_sessions → scan-quote → analyses is the canonical scan path.",
    why: "Touching this risks the preview/full boundary and the deterministic scoring contract.",
  },
  {
    title: "Preview vs full report gating",
    detail: "full_json must never be preloaded or revealed before backend authorization.",
    why: "Core moat. CSS hiding is never a substitute for backend enforcement.",
  },
  {
    title: "Tracking architecture (dataLayer + CAPI)",
    detail: "Two-lane model: dataLayer/GTM for business events, event_logs for telemetry.",
    why: "Cross-cutting and silently load-bearing. Refactor only with a dedicated plan.",
  },
];

// ── Current Refactor Risks ───────────────────────────────────────────
const REFACTOR_RISKS: Item[] = [
  {
    title: "Drift between operator-view buckets and future product logic",
    detail:
      "Frontend-derived classifications could quietly diverge from backend rules once those exist.",
    why: "Mitigate by keeping classification constants in one place and documenting them.",
  },
  {
    title: "Hidden coupling through shared lead shape",
    detail:
      "Many surfaces depend on the same lead fields. Renaming or removing a field has wide blast radius.",
    why: "Mitigate by treating leads field names as a contract; check Data Quality before removing any.",
    surface: { label: "Data Quality", tab: "data-quality" },
  },
  {
    title: "Over-eager extraction of shared admin shell",
    detail:
      "Collapsing all Phase 9+ surfaces too aggressively could hide per-surface nuance.",
    why: "Prefer extracting one or two clear primitives first, not a universal abstraction.",
  },
];

// ── Future Cleanup Candidates ────────────────────────────────────────
const FUTURE_CLEANUP: Item[] = [
  {
    title: "Shared 'ReadinessSurface' primitive",
    detail:
      "Header + sectioned cards + copy-snapshot + quick links is repeated across 10+ surfaces.",
    why: "Lowest-risk refactor target. Pure presentational consolidation.",
  },
  {
    title: "Shared lead selectors hook",
    detail:
      "Centralize 'verifiedLeads', 'routedLeads', 'staleLeads', 'observedCounties' derivations.",
    why: "Removes duplicated logic, single place to evolve definitions.",
  },
  {
    title: "AdminDashboard tab registry",
    detail: "Replace hand-wired triggers/contents with a typed registry of tab descriptors.",
    why: "Adding a tab becomes one entry instead of two synchronized edits.",
  },
  {
    title: "Operator-view classification constants module",
    detail:
      "Move lifecycle / governance / debt classification constants into a single read-only module.",
    why: "Makes future policy migration mechanical rather than archaeological.",
  },
];

const ALL_SECTION_KEYS = [
  "stable",
  "layered",
  "operator",
  "protected",
  "risks",
  "future",
] as const;
type SectionKey = (typeof ALL_SECTION_KEYS)[number];

export function TechnicalDebtRefactorReadinessReviewSurface({ onNavigateTab }: Props) {
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    stable: true,
    layered: true,
    operator: true,
    protected: true,
    risks: false,
    future: false,
  });
  const [copied, setCopied] = useState(false);

  const toggle = (key: SectionKey) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const snapshot = useMemo(() => {
    const block = (label: string, items: Item[]) =>
      `## ${label}\n` +
      items.map((i) => `- ${i.title} — ${i.detail}\n  why: ${i.why}`).join("\n");

    return [
      "# Technical Debt / Refactor Readiness — current-state snapshot",
      "",
      block("Stable / leave-alone", STABLE_AREAS),
      "",
      block("Layered / cleanup-candidate", LAYERED_AREAS),
      "",
      block("Operator-derived heavy", OPERATOR_DERIVED_AREAS),
      "",
      block("Protected / no-touch", PROTECTED_AREAS),
      "",
      block("Current refactor risks", REFACTOR_RISKS),
      "",
      block("Future cleanup candidates", FUTURE_CLEANUP),
    ].join("\n");
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
      {/* ── Header ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-primary/10 p-2 text-primary">
                <Wrench className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">
                  Technical Debt / Refactor Readiness Review
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                  Internal review of which current surfaces are structurally stable,
                  which are layered on operator-view derivations, and which areas should
                  stay untouched. Read-only, current-state only — no engineering backend.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Read-only</Badge>
              <Badge variant="outline">Current-state</Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopy}
                className="gap-1.5"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy snapshot"}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* ── Stable ──────────────────────────────────────────────── */}
      <SectionCard
        icon={<ShieldCheck className="h-4 w-4" />}
        title="Stable / Leave-Alone"
        description="Areas that are structurally clean enough for continued pilot use. Refactoring here would mostly be cosmetic."
        open={openSections.stable}
        onToggle={() => toggle("stable")}
        accent="emerald"
      >
        <ItemList items={STABLE_AREAS} onNavigateTab={onNavigateTab} />
      </SectionCard>

      {/* ── Layered ─────────────────────────────────────────────── */}
      <SectionCard
        icon={<Layers className="h-4 w-4" />}
        title="Layered / Cleanup-Candidate"
        description="Surfaces that work today but compose repeated patterns or duplicated derivations. Future cleanup targets."
        open={openSections.layered}
        onToggle={() => toggle("layered")}
        accent="amber"
      >
        <ItemList items={LAYERED_AREAS} onNavigateTab={onNavigateTab} />
      </SectionCard>

      {/* ── Operator-Derived Heavy ──────────────────────────────── */}
      <SectionCard
        icon={<Eye className="h-4 w-4" />}
        title="Operator-Derived Heavy"
        description="Areas whose meaning is mostly produced in the UI from raw fields. Honest for pilot — should eventually move closer to the data model."
        open={openSections.operator}
        onToggle={() => toggle("operator")}
        accent="amber"
      >
        <ItemList items={OPERATOR_DERIVED_AREAS} onNavigateTab={onNavigateTab} />
      </SectionCard>

      {/* ── Protected ───────────────────────────────────────────── */}
      <SectionCard
        icon={<Lock className="h-4 w-4" />}
        title="Protected / No-Touch Areas"
        description="Subsystems fenced off by project guardrails. Not refactor candidates without a deliberate, full-architecture plan."
        open={openSections.protected}
        onToggle={() => toggle("protected")}
        accent="rose"
      >
        <ItemList items={PROTECTED_AREAS} onNavigateTab={onNavigateTab} />
      </SectionCard>

      {/* ── Refactor Risks ──────────────────────────────────────── */}
      <SectionCard
        icon={<AlertTriangle className="h-4 w-4" />}
        title="Current Refactor Risks"
        description="Risks to keep in mind before pulling on any of the above threads."
        open={openSections.risks}
        onToggle={() => toggle("risks")}
        accent="amber"
      >
        <ItemList items={REFACTOR_RISKS} onNavigateTab={onNavigateTab} />
      </SectionCard>

      {/* ── Future Cleanup ──────────────────────────────────────── */}
      <SectionCard
        icon={<Sparkles className="h-4 w-4" />}
        title="Future Cleanup Candidates"
        description="Conceptual cleanup targets — not execution-ready, intentionally not started in this phase."
        open={openSections.future}
        onToggle={() => toggle("future")}
        accent="sky"
      >
        <ItemList items={FUTURE_CLEANUP} onNavigateTab={onNavigateTab} />
      </SectionCard>

      {/* ── Quick Links ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            Supporting surfaces
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <QuickLink label="Pilot-to-Platform Audit" tab="audit" onNavigateTab={onNavigateTab} />
            <QuickLink label="Change Management" tab="change-mgmt" onNavigateTab={onNavigateTab} />
            <QuickLink label="Docs / Handoff" tab="docs" onNavigateTab={onNavigateTab} />
            <QuickLink label="Data Quality" tab="data-quality" onNavigateTab={onNavigateTab} />
            <QuickLink label="Governance" tab="governance" onNavigateTab={onNavigateTab} />
            <QuickLink label="Pilot Learnings" tab="learnings" onNavigateTab={onNavigateTab} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────────────────────── helpers ───────────────────────── */

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

function ItemList({
  items,
  onNavigateTab,
}: {
  items: Item[];
  onNavigateTab?: (tab: TabKey) => void;
}) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.title} className="rounded-md border border-border/60 bg-card/40 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">{item.title}</div>
              <p className="text-sm text-muted-foreground mt-1">{item.detail}</p>
              <p className="text-xs text-muted-foreground/80 mt-1.5">
                <span className="font-medium text-foreground/70">Why: </span>
                {item.why}
              </p>
            </div>
            {item.surface && onNavigateTab && (
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 gap-1.5"
                onClick={() => onNavigateTab(item.surface!.tab)}
              >
                {item.surface.label}
                <ExternalLink className="h-3 w-3" />
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
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
      <ExternalLink className="h-3.5 w-3.5 opacity-60" />
    </Button>
  );
}
