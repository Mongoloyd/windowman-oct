/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Operator Scenario Drills / Manual Simulation Readiness (Phase 29)
 * ───────────────────────────────────────────────────────────────────────────
 * Internal, read-only operator drill layer.
 *
 * Purpose:
 *   Let the operator rehearse realistic edge cases (routing blocks, stale
 *   leads, conflicting feedback, ambiguous ownership, shareability calls)
 *   using current repo-real workflows. No simulation engine, no sandbox
 *   backend, no persistence.
 *
 * Classification logic (deterministic, current-state only):
 *   - Scenarios are grouped by the live admin surface that resolves them.
 *   - Each scenario lists: trigger, why it happens, current operator
 *     response, and the surface to navigate to.
 *   - "Severity" is a static editorial label tied to operational risk
 *     (low / medium / high). Not a runtime signal.
 *
 * Hard rules (enforced in this file):
 *   - Frontend only. No backend, no fake "Run Drill" actions, no persistence.
 *   - No "cartel" language anywhere.
 *   - Copy is current-state honest; nothing implies automation that does
 *     not exist.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ClipboardList,
  Route,
  KeyRound,
  MessageSquareWarning,
  Hourglass,
  FileText,
  ArrowRight,
  Copy,
  Check,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────────────────
// Cross-surface navigation key (matches AdminDashboard tab values)
// ─────────────────────────────────────────────────────────────────────────
type AdminTabKey =
  | "launch"
  | "command"
  | "pipeline"
  | "routing"
  | "ghosts"
  | "needs-review"
  | "engine"
  | "contractors"
  | "onboarding"
  | "outcomes"
  | "reporting"
  | "lifecycle"
  | "feedback"
  | "shared-market"
  | "report-prep"
  | "audit"
  | "readiness"
  | "training"
  | "rollout"
  | "data-quality"
  | "exceptions"
  | "docs"
  | "learnings"
  | "change-mgmt"
  | "governance"
  | "drills"
  | "attribution"
  | "pilot";

interface Props {
  onNavigateTab?: (tab: AdminTabKey) => void;
}

// ─────────────────────────────────────────────────────────────────────────
// Scenario catalog
// (deterministic, derived from current repo-real workflows only)
// ─────────────────────────────────────────────────────────────────────────

type Severity = "low" | "medium" | "high";

interface Scenario {
  title: string;
  trigger: string;
  why: string;
  response: string;
  systemTruth: string;
  severity: Severity;
  surface?: { label: string; tab: AdminTabKey };
}

const ROUTING_SCENARIOS: Scenario[] = [
  {
    title: "Verified lead is ready but routing is unclear",
    trigger:
      "Lead is OTP-verified and analysis is complete, but it is not obvious whether to route now or hold.",
    why:
      "Pilot routing is operator-judged. There is no automated allocation today.",
    response:
      "Open Routing Desk, confirm the lead's analysis and county, and route to the active contractor. Note the rationale in lead notes.",
    systemTruth:
      "Single-contractor pilot. No fairness queue, no auto-allocation.",
    severity: "medium",
    surface: { label: "Routing Desk", tab: "routing" },
  },
  {
    title: "Lead has no county / ambiguous service area",
    trigger: "County or service area is missing on the lead snapshot.",
    why:
      "Intake form or extraction did not capture county. No automated geo-fallback today.",
    response:
      "Mark the lead in Needs Review, contact the homeowner if appropriate, or close out as out-of-scope. Do not route blind.",
    systemTruth:
      "Routing depends on operator-confirmed county. No silent geocoding.",
    severity: "high",
    surface: { label: "Needs Review", tab: "needs-review" },
  },
  {
    title: "Two leads from the same household",
    trigger: "Same homeowner appears as two separate scan_session_ids / leads.",
    why:
      "Each scan creates its own session. There is no automated dedup at the lead level today.",
    response:
      "Pick the most complete lead. Annotate the duplicate. Route only one. Do not merge identifiers.",
    systemTruth:
      "lead_id and scan_session_id are persistent; never re-key from the UI.",
    severity: "medium",
    surface: { label: "Active Pipeline", tab: "pipeline" },
  },
];

