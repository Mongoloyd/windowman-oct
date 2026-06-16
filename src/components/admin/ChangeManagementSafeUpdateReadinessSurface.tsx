/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CHANGE MANAGEMENT / SAFE UPDATE READINESS — Phase 27
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Internal change-readiness surface. Helps operators and collaborators
 * understand which parts of the system are safe to tweak vs which require
 * care, based on repo-real boundaries already enforced in earlier phases.
 *
 * Classification (deterministic, hardcoded from repo truth):
 *   • Protected — explicitly no-touch (OTP, scanner, tracking, report gating,
 *     public funnel). Never modify casually.
 *   • Sensitive — admin surfaces or shared utilities whose behavior affects
 *     core routing, ownership, or reporting integrity.
 *   • UI-Only   — admin/operator surfaces whose changes are limited to layout,
 *     copy, ordering, or local-only convenience.
 *   • Read-Only — surfaces that compose existing data without mutation
 *     (audits, reporting prep, learnings, docs).
 *
 * NOT a deployment tool, NOT a feature-flag platform, NOT a risk engine.
 * No persistence, no backend.
 */

import { useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Wrench,
  Eye,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  ListChecks,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  adminSurfaceLabelBadgeClass,
  getAdminSurfaceLabel,
} from "@/routes/adminDashboardTabs";

type ChangeClass = "protected" | "sensitive" | "ui-only" | "read-only";

interface AreaEntry {
  label: string;
  detail: string;
  /** Optional jump target if it maps to an admin tab. */
  tab?: string;
}

interface ChangeManagementSafeUpdateReadinessSurfaceProps {
  onNavigateTab?: (tab: string) => void;
}

/* ── Protected (never modify casually) ───────────────────────────────── */
const PROTECTED_AREAS: AreaEntry[] = [
  {
    label: "send-otp / verify-otp Edge Functions",
    detail:
      "Twilio Verify integration. Backend-enforced OTP gate for the full report. Do not modify, replace, or wrap with frontend-only logic.",
  },
  {
    label: "Scanner funnel (scan-quote, extraction, scoring)",
    detail:
      "AI extracts; deterministic TypeScript scores. The scanner pipeline and grading engine are off-limits for ad-hoc changes.",
  },
  {
    label: "Preview vs Full report gating",
    detail:
      "Full report is server-gated by phone_verified state. Never bypass with CSS hiding, hidden DOM, or client-only conditionals.",
  },
  {
    label: "Tracking / Meta CAPI bridge",
    detail:
      "Two-lane tracking (dataLayer + capi-event). High-value events fire server-side with deterministic event_id. Do not alter casually.",
  },
  {
    label: "Public funnel flows & routes",
    detail:
      "Acquisition page, Truth Gate, scanner reveal sequence. Outside the scope of admin/operator phases.",
  },
  {
    label: "RLS policies & auth.users / public.profiles trigger",
    detail:
      "Row-level security and the profile auto-create trigger are core integrity. Do not weaken for convenience.",
  },
  {
    label: "Private quote storage + signed URLs",
    detail:
      "Quote files live in private buckets. Access only through server-issued signed URLs.",
  },
];

/* ── Sensitive (admin, but plumbing-adjacent) ────────────────────────── */
const SENSITIVE_AREAS: AreaEntry[] = [
  {
    label: "Routing Desk",
    detail:
      "Manual routing decisions write to contractor_opportunity_routes and drive contractor handoff. Changes here can affect ownership integrity.",
    tab: "routing",
  },
  {
    label: "Outcome Tracking",
    detail:
      "Booked/closed/quote timestamps are the basis of all reporting. Schema or write-path changes ripple into every downstream surface.",
    tab: "outcomes",
  },
  {
    label: "Contractor Accounts + credit ledger",
    detail:
      "Touches contractor identity, credits, and (future) billing surfaces. Treat as plumbing-adjacent.",
    tab: "contractors",
  },
  {
    label: "Dialer Desk (Internal CRM)",
    detail:
      "Voice followup context and operator status changes. Mutations here affect lead state and downstream events.",
    tab: "engine",
  },
  {
    label: "Active Pipeline + Lead Dossier",
    detail:
      "Composes verified-lead state across many tables. Layout changes are safe; data-shape assumptions are not.",
    tab: "pipeline",
  },
  {
    label: "adminDataService / shared admin types",
    detail:
      "Centralized fetchers and CRMLead shape are consumed by many surfaces. A breaking change here breaks many tabs at once.",
  },
];

