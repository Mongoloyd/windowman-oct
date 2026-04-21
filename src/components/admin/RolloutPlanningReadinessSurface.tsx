/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Rollout Planning / Execution Readiness — Phase 22
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Internal-only operator surface for thinking through rollout readiness.
 * Honest, current-state only. No PM backend. No persistence. No automation.
 *
 * Local-only checklist state — resets on reload by design.
 */

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  Circle,
  Copy,
  ExternalLink,
  Info,
  Map,
  Rocket,
  ShieldAlert,
  UserPlus,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

interface RolloutPlanningReadinessSurfaceProps {
  onNavigateTab?: (tab: string) => void;
}

interface ChecklistItem {
  id: string;
  label: string;
  detail: string;
}

interface ChecklistBlock {
  id: string;
  title: string;
  intent: string;
  icon: typeof Rocket;
  tone: "ready" | "manual" | "expansion" | "gap";
  jumpToTab?: { tab: string; label: string };
  items: ChecklistItem[];
}

const READY_NOW: ChecklistItem[] = [
  {
    id: "ready-1",
    label: "Single-contractor routing operational",
    detail: "Lead → dossier → manual route flow works end-to-end today.",
  },
  {
    id: "ready-2",
    label: "Outcome capture is usable",
    detail: "Booked / replacement-quote / closed states can be recorded by the operator.",
  },
  {
    id: "ready-3",
    label: "Lifecycle review is supported",
    detail: "Stale / dead / recovery decisions have a dedicated surface.",
  },
  {
    id: "ready-4",
    label: "Reporting + export available",
    detail: "Operator Reporting and contractor-safe Report Prep both exist.",
  },
  {
    id: "ready-5",
    label: "Health check + audit visibility",
    detail: "Launch Readiness and Pilot-to-Platform Audit give an honest current-state read.",
  },
];

const PILOT_ONLY: ChecklistItem[] = [
  {
    id: "manual-1",
    label: "Routing is operator-picked",
    detail: "No round-robin, no fairness engine. Each route is a manual decision.",
  },
  {
    id: "manual-2",
    label: "Release is operator-approved",
    detail: "Contact release happens deliberately, not automatically.",
  },
  {
    id: "manual-3",
    label: "Shared-market controls are manual",
    detail: "Shared-market visibility exists, but there is no allocation automation.",
  },
  {
    id: "manual-4",
    label: "Recovery touches are manual",
    detail: "No automated nurture sequence — operator initiates each touch.",
  },
  {
    id: "manual-5",
    label: "Contractor reporting is operator-prepared",
    detail: "Report Prep is internal — there is no contractor portal yet.",
  },
];

const ADD_CONTRACTOR_PREREQS: ChecklistItem[] = [
  {
    id: "addc-1",
    label: "Contractor profile defined in Onboarding",
    detail: "Company name, contact, county coverage, project types, capacity bands.",
  },
  {
    id: "addc-2",
    label: "Routing fit confirmed",
    detail: "Operator can clearly choose this contractor for specific lead profiles.",
  },
  {
    id: "addc-3",
    label: "Conversation script aligned to current state",
    detail: "Contractor briefed: operator-curated, no automation, current-state reporting only.",
  },
  {
    id: "addc-4",
    label: "Outcome capture cadence agreed",
    detail: "Contractor knows what to report back (appointment, replacement quote, closed).",
  },
  {
    id: "addc-5",
    label: "Operator capacity verified",
    detail: "Operator can realistically triage and route the new contractor's volume.",
  },
];

const ADD_MARKET_PREREQS: ChecklistItem[] = [
  {
    id: "addm-1",
    label: "County observed in current data",
    detail: "Or explicit operator decision to begin accepting leads from the new county.",
  },
  {
    id: "addm-2",
    label: "At least one contractor covering the county",
    detail: "No new market without a real, prepared contractor to receive its leads.",
  },
  {
    id: "addm-3",
    label: "Market expectations documented",
    detail: "Volume assumptions, project-type mix, and pricing posture noted internally.",
  },
  {
    id: "addm-4",
    label: "Reporting can isolate the new market",
    detail: "Operator can filter / view the new county in reporting without confusion.",
  },
];

