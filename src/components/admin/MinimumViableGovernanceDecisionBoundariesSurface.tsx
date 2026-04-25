/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Minimum Viable Governance / Decision Boundaries Surface (Phase 28)
 * ───────────────────────────────────────────────────────────────────────────
 * Internal, read-only operator clarity layer.
 *
 * Purpose:
 *   Help the operator understand which decisions belong where today, and
 *   avoid accidental overreach as more contractors and markets are added.
 *
 * Classification logic (deterministic, current-state only):
 *   - "Operator Decision Allowed Today" → repo-real surfaces already give
 *     the operator a manual control (e.g. routing, recovery, release review).
 *   - "Manual Judgment Area" → repeated case-by-case calls with no encoded
 *     policy in the repo today.
 *   - "System Truth" → fields/states the database/Edge Functions own and
 *     the operator should NOT override (e.g. phone_verified, OTP state,
 *     scoring grade).
 *   - "Not Yet Automated / Future Policy" → intentionally unencoded today;
 *     remains operator-dependent until product logic is built.
 *   - "Protected / No-Touch" → previously-fenced systems (OTP, scanner,
 *     report gating, tracking) — never operator-decidable.
 *
 * Hard rules (enforced in this file):
 *   - Frontend only. No persistence. No backend writes. No fake approvals.
 *   - No "cartel" language anywhere.
 *   - All copy is current-state honest; nothing implies a permissions
 *     backend, policy engine, or RBAC system.
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
  Scale,
  ShieldCheck,
  ShieldAlert,
  UserCog,
  Lock,
  Database,
  Hourglass,
  ArrowRight,
  Copy,
  Check,
  Users,
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
  | "attribution"
  | "pilot";

interface Props {
  onNavigateTab?: (tab: AdminTabKey) => void;
}

// ─────────────────────────────────────────────────────────────────────────
// Static, deterministic decision-boundary catalog
// (derived from current repo-real surfaces only)
// ─────────────────────────────────────────────────────────────────────────

interface BoundaryEntry {
  title: string;
  detail: string;
  surface?: { label: string; tab: AdminTabKey };
}

const OPERATOR_DECISIONS: BoundaryEntry[] = [
  {
    title: "Route a verified lead to the contractor",
    detail:
      "Operator manually moves a verified lead into the active routing queue. Repo-real today: single-contractor pilot routing.",
    surface: { label: "Routing Desk", tab: "routing" },
  },
  {
    title: "Recover or retire stale / dead leads",
    detail:
      "Operator decides when a lead is genuinely stale and applies the recovery workflow. No automated decay rules are in place.",
    surface: { label: "Lifecycle (Dead/Stale Recovery)", tab: "lifecycle" },
  },
  {
    title: "Approve contact release / handoff",
    detail:
      "Operator reviews and approves contact release before it reaches the contractor. Manual gate by design.",
    surface: { label: "Routing Desk", tab: "routing" },
  },
  {
    title: "Mark a lead as needing review or invalid",
    detail:
      "Operator triages low-confidence or unreadable scans. The Needs Review tab surfaces them deterministically.",
    surface: { label: "Needs Review", tab: "needs-review" },
  },
  {
    title: "Capture contractor feedback / disposition",
    detail:
      "Operator logs contractor feedback to close the loop on quality. No automated contractor self-service today.",
    surface: { label: "Feedback Loop", tab: "feedback" },
  },
];

const MANUAL_JUDGMENT_AREAS: BoundaryEntry[] = [
  {
    title: "Borderline / ambiguous quote scans",
    detail:
      "When extraction confidence is low, the operator decides whether to retry, request a better upload, or escalate.",
    surface: { label: "Exceptions", tab: "exceptions" },
  },
  {
    title: "Contractor selection in shared markets",
    detail:
      "Today only one contractor is live. If a second is added, allocation is operator judgment until a routing policy is encoded.",
    surface: { label: "Shared Market Manual Controls", tab: "shared-market" },
  },
  {
    title: "Recovery cadence / outreach timing",
    detail:
      "No automated drip. Operator decides when to nudge, recover, or close out a stalled lead.",
    surface: { label: "Lifecycle", tab: "lifecycle" },
  },
  {
    title: "Contractor-safe reporting boundaries",
    detail:
      "Operator decides what is and is not safe to share externally. The Report Prep surface scaffolds this; final call is manual.",
    surface: { label: "Report Prep", tab: "report-prep" },
  },
];

