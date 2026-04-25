/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Expansion Preconditions / Additional Market Entry Readiness (Phase 30)
 * ───────────────────────────────────────────────────────────────────────────
 * Internal, read-only operator readiness layer.
 *
 * Purpose:
 *   Help the operator see what must be true before adding another county,
 *   another contractor, or operating in a shared market. Surfaces current
 *   strengths, current gaps, and observed coverage from real `leads` data.
 *
 * Classification logic (deterministic, current-state only):
 *   - Preconditions are static editorial checklists derived from current
 *     repo-real workflows (Routing Desk, Onboarding, Feedback Loop, etc.).
 *   - "Observed Coverage" is computed from real `leads.county` values seen
 *     in the loaded dataset. It is NOT a territory map — it only reflects
 *     where leads have actually been seen.
 *   - Strengths/Gaps are derived from current pilot truth: single-contractor
 *     routing, manual recovery, no automated allocation, no billing.
 *
 * Hard rules (enforced in this file):
 *   - Frontend only. No persistence. No backend writes. No fake approvals.
 *   - No "cartel" language anywhere.
 *   - Copy is current-state honest; nothing implies a territory engine,
 *     rollout backend, or shared-market automation.
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
  Map as MapIcon,
  MapPin,
  Users,
  Building2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Copy,
  Check,
  Compass,
} from "lucide-react";
import { toast } from "sonner";
import type { CRMLead } from "@/components/admin/types";

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
  | "expansion"
  | "attribution"
  | "pilot";

interface Props {
  leads: CRMLead[];
  onNavigateTab?: (tab: AdminTabKey) => void;
}

// ─────────────────────────────────────────────────────────────────────────
// Static, deterministic precondition catalog
// ─────────────────────────────────────────────────────────────────────────

interface Precondition {
  title: string;
  detail: string;
  surface?: { label: string; tab: AdminTabKey };
}

const COUNTY_PRECONDITIONS: Precondition[] = [
  {
    title: "Pilot county pipeline is healthy",
    detail:
      "Verified-lead → routed → outcome flow works end-to-end in the current county before adding another.",
    surface: { label: "Active Pipeline", tab: "pipeline" },
  },
  {
    title: "Routing decisions are consistent",
    detail:
      "Operator can articulate when a lead is routed vs held in the current county. If it is still ad hoc, do not add another.",
    surface: { label: "Routing Desk", tab: "routing" },
  },
  {
    title: "Recovery cadence is documented",
    detail:
      "Stale and ghost handling is reproducible from SOP. New counties multiply lifecycle work.",
    surface: { label: "Lifecycle", tab: "lifecycle" },
  },
  {
    title: "Reporting is operator-shareable",
    detail:
      "A clean snapshot of pilot performance can be produced on demand for the new market discussion.",
    surface: { label: "Reporting", tab: "reporting" },
  },
  {
    title: "Data quality issues are known and bounded",
    detail:
      "Field completeness has been audited. Known gaps are documented, not surprises.",
    surface: { label: "Data Quality", tab: "data-quality" },
  },
];

const CONTRACTOR_PRECONDITIONS: Precondition[] = [
  {
    title: "Current contractor is fully onboarded",
    detail:
      "Onboarding is complete and contractor expectations are stable before adding another seat.",
    surface: { label: "Onboarding", tab: "onboarding" },
  },
  {
    title: "Feedback loop is producing real signal",
    detail:
      "Operator regularly captures contractor disposition. Without this, a second contractor doubles ambiguity.",
    surface: { label: "Feedback Loop", tab: "feedback" },
  },
  {
    title: "Allocation rationale is decided in advance",
    detail:
      "Operator knows how the next lead is split between contractors. If this is unresolved, do not add a second contractor.",
    surface: { label: "Shared Market Manual Controls", tab: "shared-market" },
  },
  {
    title: "Outcome tracking is honest",
    detail:
      "Booked/closed outcomes are entered consistently. Otherwise a second contractor cannot be fairly compared.",
    surface: { label: "Outcomes", tab: "outcomes" },
  },
  {
    title: "Governance boundaries are understood",
    detail:
      "Operator can explain what they decide vs what stays system truth across two contractors.",
    surface: { label: "Governance", tab: "governance" },
  },
];

