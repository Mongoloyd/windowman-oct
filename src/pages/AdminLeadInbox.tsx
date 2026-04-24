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

function toLead(raw: Record<string, any>): CRMLead {
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
  };
}

export default function LeadInbox() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [county, setCounty] = useState<string>("all");
  const [verified, setVerified] = useState<VerifiedFilter>("all");
  const [stage, setStage] = useState<string>("all");

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
      if (stage !== "all" && (l.funnel_stage ?? "new") !== stage) return false;

      if (q) {
        const hay = [
          l.first_name, l.last_name, l.email, l.phone_e164,
          l.county, l.city, l.zip, l.id, l.session_id,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [leads, dateRange, county, verified, stage, search]);

  const resetFilters = () => {
    setSearch("");
    setDateRange("all");
    setCounty("all");
    setVerified("all");
    setStage("all");
  };

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
          onReset={resetFilters}
          onRefresh={() => refetch()}
          refreshing={isFetching && !isLoading}
        />
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
          <Inbox className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <h2 className="font-display text-lg font-extrabold tracking-tight text-foreground">
            No leads match
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Try clearing filters or widening the date range.
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
  onReset: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}

function FilterBar({
  search, setSearch, dateRange, setDateRange,
  county, setCounty, counties, verified, setVerified,
  stage, setStage, onReset, onRefresh, refreshing,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[220px] max-w-md">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, phone, ZIP, ID…"
          className="h-9 pl-8 text-sm"
          aria-label="Search leads"
        />
      </div>
      <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
        <SelectTrigger className="h-9 w-[120px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All time</SelectItem>
          <SelectItem value="24h">Last 24h</SelectItem>
          <SelectItem value="7d">Last 7 days</SelectItem>
          <SelectItem value="30d">Last 30 days</SelectItem>
        </SelectContent>
      </Select>
      <Select value={county} onValueChange={setCounty}>
        <SelectTrigger className="h-9 w-[140px] text-xs"><SelectValue placeholder="County" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All counties</SelectItem>
          {counties.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={verified} onValueChange={(v) => setVerified(v as VerifiedFilter)}>
        <SelectTrigger className="h-9 w-[130px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="verified">Verified</SelectItem>
          <SelectItem value="unverified">Unverified</SelectItem>
        </SelectContent>
      </Select>
      <Select value={stage} onValueChange={setStage}>
        <SelectTrigger className="h-9 w-[140px] text-xs"><SelectValue placeholder="Stage" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All stages</SelectItem>
          {FUNNEL_STAGES.map((s) => (
            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" variant="ghost" size="sm" onClick={onReset} className="h-9 text-xs">
        <Filter className="h-3.5 w-3.5 mr-1.5" />
        Clear
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={refreshing}
        className="h-9 text-xs ml-auto"
      >
        <RefreshCcw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
        Refresh
      </Button>
    </div>
  );
}

function LeadTable({ leads, onView }: { leads: CRMLead[]; onView: (id: string) => void }) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr className="text-left">
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Lead</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Source · UTM</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">County</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Verified</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Stage</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => {
              const name = [l.first_name, l.last_name].filter(Boolean).join(" ") || "Unknown";
              const stageDef = getStageDef(l.funnel_stage ?? "new");
              return (
                <tr
                  key={l.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer focus-within:bg-muted/30"
                  onClick={() => onView(l.id)}
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-foreground">{name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                      {l.email && <span className="truncate max-w-[180px]">{l.email}</span>}
                      {l.phone_e164 && (
                        <span className="inline-flex items-center gap-1 font-mono">
                          <Phone className="h-3 w-3" />
                          {l.phone_e164}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <div>{l.utm_source ?? "—"}</div>
                    {l.utm_campaign && <div className="opacity-70 truncate max-w-[140px]">{l.utm_campaign}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {l.county ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {l.county}
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {l.phone_verified ? (
                      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Unverified
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${stageDef?.badgeClass ?? "bg-muted text-muted-foreground border-border"}`}>
                      {stageDef?.label ?? "New"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
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
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
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
