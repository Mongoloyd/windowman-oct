/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PILOT OPS / LAUNCH CONTROL — Phase 10
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Internal operator-facing surface to run the first contractor pilot day to
 * day. Composed entirely of:
 *
 *   • Pure read-only useMemo derivations over the `leads` prop already
 *     loaded by AdminDashboard
 *   • Static SOP/playbook copy tied to current repo-real system behavior
 *   • Local-only checklist toggles (sessionStorage, clearly non-canonical)
 *   • Read-only quick links to existing admin tabs
 *
 * STRICT CONSTRAINTS (Phase 10):
 *   • No new data fetches. No new endpoints. No new types.
 *   • No backend persistence for checklist state.
 *   • No fabricated KPIs, ROI math, or revenue projections.
 *   • Reuses existing surfaces; does not duplicate logic.
 *   • Tab-switch helper kept local — no new navigation system.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  ListChecks,
  MapPin,
  PlayCircle,
  RefreshCw,
  Send,
  Sparkles,
  Timer,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import type { CRMLead } from "@/components/admin/types";

// ─── Local-only checklist (sessionStorage, non-canonical) ──────────────
const CHECKLIST_KEY = "wm_pilot_ops_checklist_v1";

const DEFAULT_CHECKLIST_ITEMS: { id: string; label: string; hint?: string }[] = [
  {
    id: "leads_loading",
    label: "New leads are loading in Active Pipeline",
    hint: "Open Active Pipeline; confirm recent created_at timestamps.",
  },
  {
    id: "scans_completing",
    label: "Scans are completing (analysis_id present on recent leads)",
    hint: "Spot-check 2–3 recent leads; confirm latest_analysis_id is set.",
  },
  {
    id: "routed_sane",
    label: "Routed counts look sane vs. yesterday",
    hint: "Cross-reference Routing Desk and Pilot Readiness flow counts.",
  },
  {
    id: "handoff_path",
    label: "Contractor handoff path is available end-to-end",
    hint: "Confirm Routing Desk shows assignable opportunities; release works.",
  },
  {
    id: "stale_reviewed",
    label: "Stale / recovery queue reviewed",
    hint: "Scan the 'Stale / Recovery Candidates' block below.",
  },
  {
    id: "filters_sane",
    label: "Market / county filters look sane",
    hint: "Open Active Pipeline filters; confirm county options match real data.",
  },
];

interface ChecklistState {
  [id: string]: { checked: boolean; ts: string };
}

