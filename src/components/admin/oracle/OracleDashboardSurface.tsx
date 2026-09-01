/**
 * Fixture-only Window Oracle operator cockpit.
 *
 * VISUAL-LAB ONLY: do not import into App.tsx / AdminDashboard / adminDataService.
 */

import { useState } from "react";
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
import { SyntheticBanner } from "./SyntheticBanner";

type TabId =
  | "overview"
  | "distribution"
  | "brands"
  | "contractors"
  | "quoted-vs-sold"
  | "observations";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "distribution", label: "Price distribution" },
  { id: "brands", label: "Brands / series" },
  { id: "contractors", label: "Contractors" },
  { id: "quoted-vs-sold", label: "Quoted vs sold" },
  { id: "observations", label: "Observations" },
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
      <div className="space-y-4 p-4" data-testid="oracle-dashboard">
        <SyntheticBanner />
        <div role="status" className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-6 text-center text-sm font-semibold text-amber-950">
          INSUFFICIENT_DATA · Cockpit metrics are withheld because the registered synthetic contract or minimum sample is not satisfied.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4" data-testid="oracle-dashboard">
      <SyntheticBanner />

      <header className="space-y-1">
        <h1 className="text-lg font-bold text-slate-900 tracking-tight">
          Window Oracle
        </h1>
        <p className="text-sm text-slate-700">
          Confidence before price. Median before average. Quoted ≠ sold.
        </p>
      </header>

      <OracleSearchFilters
        value={request}
        onChange={setRequest}
        onSearch={search}
      />

      <div role="tablist" aria-label="Operator Cockpit views" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-medium ${
              tab === t.id
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(tab === "overview" || tab === "distribution") && (
        <div className="grid lg:grid-cols-2 gap-4">
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
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Market context</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1 text-slate-700">
              <p>{response.wording.marketScopeLabel}</p>
              <p>
                Provenance counts — quoted: {response.provenance.quoted},
                verified sold: {response.provenance.verifiedSold}
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
        <Card data-testid="oracle-brand-series">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Brands / series</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
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
                    <td className="py-2 pr-3 tabular-nums">{row.observationCount}</td>
                    <td className="py-2 tabular-nums">
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
        <OracleContractorTable contractors={response.contractors} />
      )}

      {tab === "quoted-vs-sold" && (
        <OracleQuotedVsSoldPanel
          quoted={response.quotedPpo}
          verifiedSold={response.verifiedSoldPpo}
          deltaPct={response.quotedToSoldMedianDeltaPct}
        />
      )}

      {tab === "observations" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recent observation IDs</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {response.recentObservationIds.map((id) => (
              <Badge key={id} variant="outline" className="font-mono">
                {id}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