const CURRENT_GAPS: ChecklistItem[] = [
  {
    id: "gap-1",
    label: "No contractor self-serve portal",
    detail: "Contractors do not log in. All visibility is operator-mediated today.",
  },
  {
    id: "gap-2",
    label: "No automated routing / fairness logic",
    detail: "No round-robin, territory enforcement, or seat-based allocation.",
  },
  {
    id: "gap-3",
    label: "No billing / Stripe integration",
    detail: "No paid seats, no per-lead invoicing, no subscription enforcement.",
  },
  {
    id: "gap-4",
    label: "No automated reporting publication",
    detail: "Contractor-facing reports are not auto-sent. Sharing is operator-driven.",
  },
  {
    id: "gap-5",
    label: "No predictive scoring or ROI analytics",
    detail: "Reporting is current-state only. No forecasts, no contractor grading.",
  },
];

const BLOCKS: ChecklistBlock[] = [
  {
    id: "ready-now",
    title: "Ready Now",
    intent: "Capabilities you can use immediately for broader rollout.",
    icon: Rocket,
    tone: "ready",
    jumpToTab: { tab: "audit", label: "Open Audit" },
    items: READY_NOW,
  },
  {
    id: "pilot-only",
    title: "Pilot-Only / Manual",
    intent: "Works today, but every action is operator-driven. Plan for that workload.",
    icon: Wrench,
    tone: "manual",
    jumpToTab: { tab: "training", label: "Open Training / SOP" },
    items: PILOT_ONLY,
  },
  {
    id: "add-contractor",
    title: "Adding Another Contractor — Prerequisites",
    intent: "What must be true before bringing a second (or third) contractor online.",
    icon: UserPlus,
    tone: "expansion",
    jumpToTab: { tab: "onboarding", label: "Open Onboarding" },
    items: ADD_CONTRACTOR_PREREQS,
  },
  {
    id: "add-market",
    title: "Adding Another Market — Prerequisites",
    intent: "What must be true before opening a new county or region.",
    icon: Map,
    tone: "expansion",
    jumpToTab: { tab: "shared-market", label: "Open Shared Market" },
    items: ADD_MARKET_PREREQS,
  },
  {
    id: "gaps",
    title: "Current Gaps / Not Yet Built",
    intent: "Be honest about what doesn't exist yet so contractors are never overpromised.",
    icon: ShieldAlert,
    tone: "gap",
    jumpToTab: { tab: "audit", label: "Review in Audit" },
    items: CURRENT_GAPS,
  },
];

const SUMMARY_SNIPPET = `WindowMan Rollout Readiness — Current State

Ready Now:
${READY_NOW.map((i) => `- ${i.label}`).join("\n")}

Still Manual / Pilot-Only:
${PILOT_ONLY.map((i) => `- ${i.label}`).join("\n")}

Before adding another contractor:
${ADD_CONTRACTOR_PREREQS.map((i) => `- ${i.label}`).join("\n")}

Before adding another market:
${ADD_MARKET_PREREQS.map((i) => `- ${i.label}`).join("\n")}

Known gaps (do not promise these):
${CURRENT_GAPS.map((i) => `- ${i.label}`).join("\n")}
`;

const TONE_STYLES: Record<ChecklistBlock["tone"], { badge: string; iconWrap: string }> = {
  ready: {
    badge: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    iconWrap: "bg-emerald-500/10 text-emerald-600",
  },
  manual: {
    badge: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    iconWrap: "bg-amber-500/10 text-amber-600",
  },
  expansion: {
    badge: "bg-primary/10 text-primary border-primary/30",
    iconWrap: "bg-primary/10 text-primary",
  },
  gap: {
    badge: "bg-destructive/10 text-destructive border-destructive/30",
    iconWrap: "bg-destructive/10 text-destructive",
  },
};