const OWNERSHIP_SCENARIOS: Scenario[] = [
  {
    title: "Contact release is requested but verification is uncertain",
    trigger:
      "Operator is asked to release contact but cannot confirm verification or quality.",
    why:
      "Contact release is a manual gate. It must be backed by phone_verified state and operator confidence.",
    response:
      "Verify `phone_verified_at` is set and the analysis is clean. If unclear, hold release and document the reason.",
    systemTruth:
      "phone_verified is owned by the OTP backend. Never override from the UI.",
    severity: "high",
    surface: { label: "Routing Desk", tab: "routing" },
  },
  {
    title: "Ownership conflict between operator surfaces",
    trigger:
      "Lead appears in both Active Pipeline and Ghost Recovery, or status disagrees across surfaces.",
    why:
      "Surfaces derive state from the same `leads` row but apply different filters. Visual overlap is expected on edge thresholds.",
    response:
      "Treat the canonical row as truth. Resolve by acting in the surface that owns the next step (e.g. recovery in Lifecycle, routing in Routing Desk).",
    systemTruth:
      "All admin surfaces read from the same canonical `leads` row.",
    severity: "low",
    surface: { label: "Lifecycle", tab: "lifecycle" },
  },
];

const FEEDBACK_SCENARIOS: Scenario[] = [
  {
    title: "Contractor feedback is missing after handoff",
    trigger:
      "Lead was routed but no contractor disposition has come back within expected window.",
    why:
      "There is no automated contractor self-service today. Feedback is captured manually by the operator.",
    response:
      "Reach the contractor through the agreed channel. Log disposition in Feedback Loop. Do not assume status.",
    systemTruth:
      "No contractor portal write-back exists. Feedback is operator-entered.",
    severity: "medium",
    surface: { label: "Feedback Loop", tab: "feedback" },
  },
  {
    title: "Conflicting outcome signals (booked vs not booked)",
    trigger:
      "Outcome Tracking shows a booked appointment but contractor reports the opposite.",
    why:
      "Outcomes are derived from operator entries. Two surfaces can drift if entries were not updated in lockstep.",
    response:
      "Use the contractor's verbal confirmation as truth. Update Outcome Tracking and Feedback Loop to match. Note the correction.",
    systemTruth:
      "Outcomes reflect what was last entered by the operator, not real-time CRM state.",
    severity: "medium",
    surface: { label: "Outcomes", tab: "outcomes" },
  },
  {
    title: "Negative feedback on a high-grade lead",
    trigger:
      "Contractor reports the lead was unqualified despite a strong analysis grade.",
    why:
      "Grade reflects the quote forensics, not homeowner readiness. They can diverge.",
    response:
      "Capture the contractor reason in Feedback Loop. Flag for Pilot Learnings review. Do not adjust the grade.",
    systemTruth:
      "Grade is deterministic backend output. Operator never edits it.",
    severity: "low",
    surface: { label: "Feedback Loop", tab: "feedback" },
  },
];

const LIFECYCLE_SCENARIOS: Scenario[] = [
  {
    title: "Lead is stale but not clearly dead",
    trigger:
      "No activity for 14–21 days but no explicit closeout signal.",
    why:
      "There is no automated decay rule today. Lifecycle decisions are operator-judged.",
    response:
      "Open Lifecycle, attempt one structured recovery touch. If silent again, close out with reason. Document in lead notes.",
    systemTruth:
      "No SLA timer or auto-close logic exists. Status changes are manual.",
    severity: "medium",
    surface: { label: "Lifecycle", tab: "lifecycle" },
  },
  {
    title: "Ghost lead (analysis exists, never verified)",
    trigger:
      "Lead has a `latest_analysis_id` but `phone_verified` is false and time has passed.",
    why:
      "Homeowner ran the scan but did not finish OTP. Common funnel drop-off.",
    response:
      "Use Ghost Recovery to attempt one outreach if appropriate. Otherwise, age it out without routing.",
    systemTruth:
      "Unverified leads must never be routed or have full report exposed.",
    severity: "high",
    surface: { label: "Ghost Recovery", tab: "ghosts" },
  },
  {
    title: "Recovered lead re-enters the pipeline",
    trigger:
      "A previously closed lead shows fresh activity (new scan or response).",
    why:
      "Homeowner re-engaged. The system does not auto-revive lead state.",
    response:
      "Re-open the lead in Active Pipeline, confirm verification status, and re-evaluate routing fit. Treat as a fresh decision.",
    systemTruth:
      "Lead status is whatever the operator last set it to.",
    severity: "low",
    surface: { label: "Active Pipeline", tab: "pipeline" },
  },
];

