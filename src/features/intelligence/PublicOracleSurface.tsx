import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  FileSearch,
  LineChart,
  LockKeyhole,
  Menu,
  Scale,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  canRenderMetricOnSurface,
  type DomainMetric,
} from "@/types/domainMetric";
import { formatDateRange, formatMoneyCents } from "./format";
import type { IntelligenceViewState } from "./types";
import type {
  PublicOracleViewModel,
  PublicPriceDistribution,
} from "./publicOracleAdapter";
import {
  PrincipleIcon,
  ProofPrinciple,
  SafeLinkLabel,
  SectionHeading,
  StatePanel,
  SyntheticPreviewBanner,
  UnverifiedMetricChip,
} from "./components/IntelligencePrimitives";
import { QuotedVsBoughtChart } from "./components/QuotedVsBoughtChart";

type Props = {
  viewModel: PublicOracleViewModel;
  state?: IntelligenceViewState;
  showProductHeader?: boolean;
};

type FilterState = {
  location: string;
  project: string;
  product: string;
  period: string;
};

const FILTER_DEFAULTS: FilterState = {
  location: "All synthetic regions",
  project: "All demo projects",
  product: "All product classes",
  period: "Jan–Aug 2026",
};

const DECISION_LENSES = Object.freeze([
  Object.freeze({
    title: "Scope clarity",
    explanation: "Compare what is explicitly included, excluded, and left ambiguous before comparing price.",
  }),
  Object.freeze({
    title: "Product fit",
    explanation: "Keep product and glass specifications visible so unlike packages are not presented as equivalent.",
  }),
  Object.freeze({
    title: "Outcome evidence",
    explanation: "Treat quoted, reported, accepted, and final states as separate evidence—not one blended result.",
  }),
] as const);

function PublicMetricValue<T>({
  metric,
  children,
}: {
  metric: DomainMetric<T>;
  children: (value: T) => ReactNode;
}) {
  if (!canRenderMetricOnSurface(metric, "PUBLIC_ORACLE")) {
    return <UnverifiedMetricChip metricId={metric.metricId} />;
  }
  return <>{children(metric.value)}</>;
}

