import { useMemo, useState } from "react";
import {
  Target,
  Flame,
  Pause,
  Ban,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Copy,
  Check,
  Compass,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

/**
 * Phase 34 — Strategic Prioritization / Next-Build Decision Framework
 *
 * INTERNAL READ-ONLY surface. No backend, no persistence, no scoring engine.
 *
 * CLASSIFICATION LOGIC (deterministic, current-state only):
 *
 * - "High Leverage"   = candidates that, based on current repo truth and
 *   current operator pain, would materially improve daily operations,
 *   readiness, or scale prep WITHOUT touching protected systems.
 *
 * - "Deferred"        = real, valuable areas that would be premature now
 *   (still useful later — not bad forever).
 *
 * - "Out of Scope"    = areas intentionally excluded from the current
 *   planning horizon (portal-grade, billing depth, deep automation,
 *   territory/fairness systems, etc).
 *
 * - "Constraint"      = a current structural reality that should drive
 *   sequencing (pilot scale, single-contractor reality, manual pipeline,
 *   protected systems, operator-derived layering).
 *
 * - "Pre-Condition"   = a thing that must be true BEFORE a candidate
 *   build is worth attempting.
 *
 * Nothing here is dynamic. Lists are hand-curated from current repo
 * surfaces (Phases 6–33) and current operator pain points.
 */

type TabKey = string;

interface Props {
  onNavigateTab?: (tab: TabKey) => void;
}

/* ───────────── Data ───────────── */

interface NextBuild {
  title: string;
  why: string;
  signal: string;
  preconditions: string[];
  relatedTabs?: TabKey[];
}

const HIGH_LEVERAGE: NextBuild[] = [
  {
    title: "Tighten outcome capture loop",
    why: "Outcomes drive learning, but capture is still manual and easy to skip. Better defaults would compound across every later decision.",
    signal: "Outcomes + Feedback surfaces exist but rely on operator discipline.",
    preconditions: ["Routing Desk stable", "Outcome fields agreed"],
    relatedTabs: ["outcomes", "feedback"],
  },
  {
    title: "Promote a few operator-derived labels to repo-real fields",
    why: "Several admin labels are computed in the UI (stale, dead, recovery candidate). Lifting one or two into repo-real state would cut drift across surfaces.",
    signal: "Consistency audit shows multiple operator-view labels in heavy use.",
    preconditions: ["Consistency audit reviewed", "Pick one canonical concept first"],
    relatedTabs: ["consistency", "tech-debt", "lifecycle"],
  },
  {
    title: "Reduce Needs-Review friction",
    why: "Needs Review is the daily bottleneck for unblocking leads. Small UX upgrades here have outsized leverage on throughput.",
    signal: "Needs Review badge regularly non-zero in normal pilot flow.",
    preconditions: ["Data Quality audit reviewed"],
    relatedTabs: ["needs-review", "data-quality"],
  },
  {
    title: "Make Reporting → Report Prep a one-click handoff",
    why: "Today the operator manually reconciles internal reporting with the contractor-safe view. A clean bridge would cut weekly cycle time.",
    signal: "Two reporting surfaces exist with overlapping but diverged copy.",
    preconditions: ["Consistency audit reviewed", "Report Prep field set frozen"],
    relatedTabs: ["reporting", "report-prep"],
  },
];

const PAIN_POINTS: { title: string; detail: string; relatedTabs?: TabKey[] }[] = [
  {
    title: "Manual escalation has no single inbox",
    detail: "Exceptions exist as a surface but escalations still rely on operator memory.",
    relatedTabs: ["exceptions"],
  },
  {
    title: "Stale-vs-dead boundary is fuzzy",
    detail: "Lifecycle classifies, but two surfaces sometimes show the same lead in different buckets.",
    relatedTabs: ["lifecycle", "ghosts", "consistency"],
  },
  {
    title: "Outcome entry is easy to skip after routing",
    detail: "No nudge after a release; close-the-loop relies on operator habit.",
    relatedTabs: ["routing", "outcomes"],
  },
  {
    title: "Cross-surface jumping still costs clicks",
    detail: "Surface Map helps, but related-surface deep links inside dossiers are inconsistent.",
    relatedTabs: ["surface-map"],
  },
];

const DEFER_FOR_NOW: { title: string; why: string }[] = [
  {
    title: "Multi-contractor routing fairness logic",
    why: "Pilot is one contractor. Fairness math has nothing real to balance yet.",
  },
  {
    title: "Persistent prioritization / roadmap backend",
    why: "Operator can hold sequencing in head + this surface. A backend planner is overhead before scale demands it.",
  },
  {
    title: "Self-serve contractor onboarding",
    why: "Onboarding is currently a high-touch act of trust. Self-serve is premature before repeatable demand.",
  },
  {
    title: "Automated learnings classification",
    why: "Learnings volume is small enough that operator review is still higher-signal than auto-tagging.",
  },
  {
    title: "Workspace/role-based admin permissions",
    why: "One operator today. Premature without a second seat to differentiate from.",
  },
];

const OUT_OF_SCOPE: { title: string; why: string }[] = [
  {
    title: "Full contractor portal expansion",
    why: "Outside current sprint. Pilot proves value before portalization.",
  },
  {
    title: "Billing / Stripe depth (subscriptions, dunning, invoices)",
    why: "Not on the pilot critical path. Existing credit flow is sufficient.",
  },
  {
    title: "Public funnel rework",
    why: "Acquisition page changes are protected outside the current admin scope.",
  },
  {
    title: "Backend automation of OTP / scanner / tracking",
    why: "Protected systems. Do not touch from admin work.",
  },
  {
    title: "Territory marketplace / lead auction systems",
    why: "Belongs to a future market structure, not the current one-contractor pilot.",
  },
];

const CONSTRAINTS: { title: string; detail: string }[] = [
  {
    title: "Pilot scale: one contractor",
    detail: "Anything that requires multi-party balancing is premature.",
  },
  {
    title: "Manual operator pipeline",
    detail: "Operator is in the loop for routing, recovery, and outcome capture. Keep tools simple and reversible.",
  },
  {
    title: "Protected subsystems",
    detail: "OTP, scanner funnel, gating, and tracking are off-limits for product changes from admin work.",
  },
  {
    title: "Operator-derived layering",
    detail: "Several concepts (stale, dead, current owner) are UI derivations. Treat repo-real promotion as deliberate, not casual.",
  },
  {
    title: "Read-only-first admin discipline",
    detail: "New admin surfaces should remain additive and reversible until the underlying need is proven.",
  },
];

const SEQUENCING_GATES: { build: string; mustBeTrue: string[] }[] = [
  {
    build: "Promote a derived concept to repo-real",
    mustBeTrue: [
      "Consistency audit reviewed for that concept",
      "One canonical owner field/label chosen",
      "Migration is reversible without data loss",
    ],
  },
  {
    build: "Tighten outcome capture",
    mustBeTrue: [
      "Outcome fields are stable",
      "Routing Desk handoff is unchanged",
      "No new mandatory steps that block the operator",
    ],
  },
  {
    build: "Reporting → Report Prep bridge",
    mustBeTrue: [
      "Internal vs external field set is explicit",
      "No homeowner-private fields can leak into Report Prep",
      "Consistency audit confirms shared concepts",
    ],
  },
  {
    build: "Anything portal-grade",
    mustBeTrue: [
      "More than one active contractor",
      "Repeatable demand pattern observed in pilot",
      "Clear billing or routing question that admin can no longer answer",
    ],
  },
];

/* ───────────── Component ───────────── */

const SECTIONS = [
  "high-leverage",
  "pain",
  "defer",
  "out-of-scope",
  "constraints",
  "gates",
] as const;
type SectionKey = (typeof SECTIONS)[number];

export function StrategicPrioritizationNextBuildDecisionFrameworkSurface({
  onNavigateTab,
}: Props) {
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    "high-leverage": true,
    pain: true,
    defer: true,
    "out-of-scope": false,
    constraints: false,
    gates: false,
  });
  const [copied, setCopied] = useState(false);

  const toggle = (k: SectionKey) =>
    setOpen((p) => ({ ...p, [k]: !p[k] }));

  const snapshot = useMemo(() => buildSnapshot(), []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snapshot);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* no-op */
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
                <Target className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">
                  Strategic Prioritization / Next-Build Decision Framework
                </CardTitle>
                <p className="text-sm text-slate-700 mt-1 max-w-2xl">
                  An honest, current-state view of what likely matters most next,
                  what should wait, and what stays intentionally out of scope.
                  No roadmap engine — just operator decision support.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Read-only</Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopy}
                className="gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copy snapshot
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* ── High Leverage ───────────────────────────────────────── */}
      <SectionCard
        icon={<Flame className="h-4 w-4" />}
        title="Highest-Leverage Next Build Areas"
        description="Candidates that would materially improve operations, readiness, or scale prep right now."
        open={open["high-leverage"]}
        onToggle={() => toggle("high-leverage")}
        accent="emerald"
        count={HIGH_LEVERAGE.length}
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {HIGH_LEVERAGE.map((item) => (
            <div
              key={item.title}
              className="rounded-md border border-border/60 bg-card/40 p-3"
            >
              <div className="text-sm font-medium text-foreground">
                {item.title}
              </div>
              <p className="text-sm text-slate-700 mt-1">{item.why}</p>
              <div className="mt-2 text-xs text-slate-700/80">
                <span className="font-medium text-foreground/70">Signal: </span>
                {item.signal}
              </div>
              {item.preconditions.length > 0 && (
                <div className="mt-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-700 mb-1">
                    Pre-conditions
                  </div>
                  <ul className="space-y-1">
                    {item.preconditions.map((p) => (
                      <li
                        key={p}
                        className="flex items-start gap-1.5 text-xs text-slate-700"
                      >
                        <CheckCircle2 className="h-3 w-3 mt-0.5 text-emerald-500 shrink-0" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {item.relatedTabs && item.relatedTabs.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {item.relatedTabs.map((t) => (
                    <Button
                      key={t}
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[11px] gap-1"
                      onClick={() => onNavigateTab?.(t)}
                      disabled={!onNavigateTab}
                    >
                      {t}
                      <ExternalLink className="h-2.5 w-2.5 opacity-100" />
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── Pain Points ─────────────────────────────────────────── */}
      <SectionCard
        icon={<AlertTriangle className="h-4 w-4" />}
        title="Current Pain Points / Bottlenecks"
        description="Concrete operator friction observed in current repo truth."
        open={open.pain}
        onToggle={() => toggle("pain")}
        accent="amber"
        count={PAIN_POINTS.length}
      >
        <ul className="space-y-3">
          {PAIN_POINTS.map((p) => (
            <li
              key={p.title}
              className="rounded-md border border-border/60 bg-card/40 p-3"
            >
              <div className="text-sm font-medium text-foreground">{p.title}</div>
              <p className="text-sm text-slate-700 mt-1">{p.detail}</p>
              {p.relatedTabs && p.relatedTabs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.relatedTabs.map((t) => (
                    <Button
                      key={t}
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[11px] gap-1"
                      onClick={() => onNavigateTab?.(t)}
                      disabled={!onNavigateTab}
                    >
                      {t}
                      <ExternalLink className="h-2.5 w-2.5 opacity-100" />
                    </Button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </SectionCard>

      {/* ── Defer ───────────────────────────────────────────────── */}
      <SectionCard
        icon={<Pause className="h-4 w-4" />}
        title="Defer For Now"
        description="Real and valuable later — but premature given current scale and constraints."
        open={open.defer}
        onToggle={() => toggle("defer")}
        accent="sky"
        count={DEFER_FOR_NOW.length}
      >
        <ul className="space-y-2">
          {DEFER_FOR_NOW.map((d) => (
            <li
              key={d.title}
              className="rounded-md border border-border/60 bg-card/40 p-3"
            >
              <div className="text-sm font-medium text-foreground">{d.title}</div>
              <p className="text-sm text-slate-700 mt-1">{d.why}</p>
            </li>
          ))}
        </ul>
      </SectionCard>

      {/* ── Out of Scope ────────────────────────────────────────── */}
      <SectionCard
        icon={<Ban className="h-4 w-4" />}
        title="Out Of Scope For Now"
        description="Intentionally excluded from current planning horizon. Includes protected systems."
        open={open["out-of-scope"]}
        onToggle={() => toggle("out-of-scope")}
        accent="rose"
        count={OUT_OF_SCOPE.length}
      >
        <ul className="space-y-2">
          {OUT_OF_SCOPE.map((d) => (
            <li
              key={d.title}
              className="rounded-md border border-border/60 bg-card/40 p-3"
            >
              <div className="text-sm font-medium text-foreground">{d.title}</div>
              <p className="text-sm text-slate-700 mt-1">{d.why}</p>
            </li>
          ))}
        </ul>
      </SectionCard>

      {/* ── Constraints ─────────────────────────────────────────── */}
      <SectionCard
        icon={<Compass className="h-4 w-4" />}
        title="Current Constraints That Should Drive Sequencing"
        description="Structural realities that should shape order-of-operations regardless of preference."
        open={open.constraints}
        onToggle={() => toggle("constraints")}
        accent="amber"
        count={CONSTRAINTS.length}
      >
        <ul className="space-y-2">
          {CONSTRAINTS.map((c) => (
            <li
              key={c.title}
              className="rounded-md border border-border/60 bg-card/40 p-3"
            >
              <div className="text-sm font-medium text-foreground">{c.title}</div>
              <p className="text-sm text-slate-700 mt-1">{c.detail}</p>
            </li>
          ))}
        </ul>
      </SectionCard>

      {/* ── Sequencing Gates ────────────────────────────────────── */}
      <SectionCard
        icon={<CheckCircle2 className="h-4 w-4" />}
        title="What Must Be True Before Certain Builds Make Sense"
        description="Pre-conditions for higher-risk or higher-cost build candidates."
        open={open.gates}
        onToggle={() => toggle("gates")}
        accent="sky"
        count={SEQUENCING_GATES.length}
      >
        <div className="space-y-3">
          {SEQUENCING_GATES.map((gate) => (
            <div
              key={gate.build}
              className="rounded-md border border-border/60 bg-card/40 p-3"
            >
              <div className="text-sm font-medium text-foreground">
                {gate.build}
              </div>
              <ul className="mt-2 space-y-1">
                {gate.mustBeTrue.map((m) => (
                  <li
                    key={m}
                    className="flex items-start gap-1.5 text-xs text-slate-700"
                  >
                    <CheckCircle2 className="h-3 w-3 mt-0.5 text-emerald-500 shrink-0" />
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── Quick Links ─────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick Links</CardTitle>
          <p className="text-sm text-slate-700">
            Supporting audit, readiness, and decision surfaces.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {[
              { tab: "learnings", label: "Pilot Learnings" },
              { tab: "audit", label: "Pilot-to-Platform Audit" },
              { tab: "rollout", label: "Rollout Planning" },
              { tab: "readiness", label: "Health Check" },
              { tab: "data-quality", label: "Data Quality" },
              { tab: "tech-debt", label: "Tech Debt" },
              { tab: "change-mgmt", label: "Change Mgmt" },
              { tab: "governance", label: "Governance" },
              { tab: "consistency", label: "Consistency" },
              { tab: "expansion", label: "Expansion" },
              { tab: "surface-map", label: "Surface Map" },
            ].map((l) => (
              <Button
                key={l.tab}
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => onNavigateTab?.(l.tab)}
                disabled={!onNavigateTab}
              >
                {l.label}
                <ExternalLink className="h-3 w-3 opacity-100" />
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────────── helpers ───────────── */

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
              <p className="text-sm text-slate-700 mt-1 max-w-2xl">
                {description}
              </p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={onToggle} className="gap-1.5">
            {open ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
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

function buildSnapshot(): string {
  const lines: string[] = [];
  lines.push("WindowMan — Strategic Prioritization Snapshot (current-state)");
  lines.push("");
  lines.push("# High Leverage");
  HIGH_LEVERAGE.forEach((h) => lines.push(`- ${h.title}: ${h.why}`));
  lines.push("");
  lines.push("# Pain Points");
  PAIN_POINTS.forEach((p) => lines.push(`- ${p.title}: ${p.detail}`));
  lines.push("");
  lines.push("# Defer For Now");
  DEFER_FOR_NOW.forEach((d) => lines.push(`- ${d.title}: ${d.why}`));
  lines.push("");
  lines.push("# Out Of Scope");
  OUT_OF_SCOPE.forEach((d) => lines.push(`- ${d.title}: ${d.why}`));
  lines.push("");
  lines.push("# Constraints");
  CONSTRAINTS.forEach((c) => lines.push(`- ${c.title}: ${c.detail}`));
  lines.push("");
  lines.push("# Sequencing Gates");
  SEQUENCING_GATES.forEach((g) => {
    lines.push(`- ${g.build}`);
    g.mustBeTrue.forEach((m) => lines.push(`    • ${m}`));
  });
  return lines.join("\n");
}
