/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DOCUMENTATION / HANDOFF READINESS — Phase 25
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Internal orientation surface. Gives a new operator (or technical
 * collaborator) a single place to understand:
 *   • what each admin surface is for
 *   • which workflows are live today
 *   • what is operator-manual vs platformized
 *   • current limits and current truths
 *   • how to hand off the system cleanly
 *
 * This is NOT a wiki, NOT a CMS, NOT a docs publishing backend. All content
 * is hardcoded current-state truth maintained alongside the rest of the
 * admin surfaces in the same repo. Local UI state only (expand/collapse).
 */

import { useMemo, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Hand,
  Map as MapIcon,
  Workflow,
  Layers,
  ListChecks,
  ShieldAlert,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface SurfaceEntry {
  tab: string;
  label: string;
  purpose: string;
  audience: "operator" | "operator+contractor" | "operator+collab";
  state: "live" | "manual" | "review-only";
}

interface WorkflowStep {
  step: string;
  surface: string;
  tab?: string;
  truth: string;
}

interface ManualVsPlatformRow {
  capability: string;
  status: "manual" | "platformized" | "partial";
  detail: string;
}

interface DocumentationHandoffReadinessSurfaceProps {
  onNavigateTab?: (tab: string) => void;
}

const SURFACES: SurfaceEntry[] = [
  {
    tab: "launch",
    label: "Pilot Ops / Launch Control",
    purpose: "Daily launch view of routing volume, ownership, and operator focus.",
    audience: "operator",
    state: "live",
  },
  {
    tab: "command",
    label: "Command Center",
    purpose: "KPI snapshot + market ops feed for the single-contractor pilot.",
    audience: "operator",
    state: "live",
  },
  {
    tab: "routing",
    label: "Routing Desk",
    purpose: "Canonical surface for assigning, releasing, and managing contractor routes.",
    audience: "operator",
    state: "manual",
  },
  {
    tab: "pipeline",
    label: "Active Pipeline",
    purpose: "Live view of in-flight leads and dossier access.",
    audience: "operator",
    state: "live",
  },
  {
    tab: "ghosts",
    label: "Ghost Recovery",
    purpose: "Unverified analyses surfaced as recovery candidates (gated until OTP).",
    audience: "operator",
    state: "manual",
  },
  {
    tab: "needs-review",
    label: "Needs Review",
    purpose: "Records flagged for manual review (invalid documents, unclear scans).",
    audience: "operator",
    state: "review-only",
  },
  {
    tab: "engine",
    label: "Dialer Desk",
    purpose: "Internal CRM/dialer desk with voice followup context.",
    audience: "operator",
    state: "manual",
  },
  {
    tab: "contractors",
    label: "Contractor Accounts",
    purpose: "Contractor account directory + credit ledger.",
    audience: "operator",
    state: "live",
  },
  {
    tab: "onboarding",
    label: "Contractor Onboarding",
    purpose: "Operator-facing onboarding checklist for new contractors.",
    audience: "operator+contractor",
    state: "manual",
  },
  {
    tab: "outcomes",
    label: "Outcome Tracking",
    purpose: "Booked / closed / quote-submitted visibility per lead.",
    audience: "operator",
    state: "manual",
  },
  {
    tab: "reporting",
    label: "Operator Reporting / Export",
    purpose: "Composed reads + plain-text/CSV export for internal review.",
    audience: "operator",
    state: "live",
  },
  {
    tab: "lifecycle",
    label: "Dead / Stale / Recovery",
    purpose: "Workflow surface for stale, dead, and reactivation decisions.",
    audience: "operator",
    state: "manual",
  },
  {
    tab: "feedback",
    label: "Contractor Feedback Loop",
    purpose: "Capture and review contractor-side outcome and feedback signals.",
    audience: "operator",
    state: "manual",
  },
  {
    tab: "shared-market",
    label: "Shared Market Manual Controls",
    purpose: "Manual market grouping overrides for shared-market scenarios.",
    audience: "operator",
    state: "manual",
  },
  {
    tab: "report-prep",
    label: "Client-Facing Reporting Prep",
    purpose: "Pre-export prep view for contractor-safe summaries.",
    audience: "operator",
    state: "review-only",
  },
  {
    tab: "audit",
    label: "Pilot-to-Platform Audit",
    purpose: "Honest read of what is pilot-only vs platform-ready.",
    audience: "operator+collab",
    state: "review-only",
  },
  {
    tab: "readiness",
    label: "Launch Readiness / Health Check",
    purpose: "Operator pre-launch checks of system health.",
    audience: "operator",
    state: "review-only",
  },
  {
    tab: "training",
    label: "Operator Training / SOP",
    purpose: "Internal SOP playbooks and contractor conversation guidance.",
    audience: "operator",
    state: "review-only",
  },
  {
    tab: "rollout",
    label: "Rollout Planning / Readiness",
    purpose: "Expansion prerequisites and current-vs-future clarity.",
    audience: "operator+collab",
    state: "review-only",
  },
  {
    tab: "data-quality",
    label: "Data Quality / Field Integrity",
    purpose: "Field coverage and fallback usage audit.",
    audience: "operator+collab",
    state: "review-only",
  },
  {
    tab: "exceptions",
    label: "Exception Handling / Manual Escalation",
    purpose: "Records that need human judgment because signals are ambiguous.",
    audience: "operator",
    state: "review-only",
  },
  {
    tab: "attribution",
    label: "Attribution",
    purpose: "Inbound attribution coverage by lead.",
    audience: "operator",
    state: "live",
  },
  {
    tab: "pilot",
    label: "Pilot Readiness",
    purpose: "Earliest pilot readiness checklist (kept for continuity).",
    audience: "operator",
    state: "review-only",
  },
];

const CORE_WORKFLOWS: Array<{ id: string; title: string; steps: WorkflowStep[] }> = [
  {
    id: "intake-to-route",
    title: "Intake → Routing",
    steps: [
      {
        step: "Lead arrives via funnel + uploads quote",
        surface: "Public funnel (protected — do not modify)",
        truth: "Scanner produces an analysis; phone OTP gates the full report.",
      },
      {
        step: "Operator reviews active pipeline",
        surface: "Active Pipeline",
        tab: "pipeline",
        truth: "Live verified leads + dossier access.",
      },
      {
        step: "Operator opens Routing Desk and assigns a contractor",
        surface: "Routing Desk",
        tab: "routing",
        truth: "Routing is manual today. There is no auto-router.",
      },
    ],
  },
  {
    id: "release-and-handoff",
    title: "Contact release & contractor handoff",
    steps: [
      {
        step: "Contractor expresses interest",
        surface: "Routing Desk",
        tab: "routing",
        truth: "Contractor side is captured manually by the operator today.",
      },
      {
        step: "Operator reviews release request and approves/denies",
        surface: "Routing Desk",
        tab: "routing",
        truth: "Release is operator-controlled. There is no auto-approval.",
      },
      {
        step: "Operator coordinates handoff",
        surface: "Dialer Desk + manual contact",
        tab: "engine",
        truth: "No contractor portal exists yet. Handoff is operator-mediated.",
      },
    ],
  },
  {
    id: "outcome-and-lifecycle",
    title: "Outcome capture & lifecycle review",
    steps: [
      {
        step: "Contractor reports booking / quote / close",
        surface: "Outcome Tracking",
        tab: "outcomes",
        truth: "Operator records outcome timestamps manually based on contractor input.",
      },
      {
        step: "Operator reviews stale / dead / recovery candidates",
        surface: "Dead / Stale / Recovery",
        tab: "lifecycle",
        truth: "Stale/dead/recovery is operator-judged from repo-real timestamps.",
      },
      {
        step: "Operator handles ambiguous records",
        surface: "Exception Handling / Manual Escalation",
        tab: "exceptions",
        truth: "Read-only surfacing of records needing human decisions.",
      },
    ],
  },
  {
    id: "review-and-handoff",
    title: "Review & operator handoff",
    steps: [
      {
        step: "Daily/weekly system review",
        surface: "Operator Reporting + Health Check",
        tab: "reporting",
        truth: "Reporting is composed reads + export. No reporting backend.",
      },
      {
        step: "Onboard a new operator",
        surface: "Operator Training / SOP",
        tab: "training",
        truth: "SOP content lives in the app and is current-state only.",
      },
      {
        step: "Plan rollout / expansion",
        surface: "Rollout Planning / Readiness",
        tab: "rollout",
        truth: "Honest expansion prerequisites; no automated planning.",
      },
    ],
  },
];

const MANUAL_VS_PLATFORM: ManualVsPlatformRow[] = [
  {
    capability: "Contractor routing decision",
    status: "manual",
    detail: "Operator selects the contractor in Routing Desk for each opportunity.",
  },
  {
    capability: "Contact release approval",
    status: "manual",
    detail: "Operator reviews and approves/denies each release in Routing Desk.",
  },
  {
    capability: "Outcome capture (booked/closed/quote)",
    status: "manual",
    detail: "Operator records outcomes via Outcome Tracking based on contractor reporting.",
  },
  {
    capability: "Stale / dead / recovery classification",
    status: "manual",
    detail: "Operator-judged from repo-real timestamps in Dead / Stale / Recovery.",
  },
  {
    capability: "Shared-market grouping overrides",
    status: "manual",
    detail: "Operator-controlled in Shared Market Manual Controls.",
  },
  {
    capability: "Lead intake + scanner analysis",
    status: "platformized",
    detail: "Public funnel + scanner produce analyses automatically. Protected — do not modify.",
  },
  {
    capability: "Phone OTP gating of the full report",
    status: "platformized",
    detail: "Backend-enforced via send-otp / verify-otp. Protected.",
  },
  {
    capability: "Tracking + Meta CAPI server-side bridge",
    status: "platformized",
    detail: "Backend pipeline. Protected. Operator does not touch this directly.",
  },
  {
    capability: "Reporting / export",
    status: "partial",
    detail: "Composed reads + manual export. No reporting warehouse, no scheduled jobs.",
  },
  {
    capability: "Contractor onboarding",
    status: "partial",
    detail: "Operator-driven invite + checklist. No self-serve contractor portal.",
  },
];

const CURRENT_LIMITS = [
  "There is no contractor-facing portal. All contractor interaction is operator-mediated.",
  "There is no automated routing or fairness engine. Routing decisions are manual.",
  "There is no billing/Stripe integration in the operator surfaces today.",
  "There is no scheduled reporting backend. Exports are operator-triggered, current-state.",
  "There is no persisted SOP/training/audit/exception state — those surfaces are read-only views.",
  "Shared-market behavior is manual; multi-contractor automation is not built.",
];

const HANDOFF_NOTES = [
  "Start a new operator on Operator Training / SOP for the daily playbook, then walk them through Routing Desk → Outcomes → Dead/Stale/Recovery in that order.",
  "For a technical collaborator: start at Pilot-to-Platform Audit, then Data Quality, then Rollout Planning to understand current vs future state.",
  "Tell contractors the operator is the single point of contact today. There is no portal to send them to.",
  "Never imply automation that does not exist. Use 'operator-controlled' or 'manual' language consistently.",
  "Protected systems (OTP, scanner, tracking, public funnel) are off-limits for ad-hoc changes — escalate to engineering.",
];

const QUICK_LINKS: Array<{ tab: string; label: string }> = [
  { tab: "launch", label: "Pilot Ops / Launch Control" },
  { tab: "routing", label: "Routing Desk" },
  { tab: "pipeline", label: "Active Pipeline" },
  { tab: "outcomes", label: "Outcome Tracking" },
  { tab: "lifecycle", label: "Dead / Stale / Recovery" },
  { tab: "exceptions", label: "Exception Handling" },
  { tab: "data-quality", label: "Data Quality / Field Integrity" },
  { tab: "training", label: "Operator Training / SOP" },
  { tab: "rollout", label: "Rollout Planning / Readiness" },
  { tab: "audit", label: "Pilot-to-Platform Audit" },
  { tab: "readiness", label: "Launch Readiness / Health Check" },
  { tab: "reporting", label: "Operator Reporting / Export" },
];

function StateBadge({ state }: { state: SurfaceEntry["state"] }) {
  if (state === "live") {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-950 border-emerald-500/30 hover:bg-emerald-500/15">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Live
      </Badge>
    );
  }
  if (state === "manual") {
    return (
      <Badge className="bg-amber-500/10 text-amber-950 border-amber-500/30 hover:bg-amber-500/15">
        <Hand className="h-3 w-3 mr-1" />
        Manual
      </Badge>
    );
  }
  return (
    <Badge className="bg-muted text-slate-700 border-border hover:bg-muted">
      <BookOpen className="h-3 w-3 mr-1" />
      Review-only
    </Badge>
  );
}

