/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Operator Training / SOP Surface — Phase 21
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Internal-only operator training & SOP playbook. Read-only guidance for
 * how to actually run the system today. Honest, current-state only.
 *
 * Constraints:
 *  - Frontend only. No backend persistence, no LMS, no quizzes backend.
 *  - Uses repo-real surfaces; navigates via the existing admin tabs.
 *  - Local-only completion toggles (in-memory, reset on reload).
 *  - Never implies automation or systems that don't exist.
 */

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Copy,
  ExternalLink,
  Info,
  ListChecks,
  MessageCircle,
  Route,
  Target,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import {
  adminSurfaceLabelBadgeClass,
  getAdminSurfaceLabel,
} from "@/routes/adminDashboardTabs";

interface OperatorTrainingSOPSurfaceProps {
  onNavigateTab?: (tab: string) => void;
}

interface SOPStep {
  id: string;
  title: string;
  body: string;
}

interface SOPSection {
  id: string;
  title: string;
  intent: string;
  icon: typeof Workflow;
  jumpToTab?: { tab: string; label: string };
  steps: SOPStep[];
}

/**
 * Section catalog. All copy reflects current repo-real behavior:
 *  - Routing is operator-driven (manual selection / manual release).
 *  - Outcome and feedback are captured manually.
 *  - Stale / dead / recovery is operator-reviewed.
 *  - Shared-market controls are manual surfaces, not automation.
 */
const SOP_SECTIONS: SOPSection[] = [
  {
    id: "core",
    title: "Core Workflow",
    intent: "How a homeowner lead becomes a routed opportunity end-to-end.",
    icon: Workflow,
    jumpToTab: { tab: "launch", label: "Open Launch Control" },
    steps: [
      {
        id: "core-1",
        title: "Start in Launch Control",
        body: "Open the Launch Control tab at the start of every session. Confirm the system feels responsive and recent leads are loading.",
      },
      {
        id: "core-2",
        title: "Triage new leads in Active Pipeline",
        body: "Review newly arrived leads. Verify name, phone-verified state, county, project type, and quote presence before any outreach.",
      },
      {
        id: "core-3",
        title: "Open the Lead Dossier",
        body: "Use the dossier to read the homeowner's intake, scan output, and operator notes. Don't act on a lead without reading the dossier first.",
      },
      {
        id: "core-4",
        title: "Route only after review",
        body: "When a lead is ready, move to the Routing tab. Routing today is manual — you select the contractor based on county, project type, and current capacity.",
      },
      {
        id: "core-5",
        title: "Capture outcomes honestly",
        body: "After contractor contact, record the outcome in the Outcomes tab. Honest current-state notes are more valuable than optimistic ones.",
      },
    ],
  },
  {
    id: "routing",
    title: "Routing SOP",
    intent: "How to assign opportunities to a contractor today.",
    icon: Route,
    jumpToTab: { tab: "routing", label: "Open Routing Desk" },
    steps: [
      {
        id: "routing-1",
        title: "Confirm the lead is route-ready",
        body: "The lead should have phone verification, an analyzed scan, and a clear county. If any of these are missing, send it back to triage instead of routing.",
      },
      {
        id: "routing-2",
        title: "Pick the contractor manually",
        body: "There is no automated round-robin. You choose the contractor based on county coverage, current load, and prior performance you've observed.",
      },
      {
        id: "routing-3",
        title: "Document the routing reason",
        body: "Note why you chose this contractor (county fit, project type, capacity). This makes the trail reviewable later.",
      },
      {
        id: "routing-4",
        title: "Confirm release status",
        body: "Releasing contact info is a deliberate operator action. Don't release until the contractor has accepted and you're ready for the introduction.",
      },
    ],
  },
  {
    id: "outcome",
    title: "Outcome & Feedback SOP",
    intent: "How to close the loop after routing.",
    icon: Target,
    jumpToTab: { tab: "outcomes", label: "Open Outcome Tracking" },
    steps: [
      {
        id: "outcome-1",
        title: "Log appointment booked",
        body: "When the contractor confirms an appointment, mark the appointment_booked state on the lead. This is current-state truth, not a forecast.",
      },
      {
        id: "outcome-2",
        title: "Capture replacement quote if shared",
        body: "If the contractor shares a counter-quote, record it. Honest dollar deltas drive the reporting layer.",
      },
      {
        id: "outcome-3",
        title: "Mark closed only when confirmed",
        body: "Don't pre-mark a lead closed. Mark it closed when the deal is actually closed (won or lost) per the contractor.",
      },
      {
        id: "outcome-4",
        title: "Use the Feedback tab for contractor commentary",
        body: "Use the Feedback Loop tab to capture contractor commentary on lead quality. Keep it factual and operator-facing.",
      },
    ],
  },
  {
    id: "lifecycle",
    title: "Dead / Stale / Recovery SOP",
    intent: "How to handle leads that stop progressing.",
    icon: ListChecks,
    jumpToTab: { tab: "lifecycle", label: "Open Lifecycle Workflow" },
    steps: [
      {
        id: "lifecycle-1",
        title: "Use the Lifecycle tab daily",
        body: "Open the Lifecycle workflow surface daily. Stale and dead classifications today are operator-reviewed, not automatic.",
      },
      {
        id: "lifecycle-2",
        title: "Review stale before declaring dead",
        body: "A stale lead is not a dead lead. Try a recovery touch (email or callback) before changing classification.",
      },
      {
        id: "lifecycle-3",
        title: "Recovery touches are deliberate",
        body: "Recovery is a manual decision. There is no automated nurture sequence. If you send a recovery email, log it in the dossier notes.",
      },
      {
        id: "lifecycle-4",
        title: "Mark dead only with reason",
        body: "If a lead is dead, capture why (no response, wrong number, not a real homeowner, etc). This protects future reporting from drift.",
      },
    ],
  },
  {
    id: "conversation",
    title: "Contractor Conversation Guidance",
    intent: "What to say (and not say) to a contractor about the system today.",
    icon: MessageCircle,
    jumpToTab: { tab: "feedback", label: "Open Feedback Loop" },
    steps: [
      {
        id: "conv-1",
        title: "Describe the system as operator-curated",
        body: "We hand-pick and review every routed opportunity. Don't imply an automated marketplace, round-robin, or fairness engine — none of that exists today.",
      },
      {
        id: "conv-2",
        title: "Be honest about reporting scope",
        body: "Today's contractor-facing reporting is current-state only: routed, booked, unresolved, stale, recovery. Don't promise ROI scoring, predictive analytics, or contractor performance grading.",
      },
      {
        id: "conv-3",
        title: "Don't promise portal access",
        body: "There is no contractor self-serve portal yet. If a contractor asks, frame it as a future direction — not a live capability.",
      },
      {
        id: "conv-4",
        title: "Frame coverage by county",
        body: "Coverage is described by counties currently observed in the data. Don't imply nationwide reach or guaranteed exclusivity.",
      },
      {
        id: "conv-5",
        title: "Acknowledge what's manual",
        body: "If asked how routing works: 'An operator reviews the lead, confirms verification, and picks the contractor based on fit and capacity.' That's the truth — say it plainly.",
      },
    ],
  },
];