const SHARED_MARKET_PRECONDITIONS: Precondition[] = [
  {
    title: "Manual allocation policy is written down",
    detail:
      "Even a one-paragraph rule (e.g. round-robin, geo-weighted) must exist before two contractors share a market.",
    surface: { label: "Shared Market Manual Controls", tab: "shared-market" },
  },
  {
    title: "Conflict-resolution path is agreed",
    detail:
      "Operator knows what to do if two contractors both want the same lead. No automated arbitration exists.",
    surface: { label: "Operator Training / SOP", tab: "training" },
  },
  {
    title: "Per-contractor reporting is achievable",
    detail:
      "Reporting can be split per contractor without inventing fields. Otherwise shared markets become opaque.",
    surface: { label: "Reporting", tab: "reporting" },
  },
  {
    title: "Pilot Learnings has no high-severity unresolved items",
    detail:
      "Outstanding pilot issues should be addressed before stacking shared-market complexity on top.",
    surface: { label: "Pilot Learnings", tab: "learnings" },
  },
];

const STRENGTHS: Precondition[] = [
  {
    title: "Deterministic scoring engine",
    detail:
      "Grade and pillar scores are computed by backend TypeScript. They scale to new markets without re-tuning.",
  },
  {
    title: "Verify-to-Reveal access ladder",
    detail:
      "OTP gating and full-report authorization are backend-enforced. Identity discipline holds across markets.",
  },
  {
    title: "Single canonical lead spine",
    detail:
      "All admin surfaces read from the same `leads` row. New markets do not require new data plumbing.",
  },
  {
    title: "Operator surfaces are read-only over real data",
    detail:
      "Adding visibility for a new county does not require schema changes — surfaces filter the existing data.",
    surface: { label: "Pilot-to-Platform Audit", tab: "audit" },
  },
];

