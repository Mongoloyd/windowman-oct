/**
 * Fixture-only Window Oracle operator cockpit.
 *
 * VISUAL-LAB ONLY: do not import into App.tsx / AdminDashboard / adminDataService.
 */

import { useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  FlaskConical,
  LayoutDashboard,
  ListTree,
  Scale,
  Tags,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { canRenderRegisteredMetric } from "@/types/domainMetric";
import type { MetricId } from "@/types/metrics.dictionary";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OracleCallSummaryPanel } from "./OracleCallSummaryPanel";
import { OracleConfidenceCard } from "./OracleConfidenceCard";
import { OracleContractorTable } from "./OracleContractorTable";
import { OracleDistributionBand } from "./OracleDistributionBand";
import { useOracleFixtureHarness } from "./OracleFixtureHarness";
import { OracleQuotedVsSoldPanel } from "./OracleQuotedVsSoldPanel";
import { OracleSearchFilters } from "./OracleSearchFilters";
import { ORACLE_VISUAL_TOKENS } from "@/features/intelligence/components/OracleVisualSystem";

type TabId =
  | "overview"
  | "distribution"
  | "brands"
  | "contractors"
  | "quoted-vs-sold"
  | "observations";

const TABS: Array<{ id: TabId; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "distribution", label: "Price distribution", icon: BarChart3 },
  { id: "brands", label: "Brands / series", icon: Tags },
  { id: "contractors", label: "Contractors", icon: UsersRound },
  { id: "quoted-vs-sold", label: "Quoted vs sold", icon: Scale },
  { id: "observations", label: "Observations", icon: ListTree },
];

const COCKPIT_METRIC_IDS: readonly MetricId[] = [
  "cockpit.confidence_level",
  "cockpit.sample_count",
  "cockpit.exact_match_count",
  "cockpit.geography_level",
  "cockpit.ppo_median",
  "cockpit.ppo_p25",
  "cockpit.ppo_p75",
  "cockpit.ppo_average",
  "cockpit.ppo_min",
  "cockpit.ppo_max",
  "cockpit.homeowner_ppo",
  "cockpit.provenance_counts",
  "cockpit.quoted_vs_sold_delta_pct",
  "cockpit.contractor_quote_count",
  "cockpit.contractor_sold_count",
  "cockpit.contractor_median_quoted_ppo",
  "cockpit.contractor_median_sold_ppo",
  "cockpit.contractor_beat_price_freq",
  "cockpit.contractor_tier",
  "cockpit.brand_series_median_ppo",
  "cockpit.call_summary_position",
  "cockpit.eligibility_summary",
  "cockpit.date_range",
  "cockpit.fallbacks",
  "cockpit.brand_series_observation_count",
  "cockpit.recent_observation_id",
  "cockpit.high_price_outlier_flag",
  "cockpit.tight_distribution_flag",
];

