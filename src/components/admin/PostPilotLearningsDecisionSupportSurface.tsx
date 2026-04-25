/**
 * ═══════════════════════════════════════════════════════════════════════════
 * POST-PILOT LEARNINGS / DECISION SUPPORT — Phase 26
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Internal operator decision-support surface. Reviews what the current pilot
 * is honestly showing, separating:
 *
 *   • Confirmed   — clearly backed by repo-real operational visibility today
 *   • Observed    — visible pattern in current surfaces, still operationally
 *                   contextual / operator-mediated
 *   • Uncertain   — not fully modeled / not yet proven / still operator-
 *                   dependent and should not be overclaimed
 *
 * NOT a forecasting engine, NOT an analytics backend, NOT an AI recommender.
 * All classifications are deterministic functions of the current `leads`
 * array (and repo-real timestamps / flags) at render time. No persistence.
 */

import { useMemo, useState } from "react";
import {
  Lightbulb,
  CheckCircle2,
  Eye,
  HelpCircle,
  ArrowUpRight,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { CRMLead } from "@/components/admin/types";

interface PostPilotLearningsDecisionSupportSurfaceProps {
  leads: CRMLead[];
  onNavigateTab?: (tab: string) => void;
}

type Confidence = "confirmed" | "observed" | "uncertain";

interface Learning {
  id: string;
  label: string;
  detail: string;
  evidence: string; // human-readable reference to repo-real signal
  confidence: Confidence;
  jumpTab?: string;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Deterministic metric extraction from repo-real lead fields.
 * No inference, no smoothing — just current counts at render time.
 * ────────────────────────────────────────────────────────────────────────── */
function computeMetrics(leads: CRMLead[]) {
  const total = leads.length;
  let verified = 0;
  let routed = 0;
  let booked = 0;
  let closed = 0;
  let withCounty = 0;
  let withGrade = 0;
  let staleRouted = 0; // routed > 21d ago, no booking/close
  let unverifiedAnalyses = 0; // analysis present but phone not verified
  let withQuoteAmount = 0;

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  for (const l of leads) {
    const anyL = l as unknown as Record<string, unknown>;

    if (anyL.phone_verified === true) verified++;
    if (anyL.routed_to_contractor_at) routed++;
    if (anyL.appointment_booked_at) booked++;
    if (anyL.closed_at) closed++;
    if (anyL.county && String(anyL.county).trim().length > 0) withCounty++;
    if (anyL.grade && String(anyL.grade).trim().length > 0) withGrade++;
    if (anyL.quote_amount != null) withQuoteAmount++;

    if (anyL.latest_analysis_id && anyL.phone_verified !== true) {
      unverifiedAnalyses++;
    }

    if (anyL.routed_to_contractor_at && !anyL.appointment_booked_at && !anyL.closed_at) {
      const t = new Date(String(anyL.routed_to_contractor_at)).getTime();
      if (Number.isFinite(t) && now - t > 21 * DAY) staleRouted++;
    }
  }

  return {
    total,
    verified,
    routed,
    booked,
    closed,
    withCounty,
    withGrade,
    staleRouted,
    unverifiedAnalyses,
    withQuoteAmount,
    pctCounty: total > 0 ? Math.round((withCounty / total) * 100) : 0,
    pctVerified: total > 0 ? Math.round((verified / total) * 100) : 0,
    pctGrade: total > 0 ? Math.round((withGrade / total) * 100) : 0,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Build deterministic learnings from current metrics.
 * Classification rules (documented):
 *   • Confirmed = the system surface and its data are live, repo-real, and
 *     consistently populated for the relevant volume.
 *   • Observed  = pattern visible from current data, but still depends on
 *     operator interpretation / manual capture.
 *   • Uncertain = not fully proven by current pilot data; sample too small,
 *     manual-only, or capability not yet built.
 * ────────────────────────────────────────────────────────────────────────── */
function buildConfirmed(m: ReturnType<typeof computeMetrics>): Learning[] {
  const out: Learning[] = [];

  out.push({
    id: "scanner-otp-pipeline",
    label: "Scanner → OTP gate → Truth Report pipeline is live",
    detail:
      "Public funnel produces analyses and the SMS OTP gates the full report. This is enforced server-side and protected.",
    evidence: "Repo-real protected systems (send-otp / verify-otp / scan-quote).",
    confidence: "confirmed",
  });

  out.push({
    id: "single-contractor-mode",
    label: "Single-contractor pilot mode works end-to-end",
    detail:
      "Operator can ingest a lead, route it to one contractor, capture an outcome, and review reporting in-app today.",
    evidence: "Routing Desk + Outcome Tracking + Operator Reporting are all live.",
    confidence: "confirmed",
    jumpTab: "routing",
  });

  out.push({
    id: "operator-export",
    label: "Operator-triggered export is reliable",
    detail:
      "Composed reads + plain-text/CSV export are working without a reporting backend. Good enough for pilot-stage handoff.",
    evidence: "Operator Reporting / Export Layer.",
    confidence: "confirmed",
    jumpTab: "reporting",
  });

  if (m.total >= 5 && m.pctVerified >= 50) {
    out.push({
      id: "verified-share",
      label: `OTP verification reaches a meaningful share of leads (${m.pctVerified}% of ${m.total})`,
      detail:
        "Verified-lead conversion is observable in current data and the gate is functioning as intended.",
      evidence: "leads.phone_verified across current pilot volume.",
      confidence: "confirmed",
      jumpTab: "command",
    });
  }

  return out;
}

function buildObserved(m: ReturnType<typeof computeMetrics>): Learning[] {
  const out: Learning[] = [];

  if (m.unverifiedAnalyses > 0) {
    out.push({
      id: "ghost-volume",
      label: `Ghost (unverified-analysis) recovery candidates exist (${m.unverifiedAnalyses})`,
      detail:
        "Some leads complete analysis but never verify by SMS. Recovery is operator-judged today, not automated.",
      evidence: "leads with latest_analysis_id and phone_verified=false.",
      confidence: "observed",
      jumpTab: "ghosts",
    });
  }

  if (m.staleRouted > 0) {
    out.push({
      id: "stale-routed",
      label: `Routed-but-no-progress leads accumulate (${m.staleRouted} >21d)`,
      detail:
        "Once routed, some opportunities sit without booking or close. This is the highest-leverage place to add operator follow-up cadence.",
      evidence: "routed_to_contractor_at older than 21 days with no appointment_booked_at / closed_at.",
      confidence: "observed",
      jumpTab: "lifecycle",
    });
  }

  out.push({
    id: "outcome-capture-manual",
    label: "Outcome capture (booked / quoted / closed) is operator-typed",
    detail:
      "Contractor reports verbally or by message; the operator records in the app. Reliable for one contractor, fragile for many.",
    evidence: "Outcome Tracking depends on appointment_booked_at / closed_at being entered manually.",
    confidence: "observed",
    jumpTab: "outcomes",
  });

  if (m.pctCounty < 80 && m.total > 0) {
    out.push({
      id: "county-coverage",
      label: `County coverage is partial (${m.pctCounty}% of leads)`,
      detail:
        "Operator-view shows 'Unknown County' fallbacks when the field is missing. Geo-routing is therefore operator-judged in those cases.",
      evidence: "leads.county presence vs total leads.",
      confidence: "observed",
      jumpTab: "data-quality",
    });
  }

  out.push({
    id: "release-flow-manual",
    label: "Contact release is fully operator-controlled",
    detail:
      "There is no auto-release. Operator approves each release in Routing Desk. Works at pilot scale; needs structure before adding contractors.",
    evidence: "Routing Desk release_status workflow.",
    confidence: "observed",
    jumpTab: "routing",
  });

  return out;
}

function buildUncertain(m: ReturnType<typeof computeMetrics>): Learning[] {
  const out: Learning[] = [];

  if (m.closed > 0) {
    out.push({
      id: "close-rate-unproven",
      label: `True close rate cannot be claimed yet (${m.closed} closes recorded)`,
      detail:
        "Closes are recorded but the sample is too small and operator-mediated to claim a stable conversion rate. Use as directional only.",
      evidence: "leads.closed_at counts.",
      confidence: "uncertain",
    });
  } else {
    out.push({
      id: "close-rate-zero",
      label: "True close rate is not yet measurable",
      detail:
        "No or near-zero closed_at signals in current data. Do not claim a close-rate to contractors or in marketing.",
      evidence: "leads.closed_at empty in current pilot data.",
      confidence: "uncertain",
    });
  }

  out.push({
    id: "shared-market-fairness",
    label: "Shared-market fairness is not proven",
    detail:
      "Multi-contractor routing fairness, rotation, and dispute handling are all manual. Behavior under multiple contractors is untested at scale.",
    evidence: "Shared Market Manual Controls is operator-only; no fairness engine exists.",
    confidence: "uncertain",
    jumpTab: "shared-market",
  });

  out.push({
    id: "billing-not-live",
    label: "Billing / monetization is not live in the operator surfaces",
    detail:
      "Stripe credit infrastructure exists in the codebase, but billing flow is not active in the pilot. Do not claim live monetization.",
    evidence: "No billing workflow surfaced in admin operator path today.",
    confidence: "uncertain",
  });

  out.push({
    id: "contractor-portal-absent",
    label: "Contractor self-serve portal is not built",
    detail:
      "All contractor interaction is operator-mediated. Any claim of contractor self-service is premature.",
    evidence: "No contractor portal route is part of the active operator stack.",
    confidence: "uncertain",
  });

  out.push({
    id: "predictive-routing",
    label: "Automated / predictive routing is not built",
    detail:
      "Routing is fully manual. Suggested-match snapshots exist as hints only and are not authoritative.",
    evidence: "Routing Desk has no auto-router; suggested_match_* fields are advisory.",
    confidence: "uncertain",
  });

  return out;
}

/* ──────────────────────────────────────────────────────────────────────────
 * "Ready to improve next" — deterministic suggestions tied to observed data.
 * NOT a roadmap engine. Each item links to where the operator already works.
 * ────────────────────────────────────────────────────────────────────────── */
function buildNextImprovements(m: ReturnType<typeof computeMetrics>) {
  const out: Array<{ id: string; label: string; detail: string; jumpTab?: string }> = [];

  if (m.staleRouted > 0) {
    out.push({
      id: "tighten-stale",
      label: "Tighten stale-routed follow-up cadence",
      detail:
        "Routed leads >21d with no booking are the clearest leakage. Use Dead / Stale / Recovery to triage them weekly.",
      jumpTab: "lifecycle",
    });
  }

  if (m.unverifiedAnalyses > 0) {
    out.push({
      id: "ghost-recovery",
      label: "Run a recurring ghost-recovery sweep",
      detail:
        "Unverified analyses are intent signals. A weekly sweep in Ghost Recovery captures them before they decay.",
      jumpTab: "ghosts",
    });
  }

  if (m.pctCounty < 80 && m.total > 0) {
    out.push({
      id: "geo-tightening",
      label: "Improve county capture at intake",
      detail:
        "Sub-80% county coverage forces operator-judged geo-routing. Tighten intake or fallback labels in Data Quality.",
      jumpTab: "data-quality",
    });
  }

  out.push({
    id: "outcome-discipline",
    label: "Lock in a daily outcome-capture rhythm",
    detail:
      "Outcome reliability is the single biggest determinant of trustworthy reporting. Make it a daily operator ritual.",
    jumpTab: "outcomes",
  });

  out.push({
    id: "exception-review",
    label: "Run the Exception Handling sweep before each contractor sync",
    detail:
      "Reviewing ambiguous records before contractor conversations keeps handoffs clean.",
    jumpTab: "exceptions",
  });

  out.push({
    id: "rollout-prereqs",
    label: "Re-check Rollout Planning before adding any new contractor",
    detail:
      "Rollout Planning lists current vs future state. Use it as the gating doc before expanding scope.",
    jumpTab: "rollout",
  });

  return out;
}

const DO_NOT_OVERCLAIM = [
  "Do not claim automated routing or fairness — routing is fully operator-controlled.",
  "Do not claim a stable close rate — sample is too small and outcomes are operator-typed.",
  "Do not claim contractor self-service — there is no contractor-facing portal yet.",
  "Do not claim live billing — Stripe infrastructure exists in code but is not active in the pilot operator path.",
  "Do not claim predictive scoring — suggested matches are hints only, never authoritative.",
  "Do not claim multi-market readiness — shared-market behavior is manual and unproven at scale.",
];

const QUICK_LINKS: Array<{ tab: string; label: string }> = [
  { tab: "audit", label: "Pilot-to-Platform Audit" },
  { tab: "readiness", label: "Launch Readiness / Health Check" },
  { tab: "reporting", label: "Operator Reporting / Export" },
  { tab: "outcomes", label: "Outcome Tracking" },
  { tab: "feedback", label: "Contractor Feedback Loop" },
  { tab: "data-quality", label: "Data Quality / Field Integrity" },
  { tab: "exceptions", label: "Exception Handling" },
  { tab: "lifecycle", label: "Dead / Stale / Recovery" },
  { tab: "rollout", label: "Rollout Planning / Readiness" },
];

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  if (confidence === "confirmed") {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-950 border-emerald-500/30 hover:bg-emerald-500/15">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Confirmed
      </Badge>
    );
  }
  if (confidence === "observed") {
    return (
      <Badge className="bg-sky-500/10 text-sky-950 border-sky-500/30 hover:bg-sky-500/15">
        <Eye className="h-3 w-3 mr-1" />
        Observed
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-500/10 text-amber-950 border-amber-500/30 hover:bg-amber-500/15">
      <HelpCircle className="h-3 w-3 mr-1" />
      Uncertain
    </Badge>
  );
}

export function PostPilotLearningsDecisionSupportSurface({
  leads,
  onNavigateTab,
}: PostPilotLearningsDecisionSupportSurfaceProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState<Record<string, boolean>>({
    confirmed: true,
    observed: true,
    uncertain: true,
    next: true,
    overclaim: false,
  });

  const metrics = useMemo(() => computeMetrics(leads), [leads]);
  const confirmed = useMemo(() => buildConfirmed(metrics), [metrics]);
  const observed = useMemo(() => buildObserved(metrics), [metrics]);
  const uncertain = useMemo(() => buildUncertain(metrics), [metrics]);
  const nextUp = useMemo(() => buildNextImprovements(metrics), [metrics]);

  const toggle = (id: string) => setOpen((p) => ({ ...p, [id]: !p[id] }));

  const copySummary = async () => {
    const lines: string[] = [];
    lines.push("WindowMan Mission Control — Post-Pilot Learnings Snapshot");
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(
      `Pilot signal: ${metrics.total} leads · ${metrics.verified} verified · ${metrics.routed} routed · ${metrics.booked} booked · ${metrics.closed} closed`,
    );
    lines.push(
      `Coverage: county ${metrics.pctCounty}% · grade ${metrics.pctGrade}% · verified ${metrics.pctVerified}%`,
    );
    lines.push("");
    lines.push("## Confirmed");
    confirmed.forEach((l) => lines.push(`- ${l.label} — ${l.detail}`));
    lines.push("");
    lines.push("## Observed");
    observed.forEach((l) => lines.push(`- ${l.label} — ${l.detail}`));
    lines.push("");
    lines.push("## Uncertain / not yet proven");
    uncertain.forEach((l) => lines.push(`- ${l.label} — ${l.detail}`));
    lines.push("");
    lines.push("## Ready to improve next");
    nextUp.forEach((n) => lines.push(`- ${n.label} — ${n.detail}`));
    lines.push("");
    lines.push("## Do not overclaim");
    DO_NOT_OVERCLAIM.forEach((n) => lines.push(`- ${n}`));

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast({
        title: "Learnings snapshot copied",
        description: "Plain-text decision-support summary on clipboard.",
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
              <Lightbulb className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-semibold tracking-tight">
                Post-Pilot Learnings / Decision Support
              </h2>
              <p className="text-sm text-slate-700 mt-1 max-w-2xl">
                Honest, current-state read of what the pilot is showing today. Separates what is{" "}
                <span className="font-medium">Confirmed</span>, what is{" "}
                <span className="font-medium">Observed</span>, and what is{" "}
                <span className="font-medium">Uncertain</span>. No analytics backend, no
                recommendation engine — just deterministic operator decision support.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={copySummary} className="gap-1.5">
              <Copy className="h-3.5 w-3.5" />
              Copy snapshot
            </Button>
          </div>
        </div>

        {/* Pilot signal chips */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <SignalChip label="Leads" value={metrics.total} />
          <SignalChip label="Verified" value={metrics.verified} sub={`${metrics.pctVerified}%`} />
          <SignalChip label="Routed" value={metrics.routed} />
          <SignalChip label="Booked" value={metrics.booked} />
          <SignalChip label="Closed" value={metrics.closed} />
        </div>
      </div>

      {/* Confirmed */}
      <Section
        id="confirmed"
        title="Confirmed learnings"
        intent="Backed by repo-real operational visibility today. Safe to act on."
        icon={CheckCircle2}
        open={open.confirmed}
        onToggle={toggle}
      >
        <LearningList items={confirmed} onNavigateTab={onNavigateTab} />
      </Section>

      {/* Observed */}
      <Section
        id="observed"
        title="Observed friction / weak spots"
        intent="Patterns visible in current surfaces, but still operator-mediated. Treat as directional."
        icon={Eye}
        open={open.observed}
        onToggle={toggle}
      >
        {observed.length === 0 ? (
          <p className="text-sm text-slate-700">
            No observed friction patterns in the current data window.
          </p>
        ) : (
          <LearningList items={observed} onNavigateTab={onNavigateTab} />
        )}
      </Section>

      {/* Uncertain */}
      <Section
        id="uncertain"
        title="Uncertain / not yet proven"
        intent="Do not claim externally. Sample is small, manual, or capability is not built."
        icon={HelpCircle}
        open={open.uncertain}
        onToggle={toggle}
      >
        <LearningList items={uncertain} onNavigateTab={onNavigateTab} />
      </Section>

      {/* Ready to improve next */}
      <Section
        id="next"
        title="Ready to improve next"
        intent="Highest-leverage operator improvements derived from current data. Each links to the surface where the work happens."
        icon={TrendingUp}
        open={open.next}
        onToggle={toggle}
      >
        <div className="space-y-2">
          {nextUp.map((n) => (
            <div
              key={n.id}
              className="rounded-lg border bg-background px-3 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium flex items-center gap-1.5">
                  <ArrowUpRight className="h-3.5 w-3.5 text-primary" />
                  {n.label}
                </div>
                <div className="text-xs text-slate-700 mt-0.5">{n.detail}</div>
              </div>
              {n.jumpTab && onNavigateTab && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onNavigateTab(n.jumpTab!)}
                  className="gap-1.5 text-xs shrink-0"
                >
                  Open
                  <ExternalLink className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* Do not overclaim */}
      <Section
        id="overclaim"
        title="What should not be overclaimed"
        intent="Language guardrails for contractor conversations, marketing, and collaborator handoffs."
        icon={ShieldAlert}
        open={open.overclaim}
        onToggle={toggle}
      >
        <ul className="space-y-1.5 text-sm">
          {DO_NOT_OVERCLAIM.map((n, i) => (
            <li key={i} className="flex items-start gap-2 text-slate-700">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-950 mt-0.5 shrink-0" />
              <span>{n}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Quick links */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="font-semibold text-sm">Supporting audit & reporting surfaces</h3>
        <p className="text-xs text-slate-700 mt-0.5">
          Jump to the surfaces these learnings come from.
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

/* ── Local subcomponents ─────────────────────────────────────────────── */

function SignalChip({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
      <div className="text-sm uppercase tracking-wide text-slate-700 font-semibold">
        {label}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <div className="text-xl font-semibold tabular-nums">{value}</div>
        {sub && <div className="text-xs text-slate-700">{sub}</div>}
      </div>
    </div>
  );
}

function LearningList({
  items,
  onNavigateTab,
}: {
  items: Learning[];
  onNavigateTab?: (tab: string) => void;
}) {
  return (
    <div className="space-y-2">
      {items.map((l) => (
        <div
          key={l.id}
          className="rounded-lg border bg-background px-3 py-2.5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <ConfidenceBadge confidence={l.confidence} />
              <div className="text-sm font-medium">{l.label}</div>
            </div>
            <div className="text-xs text-slate-700 mt-1">{l.detail}</div>
            <div className="text-sm text-slate-700/80 mt-1 italic">
              Evidence: {l.evidence}
            </div>
          </div>
          {l.jumpTab && onNavigateTab && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onNavigateTab(l.jumpTab!)}
              className="gap-1.5 text-xs shrink-0"
            >
              Open
              <ExternalLink className="h-3 w-3" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

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
  icon: typeof Lightbulb;
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
