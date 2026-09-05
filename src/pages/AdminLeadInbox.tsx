/**
 * LeadInbox — Sprint 3
 *
 * Operator triage desk: list every lead with filters (date range, county,
 * verified, stage), search, and quick actions (view, mark stale/ghost).
 * Lives at /admin/leads and is the default "front door" for operators.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Filter,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Phone,
  MapPin,
  Inbox,
  RefreshCcw,
  Copy,
  Check,
  Flame,
  Save,
} from "lucide-react";
import { format, formatDistanceToNow, subDays } from "date-fns";
import { AdminShell } from "@/components/admin/shell/AdminShell";
import { AdminGlobalNav } from "@/components/admin/shell/AdminGlobalNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  invokeAdminData,
  getErrorMessage,
  updateLeadDisposition,
} from "@/services/adminDataService";
import type { CRMLead } from "@/components/admin/types";
import { FUNNEL_STAGES, getStageDef } from "@/components/admin/leadWorkflow";
import { formatLatestActivityLabel } from "@/lib/formatLatestActivityLabel";
import { QuoteViewerButton } from "@/components/admin/QuoteViewerButton";
import { LeadIdentity } from "@/components/admin/LeadIdentity";
import { matchesAdminLeadSearch } from "@/lib/adminLeadSearch";
import {
  DEFAULT_INBOX_FILTERS,
  inboxFilterSignature,
  useAdminLeadInboxState,
  useInboxDirectoryScroll,
} from "@/hooks/useAdminLeadInboxState";
import { useAdminLeadSelection } from "@/hooks/useAdminLeadSelection";
import { LeadDossierSheet } from "@/components/admin/LeadDossierSheet";

type DateRange = "all" | "24h" | "7d" | "30d";
type VerifiedFilter = "all" | "verified" | "unverified";
type SourceFilter = "all" | "power-tool-demo";
type ShortcutFilter = "all" | "yes" | "no";
type FollowUpPriority =
  "Quote Holder" | "Hot" | "Warm" | "Researching" | "Incomplete";
type PriorityFilter = "all" | FollowUpPriority;

type PowerToolDemoIntake = {
  intake_status: string | null;
  intake_property: string | null;
  intake_scope: string | null;
  intake_logistics: string | null;
  intake_timeline: string | null;
  quote_holder_shortcut: boolean;
};

type InboxLead = CRMLead & {
  source: string | null;
  client_slug: string | null;
  qualification_answers_json: Record<string, unknown> | null;
  powerToolDemoIntake: PowerToolDemoIntake | null;
  admin_disposition: string | null;
  admin_priority_override: string | null;
  admin_follow_up_at: string | null;
  admin_last_contacted_at: string | null;
  admin_disposition_updated_at: string | null;
  last_activity_at: string | null;
  latest_activity_type: string | null;
};

type RawInboxLead = Omit<Partial<InboxLead>, "qualification_answers_json"> & {
  id: string;
  created_at: string;
  lead_source?: string | null;
  qualification_answers_json?: unknown;
};

type LeadDisposition =
  | "new"
  | "needs_contact"
  | "contacted"
  | "follow_up"
  | "not_qualified"
  | "closed";

type PriorityOverride = "hot" | "warm" | "cold" | "none";

const DISPOSITION_OPTIONS: { value: LeadDisposition; label: string }[] = [
  { value: "new", label: "New" },
  { value: "needs_contact", label: "Needs contact" },
  { value: "contacted", label: "Contacted" },
  { value: "follow_up", label: "Follow up" },
  { value: "not_qualified", label: "Not qualified" },
  { value: "closed", label: "Closed" },
];

const PRIORITY_OVERRIDE_OPTIONS: { value: PriorityOverride; label: string }[] =
  [
    { value: "none", label: "Auto priority" },
    { value: "hot", label: "Hot" },
    { value: "warm", label: "Warm" },
    { value: "cold", label: "Cold" },
  ];

const DISPOSITION_LABEL: Record<LeadDisposition, string> = {
  new: "New",
  needs_contact: "Needs contact",
  contacted: "Contacted",
  follow_up: "Follow up",
  not_qualified: "Not qualified",
  closed: "Closed",
};

const DISPOSITION_BADGE_CLASS: Record<LeadDisposition, string> = {
  new: "wm-lead-status--neutral",
  needs_contact: "wm-lead-status--attention",
  contacted: "wm-lead-status--attention",
  follow_up: "wm-lead-status--active",
  not_qualified: "wm-lead-status--neutral",
  closed: "wm-lead-status--resolved",
};

const OVERRIDE_BADGE_CLASS: Record<
  Exclude<PriorityOverride, "none">,
  string
> = {
  hot: "wm-lead-status--danger",
  warm: "wm-lead-status--active",
  cold: "wm-lead-status--neutral",
};

function normalizeDisposition(
  value: string | null | undefined,
): LeadDisposition {
  if (value && value in DISPOSITION_LABEL) return value as LeadDisposition;
  return "new";
}

function normalizeOverride(value: string | null | undefined): PriorityOverride {
  if (value === "hot" || value === "warm" || value === "cold") return value;
  return "none";
}

/** ISO timestamp → value for a <input type="datetime-local"> (local time, no seconds). */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const DEMO_FUNNEL_STAGES = [
  { value: "demo_intake_complete", label: "Demo intake complete" },
  { value: "demo_quote_holder_shortcut", label: "Demo quote shortcut" },
] as const;

const POWER_TOOL_DEMO_SOURCE = "power-tool-demo";

const LARGE_SCOPE_OPTIONS = new Set([
  "6 to 10 Openings",
  "11 to 15 Openings",
  "16+ Openings",
]);

const PRIORITY_RANK: Record<FollowUpPriority, number> = {
  "Quote Holder": 5,
  Hot: 4,
  Warm: 3,
  Researching: 2,
  Incomplete: 1,
};

const PRIORITY_BADGE_CLASS: Record<FollowUpPriority, string> = {
  "Quote Holder": "wm-lead-status--attention",
  Hot: "wm-lead-status--danger",
  Warm: "wm-lead-status--active",
  Researching: "wm-lead-status--neutral",
  Incomplete: "wm-lead-status--neutral",
};