export function PublicOracleSurface({
  viewModel,
  state = "SUCCESS",
  showProductHeader = true,
}: Props) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(FILTER_DEFAULTS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(FILTER_DEFAULTS);
  const uploadHref = "/?scroll=upload";

  const appliedSummary = useMemo(
    () => `${appliedFilters.location} · ${appliedFilters.project} · ${appliedFilters.product}`,
    [appliedFilters],
  );

  if (state !== "SUCCESS") {
    return (
      <div className="min-h-screen bg-[#F6F8FC] px-4 py-10">
        <SyntheticPreviewBanner />
        <div className="mt-8">
          <StatePanel state={state} audience="PUBLIC" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#F6F8FC] pb-24 text-[#0B1830] sm:pb-0"
      data-testid="window-oracle"
    >
      {showProductHeader ? (
        <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-[#071A3A]/95 text-white shadow-[0_8px_24px_rgba(7,26,58,0.18)] backdrop-blur">
          <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
            <Link to="/" className="flex items-center gap-2.5" aria-label="Window Oracle home">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-white/10 shadow-inner">
                <LineChart className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-lg font-black tracking-tight">Window Oracle</span>
            </Link>
            <nav className="hidden items-center gap-7 text-sm font-bold text-slate-200 lg:flex" aria-label="Window Oracle">
              <a href="#market-pulse" className="transition-colors hover:text-white">Market Pulse</a>
              <a href="#buyer-choices" className="transition-colors hover:text-white">Buyer patterns</a>
              <a href="#methodology" className="transition-colors hover:text-white">Methodology</a>
            </nav>
            <Link
              to={uploadHref}
              className="hidden min-h-11 items-center rounded-lg bg-[#356AC3] px-5 text-sm font-black text-white shadow-[0_6px_18px_rgba(53,106,195,0.35)] transition hover:bg-blue-600 sm:inline-flex"
            >
              Check My Estimate
            </Link>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/20 bg-white/10 sm:hidden"
              aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen((open) => !open)}
            >
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
          {mobileNavOpen ? (
            <nav className="border-t border-white/10 px-4 py-3 sm:hidden" aria-label="Mobile Window Oracle">
              {[
                ["#market-pulse", "Market Pulse"],
                ["#buyer-choices", "Buyer patterns"],
                ["#methodology", "Methodology"],
              ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMobileNavOpen(false)}
                  className="flex min-h-11 items-center border-b border-white/10 text-sm font-bold last:border-0"
                >
                  {label}
                </a>
              ))}
            </nav>
          ) : null}
        </header>
      ) : null}

      <main>
        <section className="relative overflow-hidden border-b border-slate-200 bg-white">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(53,106,195,0.12),transparent_34%),linear-gradient(to_bottom,#ffffff,#f7faff)]" />
          <div className="relative mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:gap-8 sm:px-6 sm:py-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:gap-12 lg:py-12">
            <div>
              <div className="mb-5 max-w-sm"><SyntheticPreviewBanner compact /></div>
              <h1 className="max-w-xl text-[2.15rem] font-black leading-[0.98] tracking-[-0.05em] text-[#08162F] sm:text-5xl lg:text-[3.35rem]">
                See what homeowners are quoted—and what buyers actually choose.
              </h1>
              <p className="mt-5 max-w-xl text-[15px] font-medium leading-7 text-slate-600 sm:text-lg">
                See how governed quote evidence and separately verified outcomes become clear, decision-ready market context.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:flex">
                <Link to={uploadHref} className="inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-lg bg-[#356AC3] px-3 text-center text-[13px] font-black text-white shadow-[0_8px_20px_rgba(53,106,195,0.28)] transition hover:-translate-y-0.5 hover:bg-blue-700 sm:px-5 sm:text-sm">
                  Check My Estimate
                </Link>
                <a href="#market-pulse" className="inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-lg border border-blue-300 bg-white px-3 text-center text-[13px] font-black text-blue-800 shadow-[0_3px_10px_rgba(15,23,42,0.08)] sm:px-5 sm:text-sm">
                  Explore Market
                </a>
              </div>
              <div className="mt-7 hidden grid-cols-3 divide-x divide-slate-200 border-y border-slate-200 py-4 sm:grid">
                <HeroProof label="Sample" metric={viewModel.evidence.sampleSize} suffix=" projects" />
                <HeroProof label="Outcomes known" metric={viewModel.evidence.outcomeCoveragePct} suffix="%" />
                <HeroProof label="Cohort" metric={viewModel.evidence.cohortMode} />
              </div>
            </div>

            <PriceRangeCard viewModel={viewModel} />
          </div>
        </section>

        <section className="border-b border-blue-100 bg-[linear-gradient(90deg,#f7fbff,#ffffff,#f7fbff)]">
          <div className="mx-auto grid max-w-7xl divide-y divide-blue-100 px-4 sm:grid-cols-2 sm:divide-x sm:divide-y-0 sm:px-6 lg:grid-cols-4">
            <ProofPrinciple icon={<PrincipleIcon kind="evidence" />} title="Quote evidence, not surveys" detail="Synthetic proof models observable quote and outcome records—not opinions." />
            <ProofPrinciple icon={<PrincipleIcon kind="separate" />} title="Quoted and accepted stay separate" detail="Offered prices never silently become verified outcomes." />
            <ProofPrinciple icon={<PrincipleIcon kind="sample" />} title="Sample size shown" detail="Every displayed cohort carries its evidence count, date range, and suppression state." />
            <ProofPrinciple icon={<PrincipleIcon kind="withheld" />} title="Thin data withheld" detail="Unsupported, conflicted, or small-cohort metrics do not render." />
          </div>
        </section>

        <section id="market-pulse" className="scroll-mt-28 bg-[#F6F8FC] py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionHeading
              title="Market Pulse"
              description="Explore the future query shape with synthetic evidence. The controls update the visible cohort label without implying a live data refresh."
              action={<span className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.06em] text-blue-800"><Sparkles className="h-3.5 w-3.5" /> Synthetic preview</span>}
            />

            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.07)]">
              <div className="grid gap-3 border-b border-slate-200 bg-slate-50/80 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                <FilterSelect label="Location" value={filters.location} options={["All synthetic regions", "Metro preview", "Statewide preview"]} onChange={(value) => setFilters((current) => ({ ...current, location: value }))} />
                <FilterSelect label="Project" value={filters.project} options={["All demo projects", "Smaller-project preview", "Larger-project preview"]} onChange={(value) => setFilters((current) => ({ ...current, project: value }))} />
                <FilterSelect label="Product" value={filters.product} options={["All product classes", "Vinyl preview", "Mixed-material preview"]} onChange={(value) => setFilters((current) => ({ ...current, product: value }))} />
                <FilterSelect label="Time period" value={filters.period} options={["Jan–Aug 2026", "Past 90 days preview"]} onChange={(value) => setFilters((current) => ({ ...current, period: value }))} />
                <button type="button" onClick={() => setAppliedFilters(filters)} className="min-h-12 rounded-lg bg-[#356AC3] px-5 text-sm font-black text-white shadow-[0_5px_14px_rgba(53,106,195,0.24)] hover:bg-blue-700 lg:self-end">
                  Update view
                </button>
              </div>

              <div className="border-b border-slate-200 px-5 py-3 text-xs font-semibold text-slate-600">
                Showing synthetic cohort: <span className="text-slate-950">{appliedSummary}</span>
              </div>

              <div className="grid divide-y divide-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
                <MarketMetric label="Quoted median" detail="What homeowners are offered" metric={viewModel.prices.quotedMedianCents} formatter={formatMoneyCents} tone="blue" />
                <MarketMetric label="Verified accepted median" detail="What buyers verify they chose" metric={viewModel.prices.acceptedMedianCents} formatter={formatMoneyCents} tone="orange" />
                <MarketMetric label="Synthetic difference" detail="Quoted minus accepted median" metric={viewModel.prices.quotedAcceptedGapCents} formatter={(value) => formatMoneyCents(value)} tone="emerald" />
                <MarketMetric label="Evidence coverage" detail="Coverage of governed outcome evidence" metric={viewModel.evidence.outcomeCoveragePct} formatter={(value) => `${value}%`} tone="slate" />
              </div>
            </div>
          </div>
        </section>

        <section id="buyer-choices" className="scroll-mt-28 border-y border-slate-200 bg-white py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionHeading
              title="Does the lowest quote usually win?"
              description="The refined public proof keeps this as a qualitative product story until same-project bid identity and verified outcome coverage are production-bound."
              action={<a href="#methodology"><SafeLinkLabel>Why we withhold the percentage</SafeLinkLabel></a>}
            />
            <div className="mt-7 grid gap-4 lg:grid-cols-[1.05fr_repeat(3,1fr)]">
              <article className="relative overflow-hidden rounded-2xl border border-blue-800 bg-[#071A3A] p-6 text-white shadow-[0_18px_38px_rgba(7,26,58,0.2)]">
                <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-blue-500/20 blur-2xl" />
                <Scale className="h-8 w-8 text-blue-300" aria-hidden="true" />
                <h3 className="mt-5 text-2xl font-black leading-tight">Best value can matter more than lowest price.</h3>
                <p className="mt-3 text-sm font-medium leading-6 text-slate-300">This is positioning copy, not a quantified market claim. The percentage remains withheld until the identity model can support it.</p>
              </article>
              {DECISION_LENSES.map((pattern, index) => <BuyerPatternCard key={pattern.title} pattern={pattern} index={index} />)}
            </div>
          </div>
        </section>

        <section id="methodology" className="scroll-mt-28 bg-[#F6F8FC] py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.06)] sm:p-8">
              <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-blue-700">Evidence &amp; provenance</p>
                  <h2 className="mt-2 text-3xl font-black tracking-[-0.035em]">How Window Oracle works</h2>
                  <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-600">Transparent methodology, observable evidence, and deterministic calculations—before presentation.</p>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-900">Contract: {viewModel.contractVersion}</div>
              </div>
              <div className="grid divide-y divide-slate-200 pt-2 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
                <MethodStep number="01" icon={<FileSearch className="h-5 w-5" />} title="Observe quotes" detail="Eligible estimates remain separately labeled quote observations." />
                <MethodStep number="02" icon={<ShieldCheck className="h-5 w-5" />} title="Verify outcomes" detail="Reported, accepted, final, and paid states do not collapse together." />
                <MethodStep number="03" icon={<BarChart3 className="h-5 w-5" />} title="Calculate safely" detail="Deterministic adapters produce medians, distributions, and evidence metadata." />
                <MethodStep number="04" icon={<LockKeyhole className="h-5 w-5" />} title="Withhold thin claims" detail="Unsupported, conflicted, or undersized metrics fail closed." />
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-blue-100 bg-white py-12">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 text-center sm:px-6">
            <div>
              <h2 className="text-3xl font-black tracking-[-0.04em]">Market averages are useful. Your actual estimate is better.</h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-600">Start with your contractor quote, then compare its scope and price with transparent evidence as the Oracle matures.</p>
            </div>
            <div className="flex w-full max-w-md gap-3">
              <Link to={uploadHref} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-lg bg-[#356AC3] px-5 text-sm font-black text-white shadow-lg">Check My Estimate</Link>
              <a href="#market-pulse" className="inline-flex min-h-12 flex-1 items-center justify-center rounded-lg border border-blue-300 bg-white px-5 text-sm font-black text-blue-800">Explore Market</a>
            </div>
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-blue-500/30 bg-[#0A57C9] p-3 text-white shadow-[0_-10px_28px_rgba(7,26,58,0.22)] sm:hidden">
        <Link to={uploadHref} className="mx-auto flex min-h-14 max-w-md items-center justify-between px-2">
          <span><span className="block text-base font-black">Check My Estimate</span><span className="block text-xs text-blue-100">See how your quote compares.</span></span>
          <ArrowRight className="h-5 w-5" />
        </Link>
      </div>
    </div>
  );
}