/* ── UI-only (safer to iterate) ──────────────────────────────────────── */
const UI_ONLY_AREAS: AreaEntry[] = [
  {
    label: "Pilot Ops / Launch Control",
    detail: "Composed dashboard view. Layout, copy, and ordering tweaks are low risk.",
    tab: "launch",
  },
  {
    label: "Command Center + Market Ops Feed",
    detail: "Read-side composition over existing fetchers. Visual changes are safe.",
    tab: "command",
  },
  {
    label: "Operator Training / SOP",
    detail: "Static SOP content. Edit copy freely; just keep it current-state honest.",
    tab: "training",
  },
  {
    label: "Documentation / Handoff Readiness",
    detail: "Hardcoded current-state map. Update labels and notes as the system evolves.",
    tab: "docs",
  },
  {
    label: "Pilot Readiness checklist",
    detail: "Earliest readiness view, kept for continuity. Copy/layout edits are safe.",
    tab: "pilot",
  },
  {
    label: "Onboarding checklist surface",
    detail: "Operator-facing onboarding. Copy and ordering tweaks are safe.",
    tab: "onboarding",
  },
];

/* ── Read-only / low-risk composition surfaces ───────────────────────── */
const READ_ONLY_AREAS: AreaEntry[] = [
  {
    label: "Pilot-to-Platform Audit",
    detail: "Honest read of pilot vs platform. Composition only, no mutations.",
    tab: "audit",
  },
  {
    label: "Launch Readiness / Health Check",
    detail: "Operator pre-launch checks. Read-only.",
    tab: "readiness",
  },
  {
    label: "Operator Reporting / Export",
    detail: "Composed reads + plain-text/CSV export. No write-path.",
    tab: "reporting",
  },
  {
    label: "Data Quality / Field Integrity",
    detail: "Field coverage and fallback usage audit. Read-only over current data.",
    tab: "data-quality",
  },
  {
    label: "Exception Handling / Manual Escalation",
    detail: "Surfaces ambiguous records. Read-only; navigation only.",
    tab: "exceptions",
  },
  {
    label: "Post-Pilot Learnings / Decision Support",
    detail: "Deterministic Confirmed/Observed/Uncertain over current leads. Read-only.",
    tab: "learnings",
  },
  {
    label: "Rollout Planning / Readiness",
    detail: "Hardcoded current-vs-future view. Edit guidance freely; keep it honest.",
    tab: "rollout",
  },
  {
    label: "Client-Facing Reporting Prep",
    detail: "Pre-export prep view. Read-only composition.",
    tab: "report-prep",
  },
  {
    label: "Attribution",
    detail: "Inbound attribution coverage. Read-only.",
    tab: "attribution",
  },
];

/* ── High-risk / plumbing-dependent (admin items that touch core flow) ─ */
const HIGH_RISK_AREAS: AreaEntry[] = [
  {
    label: "Anything that mutates leads.phone_verified or related OTP state",
    detail:
      "These fields are the access ladder. Changes here cross into protected territory — escalate to engineering.",
  },
  {
    label: "Changes to scan_session → analysis → lead linkage",
    detail:
      "Identity attribution depends on stable lead_id / scan_session_id / event_id. Schema or write-path changes here ripple everywhere.",
  },
  {
    label: "Changes to client_slug fallback chain",
    detail:
      "URL → localStorage → 'direct'. Slugs MUST NOT be NULL on lead creation. Treat slug logic as protected.",
  },
  {
    label: "Stripe checkout / credit fulfillment paths",
    detail:
      "Billing infrastructure exists in code but is not active in the operator pilot path. Do not surface or trigger it here.",
  },
  {
    label: "Contractor portal routes (/partner/*)",
    detail:
      "Outside the operator stack. Coordinate any change with the contractor-side phases explicitly.",
  },
];