function stageStatusClass(stage: string | null | undefined): string {
  if (stage === "booked" || stage === "closed")
    return "wm-lead-status--resolved";
  if (stage === "contacted" || stage === "routed")
    return "wm-lead-status--attention";
  if (stage === "ghost" || stage === "stale") return "wm-lead-status--danger";
  return "wm-lead-status--active";
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function isLargeScope(scope: string | null | undefined): boolean {
  return !!scope && LARGE_SCOPE_OPTIONS.has(scope);
}

function isHotTimeline(timeline: string | null | undefined): boolean {
  if (!timeline) return false;
  return timeline.includes("Immediate") || timeline.includes("1-3 Months");
}

function isDemoIntakeComplete(lead: InboxLead): boolean {
  return (
    lead.funnel_stage === "demo_intake_complete" ||
    lead.funnel_stage === "demo_quote_holder_shortcut"
  );
}

function isQuoteHolderLead(lead: InboxLead): boolean {
  const intake = lead.powerToolDemoIntake;
  return (
    intake?.quote_holder_shortcut === true ||
    lead.funnel_stage === "demo_quote_holder_shortcut" ||
    intake?.intake_status === "Already have a quote to check"
  );
}

function hasUsableContact(lead: InboxLead): boolean {
  return !!(lead.phone_e164?.trim() || lead.email?.trim());
}

function hasMostIntakeFields(intake: PowerToolDemoIntake | null): boolean {
  if (!intake) return false;
  const filled = [
    intake.intake_status,
    intake.intake_property,
    intake.intake_scope,
    intake.intake_logistics,
    intake.intake_timeline,
  ].filter(Boolean).length;
  return filled >= 3;
}

/**
 * Exclusive priority — first match wins:
 * Quote Holder → Hot → Warm → Researching → Incomplete
 */
function computeFollowUpPriority(lead: InboxLead): FollowUpPriority | null {
  if (lead.source !== POWER_TOOL_DEMO_SOURCE) return null;

  const intake = lead.powerToolDemoIntake;
  const hasPhone = !!lead.phone_e164?.trim();
  const intakeComplete = isDemoIntakeComplete(lead);

  if (isQuoteHolderLead(lead)) return "Quote Holder";

  if (
    hasPhone &&
    isHotTimeline(intake?.intake_timeline) &&
    (intakeComplete || isLargeScope(intake?.intake_scope))
  ) {
    return "Hot";
  }

  if (hasPhone && intakeComplete) return "Warm";

  if (
    intake?.intake_status === "Just researching options" ||
    intake?.intake_timeline === "New Construction / Just Researching"
  ) {
    return "Researching";
  }

  if (
    !hasUsableContact(lead) ||
    !hasMostIntakeFields(intake) ||
    !intakeComplete
  ) {
    return "Incomplete";
  }

  return "Incomplete";
}

function priorityRank(priority: FollowUpPriority | null): number {
  if (!priority) return 0;
  return PRIORITY_RANK[priority];
}

function parsePowerToolDemoIntake(
  source: string | null,
  qa: Record<string, unknown> | null,
): PowerToolDemoIntake | null {
  if (source !== POWER_TOOL_DEMO_SOURCE || !qa) return null;
  return {
    intake_status: asString(qa.intake_status),
    intake_property: asString(qa.intake_property),
    intake_scope: asString(qa.intake_scope),
    intake_logistics: asString(qa.intake_logistics),
    intake_timeline: asString(qa.intake_timeline),
    quote_holder_shortcut: qa.quote_holder_shortcut === true,
  };
}

function toLead(raw: RawInboxLead): InboxLead {
  const source = raw.source ?? raw.lead_source ?? null;
  const qualification_answers_json =
    raw.qualification_answers_json &&
    typeof raw.qualification_answers_json === "object"
      ? (raw.qualification_answers_json as Record<string, unknown>)
      : null;

  return {
    id: raw.id,
    session_id: raw.session_id,
    first_name: raw.first_name ?? null,
    last_name: raw.last_name ?? null,
    email: raw.email ?? null,
    phone_e164: raw.phone_e164 ?? null,
    county: raw.county ?? null,
    city: raw.city ?? null,
    state: raw.state ?? null,
    zip: raw.zip ?? null,
    grade: raw.grade ?? null,
    grade_score: raw.grade_score ?? null,
    window_count: raw.window_count ?? null,
    quote_amount: raw.quote_amount ?? null,
    phone_verified: raw.phone_verified ?? false,
    phone_verified_at: raw.phone_verified_at ?? null,
    latest_analysis_id: raw.latest_analysis_id ?? null,
    latest_scan_session_id: raw.latest_scan_session_id ?? null,
    latest_opportunity_id: raw.latest_opportunity_id ?? null,
    status: raw.status ?? null,
    funnel_stage: raw.funnel_stage ?? null,
    flag_count: raw.flag_count ?? 0,
    red_flag_count: raw.red_flag_count ?? 0,
    amber_flag_count: raw.amber_flag_count ?? 0,
    critical_flag_count: raw.critical_flag_count ?? 0,
    confidence_score: raw.confidence_score ?? null,
    lead_score: raw.lead_score ?? null,
    scan_count: raw.scan_count ?? 0,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    deal_status: raw.deal_status ?? null,
    last_call_intent: raw.last_call_intent ?? null,
    assigned_partner: "Primary Client",
    project_type: raw.project_type ?? null,
    quote_range: raw.quote_range ?? null,
    utm_source: raw.utm_source ?? null,
    utm_medium: raw.utm_medium ?? null,
    utm_campaign: raw.utm_campaign ?? null,
    gclid: raw.gclid ?? null,
    fbclid: raw.fbclid ?? null,
    landing_page_url: raw.landing_page_url ?? null,
    initial_referrer: raw.initial_referrer ?? null,
    report_unlocked_at: raw.report_unlocked_at ?? null,
    intro_requested_at: raw.intro_requested_at ?? null,
    routed_to_contractor_at: raw.routed_to_contractor_at ?? null,
    appointment_booked_at: raw.appointment_booked_at ?? null,
    replacement_quote_submitted_at: null,
    closed_at: raw.closed_at ?? null,
    reactivation_email_sent_at: raw.reactivation_email_sent_at ?? null,
    last_call_completed_at: raw.last_call_completed_at ?? null,
    last_call_status: raw.last_call_status ?? null,
    last_call_outcome: raw.last_call_outcome ?? null,
    last_call_summary: null,
    deal_value: raw.deal_value ?? null,
    revenue_amount: raw.revenue_amount ?? null,
    source,
    client_slug: raw.client_slug ?? null,
    qualification_answers_json,
    powerToolDemoIntake: parsePowerToolDemoIntake(
      source,
      qualification_answers_json,
    ),
    admin_disposition: raw.admin_disposition ?? null,
    admin_priority_override: raw.admin_priority_override ?? null,
    admin_follow_up_at: raw.admin_follow_up_at ?? null,
    admin_last_contacted_at: raw.admin_last_contacted_at ?? null,
    admin_disposition_updated_at: raw.admin_disposition_updated_at ?? null,
    last_activity_at: raw.last_activity_at ?? null,
    latest_activity_type: raw.latest_activity_type ?? null,
  };
}

function formatStageLabel(funnelStage: string | null | undefined): string {
  if (!funnelStage) return "New";
  const known = getStageDef(funnelStage);
  if (known) return known.label;
  const demo = DEMO_FUNNEL_STAGES.find((s) => s.value === funnelStage);
  if (demo) return demo.label;
  return funnelStage.replace(/_/g, " ");
}

type LeadOpsCountLead = {
  latest_analysis_id?: string | null;
  phone_verified?: boolean | null;
};

const isLeadStuck = (lead: LeadOpsCountLead): boolean =>
  Boolean(lead.latest_analysis_id) && lead.phone_verified !== true;

export default function LeadInbox() {
  const [search, setSearch] = useState("");

  useEffect(() => {
    document.title = "Lead Inbox · WindowMan Admin";
  }, []);

  const {
    data: rawLeads = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["admin", "leads"],
    queryFn: async () => {
      const result = await invokeAdminData("fetch_leads");
      return (result ?? []) as RawInboxLead[];
    },
    staleTime: 30_000,
  });

  const leads = useMemo(() => rawLeads.map(toLead), [rawLeads]);

  const leadOpsCounts = useMemo(() => {
    const now = new Date();
    return {
      due: leads.filter((lead) => {
        if (!lead.admin_follow_up_at) return false;
        return new Date(lead.admin_follow_up_at) <= now;
      }).length,
      hot: leads.filter((lead) => lead.admin_priority_override === "hot")
        .length,
      stuck: leads.filter(isLeadStuck).length,
    };
  }, [leads]);

  const counties = useMemo(() => {
    const set = new Set<string>();
    for (const l of leads) if (l.county) set.add(l.county);
    return Array.from(set).sort();
  }, [leads]);

  const {
    filters,
    updateFilters,
    setRange,
    setCounty,
    setVerified,
    setStage,
    setSource,
    setShortcut,
    setPriority,
    captureScroll,
    restoreScroll,
    resetScroll,
  } = useAdminLeadInboxState(counties);

  const {
    selectedLead,
    isOpen,
    presentation,
    openHref,
    openLead,
    closeLead,
  } = useAdminLeadSelection(leads, {
    isReady: !isLoading && !isError,
    onBeforeOpen: captureScroll,
  });

  const dateRange = filters.range;
  const county = filters.county;
  const verified = filters.verified;
  const stage = filters.stage;
  const sourceFilter = filters.source;
  const shortcutFilter = filters.shortcut;
  const priorityFilter = filters.priority;

  useInboxDirectoryScroll({
    filters,
    search,
    isReady: !isLoading && !isError,
    captureScroll,
    restoreScroll,
    resetScroll,
  });

  const demoPriorityCounts = useMemo(() => {
    let hot = 0;
    let quoteHolder = 0;
    for (const l of leads) {
      if (l.source !== POWER_TOOL_DEMO_SOURCE) continue;
      const p = computeFollowUpPriority(l);
      if (p === "Hot") hot += 1;
      if (p === "Quote Holder") quoteHolder += 1;
    }
    return { hot, quoteHolder };
  }, [leads]);

  const filtered = useMemo(() => {
    const cutoff =
      dateRange === "24h"
        ? subDays(new Date(), 1)
        : dateRange === "7d"
          ? subDays(new Date(), 7)
          : dateRange === "30d"
            ? subDays(new Date(), 30)
            : null;
    const q = search.trim().toLowerCase();

    const matched = leads.filter((l) => {
      if (cutoff && new Date(l.created_at) < cutoff) return false;
      if (county !== "all" && l.county !== county) return false;
      if (verified === "verified" && !l.phone_verified) return false;
      if (verified === "unverified" && l.phone_verified) return false;
      if (
        sourceFilter === "power-tool-demo" &&
        l.source !== POWER_TOOL_DEMO_SOURCE
      )
        return false;
      if (stage !== "all" && (l.funnel_stage ?? "new") !== stage) return false;

      if (shortcutFilter !== "all") {
        const shortcut = l.powerToolDemoIntake?.quote_holder_shortcut === true;
        if (shortcutFilter === "yes" && !shortcut) return false;
        if (shortcutFilter === "no" && shortcut) return false;
      }

      if (priorityFilter !== "all") {
        if (computeFollowUpPriority(l) !== priorityFilter) return false;
      }

      if (q) {
        const intake = l.powerToolDemoIntake;
        const extraValues = [
          intake?.intake_status,
          intake?.intake_property,
          intake?.intake_scope,
          intake?.intake_logistics,
          intake?.intake_timeline,
        ];
        if (!matchesAdminLeadSearch(l, q, extraValues)) return false;
      }
      return true;
    });

    return [...matched].sort((a, b) => {
      const rankDiff =
        priorityRank(computeFollowUpPriority(b)) -
        priorityRank(computeFollowUpPriority(a));
      if (rankDiff !== 0) return rankDiff;
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  }, [
    leads,
    dateRange,
    county,
    verified,
    stage,
    sourceFilter,
    shortcutFilter,
    priorityFilter,
    search,
  ]);

  const resetFilters = () => {
    setSearch("");
    updateFilters(DEFAULT_INBOX_FILTERS);
  };

  const powerToolDemoCount = useMemo(
    () => leads.filter((l) => l.source === POWER_TOOL_DEMO_SOURCE).length,
    [leads],
  );

  const subtitle = useMemo(() => {
    const base = `${filtered.length} of ${leads.length} leads`;
    if (sourceFilter !== "power-tool-demo") return base;
    const parts: string[] = [];
    if (demoPriorityCounts.hot > 0) parts.push(`${demoPriorityCounts.hot} hot`);
    if (demoPriorityCounts.quoteHolder > 0)
      parts.push(`${demoPriorityCounts.quoteHolder} quote holders`);
    return parts.length ? `${base} · ${parts.join(" · ")}` : base;
  }, [filtered.length, leads.length, sourceFilter, demoPriorityCounts]);

  const activeFilterCount = [
    search.trim() ? "search" : null,
    dateRange !== "all" ? "date" : null,
    county !== "all" ? "county" : null,
    verified !== "all" ? "verification" : null,
    stage !== "all" ? "stage" : null,
    sourceFilter !== "all" ? "source" : null,
    shortcutFilter !== "all" ? "quote" : null,
    priorityFilter !== "all" ? "priority" : null,
  ].filter(Boolean).length;

  const filterSignature = inboxFilterSignature(filters);
  const lastAnnouncedFilterSignature = useRef(filterSignature);
  const [filterCountAnnouncement, setFilterCountAnnouncement] = useState("");

  useEffect(() => {
    if (lastAnnouncedFilterSignature.current === filterSignature) return;
    lastAnnouncedFilterSignature.current = filterSignature;
    setFilterCountAnnouncement(`${subtitle} · priority order`);
  }, [filterSignature, subtitle]);

  return (
    <AdminShell
      eyebrow="Operator · Triage"
      title="Lead Inbox"
      subtitle="Scan-first operator queue"
      nav={<AdminGlobalNav />}
      fullBleed
    >
      <div className="wm-lead-inbox">
        <div className="wm-lead-inbox__layout">
          <aside
            className="wm-lead-command-rail"
            aria-label="Lead Inbox controls"
          >
            <div className="wm-lead-command-rail__title">
              <p className="wm-lead-kicker">Operator · Triage</p>
              <p>Queue filters and search stay on this rail.</p>
            </div>
            <InboxToolbar counts={leadOpsCounts} />
            <FilterBar
              search={search}
              setSearch={setSearch}
              dateRange={dateRange}
              setDateRange={setRange}
              county={county}
              setCounty={setCounty}
              counties={counties}
              verified={verified}
              setVerified={setVerified}
              stage={stage}
              setStage={(value) => setStage(value as typeof stage)}
              sourceFilter={sourceFilter}
              setSourceFilter={setSource}
              shortcutFilter={shortcutFilter}
              setShortcutFilter={setShortcut}
              priorityFilter={priorityFilter}
              setPriorityFilter={setPriority}
              onReset={resetFilters}
              activeFilterCount={activeFilterCount}
            />
          </aside>

          <section className="wm-lead-directory" aria-label="Lead directory">
            <div className="wm-lead-directory__header">
              <div>
                <p className="text-base font-bold text-white">
                  {`${subtitle} · priority order`}
                </p>
                <p aria-live="polite" className="sr-only">
                  {filterCountAnnouncement}
                </p>
                <p>
                  {activeFilterCount > 0
                    ? `${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}`
                    : "Focus on overdue follow-ups and urgent leads first."}
                </p>
              </div>
              <Button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching && !isLoading}
                className="wm-lead-primary-control min-h-11 px-4 text-sm font-bold"
              >
                <RefreshCcw
                  className={`mr-2 h-4 w-4 ${isFetching && !isLoading ? "animate-spin motion-reduce:animate-none" : ""}`}
                />
                {isFetching && !isLoading ? "Refreshing" : "Refresh Inbox"}
              </Button>
            </div>

            <div className="wm-lead-directory__body">
              {isLoading ? (
                <ul
                  aria-busy="true"
                  aria-label="Loading leads"
                  className="wm-lead-results"
                >
                  {[0, 1, 2, 3].map((slot) => (
                    <li key={slot}>
                      <article className="wm-lead-card wm-lead-card--neutral overflow-hidden">
                        <div className="wm-lead-card__identity-and-actions flex flex-col gap-4 px-4 py-4 sm:px-5">
                          <div className="h-6 w-48 max-w-full rounded-sm bg-slate-600/40 motion-safe:animate-pulse" />
                          <div className="h-4 w-72 max-w-full rounded-sm bg-slate-600/30 motion-safe:animate-pulse" />
                        </div>
                        <div className="wm-lead-card__facts grid gap-4 border-t border-slate-700/40 px-4 py-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-4">
                          <div className="h-16 rounded-sm bg-slate-600/20 motion-safe:animate-pulse" />
                          <div className="h-16 rounded-sm bg-slate-600/20 motion-safe:animate-pulse" />
                          <div className="h-16 rounded-sm bg-slate-600/20 motion-safe:animate-pulse" />
                          <div className="h-16 rounded-sm bg-slate-600/20 motion-safe:animate-pulse" />
                        </div>
                      </article>
                    </li>
                  ))}
                </ul>
              ) : isError ? (
                <div
                  role="alert"
                  className="wm-lead-state wm-lead-state--error flex items-start gap-2 px-4 py-5 text-sm"
                >
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-bold">Couldn't load leads</p>
                    <p className="mt-0.5">{getErrorMessage(error)}</p>
                    <button
                      onClick={() => refetch()}
                      className="mt-2 min-h-11 text-xs font-bold underline"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              ) : filtered.length === 0 ? (
                <div className="wm-lead-state px-6 py-16 text-center">
                  <Inbox className="mx-auto mb-3 h-8 w-8" />
                  <h2 className="font-display text-lg font-extrabold tracking-tight text-white">
                    {sourceFilter === "power-tool-demo" &&
                    powerToolDemoCount === 0
                      ? "No PowerToolDemo leads yet"
                      : "No leads match"}
                  </h2>
                  <p className="mx-auto mt-1 max-w-lg text-sm font-semibold">
                    {sourceFilter === "power-tool-demo" &&
                    powerToolDemoCount === 0
                      ? "PowerToolDemo captures will appear here once homeowners complete the demo intake."
                      : "Try clearing filters or widening the date range."}
                  </p>
                  <Button
                    variant="outline"
                    onClick={resetFilters}
                    className="wm-lead-control mt-4 min-h-11"
                  >
                    Clear filters
                  </Button>
                </div>
              ) : (
                <LeadList
                  leads={filtered}
                  openHref={openHref}
                  onOpenLead={openLead}
                />
              )}
            </div>
          </section>
        </div>
      </div>
      <LeadDossierSheet
        lead={selectedLead}
        open={isOpen}
        presentation={presentation}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closeLead();
        }}
      />
    </AdminShell>
  );
}