function PriceRangeCard({ viewModel }: { viewModel: PublicOracleViewModel }) {
  const quoted = viewModel.prices.quotedDistribution;
  const accepted = viewModel.prices.acceptedDistribution;
  const distributionsVisible = canRenderMetricOnSurface(quoted, "PUBLIC_ORACLE") && canRenderMetricOnSurface(accepted, "PUBLIC_ORACLE");

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_22px_55px_rgba(15,23,42,0.12),0_2px_8px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-3 sm:px-6">
        <div><p className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">Synthetic market evidence</p><h2 className="mt-1 text-lg font-black">Typical total project price range</h2></div>
        <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.06em] text-blue-800">Preview</span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-slate-200 px-4 py-4 sm:px-6">
        <RangeSummary label="Quoted (what homeowners are told)" metric={quoted} tone="blue" />
        <RangeSummary label="Verified accepted (what buyers choose)" metric={accepted} tone="orange" />
      </div>
      <div className="px-4 pb-4 sm:px-6 sm:pb-6">
        {distributionsVisible ? <QuotedVsBoughtChart quoted={quoted.value} accepted={accepted.value} compact /> : (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
            <UnverifiedMetricChip metricId={quoted.metricId} />
            <UnverifiedMetricChip metricId={accepted.metricId} />
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 border-t border-slate-200 bg-slate-50/70 sm:grid-cols-4 sm:divide-y-0">
        <EvidenceDatum label="Sample size" metric={viewModel.evidence.sampleSize} formatter={(value) => `${value} projects`} />
        <EvidenceDatum label="Date range" metric={viewModel.evidence.dateRange} formatter={(value) => formatDateRange(value.from, value.to)} />
        <EvidenceDatum label="Outcome coverage" metric={viewModel.evidence.outcomeCoveragePct} formatter={(value) => `${value}%`} />
        <EvidenceDatum label="Cohort" metric={viewModel.evidence.cohortMode} formatter={(value) => value} />
      </div>
      <p className="border-t border-slate-200 px-4 py-3 text-[11px] font-medium leading-5 text-slate-500 sm:px-6">Synthetic preview only. Quoted and verified-accepted populations remain separate; no real customer or contractor data appears here.</p>
    </article>
  );
}

