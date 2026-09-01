/**
 * Oracle Data Lab v0 — fixture-only microscope.
 *
 * VISUAL-LAB ONLY: do not import into App.tsx / AdminDashboard / adminDataService.
 * Purpose: see coverage, intake, early distributions from synthetic data.
 */

import { useMemo } from "react";
import { canRenderRegisteredMetric } from "@/types/domainMetric";
import type { MetricId } from "@/types/metrics.dictionary";
import {
  BadgeCheck,
  BarChart3,
  CircleX,
  Database,
  Eye,
  FileStack,
  MapPin,
  ScanSearch,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { ORACLE_VISUAL_TOKENS } from "@/features/intelligence/components/OracleVisualSystem";

const DATA_LAB_METRIC_IDS: readonly MetricId[] = [
  "datalab.intake_quotes",
  "datalab.intake_analyses",
  "datalab.intake_trusted",
  "datalab.intake_rejected",
  "datalab.intake_manual_review",
  "datalab.field_coverage_pct",
  "datalab.project_market_distribution",
  "datalab.contractor_label",
  "datalab.contractor_quote_count",
  "datalab.contractor_sold_count",
  "datalab.contractor_median_quoted_ppo",
  "datalab.contractor_median_sold_ppo",
  "datalab.contractor_beat_price_frequency",
  "datalab.recent_observation_id",
  "datalab.recent_observation_provenance",
  "datalab.recent_observation_region",
  "datalab.recent_observation_zip",
  "datalab.recent_observation_brand",
  "datalab.recent_observation_opening_count",
  "datalab.recent_observation_ppo",
];

function money(n: number | null): string {
  if (n === null) return "—";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

const panelClassName =
  `overflow-hidden ring-1 ring-slate-300/70 ${ORACLE_VISUAL_TOKENS.panel}`;

const tableHeaderClassName =
  "whitespace-nowrap px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.08em] text-slate-500";

const tableCellClassName =
  "whitespace-nowrap border-r border-slate-100 px-4 py-4 align-middle text-sm text-slate-700 last:border-r-0";

type SectionTone = "intake" | "coverage" | "market" | "contractor" | "ledger";

const sectionToneStyles: Record<SectionTone, {
  rail: string;
  header: string;
  icon: string;
  label: string;
}> = {
  intake: {
    rail: "border-t-[#356AC3]",
    header: "bg-blue-50/70",
    icon: "border-blue-200 bg-white text-[#356AC3]",
    label: "border-blue-200 bg-blue-100/70 text-blue-900",
  },
  coverage: {
    rail: "border-t-cyan-600",
    header: "bg-cyan-50/65",
    icon: "border-cyan-200 bg-white text-cyan-800",
    label: "border-cyan-200 bg-cyan-100/70 text-cyan-900",
  },
  market: {
    rail: "border-t-[#C27040]",
    header: "bg-orange-50/70",
    icon: "border-orange-200 bg-white text-[#9A4D25]",
    label: "border-orange-200 bg-orange-100/75 text-orange-950",
  },
  contractor: {
    rail: "border-t-slate-700",
    header: "bg-slate-100/80",
    icon: "border-slate-300 bg-white text-slate-800",
    label: "border-slate-300 bg-slate-200/80 text-slate-900",
  },
  ledger: {
    rail: "border-t-indigo-600",
    header: "bg-indigo-50/65",
    icon: "border-indigo-200 bg-white text-indigo-800",
    label: "border-indigo-200 bg-indigo-100/75 text-indigo-950",
  },
};

type IntakeVolumeProps = {
  label: string;
  value: number;
  detail: string;
  icon: "quotes" | "analyses";
};

function IntakeVolume({ label, value, detail, icon }: IntakeVolumeProps) {
  const Icon = icon === "quotes" ? FileStack : ScanSearch;
  const treatment = icon === "quotes"
    ? "border-blue-300/90 bg-blue-50/80 shadow-[0_1px_0_rgba(255,255,255,0.95)_inset,0_6px_15px_rgba(53,106,195,0.10)]"
    : "border-indigo-300/80 bg-indigo-50/75 shadow-[0_1px_0_rgba(255,255,255,0.95)_inset,0_6px_15px_rgba(67,56,202,0.09)]";
  const iconTreatment = icon === "quotes"
    ? "border-blue-200 text-[#356AC3]"
    : "border-indigo-200 text-indigo-700";

  return (
    <div className={`relative flex min-h-32 items-start justify-between gap-4 overflow-hidden rounded-xl border p-4 ${treatment}`}>
      <span className={`absolute inset-y-0 left-0 w-1 ${icon === "quotes" ? "bg-[#356AC3]" : "bg-indigo-600"}`} aria-hidden />
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-600">{label}</p>
        <p className="mt-2 font-mono text-3xl font-black tabular-nums text-slate-950">{value}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
      </div>
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg border bg-white shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_3px_8px_rgba(15,23,42,0.08)] ${iconTreatment}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
    </div>
  );
}

type IntakeDispositionProps = {
  label: string;
  value: number;
  tone: "trusted" | "rejected" | "review";
};

function IntakeDisposition({ label, value, tone }: IntakeDispositionProps) {
  const styles = {
    trusted: {
      icon: BadgeCheck,
      well: "border-emerald-300 bg-emerald-50 text-emerald-800",
      value: "text-emerald-950",
      card: "border-emerald-200 bg-emerald-50/65",
    },
    rejected: {
      icon: CircleX,
      well: "border-rose-300 bg-rose-50 text-rose-700",
      value: "text-rose-950",
      card: "border-rose-200 bg-rose-50/65",
    },
    review: {
      icon: UserRoundCheck,
      well: "border-amber-300 bg-amber-50 text-amber-800",
      value: "text-amber-950",
      card: "border-amber-200 bg-amber-50/70",
    },
  }[tone];
  const Icon = styles.icon;

  return (
    <div className={`flex min-h-20 items-center gap-3 rounded-lg border p-3 shadow-[0_1px_0_rgba(255,255,255,0.95)_inset,0_2px_6px_rgba(15,23,42,0.05)] ${styles.card}`}>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${styles.well}`}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-bold text-slate-600">{label}</p>
        <p className={`font-mono text-xl font-black tabular-nums ${styles.value}`}>{value}</p>
      </div>
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  detail,
  tone,
  sectionLabel,
}: {
  icon: typeof Database;
  title: string;
  detail: string;
  tone: SectionTone;
  sectionLabel: string;
}) {
  const styles = sectionToneStyles[tone];

  return (
    <CardHeader className={`border-b border-slate-200 px-4 py-4 sm:px-5 ${styles.header}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_3px_7px_rgba(15,23,42,0.08)] ${styles.icon}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <h2 className="text-sm font-black tracking-tight text-slate-950">{title}</h2>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">{detail}</p>
        </div>
        </div>
        <span className={`hidden shrink-0 rounded-md border px-2 py-1 font-mono text-[10px] font-black uppercase tracking-[0.08em] sm:inline-flex ${styles.label}`}>
          {sectionLabel}
        </span>
      </div>
    </CardHeader>
  );
}