export function RolloutPlanningReadinessSurface({
  onNavigateTab,
}: RolloutPlanningReadinessSurfaceProps) {
  // Local-only — resets on reload. Not persisted.
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const totals = useMemo(() => {
    const all = BLOCKS.flatMap((b) => b.items.map((i) => i.id));
    const done = all.filter((id) => checked[id]).length;
    return { done, total: all.length };
  }, [checked]);

  const toggle = (id: string) =>
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(SUMMARY_SNIPPET);
      toast.success("Rollout summary copied", {
        description: "Paste into internal notes or planning doc.",
      });
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-primary/10 p-2">
                <Rocket className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">
                  Rollout Planning & Execution Readiness
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                  Internal view of what is ready to scale, what is still manual,
                  and what must be true before expanding to more contractors or
                  markets. Honest, current-state only.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              Internal · Read-only
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-muted-foreground">
              Local progress:{" "}
              <span className="font-medium text-foreground">
                {totals.done} / {totals.total}
              </span>{" "}
              items reviewed. Resets on reload — nothing saved server-side.
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={copySummary}
              className="gap-2"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy rollout summary
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Disclosure */}
      <Card className="border-amber-500/30 bg-amber-500/[0.03]">
        <CardContent className="pt-5 pb-5">
          <div className="flex gap-3">
            <Info className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="text-sm text-foreground/90 space-y-1">
              <p className="font-medium">What this surface is — and isn't</p>
              <p className="text-muted-foreground">
                This is operator planning guidance, not a project tracker.
                Nothing here represents automated rollout, sprint workflow, or
                guaranteed expansion success. All checklist state is in-memory
                only.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Blocks */}
      {BLOCKS.map((block) => {
        const Icon = block.icon;
        const tone = TONE_STYLES[block.tone];
        const blockDone = block.items.filter((i) => checked[i.id]).length;
        return (
          <Card key={block.id} id={`rollout-${block.id}`}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                  <div className={`rounded-md p-2 ${tone.iconWrap}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{block.title}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {block.intent}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`font-mono text-xs ${tone.badge}`}
                  >
                    {blockDone}/{block.items.length}
                  </Badge>
                  {block.jumpToTab && onNavigateTab && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => onNavigateTab(block.jumpToTab!.tab)}
                    >
                      <ExternalLink className="h-3 w-3" />
                      {block.jumpToTab.label}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5">
                {block.items.map((item) => {
                  const done = !!checked[item.id];
                  return (
                    <li
                      key={item.id}
                      className="flex items-start gap-3 rounded-md border border-border/60 p-3 hover:bg-muted/40 transition-colors"
                    >
                      <button
                        onClick={() => toggle(item.id)}
                        className="mt-0.5 shrink-0"
                        aria-label={done ? "Mark unreviewed" : "Mark reviewed"}
                      >
                        {done ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-sm font-medium ${
                            done
                              ? "text-muted-foreground line-through"
                              : "text-foreground"
                          }`}
                        >
                          {item.label}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                          {item.detail}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        );
      })}

      {/* Quick links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Links</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Jump to the live admin surfaces that back this planning view.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { tab: "audit", label: "Pilot-to-Platform Audit" },
              { tab: "readiness", label: "Health Check" },
              { tab: "training", label: "Training / SOP" },
              { tab: "onboarding", label: "Onboarding" },
              { tab: "shared-market", label: "Shared Market" },
              { tab: "reporting", label: "Reporting" },
              { tab: "report-prep", label: "Report Prep" },
              { tab: "outcomes", label: "Outcomes" },
              { tab: "lifecycle", label: "Lifecycle" },
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

      <p className="text-xs text-muted-foreground text-center">
        Rollout content reflects current system behavior only. Update this
        surface when real expansion capability ships.
      </p>
    </div>
  );
}
