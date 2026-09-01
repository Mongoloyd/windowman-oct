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
  SectionHeading,
  StatePanel,
  SyntheticPreviewBanner,
  UnverifiedMetricChip,
} from "./components/IntelligencePrimitives";
import { ORACLE_VISUAL_TOKENS } from "./components/OracleVisualSystem";
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
      className="min-h-screen bg-[#F6F8FC] pb-24 font-sans text-[#0B1830] antialiased sm:pb-0"
      data-testid="window-oracle"
    >
      {showProductHeader ? (
        <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-[#071A3A]/95 text-white shadow-[0_8px_24px_rgba(7,26,58,0.18)] backdrop-blur">
          <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
            <Link to="/" className="flex min-h-11 items-center gap-2.5" aria-label="Window Oracle home">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-white/10 shadow-inner">
                <LineChart className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-lg font-black tracking-tight">Window Oracle</span>
            </Link>
            <nav className="hidden items-center rounded-xl border border-white/20 bg-white/[0.07] p-1 text-sm font-bold text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_5px_14px_rgba(0,0,0,0.12)] lg:flex" aria-label="Window Oracle">
              <a href="#market-pulse" className="inline-flex min-h-10 items-center rounded-lg border border-transparent px-4 transition-[background-color,border-color,box-shadow,color,transform] hover:border-white/20 hover:bg-white/10 hover:text-white hover:shadow-sm active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A92F9] focus-visible:ring-offset-2 focus-visible:ring-offset-[#071C3E]">Market Pulse</a>
              <span className="h-5 w-px bg-white/20" aria-hidden="true" />
              <a href="#buyer-choices" className="inline-flex min-h-10 items-center rounded-lg border border-transparent px-4 transition-[background-color,border-color,box-shadow,color,transform] hover:border-white/20 hover:bg-white/10 hover:text-white hover:shadow-sm active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A92F9] focus-visible:ring-offset-2 focus-visible:ring-offset-[#071C3E]">Buyer patterns</a>
              <span className="h-5 w-px bg-white/20" aria-hidden="true" />
              <a href="#methodology" className="inline-flex min-h-10 items-center rounded-lg border border-transparent px-4 transition-[background-color,border-color,box-shadow,color,transform] hover:border-white/20 hover:bg-white/10 hover:text-white hover:shadow-sm active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A92F9] focus-visible:ring-offset-2 focus-visible:ring-offset-[#071C3E]">Methodology</a>
            </nav>
            <Link
              to={uploadHref}
              className="hidden min-h-11 items-center rounded-lg border border-[#9CC8FF] bg-[#4A92F9] px-5 text-sm font-black text-[#071A3A] shadow-[0_5px_0_-2px_#1F65C9,0_10px_20px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.45)] transition-[background-color,box-shadow,transform] hover:bg-[#62A2FA] active:translate-y-px active:shadow-[0_2px_0_-1px_#1F65C9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#071A3A] sm:inline-flex"
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
        <section className="border-b-2 border-[#C6D5E7] bg-[#F3F8FE] bg-[linear-gradient(rgba(74,146,249,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(74,146,249,0.055)_1px,transparent_1px)] bg-[size:28px_28px]">
          <div className="mx-auto grid max-w-7xl gap-7 px-4 py-8 sm:gap-8 sm:px-6 sm:py-12 lg:grid-cols-[5fr_7fr] lg:items-center lg:gap-12 lg:py-16">
            <div>
              <div className="mb-5 max-w-sm"><SyntheticPreviewBanner compact /></div>
              <h1 className="max-w-[20ch] text-4xl font-black leading-[1.06] tracking-[-0.035em] text-[#0B1830] sm:max-w-xl sm:text-5xl sm:leading-[1.04] lg:text-[3.5rem] lg:leading-[1.02]">
                See what homeowners are quoted—and what buyers actually choose.
              </h1>
              <p className="mt-4 max-w-xl text-base font-medium leading-[1.625] text-[#667085] sm:mt-5 sm:text-lg sm:leading-7">
                See how governed quote evidence and separately verified outcomes become clear, decision-ready market context.
              </p>
              <div className="mt-6 grid gap-3 sm:flex sm:items-center">
                <Link
                  to={uploadHref}
                  className="inline-flex min-h-12 w-full items-center justify-center whitespace-nowrap rounded-[10px] border border-[#2F7CE8] bg-[#4A92F9] px-5 text-center text-sm font-black text-[#071A3A] shadow-[0_7px_0_-3px_#1F65C9,0_12px_24px_rgba(31,101,201,0.22)] transition-[background-color,box-shadow,transform] hover:bg-[#5B9DFA] active:translate-y-0.5 active:shadow-[0_3px_0_-2px_#1F65C9,0_6px_12px_rgba(31,101,201,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A92F9] focus-visible:ring-offset-2 sm:w-auto sm:px-6"
                >
                  Check My Estimate
                </Link>
                <a
                  href="#market-pulse"
                  className="inline-flex min-h-12 w-full items-center justify-center whitespace-nowrap rounded-[10px] border border-[#7B8798] bg-white px-5 text-center text-sm font-black text-[#315F9F] shadow-[0_2px_6px_rgba(11,24,48,0.08)] transition-[background-color,box-shadow,transform] hover:bg-[#F4F7FB] active:translate-y-px active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A92F9] focus-visible:ring-offset-2 sm:w-auto sm:px-6"
                >
                  Explore Market
                </a>
              </div>
            </div>

            <PriceRangeCard viewModel={viewModel} />
          </div>
        </section>

        <section className="border-b-2 border-[#D6E0EC] bg-[#FCFDFE] shadow-[inset_0_1px_0_white,inset_0_-1px_0_rgba(74,146,249,0.06)]">
          <div className="mx-auto grid max-w-7xl divide-y divide-[#D6E0EC] px-4 sm:grid-cols-2 sm:divide-x sm:divide-y-0 sm:px-6 lg:grid-cols-4">
            <ProofPrinciple icon={<PrincipleIcon kind="evidence" />} title="Quote evidence, not surveys" detail="Synthetic proof models observable quote and outcome records—not opinions." />
            <ProofPrinciple icon={<PrincipleIcon kind="separate" />} title="Quoted and accepted stay separate" detail="Offered prices never silently become verified outcomes." />
            <ProofPrinciple icon={<PrincipleIcon kind="sample" />} title="Sample size shown" detail="Every displayed cohort carries its evidence count, date range, and suppression state." />
            <ProofPrinciple icon={<PrincipleIcon kind="withheld" />} title="Thin data withheld" detail="Unsupported, conflicted, or small-cohort metrics do not render." />
          </div>
        </section>

        <section id="market-pulse" className="scroll-mt-28 bg-[#EDF4FB] bg-[radial-gradient(circle_at_1px_1px,rgba(53,106,195,0.10)_1px,transparent_0)] bg-[size:24px_24px] py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionHeading
              title="Market Pulse"
              description="Explore the future query shape with synthetic evidence. The controls update the visible cohort label without implying a live data refresh."
              action={<span className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.06em] text-blue-800"><Sparkles className="h-3.5 w-3.5" /> Synthetic preview</span>}
            />

            <div className="mt-6 overflow-hidden rounded-2xl border border-[#D6E0EC] bg-white shadow-[0_12px_32px_-4px_rgba(15,23,42,0.10),0_2px_6px_rgba(15,23,42,0.05),inset_0_1px_0_rgba(255,255,255,0.90)]">
              <div className="grid gap-3 border-b border-[#D6E0EC] bg-[#F4F7FB] p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:p-5">
                <FilterSelect label="Location" value={filters.location} options={["All synthetic regions", "Metro preview", "Statewide preview"]} onChange={(value) => setFilters((current) => ({ ...current, location: value }))} />
                <FilterSelect label="Project" value={filters.project} options={["All demo projects", "Smaller-project preview", "Larger-project preview"]} onChange={(value) => setFilters((current) => ({ ...current, project: value }))} />
                <FilterSelect label="Product" value={filters.product} options={["All product classes", "Vinyl preview", "Mixed-material preview"]} onChange={(value) => setFilters((current) => ({ ...current, product: value }))} />
                <FilterSelect label="Time period" value={filters.period} options={["Jan–Aug 2026", "Past 90 days preview"]} onChange={(value) => setFilters((current) => ({ ...current, period: value }))} />
                <button type="button" onClick={() => setAppliedFilters(filters)} className="min-h-12 rounded-[10px] border border-[#071A3A] bg-[#071A3A] px-5 text-sm font-black text-white shadow-[0_5px_12px_rgba(7,26,58,0.20)] transition-[background-color,box-shadow,transform] hover:bg-[#102A52] active:scale-[0.98] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A92F9] focus-visible:ring-offset-2 lg:self-end">
                  Update view
                </button>
              </div>

              <div className="flex flex-col gap-1 border-b border-[#D6E0EC] bg-white px-5 py-3 sm:flex-row sm:items-center sm:gap-2">
                <span className="font-mono text-[10px] font-black uppercase tracking-[0.08em] text-[#667085]">Applied cohort</span>
                <span className="text-xs font-bold text-[#0B1830]">{appliedSummary}</span>
              </div>

              <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1.35fr_0.85fr] lg:gap-5">
                <div className="overflow-hidden rounded-xl border border-[#D6E0EC] bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.90)]">
                  <div className="border-b border-[#D6E0EC] px-4 py-3 font-mono text-[10px] font-black uppercase tracking-[0.08em] text-[#667085]">Price comparison</div>
                  <div className="grid divide-y divide-[#D6E0EC] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                    <MarketMetric label="Quoted median" detail="What homeowners are offered" metric={viewModel.prices.quotedMedianCents} formatter={formatMoneyCents} tone="quoted" />
                    <MarketMetric label="Verified accepted median" detail="What buyers verify they chose" metric={viewModel.prices.acceptedMedianCents} formatter={formatMoneyCents} tone="verified" />
                  </div>
                </div>
                <div className="rounded-xl border border-[#AFC4DD] bg-[#F2F6FB] shadow-[0_8px_20px_rgba(11,24,48,0.07),inset_0_1px_0_rgba(255,255,255,0.90)]">
                  <MarketMetric label="Synthetic difference" detail="Quoted minus accepted median" metric={viewModel.prices.quotedAcceptedGapCents} formatter={(value) => formatMoneyCents(value)} tone="difference" featured />
                </div>
              </div>
              <div className="grid border-t border-[#D6E0EC] bg-[#F4F7FB] sm:grid-cols-[0.8fr_1.2fr] sm:divide-x sm:divide-[#D6E0EC]">
                <MarketMetric label="Evidence coverage" detail="Coverage of governed outcome evidence" metric={viewModel.evidence.outcomeCoveragePct} formatter={(value) => `${value}%`} tone="slate" compact />
                <div className="border-t border-[#D6E0EC] px-5 py-4 sm:border-t-0">
                  <p className="font-mono text-[10px] font-black uppercase tracking-[0.08em] text-[#667085]">Preview behavior</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-[#475467]">Controls change the visible synthetic cohort label only; no live market query is performed.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="buyer-choices" className="scroll-mt-28 border-y-2 border-[#D4DFEC] bg-[#FAFCFF] py-12 shadow-[inset_0_12px_28px_-28px_rgba(7,26,58,0.32),inset_0_-12px_28px_-28px_rgba(7,26,58,0.24)] sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div>
              <h2 className="text-2xl font-black tracking-[-0.025em] text-[#0B1830]">Does the lowest quote usually win?</h2>
              <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-[#667085]">Compare the evidence around price before treating the lowest number as the strongest offer.</p>
              <a href="#methodology" className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-[#315F9F] underline decoration-[#A7C7F5] underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A92F9] focus-visible:ring-offset-2">
                Why the outcome percentage is withheld <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <div className="mt-3 flex max-w-2xl items-start gap-2 text-xs font-semibold leading-5 text-[#667085]">
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-[#315F9F]" aria-hidden="true" />
                <span>Qualitative guidance only. No individual price or outcome percentage is displayed.</span>
              </div>
            </div>
            <div className="mt-7 grid gap-4 lg:grid-cols-[0.9fr_1.8fr] lg:gap-5">
              <article className="rounded-2xl border border-[#17345E] bg-[#071A3A] p-6 text-white shadow-[0_16px_36px_rgba(7,26,58,0.18),inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-7">
                <Scale className="h-8 w-8 text-[#8EC0FF]" aria-hidden="true" />
                <h3 className="mt-5 text-2xl font-black leading-tight">Best value can matter more than lowest price.</h3>
                <p className="mt-3 text-sm font-medium leading-6 text-[#CBD5E1]">Price alone cannot show whether scope, product specifications, and outcome evidence are comparable.</p>
                <a href="#methodology" className="mt-6 inline-flex min-h-11 items-center gap-2 border-b border-white/35 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A92F9] focus-visible:ring-offset-2 focus-visible:ring-offset-[#071A3A]">Review the evidence method <ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
              </article>
              <div className="grid gap-3">
                {DECISION_LENSES.map((pattern, index) => <BuyerPatternCard key={pattern.title} pattern={pattern} index={index} />)}
              </div>
            </div>
          </div>
        </section>

        <section id="methodology" className="scroll-mt-28 bg-[#E9F1F8] bg-[linear-gradient(rgba(53,106,195,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(53,106,195,0.045)_1px,transparent_1px)] bg-[size:32px_32px] py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="overflow-hidden rounded-2xl border-2 border-[#B8CAE0] bg-white shadow-[0_24px_52px_-18px_rgba(7,26,58,0.30),0_8px_18px_-12px_rgba(53,106,195,0.24),inset_0_1px_0_rgba(255,255,255,0.96)]">
              <div className="border-b-2 border-[#C7D7E9] bg-[#F6FAFF] px-5 py-6 shadow-[inset_0_-1px_0_white] sm:px-8">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.10em] text-[#315F9F]">Evidence &amp; provenance</p>
                  <h2 className="mt-2 text-3xl font-black tracking-[-0.035em] text-[#0B1830]">How Window Oracle works</h2>
                  <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#667085]">Transparent methodology, observable evidence, and deterministic calculations—before presentation.</p>
                </div>
              </div>
              <div className="relative grid gap-3 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4 lg:gap-4 lg:px-8 lg:py-7 before:pointer-events-none before:absolute before:left-[12.5%] before:right-[12.5%] before:top-[53px] before:hidden before:h-px before:bg-[#AFC4DD] lg:before:block">
                <MethodStep number="01" tone="blue" icon={<FileSearch className="h-5 w-5" />} title="Observe quotes" detail="Eligible estimates remain separately labeled quote observations." />
                <MethodStep number="02" tone="emerald" icon={<ShieldCheck className="h-5 w-5" />} title="Verify outcomes" detail="Reported, accepted, final, and paid states do not collapse together." />
                <MethodStep number="03" tone="violet" icon={<BarChart3 className="h-5 w-5" />} title="Calculate safely" detail="Deterministic adapters produce medians, distributions, and evidence metadata." />
                <MethodStep number="04" tone="slate" icon={<LockKeyhole className="h-5 w-5" />} title="Withhold thin claims" detail="Unsupported, conflicted, or undersized metrics fail closed." />
              </div>
              <div className="flex flex-col gap-1 border-t border-[#D6E0EC] bg-[#F4F7FB] px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                <span className="font-mono text-[10px] font-black uppercase tracking-[0.08em] text-[#667085]">Governed presentation contract</span>
                <span className="font-mono text-xs font-bold text-[#315F9F]">{viewModel.contractVersion}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t-2 border-[#D6E0EC] bg-[#F7FAFE] py-12">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 text-center sm:px-6">
            <div>
              <h2 className="text-3xl font-black tracking-[-0.04em]">Market averages are useful. Your actual estimate is better.</h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-600">Start with your contractor quote, then compare its scope and price with transparent evidence as the Oracle matures.</p>
            </div>
            <div className="flex w-full max-w-md gap-3">
              <Link to={uploadHref} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-[10px] border border-[#2F7CE8] bg-[#4A92F9] px-5 text-sm font-black text-[#071A3A] shadow-[0_6px_0_-3px_#1F65C9,0_10px_20px_rgba(31,101,201,0.18)] transition-[box-shadow,transform] active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A92F9] focus-visible:ring-offset-2">Check My Estimate</Link>
              <a href="#market-pulse" className="inline-flex min-h-12 flex-1 items-center justify-center rounded-[10px] border border-[#7B8798] bg-white px-5 text-sm font-black text-[#315F9F] shadow-[0_2px_6px_rgba(11,24,48,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A92F9] focus-visible:ring-offset-2">Explore Market</a>
            </div>
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#2F7CE8] bg-[#4A92F9] p-3 text-[#071A3A] shadow-[0_-10px_28px_rgba(7,26,58,0.22)] sm:hidden">
        <Link to={uploadHref} className="mx-auto flex min-h-14 max-w-md items-center justify-between px-2">
          <span><span className="block text-base font-black">Check My Estimate</span><span className="block text-xs font-semibold text-[#071C3E]">See how your quote compares.</span></span>
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
    <article className={cn(ORACLE_VISUAL_TOKENS.panel, "relative overflow-hidden border-2 border-[#B8CAE0] bg-white shadow-[0_26px_55px_-24px_rgba(7,26,58,0.38),0_10px_24px_-16px_rgba(74,146,249,0.32),inset_0_1px_0_rgba(255,255,255,0.98)] before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-[#4A92F9]")}>
      <div className="flex flex-col gap-2 border-b-2 border-[#C9D7E7] bg-[#F8FBFF] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div><p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#667085]">Synthetic market evidence</p><h2 className="mt-1 text-lg font-black text-[#0B1830] sm:text-xl">Typical total project price range</h2></div>
        <span className="w-fit rounded-md border border-[#A7C7F5] bg-[#F2F6FB] px-2 py-1 text-[10px] font-black uppercase tracking-[0.06em] text-[#315F9F]">Preview</span>
      </div>
      <div className="grid divide-y divide-[#C9D7E7] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <RangeSummary label="Quoted (what homeowners are told)" metric={quoted} tone="quoted" />
        <RangeSummary label="Verified accepted (what buyers choose)" metric={accepted} tone="verified" />
      </div>
      <div className="border-t border-[#D6E0EC] bg-[#FCFDFE] px-4 py-4 sm:px-6 sm:py-6">
        {distributionsVisible ? <QuotedVsBoughtChart quoted={quoted.value} accepted={accepted.value} compact variant="public-stage-1a" /> : (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-[#D6E0EC] bg-[#F4F7FB] p-5 text-center">
            <UnverifiedMetricChip metricId={quoted.metricId} />
            <UnverifiedMetricChip metricId={accepted.metricId} />
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 divide-x divide-y divide-[#D6E0EC] border-t border-[#D6E0EC] bg-[#F4F7FB] sm:grid-cols-4 sm:divide-y-0">
        <EvidenceDatum label="Sample size" metric={viewModel.evidence.sampleSize} formatter={(value) => `${value} projects`} />
        <EvidenceDatum label="Date range" metric={viewModel.evidence.dateRange} formatter={(value) => formatDateRange(value.from, value.to)} />
        <EvidenceDatum label="Outcome coverage" metric={viewModel.evidence.outcomeCoveragePct} formatter={(value) => `${value}%`} />
        <EvidenceDatum label="Cohort" metric={viewModel.evidence.cohortMode} formatter={(value) => value} />
      </div>
      <p className="border-t border-[#D6E0EC] px-4 py-3 text-[11px] font-medium leading-[18px] text-[#667085] sm:px-6">Synthetic preview only. Quoted and verified-accepted populations remain separate; no real customer or contractor data appears here.</p>
    </article>
  );
}

function RangeSummary({ label, metric, tone }: { label: string; metric: DomainMetric<PublicPriceDistribution>; tone: "quoted" | "verified" }) {
  return <div className={cn("min-w-0 p-4 sm:p-5 lg:p-6", tone === "quoted" ? "bg-[#F4F8FF] text-[#315F9F]" : "bg-[#F3FBF7] text-[#087A55]")}><p className="text-xs font-black leading-[18px]">{label}</p><div className="mt-2 whitespace-nowrap font-mono text-xl font-black tabular-nums tracking-tight sm:text-[1.35rem]"><PublicMetricValue metric={metric}>{(value) => `${formatMoneyCents(value.p25Cents)} – ${formatMoneyCents(value.p75Cents)}`}</PublicMetricValue></div><p className="mt-1 text-[11px] font-semibold leading-[17px] text-[#667085]">middle 50% of this synthetic cohort</p></div>;
}

function EvidenceDatum<T>({ label, metric, formatter }: { label: string; metric: DomainMetric<T>; formatter: (value: T) => string }) {
  return <div className="min-h-16 min-w-0 p-3 sm:px-4"><p className="text-[10px] font-black uppercase tracking-[0.06em] text-[#667085]">{label}</p><div className="mt-1 text-xs font-black leading-[18px] text-[#0B1830]"><PublicMetricValue metric={metric}>{formatter}</PublicMetricValue></div></div>;
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="relative block"><span className="mb-1.5 block font-mono text-[10px] font-black uppercase tracking-[0.07em] text-[#667085]">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-12 w-full appearance-none rounded-[10px] border border-[#C3CEDB] bg-white px-3 pr-9 text-sm font-bold text-[#0B1830] shadow-[inset_0_1px_2px_rgba(11,24,48,0.04),0_1px_2px_rgba(11,24,48,0.04)] outline-none transition-[border-color,box-shadow] hover:border-[#9EACBD] focus:border-[#4A92F9] focus:ring-2 focus:ring-[#A7C7F5]" aria-label={label}>{options.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown className="pointer-events-none absolute bottom-3.5 right-3 h-4 w-4 text-[#667085]" aria-hidden="true" /></label>;
}

function MarketMetric<T>({ label, detail, metric, formatter, tone, featured = false, compact = false }: { label: string; detail: string; metric: DomainMetric<T>; formatter: (value: T) => string; tone: "quoted" | "verified" | "difference" | "slate"; featured?: boolean; compact?: boolean }) {
  const valueClass = tone === "quoted" ? "text-[#315F9F]" : tone === "verified" ? "text-[#087A55]" : "text-[#0B1830]";
  return <div className={cn(compact ? "px-5 py-4" : "p-5", featured && "flex h-full flex-col justify-center sm:p-6")}><p className="font-mono text-[10px] font-black uppercase tracking-[0.08em] text-[#667085]">{label}</p><div className={cn("mt-2 font-mono font-black tabular-nums tracking-tight", compact ? "text-xl" : featured ? "text-3xl" : "text-2xl", valueClass)}><PublicMetricValue metric={metric}>{formatter}</PublicMetricValue></div><p className="mt-2 text-xs font-semibold leading-5 text-[#667085]">{detail}</p></div>;
}

function BuyerPatternCard({ pattern, index }: { pattern: (typeof DECISION_LENSES)[number]; index: number }) {
  const icons = [ShieldCheck, LineChart, Users];
  const Icon = icons[index] ?? CheckCircle2;
  return <article className="grid gap-4 rounded-xl border border-[#D6E0EC] bg-white p-5 shadow-[0_6px_18px_rgba(11,24,48,0.05),inset_0_1px_0_rgba(255,255,255,0.90)] sm:grid-cols-[44px_1fr] sm:items-start"><span className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#A7C7F5] bg-[#F2F6FB] text-[#315F9F]"><Icon className="h-5 w-5" aria-hidden="true" /></span><div><h3 className="text-base font-black leading-5 text-[#0B1830]">{pattern.title}</h3><p className="mt-2 text-sm font-medium leading-6 text-[#667085]">{pattern.explanation}</p></div></article>;
}

function MethodStep({ number, icon, title, detail, tone }: { number: string; icon: ReactNode; title: string; detail: string; tone: "blue" | "emerald" | "violet" | "slate" }) {
  const toneClass = tone === "blue" ? "border-[#A7C7F5] bg-[#F4F8FF] text-[#315F9F]" : tone === "emerald" ? "border-[#A8DCC8] bg-[#F2FBF7] text-[#087A55]" : tone === "violet" ? "border-[#C9BDEB] bg-[#F8F5FF] text-[#6547A8]" : "border-[#C4CEDA] bg-[#F6F8FB] text-[#344054]";
  return <div className={cn("relative z-10 overflow-hidden rounded-xl border-2 p-4 shadow-[0_11px_22px_-14px_rgba(11,24,48,0.42),inset_0_1px_0_rgba(255,255,255,0.96)] before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-current", toneClass)}><div className="flex items-center justify-between gap-3"><span className="border border-current/30 bg-white/85 px-2 py-1 font-mono text-[11px] font-black tracking-[0.08em]">[{number}]</span><span className="flex h-10 w-10 items-center justify-center rounded-lg border border-current/30 bg-white/80 shadow-sm">{icon}</span></div><h3 className="mt-4 text-sm font-black text-[#0B1830]">{title}</h3><p className="mt-2 text-xs font-medium leading-5 text-[#667085]">{detail}</p></div>;
}
