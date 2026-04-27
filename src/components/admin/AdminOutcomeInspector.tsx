/**
 * AdminOutcomeInspector — Sprint 1E
 *
 * Read-only internal-operator surface that joins `contractor_outcomes` with
 * `contractor_opportunities`, `contractors`, and the `leads` rollup row.
 * Detects rollup discrepancies between the partner-reported truth (the
 * outcome) and the lead-level rollup that downstream admin/CRM screens
 * consume.
 *
 * Truth contract:
 *   - `contractor_outcomes` is the authoritative store; never edited from here.
 *   - `leads` is a rollup; mismatches against the outcome are the bug.
 *   - All reads go through the SECURITY DEFINER RPC
 *     `public.admin_outcomes_inspector` (admin/operator-gated by
 *     `public.is_internal_operator()`).
 *
 * Out of scope for this sprint:
 *   - Editing outcome values (read-only by design).
 *   - Writing to leads or contractor_outcomes (no surface exposes mutations).
 *   - Reconciliation tooling (a future sprint owns the "fix mismatch" path).
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  Filter,
  Inbox,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ── Types ───────────────────────────────────────────────────────────────────
type Disposition =
  | "new"
  | "attempting_contact"
  | "meeting_scheduled"
  | "quote_delivered"
  | "sold_closed"
  | "lost_dead";

type RollupStatus =
  | "ok"
  | "no_lead_linked"
  | "lead_rollup_missing"
  | "lead_rollup_mismatch";

interface InspectorRow {
  outcome_id: string;
  opportunity_id: string;
  lead_id: string | null;
  analysis_id: string | null;
  contractor_id: string | null;
  contractor_company_name: string | null;
  contractor_contact_name: string | null;
  homeowner_first_name: string | null;
  homeowner_last_name: string | null;
  city: string | null;
  county: string | null;
  client_slug: string | null;
  disposition_state: Disposition;
  disposition_reason_code: string | null;
  outcome_notes: string | null;
  projected_value_cents: number | null;
  final_value_cents: number | null;
  signed_contract_url: string | null;
  last_partner_action_at: string | null;
  outcome_created_at: string;
  outcome_updated_at: string;
  outcome_closed_at: string | null;
  lead_deal_status: string | null;
  lead_deal_value: number | null;
  lead_revenue_amount: number | null;
  lead_closed_at: string | null;
  rollup_status: RollupStatus;
}

// ── Display helpers ─────────────────────────────────────────────────────────
const DISPOSITION_LABEL: Record<Disposition, string> = {
  new: "New",
  attempting_contact: "Contacting",
  meeting_scheduled: "Meeting Set",
  quote_delivered: "Quote Sent",
  sold_closed: "Sold",
  lost_dead: "Lost",
};

const DISPOSITION_COLOR: Record<Disposition, string> = {
  new: "bg-white text-slate-950 border-slate-400",
  attempting_contact: "bg-amber-100 text-amber-950 border-amber-300",
  meeting_scheduled: "bg-blue-100 text-blue-950 border-blue-300",
  quote_delivered: "bg-blue-100 text-blue-950 border-blue-300",
  sold_closed: "bg-emerald-100 text-emerald-950 border-emerald-300",
  lost_dead: "bg-slate-200 text-slate-950 border-slate-400",
};

const ROLLUP_LABEL: Record<RollupStatus, string> = {
  ok: "OK",
  no_lead_linked: "No lead linked",
  lead_rollup_missing: "Rollup missing",
  lead_rollup_mismatch: "Rollup mismatch",
};

const ROLLUP_COLOR: Record<RollupStatus, string> = {
  ok: "bg-emerald-50 text-emerald-900 border-emerald-300",
  no_lead_linked: "bg-slate-50 text-slate-700 border-slate-300",
  lead_rollup_missing: "bg-amber-100 text-amber-950 border-amber-400",
  lead_rollup_mismatch: "bg-rose-100 text-rose-950 border-rose-400",
};

const REASON_LABEL: Record<string, string> = {
  price_too_high: "Price too high",
  chose_competitor: "Chose competitor",
  no_longer_interested: "No longer interested",
  unresponsive: "Unresponsive",
  project_canceled: "Project canceled",
  out_of_service_area: "Out of service area",
  other: "Other",
};

function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDollars(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function homeownerName(row: InspectorRow): string {
  const first = row.homeowner_first_name?.trim();
  const last = row.homeowner_last_name?.trim();
  if (first && last) return `${first} ${last.charAt(0)}.`;
  if (first) return first;
  return "Homeowner";
}

function contractorName(row: InspectorRow): string {
  return (
    row.contractor_company_name?.trim() ||
    row.contractor_contact_name?.trim() ||
    "—"
  );
}

function locationLabel(row: InspectorRow): string {
  const parts = [row.city, row.county].filter(Boolean) as string[];
  return parts.join(", ") || "—";
}

function lastActionAge(row: InspectorRow): string {
  const ts = row.last_partner_action_at ?? row.outcome_created_at;
  return formatDistanceToNowStrict(new Date(ts), { addSuffix: true });
}

// ── Component ───────────────────────────────────────────────────────────────
export function AdminOutcomeInspector() {
  // Filters (all optional, applied client-side over the RPC payload)
  const [search, setSearch] = useState("");
  const [dispositionFilter, setDispositionFilter] = useState<Disposition | "all">("all");
  const [contractorFilter, setContractorFilter] = useState<string>("all");
  const [valueFilter, setValueFilter] = useState<"any" | "present" | "missing">("any");
  const [mismatchOnly, setMismatchOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const inspectorQ = useQuery({
    queryKey: ["admin-outcomes-inspector"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "admin_outcomes_inspector" as never,
      );
      if (error) throw error;
      return (data ?? []) as InspectorRow[];
    },
    staleTime: 30_000,
  });

  const rows = inspectorQ.data ?? [];

  // ── Contractor option list (deduplicated from result set) ────────────────
  const contractorOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (r.contractor_id) {
        map.set(r.contractor_id, contractorName(r));
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  // ── Per-row searchable haystack (precomputed when `rows` change) ─────────
  // Avoid rebuilding the join+lowercase for every row on every keystroke in
  // the search box. The haystack is a derived projection of `rows` so it
  // recomputes only when the underlying RPC payload changes.
  const searchableRows = useMemo(
    () =>
      rows.map((r) => ({
        row: r,
        haystack: [
          r.homeowner_first_name,
          r.homeowner_last_name,
          r.contractor_company_name,
          r.contractor_contact_name,
          r.city,
          r.county,
          r.client_slug,
          r.outcome_notes,
          r.lead_id,
          r.opportunity_id,
          r.outcome_id,
          r.analysis_id,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      })),
    [rows],
  );

  // ── Filtered rows ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    // Parse YYYY-MM-DD as local-day boundaries, NOT UTC midnight, so the
    // filter aligns with how `last_partner_action_at` / `outcome_created_at`
    // are displayed to the operator. `new Date("YYYY-MM-DD")` would parse as
    // UTC midnight and cause off-by-up-to-24h mistakes for users west of
    // UTC.
    const localMidnight = (s: string): number => {
      const [y, m, d] = s.split("-").map(Number);
      return new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
    };
    const fromTs = dateFrom ? localMidnight(dateFrom) : null;
    const toTs = dateTo ? localMidnight(dateTo) + 24 * 60 * 60 * 1000 : null;
    const q = search.trim().toLowerCase();

    return searchableRows
      .filter(({ row: r, haystack }) => {
        if (dispositionFilter !== "all" && r.disposition_state !== dispositionFilter) return false;
        if (contractorFilter !== "all" && r.contractor_id !== contractorFilter) return false;
        if (mismatchOnly && r.rollup_status === "ok") return false;
        if (valueFilter === "present" && r.final_value_cents == null) return false;
        if (valueFilter === "missing" && r.final_value_cents != null) return false;

        if (fromTs != null || toTs != null) {
          const anchor = new Date(
            r.last_partner_action_at ?? r.outcome_created_at,
          ).getTime();
          if (fromTs != null && anchor < fromTs) return false;
          if (toTs != null && anchor > toTs) return false;
        }

        if (q && !haystack.includes(q)) return false;

        return true;
      })
      .map(({ row }) => row);
  }, [searchableRows, search, dispositionFilter, contractorFilter, valueFilter, mismatchOnly, dateFrom, dateTo]);

  // ── KPI counts on the filtered set ───────────────────────────────────────
  const counts = useMemo(() => {
    const total = filtered.length;
    let mismatch = 0;
    let missing = 0;
    let unlinked = 0;
    let sold = 0;
    let lost = 0;
    for (const r of filtered) {
      if (r.rollup_status === "lead_rollup_mismatch") mismatch += 1;
      if (r.rollup_status === "lead_rollup_missing") missing += 1;
      if (r.rollup_status === "no_lead_linked") unlinked += 1;
      if (r.disposition_state === "sold_closed") sold += 1;
      if (r.disposition_state === "lost_dead") lost += 1;
    }
    return { total, mismatch, missing, unlinked, sold, lost };
  }, [filtered]);

  const isLoading = inspectorQ.isLoading;
  const error = inspectorQ.error;

  return (
    <section
      aria-label="Admin Outcome Inspector"
      className="bg-slate-50 -mx-2 sm:-mx-6 px-2 sm:px-6 py-2"
    >
      {/* ── Page header ───────────────────────────────────────────────────── */}
      <header className="mb-4 flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-slate-700" aria-hidden />
          <h2 className="text-2xl font-black tracking-tight text-slate-950">
            Outcome Inspector
          </h2>
          <Badge
            variant="outline"
            className="ml-2 bg-white text-xs font-bold uppercase tracking-wider text-slate-700 border-slate-300"
          >
            Read-only
          </Badge>
        </div>
        <p className="text-sm font-medium text-slate-700 max-w-3xl">
          Audit contractor-reported outcomes against the lead rollup. Mismatches
          surface here with a red badge; the partner workflow remains the
          authoritative write path.
        </p>
      </header>

      {/* ── KPI strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <KpiTile label="Outcomes" value={String(counts.total)} />
        <KpiTile
          label="Sold"
          value={String(counts.sold)}
          accent="emerald"
        />
        <KpiTile label="Lost" value={String(counts.lost)} accent="slate" />
        <KpiTile
          label="Mismatch"
          value={String(counts.mismatch)}
          accent={counts.mismatch > 0 ? "rose" : "slate"}
        />
        <KpiTile
          label="Missing rollup"
          value={String(counts.missing)}
          accent={counts.missing > 0 ? "amber" : "slate"}
        />
        <KpiTile label="No lead" value={String(counts.unlinked)} accent="slate" />
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-300 bg-white shadow-sm p-3 sm:p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-slate-700" aria-hidden />
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-700">
            Filters
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto h-8 px-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
            onClick={() => {
              setSearch("");
              setDispositionFilter("all");
              setContractorFilter("all");
              setValueFilter("any");
              setMismatchOnly(false);
              setDateFrom("");
              setDateTo("");
            }}
          >
            Reset
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs font-bold border-slate-300"
            onClick={() => inspectorQ.refetch()}
            disabled={inspectorQ.isFetching}
          >
            <RefreshCw
              className={cn(
                "h-3.5 w-3.5 mr-1",
                inspectorQ.isFetching && "animate-spin",
              )}
            />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <Label htmlFor="oi-search" className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              Search
            </Label>
            <div className="relative mt-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" aria-hidden />
              <Input
                id="oi-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, contractor, IDs, notes…"
                className="pl-8 h-9 text-sm bg-white border-slate-300"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              Disposition
            </Label>
            <Select value={dispositionFilter} onValueChange={(v) => setDispositionFilter(v as typeof dispositionFilter)}>
              <SelectTrigger className="h-9 mt-1 text-sm bg-white border-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="attempting_contact">Contacting</SelectItem>
                <SelectItem value="meeting_scheduled">Meeting set</SelectItem>
                <SelectItem value="quote_delivered">Quote sent</SelectItem>
                <SelectItem value="sold_closed">Sold</SelectItem>
                <SelectItem value="lost_dead">Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              Contractor
            </Label>
            <Select value={contractorFilter} onValueChange={setContractorFilter}>
              <SelectTrigger className="h-9 mt-1 text-sm bg-white border-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All contractors</SelectItem>
                {contractorOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              Final value
            </Label>
            <Select value={valueFilter} onValueChange={(v) => setValueFilter(v as typeof valueFilter)}>
              <SelectTrigger className="h-9 mt-1 text-sm bg-white border-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="missing">Missing</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="oi-from" className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              From
            </Label>
            <Input
              id="oi-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 mt-1 text-sm bg-white border-slate-300"
            />
          </div>

          <div>
            <Label htmlFor="oi-to" className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              To
            </Label>
            <Input
              id="oi-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 mt-1 text-sm bg-white border-slate-300"
            />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 pt-3 border-t border-slate-200">
          <Switch
            id="oi-mismatch-only"
            checked={mismatchOnly}
            onCheckedChange={setMismatchOnly}
          />
          <Label
            htmlFor="oi-mismatch-only"
            className="text-sm font-bold text-slate-800 cursor-pointer"
          >
            Show rollup issues only
          </Label>
          <span className="text-xs text-slate-600">
            (mismatch · missing · no lead linked)
          </span>
        </div>
      </div>

      {/* ── Error banner ──────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 flex items-start gap-2 mb-4">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
          <div className="min-w-0">
            <div className="font-semibold">Could not load outcome inspector</div>
            <div className="text-xs">
              {error instanceof Error ? error.message : "Unknown error"}
            </div>
            <div className="text-xs mt-1 text-rose-700/80">
              The Outcome Inspector requires an authenticated internal-operator
              session. If you are an admin, try refreshing your session.
            </div>
          </div>
        </div>
      )}

      {/* ── Results table ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-300 bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-slate-200">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 bg-slate-50 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 flex flex-col items-center text-center gap-2">
            <Inbox className="h-8 w-8 text-slate-700" aria-hidden />
            <div className="text-sm font-medium text-slate-900">No outcomes match these filters</div>
            <p className="text-sm font-medium text-slate-700 max-w-sm">
              Adjust filters or clear the search to see more results.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-700">
                <tr>
                  <Th>Rollup</Th>
                  <Th>Disposition</Th>
                  <Th>Homeowner</Th>
                  <Th>Contractor</Th>
                  <Th hideOn="md">Location</Th>
                  <Th align="right">Final / Lead</Th>
                  <Th align="right" hideOn="lg">Projected</Th>
                  <Th hideOn="lg">Last action</Th>
                  <Th hideOn="md">Reason</Th>
                  <Th align="right" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <InspectorRowEl key={r.outcome_id} row={r} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="sr-only" role="status">
          <Loader2 className="animate-spin" /> Loading outcome inspector…
        </div>
      )}
    </section>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────
function KpiTile({
  label,
  value,
  accent = "slate",
}: {
  label: string;
  value: string;
  accent?: "slate" | "emerald" | "rose" | "amber";
}) {
  const accentClasses: Record<string, string> = {
    slate: "border-slate-300 bg-white",
    emerald: "border-emerald-300 bg-emerald-50/40",
    rose: "border-rose-300 bg-rose-50/50",
    amber: "border-amber-300 bg-amber-50/40",
  };
  return (
    <div className={cn("rounded-xl border p-3 shadow-sm flex flex-col gap-1", accentClasses[accent])}>
      <span className="text-xs font-extrabold uppercase tracking-wide text-slate-700">
        {label}
      </span>
      <span className="text-2xl font-black tracking-tight tabular-nums text-slate-950">
        {value}
      </span>
    </div>
  );
}

function Th({
  children,
  align = "left",
  hideOn,
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
  hideOn?: "md" | "lg";
}) {
  const hideClass =
    hideOn === "md" ? "hidden md:table-cell" : hideOn === "lg" ? "hidden lg:table-cell" : "";
  return (
    <th
      className={cn(
        "font-extrabold px-3 py-3",
        align === "right" ? "text-right" : "text-left",
        hideClass,
      )}
    >
      {children}
    </th>
  );
}

function InspectorRowEl({ row }: { row: InspectorRow }) {
  const dossierHref = row.analysis_id ? `/partner/dossier/${row.analysis_id}` : null;
  const adminLeadHref = row.lead_id ? `/admin/leads/${row.lead_id}` : null;
  const showMismatchDetails =
    row.rollup_status === "lead_rollup_mismatch" ||
    row.rollup_status === "lead_rollup_missing";

  return (
    <tr className="border-t border-slate-200 hover:bg-slate-50/80 transition">
      {/* Rollup status */}
      <td className="px-3 py-2 align-top">
        <Badge
          variant="outline"
          className={cn(
            "text-xs font-extrabold border whitespace-nowrap",
            ROLLUP_COLOR[row.rollup_status],
          )}
        >
          {row.rollup_status === "lead_rollup_mismatch" && (
            <AlertTriangle className="h-3 w-3 mr-1" aria-hidden />
          )}
          {ROLLUP_LABEL[row.rollup_status]}
        </Badge>
      </td>

      {/* Disposition */}
      <td className="px-3 py-2 align-top">
        <Badge
          variant="outline"
          className={cn(
            "text-xs font-extrabold border whitespace-nowrap",
            DISPOSITION_COLOR[row.disposition_state],
          )}
        >
          {DISPOSITION_LABEL[row.disposition_state]}
        </Badge>
      </td>

      {/* Homeowner */}
      <td className="px-3 py-2 align-top">
        <div className="font-bold text-slate-950 truncate max-w-[14rem]">
          {homeownerName(row)}
        </div>
        <div className="text-xs text-slate-700 font-mono truncate max-w-[14rem]">
          {row.lead_id ?? "—"}
        </div>
      </td>

      {/* Contractor */}
      <td className="px-3 py-2 align-top">
        <div className="font-semibold text-slate-900 truncate max-w-[14rem]">
          {contractorName(row)}
        </div>
        {row.client_slug && (
          <div className="text-xs text-slate-700 font-mono truncate">
            {row.client_slug}
          </div>
        )}
      </td>

      {/* Location */}
      <td className="px-3 py-2 align-top text-sm font-medium text-slate-700 hidden md:table-cell">
        {locationLabel(row)}
      </td>

      {/* Final / Lead value comparison */}
      <td className="px-3 py-2 align-top text-right tabular-nums">
        <div className="text-sm font-bold text-slate-950">
          {formatCents(row.final_value_cents)}
        </div>
        {showMismatchDetails && (
          <div className="text-xs font-medium text-slate-700 mt-0.5">
            <span className="text-slate-500">deal&nbsp;</span>
            <span
              className={cn(
                row.rollup_status === "lead_rollup_mismatch" && "text-rose-700 font-extrabold",
              )}
            >
              {formatDollars(row.lead_deal_value)}
            </span>
            {" · "}
            <span className="text-slate-500">rev&nbsp;</span>
            <span
              className={cn(
                row.rollup_status === "lead_rollup_mismatch" && "text-rose-700 font-extrabold",
              )}
            >
              {formatDollars(row.lead_revenue_amount)}
            </span>
          </div>
        )}
        {row.lead_deal_status && (
          <div className="text-[11px] uppercase tracking-wide text-slate-600 mt-0.5">
            lead.{row.lead_deal_status}
          </div>
        )}
      </td>

      {/* Projected */}
      <td className="px-3 py-2 align-top text-right tabular-nums hidden lg:table-cell text-sm text-slate-800">
        {formatCents(row.projected_value_cents)}
      </td>

      {/* Last action */}
      <td className="px-3 py-2 align-top text-sm font-medium text-slate-700 hidden lg:table-cell">
        {lastActionAge(row)}
        {row.lead_closed_at && (
          <div className="text-xs text-slate-600">
            lead closed {format(new Date(row.lead_closed_at), "MMM d")}
          </div>
        )}
      </td>

      {/* Reason / notes */}
      <td className="px-3 py-2 align-top hidden md:table-cell max-w-[18rem]">
        {row.disposition_reason_code && (
          <div className="text-xs font-bold text-slate-800">
            {REASON_LABEL[row.disposition_reason_code] ?? row.disposition_reason_code}
          </div>
        )}
        {row.outcome_notes && (
          <div className="text-xs text-slate-700 italic line-clamp-2 mt-0.5">
            {row.outcome_notes}
          </div>
        )}
      </td>

      {/* Open links */}
      <td className="px-3 py-2 align-top text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-1.5">
          {dossierHref && (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-8 px-2 text-xs font-bold border-slate-300"
              title="Open partner dossier"
            >
              <Link to={dossierHref}>
                Dossier
                <ArrowUpRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          )}
          {adminLeadHref && (
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
              title="Open admin lead workspace"
            >
              <Link to={adminLeadHref}>Lead</Link>
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
