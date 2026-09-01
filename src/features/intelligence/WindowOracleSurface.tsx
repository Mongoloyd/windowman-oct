import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  FileSearch,
  LineChart,
  LockKeyhole,
  MapPin,
  Menu,
  Scale,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateRange, formatMoneyCents } from "./format";
import type { IntelligenceViewState, PublicOracleResponse } from "./types";
import {
  ProgressDatum,
  PrincipleIcon,
  ProofPrinciple,
  SafeLinkLabel,
  SectionHeading,
  StatePanel,
  SyntheticPreviewBanner,
} from "./components/IntelligencePrimitives";
import { QuotedVsBoughtChart } from "./components/QuotedVsBoughtChart";

type Props = {
  data: PublicOracleResponse;
  state?: IntelligenceViewState;
  showProductHeader?: boolean;
};

/** @deprecated Unmounted legacy visual. Use PublicOracleSurface with PublicOracleViewModel. */
export function WindowOracleSurface({ data, state = "SUCCESS", showProductHeader = true }: Props) {
  const [filters, setFilters] = useState({ location: "Synthetic multi-region", size: "10–20 openings", product: "All product classes", period: "Jan–Aug 2026" });
  const [appliedFilters, setAppliedFilters] = useState(filters);

  const uploadHref = "/?scroll=upload";
  const quotedMedian = formatMoneyCents(data.quoted.medianCents);
  const acceptedMedian = formatMoneyCents(data.verifiedAccepted.medianCents);
  const syntheticDifference = formatMoneyCents(data.quoted.medianCents - data.verifiedAccepted.medianCents);
  const publicModules = useMemo(() => new Map(data.modules.map((module) => [module.id, module])), [data.modules]);

  if (state !== "SUCCESS") {
    return <div className="min-h-screen bg-[#F8F7F3] px-4 py-10"><SyntheticPreviewBanner /><div className="mt-8"><StatePanel state={state} audience="PUBLIC" /></div></div>;
  }

  return (
    <div className="min-h-screen bg-[#F8F7F3] text-[#0B1830]" data-testid="window-oracle">
      {showProductHeader ? (
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
          <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
            <Link to="/" className="text-xl font-black tracking-tight text-[#0B1830]">WindowMan <span className="text-sm font-bold text-blue-700">Oracle</span></Link>
            <nav className="hidden items-center gap-7 text-sm font-bold text-slate-600 lg:flex" aria-label="Window Oracle"><a href="#market-pulse" className="hover:text-blue-700">Market Pulse</a><a href="#buyer-choices" className="hover:text-blue-700">What Buyers Choose</a><a href="#methodology" className="hover:text-blue-700">Methodology</a></nav>
            <Link to={uploadHref} className="hidden min-h-11 items-center rounded-lg bg-[#356AC3] px-5 text-sm font-black text-white shadow-[0_5px_14px_rgba(53,106,195,0.24)] hover:bg-blue-700 sm:inline-flex">Check My Estimate</Link>
            <button type="button" className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 bg-white sm:hidden" aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
          </div>
        </header>
      ) : null}

      <main>
        <section className="relative overflow-hidden border-b border-slate-200 bg-white">
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-blue-50/60 to-transparent" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 sm:py-16 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:py-20">
            <div>
              <div className="mb-5 max-w-sm"><SyntheticPreviewBanner compact /></div>
              <h1 className="max-w-3xl text-4xl font-black leading-[0.98] tracking-[-0.05em] text-[#0B1830] sm:text-5xl lg:text-6xl">See what homeowners are quoted—and what buyers actually choose.</h1>
              <p className="mt-6 max-w-xl text-base font-medium leading-7 text-slate-600 sm:text-lg">Explore synthetic quote and verified-outcome concepts so you can see how the public Oracle will build trust before live market evidence is approved.</p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link to={uploadHref} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#356AC3] px-6 text-sm font-black text-white shadow-[0_6px_18px_rgba(53,106,195,0.28)] hover:bg-blue-700">Check My Estimate<ArrowRight className="h-4 w-4" /></Link>
                <a href="#market-pulse" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-blue-400 bg-white px-6 text-sm font-black text-blue-800 shadow-sm hover:bg-blue-50">Explore the Market</a>
              </div>
              <div className="mt-7 grid grid-cols-3 divide-x divide-slate-200 border-y border-slate-200 py-4 text-center sm:text-left">
                <HeroProof label="Sample" value={`n=${data.evidence.governedQuoteCount}`} />
                <HeroProof label="Outcomes known" value={`${data.evidence.outcomeCoveragePct}%`} />
                <HeroProof label="Cohort" value={data.evidence.broadened ? "Broadened" : "Exact"} />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_5px_rgba(15,23,42,0.08),0_28px_70px_rgba(15,23,42,0.12)] sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-lg font-black">Typical total project range</h2><p className="mt-1 text-xs font-semibold text-slate-500">{appliedFilters.location} · {appliedFilters.size}</p></div><span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-blue-800">Synthetic</span></div>
              <QuotedVsBoughtChart quoted={data.quoted} accepted={data.verifiedAccepted} compact />
            </div>
          </div>
        </section>

        <section className="border-b border-blue-100 bg-blue-50/70">
          <div className="mx-auto grid max-w-7xl divide-y divide-blue-100 px-4 sm:grid-cols-2 sm:divide-x sm:divide-y-0 sm:px-6 lg:grid-cols-4">
            <ProofPrinciple icon={<PrincipleIcon kind="evidence" />} title="Quote evidence, not surveys" detail="The future Oracle is grounded in governed quote observations." />
            <ProofPrinciple icon={<PrincipleIcon kind="separate" />} title="Quoted and accepted stay separate" detail="Offered prices never silently become verified outcomes." />
            <ProofPrinciple icon={<PrincipleIcon kind="sample" />} title="Sample size shown" detail="Every result carries evidence and outcome coverage." />
            <ProofPrinciple icon={<PrincipleIcon kind="withheld" />} title="Thin data withheld" detail="If a cohort is too thin to trust, it is not shown." />
          </div>
        </section>

        <section id="market-pulse" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
          <SectionHeading title="Market Pulse" description="Compare separately labeled synthetic quoted and verified-accepted populations. Filters never create a result when evidence is insufficient." />
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
              <OracleFilter label="Location" value={filters.location} options={["Synthetic multi-region", "Synthetic region", "Broad synthetic cohort"]} onChange={(value) => setFilters((current) => ({ ...current, location: value }))} />
              <OracleFilter label="Project size" value={filters.size} options={["10–20 openings", "1–9 openings", "21+ openings"]} onChange={(value) => setFilters((current) => ({ ...current, size: value }))} />
              <OracleFilter label="Product class" value={filters.product} options={["All product classes", "Entry tier", "Mid tier", "Premium"]} onChange={(value) => setFilters((current) => ({ ...current, product: value }))} />
              <OracleFilter label="Time period" value={filters.period} options={["Jan–Aug 2026", "Last 90 days", "Last 12 months"]} onChange={(value) => setFilters((current) => ({ ...current, period: value }))} />
              <button type="button" onClick={() => setAppliedFilters(filters)} className="min-h-12 rounded-lg bg-[#356AC3] px-5 text-sm font-black text-white shadow-md hover:bg-blue-700">Update view</button>
            </div>
            <div className="grid divide-y divide-slate-200 md:grid-cols-4 md:divide-x md:divide-y-0">
              <MarketMetric label="Quoted median" value={quotedMedian} tone="blue" detail="What homeowners are offered" />
              <MarketMetric label="Verified accepted median" value={acceptedMedian} tone="orange" detail="What buyers verify they chose" />
              <MarketMetric label="Synthetic difference" value={syntheticDifference} tone="emerald" detail="Descriptive, not causal" />
              <MarketMetric label="Evidence coverage" value={`${data.evidence.outcomeCoveragePct}%`} tone="slate" detail={`${data.evidence.verifiedAcceptedCount} verified accepted`} />
            </div>
            <div className="flex items-start gap-2 border-t border-slate-200 bg-blue-50 px-4 py-3 text-xs font-semibold leading-5 text-blue-900"><Users className="mt-0.5 h-4 w-4 shrink-0" />Broadened cohort is on. A production Oracle would name every fallback and withhold small cells.</div>
          </div>
        </section>

        <section id="buyer-choices" className="border-y border-slate-200 bg-white py-14 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionHeading title="What buyers choose" description="Three synthetic stories demonstrate how the Oracle can explain product and scope movement without exposing a homeowner or contractor." action={<a href="#methodology"><SafeLinkLabel>How outcomes are verified</SafeLinkLabel></a>} />
            <div className="mt-7 grid gap-4 lg:grid-cols-3">
              {data.buyerChoices.map((story, index) => <BuyerChoiceCard key={story.title} story={story} index={index} />)}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-orange-200 bg-orange-50 text-orange-700"><TrendingDown className="h-6 w-6" /></div>
            <h2 className="mt-5 text-3xl font-black tracking-[-0.035em] text-[#0B1830]">What changes before and after signing?</h2>
            <p className="mt-3 max-w-xl text-base font-medium leading-7 text-slate-600">The future longitudinal layer distinguishes the initial estimate, exact accepted revision, and final verified amount. It never treats one uploaded estimate as the whole project history.</p>
            <div className="mt-6 space-y-4"><ProgressDatum label="Accepted below initial quote" value={46} tone="orange" /><ProgressDatum label="Accepted within ±5%" value={32} /><ProgressDatum label="Accepted above initial quote" value={22} tone="emerald" /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <EditorialMetric icon={<FileSearch className="h-5 w-5" />} title="Initial → accepted" value="−6.8%" detail="Synthetic median revision" />
            <EditorialMetric icon={<CircleDollarSign className="h-5 w-5" />} title="Accepted → final" value="+3.9%" detail="Synthetic verified variance" />
            <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-sm font-black">What this means</h3><p className="mt-2 text-sm font-medium leading-6 text-slate-600">A future homeowner can see that signing is not the end of the evidence trail. WindowMan can separately explain revisions and final-cost movement without calling every increase a surprise.</p></div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-[#0B1830] py-14 text-white sm:py-20">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div><Scale className="h-9 w-9 text-orange-300" /><h2 className="mt-4 text-3xl font-black tracking-[-0.035em]">Does the lowest quote usually win?</h2><p className="mt-3 text-base font-medium leading-7 text-slate-300">Not always in this synthetic preview. A production answer requires multiple quotes linked to the same project and a verified selected revision.</p><div className="mt-6 rounded-xl border border-blue-300/30 bg-blue-400/10 p-4 text-sm font-bold text-blue-100">Best value may win more often than lowest price—but WindowMan will not publish that claim until the evidence supports it.</div></div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-5 shadow-2xl"><div className="grid gap-5 sm:grid-cols-3"><DarkMetric value="29%" label="Lowest price selected" tone="blue" /><DarkMetric value="51%" label="Middle price selected" tone="orange" /><DarkMetric value="20%" label="Highest price selected" tone="slate" /></div><div className="mt-6 space-y-4"><ProgressDatum label="Visible scope completeness" value={74} tone="emerald" /><ProgressDatum label="Product fit" value={61} /><ProgressDatum label="Warranty specificity" value={48} tone="orange" /></div><p className="mt-5 border-t border-white/10 pt-4 text-xs font-medium text-slate-400">Synthetic descriptive relationships only. No reason is attributed to an individual buyer.</p></div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-slate-50 shadow-sm">
            <div className="grid lg:grid-cols-[0.85fr_1.15fr]">
              <div className="p-6 sm:p-8"><MapPin className="h-7 w-7 text-blue-700" /><h2 className="mt-4 text-3xl font-black tracking-[-0.035em]">Local Pulse</h2><p className="mt-3 text-sm font-medium leading-6 text-slate-600">This preview broadens beyond an exact local match rather than inventing a neighborhood statistic.</p><div className="mt-5 inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-black text-blue-800"><Users className="h-4 w-4" />Broadened cohort is on</div></div>
              <div className="grid grid-cols-2 border-t border-blue-100 bg-white/70 lg:border-l lg:border-t-0"><LocalDatum label="Synthetic projects" value="200" /><LocalDatum label="Outcome coverage" value="41%" /><LocalDatum label="Verified accepted" value="68" /><LocalDatum label="Date range" value="Jan–Aug 2026" /></div>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white py-14 text-center sm:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6"><h2 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl">Market averages are useful.<br />Your actual estimate is better.</h2><p className="mx-auto mt-4 max-w-xl text-base font-medium leading-7 text-slate-600">Upload the quote you already have. WindowMan will read its visible evidence and build your existing protected Truth Report.</p><Link to={uploadHref} className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#356AC3] px-7 text-sm font-black text-white shadow-lg hover:bg-blue-700">Check My Estimate<ArrowRight className="h-4 w-4" /></Link></div>
        </section>

        <section id="methodology" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
          <SectionHeading title="How Window Oracle works" description="Transparent methodology, observable evidence, and explicit withholding when the data cannot support a claim." />
          <div className="mt-7 grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
            <MethodStep number="01" icon={<FileSearch className="h-5 w-5" />} title="Observe quotes" detail="Eligible estimates remain quoted-market observations." />
            <MethodStep number="02" icon={<ShieldCheck className="h-5 w-5" />} title="Verify outcomes" detail="Accepted, installed, final, and paid states stay distinct." />
            <MethodStep number="03" icon={<BarChart3 className="h-5 w-5" />} title="Separate and calculate" detail="Deterministic TypeScript calculates approved aggregates." />
            <MethodStep number="04" icon={<LockKeyhole className="h-5 w-5" />} title="Apply safeguards" detail="Small cells, thin evidence, and unsafe detail are withheld." />
          </div>
        </section>
      </main>

      <div className="fixed inset-x-3 bottom-3 z-40 rounded-xl border border-blue-400 bg-[#356AC3] p-2 shadow-2xl sm:hidden"><Link to={uploadHref} className="flex min-h-12 items-center justify-between px-3 text-white"><span><span className="block text-sm font-black">Check My Estimate</span><span className="text-xs font-medium text-blue-100">See what your quote actually says.</span></span><ArrowRight className="h-5 w-5" /></Link></div>
    </div>
  );
}