function StatusPill({ status }: { status: ManualVsPlatformRow["status"] }) {
  if (status === "platformized") {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-950 border-emerald-500/30 hover:bg-emerald-500/15">
        Platformized
      </Badge>
    );
  }
  if (status === "manual") {
    return (
      <Badge className="bg-amber-500/10 text-amber-950 border-amber-500/30 hover:bg-amber-500/15">
        Manual
      </Badge>
    );
  }
  return (
    <Badge className="bg-sky-500/10 text-sky-950 border-sky-500/30 hover:bg-sky-500/15">
      Partial
    </Badge>
  );
}

export function DocumentationHandoffReadinessSurface({
  onNavigateTab,
}: DocumentationHandoffReadinessSurfaceProps) {
  const { toast } = useToast();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    surfaceMap: true,
    workflowMap: true,
    surfaceGuide: false,
    manualVsPlatform: false,
    limits: false,
    handoff: true,
  });

  const summary = useMemo(() => {
    const counts = { live: 0, manual: 0, review: 0 };
    for (const s of SURFACES) {
      if (s.state === "live") counts.live++;
      else if (s.state === "manual") counts.manual++;
      else counts.review++;
    }
    return counts;
  }, []);

  const toggle = (id: string) =>
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));

  const copyHandoff = async () => {
    const lines: string[] = [];
    lines.push("WindowMan Mission Control — Operator Handoff Snapshot");
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push("");
    lines.push(
      `Surfaces: ${summary.live} live · ${summary.manual} manual · ${summary.review} review-only`,
    );
    lines.push("");
    lines.push("## Current system map");
    for (const s of SURFACES) {
      lines.push(`- [${s.state}] ${s.label} — ${s.purpose}`);
    }
    lines.push("");
    lines.push("## Core workflows");
    for (const w of CORE_WORKFLOWS) {
      lines.push(`### ${w.title}`);
      for (const st of w.steps) {
        lines.push(`- ${st.step} → ${st.surface}`);
        lines.push(`  truth: ${st.truth}`);
      }
      lines.push("");
    }
    lines.push("## Manual vs platformized");
    for (const r of MANUAL_VS_PLATFORM) {
      lines.push(`- [${r.status}] ${r.capability} — ${r.detail}`);
    }
    lines.push("");
    lines.push("## Current limits / truths");
    for (const l of CURRENT_LIMITS) lines.push(`- ${l}`);
    lines.push("");
    lines.push("## Handoff notes");
    for (const n of HANDOFF_NOTES) lines.push(`- ${n}`);

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast({
        title: "Handoff snapshot copied",
        description: "Plain-text orientation summary on clipboard.",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Clipboard unavailable in this context.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border bg-card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5 mt-0.5">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-semibold tracking-tight">
                Documentation / Handoff Readiness
              </h2>
              <p className="text-sm text-slate-700 mt-1 max-w-2xl">
                Single internal orientation surface. Explains what each admin surface is for, which workflows
                are live, what is operator-manual vs platformized, and how to hand off the system cleanly to a
                new operator or technical collaborator. No docs backend, no CMS — just current-state truth.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={copyHandoff} className="gap-1.5">
              <Copy className="h-3.5 w-3.5" />
              Copy handoff
            </Button>
          </div>
        </div>

        {/* Summary chips */}
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          <div className="rounded-lg border bg-emerald-500/5 border-emerald-500/30 px-3 py-2.5">
            <div className="text-sm uppercase tracking-wide text-emerald-950 font-semibold">
              Live
            </div>
            <div className="text-xl font-semibold mt-0.5">{summary.live}</div>
          </div>
          <div className="rounded-lg border bg-amber-500/5 border-amber-500/30 px-3 py-2.5">
            <div className="text-sm uppercase tracking-wide text-amber-950 font-semibold">
              Manual
            </div>
            <div className="text-xl font-semibold mt-0.5">{summary.manual}</div>
          </div>
          <div className="rounded-lg border bg-muted/40 px-3 py-2.5">
            <div className="text-sm uppercase tracking-wide text-slate-700 font-semibold">
              Review-only
            </div>
            <div className="text-xl font-semibold mt-0.5">{summary.review}</div>
          </div>
        </div>
      </div>

      {/* Current System Map */}
      <Section
        id="surfaceMap"
        title="Current system map"
        intent="High-level surface inventory — what each tab is for and its current state."
        icon={MapIcon}
        open={openSections.surfaceMap}
        onToggle={toggle}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SURFACES.map((s) => (
            <button
              key={s.tab}
              type="button"
              onClick={() => onNavigateTab?.(s.tab)}
              disabled={!onNavigateTab}
              className="text-left rounded-lg border bg-background hover:bg-muted/40 transition-colors px-3 py-2.5 disabled:opacity-100 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium truncate">{s.label}</div>
                <StateBadge state={s.state} />
              </div>
              <div className="text-xs text-slate-700 mt-1 line-clamp-2">{s.purpose}</div>
            </button>
          ))}
        </div>
      </Section>

      {/* Core workflows */}
      <Section
        id="workflowMap"
        title="Core workflow map"
        intent="The four real workflows operators run today, with current-state truth."
        icon={Workflow}
        open={openSections.workflowMap}
        onToggle={toggle}
      >
        <div className="space-y-4">
          {CORE_WORKFLOWS.map((w) => (
            <div key={w.id} className="rounded-lg border bg-background overflow-hidden">
              <div className="px-4 py-2.5 border-b bg-muted/20">
                <div className="text-sm font-semibold">{w.title}</div>
              </div>
              <ol className="divide-y">
                {w.steps.map((st, i) => (
                  <li key={i} className="px-4 py-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm">
                        <span className="text-slate-700 tabular-nums mr-2">{i + 1}.</span>
                        <span className="font-medium">{st.step}</span>
                      </div>
                      <div className="text-xs text-slate-700 mt-1">
                        Surface: <span className="font-mono">{st.surface}</span>
                      </div>
                      <div className="text-xs text-slate-700 mt-0.5 italic">
                        Truth: {st.truth}
                      </div>
                    </div>
                    {st.tab && onNavigateTab && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onNavigateTab(st.tab!)}
                        className="gap-1.5 text-xs shrink-0"
                      >
                        Open
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </Section>

      {/* Surface guide (audience) */}
      <Section
        id="surfaceGuide"
        title="Surface-by-surface guide"
        intent="Audience and purpose for each surface — useful when handing off to a new role."
        icon={Layers}
        open={openSections.surfaceGuide}
        onToggle={toggle}
      >
        <div className="rounded-lg border overflow-hidden">
          <div className="grid grid-cols-12 px-4 py-2 bg-muted/30 text-sm uppercase tracking-wide text-slate-700 font-semibold">
            <div className="col-span-4">Surface</div>
            <div className="col-span-5">Purpose</div>
            <div className="col-span-2">Audience</div>
            <div className="col-span-1 text-right">Open</div>
          </div>
          <div className="divide-y">
            {SURFACES.map((s) => (
              <div key={s.tab} className="grid grid-cols-12 px-4 py-2.5 items-center gap-2">
                <div className="col-span-4 text-sm font-medium truncate">{s.label}</div>
                <div className="col-span-5 text-xs text-slate-700 line-clamp-2">{s.purpose}</div>
                <div className="col-span-2">
                  <div className="flex items-center gap-1 text-xs text-slate-700">
                    <Users className="h-3 w-3" />
                    <span className="truncate">{s.audience}</span>
                  </div>
                </div>
                <div className="col-span-1 text-right">
                  {onNavigateTab && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onNavigateTab(s.tab)}
                      className="h-7 w-7 p-0"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Manual vs Platformized */}
      <Section
        id="manualVsPlatform"
        title="Manual vs platformized capabilities"
        intent="Honest read of what is operator-controlled today vs what the platform handles automatically."
        icon={ListChecks}
        open={openSections.manualVsPlatform}
        onToggle={toggle}
      >
        <div className="divide-y border rounded-lg overflow-hidden">
          {MANUAL_VS_PLATFORM.map((r) => (
            <div
              key={r.capability}
              className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{r.capability}</div>
                <div className="text-xs text-slate-700 mt-0.5">{r.detail}</div>
              </div>
              <div className="shrink-0">
                <StatusPill status={r.status} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Current limits / truths */}
      <Section
        id="limits"
        title="Current limits / truths"
        intent="What is genuinely not built today. Use this language with contractors and collaborators."
        icon={ShieldAlert}
        open={openSections.limits}
        onToggle={toggle}
      >
        <ul className="space-y-1.5 text-sm">
          {CURRENT_LIMITS.map((l, i) => (
            <li key={i} className="flex items-start gap-2 text-slate-700">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-950 mt-0.5 shrink-0" />
              <span>{l}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Handoff notes */}
      <Section
        id="handoff"
        title="Handoff notes for a new operator or collaborator"
        intent="Practical guidance for orienting someone new without inventing automation that doesn't exist."
        icon={Hand}
        open={openSections.handoff}
        onToggle={toggle}
      >
        <ul className="space-y-1.5 text-sm">
          {HANDOFF_NOTES.map((n, i) => (
            <li key={i} className="flex items-start gap-2 text-slate-700">
              <span className="text-primary mt-0.5">•</span>
              <span>{n}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Quick links */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="font-semibold text-sm">Jump to any major admin surface</h3>
        <p className="text-xs text-slate-700 mt-0.5">
          Shortcut grid for the surfaces a new operator will use most.
        </p>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {QUICK_LINKS.map((q) => (
            <button
              key={q.tab}
              type="button"
              onClick={() => onNavigateTab?.(q.tab)}
              disabled={!onNavigateTab}
              className="text-left rounded-lg border bg-background hover:bg-muted/40 transition-colors px-3 py-2.5 disabled:opacity-100 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium">{q.label}</div>
                <ExternalLink className="h-3.5 w-3.5 text-slate-700 shrink-0" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Local section wrapper (collapsible) ─────────────────────────────── */
function Section({
  id,
  title,
  intent,
  icon: Icon,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  intent: string;
  icon: typeof BookOpen;
  open: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 hover:bg-muted/40 transition-colors text-left"
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className="rounded-md bg-primary/10 p-1.5 mt-0.5 shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="font-medium text-sm">{title}</div>
            <div className="text-xs text-slate-700 mt-0.5 line-clamp-2">{intent}</div>
          </div>
        </div>
        <div className="shrink-0 text-slate-700">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </button>
      {open && <div className="border-t px-4 sm:px-5 py-4">{children}</div>}
    </div>
  );
}
