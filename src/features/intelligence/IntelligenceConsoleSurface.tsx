import { useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Boxes,
  CalendarDays,
  ChevronRight,
  ClipboardCopy,
  DatabaseZap,
  FileCheck2,
  Filter,
  Gauge,
  HandCoins,
  LayoutDashboard,
  MapPin,
  Menu,
  PanelRightOpen,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { canRenderRegisteredMetric } from "@/types/domainMetric";
import { METRIC_DICTIONARY, type MetricId } from "@/types/metrics.dictionary";
import { SALES_BRIEF_FIXTURE } from "./fixtures";
import type { InsightId, IntelligenceViewState, InternalIntelligenceResponse } from "./types";
import {
  EvidenceStrip,
  InsightCard,
  ProgressDatum,
  SectionHeading,
  StatePanel,
  SyntheticPreviewBanner,
  UnverifiedMetricChip,
} from "./components/IntelligencePrimitives";
import { QuotedVsBoughtChart } from "./components/QuotedVsBoughtChart";

type ConsoleView = "pulse" | "compare" | "products" | "scope" | "contractors" | "outcomes";

type Props = {
  data: InternalIntelligenceResponse;
  state?: IntelligenceViewState;
};

const NAV_ITEMS: Array<{ id: ConsoleView; label: string; mobileLabel: string; icon: typeof Activity }> = [
  { id: "pulse", label: "Pulse", mobileLabel: "Pulse", icon: Activity },
  { id: "compare", label: "Quoted vs Bought", mobileLabel: "Compare", icon: BarChart3 },
  { id: "products", label: "Products & Price", mobileLabel: "Products", icon: Boxes },
  { id: "scope", label: "Scope & Terms", mobileLabel: "Scope", icon: FileCheck2 },
  { id: "contractors", label: "Contractors & Bids", mobileLabel: "Bids", icon: Users },
  { id: "outcomes", label: "Outcomes & Data Quality", mobileLabel: "Outcomes", icon: ShieldCheck },
];

const VIEW_INSIGHTS: Record<Exclude<ConsoleView, "pulse">, InsightId[]> = {
  compare: ["quoted_vs_accepted_price", "acceptance_by_price_position", "initial_to_accepted_delta", "accepted_to_final_delta", "price_per_opening", "multi_bid_spread"],
  products: ["price_per_opening", "size_adjusted_price", "product_tier_migration", "glass_package_premium", "market_movement"],
  scope: ["scope_completeness", "payment_structure", "warranty_specificity", "quote_clarity", "initial_to_accepted_delta"],
  contractors: ["multi_bid_spread", "contractor_discipline", "acceptance_by_price_position", "accepted_to_final_delta"],
  outcomes: ["accepted_to_final_delta", "market_movement", "quote_clarity", "contractor_discipline"],
};

const VIEW_COPY: Record<Exclude<ConsoleView, "pulse">, [string, string]> = {
  compare: ["Quoted vs Bought", "Keep offers, verified acceptances, and final outcomes separate while comparing how projects move."],
  products: ["Products & Price", "Explore future product, glass, opening, and size-normalized intelligence without claiming live readiness."],
  scope: ["Scope & Terms", "Understand how visible scope, payment, warranty, and clarity evidence could support better conversations."],
  contractors: ["Contractors & Bids", "Founder-only synthetic patterns for same-project bids and offer-to-final discipline."],
  outcomes: ["Outcomes & Data Quality", "See the maturity, verification, and operational controls required before an insight can become live."],
};

function insightMetricId(id: InsightId): MetricId {
  return `insight.${id}` as MetricId;
}

function canRenderInsight(module: InternalIntelligenceResponse["modules"][number]): boolean {
  return canRenderRegisteredMetric(insightMetricId(module.id), "OBSERVATORY", module.sampleSize);
}

function WithheldInsight({ module, compact = false }: { module: InternalIntelligenceResponse["modules"][number]; compact?: boolean }) {
  const metricId = insightMetricId(module.id);
  const status = METRIC_DICTIONARY[metricId].semanticStatus;
  return (
    <article className={cn("rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4", compact ? "min-h-48" : "min-h-56")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-500">{module.maturity} · contract withheld</p>
          <h3 className="mt-2 text-base font-black text-slate-900">{module.title}</h3>
        </div>
        <UnverifiedMetricChip metricId={metricId} />
      </div>
      <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">No metric value or interpretation is rendered while this definition is {status.toLowerCase()}.</p>
      <p className="mt-3 text-xs font-medium leading-5 text-slate-500">{module.notClaimed}</p>
    </article>
  );
}

function GovernedInsightCard({ module, compact = false }: { module: InternalIntelligenceResponse["modules"][number]; compact?: boolean }) {
  return canRenderInsight(module) ? <InsightCard module={module} compact={compact} /> : <WithheldInsight module={module} compact={compact} />;
}

export function IntelligenceConsoleSurface({ data, state = "SUCCESS" }: Props) {
  const [view, setView] = useState<ConsoleView>("pulse");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [salesBriefOpen, setSalesBriefOpen] = useState(false);
  const [appliedLabel, setAppliedLabel] = useState("Synthetic multi-region · 10–20 openings · Compare outcomes");

  const selectedModules = useMemo(() => {
    if (view === "pulse") return [];
    const ids = new Set(VIEW_INSIGHTS[view]);
    return data.modules.filter((module) => ids.has(module.id));
  }, [data.modules, view]);

  return (
    <div className="min-h-screen bg-[#F6F4EF] text-slate-950" data-testid="intelligence-console">
      <div className="lg:grid lg:min-h-screen lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden border-r border-slate-800 bg-[#07162E] text-white lg:flex lg:flex-col">
          <div className="border-b border-white/10 px-5 py-6">
            <div className="text-xl font-black tracking-tight">WindowMan</div>
            <div className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-blue-300">Intelligence</div>
          </div>
          <nav aria-label="Intelligence sections" className="flex-1 space-y-1 p-3">
            {NAV_ITEMS.map((item) => <NavButton key={item.id} item={item} active={view === item.id} onClick={() => setView(item.id)} />)}
          </nav>
          <div className="m-3 rounded-xl border border-blue-300/30 bg-blue-400/10 p-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.08em] text-blue-200"><DatabaseZap className="h-4 w-4" /> Synthetic preview</div>
            <p className="mt-2 text-xs font-medium leading-5 text-slate-300">No live customer, contractor, or market data is connected.</p>
          </div>
        </aside>

        <div className="min-w-0 pb-20 lg:pb-0">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
            <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6">
              <button type="button" onClick={() => setMobileFiltersOpen(true)} className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 bg-white shadow-sm lg:hidden" aria-label="Open filters"><Menu className="h-5 w-5" /></button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-black text-slate-950">{NAV_ITEMS.find((item) => item.id === view)?.label}</div>
                <div className="truncate text-xs font-semibold text-slate-500">{appliedLabel}</div>
              </div>
              <div className="hidden min-w-0 flex-1 items-center justify-end gap-2 xl:flex"><ConsoleFilters onApply={setAppliedLabel} /></div>
              <button type="button" onClick={() => setSalesBriefOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#356AC3] px-3 text-sm font-black text-white shadow-[0_4px_12px_rgba(53,106,195,0.24)] hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200">
                <PanelRightOpen className="h-4 w-4" /><span className="hidden sm:inline">Sales brief</span>
              </button>
            </div>
          </header>

          <main className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
            <SyntheticPreviewBanner />
            {state === "SUCCESS" ? (
              view === "pulse" ? <PulseView data={data} onOpenBrief={() => setSalesBriefOpen(true)} /> : <InsightView title={VIEW_COPY[view][0]} description={VIEW_COPY[view][1]} modules={selectedModules} showQuality={view === "outcomes"} />
            ) : <StatePanel state={state} audience="INTERNAL" />}
          </main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white px-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-6px_20px_rgba(15,23,42,0.08)] lg:hidden" aria-label="Mobile intelligence sections">
        {NAV_ITEMS.slice(0, 4).map((item) => <MobileNavButton key={item.id} item={item} active={view === item.id} onClick={() => setView(item.id)} />)}
        <MobileNavButton item={{ ...NAV_ITEMS[5], mobileLabel: "More" }} active={view === "contractors" || view === "outcomes"} onClick={() => setView(view === "outcomes" ? "contractors" : "outcomes")} />
      </nav>

      {mobileFiltersOpen ? <MobileFilterSheet onClose={() => setMobileFiltersOpen(false)} onApply={(value) => { setAppliedLabel(value); setMobileFiltersOpen(false); }} /> : null}
      {salesBriefOpen ? <SalesBriefDrawer onClose={() => setSalesBriefOpen(false)} /> : null}
    </div>
  );
}
function NavButton({ item, active, onClick }: { item: (typeof NAV_ITEMS)[number]; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return <button type="button" onClick={onClick} className={cn("flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300", active ? "bg-[#356AC3] text-white shadow-lg shadow-blue-950/20" : "text-slate-300 hover:bg-white/10 hover:text-white")}><Icon className="h-5 w-5 shrink-0" /><span>{item.label}</span></button>;
}

function MobileNavButton({ item, active, onClick }: { item: (typeof NAV_ITEMS)[number]; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return <button type="button" onClick={onClick} className={cn("flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-[10px] font-black", active ? "text-blue-700" : "text-slate-500")}><Icon className="h-5 w-5" /><span>{item.mobileLabel}</span></button>;
}

function ConsoleFilters({ onApply }: { onApply: (label: string) => void }) {
  const [geography, setGeography] = useState("Synthetic multi-region");
  const [outcome, setOutcome] = useState("Compare outcomes");
  return (
    <>
      <FilterSelect icon={<CalendarDays className="h-4 w-4" />} label="Date" value="Jan–Aug 2026" options={["Jan–Aug 2026", "Last 90 days", "Last 12 months"]} onChange={() => undefined} />
      <FilterSelect icon={<MapPin className="h-4 w-4" />} label="Geography" value={geography} options={["Synthetic multi-region", "Synthetic region", "Broad cohort"]} onChange={setGeography} />
      <FilterSelect icon={<Target className="h-4 w-4" />} label="Outcome" value={outcome} options={["Compare outcomes", "Quoted only", "Verified accepted"]} onChange={setOutcome} />
      <button type="button" onClick={() => onApply(`${geography} · 10–20 openings · ${outcome}`)} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-800 shadow-sm hover:bg-slate-50">Apply</button>
    </>
  );
}

function FilterSelect({ icon, label, value, options, onChange }: { icon: React.ReactNode; label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3"><span className="text-slate-500">{icon}</span><span className="sr-only">{label}</span><select className="max-w-[145px] bg-transparent text-xs font-bold text-slate-800 outline-none" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function PulseView({ data, onOpenBrief }: { data: InternalIntelligenceResponse; onOpenBrief: () => void }) {
  const module = (id: InsightId) => data.modules.find((candidate) => candidate.id === id)!;
  const comparisonModule = module("quoted_vs_accepted_price");
  return (
    <div className="space-y-6">
      <EvidenceStrip evidence={data.evidence} />
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_4px_rgba(15,23,42,0.06),0_22px_54px_rgba(15,23,42,0.08)]">
        <div className="grid xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="p-5 sm:p-7">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div><h1 className="text-3xl font-black tracking-[-0.04em] text-[#0B1830] sm:text-4xl">Quoted vs Bought</h1><p className="mt-1 text-sm font-semibold text-slate-600">What was offered. What was accepted. What was finally paid.</p></div>
              <span className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-800">M2–M3 preview</span>
            </div>
            <QuotedVsBoughtChart quoted={data.quoted} accepted={data.verifiedAccepted} final={data.verifiedFinal} />
          </div>
          <aside className="border-t border-slate-200 bg-slate-50/70 p-5 xl:border-l xl:border-t-0">
            <h2 className="text-sm font-black uppercase tracking-[0.08em] text-slate-500">Decision summary</h2>
            <div className="mt-4 space-y-3">
              {canRenderInsight(comparisonModule) ? comparisonModule.metrics.map((metric) => <div key={metric.label} className="border-b border-slate-200 pb-3"><div className="text-xs font-bold text-slate-500">{metric.label}</div><div className="mt-1 font-mono text-2xl font-black tabular-nums text-slate-950">{metric.value}</div><div className="text-xs font-semibold text-slate-500">{metric.detail}</div></div>) : <UnverifiedMetricChip metricId={insightMetricId(comparisonModule.id)} />}
              <div><div className="text-xs font-bold text-slate-500">Outcome coverage</div><div className="mt-1 font-mono text-2xl font-black text-emerald-700">{data.evidence.outcomeCoveragePct}%</div></div>
            </div>
            <button type="button" onClick={onOpenBrief} className="mt-5 flex min-h-11 w-full items-center justify-between rounded-lg border border-blue-300 bg-white px-4 text-sm font-black text-blue-800 shadow-sm hover:bg-blue-50">Open sales brief<ChevronRight className="h-4 w-4" /></button>
          </aside>
        </div>
      </section>

      <section aria-labelledby="decision-drivers-heading">
        <SectionHeading title="Decision drivers" description="Four future signals that turn longitudinal evidence into a useful sales and operating conversation." />
        <h2 id="decision-drivers-heading" className="sr-only">Decision drivers</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {["acceptance_by_price_position", "initial_to_accepted_delta", "accepted_to_final_delta", "multi_bid_spread"].map((id) => <GovernedInsightCard key={id} module={module(id as InsightId)} compact />)}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <InsightFeature title="Products & price" icon={<Boxes className="h-5 w-5" />} modules={[module("product_tier_migration"), module("glass_package_premium")]} />
        <InsightFeature title="Scope & terms" icon={<FileCheck2 className="h-5 w-5" />} modules={[module("scope_completeness"), module("quote_clarity")]} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <InsightFeature title="Contractors & bids" icon={<Scale className="h-5 w-5" />} modules={[module("multi_bid_spread"), module("contractor_discipline")]} />
        <DataQualityShelf />
      </section>
    </div>
  );
}

function InsightFeature({ title, icon, modules }: { title: string; icon: React.ReactNode; modules: ReturnType<InternalIntelligenceResponse["modules"]["slice"]> }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2 text-[#0B1830]">{icon}<h2 className="text-lg font-black">{title}</h2></div><div className="mt-4 grid gap-4 sm:grid-cols-2">{modules.map((module) => canRenderInsight(module) ? <div key={module.id} className="border-l-2 border-blue-200 pl-4"><div className="text-sm font-black text-slate-950">{module.title}</div><div className="mt-1 font-mono text-xl font-black text-slate-900">{module.metrics[0].value}</div><div className="mt-1 text-xs font-medium leading-5 text-slate-500">{module.interpretation}</div></div> : <div key={module.id} className="border-l-2 border-slate-300 pl-4"><div className="text-sm font-black text-slate-950">{module.title}</div><div className="mt-2"><UnverifiedMetricChip metricId={insightMetricId(module.id)} /></div><div className="mt-2 text-xs font-medium leading-5 text-slate-500">Metric and interpretation withheld pending a bound semantic contract.</div></div>)}</div></section>;
}

function InsightView({ title, description, modules, showQuality }: { title: string; description: string; modules: InternalIntelligenceResponse["modules"]; showQuality: boolean }) {
  return <div className="space-y-5"><SectionHeading title={title} description={description} action={<span className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-600">{modules.length} registered concepts</span>} />{showQuality ? <DataQualityShelf /> : null}<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{modules.map((module) => <GovernedInsightCard key={module.id} module={module} />)}</div></div>;
}

function DataQualityShelf() {
  return <section className="rounded-2xl border border-slate-800 bg-[#0B1830] p-5 text-white shadow-lg"><div className="flex items-center gap-2"><Gauge className="h-5 w-5 text-blue-300" /><h2 className="text-lg font-black">Outcomes & data quality</h2></div><p className="mt-2 text-sm font-medium leading-5 text-slate-300">Synthetic readiness indicators show what must mature before market claims can become live.</p><div className="mt-5 space-y-4"><ProgressDatum label="Closed extraction contract" value={32} /><ProgressDatum label="Outcome verification coverage" value={41} tone="orange" /><ProgressDatum label="Quote/revision linkage" value={18} tone="emerald" /><ProgressDatum label="Public cohort readiness" value={12} /></div><div className="mt-5 grid grid-cols-2 gap-2 text-center"><QualityDatum label="Suppressed cohorts" value="9" /><QualityDatum label="Live insights" value="0" /></div></section>;
}

function QualityDatum({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/15 bg-white/5 p-3"><div className="font-mono text-xl font-black">{value}</div><div className="mt-1 text-[11px] font-bold text-slate-400">{label}</div></div>;
}

function MobileFilterSheet({ onClose, onApply }: { onClose: () => void; onApply: (value: string) => void }) {
  return <div className="fixed inset-0 z-50 bg-slate-950/45 lg:hidden"><div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-5 shadow-2xl"><div className="flex items-center justify-between"><div><h2 className="text-xl font-black">Cohort filters</h2><p className="text-sm text-slate-500">Synthetic view controls</p></div><button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300" aria-label="Close filters"><X className="h-5 w-5" /></button></div><div className="mt-5 space-y-3"><FilterRow label="Date" value="Jan–Aug 2026" /><FilterRow label="Geography" value="Synthetic multi-region" /><FilterRow label="Outcome" value="Compare outcomes" /><FilterRow label="Product" value="All governed products" /><FilterRow label="Project size" value="10–20 openings" /></div><button type="button" onClick={() => onApply("Synthetic multi-region · 10–20 openings · Compare outcomes")} className="mt-6 min-h-12 w-full rounded-xl bg-[#356AC3] font-black text-white shadow-lg">Apply synthetic view</button></div></div>;
}

function FilterRow({ label, value }: { label: string; value: string }) {
  return <button type="button" className="flex min-h-12 w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 text-left"><span><span className="block text-[11px] font-black uppercase tracking-[0.08em] text-slate-500">{label}</span><span className="text-sm font-bold text-slate-900">{value}</span></span><SlidersHorizontal className="h-4 w-4 text-slate-400" /></button>;
}

function SalesBriefDrawer({ onClose }: { onClose: () => void }) {
  return <div className="fixed inset-0 z-50 bg-slate-950/45"><aside className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto bg-[#F8F7F3] p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><div className="text-xs font-black uppercase tracking-[0.1em] text-blue-700">Sales representative mode</div><h2 className="mt-1 text-2xl font-black text-[#0B1830]">Call brief</h2><p className="mt-1 text-sm font-medium text-slate-600">{SALES_BRIEF_FIXTURE.cohortLabel}</p></div><button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 bg-white" aria-label="Close sales brief"><X className="h-5 w-5" /></button></div><div className="mt-5"><SyntheticPreviewBanner compact /></div><BriefSection title="Three strongest facts" icon={<Target className="h-4 w-4" />} items={SALES_BRIEF_FIXTURE.strongestFacts} /><BriefSection title="Approved language" icon={<HandCoins className="h-4 w-4" />} items={SALES_BRIEF_FIXTURE.approvedLanguage} /><BriefSection title="Do not claim" icon={<ShieldCheck className="h-4 w-4" />} items={SALES_BRIEF_FIXTURE.doNotClaim} danger /><button type="button" onClick={() => navigator.clipboard?.writeText(SALES_BRIEF_FIXTURE.approvedLanguage.join("\n"))} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#356AC3] font-black text-white shadow-lg"><ClipboardCopy className="h-4 w-4" />Copy approved summary</button></aside></div>;
}

function BriefSection({ title, icon, items, danger = false }: { title: string; icon: React.ReactNode; items: string[]; danger?: boolean }) {
  return <section className={cn("mt-5 rounded-xl border bg-white p-4 shadow-sm", danger ? "border-orange-200" : "border-slate-200")}><div className="flex items-center gap-2 text-sm font-black text-slate-950">{icon}{title}</div><ul className="mt-3 space-y-2">{items.map((item) => <li key={item} className="flex gap-2 text-sm font-medium leading-5 text-slate-600"><ChevronRight className={cn("mt-0.5 h-4 w-4 shrink-0", danger ? "text-orange-600" : "text-blue-600")} />{item}</li>)}</ul></section>;
}