const REPORTING_SCENARIOS: Scenario[] = [
  {
    title: "External party asks for pilot performance numbers",
    trigger:
      "A stakeholder wants a quick read on lead volume, conversion, or contractor outcomes.",
    why:
      "Reporting is operator-curated. There is no real-time dashboard for external parties.",
    response:
      "Use Operator Reporting to assemble the snapshot. Run it past Report Prep before sharing externally.",
    systemTruth:
      "All shareable reporting passes through operator review today.",
    severity: "medium",
    surface: { label: "Reporting", tab: "reporting" },
  },
  {
    title: "Question about what is safe to share with a contractor",
    trigger:
      "Operator unsure whether a specific data point can be shared in contractor-facing reporting.",
    why:
      "Contractor-safe boundaries are not yet encoded. They live in Report Prep guidance and operator judgment.",
    response:
      "Open Report Prep. If a field is not explicitly listed as contractor-safe, do not include it. When in doubt, hold.",
    systemTruth:
      "No automated PII redaction layer exists. Operator decides.",
    severity: "high",
    surface: { label: "Report Prep", tab: "report-prep" },
  },
  {
    title: "Pilot learnings request for 'what is working'",
    trigger:
      "Need a current-state read on what the pilot is teaching.",
    why:
      "Pilot Learnings surface separates Confirmed / Observed / Uncertain so the operator does not overclaim.",
    response:
      "Open Pilot Learnings. Use the Confirmed section for external statements. Keep Observed/Uncertain internal.",
    systemTruth:
      "Learnings are derived from current `leads` data only. No predictive engine.",
    severity: "low",
    surface: { label: "Pilot Learnings", tab: "learnings" },
  },
];

interface ScenarioGroup {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  scenarios: Scenario[];
}