const SYSTEM_TRUTH_AREAS: BoundaryEntry[] = [
  {
    title: "Phone verification state",
    detail:
      "`phone_verified` and `phone_verified_at` are owned by the OTP backend. Operator view only — never override.",
  },
  {
    title: "Scoring grade and pillar scores",
    detail:
      "Computed deterministically by backend TypeScript scoring. Operator cannot edit grades; only flag the underlying scan.",
  },
  {
    title: "Lead identity (lead_id, scan_session_id)",
    detail:
      "Persistent identifiers managed by the data spine. Never re-key, merge, or fabricate from the UI.",
  },
  {
    title: "Tracking / attribution payloads",
    detail:
      "UTM, fbp/fbc, and CAPI event_id values are captured on intake. Operator view via Attribution tab only.",
    surface: { label: "Attribution", tab: "attribution" },
  },
  {
    title: "Storage access (quote files)",
    detail:
      "Private bucket + signed URL. Access goes through the backend; the operator never bypasses signed access.",
  },
];

const NOT_YET_AUTOMATED: BoundaryEntry[] = [
  {
    title: "Multi-contractor routing policy",
    detail:
      "No allocation algorithm, round-robin, or capacity-aware routing is encoded yet. Stays manual until built.",
    surface: { label: "Rollout Planning", tab: "rollout" },
  },
  {
    title: "Contractor self-service portal actions",
    detail:
      "Contractors do not yet self-accept, self-release, or self-report outcomes. Everything flows through the operator today.",
  },
  {
    title: "Billing / Stripe enforcement",
    detail:
      "No billable-intro enforcement, invoicing, or credit deduction logic is wired into operator workflows today.",
  },
  {
    title: "Automated stale / decay policy",
    detail:
      "No SLA timers, automatic disposition, or contractor penalties exist. All lifecycle calls are manual.",
    surface: { label: "Lifecycle", tab: "lifecycle" },
  },
  {
    title: "Cross-market expansion policy",
    detail:
      "Geographic / vertical expansion rules are not encoded. Operator handles county/market scope by hand for now.",
    surface: { label: "Rollout Planning", tab: "rollout" },
  },
];

const SHARED_MARKET_BOUNDARIES: BoundaryEntry[] = [
  {
    title: "Who gets the next lead?",
    detail:
      "Operator-only call today. There is no fairness queue, no bid logic, no auto-allocation. Document the rationale per case.",
    surface: { label: "Shared Market Manual Controls", tab: "shared-market" },
  },
  {
    title: "When to suspend or pause a contractor",
    detail:
      "Manual operator decision based on feedback signals. No automated pause / penalty system exists.",
    surface: { label: "Feedback Loop", tab: "feedback" },
  },
  {
    title: "What constitutes a 'qualified' intro",
    detail:
      "Definition lives in the operator's head and SOP today. Not encoded as a system rule.",
    surface: { label: "Operator Training / SOP", tab: "training" },
  },
];

