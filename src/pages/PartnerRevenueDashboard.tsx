/**
 * PartnerRevenueDashboard — `/partner/revenue`
 *
 * Third primary surface in the partner portal (alongside Opportunity Market
 * and the Dossier child detail view). This is the partner-facing CRM/Revenue
 * destination.
 *
 * Sprint 1A — Information Architecture Foundation:
 *   Static placeholder shell only. No data fetching, no React Query, no
 *   Supabase calls, no mutations. Subsequent sprints will fill in:
 *     - KPI strip values (managed revenue, closing ratio, …)
 *     - Weekly lead board (current local week, hover quick preview)
 *     - Managed leads pipeline table
 *
 * Shell ownership: PartnerLayout (sticky header, credit pill, primary nav).
 */

import { Helmet } from "react-helmet-async";
import { TrendingUp, CalendarDays, Table as TableIcon, Sparkles } from "lucide-react";

const KPI_PLACEHOLDERS = [
  { label: "Managed Revenue", hint: "Sum of closed deal value" },
  { label: "Closing Ratio", hint: "Sold ÷ (Sold + Lost)" },
  { label: "Sold This Period", hint: "Closed-won outcomes" },
  { label: "Avg. Days to Close", hint: "Quote → sold latency" },
  { label: "Leads Needing Action", hint: "Untouched > 24h or due this week" },
] as const;

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

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
        <h2 className="text-base sm:text-lg font-semibold tracking-tight leading-none">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

export default function PartnerRevenueDashboard() {
  return (
    <>
      <Helmet>
        <title>Revenue · WindowMan Partner Portal</title>
        <meta
          name="description"
          content="Partner CRM revenue dashboard — manage your active leads, weekly board, and closing performance."
        />
      </Helmet>

      <main className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 sm:py-8 space-y-6 sm:space-y-8 overflow-x-hidden">
        {/* ─── Page header ─────────────────────────────────────── */}
        <header className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Revenue Dashboard
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-100 border border-sky-200 text-[10px] font-medium text-sky-600 uppercase tracking-wide">
              <Sparkles className="h-3 w-3" aria-hidden />
              Coming soon
            </span>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Track every lead you&apos;re actively working — weekly board, closing
            ratio, and managed revenue, all in one place.
          </p>
        </header>

        {/* ─── KPI strip placeholder ───────────────────────────── */}
        <section aria-labelledby="kpi-strip-heading">
          <SectionHeader
            icon={TrendingUp}
            title="Performance"
            subtitle="Your managed pipeline at a glance"
          />
          <h2 id="kpi-strip-heading" className="sr-only">
            Performance KPIs
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {KPI_PLACEHOLDERS.map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-lg border bg-card p-4 flex flex-col gap-2"
                aria-busy="true"
              >
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  {kpi.label}
                </div>
                <div
                  className="h-7 w-20 rounded bg-muted animate-pulse"
                  aria-hidden
                />
                <div className="text-[11px] text-muted-foreground/80">
                  {kpi.hint}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Weekly lead board placeholder ────────────────────── */}
        <section aria-labelledby="weekly-board-heading">
          <SectionHeader
            icon={CalendarDays}
            title="This Week"
            subtitle="Your active leads, grouped by day"
          />
          <h2 id="weekly-board-heading" className="sr-only">
            Weekly lead board
          </h2>
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 divide-y sm:divide-y-0 sm:divide-x">
              {DAY_LABELS.map((day) => (
                <div
                  key={day}
                  className="p-3 min-h-[140px] flex flex-col gap-2"
                  aria-busy="true"
                >
                  <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    {day}
                  </div>
                  <div className="flex-1 flex items-center justify-center">
                    <div
                      className="h-16 w-full rounded bg-muted/40 border border-dashed"
                      aria-hidden
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t text-center text-xs text-muted-foreground">
              Weekly board will render your active leads here.
            </div>
          </div>
        </section>

        {/* ─── Managed leads table placeholder ──────────────────── */}
        <section aria-labelledby="managed-leads-heading">
          <SectionHeader
            icon={TableIcon}
            title="Managed Leads"
            subtitle="Every lead you currently own"
          />
          <h2 id="managed-leads-heading" className="sr-only">
            Managed leads pipeline
          </h2>
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b bg-muted/40 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              <div className="col-span-4">Lead</div>
              <div className="col-span-2 hidden sm:block">City</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2 hidden sm:block">Last Action</div>
              <div className="col-span-2 text-right">Value</div>
            </div>
            <div className="divide-y">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="grid grid-cols-12 gap-2 px-4 py-3 items-center"
                  aria-busy="true"
                >
                  <div className="col-span-4">
                    <div className="h-4 w-32 rounded bg-muted animate-pulse" aria-hidden />
                  </div>
                  <div className="col-span-2 hidden sm:block">
                    <div className="h-3 w-20 rounded bg-muted animate-pulse" aria-hidden />
                  </div>
                  <div className="col-span-2">
                    <div className="h-5 w-20 rounded-full bg-muted animate-pulse" aria-hidden />
                  </div>
                  <div className="col-span-2 hidden sm:block">
                    <div className="h-3 w-16 rounded bg-muted animate-pulse" aria-hidden />
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <div className="h-4 w-16 rounded bg-muted animate-pulse" aria-hidden />
                  </div>
                </div>
              ))}
            </div>
            <div className="p-6 border-t text-center">
              <p className="text-sm font-medium text-foreground">No managed leads yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Once you start working leads from the Opportunity Market, they&apos;ll
                appear here.
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