const GROUPS: ScenarioGroup[] = [
  {
    id: "routing",
    title: "Routing edge cases",
    description: "When it is unclear whether or how to route a lead.",
    icon: <Route className="h-5 w-5" />,
    scenarios: ROUTING_SCENARIOS,
  },
  {
    id: "ownership",
    title: "Ownership / release edge cases",
    description: "When verification, release, or surface ownership is ambiguous.",
    icon: <KeyRound className="h-5 w-5" />,
    scenarios: OWNERSHIP_SCENARIOS,
  },
  {
    id: "feedback",
    title: "Feedback / outcome edge cases",
    description: "When contractor feedback is missing, conflicting, or surprising.",
    icon: <MessageSquareWarning className="h-5 w-5" />,
    scenarios: FEEDBACK_SCENARIOS,
  },
  {
    id: "lifecycle",
    title: "Dead / stale / recovery edge cases",
    description: "When a lead is fading, ghosting, or re-engaging.",
    icon: <Hourglass className="h-5 w-5" />,
    scenarios: LIFECYCLE_SCENARIOS,
  },
  {
    id: "reporting",
    title: "Reporting / shareability edge cases",
    description: "When the question is what to share, with whom, and how.",
    icon: <FileText className="h-5 w-5" />,
    scenarios: REPORTING_SCENARIOS,
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

const SEVERITY_VARIANT: Record<Severity, "default" | "secondary" | "destructive"> =
  {
    low: "secondary",
    medium: "default",
    high: "destructive",
  };

function buildSnapshot(): string {
  const lines: string[] = [
    "WindowMan — Operator Scenario Drills (current-state)",
    "Read-only. No persistence. No simulation engine.",
    "",
  ];
  for (const group of GROUPS) {
    lines.push(group.title.toUpperCase());
    for (const s of group.scenarios) {
      lines.push(`  • [${s.severity}] ${s.title}`);
      lines.push(`      Trigger:  ${s.trigger}`);
      lines.push(`      Why:      ${s.why}`);
      lines.push(`      Response: ${s.response}`);
      lines.push(`      Truth:    ${s.systemTruth}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────
// Scenario item
// ─────────────────────────────────────────────────────────────────────────

function ScenarioItem({
  scenario,
  onNavigateTab,
}: {
  scenario: Scenario;
  onNavigateTab?: (tab: AdminTabKey) => void;
}) {
  return (
    <li className="rounded-md border bg-muted/30 p-4 text-sm space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="font-medium leading-snug">{scenario.title}</div>
        <Badge
          variant={SEVERITY_VARIANT[scenario.severity]}
          className="text-sm uppercase shrink-0"
        >
          {scenario.severity}
        </Badge>
      </div>

      <div className="grid gap-2 text-xs leading-relaxed">
        <div>
          <span className="font-semibold text-foreground">Trigger: </span>
          <span className="text-slate-700">{scenario.trigger}</span>
        </div>
        <div>
          <span className="font-semibold text-foreground">Why it happens: </span>
          <span className="text-slate-700">{scenario.why}</span>
        </div>
        <div>
          <span className="font-semibold text-foreground">Operator response: </span>
          <span className="text-slate-700">{scenario.response}</span>
        </div>
        <div>
          <span className="font-semibold text-foreground">Current system truth: </span>
          <span className="text-slate-700">{scenario.systemTruth}</span>
        </div>
      </div>

      {scenario.surface && onNavigateTab && (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs"
          onClick={() => onNavigateTab(scenario.surface!.tab)}
        >
          Go to {scenario.surface.label}
          <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      )}
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Main surface
// ─────────────────────────────────────────────────────────────────────────

export function OperatorScenarioDrillsSurface({ onNavigateTab }: Props) {
  const [copied, setCopied] = useState(false);
  const snapshot = useMemo(() => buildSnapshot(), []);
  const totalScenarios = useMemo(
    () => GROUPS.reduce((sum, g) => sum + g.scenarios.length, 0),
    [],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snapshot);
      setCopied(true);
      toast.success("Drill snapshot copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy snapshot");
    }
  };

  const quickLinks: Array<{ label: string; tab: AdminTabKey }> = [
    { label: "Operator Training / SOP", tab: "training" },
    { label: "Exceptions", tab: "exceptions" },
    { label: "Lifecycle", tab: "lifecycle" },
    { label: "Feedback Loop", tab: "feedback" },
    { label: "Shared Market", tab: "shared-market" },
    { label: "Launch Control", tab: "launch" },
    { label: "Documentation / Handoff", tab: "docs" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl">
                  Operator Scenario Drills / Manual Simulation Readiness
                </CardTitle>
                <CardDescription className="mt-1 max-w-2xl">
                  Rehearse realistic edge cases against current system truth.
                  Each scenario lists the trigger, why it happens, the
                  recommended manual response, and the live surface to use.
                  Read-only — no simulation engine, no persistence.
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="shrink-0"
            >
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy snapshot
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="py-1.5">
              {totalScenarios} scenarios
            </Badge>
            <Badge variant="outline" className="py-1.5">
              {GROUPS.length} categories
            </Badge>
            <Badge variant="secondary" className="py-1.5">
              <AlertTriangle className="mr-1.5 h-3 w-3" />
              All responses are manual today
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Scenario groups */}
      <Accordion
        type="multiple"
        defaultValue={["routing", "lifecycle"]}
        className="space-y-3"
      >
        {GROUPS.map((group) => (
          <AccordionItem
            key={group.id}
            value={group.id}
            id={group.id}
            className="border rounded-lg bg-card"
          >
            <AccordionTrigger className="px-4 hover:no-underline">
              <div className="flex items-center gap-3 text-left">
                <div className="text-slate-700">{group.icon}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{group.title}</span>
                    <Badge variant="outline" className="text-sm">
                      {group.scenarios.length}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-700 mt-0.5 font-normal">
                    {group.description}
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <ul className="space-y-3">
                {group.scenarios.map((scenario, idx) => (
                  <ScenarioItem
                    key={idx}
                    scenario={scenario}
                    onNavigateTab={onNavigateTab}
                  />
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Quick links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Supporting surfaces</CardTitle>
          <CardDescription>
            Live surfaces used to resolve these scenarios.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Separator className="mb-4" />
          <div className="flex flex-wrap gap-2">
            {quickLinks.map((link) => (
              <Button
                key={link.tab}
                variant="outline"
                size="sm"
                onClick={() => onNavigateTab?.(link.tab)}
              >
                {link.label}
                <ArrowRight className="ml-1.5 h-3 w-3" />
              </Button>
            ))}
          </div>
          <p className="text-sm text-slate-700 mt-4 leading-relaxed">
            This surface is read-only operator preparation. It does not run
            simulations, persist drill results, or trigger backend actions.
            All scenarios reflect current repo-real workflows.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