/* ── Pre-change checklist (operator self-service) ────────────────────── */
const PRE_CHANGE_CHECKLIST = [
  "Is the change UI-only, or does it touch a fetcher / write-path / shared type?",
  "Does it touch any Protected area (OTP, scanner, tracking, report gating, public funnel, RLS)? If yes — stop and escalate.",
  "Does it mutate leads / contractor_opportunity_routes / billable_intros / contractor_outcomes? If yes, treat as Sensitive and re-read Pilot-to-Platform Audit.",
  "Does it change adminDataService or shared CRMLead types? If yes, scan all admin tabs that consume them.",
  "Does the change preserve the canonical scan path (private quotes → quote_files → scan_sessions → scan-quote → analyses)?",
  "After the change, do Routing Desk → Outcome Tracking → Operator Reporting still flow end-to-end for one contractor?",
  "Did Launch Readiness / Health Check still pass? Did Data Quality coverage drop?",
  "Is operator language still honest (no overclaim of automation, billing, or portal that does not exist)?",
];

/* ── Current change limits / cautions ────────────────────────────────── */
const CHANGE_LIMITS = [
  "There is no deployment automation, feature-flag platform, or staged-rollout system in this repo path.",
  "There is no automated test gate that protects protected systems — discipline is enforced by guardrails and review.",
  "There is no persistent change registry — this surface is a current-state guidance view only.",
  "Schema changes belong in `supabase/migrations/` and are out of scope for the operator surfaces.",
  "Any change that crosses into the public funnel, OTP, or scoring engine must go through engineering, not the admin tabs.",
];

const QUICK_LINKS: Array<{ tab: string; label: string }> = [
  { tab: "docs", label: "Documentation / Handoff Readiness" },
  { tab: "audit", label: "Pilot-to-Platform Audit" },
  { tab: "readiness", label: "Launch Readiness / Health Check" },
  { tab: "training", label: "Operator Training / SOP" },
  { tab: "rollout", label: "Rollout Planning / Readiness" },
  { tab: "data-quality", label: "Data Quality / Field Integrity" },
  { tab: "exceptions", label: "Exception Handling" },
  { tab: "learnings", label: "Post-Pilot Learnings" },
];

function ClassBadge({ kind }: { kind: ChangeClass }) {
  if (kind === "protected") {
    return (
      <Badge className="bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/15">
        <Lock className="h-3 w-3 mr-1" />
        Protected
      </Badge>
    );
  }
  if (kind === "sensitive") {
    return (
      <Badge className="bg-amber-500/10 text-amber-950 border-amber-500/30 hover:bg-amber-500/15">
        <ShieldAlert className="h-3 w-3 mr-1" />
        Sensitive
      </Badge>
    );
  }
  if (kind === "ui-only") {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-950 border-emerald-500/30 hover:bg-emerald-500/15">
        <Wrench className="h-3 w-3 mr-1" />
        UI-only
      </Badge>
    );
  }
  return (
    <Badge className="bg-sky-500/10 text-sky-950 border-sky-500/30 hover:bg-sky-500/15">
      <Eye className="h-3 w-3 mr-1" />
      Read-only
    </Badge>
  );
}