const PROTECTED_BOUNDARIES: BoundaryEntry[] = [
  {
    title: "OTP send / verify (Twilio)",
    detail:
      "`send-otp` and `verify-otp` Edge Functions are no-touch. Operator never bypasses, never spoofs, never mocks.",
  },
  {
    title: "Scanner funnel logic",
    detail:
      "Public scan flow, scoring engine, and preview/full gating are protected. Operator does not edit homeowner-facing flows.",
  },
  {
    title: "Preview / full report gating",
    detail:
      "Backend authorization controls full report access. CSS hiding is never a substitute. Operator does not preload full payloads.",
  },
  {
    title: "Tracking architecture",
    detail:
      "dataLayer + CAPI bridge are governance-fenced. Operator does not edit event_id, fbp/fbc, or hashed PII payloads.",
  },
  {
    title: "RLS policies",
    detail:
      "Row-level security is non-negotiable. No operator UI weakens or bypasses RLS for convenience.",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function buildSnapshot(): string {
  const fmt = (label: string, items: BoundaryEntry[]) =>
    `${label}\n` + items.map((i) => `  • ${i.title} — ${i.detail}`).join("\n");

  return [
    "WindowMan — Minimum Viable Governance / Decision Boundaries",
    "Current-state snapshot. Read-only. No persistence.",
    "",
    fmt("OPERATOR DECISIONS ALLOWED TODAY", OPERATOR_DECISIONS),
    "",
    fmt("MANUAL JUDGMENT AREAS", MANUAL_JUDGMENT_AREAS),
    "",
    fmt("SYSTEM TRUTH (operator view only)", SYSTEM_TRUTH_AREAS),
    "",
    fmt("NOT YET AUTOMATED / FUTURE POLICY", NOT_YET_AUTOMATED),
    "",
    fmt("SHARED-MARKET DECISION BOUNDARIES", SHARED_MARKET_BOUNDARIES),
    "",
    fmt("PROTECTED / NO-TOUCH BOUNDARIES", PROTECTED_BOUNDARIES),
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────
// Section primitive
// ─────────────────────────────────────────────────────────────────────────

interface SectionProps {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  badgeLabel: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  items: BoundaryEntry[];
  onNavigateTab?: (tab: AdminTabKey) => void;
}

function BoundarySection({
  id,
  icon,
  title,
  description,
  badgeLabel,
  badgeVariant = "secondary",
  items,
  onNavigateTab,
}: SectionProps) {
  return (
    <AccordionItem value={id} id={id} className="border rounded-lg bg-card">
      <AccordionTrigger className="px-4 hover:no-underline">
        <div className="flex items-center gap-3 text-left">
          <div className="text-slate-700">{icon}</div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{title}</span>
              <Badge variant={badgeVariant} className="text-[10px]">
                {badgeLabel}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {items.length}
              </Badge>
            </div>
            <p className="text-xs text-slate-700 mt-0.5 font-normal">
              {description}
            </p>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <ul className="space-y-3">
          {items.map((item, idx) => (
            <li
              key={idx}
              className="rounded-md border bg-muted/30 p-3 text-sm"
            >
              <div className="font-medium">{item.title}</div>
              <p className="text-slate-700 text-xs mt-1 leading-relaxed">
                {item.detail}
              </p>
              {item.surface && onNavigateTab && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 mt-2 text-xs"
                  onClick={() => onNavigateTab(item.surface!.tab)}
                >
                  Go to {item.surface.label}
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      </AccordionContent>
    </AccordionItem>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Main surface
// ─────────────────────────────────────────────────────────────────────────

export function MinimumViableGovernanceDecisionBoundariesSurface({
  onNavigateTab,
}: Props) {
  const [copied, setCopied] = useState(false);
  const snapshot = useMemo(() => buildSnapshot(), []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snapshot);
      setCopied(true);
      toast.success("Governance snapshot copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy snapshot");
    }
  };

  const quickLinks: Array<{ label: string; tab: AdminTabKey }> = [
    { label: "Pilot-to-Platform Audit", tab: "audit" },
    { label: "Shared Market Manual Controls", tab: "shared-market" },
    { label: "Change Management", tab: "change-mgmt" },
    { label: "Operator Training / SOP", tab: "training" },
    { label: "Documentation / Handoff", tab: "docs" },
    { label: "Rollout Planning", tab: "rollout" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Scale className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl">
                  Minimum Viable Governance / Decision Boundaries
                </CardTitle>
                <CardDescription className="mt-1 max-w-2xl">
                  Internal clarity layer. Shows which decisions the operator
                  can make today, which stay manual, what the system owns, and
                  what is intentionally not yet encoded. Read-only.
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            <Badge variant="outline" className="justify-start py-1.5">
              <UserCog className="mr-1.5 h-3 w-3" /> Operator-decidable
            </Badge>
            <Badge variant="outline" className="justify-start py-1.5">
              <Hourglass className="mr-1.5 h-3 w-3" /> Manual judgment
            </Badge>
            <Badge variant="outline" className="justify-start py-1.5">
              <Database className="mr-1.5 h-3 w-3" /> System truth
            </Badge>
            <Badge variant="outline" className="justify-start py-1.5">
              <ShieldAlert className="mr-1.5 h-3 w-3" /> Not yet automated
            </Badge>
            <Badge variant="outline" className="justify-start py-1.5">
              <Users className="mr-1.5 h-3 w-3" /> Shared-market boundary
            </Badge>
            <Badge variant="outline" className="justify-start py-1.5">
              <Lock className="mr-1.5 h-3 w-3" /> Protected / no-touch
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Boundary sections */}
      <Accordion
        type="multiple"
        defaultValue={["operator", "manual", "protected"]}
        className="space-y-3"
      >
        <BoundarySection
          id="operator"
          icon={<UserCog className="h-5 w-5" />}
          title="Operator decisions allowed today"
          description="Concrete calls the operator owns inside current admin surfaces."
          badgeLabel="Allowed"
          badgeVariant="default"
          items={OPERATOR_DECISIONS}
          onNavigateTab={onNavigateTab}
        />

        <BoundarySection
          id="manual"
          icon={<Hourglass className="h-5 w-5" />}
          title="Manual judgment areas"
          description="Case-by-case calls with no encoded policy yet. Document rationale."
          badgeLabel="Manual"
          badgeVariant="secondary"
          items={MANUAL_JUDGMENT_AREAS}
          onNavigateTab={onNavigateTab}
        />

        <BoundarySection
          id="system-truth"
          icon={<Database className="h-5 w-5" />}
          title="System truth vs operator view"
          description="Backend-owned state. Operator can view but never override."
          badgeLabel="View-only"
          badgeVariant="outline"
          items={SYSTEM_TRUTH_AREAS}
          onNavigateTab={onNavigateTab}
        />

        <BoundarySection
          id="not-yet-automated"
          icon={<ShieldAlert className="h-5 w-5" />}
          title="Not yet automated / future policy"
          description="Intentionally unencoded today. Stays manual until product logic exists."
          badgeLabel="Future"
          badgeVariant="secondary"
          items={NOT_YET_AUTOMATED}
          onNavigateTab={onNavigateTab}
        />

        <BoundarySection
          id="shared-market"
          icon={<Users className="h-5 w-5" />}
          title="Contractor / shared-market decision boundaries"
          description="What the operator decides when more than one contractor is in play."
          badgeLabel="Manual"
          badgeVariant="secondary"
          items={SHARED_MARKET_BOUNDARIES}
          onNavigateTab={onNavigateTab}
        />

        <BoundarySection
          id="protected"
          icon={<Lock className="h-5 w-5" />}
          title="Protected boundaries / no-touch areas"
          description="Previously fenced systems. Never operator-decidable."
          badgeLabel="Protected"
          badgeVariant="destructive"
          items={PROTECTED_BOUNDARIES}
          onNavigateTab={onNavigateTab}
        />
      </Accordion>

      {/* Quick links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-slate-700" />
            Supporting surfaces
          </CardTitle>
          <CardDescription>
            Jump to related audit, training, and control surfaces.
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
          <p className="text-[11px] text-slate-700 mt-4 leading-relaxed">
            This surface is read-only operator clarity. It does not enforce
            permissions, persist policy, or approve actions. It reflects
            current repo-real boundaries only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
