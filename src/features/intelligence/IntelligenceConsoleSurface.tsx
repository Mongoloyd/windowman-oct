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
  Gauge,
  HandCoins,
  LockKeyhole,
  MapPin,
  Menu,
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
import { formatDateRange } from "./format";
import type { InsightId, IntelligenceViewState, InternalIntelligenceResponse } from "./types";
import {
  InsightCard,
  SectionHeading,
  StatePanel,
  SyntheticPreviewBanner,
  UnverifiedMetricChip,
} from "./components/IntelligencePrimitives";
import { ORACLE_VISUAL_TOKENS } from "./components/OracleVisualSystem";
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
    <article className={cn("relative overflow-hidden rounded-xl border border-dashed border-[#AFC4DD] bg-[#F4F7FB] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)] before:pointer-events-none before:absolute before:inset-0 before:bg-[repeating-linear-gradient(135deg,transparent_0,transparent_10px,rgba(49,95,159,0.035)_10px,rgba(49,95,159,0.035)_12px)]", compact ? "min-h-40" : "min-h-52")}>
      <LockKeyhole className="pointer-events-none absolute bottom-3 right-3 h-12 w-12 text-[#315F9F]/10" aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.08em] text-[#667085]">[{module.maturity} · contract withheld]</p>
          <h3 className="mt-2 text-base font-black text-[#0B1830]">{module.title}</h3>
        </div>
        <UnverifiedMetricChip metricId={metricId} />
      </div>
      <p className="relative mt-4 text-sm font-semibold leading-6 text-[#475467]">No metric value or interpretation is rendered while this definition is {status.toLowerCase()}.</p>
      <p className="relative mt-3 text-xs font-medium leading-5 text-[#667085]">{module.notClaimed}</p>
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
    <div className="min-h-screen bg-[#EEF3F8] text-[#0B1830]" data-testid="intelligence-console">
      <div className="lg:grid lg:min-h-screen lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="hidden border-r border-[#173052] bg-[#07162E] text-white shadow-[8px_0_28px_rgba(7,22,46,0.14)] lg:flex lg:flex-col">
          <div className="border-b border-white/10 px-5 py-6">
            <div className="text-xl font-black tracking-tight">WindowMan</div>
            <div className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-blue-300">Intelligence</div>
          </div>
          <nav aria-label="Intelligence sections" className="flex-1 space-y-1 p-3">
            {NAV_ITEMS.map((item) => <NavButton key={item.id} item={item} active={view === item.id} onClick={() => setView(item.id)} />)}
          </nav>
          <div className="m-3 rounded-xl border border-[#4A92F9]/35 bg-[#4A92F9]/10 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.08em] text-[#A7C7F5]"><DatabaseZap className="h-4 w-4" /> Synthetic preview</div>
            <p className="mt-2 text-xs font-medium leading-5 text-slate-300">No live customer, contractor, or market data is connected.</p>
          </div>
        </aside>

        <div className="min-w-0 pb-20 lg:pb-0">
          <header className="sticky top-0 z-30 border-b border-[#C3CEDB] bg-[#F8FAFC]/95 shadow-[0_5px_18px_rgba(11,24,48,0.08)] backdrop-blur">
            <div className="flex min-h-[72px] items-center gap-3 px-4 sm:px-6">
              <button type="button" onClick={() => setMobileFiltersOpen(true)} className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#AFC4DD] bg-white text-[#315F9F] shadow-[0_3px_8px_rgba(11,24,48,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A92F9] lg:hidden" aria-label="Open filters"><Menu className="h-5 w-5" /></button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-black text-slate-950">{NAV_ITEMS.find((item) => item.id === view)?.label}</div>
                <div className="mt-0.5 truncate font-mono text-[10px] font-bold uppercase tracking-[0.05em] text-[#667085]">{appliedLabel}</div>
              </div>
              <div className="hidden min-w-0 flex-1 items-center justify-end gap-2 xl:flex"><ConsoleFilters onApply={setAppliedLabel} /></div>
              <div className="hidden min-h-9 items-center gap-2 rounded-lg border border-[#A7C7F5] bg-[#EDF5FF] px-3 font-mono text-[10px] font-black uppercase tracking-[0.07em] text-[#315F9F] sm:flex"><DatabaseZap className="h-3.5 w-3.5" /> Synthetic · guarded</div>
            </div>
          </header>

          <main className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
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
  return <button type="button" onClick={onClick} className={cn("relative flex min-h-12 w-full items-center gap-3 rounded-lg border px-3 text-left text-sm font-bold transition-[background-color,border-color,box-shadow,color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A92F9]", active ? "border-[#4A92F9]/45 bg-[#163968] text-white shadow-[inset_3px_0_0_#4A92F9,0_7px_16px_rgba(0,0,0,0.18)]" : "border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.07] hover:text-white")}><Icon className="h-5 w-5 shrink-0" /><span>{item.label}</span></button>;
}

function MobileNavButton({ item, active, onClick }: { item: (typeof NAV_ITEMS)[number]; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return <button type="button" onClick={onClick} className={cn("flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-[10px] font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A92F9]", active ? "bg-[#EDF5FF] text-[#315F9F] shadow-[inset_0_2px_0_#4A92F9]" : "text-slate-500")}><Icon className="h-5 w-5" /><span>{item.mobileLabel}</span></button>;
}

function ConsoleFilters({ onApply }: { onApply: (label: string) => void }) {
  const [geography, setGeography] = useState("Synthetic multi-region");
  const [outcome, setOutcome] = useState("Compare outcomes");
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[#D6E0EC] bg-[#EEF3F8] p-1.5 shadow-[inset_0_1px_3px_rgba(11,24,48,0.06)]">
      <FilterSelect icon={<CalendarDays className="h-4 w-4" />} label="Date" value="Jan–Aug 2026" options={["Jan–Aug 2026", "Last 90 days", "Last 12 months"]} onChange={() => undefined} />
      <FilterSelect icon={<MapPin className="h-4 w-4" />} label="Geography" value={geography} options={["Synthetic multi-region", "Synthetic region", "Broad cohort"]} onChange={setGeography} />
      <FilterSelect icon={<Target className="h-4 w-4" />} label="Outcome" value={outcome} options={["Compare outcomes", "Quoted only", "Verified accepted"]} onChange={setOutcome} />
      <button type="button" onClick={() => onApply(`${geography} · 10–20 openings · ${outcome}`)} className="min-h-11 rounded-lg border border-[#071A3A] bg-[#071A3A] px-3 text-xs font-black text-white shadow-[0_4px_10px_rgba(7,26,58,0.16)] transition-[background-color,transform] hover:bg-[#102A52] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A92F9]">Apply</button>
    </div>
  );
}

function FilterSelect({ icon, label, value, options, onChange }: { icon: React.ReactNode; label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="flex min-h-11 items-center gap-2 rounded-lg border border-[#C3CEDB] bg-white px-3 shadow-[inset_0_1px_1px_rgba(11,24,48,0.03)]"><span className="text-[#667085]">{icon}</span><span className="sr-only">{label}</span><select className="min-h-11 max-w-[145px] bg-transparent text-xs font-bold text-[#0B1830] outline-none focus-visible:ring-0" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function PulseView({ data, onOpenBrief }: { data: InternalIntelligenceResponse; onOpenBrief: () => void }) {
  const module = (id: InsightId) => data.modules.find((candidate) => candidate.id === id)!;
  const comparisonModule = module("quoted_vs_accepted_price");
  const decisionDrivers = ["acceptance_by_price_position", "initial_to_accepted_delta", "accepted_to_final_delta", "multi_bid_spread"].map((id) => module(id as InsightId));
  const activeDrivers = decisionDrivers.filter(canRenderInsight);
  const withheldDrivers = decisionDrivers.filter((candidate) => !canRenderInsight(candidate));
  return (
    <div className="space-y-6">
      <ObservatoryEvidenceLedger data={data} />
      <section className={cn("overflow-hidden border-[#C3CEDB]", ORACLE_VISUAL_TOKENS.panel)}>
        <div className="grid xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="p-5 sm:p-7">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div><h1 className="text-3xl font-black tracking-[-0.04em] text-[#0B1830] sm:text-4xl">Quoted vs Bought</h1><p className="mt-1 text-sm font-semibold text-slate-600">What was offered. What was accepted. What was finally paid.</p></div>
              <AuditStamp maturity="M2–M3" sample={data.evidence.governedQuoteCount} />
            </div>
            <QuotedVsBoughtChart quoted={data.quoted} accepted={data.verifiedAccepted} final={data.verifiedFinal} variant="observatory-stage-2" />
          </div>
          <aside className="border-t border-[#C3CEDB] bg-[#F4F7FB] p-5 shadow-[inset_8px_0_18px_-16px_rgba(11,24,48,0.40)] xl:border-l xl:border-t-0">
            <h2 className="font-mono text-[11px] font-black uppercase tracking-[0.09em] text-[#667085]">Decision summary</h2>
            <div className="mt-4 space-y-3">
              {canRenderInsight(comparisonModule) ? comparisonModule.metrics.map((metric) => <div key={metric.label} className="rounded-xl border border-[#D6E0EC] bg-white p-3 shadow-[inset_0_1px_2px_rgba(11,24,48,0.04)]"><div className="text-xs font-bold text-[#667085]">{metric.label}</div><div className="mt-1 font-mono text-2xl font-black tabular-nums text-[#0B1830]">{metric.value}</div><div className="text-xs font-semibold text-[#667085]">{metric.detail}</div></div>) : <UnverifiedMetricChip metricId={insightMetricId(comparisonModule.id)} />}
              <div className="rounded-xl border border-[#AED8C9] bg-[#F1F8F5] p-3 shadow-[inset_0_1px_2px_rgba(8,122,85,0.05)]"><div className="text-xs font-bold text-[#4B655C]">Outcome coverage</div><div className="mt-1 font-mono text-2xl font-black tabular-nums text-[#087A55]">{data.evidence.outcomeCoveragePct}%</div></div>
            </div>
            <button type="button" aria-label="Sales brief" onClick={onOpenBrief} className="mt-5 flex min-h-11 w-full items-center justify-between rounded-lg border border-[#315F9F] bg-white px-4 text-sm font-black text-[#315F9F] shadow-[0_3px_8px_rgba(11,24,48,0.08)] transition-[background-color,transform] hover:bg-[#EDF5FF] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A92F9]">Open sales brief<ChevronRight className="h-4 w-4" /></button>
          </aside>
        </div>
      </section>

      <section aria-labelledby="decision-drivers-heading">
        <SectionHeading title="Decision drivers" description="Four future signals that turn longitudinal evidence into a useful sales and operating conversation." />
        <h2 id="decision-drivers-heading" className="sr-only">Decision drivers</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">{activeDrivers.map((driver) => <GovernedInsightCard key={driver.id} module={driver} compact />)}</div>
        {withheldDrivers.length ? <WithheldPipeline modules={withheldDrivers} label="Governed decision pipelines" /> : null}
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

function ObservatoryEvidenceLedger({ data }: { data: InternalIntelligenceResponse }) {
  const items = [
    ["Governed estimates", data.evidence.governedQuoteCount.toLocaleString("en-US")],
    ["Verified accepted", data.evidence.verifiedAcceptedCount.toLocaleString("en-US")],
    ["Verified final", data.evidence.verifiedFinalCount.toLocaleString("en-US")],
    ["Outcome coverage", `${data.evidence.outcomeCoveragePct}%`],
  ];
  return (
    <section aria-label="Evidence and provenance" className="overflow-hidden rounded-2xl border border-[#294363] bg-[#0B1D36] text-white shadow-[0_14px_32px_-6px_rgba(7,22,46,0.35),0_3px_8px_rgba(7,22,46,0.18),inset_0_1px_0_rgba(255,255,255,0.10)]">
      <div className="grid grid-cols-2 lg:grid-cols-[1.45fr_repeat(4,0.72fr)]">
        <div className="col-span-2 flex items-start gap-3 border-b border-white/10 p-4 sm:p-5 lg:col-span-1 lg:border-b-0 lg:border-r">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#4A92F9]/40 bg-[#4A92F9]/10 text-[#A7C7F5]"><ShieldCheck className="h-5 w-5" aria-hidden="true" /></span>
          <div>
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#A7C7F5]">Evidence ledger</p>
            <h2 className="mt-1 text-sm font-black">Evidence &amp; provenance</h2>
            <p className="mt-1 text-xs font-medium leading-5 text-slate-300">{data.evidence.cohortLabel} · {formatDateRange(data.evidence.dateFrom, data.evidence.dateTo)}</p>
            <p className="text-xs font-semibold text-[#A7C7F5]">{data.evidence.geographyLabel}</p>
          </div>
        </div>
        {items.map(([label, value]) => (
          <div key={label} className="border-b border-r border-white/10 px-4 py-3 odd:border-r-0 last:border-b-0 sm:px-5 lg:flex lg:flex-col lg:justify-center lg:border-b-0 lg:border-r lg:last:border-r-0">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-slate-300">{label}</div>
            <div className="mt-1 font-mono text-xl font-black tabular-nums text-white">{value}</div>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 bg-white/[0.035] px-4 py-2.5 text-[11px] font-semibold leading-5 text-slate-300 sm:px-5">Synthetic preview only · no live customer, contractor, or market data.</div>
    </section>
  );
}

function AuditStamp({ maturity, sample }: { maturity: string; sample: number }) {
  return <span className="inline-flex min-h-8 items-center rounded-md border border-[#AFC4DD] bg-[#F4F7FB] px-2.5 font-mono text-[10px] font-black uppercase tracking-[0.07em] text-[#315F9F]">[{maturity} · n={sample} · synthetic]</span>;
}

function WithheldPipeline({ modules, label }: { modules: InternalIntelligenceResponse["modules"]; label: string }) {
  return (
    <details className="mt-4 overflow-hidden rounded-xl border border-[#AFC4DD] bg-[#F4F7FB] shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-black text-[#315F9F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#4A92F9]">
        <span className="flex items-center gap-2"><LockKeyhole className="h-4 w-4" aria-hidden="true" />{label}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.07em] text-[#667085]">{modules.length} withheld</span>
      </summary>
      <div className="grid gap-3 border-t border-[#D6E0EC] p-3 md:grid-cols-2">{modules.map((module) => <WithheldInsight key={module.id} module={module} compact />)}</div>
    </details>
  );
}

function InsightFeature({ title, icon, modules }: { title: string; icon: React.ReactNode; modules: ReturnType<InternalIntelligenceResponse["modules"]["slice"]> }) {
  return <section className="rounded-2xl border border-[#C3CEDB] bg-white p-5 shadow-[0_10px_26px_-6px_rgba(11,24,48,0.12),0_2px_6px_rgba(11,24,48,0.05),inset_0_1px_0_rgba(255,255,255,0.94)]"><div className="flex items-center gap-2 text-[#0B1830]"><span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#A7C7F5] bg-[#EDF5FF] text-[#315F9F]">{icon}</span><h2 className="text-lg font-black">{title}</h2></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{modules.map((module) => canRenderInsight(module) ? <div key={module.id} className="rounded-xl border border-[#D6E0EC] bg-[#F8FAFC] p-4 shadow-[inset_0_1px_2px_rgba(11,24,48,0.04)]"><div className="text-sm font-black text-[#0B1830]">{module.title}</div><div className="mt-2 font-mono text-xl font-black tabular-nums text-[#0B1830]">{module.metrics[0].value}</div><div className="mt-1 text-xs font-medium leading-5 text-[#667085]">{module.interpretation}</div></div> : <div key={module.id} className="relative overflow-hidden rounded-xl border border-dashed border-[#AFC4DD] bg-[#F4F7FB] p-4 before:pointer-events-none before:absolute before:inset-0 before:bg-[repeating-linear-gradient(135deg,transparent_0,transparent_10px,rgba(49,95,159,0.035)_10px,rgba(49,95,159,0.035)_12px)]"><div className="relative text-sm font-black text-[#0B1830]">{module.title}</div><div className="relative mt-2"><UnverifiedMetricChip metricId={insightMetricId(module.id)} /></div><div className="relative mt-2 text-xs font-medium leading-5 text-[#667085]">Metric and interpretation withheld pending a bound semantic contract.</div></div>)}</div></section>;
}

function InsightView({ title, description, modules, showQuality }: { title: string; description: string; modules: InternalIntelligenceResponse["modules"]; showQuality: boolean }) {
  const activeModules = modules.filter(canRenderInsight);
  const withheldModules = modules.filter((module) => !canRenderInsight(module));
  return <div className="space-y-5"><div><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-black tracking-[-0.035em] text-[#0B1830]">{title}</h1><span className="rounded-md border border-[#AFC4DD] bg-white px-2.5 py-1 font-mono text-[10px] font-black uppercase tracking-[0.07em] text-[#667085]">[{modules.length} registered concepts]</span></div><p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#667085]">{description}</p></div>{showQuality ? <DataQualityShelf /> : null}{activeModules.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{activeModules.map((module) => <GovernedInsightCard key={module.id} module={module} />)}</div> : null}{withheldModules.length ? <WithheldPipeline modules={withheldModules} label="Governed / in-development pipelines" /> : null}</div>;
}

function DataQualityShelf() {
  const stages = [
    ["01", "Closed extraction contract", 32],
    ["02", "Outcome verification coverage", 41],
    ["03", "Quote/revision linkage", 18],
    ["04", "Public cohort readiness", 12],
  ] as const;
  return <section className="rounded-2xl border border-[#294363] bg-[#0B1D36] p-5 text-white shadow-[0_14px_32px_-6px_rgba(7,22,46,0.34),0_3px_8px_rgba(7,22,46,0.18),inset_0_1px_0_rgba(255,255,255,0.10)]"><div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#4A92F9]/40 bg-[#4A92F9]/10"><Gauge className="h-5 w-5 text-[#A7C7F5]" /></span><h2 className="text-lg font-black">Outcomes &amp; data quality</h2></div><p className="mt-2 text-sm font-medium leading-6 text-slate-300">Synthetic readiness indicators show what must mature before market claims can become live.</p><div className="relative mt-5 grid gap-3 lg:grid-cols-4"><div className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-6 hidden h-px bg-[#4A92F9]/35 lg:block" aria-hidden="true" />{stages.map(([number,label,value])=><div key={label} className="relative rounded-xl border border-white/15 bg-white/[0.055] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"><div className="flex items-center justify-between gap-3"><span className="font-mono text-[10px] font-black tracking-[0.08em] text-[#A7C7F5]">[{number}]</span><span className="font-mono text-xl font-black tabular-nums text-white">{value}%</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15" aria-hidden="true"><div className="h-full rounded-full bg-[#4A92F9]" style={{width:`${value}%`}} /></div><p className="mt-3 text-xs font-bold leading-5 text-slate-200">{label}</p></div>)}</div><div className="mt-4 grid grid-cols-2 gap-3 text-center"><QualityDatum label="Suppressed cohorts" value="9" /><QualityDatum label="Live insights" value="0" /></div></section>;
}

function QualityDatum({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/15 bg-[#07162E] p-3 shadow-[inset_0_1px_2px_rgba(0,0,0,0.22)]"><div className="font-mono text-xl font-black tabular-nums text-white">{value}</div><div className="mt-1 text-[11px] font-bold text-slate-300">{label}</div></div>;
}

function MobileFilterSheet({ onClose, onApply }: { onClose: () => void; onApply: (value: string) => void }) {
  return <div className="fixed inset-0 z-50 bg-slate-950/50 lg:hidden"><div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-[#C3CEDB] bg-[#F8FAFC] p-5 shadow-[0_-18px_48px_rgba(7,22,46,0.24)]"><div className="flex items-center justify-between"><div><h2 className="text-xl font-black">Cohort filters</h2><p className="text-sm text-[#667085]">Synthetic view controls</p></div><button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#AFC4DD] bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A92F9]" aria-label="Close filters"><X className="h-5 w-5" /></button></div><div className="mt-5 space-y-3"><FilterRow label="Date" value="Jan–Aug 2026" /><FilterRow label="Geography" value="Synthetic multi-region" /><FilterRow label="Outcome" value="Compare outcomes" /><FilterRow label="Product" value="All governed products" /><FilterRow label="Project size" value="10–20 openings" /></div><button type="button" onClick={() => onApply("Synthetic multi-region · 10–20 openings · Compare outcomes")} className="mt-6 min-h-12 w-full rounded-xl border border-[#2F7CE8] bg-[#4A92F9] font-black text-[#071A3A] shadow-[0_7px_0_-3px_#1F65C9,0_12px_22px_rgba(31,101,201,0.20)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A92F9] focus-visible:ring-offset-2">Apply synthetic view</button></div></div>;
}

function FilterRow({ label, value }: { label: string; value: string }) {
  return <button type="button" className="flex min-h-12 w-full items-center justify-between rounded-lg border border-[#C3CEDB] bg-white px-4 text-left shadow-[inset_0_1px_1px_rgba(11,24,48,0.03)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A92F9]"><span><span className="block font-mono text-[10px] font-black uppercase tracking-[0.08em] text-[#667085]">{label}</span><span className="text-sm font-bold text-[#0B1830]">{value}</span></span><SlidersHorizontal className="h-4 w-4 text-[#667085]" /></button>;
}

function SalesBriefDrawer({ onClose }: { onClose: () => void }) {
  return <div className="fixed inset-0 z-50 bg-slate-950/50"><aside className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto border-l border-[#C3CEDB] bg-[#EEF3F8] p-5 shadow-[-18px_0_48px_rgba(7,22,46,0.24)]"><div className="flex items-start justify-between gap-4"><div><div className="font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#315F9F]">Sales representative mode</div><h2 className="mt-1 text-2xl font-black text-[#0B1830]">Call brief</h2><p className="mt-1 text-sm font-medium text-[#667085]">{SALES_BRIEF_FIXTURE.cohortLabel}</p></div><button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#AFC4DD] bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A92F9]" aria-label="Close sales brief"><X className="h-5 w-5" /></button></div><div className="mt-5"><SyntheticPreviewBanner compact /></div><BriefSection title="Three strongest facts" icon={<Target className="h-4 w-4" />} items={SALES_BRIEF_FIXTURE.strongestFacts} /><BriefSection title="Approved language" icon={<HandCoins className="h-4 w-4" />} items={SALES_BRIEF_FIXTURE.approvedLanguage} /><BriefSection title="Do not claim" icon={<ShieldCheck className="h-4 w-4" />} items={SALES_BRIEF_FIXTURE.doNotClaim} danger /><button type="button" onClick={() => navigator.clipboard?.writeText(SALES_BRIEF_FIXTURE.approvedLanguage.join("\n"))} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#2F7CE8] bg-[#4A92F9] font-black text-[#071A3A] shadow-[0_7px_0_-3px_#1F65C9,0_12px_22px_rgba(31,101,201,0.20)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A92F9] focus-visible:ring-offset-2"><ClipboardCopy className="h-4 w-4" />Copy approved summary</button></aside></div>;
}

function BriefSection({ title, icon, items, danger = false }: { title: string; icon: React.ReactNode; items: string[]; danger?: boolean }) {
  return <section className={cn("mt-5 rounded-xl border bg-white p-4 shadow-[0_6px_16px_rgba(11,24,48,0.06),inset_0_1px_0_rgba(255,255,255,0.92)]", danger ? "border-rose-200" : "border-[#D6E0EC]")}><div className="flex items-center gap-2 text-sm font-black text-[#0B1830]">{icon}{title}</div><ul className="mt-3 space-y-2">{items.map((item) => <li key={item} className="flex gap-2 text-sm font-medium leading-5 text-[#667085]"><ChevronRight className={cn("mt-0.5 h-4 w-4 shrink-0", danger ? "text-rose-600" : "text-[#315F9F]")} />{item}</li>)}</ul></section>;
}
