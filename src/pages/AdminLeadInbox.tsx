/**
 * LeadInbox — Sprint 3
 *
 * Operator triage desk: list every lead with filters (date range, county,
 * verified, stage), search, and quick actions (view, mark stale/ghost).
 * Lives at /admin/leads and is the default "front door" for operators.
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search, Filter, Loader2, AlertCircle, ChevronRight, Clock,
  Phone, MapPin, Inbox, RefreshCcw,
} from "lucide-react";
import { format, formatDistanceToNow, subDays } from "date-fns";
import { AdminShell } from "@/components/admin/shell/AdminShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { invokeAdminData, getErrorMessage } from "@/services/adminDataService";
import type { CRMLead } from "@/components/admin/types";
import { FUNNEL_STAGES, getStageDef } from "@/components/admin/leadWorkflow";

type DateRange = "all" | "24h" | "7d" | "30d";
type VerifiedFilter = "all" | "verified" | "unverified";
type SourceFilter = "all" | "power-tool-demo";
type ShortcutFilter = "all" | "yes" | "no";

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
};

const DEMO_FUNNEL_STAGES = [
  { value: "demo_intake_complete", label: "Demo intake complete" },
  { value: "demo_quote_holder_shortcut", label: "Demo quote shortcut" },
] as const;

const POWER_TOOL_DEMO_SOURCE = "power-tool-demo";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
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

function toLead(raw: Record<string, any>): InboxLead {
  const source = raw.source ?? raw.lead_source ?? null;
  const qualification_answers_json =
    raw.qualification_answers_json && typeof raw.qualification_answers_json === "object"
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
    powerToolDemoIntake: parsePowerToolDemoIntake(source, qualification_answers_json),
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

export default function LeadInbox() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [county, setCounty] = useState<string>("all");
  const [verified, setVerified] = useState<VerifiedFilter>("all");
  const [stage, setStage] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [shortcutFilter, setShortcutFilter] = useState<ShortcutFilter>("all");

  // Document title (SEO + a11y)
  useEffect(() => {
    document.title = "Lead Inbox · WindowMan Admin";
  }, []);

  const { data: rawLeads = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["admin", "leads"],
    queryFn: async () => {
      const result = await invokeAdminData("fetch_leads");
      return (result ?? []) as Record<string, any>[];
    },
    staleTime: 30_000,
  });

  const leads = useMemo(() => rawLeads.map(toLead), [rawLeads]);

  const counties = useMemo(() => {
    const set = new Set<string>();
    for (const l of leads) if (l.county) set.add(l.county);
    return Array.from(set).sort();
  }, [leads]);

  const filtered = useMemo(() => {
    const cutoff =
      dateRange === "24h" ? subDays(new Date(), 1)
      : dateRange === "7d" ? subDays(new Date(), 7)
      : dateRange === "30d" ? subDays(new Date(), 30)
      : null;
    const q = search.trim().toLowerCase();

    return leads.filter((l) => {
      if (cutoff && new Date(l.created_at) < cutoff) return false;
      if (county !== "all" && l.county !== county) return false;
      if (verified === "verified" && !l.phone_verified) return false;
      if (verified === "unverified" && l.phone_verified) return false;
      if (sourceFilter === "power-tool-demo" && l.source !== POWER_TOOL_DEMO_SOURCE) return false;
      if (stage !== "all" && (l.funnel_stage ?? "new") !== stage) return false;

      if (shortcutFilter !== "all") {
        const shortcut = l.powerToolDemoIntake?.quote_holder_shortcut === true;
        if (shortcutFilter === "yes" && !shortcut) return false;
        if (shortcutFilter === "no" && shortcut) return false;
      }

      if (q) {
        const intake = l.powerToolDemoIntake;
        const hay = [
          l.first_name, l.last_name, l.email, l.phone_e164,
          l.county, l.city, l.zip, l.id, l.session_id,
          l.source, l.client_slug, l.funnel_stage,
          intake?.intake_status, intake?.intake_property, intake?.intake_scope,
          intake?.intake_logistics, intake?.intake_timeline,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [leads, dateRange, county, verified, stage, sourceFilter, shortcutFilter, search]);

  const resetFilters = () => {
    setSearch("");
    setDateRange("all");
    setCounty("all");
    setVerified("all");
    setStage("all");
    setSourceFilter("all");
    setShortcutFilter("all");
  };

  const powerToolDemoCount = useMemo(
    () => leads.filter((l) => l.source === POWER_TOOL_DEMO_SOURCE).length,
    [leads],
  );

  return (
    <AdminShell
      eyebrow="Operator · Triage"
      title="Lead Inbox"
      subtitle={`${filtered.length} of ${leads.length} leads`}
      backTo="/admin"
      backLabel="Back to dashboard"
      belowHeader={
        <FilterBar
          search={search} setSearch={setSearch}
          dateRange={dateRange} setDateRange={setDateRange}
          county={county} setCounty={setCounty} counties={counties}
          verified={verified} setVerified={setVerified}
          stage={stage} setStage={setStage}
          sourceFilter={sourceFilter} setSourceFilter={setSourceFilter}
          shortcutFilter={shortcutFilter} setShortcutFilter={setShortcutFilter}
          onReset={resetFilters}
          onRefresh={() => refetch()}
          refreshing={isFetching && !isLoading}
        />
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-slate-700" />
        </div>
      ) : isError ? (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Couldn't load leads</p>
            <p className="mt-0.5 opacity-90">{getErrorMessage(error)}</p>
            <button onClick={() => refetch()} className="mt-2 text-xs underline">Retry</button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-300 bg-card p-10 text-center shadow-sm">
          <Inbox className="mx-auto h-8 w-8 text-slate-700 mb-3" />
          <h2 className="font-display text-lg font-extrabold tracking-tight text-foreground">
            {sourceFilter === "power-tool-demo" && powerToolDemoCount === 0
              ? "No PowerToolDemo leads yet"
              : "No leads match"}
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-700">
            {sourceFilter === "power-tool-demo" && powerToolDemoCount === 0
              ? "PowerToolDemo captures will appear here once homeowners complete the demo intake."
              : "Try clearing filters or widening the date range."}
          </p>
          <Button variant="outline" onClick={resetFilters} className="mt-4">
            Clear filters
          </Button>
        </div>
      ) : (
        <LeadTable leads={filtered} onView={(id) => navigate(`/admin/leads/${id}`)} />
      )}
    </AdminShell>
  );
}

interface FilterBarProps {
  search: string; setSearch: (v: string) => void;
  dateRange: DateRange; setDateRange: (v: DateRange) => void;
  county: string; setCounty: (v: string) => void; counties: string[];
  verified: VerifiedFilter; setVerified: (v: VerifiedFilter) => void;
  stage: string; setStage: (v: string) => void;
  sourceFilter: SourceFilter; setSourceFilter: (v: SourceFilter) => void;
  shortcutFilter: ShortcutFilter; setShortcutFilter: (v: ShortcutFilter) => void;
  onReset: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}

function FilterBar({
  search, setSearch, dateRange, setDateRange,
  county, setCounty, counties, verified, setVerified,
  stage, setStage, sourceFilter, setSourceFilter,
  shortcutFilter, setShortcutFilter,
  onReset, onRefresh, refreshing,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[220px] max-w-md">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-700" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, phone, ZIP, ID…"
          className="h-10 pl-8 text-sm font-semibold"
          aria-label="Search leads"
        />
      </div>
      <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
        <SelectTrigger className="h-10 w-[120px] text-sm font-semibold"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All time</SelectItem>
          <SelectItem value="24h">Last 24h</SelectItem>
          <SelectItem value="7d">Last 7 days</SelectItem>
          <SelectItem value="30d">Last 30 days</SelectItem>
        </SelectContent>
      </Select>
      <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as SourceFilter)}>
        <SelectTrigger className="h-10 w-[160px] text-sm font-semibold"><SelectValue placeholder="Source" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All sources</SelectItem>
          <SelectItem value="power-tool-demo">power-tool-demo</SelectItem>
        </SelectContent>
      </Select>
      <Select value={county} onValueChange={setCounty}>
        <SelectTrigger className="h-10 w-[140px] text-sm font-semibold"><SelectValue placeholder="County" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All counties</SelectItem>
          {counties.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={verified} onValueChange={(v) => setVerified(v as VerifiedFilter)}>
        <SelectTrigger className="h-10 w-[130px] text-sm font-semibold"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="verified">Verified</SelectItem>
          <SelectItem value="unverified">Unverified</SelectItem>
        </SelectContent>
      </Select>
      <Select value={stage} onValueChange={setStage}>
        <SelectTrigger className="h-10 w-[140px] text-sm font-semibold"><SelectValue placeholder="Stage" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All stages</SelectItem>
          {FUNNEL_STAGES.map((s) => (
            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
          ))}
          {DEMO_FUNNEL_STAGES.map((s) => (
            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {sourceFilter === "power-tool-demo" ? (
        <Select value={shortcutFilter} onValueChange={(v) => setShortcutFilter(v as ShortcutFilter)}>
          <SelectTrigger className="h-10 w-[150px] text-sm font-semibold"><SelectValue placeholder="Shortcut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All shortcuts</SelectItem>
            <SelectItem value="yes">Shortcut yes</SelectItem>
            <SelectItem value="no">Shortcut no</SelectItem>
          </SelectContent>
        </Select>
      ) : null}
      <Button type="button" variant="ghost" size="sm" onClick={onReset} className="h-10 text-sm font-bold">
        <Filter className="h-3.5 w-3.5 mr-1.5" />
        Clear
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={refreshing}
        className="h-10 text-sm font-bold ml-auto"
      >
        <RefreshCcw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
        Refresh
      </Button>
    </div>
  );
}

function IntakeBadge({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <span className="inline-flex max-w-full items-center rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-950">
      <span className="mr-1 uppercase tracking-wide text-violet-700">{label}:</span>
      <span className="truncate">{value}</span>
    </span>
  );
}

function PowerToolDemoIntakeBlock({ intake }: { intake: PowerToolDemoIntake }) {
  const hasAny = intake.intake_status || intake.intake_property || intake.intake_scope
    || intake.intake_logistics || intake.intake_timeline || intake.quote_holder_shortcut;

  if (!hasAny) {
    return <span className="text-xs font-medium text-slate-500">No intake captured yet</span>;
  }

  return (
    <details className="group mt-1">
      <summary className="cursor-pointer text-xs font-bold text-violet-800 hover:underline">
        Demo intake
      </summary>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <IntakeBadge label="Status" value={intake.intake_status} />
        <IntakeBadge label="Property" value={intake.intake_property} />
        <IntakeBadge label="Scope" value={intake.intake_scope} />
        <IntakeBadge label="Logistics" value={intake.intake_logistics} />
        <IntakeBadge label="Timeline" value={intake.intake_timeline} />
        <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-950">
          Shortcut: {intake.quote_holder_shortcut ? "yes" : "no"}
        </span>
      </div>
    </details>
  );
}

function LeadTable({ leads, onView }: { leads: InboxLead[]; onView: (id: string) => void }) {
  return (
    <div className="rounded-2xl border border-slate-300 bg-card shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-base">
          <thead className="bg-muted/50 border-b border-slate-300">
            <tr className="text-left">
              <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-slate-700">Lead</th>
              <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-slate-700">Source · UTM</th>
              <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-slate-700">County</th>
              <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-slate-700">Verified</th>
              <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-slate-700">Stage</th>
              <th className="px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-slate-700">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => {
              const name = [l.first_name, l.last_name].filter(Boolean).join(" ") || "Unknown";
              const stageDef = getStageDef(l.funnel_stage ?? "new");
              const stageLabel = formatStageLabel(l.funnel_stage);
              const isPowerToolDemo = l.source === POWER_TOOL_DEMO_SOURCE;
              return (
                <tr
                  key={l.id}
                  className="min-h-[72px] border-b border-slate-300 bg-white last:border-0 hover:bg-blue-50/60 transition-colors cursor-pointer focus-within:bg-blue-50/60"
                  onClick={() => onView(l.id)}
                >
                  <td className="px-4 py-3">
                    <div className="text-base font-black text-slate-950">{name}</div>
                    <div className="text-sm font-medium text-slate-700 flex flex-wrap items-center gap-2 mt-0.5">
                      {l.email && <span className="truncate max-w-[180px]">{l.email}</span>}
                      {l.phone_e164 && (
                        <span className="inline-flex items-center gap-1 font-mono">
                          <Phone className="h-3 w-3" />
                          {l.phone_e164}
                        </span>
                      )}
                      {l.zip && (
                        <span className="inline-flex items-center gap-1 font-mono">
                          <MapPin className="h-3 w-3" />
                          {l.zip}
                        </span>
                      )}
                    </div>
                    {isPowerToolDemo && l.powerToolDemoIntake ? (
                      <PowerToolDemoIntakeBlock intake={l.powerToolDemoIntake} />
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-700">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {l.source ? (
                        <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-extrabold uppercase tracking-wide text-indigo-950">
                          {l.source}
                        </span>
                      ) : (
                        <span>—</span>
                      )}
                      {l.client_slug && (
                        <span className="text-xs font-semibold text-slate-600">{l.client_slug}</span>
                      )}
                    </div>
                    <div className="mt-1">{l.utm_source ?? "—"}</div>
                    {l.utm_campaign && <div className="font-semibold text-slate-700 truncate max-w-[140px]">{l.utm_campaign}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-700">
                    {l.county ? (
                      <span className="inline-flex items-center gap-1 text-slate-700">
                        <MapPin className="h-3 w-3" />
                        {l.county}
                      </span>
                    ) : <span className="text-slate-700">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {l.phone_verified ? (
                      <span className="inline-flex min-h-8 items-center rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-1 text-sm font-extrabold uppercase tracking-wider text-emerald-950 shadow-sm">
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex min-h-8 items-center rounded-full border border-slate-400 bg-white px-2.5 py-1 text-sm font-extrabold uppercase tracking-wider text-slate-950 shadow-sm">
                        Unverified
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex min-h-8 items-center rounded-full border px-2.5 py-1 text-sm font-extrabold uppercase tracking-wider ${stageDef?.badgeClass ?? (isPowerToolDemo ? "bg-violet-100 text-violet-900 border-violet-200" : "bg-white text-slate-950 border-slate-400")}`}>
                      {stageLabel}
                    </span>
                    {l.report_unlocked_at ? (
                      <div className="mt-1 text-xs font-semibold text-emerald-800">Report unlocked</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-700">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span title={format(new Date(l.created_at), "MMM d, yyyy h:mm a")}>
                        {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/admin/leads/${l.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                      aria-label={`View details for ${name}`}
                    >
                      View
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
