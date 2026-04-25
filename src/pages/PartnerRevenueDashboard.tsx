/**
 * PartnerRevenueDashboard — `/partner/revenue`
 *
 * Sprint 1C — Partner CRM dashboard.
 * Three sections: KPI strip, weekly lead board (current local week), pipeline
 * table. Hover preview on each card opens a compact summary with an Open
 * Dossier CTA (route: /partner/dossier/{analysis_id} — same contract as the
 * opportunities feed `dossier_href`).
 *
 * Data sources (partner-safe, contractor-scoped via auth.uid() bridge):
 *   - rpc("partner_outcomes_with_lead_context")  → per-row pipeline
 *   - rpc("partner_outcome_summary")             → KPI rollup totals
 *
 * No new dependencies. Uses installed Radix HoverCard + date-fns.
 */

import { Helmet } from "react-helmet-async";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  CalendarDays,
  Table as TableIcon,
  ArrowUpRight,
  Clock,
  AlertCircle,
  Loader2,
  Inbox,
} from "lucide-react";
import {
  startOfWeek,
  endOfWeek,
  addDays,
  format,
  isSameDay,
  differenceInDays,
  formatDistanceToNowStrict,
} from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────
type Disposition =
  | "new"
  | "attempting_contact"
  | "meeting_scheduled"
  | "quote_delivered"
  | "sold_closed"
  | "lost_dead";

type OutcomeRow = {
  outcome_id: string;
  opportunity_id: string;
  lead_id: string;
  analysis_id: string | null;
  disposition_state: Disposition;
  disposition_reason_code: string | null;
  projected_value_cents: number | null;
  final_value_cents: number | null;
  signed_contract_url: string | null;
  last_partner_action_at: string | null;
  outcome_created_at: string;
  outcome_updated_at: string;
  closed_at: string | null;
  appointment_booked_at: string | null;
  homeowner_first_name: string | null;
  city: string | null;
  county: string | null;
  project_type: string | null;
  window_count: number | null;
  quote_range: string | null;
  grade: string | null;
  red_flag_count: number | null;
  amber_flag_count: number | null;
  flag_count: number | null;
};

type SummaryRow = {
  disposition_state: Disposition;
  outcome_count: number;
  total_final_value_cents: number;
  total_projected_value_cents: number;
};

const ACTIVE_DISPOSITIONS: Disposition[] = [
  "new",
  "attempting_contact",
  "meeting_scheduled",
  "quote_delivered",
];
const TERMINAL_DISPOSITIONS: Disposition[] = ["sold_closed", "lost_dead"];

const DISPOSITION_LABEL: Record<Disposition, string> = {
  new: "New",
  attempting_contact: "Contacting",
  meeting_scheduled: "Meeting set",
  quote_delivered: "Quote sent",
  sold_closed: "Sold",
  lost_dead: "Lost",
};

const DISPOSITION_COLOR: Record<Disposition, string> = {
  new: "bg-white text-slate-950 border-slate-400",
  attempting_contact: "bg-amber-100 text-amber-950 border-amber-300",
  meeting_scheduled: "bg-blue-100 text-blue-950 border-blue-300",
  quote_delivered: "bg-blue-100 text-blue-950 border-blue-300",
  sold_closed: "bg-emerald-100 text-emerald-950 border-emerald-300",
  lost_dead: "bg-red-100 text-red-950 border-red-300",
};

// "Needs touch" threshold for the active-leads KPI: an active lead whose last
// partner action (or creation) is older than this is considered overdue.
const NEEDS_TOUCH_DAYS = 3;

// ─── Helpers ──────────────────────────────────────────────────
function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatPercent(num: number, denom: number): string {
  if (denom <= 0) return "—";
  return `${Math.round((num / denom) * 100)}%`;
}

function displayName(row: OutcomeRow): string {
  return row.homeowner_first_name?.trim() || "Homeowner";
}

function locationLabel(row: OutcomeRow): string | null {
  return row.city || row.county || null;
}

/**
 * Weekly grouping timestamp (priority order):
 *   1. last_partner_action_at
 *   2. appointment_booked_at
 *   3. closed_at
 *   4. outcome_created_at
 */