function InboxToolbar({
  counts,
}: {
  counts: { due: number; hot: number; stuck: number };
}) {
  return (
    <section aria-label="Lead queue summary" className="wm-lead-toolbar">
      <dl className="grid gap-1.5">
        {[
          {
            label: "Due follow-ups",
            value: counts.due,
            tone: "danger",
            Icon: Clock,
          },
          {
            label: "Hot leads",
            value: counts.hot,
            tone: "danger",
            Icon: Flame,
          },
          {
            label: "Stuck in workflow",
            value: counts.stuck,
            tone: "attention",
            Icon: AlertCircle,
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className={`wm-lead-metric wm-lead-metric--${metric.value > 0 ? metric.tone : "neutral"}`}
          >
            <metric.Icon className="h-4 w-4" aria-hidden="true" />
            <dt>{metric.label}</dt>
            <dd>{metric.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

interface FilterBarProps {
  search: string;
  setSearch: (v: string) => void;
  dateRange: DateRange;
  setDateRange: (v: DateRange) => void;
  county: string;
  setCounty: (v: string) => void;
  counties: string[];
  verified: VerifiedFilter;
  setVerified: (v: VerifiedFilter) => void;
  stage: string;
  setStage: (v: string) => void;
  sourceFilter: SourceFilter;
  setSourceFilter: (v: SourceFilter) => void;
  shortcutFilter: ShortcutFilter;
  setShortcutFilter: (v: ShortcutFilter) => void;
  priorityFilter: PriorityFilter;
  setPriorityFilter: (v: PriorityFilter) => void;
  onReset: () => void;
  activeFilterCount: number;
}

function FilterBar({
  search,
  setSearch,
  dateRange,
  setDateRange,
  county,
  setCounty,
  counties,
  verified,
  setVerified,
  stage,
  setStage,
  sourceFilter,
  setSourceFilter,
  shortcutFilter,
  setShortcutFilter,
  priorityFilter,
  setPriorityFilter,
  onReset,
  activeFilterCount,
}: FilterBarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <section aria-label="Lead filters" className="wm-lead-filter-panel">
      <div className="grid gap-3">
        <label className="min-w-0">
          <span className="mb-1.5 block text-xs font-semibold text-slate-700">
            Search leads
          </span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, email, phone, ZIP, or ID"
              className="wm-lead-control h-11 pl-9 text-sm font-medium"
              aria-label="Search leads"
            />
          </span>
        </label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            aria-expanded={filtersOpen}
            aria-controls="lead-secondary-filters"
            onClick={() => setFiltersOpen((open) => !open)}
            className="wm-lead-control min-h-11 flex-1 text-sm font-semibold xl:hidden"
          >
            <Filter className="mr-2 h-4 w-4" />
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            <ChevronDown
              className={`ml-auto h-4 w-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`}
            />
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onReset}
            disabled={activeFilterCount === 0}
            className="wm-lead-control min-h-11 flex-1 px-4 text-sm font-semibold"
            aria-label="Clear all filters and search"
          >
            Clear all
          </Button>
        </div>
      </div>

      <div
        id="lead-secondary-filters"
        className={`${filtersOpen ? "grid" : "hidden"} wm-lead-filter-grid mt-4 gap-3 xl:grid`}
      >
        <FilterSelect label="Date range">
          <Select
            value={dateRange}
            onValueChange={(v) => setDateRange(v as DateRange)}
          >
            <SelectTrigger
              className="wm-lead-control h-11 w-full text-sm font-medium"
              aria-label="Date range"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </FilterSelect>
        <FilterSelect label="Source">
          <Select
            value={sourceFilter}
            onValueChange={(v) => setSourceFilter(v as SourceFilter)}
          >
            <SelectTrigger
              className="wm-lead-control h-11 w-full text-sm font-medium"
              aria-label="Lead source"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="power-tool-demo">Power Tool Demo</SelectItem>
            </SelectContent>
          </Select>
        </FilterSelect>
        <FilterSelect label="Priority">
          <Select
            value={priorityFilter}
            onValueChange={(v) => setPriorityFilter(v as PriorityFilter)}
          >
            <SelectTrigger
              className="wm-lead-control h-11 w-full text-sm font-medium"
              aria-label="Lead priority"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="Quote Holder">Quote Holder</SelectItem>
              <SelectItem value="Hot">Hot</SelectItem>
              <SelectItem value="Warm">Warm</SelectItem>
              <SelectItem value="Researching">Researching</SelectItem>
              <SelectItem value="Incomplete">Incomplete</SelectItem>
            </SelectContent>
          </Select>
        </FilterSelect>
        <FilterSelect label="County">
          <Select value={county} onValueChange={setCounty}>
            <SelectTrigger
              className="wm-lead-control h-11 w-full text-sm font-medium"
              aria-label="Lead county"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All counties</SelectItem>
              {counties.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterSelect>
        <FilterSelect label="Phone verification">
          <Select
            value={verified}
            onValueChange={(v) => setVerified(v as VerifiedFilter)}
          >
            <SelectTrigger
              className="wm-lead-control h-11 w-full text-sm font-medium"
              aria-label="Phone verification"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All verification states</SelectItem>
              <SelectItem value="verified">Phone verified</SelectItem>
              <SelectItem value="unverified">Phone unverified</SelectItem>
            </SelectContent>
          </Select>
        </FilterSelect>
        <FilterSelect label="Stage">
          <Select value={stage} onValueChange={setStage}>
            <SelectTrigger
              className="wm-lead-control h-11 w-full text-sm font-medium"
              aria-label="Lead stage"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {FUNNEL_STAGES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
              {DEMO_FUNNEL_STAGES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterSelect>
        {sourceFilter === "power-tool-demo" ? (
          <FilterSelect label="Quote status">
            <Select
              value={shortcutFilter}
              onValueChange={(v) => setShortcutFilter(v as ShortcutFilter)}
            >
              <SelectTrigger
                className="wm-lead-control h-11 w-full text-sm font-medium"
                aria-label="Quote status"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All quote states</SelectItem>
                <SelectItem value="yes">Has quote</SelectItem>
                <SelectItem value="no">No quote</SelectItem>
              </SelectContent>
            </Select>
          </FilterSelect>
        ) : null}
      </div>

      {activeFilterCount > 0 ? (
        <div className="wm-lead-active-filters mt-3 flex items-center gap-2 border-t pt-3 text-xs font-semibold">
          <Filter className="h-3.5 w-3.5" />
          <span>
            {activeFilterCount} active{" "}
            {activeFilterCount === 1 ? "filter" : "filters"}
          </span>
        </div>
      ) : null}
    </section>
  );
}

function FilterSelect({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <span className="wm-lead-filter-label mb-1.5 block text-xs font-semibold">
        {label}
      </span>
      {children}
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — fail silently
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      className="wm-lead-copy-button inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {copied ? (
        <Check className="h-4 w-4 text-emerald-600" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </button>
  );
}

function IntakeBadge({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  if (!value) return null;
  return (
    <span
      className="inline-flex max-w-full items-center rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-950"
      title={value}
    >
      <span className="mr-1 uppercase tracking-wide text-violet-700">
        {label}:
      </span>
      <span className="truncate">{value}</span>
    </span>
  );
}

function IntakeSummaryColumn({ intake }: { intake: PowerToolDemoIntake }) {
  const hasAny =
    intake.intake_status ||
    intake.intake_property ||
    intake.intake_scope ||
    intake.intake_logistics ||
    intake.intake_timeline ||
    intake.quote_holder_shortcut;

  if (!hasAny) {
    return (
      <span className="text-xs font-medium text-slate-500">
        No intake captured yet
      </span>
    );
  }

  return (
    <div className="space-y-1.5 min-w-[200px] max-w-[280px]">
      <div className="flex flex-wrap gap-1">
        <IntakeBadge label="Status" value={intake.intake_status} />
        <IntakeBadge label="Property" value={intake.intake_property} />
        <IntakeBadge label="Timeline" value={intake.intake_timeline} />
      </div>
      <div className="flex flex-wrap gap-1">
        <IntakeBadge label="Scope" value={intake.intake_scope} />
        <IntakeBadge label="Logistics" value={intake.intake_logistics} />
        <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-950">
          Quote: {intake.quote_holder_shortcut ? "yes" : "no"}
        </span>
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: FollowUpPriority | null }) {
  if (!priority) {
    return (
      <span className="text-sm font-medium text-slate-600">
        Standard priority
      </span>
    );
  }

  return (
    <span className={`wm-lead-status ${PRIORITY_BADGE_CLASS[priority]}`}>
      {priority === "Hot" ? <Flame className="h-3.5 w-3.5" /> : null}
      {priority}
    </span>
  );
}

function DispositionEditor({ lead, name }: { lead: InboxLead; name: string }) {
  const [disposition, setDisposition] = useState<LeadDisposition>(() =>
    normalizeDisposition(lead.admin_disposition),
  );
  const [override, setOverride] = useState<PriorityOverride>(() =>
    normalizeOverride(lead.admin_priority_override),
  );
  const [followUp, setFollowUp] = useState<string>(() =>
    isoToLocalInput(lead.admin_follow_up_at),
  );
  const [saved, setSaved] = useState(() => ({
    disposition: normalizeDisposition(lead.admin_disposition),
    override: normalizeOverride(lead.admin_priority_override),
    followUp: isoToLocalInput(lead.admin_follow_up_at),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [open, setOpen] = useState(false);

  const dirty =
    disposition !== saved.disposition ||
    override !== saved.override ||
    followUp !== saved.followUp;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setJustSaved(false);
    try {
      const followUpIso = followUp ? new Date(followUp).toISOString() : null;
      await updateLeadDisposition({
        lead_id: lead.id,
        admin_disposition: disposition,
        admin_priority_override: override,
        admin_follow_up_at: followUpIso,
      });
      setSaved({ disposition, override, followUp });
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 1500);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const editorId = `workflow-editor-${lead.id}`;
  const savedFollowUp = saved.followUp ? new Date(saved.followUp) : null;
  const savedFollowUpLabel =
    savedFollowUp && !Number.isNaN(savedFollowUp.getTime())
      ? format(savedFollowUp, "MMM d, h:mm a")
      : "No follow-up scheduled";

  return (
    <div className="wm-lead-workflow border-t px-4 py-3 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <span className="text-xs font-semibold text-slate-600">
            Disposition
          </span>
          <span
            className={`wm-lead-status ${DISPOSITION_BADGE_CLASS[saved.disposition]}`}
          >
            {DISPOSITION_LABEL[saved.disposition]}
          </span>
          {saved.override !== "none" ? (
            <span
              className={`wm-lead-status ${OVERRIDE_BADGE_CLASS[saved.override]}`}
            >
              {saved.override.charAt(0).toUpperCase() + saved.override.slice(1)}{" "}
              override
            </span>
          ) : null}
          <span className="text-xs font-medium text-slate-600">
            {savedFollowUpLabel}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          aria-expanded={open}
          aria-controls={editorId}
          onClick={() => setOpen((value) => !value)}
          className="wm-lead-control min-h-11 justify-between px-3 text-sm font-semibold sm:justify-center"
        >
          Edit workflow
          <ChevronDown
            className={`ml-2 h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </Button>
      </div>

      {open ? (
        <div
          id={editorId}
          className="wm-lead-workflow-editor mt-4 rounded-lg border p-4"
        >
          <div className="grid gap-3 md:grid-cols-3">
            <FilterSelect label="Disposition">
              <Select
                value={disposition}
                onValueChange={(v) => setDisposition(v as LeadDisposition)}
              >
                <SelectTrigger
                  className="wm-lead-control h-11 w-full text-sm font-medium"
                  aria-label={`Disposition for ${name}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISPOSITION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterSelect>
            <FilterSelect label="Priority override">
              <Select
                value={override}
                onValueChange={(v) => setOverride(v as PriorityOverride)}
              >
                <SelectTrigger
                  className="wm-lead-control h-11 w-full text-sm font-medium"
                  aria-label={`Priority override for ${name}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OVERRIDE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterSelect>
            <label>
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">
                Follow-up date and time
              </span>
              <Input
                type="datetime-local"
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                className="wm-lead-control h-11 w-full text-sm font-medium"
                aria-label={`Follow-up date and time for ${name}`}
              />
            </label>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div aria-live="polite" className="min-h-5 text-sm">
              {error ? (
                <p
                  role="alert"
                  className="flex items-start gap-1 font-medium text-red-700"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </p>
              ) : justSaved ? (
                <p
                  role="status"
                  className="flex items-center gap-1 font-medium text-emerald-700"
                >
                  <Check className="h-4 w-4" /> Workflow saved.
                </p>
              ) : dirty ? (
                <p className="font-medium text-slate-600">
                  Unsaved workflow changes
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving || !dirty}
              variant={dirty ? "default" : "outline"}
              className="wm-lead-control min-h-11 min-w-32 text-sm font-semibold"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {saving ? "Saving" : "Save workflow"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatSourceLabel(source: string | null): string {
  if (!source) return "Source not recorded";
  const knownSources: Record<string, string> = {
    "truth-gate": "Truth Gate",
    "windowman-first-quote": "WindowMan First Quote",
    "power-tool-demo": "Power Tool Demo",
  };
  if (knownSources[source]) return knownSources[source];
  return source
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatRelativeTimestamp(
  value: string | null | undefined,
): { relative: string; absolute: string } | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    relative: formatDistanceToNow(date, { addSuffix: true }),
    absolute: format(date, "MMM d, yyyy h:mm a"),
  };
}

function getPipelineStep(stage: string): number {
  if (stage === "closed") return 5;
  if (stage === "booked") return 4;
  if (stage === "routed" || stage === "contacted") return 3;
  if (
    stage === "qualified" ||
    stage === "analyzing" ||
    stage.startsWith("demo_")
  ) {
    return 2;
  }
  return 1;
}

function LeadList({
  leads,
  openHref,
  onOpenLead,
}: {
  leads: InboxLead[];
  openHref: (leadId: string) => string;
  onOpenLead: (leadId: string, launcher?: HTMLElement | null) => void;
}) {
  return (
    <ul aria-label="Lead results" className="wm-lead-results">
      {leads.map((lead) => {
        const name =
          [lead.first_name, lead.last_name].filter(Boolean).join(" ") ||
          "Unknown lead";
        const stageLabel = formatStageLabel(lead.funnel_stage);
        const isPowerToolDemo = lead.source === POWER_TOOL_DEMO_SOURCE;
        const priority = computeFollowUpPriority(lead);
        const override = normalizeOverride(lead.admin_priority_override);
        const latestActivity = formatRelativeTimestamp(lead.last_activity_at);
        const created = formatRelativeTimestamp(lead.created_at);
        const followUp = formatRelativeTimestamp(lead.admin_follow_up_at);
        const followUpDue = lead.admin_follow_up_at
          ? new Date(lead.admin_follow_up_at).getTime() <= Date.now()
          : false;
        const stageValue = lead.funnel_stage ?? "new";
        const signalTone = followUpDue
          ? "attention"
          : stageValue === "booked" || stageValue === "closed"
            ? "resolved"
            : stageValue === "contacted" ||
                stageValue === "routed" ||
                stageValue === "ghost" ||
                stageValue === "stale"
              ? "attention"
              : lead.phone_verified
                ? "active"
                : "neutral";
        const location = [lead.county, lead.state, lead.zip]
          .filter(Boolean)
          .join(", ");
        const pipelineStep = getPipelineStep(stageValue);

        return (
          <li key={lead.id}>
            <article
              className={`wm-lead-card wm-lead-card--${signalTone} overflow-hidden`}
            >
              <div className="wm-lead-card__identity-and-actions flex flex-col gap-4 px-4 py-4 sm:px-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="wm-lead-card__identity min-w-0">
                  <Link
                    to={openHref(lead.id)}
                    onClick={(event) => {
                      event.preventDefault();
                      onOpenLead(lead.id, event.currentTarget);
                    }}
                    className="wm-lead-card__name inline-flex min-h-11 items-center rounded-md text-lg font-bold tracking-tight text-slate-950 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`View details for ${name}`}
                  >
                    {name}
                  </Link>
                  <div className="wm-lead-card__contact-lines mt-1 flex flex-col gap-1 text-sm font-medium text-slate-600">
                    {lead.email ? (
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate" title={lead.email}>
                          {lead.email}
                        </span>
                        <CopyButton
                          value={lead.email}
                          label={`${name} email`}
                        />
                      </span>
                    ) : (
                      <span>Email not provided</span>
                    )}
                    {lead.phone_e164 ? (
                      <span className="flex min-w-0 items-center gap-1.5 font-mono">
                        <Phone className="h-4 w-4 shrink-0" />
                        <span className="truncate">{lead.phone_e164}</span>
                        <CopyButton
                          value={lead.phone_e164}
                          label={`${name} phone`}
                        />
                      </span>
                    ) : (
                      <span>Phone not provided</span>
                    )}
                  </div>
                  <LeadIdentity
                    leadId={lead.id}
                    variant="verdict"
                    className="wm-lead-card__lead-id mt-2 text-xs font-semibold text-slate-600"
                  />
                </div>
                <div className="wm-lead-card__actions flex flex-wrap gap-2">
                  <QuoteViewerButton
                    leadId={lead.id}
                    className="wm-lead-control wm-lead-action-button min-h-11"
                  />
                  <Button
                    asChild
                    className="wm-lead-primary-control wm-lead-action-button min-h-11 px-4 text-sm font-bold"
                  >
                    <Link
                      to={openHref(lead.id)}
                      onClick={(event) => {
                        event.preventDefault();
                        onOpenLead(lead.id, event.currentTarget);
                      }}
                      aria-label={`View lead for ${name}`}
                    >
                      Open lead <ChevronRight className="ml-1.5 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="wm-lead-card__facts grid gap-4 border-t border-slate-200 px-4 py-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-4">
                <section
                  className="wm-lead-card__fact wm-lead-card__priority"
                  aria-label={`Status for ${name}`}
                >
                  <p className="wm-lead-card__label text-xs font-semibold text-slate-600">
                    Status
                  </p>
                  <div className="wm-lead-card__status-badges mt-1.5 flex flex-wrap items-center gap-2">
                    <span
                      className={`wm-lead-status ${lead.phone_verified ? "wm-lead-status--resolved" : "wm-lead-status--neutral"}`}
                    >
                      {lead.phone_verified
                        ? "Phone verified"
                        : "Phone unverified"}
                    </span>
                    <span
                      className={`wm-lead-status ${stageStatusClass(lead.funnel_stage ?? (isPowerToolDemo ? "analyzing" : "new"))}`}
                    >
                      {stageLabel}
                    </span>
                  </div>
                  <div className="wm-lead-card__status-context mt-3">
                    {override !== "none" ? (
                      <span
                        className={`wm-lead-status ${OVERRIDE_BADGE_CLASS[override]}`}
                        title="Manual priority override"
                      >
                        {override.charAt(0).toUpperCase() + override.slice(1)}{" "}
                        override
                      </span>
                    ) : (
                      <PriorityBadge priority={priority} />
                    )}
                  </div>
                </section>

                <section
                  className="wm-lead-card__fact wm-lead-card__pipeline"
                  aria-label={`Workflow stage for ${name}`}
                >
                  <p className="wm-lead-card__label text-xs font-semibold text-slate-600">
                    Pipeline
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Link
                      to={`/admin/pipeline?lead_id=${lead.id}`}
                      aria-label={`Open ${name} in pipeline`}
                      className="wm-lead-card__pipeline-stage inline-flex min-h-11 items-center rounded-sm text-sm font-bold text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {stageLabel}
                    </Link>
                    {lead.report_unlocked_at ? (
                      <span className="text-xs font-medium text-emerald-700">
                        Report unlocked
                      </span>
                    ) : null}
                  </div>
                  <p className="wm-lead-card__pipeline-copy mt-2 text-xs font-semibold text-slate-600">
                    Stage {pipelineStep} of 5
                  </p>
                  <div
                    className="wm-lead-card__pipeline-track mt-2"
                    aria-label={`${stageLabel}: stage ${pipelineStep} of 5`}
                  >
                    {Array.from({ length: 5 }, (_, index) => (
                      <span
                        key={index}
                        className={index < pipelineStep ? "is-active" : ""}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                </section>

                <section
                  className="wm-lead-card__fact wm-lead-card__activity"
                  aria-label={`Latest activity for ${name}`}
                >
                  <p className="wm-lead-card__label text-xs font-semibold text-slate-600">
                    Latest activity
                  </p>
                  <p className="wm-lead-card__operational-value mt-1.5 text-sm font-semibold text-slate-950">
                    {formatLatestActivityLabel(lead.latest_activity_type)}
                  </p>
                  <p className="wm-lead-card__operational-meta mt-0.5 flex items-center gap-1 text-xs font-medium text-slate-600">
                    <Clock className="h-3.5 w-3.5" />
                    {latestActivity ? (
                      <span title={latestActivity.absolute}>
                        {latestActivity.relative}
                      </span>
                    ) : (
                      "No activity recorded"
                    )}
                  </p>
                  <p className="wm-lead-card__operational-meta mt-1 text-xs font-medium text-slate-600">
                    {formatSourceLabel(lead.source)}
                  </p>
                </section>

                <section
                  className="wm-lead-card__fact wm-lead-card__follow-up"
                  aria-label={`Follow-up for ${name}`}
                >
                  <p className="wm-lead-card__label text-xs font-semibold text-slate-600">
                    Next follow-up
                  </p>
                  <p
                    className={`wm-lead-card__operational-value mt-1.5 text-sm font-semibold ${followUpDue ? "text-red-700" : "text-slate-950"}`}
                  >
                    {followUp ? (
                      <span title={followUp.absolute}>{followUp.relative}</span>
                    ) : (
                      "Not scheduled"
                    )}
                  </p>
                  <p className="wm-lead-card__operational-meta mt-0.5 flex items-center gap-1 text-xs font-medium text-slate-600">
                    <MapPin className="h-3.5 w-3.5" />{" "}
                    {location || "Location not provided"}
                  </p>
                </section>
              </div>

              <details className="wm-lead-context border-t border-slate-200 px-4 py-2 sm:px-5">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-md text-sm font-semibold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  More lead context
                  <ChevronDown className="h-4 w-4" />
                </summary>
                <div className="grid gap-4 border-t border-slate-200 py-4 text-sm text-slate-700 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-600">
                      Source and attribution
                    </p>
                    <p className="mt-1 font-semibold text-slate-950">
                      {formatSourceLabel(lead.source)}
                    </p>
                    <p className="mt-1">
                      UTM source: {lead.utm_source || "Not recorded"}
                    </p>
                    <p>UTM campaign: {lead.utm_campaign || "Not recorded"}</p>
                    {lead.client_slug ? (
                      <p>Client: {lead.client_slug}</p>
                    ) : null}
                    <p className="mt-1">
                      Created:{" "}
                      {created ? (
                        <span title={created.absolute}>{created.relative}</span>
                      ) : (
                        "Unknown"
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold text-slate-600">
                      Intake context
                    </p>
                    {isPowerToolDemo && lead.powerToolDemoIntake ? (
                      <IntakeSummaryColumn intake={lead.powerToolDemoIntake} />
                    ) : (
                      <p className="font-medium">
                        No structured intake details recorded.
                      </p>
                    )}
                  </div>
                </div>
              </details>

              <DispositionEditor lead={lead} name={name} />
            </article>
          </li>
        );
      })}
    </ul>
  );
}