function loadChecklist(): ChecklistState {
  try {
    const raw = sessionStorage.getItem(CHECKLIST_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function saveChecklist(state: ChecklistState) {
  try {
    sessionStorage.setItem(CHECKLIST_KEY, JSON.stringify(state));
  } catch {
    /* sessionStorage unavailable — silently no-op */
  }
}

// ─── Operator-view derivations (repo-real fields only) ────────────────

const STALE_HOURS = 72;

function hoursSince(ts: string | null): number | null {
  if (!ts) return null;
  const t = new Date(ts).getTime();
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / (1000 * 60 * 60);
}

interface OperatorDerivations {
  needsAction: CRMLead[];
  readyToRoute: CRMLead[];
  followUpNeeded: CRMLead[];
  staleRecovery: CRMLead[];
  routedCount: number;
  bookedCount: number;
  closedCount: number;
  countiesCovered: number;
}

function deriveOperatorView(leads: CRMLead[]): OperatorDerivations {
  const needsAction: CRMLead[] = [];
  const readyToRoute: CRMLead[] = [];
  const followUpNeeded: CRMLead[] = [];
  const staleRecovery: CRMLead[] = [];

  let routedCount = 0;
  let bookedCount = 0;
  let closedCount = 0;
  const countySet = new Set<string>();

  for (const l of leads) {
    if (l.routed_to_contractor_at) routedCount++;
    if (l.appointment_booked_at) bookedCount++;
    if (l.closed_at) closedCount++;
    if (l.county && l.county.trim().length > 0) countySet.add(l.county.trim());

    const isClosed = !!l.closed_at;
    const isRouted = !!l.routed_to_contractor_at;
    const hasAnalysis = !!l.latest_analysis_id;
    const isVerified = !!l.phone_verified_at;
    const ageHrs = hoursSince(l.updated_at ?? l.created_at) ?? 0;

    // Ready to route: verified + analysis present + not yet routed + not closed
    if (isVerified && hasAnalysis && !isRouted && !isClosed) {
      readyToRoute.push(l);
      needsAction.push(l);
      continue;
    }

    // Follow-up needed: routed but no booking yet, and >24h since routing
    if (isRouted && !l.appointment_booked_at && !isClosed) {
      const routedHrs = hoursSince(l.routed_to_contractor_at) ?? 0;
      if (routedHrs >= 24) {
        followUpNeeded.push(l);
        needsAction.push(l);
      }
      continue;
    }

    // Stale / recovery: verified but never unlocked, or unlocked but never routed,
    // and updated >STALE_HOURS ago, not closed
    if (!isClosed && ageHrs >= STALE_HOURS) {
      const unlocked = !!l.report_unlocked_at;
      if (isVerified && (!unlocked || (unlocked && !isRouted))) {
        staleRecovery.push(l);
      }
    }
  }

  // Sort each queue by most recent activity
  const byRecent = (a: CRMLead, b: CRMLead) =>
    new Date(b.updated_at ?? b.created_at).getTime() -
    new Date(a.updated_at ?? a.created_at).getTime();

  needsAction.sort(byRecent);
  readyToRoute.sort(byRecent);
  followUpNeeded.sort(byRecent);
  staleRecovery.sort(byRecent);

  return {
    needsAction: needsAction.slice(0, 8),
    readyToRoute,
    followUpNeeded,
    staleRecovery,
    routedCount,
    bookedCount,
    closedCount,
    countiesCovered: countySet.size,
  };
}

// ─── Operator script snippets (copy-to-clipboard convenience) ─────────

const OPERATOR_SNIPPETS: { id: string; label: string; body: string }[] = [
  {
    id: "contractor_intro",
    label: "Contractor — daily check-in opener",
    body:
      "Hey — quick pilot check-in. We've got new homeowner opportunities ready " +
      "for you in the Routing Desk. I'll walk through anything new and confirm " +
      "you have what you need to follow up today.",
  },
  {
    id: "homeowner_followup",
    label: "Homeowner — gentle follow-up",
    body:
      "Hi — this is a quick follow-up on your impact window quote review. We " +
      "shared your verified report with a vetted local contractor. Have you " +
      "had a chance to connect with them yet?",
  },
  {
    id: "release_note",
    label: "Internal — release note template",
    body:
      "Released homeowner contact to contractor [name] on [date]. " +
      "Reason: verified lead, analysis complete, county match. " +
      "Ownership recorded in Routing Desk timeline.",
  },
];

// ─── Component ─────────────────────────────────────────────────────────

interface Props {
  leads: CRMLead[];
  onNavigateTab?: (tab: string) => void;
}

export function PilotOpsLaunchControl({ leads, onNavigateTab }: Props) {
  const view = useMemo(() => deriveOperatorView(leads), [leads]);

  const [checklist, setChecklist] = useState<ChecklistState>({});

  useEffect(() => {
    setChecklist(loadChecklist());
  }, []);

  const toggleChecklist = useCallback((id: string) => {
    setChecklist((prev) => {
      const current = prev[id]?.checked ?? false;
      const next: ChecklistState = {
        ...prev,
        [id]: { checked: !current, ts: new Date().toISOString() },
      };
      saveChecklist(next);
      return next;
    });
  }, []);

  const resetChecklist = useCallback(() => {
    setChecklist({});
    saveChecklist({});
    toast.success("Pilot checklist reset for today");
  }, []);

  const checkedCount = DEFAULT_CHECKLIST_ITEMS.filter(
    (i) => checklist[i.id]?.checked,
  ).length;

  const copySnippet = useCallback(async (body: string, label: string) => {
    try {
      await navigator.clipboard.writeText(body);
      toast.success(`Copied: ${label}`);
    } catch {
      toast.error("Clipboard unavailable");
    }
  }, []);

  return (
    <div className="w-full space-y-6">
      {/* ── Header ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <PlayCircle className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-bold tracking-tight">
              Pilot Ops — Launch Control
            </CardTitle>
            <Badge variant="outline" className="text-[10px]">
              Internal operator use
            </Badge>
          </div>
          <p className="text-xs text-slate-700 mt-1.5 leading-relaxed">
            One internal surface to run the first contractor pilot. Prioritized
            queues, daily checklist, and an operator playbook — all derived
            from repo-real lead state. Nothing here mutates leads automatically.
          </p>
        </CardHeader>
      </Card>

      {/* ── Now / Needs Action ────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <CardTitle className="text-sm font-medium text-slate-700 uppercase tracking-wider">
                Now / Needs Action
              </CardTitle>
            </div>
            <Badge variant="outline" className="text-[10px] tabular-nums">
              {view.needsAction.length} surfaced
            </Badge>
          </div>
          <p className="text-[11px] text-slate-700 mt-1">
            Top of the pile — operator-view derivation from repo-real lead
            state. Showing up to 8.
          </p>
        </CardHeader>
        <CardContent>
          {view.needsAction.length === 0 ? (
            <p className="text-sm text-slate-700 text-center py-6">
              Nothing urgent right now. Check back as new leads come in.
            </p>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
              {view.needsAction.map((l) => (
                <NeedsActionRow key={l.id} lead={l} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Priority Queues Snapshot ──────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <SnapshotTile
          icon={Send}
          label="Ready to Route"
          value={view.readyToRoute.length}
          accent="emerald"
          hint="Verified + analyzed + not yet routed"
        />
        <SnapshotTile
          icon={Timer}
          label="Follow-Up Needed"
          value={view.followUpNeeded.length}
          accent="amber"
          hint="Routed >24h, no booking yet"
        />
        <SnapshotTile
          icon={RefreshCw}
          label="Stale / Recovery"
          value={view.staleRecovery.length}
          accent="slate"
          hint={`Updated >${STALE_HOURS}h ago`}
        />
        <SnapshotTile
          icon={MapPin}
          label="Counties Covered"
          value={view.countiesCovered}
          accent="cyan"
          hint="Distinct counties on leads"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SnapshotTile
          icon={Send}
          label="Routed (total)"
          value={view.routedCount}
          accent="cyan"
          hint="Has routed_to_contractor_at"
        />
        <SnapshotTile
          icon={Users}
          label="Booked (total)"
          value={view.bookedCount}
          accent="cyan"
          hint="Has appointment_booked_at"
        />
        <SnapshotTile
          icon={CheckCircle2}
          label="Closed (total)"
          value={view.closedCount}
          accent="cyan"
          hint="Has closed_at"
        />
      </div>

      {/* ── Stale / Recovery Candidates list ──────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-slate-700" />
            <CardTitle className="text-sm font-medium text-slate-700 uppercase tracking-wider">
              Stale / Recovery Candidates
            </CardTitle>
          </div>
          <p className="text-[11px] text-slate-700 mt-1">
            Verified leads whose last activity is &gt;{STALE_HOURS}h old and
            never reached a routed-and-booked state. Showing up to 6.
          </p>
        </CardHeader>
        <CardContent>
          {view.staleRecovery.length === 0 ? (
            <p className="text-sm text-slate-700 text-center py-6">
              No stale recovery candidates right now.
            </p>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
              {view.staleRecovery.slice(0, 6).map((l) => (
                <StaleRow key={l.id} lead={l} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Daily Pilot Checklist ─────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-slate-700" />
              <CardTitle className="text-sm font-medium text-slate-700 uppercase tracking-wider">
                Daily Pilot Checklist
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] tabular-nums">
                {checkedCount}/{DEFAULT_CHECKLIST_ITEMS.length}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11px]"
                onClick={resetChecklist}
              >
                Reset
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-slate-700 mt-1">
            Local-only convenience (resets per browser session). Not stored on
            the server.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {DEFAULT_CHECKLIST_ITEMS.map((item) => {
              const isChecked = checklist[item.id]?.checked ?? false;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleChecklist(item.id)}
                  className={`w-full text-left rounded-lg border p-3 transition-colors flex items-start gap-3 ${
                    isChecked
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-border bg-card hover:bg-muted/50"
                  }`}
                >
                  <div
                    className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      isChecked
                        ? "border-emerald-500 bg-emerald-500"
                        : "border-muted-foreground/40"
                    }`}
                  >
                    {isChecked && (
                      <CheckCircle2 className="h-3 w-3 text-white" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        isChecked ? "text-slate-700 line-through" : ""
                      }`}
                    >
                      {item.label}
                    </p>
                    {item.hint && (
                      <p className="text-[11px] text-slate-700 mt-0.5 leading-relaxed">
                        {item.hint}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Operator Playbook / Next Actions ──────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-slate-700" />
            <CardTitle className="text-sm font-medium text-slate-700 uppercase tracking-wider">
              Operator Playbook — Next Actions by State
            </CardTitle>
          </div>
          <p className="text-[11px] text-slate-700 mt-1">
            Honest, current-state guidance. No automation, no promises beyond
            what the system does today.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <PlaybookRow
              title="Ready to Route"
              when="Verified phone, analysis complete, not yet routed."
              action="Open Routing Desk → assign to the pilot contractor → release contact when ready."
            />
            <PlaybookRow
              title="Hold"
              when="Verified but analysis is low-confidence or quote scope is unclear."
              action="Leave in Active Pipeline; revisit after better data is available. Do not route low-confidence."
            />
            <PlaybookRow
              title="Follow Up"
              when="Routed >24h ago with no booking confirmed."
              action="Check in with the contractor; confirm they reached the homeowner. Log notes in the Lead Dossier."
            />
            <PlaybookRow
              title="Mark Dead"
              when="Homeowner explicitly opts out, or quote turns out unrelated to impact windows."
              action="Set deal_status accordingly via the Lead Dossier; do not route further."
            />
            <PlaybookRow
              title="Stale"
              when={`No lead activity for >${STALE_HOURS}h and never reached booked.`}
              action="Triage in Stale / Recovery list above. Consider reactivation outreach."
            />
            <PlaybookRow
              title="Recovery Candidate"
              when="Verified + report unlocked but never routed (operator hold lapsed)."
              action="Re-evaluate fit; route if still viable, otherwise close out."
            />
          </div>

          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3 text-[11px] text-slate-700 leading-relaxed">
            <strong className="text-foreground">What to tell the contractor today:</strong>{" "}
            We are running a hands-on pilot. Leads are operator-reviewed before
            routing. Homeowner contact is released through the Routing Desk
            after verification. There is no automated shared-market routing,
            self-serve portal, or billing flow yet — that is future direction.
          </div>
        </CardContent>
      </Card>

      {/* ── Operator Script Snippets ──────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Copy className="h-4 w-4 text-slate-700" />
            <CardTitle className="text-sm font-medium text-slate-700 uppercase tracking-wider">
              Operator Script Snippets
            </CardTitle>
          </div>
          <p className="text-[11px] text-slate-700 mt-1">
            Copy-to-clipboard SOP snippets. Adjust before sending.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {OPERATOR_SNIPPETS.map((s) => (
              <div
                key={s.id}
                className="rounded-lg border border-border bg-card p-3 flex items-start gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{s.label}</p>
                  <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                    {s.body}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0"
                  onClick={() => copySnippet(s.body, s.label)}
                >
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Copy
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Quick Links to Existing Surfaces ──────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-slate-700" />
            <CardTitle className="text-sm font-medium text-slate-700 uppercase tracking-wider">
              Quick Links
            </CardTitle>
          </div>
          <p className="text-[11px] text-slate-700 mt-1">
            Jump to existing admin surfaces. Read-only navigation aid.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            <QuickLink label="Routing Desk" tab="routing" onNavigateTab={onNavigateTab} />
            <QuickLink label="Active Pipeline" tab="pipeline" onNavigateTab={onNavigateTab} />
            <QuickLink label="Command Center" tab="command" onNavigateTab={onNavigateTab} />
            <QuickLink label="Needs Review" tab="needs-review" onNavigateTab={onNavigateTab} />
            <QuickLink label="Pilot Readiness" tab="pilot" onNavigateTab={onNavigateTab} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Subcomponents ──────────────────────────────────────────────────── */

function NeedsActionRow({ lead }: { lead: CRMLead }) {
  const reason = useMemo(() => {
    if (lead.phone_verified_at && lead.latest_analysis_id && !lead.routed_to_contractor_at) {
      return { label: "Ready to route", tone: "emerald" as const };
    }
    if (lead.routed_to_contractor_at && !lead.appointment_booked_at) {
      return { label: "Follow up — routed, no booking", tone: "amber" as const };
    }
    return { label: "Review", tone: "slate" as const };
  }, [lead]);

  const name =
    [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unnamed lead";
  const ageHrs = hoursSince(lead.updated_at ?? lead.created_at);

  return (
    <div className="px-3 py-2.5 bg-card flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate">{name}</p>
          <Badge
            variant="outline"
            className={`text-[10px] ${
              reason.tone === "emerald"
                ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                : reason.tone === "amber"
                  ? "border-amber-500/40 text-amber-700 dark:text-amber-400"
                  : ""
            }`}
          >
            {reason.label}
          </Badge>
        </div>
        <p className="text-[11px] text-slate-700 mt-0.5 truncate">
          {lead.county || "Unknown county"} ·{" "}
          {ageHrs !== null ? `updated ${ageHrs.toFixed(0)}h ago` : "—"}
          {lead.grade ? ` · grade ${lead.grade}` : ""}
        </p>
      </div>
    </div>
  );
}

function StaleRow({ lead }: { lead: CRMLead }) {
  const name =
    [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unnamed lead";
  const ageHrs = hoursSince(lead.updated_at ?? lead.created_at);
  return (
    <div className="px-3 py-2.5 bg-card flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-[11px] text-slate-700 mt-0.5 truncate">
          {lead.county || "Unknown county"} ·{" "}
          {ageHrs !== null ? `${ageHrs.toFixed(0)}h since last activity` : "—"}
        </p>
      </div>
      <Badge variant="outline" className="text-[10px] shrink-0">
        {lead.report_unlocked_at ? "unlocked, not routed" : "verified, not unlocked"}
      </Badge>
    </div>
  );
}

function SnapshotTile({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  hint?: string;
  accent: "emerald" | "amber" | "cyan" | "slate";
}) {
  const accentClasses: Record<string, string> = {
    emerald: "border-emerald-500/30 bg-emerald-500/5",
    amber: "border-amber-500/30 bg-amber-500/5",
    cyan: "border-cyan-500/30 bg-cyan-500/5",
    slate: "border-border bg-card",
  };
  return (
    <div
      className={`rounded-lg border p-3 flex flex-col gap-1 ${accentClasses[accent]}`}
    >
      <div className="flex items-center justify-between gap-2">
        <Icon className="h-4 w-4 text-slate-700" />
        <span className="text-2xl font-bold tabular-nums leading-none">
          {value}
        </span>
      </div>
      <p className="text-[10px] uppercase tracking-wide text-slate-700 font-semibold">
        {label}
      </p>
      {hint && (
        <p className="text-[10px] text-slate-700 leading-snug">{hint}</p>
      )}
    </div>
  );
}

function PlaybookRow({
  title,
  when,
  action,
}: {
  title: string;
  when: string;
  action: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-[11px] text-slate-700 mt-1">
        <span className="font-semibold text-foreground/70">When: </span>
        {when}
      </p>
      <p className="text-[11px] text-slate-700 mt-1">
        <span className="font-semibold text-foreground/70">Do: </span>
        {action}
      </p>
    </div>
  );
}

function QuickLink({
  label,
  tab,
  onNavigateTab,
}: {
  label: string;
  tab: string;
  onNavigateTab?: (tab: string) => void;
}) {
  const handleClick = () => {
    if (onNavigateTab) onNavigateTab(tab);
  };
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-9 justify-between text-xs"
      onClick={handleClick}
      disabled={!onNavigateTab}
    >
      <span className="truncate">{label}</span>
      <ExternalLink className="h-3 w-3 shrink-0 ml-1.5" />
    </Button>
  );
}