/**
 * Plain-language SOP snippet that operators can paste into internal notes
 * or hand to a new operator during onboarding. Stays current-state only.
 */
const SOP_SNIPPET = `WindowMan Operator SOP — Current State

1. Open Launch Control. Confirm system is responsive.
2. Triage new leads in Active Pipeline. Read each Lead Dossier.
3. Routing is manual — pick the contractor based on county, project type, and capacity.
4. Capture outcomes in the Outcomes tab. Mark closed only when confirmed.
5. Review the Lifecycle tab daily for stale/dead/recovery decisions.
6. Use the Feedback Loop tab for contractor commentary.

Talking to contractors:
- Operator-curated, not automated.
- Reporting is current-state only.
- No portal, no automated routing, no ROI grading.
`;

export function OperatorTrainingSOPSurface({
  onNavigateTab,
}: OperatorTrainingSOPSurfaceProps) {
  // Local-only completion state. Reset on reload. Not persisted.
  const [completed, setCompleted] = useState<Record<string, boolean>>({});

  const totals = useMemo(() => {
    const all = SOP_SECTIONS.flatMap((s) => s.steps.map((step) => step.id));
    const done = all.filter((id) => completed[id]).length;
    return { done, total: all.length };
  }, [completed]);

  const toggle = (stepId: string) =>
    setCompleted((prev) => ({ ...prev, [stepId]: !prev[stepId] }));

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(SOP_SNIPPET);
      toast.success("SOP snippet copied", {
        description: "Paste into internal notes or share with a new operator.",
      });
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-primary/10 p-2">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">
                  Operator Training & SOP
                </CardTitle>
                <p className="text-sm text-slate-700 mt-1 max-w-2xl">
                  Internal playbook for running the current system correctly.
                  Honest, current-state guidance — no automation implied, no
                  promises made.
                </p>
              </div>
            </div>
            {(() => {
              const label = getAdminSurfaceLabel("training");
              if (!label) return null;
              return (
                <Badge
                  variant="outline"
                  className={`font-mono text-xs font-extrabold uppercase tracking-wide ${adminSurfaceLabelBadgeClass(label)}`}
                >
                  {label}
                </Badge>
              );
            })()}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-slate-700">
              Local progress:{" "}
              <span className="font-medium text-foreground">
                {totals.done} / {totals.total}
              </span>{" "}
              steps marked. Resets on reload — nothing is saved server-side.
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={copySnippet}
              className="gap-2"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy SOP snippet
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Disclosure ─────────────────────────────────────────────── */}
      <Card className="border-amber-500/30 bg-amber-500/[0.03]">
        <CardContent className="pt-5 pb-5">
          <div className="flex gap-3">
            <Info className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="text-sm text-foreground/90 space-y-1">
              <p className="font-medium">What this surface is — and isn't</p>
              <p className="text-slate-700">
                This is operator guidance, not an LMS. Nothing here represents
                automated workflows, certification, or contractor-facing
                training. All progress toggles are in-memory only.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── SOP sections ───────────────────────────────────────────── */}
      {SOP_SECTIONS.map((section) => {
        const Icon = section.icon;
        const sectionDone = section.steps.filter((s) => completed[s.id]).length;
        return (
          <Card key={section.id} id={`sop-${section.id}`}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-muted p-2">
                    <Icon className="h-4 w-4 text-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{section.title}</CardTitle>
                    <p className="text-sm text-slate-700 mt-1">
                      {section.intent}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-xs">
                    {sectionDone}/{section.steps.length}
                  </Badge>
                  {section.jumpToTab && onNavigateTab && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => onNavigateTab(section.jumpToTab!.tab)}
                    >
                      <ExternalLink className="h-3 w-3" />
                      {section.jumpToTab.label}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {section.steps.map((step, idx) => {
                  const done = !!completed[step.id];
                  return (
                    <li
                      key={step.id}
                      className="flex items-start gap-3 rounded-md border border-border/60 p-3 hover:bg-muted/40 transition-colors"
                    >
                      <button
                        onClick={() => toggle(step.id)}
                        className="mt-0.5 shrink-0"
                        aria-label={done ? "Mark incomplete" : "Mark complete"}
                      >
                        {done ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Circle className="h-4 w-4 text-slate-700" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-slate-700">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <span
                            className={`text-sm font-medium ${
                              done
                                ? "text-slate-700 line-through"
                                : "text-foreground"
                            }`}
                          >
                            {step.title}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 mt-1 leading-relaxed">
                          {step.body}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        );
      })}

      {/* ── Quick Links ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Links</CardTitle>
          <p className="text-sm text-slate-700 mt-1">
            Jump to the live admin surfaces referenced above.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { tab: "launch", label: "Launch Control" },
              { tab: "pipeline", label: "Active Pipeline" },
              { tab: "routing", label: "Routing Desk" },
              { tab: "outcomes", label: "Outcomes" },
              { tab: "lifecycle", label: "Lifecycle Workflow" },
              { tab: "feedback", label: "Feedback Loop" },
              { tab: "shared-market", label: "Shared Market" },
              { tab: "reporting", label: "Reporting" },
              { tab: "report-prep", label: "Report Prep" },
              { tab: "audit", label: "Audit" },
              { tab: "readiness", label: "Health Check" },
              { tab: "onboarding", label: "Onboarding" },
            ].map((link) => (
              <Button
                key={link.tab}
                variant="outline"
                size="sm"
                className="justify-start text-xs"
                onClick={() => onNavigateTab?.(link.tab)}
              >
                <ExternalLink className="h-3 w-3 mr-1.5" />
                {link.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Separator />

      <p className="text-xs text-slate-700 text-center">
        SOP content reflects current system behavior only. Update this surface
        when real workflow changes ship.
      </p>
    </div>
  );
}