export function OracleDashboardSurface() {
  const { request, setRequest, response, search } = useOracleFixtureHarness();
  const [tab, setTab] = useState<TabId>("overview");
  const contractReady = COCKPIT_METRIC_IDS.every((metricId) =>
    canRenderRegisteredMetric(metricId, "COCKPIT", response.sampleCount),
  );

  if (!contractReady) {
    return (
      <main className="min-h-[calc(100vh-6.75rem)] bg-slate-100 px-4 py-5 text-slate-950 sm:px-6 sm:py-7" data-testid="oracle-dashboard">
        <div className="mx-auto max-w-7xl space-y-4">
          <CockpitHeader />
          <OracleSearchFilters value={request} onChange={setRequest} onSearch={search} />
          <div role="status" className="rounded-2xl border border-dashed border-amber-400 bg-amber-50 p-8 text-center text-sm font-bold text-amber-950 shadow-inner">
            INSUFFICIENT_DATA · Cockpit metrics are withheld because the registered synthetic contract or minimum sample is not satisfied. Broaden the controlled fixture cohort and run the query again.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-6.75rem)] bg-[#EEF3F8] bg-[radial-gradient(circle_at_1px_1px,rgba(53,106,195,0.10)_1px,transparent_0)] bg-[size:24px_24px] px-4 py-5 text-slate-950 sm:px-6 sm:py-7" data-testid="oracle-dashboard">
      <div className="mx-auto max-w-7xl space-y-4">
        <CockpitHeader />

        <OracleSearchFilters
          value={request}
          onChange={setRequest}
          onSearch={search}
        />

      <div role="tablist" aria-label="Operator Cockpit views" className="grid grid-cols-2 gap-1.5 rounded-2xl border border-slate-300 bg-slate-200/70 p-2 shadow-inner sm:grid-cols-3 lg:grid-cols-6" data-testid="oracle-cockpit-tabs">
        {TABS.map((t) => (
          (() => {
            const Icon = t.icon;
            return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`oracle-panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-black transition-[background-color,border-color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A92F9] focus-visible:ring-offset-2 ${
              tab === t.id
                ? "border-[#0B1F3A] bg-[#0B1F3A] text-white shadow-[inset_0_3px_0_#4A92F9,0_6px_14px_-8px_rgba(15,23,42,0.85)]"
                : "border-slate-300 bg-white text-slate-700 shadow-sm hover:border-slate-400 hover:bg-slate-50 active:translate-y-px"
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t.label}
          </button>
            );
          })()
        ))}
        </div>

      {tab === "overview" && (
        <div id="oracle-panel-overview" role="tabpanel" className="grid gap-4 lg:grid-cols-2">
          <OracleConfidenceCard
            confidence={response.confidence}
            exactMatchCount={response.exactMatchCount}
            fallbacksApplied={response.fallbacksApplied}
            dateRange={response.dateRange}
            geographyLevel={response.geographyMatch.level}
          />
          <OracleDistributionBand
            ppo={response.ppo}
            homeownerPpo={request.homeownerPpo}
          />
          <OracleCallSummaryPanel summary={response.callSummary} />
          <Card className="rounded-2xl border-slate-300 shadow-[0_18px_38px_-30px_rgba(15,23,42,0.45)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-black">Synthetic cohort context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm font-medium text-slate-700">
              <p>{response.wording.marketScopeLabel}</p>
              <p>
                Provenance counts — quoted:{" "}
                <span className="font-mono font-black tabular-nums text-slate-950">{response.provenance.quoted}</span>, verified sold:{" "}
                <span className="font-mono font-black tabular-nums text-slate-950">{response.provenance.verifiedSold}</span>
              </p>
              {response.confidence.highPriceOutliersPresent && (
                <Badge className="bg-amber-100 text-amber-950 border-amber-300">
                  High-price outliers present
                </Badge>
              )}
              {response.confidence.tightDistribution && (
                <Badge className="bg-emerald-100 text-emerald-950 border-emerald-300">
                  Tight price distribution
                </Badge>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "brands" && (
        <Card id="oracle-panel-brands" role="tabpanel" data-testid="oracle-brand-series" className="rounded-2xl border-slate-300 shadow-[0_18px_38px_-30px_rgba(15,23,42,0.45)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Brands / series</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="text-left text-slate-600 border-b">
                  <th className="py-2 pr-3">Brand</th>
                  <th className="py-2 pr-3">Series</th>
                  <th className="py-2 pr-3">N</th>
                  <th className="py-2">Median PPO</th>
                </tr>
              </thead>
              <tbody>
                {response.brandSeries.map((row, i) => (
                  <tr key={`${row.brand}-${row.series}-${i}`} className="border-b border-slate-50">
                    <td className="py-2 pr-3">{row.brand ?? "—"}</td>
                    <td className="py-2 pr-3">{row.series ?? "—"}</td>
                    <td className="py-2 pr-3 font-mono font-bold tabular-nums">{row.observationCount}</td>
                    <td className="py-2 font-mono font-bold tabular-nums">
                      {row.medianPpo === null
                        ? "—"
                        : `$${Math.round(row.medianPpo).toLocaleString("en-US")}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {tab === "contractors" && (
        <div id="oracle-panel-contractors" role="tabpanel"><OracleContractorTable contractors={response.contractors} /></div>
      )}

      {tab === "quoted-vs-sold" && (
        <div id="oracle-panel-quoted-vs-sold" role="tabpanel">
          <OracleQuotedVsSoldPanel quoted={response.quotedPpo} verifiedSold={response.verifiedSoldPpo} deltaPct={response.quotedToSoldMedianDeltaPct} />
        </div>
      )}

      {tab === "distribution" && (
        <div id="oracle-panel-distribution" role="tabpanel" className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
          <OracleDistributionBand ppo={response.ppo} homeownerPpo={request.homeownerPpo} />
          <OracleConfidenceCard
            confidence={response.confidence}
            exactMatchCount={response.exactMatchCount}
            fallbacksApplied={response.fallbacksApplied}
            dateRange={response.dateRange}
            geographyLevel={response.geographyMatch.level}
          />
        </div>
      )}

      {tab === "observations" && (
        <Card id="oracle-panel-observations" role="tabpanel" className="rounded-2xl border-slate-300 shadow-[0_18px_38px_-30px_rgba(15,23,42,0.45)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recent observation IDs</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {response.recentObservationIds.map((id) => (
              <Badge key={id} variant="outline" className="justify-start rounded-md border-slate-300 bg-slate-50 px-3 py-2 font-mono font-bold tabular-nums text-slate-800">
                {id}
              </Badge>
            ))}
          </CardContent>
        </Card>
        )}
      </div>
    </main>
  );
}

function CockpitHeader() {
  return (
    <header className={`overflow-hidden border-slate-300 ${ORACLE_VISUAL_TOKENS.panel}`} data-testid="operator-cockpit-header">
      <div className="grid gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-[0.14em] text-[#356AC3]">
            <FlaskConical className="h-4 w-4" aria-hidden />
            Operator cockpit · fixture laboratory
          </div>
          <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-[-0.045em] text-[#071C3E] sm:text-4xl">
            Interrogate a synthetic cohort before the homeowner call.
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-700 sm:text-base">
            Set a controlled fixture cohort, review confidence first, then inspect price and provenance without implying live market coverage.
          </p>
        </div>

        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
          <div className="flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-[0.12em]">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            Synthetic / development data
          </div>
          <p className="mt-1 max-w-xs text-xs font-semibold leading-5 text-amber-900">
            Local fixture engine only · no Supabase, network, or production market connection.
          </p>
        </div>
      </div>
    </header>
  );
}