const GAPS: Precondition[] = [
  {
    title: "No automated routing / allocation",
    detail:
      "Every additional contractor or county multiplies operator decision load until allocation logic is encoded.",
    surface: { label: "Rollout Planning", tab: "rollout" },
  },
  {
    title: "No contractor self-service",
    detail:
      "Contractors cannot accept, release, or report outcomes themselves. Operator is the bottleneck per market.",
  },
  {
    title: "No automated lifecycle / SLA timers",
    detail:
      "Stale handling is manual. Each new market adds linear lifecycle workload.",
    surface: { label: "Lifecycle", tab: "lifecycle" },
  },
  {
    title: "No billing / credit enforcement",
    detail:
      "Billable intros are not auto-enforced. Multi-contractor markets need this clarified before scaling.",
  },
  {
    title: "Shared-market policy is operator-only",
    detail:
      "No fairness queue, no bid logic. Adding contractors before a written policy will create disputes.",
    surface: { label: "Governance", tab: "governance" },
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Observed coverage (derived from real `leads` data only)
// ─────────────────────────────────────────────────────────────────────────

interface CountyCoverage {
  county: string;
  total: number;
  verified: number;
  routed: number;
  closed: number;
}

function computeCoverage(leads: CRMLead[]): CountyCoverage[] {
  const map = new Map<string, CountyCoverage>();
  for (const lead of leads) {
    const key = (lead.county ?? "Unknown").trim() || "Unknown";
    const entry =
      map.get(key) ??
      ({ county: key, total: 0, verified: 0, routed: 0, closed: 0 } as CountyCoverage);
    entry.total += 1;
    if (lead.phone_verified) entry.verified += 1;
    if (lead.routed_to_contractor_at) entry.routed += 1;
    if (lead.closed_at) entry.closed += 1;
    map.set(key, entry);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function buildSnapshot(coverage: CountyCoverage[]): string {
  const fmt = (label: string, items: Precondition[]) =>
    `${label}\n` + items.map((i) => `  • ${i.title} — ${i.detail}`).join("\n");

  const coverageBlock =
    coverage.length === 0
      ? "  (no county data in current dataset)"
      : coverage
          .map(
            (c) =>
              `  • ${c.county} — total ${c.total}, verified ${c.verified}, routed ${c.routed}, closed ${c.closed}`,
          )
          .join("\n");

  return [
    "WindowMan — Expansion Preconditions / Additional Market Entry Readiness",
    "Current-state snapshot. Read-only. No persistence.",
    "",
    fmt("ADDITIONAL COUNTY — PRECONDITIONS", COUNTY_PRECONDITIONS),
    "",
    fmt("ADDITIONAL CONTRACTOR — PRECONDITIONS", CONTRACTOR_PRECONDITIONS),
    "",
    fmt("SHARED-MARKET EXPANSION — PRECONDITIONS", SHARED_MARKET_PRECONDITIONS),
    "",
    fmt("CURRENT STRENGTHS SUPPORTING EXPANSION", STRENGTHS),
    "",
    fmt("CURRENT GAPS THAT INCREASE EXPANSION RISK", GAPS),
    "",
    "OBSERVED COVERAGE (from current `leads` data, not territory control)",
    coverageBlock,
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
  items: Precondition[];
  onNavigateTab?: (tab: AdminTabKey) => void;
}

function PreconditionSection({
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
              <Badge variant={badgeVariant} className="text-sm">
                {badgeLabel}
              </Badge>
              <Badge variant="outline" className="text-sm">
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
            <li key={idx} className="rounded-md border bg-muted/30 p-3 text-sm">
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

export function ExpansionPreconditionsMarketEntryReadinessSurface({
  leads,
  onNavigateTab,
}: Props) {
  const [copied, setCopied] = useState(false);
  const coverage = useMemo(() => computeCoverage(leads), [leads]);
  const snapshot = useMemo(() => buildSnapshot(coverage), [coverage]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snapshot);
      setCopied(true);
      toast.success("Expansion readiness snapshot copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy snapshot");
    }
  };

  const quickLinks: Array<{ label: string; tab: AdminTabKey }> = [
    { label: "Rollout Planning", tab: "rollout" },
    { label: "Pilot-to-Platform Audit", tab: "audit" },
    { label: "Shared Market Manual Controls", tab: "shared-market" },
    { label: "Onboarding", tab: "onboarding" },
    { label: "Health Check", tab: "readiness" },
    { label: "Reporting", tab: "reporting" },
    { label: "Data Quality", tab: "data-quality" },
    { label: "Governance", tab: "governance" },
  ];

  const totalCounties = coverage.length;
  const totalLeads = leads.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Compass className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl">
                  Expansion Preconditions / Additional Market Entry Readiness
                </CardTitle>
                <CardDescription className="mt-1 max-w-2xl">
                  Internal planning view. Lists what must be true before
                  adding another county, contractor, or shared market.
                  Strengths and gaps reflect current pilot truth. Coverage
                  reflects only what is visible in current `leads` data —
                  it is not a territory map.
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <Badge variant="outline" className="justify-start py-1.5">
              <MapPin className="mr-1.5 h-3 w-3" />
              {totalCounties} counties seen
            </Badge>
            <Badge variant="outline" className="justify-start py-1.5">
              <Users className="mr-1.5 h-3 w-3" />
              1 active contractor
            </Badge>
            <Badge variant="outline" className="justify-start py-1.5">
              <CheckCircle2 className="mr-1.5 h-3 w-3" />
              {STRENGTHS.length} strengths
            </Badge>
            <Badge variant="destructive" className="justify-start py-1.5">
              <AlertTriangle className="mr-1.5 h-3 w-3" />
              {GAPS.length} gaps
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Precondition sections */}
      <Accordion
        type="multiple"
        defaultValue={["county", "contractor", "gaps"]}
        className="space-y-3"
      >
        <PreconditionSection
          id="county"
          icon={<MapPin className="h-5 w-5" />}
          title="Preconditions for adding another county"
          description="What must hold in the current county before adding the next one."
          badgeLabel="Verify first"
          badgeVariant="default"
          items={COUNTY_PRECONDITIONS}
          onNavigateTab={onNavigateTab}
        />

        <PreconditionSection
          id="contractor"
          icon={<Building2 className="h-5 w-5" />}
          title="Preconditions for adding another contractor"
          description="What must be stable before a second contractor is brought on."
          badgeLabel="Verify first"
          badgeVariant="default"
          items={CONTRACTOR_PRECONDITIONS}
          onNavigateTab={onNavigateTab}
        />

        <PreconditionSection
          id="shared-market"
          icon={<Users className="h-5 w-5" />}
          title="Preconditions for shared-market expansion"
          description="What must be agreed before two contractors share a market."
          badgeLabel="Operator-decided"
          badgeVariant="secondary"
          items={SHARED_MARKET_PRECONDITIONS}
          onNavigateTab={onNavigateTab}
        />

        <PreconditionSection
          id="strengths"
          icon={<CheckCircle2 className="h-5 w-5" />}
          title="Current strengths supporting expansion"
          description="Capabilities that scale cleanly from the current pilot."
          badgeLabel="Strengths"
          badgeVariant="default"
          items={STRENGTHS}
          onNavigateTab={onNavigateTab}
        />

        <PreconditionSection
          id="gaps"
          icon={<AlertTriangle className="h-5 w-5" />}
          title="Current gaps that increase expansion risk"
          description="Manual or missing capabilities that compound at scale."
          badgeLabel="Risk"
          badgeVariant="destructive"
          items={GAPS}
          onNavigateTab={onNavigateTab}
        />
      </Accordion>

      {/* Observed coverage */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <MapIcon className="h-4 w-4 text-slate-700" />
              <CardTitle className="text-base">
                Observed coverage / market footprint
              </CardTitle>
            </div>
            <Badge variant="outline" className="text-sm">
              {totalLeads} leads in current dataset
            </Badge>
          </div>
          <CardDescription>
            Counties visible in real `leads` data. This reflects where leads
            have actually appeared — not formal territory control.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Separator className="mb-4" />
          {coverage.length === 0 ? (
            <p className="text-sm text-slate-700 italic">
              No county data in the current dataset.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-700 border-b">
                    <th className="py-2 pr-4 font-medium">County</th>
                    <th className="py-2 pr-4 font-medium text-right">Total</th>
                    <th className="py-2 pr-4 font-medium text-right">Verified</th>
                    <th className="py-2 pr-4 font-medium text-right">Routed</th>
                    <th className="py-2 pr-4 font-medium text-right">Closed</th>
                  </tr>
                </thead>
                <tbody>
                  {coverage.map((c) => (
                    <tr key={c.county} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{c.county}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {c.total}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {c.verified}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {c.routed}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {c.closed}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-sm text-slate-700 mt-4 leading-relaxed">
            Coverage is a read-only view over current `leads` data. It does
            not enforce territory, allocate counties, or imply contractor
            assignment. Expansion decisions remain operator-judged.
          </p>
        </CardContent>
      </Card>

      {/* Quick links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Supporting surfaces</CardTitle>
          <CardDescription>
            Audit, rollout, and governance surfaces that inform expansion.
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
            This surface is read-only operator readiness. It does not
            persist plans, approve expansion, or allocate territory. All
            preconditions reflect current repo-real workflows.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