function HeroProof<T>({ label, metric, suffix = "" }: { label: string; metric: DomainMetric<T>; suffix?: string }) {
  return <div className="px-2 first:pl-0 last:pr-0 sm:px-4"><p className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-500">{label}</p><div className="mt-1 text-xs font-black text-slate-950 sm:text-sm"><PublicMetricValue metric={metric}>{(value) => `${String(value)}${suffix}`}</PublicMetricValue></div></div>;
}

function RangeSummary({ label, metric, tone }: { label: string; metric: DomainMetric<PublicPriceDistribution>; tone: "blue" | "orange" }) {
  return <div className={cn("min-w-0 pr-3 last:pl-3 last:pr-0", tone === "blue" ? "text-blue-800" : "text-[#B84F19]")}><p className="min-h-8 text-[10px] font-black leading-4 sm:text-xs">{label}</p><div className="mt-2 font-mono text-base font-black tabular-nums sm:text-xl"><PublicMetricValue metric={metric}>{(value) => `${formatMoneyCents(value.p25Cents)} – ${formatMoneyCents(value.p75Cents)}`}</PublicMetricValue></div><p className="mt-1 text-[11px] font-semibold text-slate-500">middle 50% of this synthetic cohort</p></div>;
}

function EvidenceDatum<T>({ label, metric, formatter }: { label: string; metric: DomainMetric<T>; formatter: (value: T) => string }) {
  return <div className="min-w-0 p-3 sm:px-4"><p className="text-[10px] font-black uppercase tracking-[0.06em] text-slate-500">{label}</p><div className="mt-1 truncate text-xs font-black text-slate-950" title={canRenderMetricOnSurface(metric, "PUBLIC_ORACLE") ? formatter(metric.value) : undefined}><PublicMetricValue metric={metric}>{formatter}</PublicMetricValue></div></div>;
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="relative block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.07em] text-slate-500">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-12 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 pr-9 text-sm font-bold text-slate-800 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" aria-label={label}>{options.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown className="pointer-events-none absolute bottom-3.5 right-3 h-4 w-4 text-slate-500" aria-hidden="true" /></label>;
}

