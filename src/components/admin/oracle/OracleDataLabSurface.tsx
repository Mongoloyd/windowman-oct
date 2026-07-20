/**
 * Oracle Data Lab v0 — fixture-only microscope.
 *
 * UNMOUNTED: do not import into App.tsx / AdminDashboard / adminDataService.
 * Purpose: see coverage, intake, early distributions from synthetic data.
 */

import { useMemo } from "react";
import {
  BarChart3,
  Database,
  Eye,
  MapPin,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  SYNTHETIC_ORACLE_OBSERVATIONS,
  computeDataIntake,
  computeFieldCoverage,
  computeProjectMarketBuckets,
  runOracleQuery,
  FIXTURE_ORACLE_CONFIDENCE_POLICY,
  SYNTHETIC_ORACLE_NOW_MS,
} from "@/lib/windowOracle";
import { SyntheticBanner } from "./SyntheticBanner";

function money(n: number | null): string {
  if (n === null) return "—";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function OracleDataLabSurface() {
  const observations = SYNTHETIC_ORACLE_OBSERVATIONS;

  const intake = useMemo(() => computeDataIntake(observations), [observations]);
  const coverage = useMemo(
    () => computeFieldCoverage(observations),
    [observations],
  );
  const projectMarket = useMemo(
    () => computeProjectMarketBuckets(observations),
    [observations],
  );

  const contractorRows = useMemo(() => {
    const result = runOracleQuery({
      observations,
      request: {
        geography: { county: "Broward" },
        provenance: "COMPARE",
        dateRangeMonths: 24,
      },
      policy: FIXTURE_ORACLE_CONFIDENCE_POLICY,
      nowMs: SYNTHETIC_ORACLE_NOW_MS,
    });
    return result.contractors;
  }, [observations]);

  const recent = useMemo(
    () =>
      [...observations]
        .sort(
          (a, b) =>
            Date.parse(b.observedAt) - Date.parse(a.observedAt),
        )
        .slice(0, 12),
    [observations],
  );

  return (
    <div className="space-y-4 p-4" data-testid="oracle-data-lab">
      <SyntheticBanner />

      <header className="space-y-1">
        <h1 className="text-lg font-bold text-slate-900 tracking-tight">
          Oracle Data Lab v0
        </h1>
        <p className="text-sm text-slate-700">
          Microscope over what WindowMan already captures — not the full searchable
          Oracle. Quoted and sold provenance stay separate.
        </p>
      </header>

      {/* DATA INTAKE */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Database className="h-4 w-4" />
            Data Intake
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            ["Quotes", intake.quotes],
            ["Analyses", intake.analyses],
            ["Trusted", intake.trusted],
            ["Rejected", intake.rejected],
            ["Manual review", intake.manualReview],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
            >
              <p className="text-xs text-slate-600">{label}</p>
              <p className="text-xl font-semibold text-slate-900">{value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* FIELD COVERAGE */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Eye className="h-4 w-4" />
            Field Coverage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {coverage.map((row) => (
            <div
              key={row.field}
              className="flex items-center justify-between gap-3 text-sm border-b border-slate-100 py-1.5 last:border-0"
            >
              <span className="font-medium text-slate-800">{row.field}</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-600 tabular-nums">
                  {row.present}/{row.total}
                </span>
                <Badge variant="outline" className="tabular-nums">
                  {row.pct === null ? "n/a" : `${row.pct}%`}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* PROJECT MARKET */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4" />
            Project Market (Quoted PPO)
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-600 border-b">
                <th className="py-2 pr-3">County</th>
                <th className="py-2 pr-3">Project type</th>
                <th className="py-2 pr-3">N</th>
                <th className="py-2 pr-3">Low</th>
                <th className="py-2 pr-3">P25</th>
                <th className="py-2 pr-3">Median</th>
                <th className="py-2 pr-3">Avg</th>
                <th className="py-2 pr-3">P75</th>
                <th className="py-2">High</th>
              </tr>
            </thead>
            <tbody>
              {projectMarket.map((row) => (
                <tr key={`${row.county}-${row.projectType}`} className="border-b border-slate-50">
                  <td className="py-2 pr-3">{row.county}</td>
                  <td className="py-2 pr-3">{row.projectType}</td>
                  <td className="py-2 pr-3 tabular-nums">{row.sampleCount}</td>
                  <td className="py-2 pr-3 tabular-nums">{money(row.min)}</td>
                  <td className="py-2 pr-3 tabular-nums">{money(row.p25)}</td>
                  <td className="py-2 pr-3 tabular-nums font-semibold">{money(row.median)}</td>
                  <td className="py-2 pr-3 tabular-nums">{money(row.average)}</td>
                  <td className="py-2 pr-3 tabular-nums">{money(row.p75)}</td>
                  <td className="py-2 tabular-nums">{money(row.max)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-500 mt-2">
            source_type=QUOTED · sample_count shown per row · synthetic geography
          </p>
        </CardContent>
      </Card>

      {/* CONTRACTOR OBSERVATIONS */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4" />
            Contractor Observations (WindowMan-observed)
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-600 border-b">
                <th className="py-2 pr-3">Contractor</th>
                <th className="py-2 pr-3">Quotes</th>
                <th className="py-2 pr-3">Verified sold</th>
                <th className="py-2 pr-3">Median quoted PPO</th>
                <th className="py-2 pr-3">Median sold PPO</th>
                <th className="py-2">Beat-price freq</th>
              </tr>
            </thead>
            <tbody>
              {contractorRows.map((row) => (
                <tr key={row.contractorKey} className="border-b border-slate-50">
                  <td className="py-2 pr-3">{row.contractorLabel}</td>
                  <td className="py-2 pr-3 tabular-nums">{row.quoteCount}</td>
                  <td className="py-2 pr-3 tabular-nums">{row.verifiedSoldCount}</td>
                  <td className="py-2 pr-3 tabular-nums">{money(row.medianQuotedPpo)}</td>
                  <td className="py-2 pr-3 tabular-nums">{money(row.medianSoldPpo)}</td>
                  <td className="py-2 tabular-nums">
                    {row.beatPriceFrequency === null
                      ? "—"
                      : `${Math.round(row.beatPriceFrequency * 100)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-500 mt-2">
            Not a market ranking — WindowMan-observed counts only.
          </p>
        </CardContent>
      </Card>

      {/* RECENT OBSERVATIONS */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <BarChart3 className="h-4 w-4" />
            Recent Observations
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-600 border-b">
                <th className="py-2 pr-3">ID</th>
                <th className="py-2 pr-3">Provenance</th>
                <th className="py-2 pr-3">ZIP</th>
                <th className="py-2 pr-3">County</th>
                <th className="py-2 pr-3">Brand</th>
                <th className="py-2 pr-3">Openings</th>
                <th className="py-2">PPO</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((o) => (
                <tr key={o.id} className="border-b border-slate-50">
                  <td className="py-2 pr-3 font-mono text-xs">{o.id}</td>
                  <td className="py-2 pr-3">
                    <Badge variant="outline">{o.provenance}</Badge>
                  </td>
                  <td className="py-2 pr-3">{o.zip ?? "—"}</td>
                  <td className="py-2 pr-3">{o.county ?? "—"}</td>
                  <td className="py-2 pr-3">{o.brand ?? "—"}</td>
                  <td className="py-2 pr-3 tabular-nums">{o.openingCount ?? "—"}</td>
                  <td className="py-2 tabular-nums">{money(o.ppo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