function GuardedValue({ children }: { children: string | number }) {
  const withheld = children === "INSUFFICIENT_DATA";

  return withheld ? (
    <span className="inline-flex rounded-md border border-dashed border-amber-300 bg-amber-50 px-2 py-1 font-mono text-[10px] font-black tracking-[-0.02em] text-amber-950">
      INSUFFICIENT_DATA
    </span>
  ) : (
    <span className="font-mono font-bold tabular-nums text-slate-900">{children}</span>
  );
}

export function OracleDataLabSurface() {
  const observations = SYNTHETIC_ORACLE_OBSERVATIONS;
  const contractReady = DATA_LAB_METRIC_IDS.every((metricId) =>
    canRenderRegisteredMetric(metricId, "DATALAB", observations.length),
  );

  const intake = useMemo(() => computeDataIntake(observations), [observations]);
  const coverage = useMemo(
    () => computeFieldCoverage(observations),
    [observations],
  );
  const projectMarket = useMemo(
    () => computeProjectMarketBuckets(observations),
    [observations],
  );
  const reportableProjectMarket = projectMarket.filter((row) =>
    canRenderRegisteredMetric(
      "datalab.project_market_distribution",
      "DATALAB",
      row.sampleCount,
    ),
  );
  const withheldProjectMarketCount = projectMarket.length - reportableProjectMarket.length;

  const contractorRows = useMemo(() => {
    const result = runOracleQuery({
      observations,
      request: {
        geography: { county: "Synthetic Region A" },
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

  if (!contractReady) {
    return (
      <main className="space-y-4 bg-[#EAF0F7] p-4" data-testid="oracle-data-lab">
        <SyntheticBanner />
        <div role="status" className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-6 text-center font-mono text-sm font-black text-amber-950">
          INSUFFICIENT_DATA · Data Lab values are withheld because the registered synthetic contract is incomplete.
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-5 bg-[#EAF0F7] p-4 sm:p-5" data-testid="oracle-data-lab">
      <SyntheticBanner />

      <header className="max-w-4xl rounded-xl border border-blue-200 bg-blue-50/75 px-4 py-4 shadow-[inset_3px_0_0_#356AC3,inset_0_1px_0_rgba(255,255,255,0.95),0_5px_14px_rgba(15,23,42,0.05)] sm:px-5">
        <h1 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
          Oracle Data Lab v0
        </h1>
        <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">
          Fixture-based contract microscope — not a live searchable Oracle. Quoted
          and sold provenance stay separate.
        </p>
      </header>

      {/* DATA INTAKE */}
      <Card className={`${panelClassName} border-t-2 ${sectionToneStyles.intake.rail}`} data-testid="data-intake-panel">
        <SectionHeading
          icon={Database}
          title="Data Intake"
          detail="Synthetic document volume and deterministic fixture disposition."
          tone="intake"
          sectionLabel="Intake"
        />
        <CardContent className="grid gap-3 bg-[#F5F8FC] p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[1fr_1fr_1.45fr]">
          <IntakeVolume label="Quote documents" value={intake.quotes} detail="Synthetic quoted observations" icon="quotes" />
          <IntakeVolume label="Analysis runs" value={intake.analyses} detail="All synthetic observations" icon="analyses" />
          <div className="col-span-1 grid grid-cols-2 gap-2 rounded-xl border-2 border-slate-300/90 bg-slate-100/90 p-2.5 shadow-[inset_0_1px_2px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.95)] sm:col-span-2 sm:grid-cols-3 lg:col-span-1 lg:grid-cols-1 xl:grid-cols-3">
            <IntakeDisposition label="Trusted" value={intake.trusted} tone="trusted" />
            <IntakeDisposition label="Rejected" value={intake.rejected} tone="rejected" />
            <div className="col-span-2 sm:col-span-1 lg:col-span-1">
              <IntakeDisposition label="Manual review" value={intake.manualReview} tone="review" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FIELD COVERAGE */}
      <Card className={`${panelClassName} border-t-2 ${sectionToneStyles.coverage.rail}`} data-testid="field-coverage-panel">
        <SectionHeading
          icon={Eye}
          title="Field Coverage"
          detail="Presence only; coverage does not establish semantic or market eligibility."
          tone="coverage"
          sectionLabel="Coverage"
        />
        <CardContent className="space-y-2 bg-[#F3F8FA] p-3 sm:p-4">
          {coverage.map((row) => (
            <div
              key={row.field}
              className="grid gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,1),0_2px_7px_rgba(15,23,42,0.045)] transition-colors hover:border-cyan-300 hover:bg-cyan-50/30 sm:grid-cols-[minmax(10rem,0.7fr)_minmax(12rem,1fr)_auto] sm:items-center sm:gap-5 sm:px-4"
            >
              <span className="text-sm font-bold text-slate-800">{row.field}</span>
              <div className="h-2.5 overflow-hidden rounded border border-slate-200 bg-slate-100 shadow-inner" aria-hidden>
                <div
                  className={`h-full ${row.pct !== null && row.pct < 50 ? "bg-amber-500" : "bg-[#356AC3]"}`}
                  style={{ width: `${row.pct ?? 0}%` }}
                />
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span className="font-mono text-xs font-bold tabular-nums text-slate-500">
                  {row.present}/{row.total}
                </span>
                <Badge variant="outline" className={`min-w-16 justify-center rounded-md font-mono text-xs font-black tabular-nums ${row.pct !== null && row.pct < 50 ? "border-amber-300 bg-amber-50 text-amber-950" : "border-blue-200 bg-blue-50 text-blue-950"}`}>
                  {row.pct === null ? "n/a" : `${row.pct}%`}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* PROJECT MARKET */}
      <Card className={`${panelClassName} border-t-2 ${sectionToneStyles.market.rail}`} data-testid="project-market-panel">
        <SectionHeading
          icon={MapPin}
          title="Project Market (Quoted PPO)"
          detail="Synthetic geography cohorts with quoted provenance only."
          tone="market"
          sectionLabel="Quoted only"
        />
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-orange-200 bg-orange-50/50 px-4 py-2 sm:px-5">
            <span className="font-mono text-[10px] font-black uppercase tracking-[0.1em] text-orange-950">Quoted provenance only</span>
            <span className="text-[11px] font-bold text-slate-500 sm:hidden">Swipe for columns</span>
          </div>
          <div className="overflow-x-auto overscroll-x-contain" data-testid="project-market-scroll">
          <table className="min-w-[860px] w-full border-collapse">
            <caption className="sr-only">Synthetic geography quoted PPO distribution</caption>
            <thead>
              <tr className="border-b border-slate-300 bg-slate-100/90">
                <th className={tableHeaderClassName}>Synthetic geography</th>
                <th className={tableHeaderClassName}>Project type</th>
                <th className={tableHeaderClassName}>N</th>
                <th className={tableHeaderClassName}>Low</th>
                <th className={tableHeaderClassName}>P25</th>
                <th className={`${tableHeaderClassName} bg-orange-50/80 text-orange-950`}>Median</th>
                <th className={tableHeaderClassName}>Avg</th>
                <th className={tableHeaderClassName}>P75</th>
                <th className={tableHeaderClassName}>High</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {reportableProjectMarket.map((row) => (
                <tr key={`${row.county}-${row.projectType}`} className="transition-colors odd:bg-white even:bg-slate-50/55 hover:bg-orange-50/45">
                  <td className={`${tableCellClassName} font-bold text-slate-900`}>{row.county}</td>
                  <td className={`${tableCellClassName} font-mono text-xs`}>{row.projectType}</td>
                  <td className={`${tableCellClassName} font-mono font-bold tabular-nums`}>{row.sampleCount}</td>
                  <td className={`${tableCellClassName} font-mono tabular-nums`}>{money(row.min)}</td>
                  <td className={`${tableCellClassName} font-mono tabular-nums`}>{money(row.p25)}</td>
                  <td className={`${tableCellClassName} bg-orange-50/55 font-mono font-black tabular-nums text-orange-950`}>{money(row.median)}</td>
                  <td className={`${tableCellClassName} font-mono tabular-nums`}>{money(row.average)}</td>
                  <td className={`${tableCellClassName} font-mono tabular-nums`}>{money(row.p75)}</td>
                  <td className={`${tableCellClassName} font-mono tabular-nums`}>{money(row.max)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className="border-t border-slate-200 bg-slate-50/80 px-4 py-3 sm:px-5">
          <p className="font-mono text-[11px] leading-5 text-slate-500">
            source_type=QUOTED · sample_count shown per row · synthetic geography
          </p>
          {withheldProjectMarketCount > 0 && (
            <p className="mt-1 text-xs font-bold text-amber-800">
              {withheldProjectMarketCount} synthetic cohort withheld below the registered minimum sample of 5.
            </p>
          )}
          </div>
        </CardContent>
      </Card>

      {/* CONTRACTOR OBSERVATIONS */}
      <Card className={`${panelClassName} border-t-2 ${sectionToneStyles.contractor.rail}`} data-testid="contractor-observations-panel">
        <SectionHeading
          icon={Users}
          title="Contractor Observations (synthetic fixture)"
          detail="Synthetic contractor labels; outcome metrics remain sample-gated."
          tone="contractor"
          sectionLabel="Sample gated"
        />
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-slate-300 bg-slate-100/70 px-4 py-2 sm:px-5">
            <span className="font-mono text-[10px] font-black uppercase tracking-[0.1em] text-slate-800">Synthetic fixture identities</span>
            <span className="text-[11px] font-bold text-slate-500 sm:hidden">Swipe for columns</span>
          </div>
          <div className="overflow-x-auto overscroll-x-contain" data-testid="contractor-observations-scroll">
          <table className="min-w-[820px] w-full border-collapse">
            <caption className="sr-only">Synthetic contractor observations</caption>
            <thead>
              <tr className="border-b border-slate-300 bg-slate-100/90">
                <th className={tableHeaderClassName}>Synthetic contractor</th>
                <th className={`${tableHeaderClassName} bg-blue-50/75 text-blue-950`}>Quotes</th>
                <th className={`${tableHeaderClassName} bg-emerald-50/70 text-emerald-950`}>Verified sold</th>
                <th className={`${tableHeaderClassName} bg-blue-50/75 text-blue-950`}>Median quoted PPO</th>
                <th className={`${tableHeaderClassName} bg-emerald-50/70 text-emerald-950`}>Median sold PPO</th>
                <th className={`${tableHeaderClassName} bg-emerald-50/70 text-emerald-950`}>Beat-price freq</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {contractorRows.map((row) => {
                const quoteMetricsReady = canRenderRegisteredMetric(
                  "datalab.contractor_median_quoted_ppo",
                  "DATALAB",
                  row.quoteCount,
                );
                const soldMetricsReady = canRenderRegisteredMetric(
                  "datalab.contractor_median_sold_ppo",
                  "DATALAB",
                  row.verifiedSoldCount,
                );

                return (
                  <tr key={row.contractorKey} className="transition-colors odd:bg-white even:bg-slate-50/55 hover:bg-blue-50/40">
                    <td className={`${tableCellClassName} font-bold text-slate-900`}>{row.contractorLabel}</td>
                    <td className={`${tableCellClassName} bg-blue-50/35`}>
                      <GuardedValue>{quoteMetricsReady ? row.quoteCount : "INSUFFICIENT_DATA"}</GuardedValue>
                    </td>
                    <td className={`${tableCellClassName} bg-emerald-50/30`}>
                      <GuardedValue>{soldMetricsReady ? row.verifiedSoldCount : "INSUFFICIENT_DATA"}</GuardedValue>
                    </td>
                    <td className={`${tableCellClassName} bg-blue-50/35`}>
                      <GuardedValue>{quoteMetricsReady ? money(row.medianQuotedPpo) : "INSUFFICIENT_DATA"}</GuardedValue>
                    </td>
                    <td className={`${tableCellClassName} bg-emerald-50/30`}>
                      <GuardedValue>{soldMetricsReady ? money(row.medianSoldPpo) : "INSUFFICIENT_DATA"}</GuardedValue>
                    </td>
                    <td className={`${tableCellClassName} bg-emerald-50/30`}>
                      <GuardedValue>{!soldMetricsReady || row.beatPriceFrequency === null
                        ? "INSUFFICIENT_DATA"
                        : `${Math.round(row.beatPriceFrequency * 100)}%`}</GuardedValue>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          <p className="border-t border-slate-200 bg-slate-50/80 px-4 py-3 text-xs leading-5 text-slate-500 sm:px-5">
            Synthetic observations only. Contractor outcome metrics fail closed below their registered sample minimum.
          </p>
        </CardContent>
      </Card>

      {/* RECENT OBSERVATIONS */}
      <Card className={`${panelClassName} border-t-2 ${sectionToneStyles.ledger.rail}`} data-testid="recent-observations-panel">
        <SectionHeading
          icon={BarChart3}
          title="Recent Synthetic Observations"
          detail="Latest fixture records; identifiers and geography are synthetic."
          tone="ledger"
          sectionLabel="Fixture ledger"
        />
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-indigo-200 bg-indigo-50/55 px-4 py-2 sm:px-5">
            <span className="font-mono text-[10px] font-black uppercase tracking-[0.1em] text-indigo-950">Synthetic observation ledger</span>
            <span className="text-[11px] font-bold text-slate-500 sm:hidden">Swipe for columns</span>
          </div>
          <div className="overflow-x-auto overscroll-x-contain" data-testid="recent-observations-scroll">
          <table className="min-w-[760px] w-full border-collapse">
            <caption className="sr-only">Recent synthetic observations</caption>
            <thead>
              <tr className="border-b border-slate-300 bg-slate-100/90">
                <th className={tableHeaderClassName}>Synthetic observation ID</th>
                <th className={tableHeaderClassName}>Provenance</th>
                <th className={tableHeaderClassName}>Synthetic ZIP</th>
                <th className={tableHeaderClassName}>Synthetic geography</th>
                <th className={tableHeaderClassName}>Brand</th>
                <th className={tableHeaderClassName}>Openings</th>
                <th className={tableHeaderClassName}>PPO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {recent.map((o) => (
                <tr key={o.id} className="transition-colors odd:bg-white even:bg-slate-50/55 hover:bg-indigo-50/45">
                  <td className={tableCellClassName}>
                    <span className="inline-flex rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 font-mono text-[11px] font-black tabular-nums text-indigo-950 shadow-sm">{o.id}</span>
                  </td>
                  <td className={tableCellClassName}>
                    <Badge variant="outline" className={`rounded-md font-mono text-[10px] font-black tracking-[0.04em] ${o.provenance === "VERIFIED_SOLD" ? "border-emerald-300 bg-emerald-50 text-emerald-950" : "border-blue-200 bg-blue-50 text-blue-950"}`}>{o.provenance}</Badge>
                  </td>
                  <td className={`${tableCellClassName} font-mono tabular-nums`}>{o.zip ?? "—"}</td>
                  <td className={`${tableCellClassName} font-bold text-slate-800`}>{o.county ?? "—"}</td>
                  <td className={tableCellClassName}>{o.brand ?? "—"}</td>
                  <td className={`${tableCellClassName} font-mono tabular-nums`}>{o.openingCount ?? "—"}</td>
                  <td className={`${tableCellClassName} font-mono font-bold tabular-nums text-slate-950`}>{money(o.ppo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