function MarketMetric<T>({ label, detail, metric, formatter, tone }: { label: string; detail: string; metric: DomainMetric<T>; formatter: (value: T) => string; tone: "blue" | "orange" | "emerald" | "slate" }) {
  const toneClass = tone === "blue" ? "text-blue-700" : tone === "orange" ? "text-[#B84F19]" : tone === "emerald" ? "text-emerald-700" : "text-slate-800";
  return <div className="p-5"><p className={cn("text-xs font-black", toneClass)}>{label}</p><div className="mt-3 font-mono text-2xl font-black tabular-nums tracking-tight text-slate-950"><PublicMetricValue metric={metric}>{formatter}</PublicMetricValue></div><p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{detail}</p></div>;
}

function BuyerPatternCard({ pattern, index }: { pattern: (typeof DECISION_LENSES)[number]; index: number }) {
  const icons = [ShieldCheck, LineChart, Users];
  const Icon = icons[index] ?? CheckCircle2;
  return <article className="rounded-2xl border border-slate-200 bg-[#FCFCFA] p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]"><div className="flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700"><Icon className="h-5 w-5" /></span><span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-slate-500">Illustrative pattern</span></div><h3 className="mt-5 text-lg font-black leading-5">{pattern.title}</h3><p className="mt-3 text-sm font-medium leading-6 text-slate-600">{pattern.explanation}</p><p className="mt-5 border-t border-slate-200 pt-3 text-[11px] font-bold text-slate-500">No individual price or outcome percentage displayed.</p></article>;
}

function MethodStep({ number, icon, title, detail }: { number: string; icon: ReactNode; title: string; detail: string }) {
  return <div className="p-5 first:pl-0 last:pr-0 sm:first:pl-5"><div className="flex items-center gap-3 text-blue-700"><span className="font-mono text-xs font-black">{number}</span><span className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-200 bg-blue-50">{icon}</span></div><h3 className="mt-4 text-sm font-black">{title}</h3><p className="mt-2 text-xs font-medium leading-5 text-slate-600">{detail}</p></div>;
}