function HeroProof({ label, value }: { label: string; value: string }) { return <div className="px-2 first:pl-0"><div className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-500">{label}</div><div className="mt-1 truncate text-xs font-black text-slate-900 sm:text-sm">{value}</div></div>; }

function OracleFilter({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) { return <label className="rounded-lg border border-slate-200 bg-white px-3 py-2"><span className="block text-[10px] font-black uppercase tracking-[0.08em] text-slate-500">{label}</span><span className="mt-1 flex items-center justify-between gap-2"><select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-7 min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-900 outline-none">{options.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown className="h-4 w-4 text-slate-400" /></span></label>; }

function MarketMetric({ label, value, tone, detail }: { label: string; value: string; tone: "blue" | "orange" | "emerald" | "slate"; detail: string }) { const color = tone === "blue" ? "text-blue-700" : tone === "orange" ? "text-[#B65E2A]" : tone === "emerald" ? "text-emerald-700" : "text-slate-900"; return <div className="p-5"><div className="text-xs font-black text-slate-500">{label}</div><div className={cn("mt-2 font-mono text-2xl font-black tabular-nums", color)}>{value}</div><div className="mt-1 text-xs font-semibold text-slate-500">{detail}</div></div>; }

function BuyerChoiceCard({ story, index }: { story: PublicOracleResponse["buyerChoices"][number]; index: number }) { const icons = [<ShieldCheck key="shield" className="h-6 w-6" />, <LineChart key="chart" className="h-6 w-6" />, <Sparkles key="spark" className="h-6 w-6" />]; return <article className="rounded-2xl border border-slate-200 bg-[#FAFAF8] p-5 shadow-sm"><div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700">{icons[index]}</div><h3 className="mt-5 text-lg font-black">{story.title}</h3><p className="mt-1 text-xs font-bold uppercase tracking-[0.06em] text-slate-500">{story.projectLabel}</p><div className="mt-5 grid grid-cols-2 gap-3"><div><div className="text-[10px] font-black uppercase text-blue-700">Quoted range</div><div className="mt-1 font-mono text-sm font-black">{formatMoneyCents(story.quotedRangeCents[0])}–{formatMoneyCents(story.quotedRangeCents[1])}</div></div><div><div className="text-[10px] font-black uppercase text-orange-700">Accepted</div><div className="mt-1 font-mono text-sm font-black">{formatMoneyCents(story.acceptedCents)}</div></div></div><p className="mt-5 border-t border-slate-200 pt-4 text-sm font-medium leading-6 text-slate-600">{story.explanation}</p></article>; }

function EditorialMetric({ icon, title, value, detail }: { icon: React.ReactNode; title: string; value: string; detail: string }) { return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2 text-blue-700">{icon}<span className="text-sm font-black text-slate-800">{title}</span></div><div className="mt-5 font-mono text-3xl font-black text-[#0B1830]">{value}</div><div className="mt-1 text-xs font-semibold text-slate-500">{detail}</div></div>; }

function DarkMetric({ value, label, tone }: { value: string; label: string; tone: "blue" | "orange" | "slate" }) { const cls = tone === "blue" ? "text-blue-300" : tone === "orange" ? "text-orange-300" : "text-slate-300"; return <div className="text-center"><div className={cn("font-mono text-3xl font-black", cls)}>{value}</div><div className="mt-1 text-xs font-bold text-slate-300">{label}</div></div>; }

function LocalDatum({ label, value }: { label: string; value: string }) { return <div className="flex min-h-28 flex-col justify-center border-b border-r border-blue-100 p-5"><div className="text-[11px] font-black uppercase tracking-[0.08em] text-slate-500">{label}</div><div className="mt-2 font-mono text-xl font-black text-slate-950">{value}</div></div>; }

function MethodStep({ number, icon, title, detail }: { number: string; icon: React.ReactNode; title: string; detail: string }) { return <div className="bg-white p-5"><div className="flex items-center justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700">{icon}</div><span className="font-mono text-xs font-black text-slate-400">{number}</span></div><h3 className="mt-5 text-base font-black">{title}</h3><p className="mt-2 text-sm font-medium leading-6 text-slate-600">{detail}</p></div>; }