function weeklyAnchor(row: OutcomeRow): Date {
  const ts =
    row.last_partner_action_at ??
    row.appointment_booked_at ??
    row.closed_at ??
    row.outcome_created_at;
  return new Date(ts);
}

function lastActionAge(row: OutcomeRow): string {
  const ts = row.last_partner_action_at ?? row.outcome_created_at;
  return formatDistanceToNowStrict(new Date(ts), { addSuffix: true });
}

// ─── Sub-components ───────────────────────────────────────────
function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="h-9 w-9 rounded-lg bg-sky-100 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-sky-600" aria-hidden />
      </div>
      <div className="min-w-0">
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight leading-tight text-slate-950">
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm font-medium text-slate-700 mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-300 bg-card p-5 flex flex-col gap-2 shadow-sm",
        highlight && "border-sky-300 bg-sky-50/40",
      )}
    >
      <span className="text-sm font-extrabold uppercase tracking-wide text-slate-700">
        {label}
      </span>
      <span className="text-3xl font-black tracking-tight tabular-nums text-slate-950">
        {value}
      </span>
      {hint && (
        <span className="text-sm font-medium text-slate-700 leading-tight">
          {hint}
        </span>
      )}
    </div>
  );
}

function LeadHoverCard({ row }: { row: OutcomeRow }) {
  const dossierHref = row.analysis_id
    ? `/partner/dossier/${row.analysis_id}`
    : null;

  return (
    <HoverCardContent className="w-72 p-4" align="start" sideOffset={6}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold truncate">{displayName(row)}</div>
            {locationLabel(row) && (
              <div className="text-sm font-medium text-slate-700">
                {locationLabel(row)}
              </div>
            )}
          </div>
          <Badge
            variant="outline"
            className={cn("text-xs font-extrabold border", DISPOSITION_COLOR[row.disposition_state])}
          >
            {DISPOSITION_LABEL[row.disposition_state]}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {row.grade && (
            <div>
              <div className="text-sm font-semibold text-slate-700">Grade</div>
              <div className="font-semibold">{row.grade}</div>
            </div>
          )}
          {(row.red_flag_count ?? 0) + (row.amber_flag_count ?? 0) > 0 && (
            <div>
              <div className="text-sm font-semibold text-slate-700">Flags</div>
              <div className="font-semibold flex items-center gap-1">
                {(row.red_flag_count ?? 0) > 0 && (
                  <span className="text-rose-600">
                    {row.red_flag_count}R
                  </span>
                )}
                {(row.amber_flag_count ?? 0) > 0 && (
                  <span className="text-amber-600">
                    {row.amber_flag_count}A
                  </span>
                )}
              </div>
            </div>
          )}
          {row.quote_range && (
            <div className="col-span-2">
              <div className="text-sm font-semibold text-slate-700">Quote range</div>
              <div className="font-semibold truncate">{row.quote_range}</div>
            </div>
          )}
          {row.projected_value_cents != null && (
            <div>
              <div className="text-sm font-semibold text-slate-700">Projected</div>
              <div className="font-semibold tabular-nums">
                {formatCents(row.projected_value_cents)}
              </div>
            </div>
          )}
          {row.final_value_cents != null && (
            <div>
              <div className="text-sm font-semibold text-slate-700">Final</div>
              <div className="font-semibold tabular-nums text-emerald-700">
                {formatCents(row.final_value_cents)}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1 border-t">
          <span className="text-sm font-semibold text-slate-700">
            Last action {lastActionAge(row)}
          </span>
          {dossierHref && (
            <Button
              asChild
              size="sm"
              variant="default"
              className="min-h-10 px-3 text-sm font-extrabold border border-blue-900 bg-blue-900 text-white hover:bg-blue-800"
            >
              <Link to={dossierHref}>
                Open <ArrowUpRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </HoverCardContent>
  );
}

function LeadCard({ row }: { row: OutcomeRow }) {
  const dossierHref = row.analysis_id
    ? `/partner/dossier/${row.analysis_id}`
    : null;

  const inner = (
    <div className="rounded-lg border-2 border-slate-200 bg-card p-3 hover:border-blue-400 hover:shadow-[0_12px_30px_rgba(15,23,42,0.10)] transition cursor-pointer active:scale-[0.99]">
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-extrabold text-slate-950 truncate">{displayName(row)}</div>
          {locationLabel(row) && (
            <div className="text-xs font-semibold text-slate-700 truncate">
              {locationLabel(row)}
            </div>
          )}
        </div>
        {row.grade && (
          <span className="text-sm font-extrabold text-slate-700 shrink-0">
            {row.grade}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-1.5">
        <Badge
          variant="outline"
          className={cn(
            "text-sm font-extrabold py-1 px-2.5 border",
            DISPOSITION_COLOR[row.disposition_state],
          )}
        >
          {DISPOSITION_LABEL[row.disposition_state]}
        </Badge>
        <span className="text-xs font-semibold text-slate-700 tabular-nums">
          {row.final_value_cents != null
            ? formatCents(row.final_value_cents)
            : row.projected_value_cents != null
              ? formatCents(row.projected_value_cents)
              : ""}
        </span>
      </div>
    </div>
  );

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        {dossierHref ? (
          <Link to={dossierHref} className="block focus:outline-none focus:ring-2 focus:ring-sky-400 rounded-md">
            {inner}
          </Link>
        ) : (
          <div tabIndex={0} className="focus:outline-none focus:ring-2 focus:ring-sky-400 rounded-md">
            {inner}
          </div>
        )}
      </HoverCardTrigger>
      <LeadHoverCard row={row} />
    </HoverCard>
  );
}

// ─── Main page ────────────────────────────────────────────────
export default function PartnerRevenueDashboard() {
  const outcomesQ = useQuery({
    queryKey: ["partner-outcomes-rows"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "partner_outcomes_with_lead_context" as never,
      );
      if (error) throw error;
      return (data ?? []) as OutcomeRow[];
    },
    staleTime: 60_000,
  });

  const summaryQ = useQuery({
    queryKey: ["partner-outcome-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "partner_outcome_summary" as never,
      );
      if (error) throw error;
      return (data ?? []) as SummaryRow[];
    },
    staleTime: 60_000,
  });

  const rows = outcomesQ.data ?? [];
  const summary = summaryQ.data ?? [];
  const isLoading = outcomesQ.isLoading || summaryQ.isLoading;
  const error = outcomesQ.error ?? summaryQ.error;

  // ─── KPI calculations ────────────────────────────────────────
  const kpis = useMemo(() => {
    const byState = new Map<Disposition, SummaryRow>();
    summary.forEach((s) => byState.set(s.disposition_state, s));

    const sold = byState.get("sold_closed");
    const lost = byState.get("lost_dead");

    const soldCount = sold?.outcome_count ?? 0;
    const lostCount = lost?.outcome_count ?? 0;
    const managedRevenueCents = sold?.total_final_value_cents ?? 0;

    // Avg days to close: closed_at - outcome_created_at on sold rows.
    // outcome_created_at is the first actionable timestamp we can rely on
    // partner-side (the moment the contractor's outcome row was provisioned).
    const soldRows = rows.filter(
      (r) => r.disposition_state === "sold_closed" && r.closed_at,
    );
    const avgDays =
      soldRows.length > 0
        ? Math.round(
            soldRows.reduce(
              (acc, r) =>
                acc +
                Math.max(
                  0,
                  differenceInDays(
                    new Date(r.closed_at as string),
                    new Date(r.outcome_created_at),
                  ),
                ),
              0,
            ) / soldRows.length,
          )
        : null;

    // Leads needing action: still active AND last action older than threshold
    const now = Date.now();
    const needsAction = rows.filter((r) => {
      if (!ACTIVE_DISPOSITIONS.includes(r.disposition_state)) return false;
      const ts = new Date(
        r.last_partner_action_at ?? r.outcome_created_at,
      ).getTime();
      return (now - ts) / (1000 * 60 * 60 * 24) >= NEEDS_TOUCH_DAYS;
    }).length;

    return {
      managedRevenue: formatCents(managedRevenueCents),
      closingRatio: formatPercent(soldCount, soldCount + lostCount),
      soldCount,
      lostCount,
      avgDaysToClose: avgDays == null ? "—" : `${avgDays}d`,
      needsAction,
    };
  }, [rows, summary]);

  // ─── Weekly grouping ─────────────────────────────────────────
  const week = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 }); // Mon
    const end = endOfWeek(new Date(), { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

    const inWeek = rows.filter((r) => {
      const a = weeklyAnchor(r);
      return a >= start && a <= end;
    });

    const buckets: { day: Date; rows: OutcomeRow[] }[] = days.map((d) => ({
      day: d,
      rows: inWeek
        .filter((r) => isSameDay(weeklyAnchor(r), d))
        .sort(
          (a, b) =>
            weeklyAnchor(b).getTime() - weeklyAnchor(a).getTime(),
        ),
    }));

    return { start, end, buckets };
  }, [rows]);

  // ─── Pipeline (active rows, most recent action first) ────────
  const pipeline = useMemo(() => {
    return rows
      .filter((r) => ACTIVE_DISPOSITIONS.includes(r.disposition_state))
      .sort((a, b) => {
        const ta = new Date(
          a.last_partner_action_at ?? a.outcome_created_at,
        ).getTime();
        const tb = new Date(
          b.last_partner_action_at ?? b.outcome_created_at,
        ).getTime();
        return tb - ta;
      });
  }, [rows]);

  return (
    <>
      <Helmet>
        <title>Revenue · WindowMan Partner Portal</title>
        <meta
          name="description"
          content="Partner CRM revenue dashboard — manage your active leads, weekly board, and closing performance."
        />
      </Helmet>

      <main
        className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 sm:py-8 space-y-6 sm:space-y-8 overflow-x-hidden"
        aria-busy={isLoading}
      >
        {/* ─── Page header ───────────────────────────────────── */}
        <header className="flex flex-col gap-1.5">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-950">
            Revenue Dashboard
          </h1>
          <p className="text-base font-medium text-slate-700 max-w-2xl">
            Your active pipeline, weekly board, and closed revenue —{" "}
            {format(week.start, "MMM d")} – {format(week.end, "MMM d")}.
          </p>
        </header>

        {/* ─── Error banner ──────────────────────────────────── */}
        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
            <div className="min-w-0">
              <div className="font-semibold">Could not load dashboard</div>
              <div className="text-xs">
                {error instanceof Error ? error.message : "Unknown error"}
              </div>
            </div>
          </div>
        )}

        {/* ─── KPI strip ─────────────────────────────────────── */}
        <section aria-labelledby="kpi-strip-heading">
          <SectionHeader
            icon={TrendingUp}
            title="Performance"
            subtitle="Your managed pipeline at a glance"
          />
          <h2 id="kpi-strip-heading" className="sr-only">
            Performance KPIs
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-lg border bg-muted/30 h-24 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiCard
                label="Managed Revenue"
                value={kpis.managedRevenue}
                hint="Sum of closed deals"
              />
              <KpiCard
                label="Closing Ratio"
                value={kpis.closingRatio}
                hint="Sold ÷ (Sold + Lost)"
              />
              <KpiCard
                label="Sold"
                value={String(kpis.soldCount)}
                hint="Closed-won outcomes"
              />
              <KpiCard
                label="Lost"
                value={String(kpis.lostCount)}
                hint="Closed-lost outcomes"
              />
              <KpiCard
                label="Avg. Days to Close"
                value={kpis.avgDaysToClose}
                hint="Outcome → sold latency"
              />
              <KpiCard
                label="Needs Action"
                value={String(kpis.needsAction)}
                hint={`Active & untouched > ${NEEDS_TOUCH_DAYS}d`}
                highlight={kpis.needsAction > 0}
              />
            </div>
          )}
        </section>

        {/* ─── Weekly board ──────────────────────────────────── */}
        <section aria-labelledby="weekly-board-heading">
          <SectionHeader
            icon={CalendarDays}
            title="This Week"
            subtitle="Leads grouped by your most recent action this week"
          />
          <h2 id="weekly-board-heading" className="sr-only">
            Weekly lead board
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-md border bg-muted/30 h-32 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {week.buckets.map(({ day, rows: dayRows }) => {
                const isToday = isSameDay(day, new Date());
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "rounded-lg border border-slate-300 bg-card p-3 shadow-sm min-h-[8rem] flex flex-col gap-1.5",
                      isToday && "border-sky-400 bg-sky-50/30",
                    )}
                  >
                    <div className="flex items-baseline justify-between">
                      <span
                        className={cn(
                          "text-sm font-extrabold uppercase tracking-wide",
                          isToday ? "text-sky-700" : "text-slate-700",
                        )}
                      >
                        {format(day, "EEE")}
                      </span>
                      <span className="text-xs font-semibold text-slate-700 tabular-nums">
                        {format(day, "MMM d")}
                      </span>
                    </div>
                    {dayRows.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-xs font-semibold text-slate-700/60">
                        —
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {dayRows.map((r) => (
                          <LeadCard key={r.outcome_id} row={r} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ─── Pipeline table ────────────────────────────────── */}
        <section aria-labelledby="pipeline-heading">
          <SectionHeader
            icon={TableIcon}
            title="Active Pipeline"
            subtitle="Every active lead, sorted by most recent activity"
          />
          <h2 id="pipeline-heading" className="sr-only">
            Active pipeline
          </h2>
          {isLoading ? (
            <div className="rounded-xl border border-slate-300 bg-card overflow-hidden shadow-sm">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 border-b last:border-b-0 bg-muted/20 animate-pulse"
                />
              ))}
            </div>
          ) : pipeline.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-card p-8 flex flex-col items-center text-center gap-2">
              <Inbox className="h-8 w-8 text-slate-700" aria-hidden />
              <div className="text-sm font-medium">No active leads</div>
              <p className="text-sm font-medium text-slate-700 max-w-sm">
                Once you start working leads from the Opportunity Market, they
                will appear here grouped by status.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-1">
                <Link to="/partner/opportunities">
                  Browse opportunities
                  <ArrowUpRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-300 bg-card overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-700">
                    <tr>
                      <th className="text-left font-extrabold px-3 py-3">Lead</th>
                      <th className="text-left font-extrabold px-3 py-3 hidden md:table-cell">
                        Location
                      </th>
                      <th className="text-left font-extrabold px-3 py-3">Status</th>
                      <th className="text-left font-extrabold px-3 py-3 hidden lg:table-cell">
                        Last action
                      </th>
                      <th className="text-right font-extrabold px-3 py-3 hidden sm:table-cell">
                        Projected
                      </th>
                      <th className="text-right font-extrabold px-3 py-3 hidden sm:table-cell">
                        Final
                      </th>
                      <th className="text-right font-extrabold px-3 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pipeline.map((r) => {
                      const dossierHref = r.analysis_id
                        ? `/partner/dossier/${r.analysis_id}`
                        : null;
                      return (
                        <tr
                          key={r.outcome_id}
                          className="min-h-[72px] border-t border-slate-300 bg-white hover:bg-blue-50/60 transition"
                        >
                          <td className="px-3 py-2">
                            <div className="text-base font-black text-slate-950 truncate">
                              {displayName(r)}
                            </div>
                            {r.grade && (
                              <div className="text-sm font-semibold text-slate-700">
                                Grade {r.grade}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-sm font-medium text-slate-700 hidden md:table-cell">
                            {locationLabel(r) ?? "—"}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs font-extrabold border",
                                DISPOSITION_COLOR[r.disposition_state],
                              )}
                            >
                              {DISPOSITION_LABEL[r.disposition_state]}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-sm font-medium text-slate-700 hidden lg:table-cell">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" aria-hidden />
                              {lastActionAge(r)}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-sm font-bold text-slate-900 hidden sm:table-cell">
                            {formatCents(r.projected_value_cents)}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-sm font-bold text-emerald-800 hidden sm:table-cell">
                            {formatCents(r.final_value_cents)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {dossierHref && (
                              <Button
                                asChild
                                size="sm"
                                variant="ghost"
                                className="h-9 px-3 border border-slate-300 bg-white text-sm font-bold shadow-sm hover:bg-slate-50"
                              >
                                <Link to={dossierHref}>
                                  Open
                                  <ArrowUpRight className="ml-1 h-3 w-3" />
                                </Link>
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {isLoading && (
          <div className="sr-only" role="status">
            <Loader2 className="animate-spin" /> Loading dashboard…
          </div>
        )}
      </main>
    </>
  );
}