export function ChangeManagementSafeUpdateReadinessSurface({
  onNavigateTab,
}: ChangeManagementSafeUpdateReadinessSurfaceProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState<Record<string, boolean>>({
    protected: true,
    sensitive: true,
    uiOnly: true,
    readOnly: false,
    highRisk: true,
    checklist: true,
    limits: false,
  });

  const toggle = (id: string) => setOpen((p) => ({ ...p, [id]: !p[id] }));

  const summary = {
    protected: PROTECTED_AREAS.length,
    sensitive: SENSITIVE_AREAS.length,
    uiOnly: UI_ONLY_AREAS.length,
    readOnly: READ_ONLY_AREAS.length,
  };

  const copySnapshot = async () => {
    const lines: string[] = [];
    lines.push("WindowMan Mission Control — Change Management Snapshot");
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(
      `Areas: ${summary.protected} protected · ${summary.sensitive} sensitive · ${summary.uiOnly} UI-only · ${summary.readOnly} read-only`,
    );
    lines.push("");
    lines.push("## Protected (no-touch)");
    PROTECTED_AREAS.forEach((a) => lines.push(`- ${a.label} — ${a.detail}`));
    lines.push("");
    lines.push("## Sensitive (admin, plumbing-adjacent)");
    SENSITIVE_AREAS.forEach((a) => lines.push(`- ${a.label} — ${a.detail}`));
    lines.push("");
    lines.push("## UI-only (safer to iterate)");
    UI_ONLY_AREAS.forEach((a) => lines.push(`- ${a.label} — ${a.detail}`));
    lines.push("");
    lines.push("## Read-only composition surfaces");
    READ_ONLY_AREAS.forEach((a) => lines.push(`- ${a.label} — ${a.detail}`));
    lines.push("");
    lines.push("## High-risk / plumbing-dependent");
    HIGH_RISK_AREAS.forEach((a) => lines.push(`- ${a.label} — ${a.detail}`));
    lines.push("");
    lines.push("## Pre-change checklist");
    PRE_CHANGE_CHECKLIST.forEach((c) => lines.push(`- ${c}`));
    lines.push("");
    lines.push("## Current change limits");
    CHANGE_LIMITS.forEach((l) => lines.push(`- ${l}`));

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast({
        title: "Change snapshot copied",
        description: "Plain-text safe-update guidance on clipboard.",
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
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-semibold tracking-tight">
                  Change Management / Safe Update Readiness
                </h2>
                {(() => {
                  const label = getAdminSurfaceLabel("change-mgmt");
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
              </div>
              <p className="text-sm text-slate-700 mt-1 max-w-2xl">
                Internal guidance for safely evolving the system. Maps current repo-real areas into{" "}
                <span className="font-medium">Protected</span>,{" "}
                <span className="font-medium">Sensitive</span>,{" "}
                <span className="font-medium">UI-only</span>, and{" "}
                <span className="font-medium">Read-only</span>. No deployment tool, no feature-flag
                backend — just current-state operator guidance.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={copySnapshot} className="gap-1.5">
              <Copy className="h-3.5 w-3.5" />
              Copy snapshot
            </Button>
          </div>
        </div>

        {/* Summary chips */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <SummaryChip label="Protected" value={summary.protected} kind="protected" />
          <SummaryChip label="Sensitive" value={summary.sensitive} kind="sensitive" />
          <SummaryChip label="UI-only" value={summary.uiOnly} kind="ui-only" />
          <SummaryChip label="Read-only" value={summary.readOnly} kind="read-only" />
        </div>
      </div>

      {/* Protected */}
      <Section
        id="protected"
        title="Protected / no-touch areas"
        intent="Repeatedly enforced no-touch zones. Casual changes here will break the product or its security posture."
        icon={Lock}
        open={open.protected}
        onToggle={toggle}
      >
        <AreaList items={PROTECTED_AREAS} kind="protected" onNavigateTab={onNavigateTab} />
      </Section>

      {/* Sensitive */}
      <Section
        id="sensitive"
        title="Sensitive areas (admin, plumbing-adjacent)"
        intent="Admin surfaces whose write paths or shared types affect routing, ownership, or reporting integrity."
        icon={ShieldAlert}
        open={open.sensitive}
        onToggle={toggle}
      >
        <AreaList items={SENSITIVE_AREAS} kind="sensitive" onNavigateTab={onNavigateTab} />
      </Section>

      {/* UI-only */}
      <Section
        id="uiOnly"
        title="Safe UI-only areas"
        intent="Layout, copy, ordering, and local-only convenience changes are low-risk here."
        icon={Wrench}
        open={open.uiOnly}
        onToggle={toggle}
      >
        <AreaList items={UI_ONLY_AREAS} kind="ui-only" onNavigateTab={onNavigateTab} />
      </Section>

      {/* Read-only / low-risk composition */}
      <Section
        id="readOnly"
        title="Read-only / low-risk composition surfaces"
        intent="Compose existing data without mutating it. Safe to refine; just keep guidance honest and current-state."
        icon={Eye}
        open={open.readOnly}
        onToggle={toggle}
      >
        <AreaList items={READ_ONLY_AREAS} kind="read-only" onNavigateTab={onNavigateTab} />
      </Section>

      {/* High-risk / plumbing-dependent */}
      <Section
        id="highRisk"
        title="High-risk / plumbing-dependent areas"
        intent="Items inside the admin stack that quietly cross into protected plumbing. Treat as escalation territory."
        icon={AlertTriangle}
        open={open.highRisk}
        onToggle={toggle}
      >
        <AreaList items={HIGH_RISK_AREAS} kind="protected" onNavigateTab={onNavigateTab} />
      </Section>

      {/* Pre-change checklist */}
      <Section
        id="checklist"
        title="Pre-change checklist"
        intent="Run this before any change that is not pure copy/layout. Operator self-service."
        icon={ListChecks}
        open={open.checklist}
        onToggle={toggle}
      >
        <ol className="space-y-1.5 text-sm">
          {PRE_CHANGE_CHECKLIST.map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-slate-700">
              <span className="text-primary tabular-nums shrink-0">{i + 1}.</span>
              <span>{c}</span>
            </li>
          ))}
        </ol>
      </Section>

      {/* Current change limits */}
      <Section
        id="limits"
        title="Current change limits / cautions"
        intent="What this repo path does NOT provide. Set expectations honestly with collaborators."
        icon={ShieldAlert}
        open={open.limits}
        onToggle={toggle}
      >
        <ul className="space-y-1.5 text-sm">
          {CHANGE_LIMITS.map((l, i) => (
            <li key={i} className="flex items-start gap-2 text-slate-700">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-950 mt-0.5 shrink-0" />
              <span>{l}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Quick links */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="font-semibold text-sm">Supporting audit / docs / training surfaces</h3>
        <p className="text-xs text-slate-700 mt-0.5">
          Jump to the surfaces that back this guidance.
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

function SummaryChip({
  label,
  value,
  kind,
}: {
  label: string;
  value: number;
  kind: ChangeClass;
}) {
  const tone =
    kind === "protected"
      ? "bg-destructive/5 border-destructive/30 text-destructive"
      : kind === "sensitive"
        ? "bg-amber-500/5 border-amber-500/30 text-amber-950"
        : kind === "ui-only"
          ? "bg-emerald-500/5 border-emerald-500/30 text-emerald-950"
          : "bg-sky-500/5 border-sky-500/30 text-sky-950";
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${tone}`}>
      <div className="text-sm uppercase tracking-wide font-semibold">{label}</div>
      <div className="text-xl font-semibold mt-0.5 text-foreground">{value}</div>
    </div>
  );
}

function AreaList({
  items,
  kind,
  onNavigateTab,
}: {
  items: AreaEntry[];
  kind: ChangeClass;
  onNavigateTab?: (tab: string) => void;
}) {
  return (
    <div className="space-y-2">
      {items.map((a, i) => (
        <div
          key={`${a.label}-${i}`}
          className="rounded-lg border bg-background px-3 py-2.5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <ClassBadge kind={kind} />
              <div className="text-sm font-medium">{a.label}</div>
            </div>
            <div className="text-xs text-slate-700 mt-1">{a.detail}</div>
          </div>
          {a.tab && onNavigateTab && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onNavigateTab(a.tab!)}
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
  icon: typeof ShieldCheck;
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
