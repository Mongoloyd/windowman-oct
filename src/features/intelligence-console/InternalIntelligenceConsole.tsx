import { useMemo, useState } from "react";
import {
  AlertTriangle,
  DatabaseZap,
  FlaskConical,
  RefreshCw,
} from "lucide-react";
import { buildInternalIntelligenceViewModel } from "./adapter";
import { SYNTHETIC_INTELLIGENCE_DATASETS } from "./fixtures";
import type { IntelligenceConsoleScenario } from "./types";
import { DataQualityCommandCenter } from "./components/DataQualityCommandCenter";
import { IntelligenceMetricCard } from "./components/IntelligenceMetricCard";
import { OutcomeCoveragePanel } from "./components/OutcomeCoveragePanel";
import { QuotePurchaseJourney } from "./components/QuotePurchaseJourney";
import { ORACLE_VISUAL_TOKENS } from "@/features/intelligence/components/OracleVisualSystem";

const SCENARIOS: Array<{
  id: IntelligenceConsoleScenario;
  label: string;
}> = [
  { id: "HEALTHY", label: "Healthy" },
  { id: "THIN_DATA", label: "Thin data" },
  { id: "NO_VERIFIED_OUTCOMES", label: "No outcomes" },
  { id: "EMPTY", label: "Empty" },
  { id: "LOADING", label: "Loading" },
  { id: "ERROR", label: "Error" },
];

function LoadingState() {
  return (
    <div
      className="grid gap-4 lg:grid-cols-2"
      role="status"
      aria-label="Loading synthetic intelligence console"
    >
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          className="h-40 animate-pulse rounded-2xl border border-white/15 bg-white/[0.07] shadow-inner"
        />
      ))}
    </div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#4A92F9]/45 bg-[#4A92F9]/10 px-6 py-16 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <DatabaseZap className="mx-auto h-9 w-9 text-[#A7C7F5]" aria-hidden />
      <h2 className="mt-4 text-xl font-semibold text-white">
        INSUFFICIENT_DATA
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-300">
        No synthetic projects are available in this scenario. The UI stays
        explicit instead of inventing a market result.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-6 min-h-11 rounded-lg border border-[#4A92F9] bg-[#4A92F9] px-5 py-2.5 text-sm font-black text-[#071C3E] shadow-[0_5px_0_-2px_#215EA8,0_12px_24px_rgba(0,0,0,0.22)] transition-[box-shadow,transform] active:translate-y-px active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        Restore healthy fixture
      </button>
    </div>
  );
}

function ErrorState({ onReset }: { onReset: () => void }) {
  return (
    <div
      className="rounded-2xl border border-rose-300/35 bg-rose-400/[0.09] px-6 py-16 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
      role="alert"
    >
      <AlertTriangle className="mx-auto h-9 w-9 text-rose-300" aria-hidden />
      <h2 className="mt-4 text-xl font-semibold text-white">
        Fixture adapter unavailable
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-300">
        This is the recoverable UI error state. No source fixture or user input
        has been discarded.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#4A92F9] bg-[#4A92F9] px-5 py-2.5 text-sm font-black text-[#071C3E] shadow-[0_5px_0_-2px_#215EA8,0_12px_24px_rgba(0,0,0,0.22)] transition-[box-shadow,transform] active:translate-y-px active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <RefreshCw className="h-4 w-4" aria-hidden />
        Retry fixture
      </button>
    </div>
  );
}

export function InternalIntelligenceConsole() {
  const [scenario, setScenario] =
    useState<IntelligenceConsoleScenario>("HEALTHY");

  const viewModel = useMemo(() => {
    if (scenario === "LOADING" || scenario === "ERROR") return null;
    return buildInternalIntelligenceViewModel(
      SYNTHETIC_INTELLIGENCE_DATASETS[scenario],
    );
  }, [scenario]);

  const reset = () => setScenario("HEALTHY");

  return (
    <main
      className="min-h-[calc(100vh-6.75rem)] bg-[linear-gradient(145deg,#07172D_0%,#0B1D36_52%,#08162A_100%)] px-4 py-5 text-white sm:px-6 sm:py-7 lg:px-8"
      data-testid="internal-intelligence-console"
    >
      <div className="mx-auto max-w-7xl">
        <header className={`overflow-hidden ${ORACLE_VISUAL_TOKENS.panelDark}`} data-testid="foundation-audit-header">
          <div className="grid gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-[0.14em] text-[#A7C7F5]">
                <FlaskConical className="h-4 w-4" aria-hidden />
                Synthetic product laboratory
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-[-0.045em] text-white sm:text-4xl">
                Internal Intelligence Console
              </h1>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-300 sm:text-base">
                A fixture-first view of estimates, exact revisions, verified
                outcomes, purchase movement, and data quality. No live backend.
              </p>
            </div>

            <div className="rounded-xl border border-[#4A92F9]/35 bg-[#071C3E] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.12em] text-[#A7C7F5]">
                Synthetic · fixture only
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-300">
                Not connected to Supabase, OCR, or production reports
              </p>
            </div>
          </div>

          {viewModel ? (
            <div className="grid border-t border-white/10 bg-black/10 sm:grid-cols-2" aria-label="Fixture audit record">
              <div className="border-b border-white/10 px-4 py-3 sm:border-b-0 sm:border-r sm:px-6">
                <p className="font-mono text-[10px] font-black uppercase tracking-[0.12em] text-[#A7C7F5]">Fixture</p>
                <p className="mt-1 text-sm font-bold text-white">{viewModel.fixtureLabel}</p>
              </div>
              <div className="px-4 py-3 sm:px-6">
                <p className="font-mono text-[10px] font-black uppercase tracking-[0.12em] text-[#A7C7F5]">Generated</p>
                <p className="mt-1 font-mono text-sm font-bold tabular-nums text-white">{new Date(viewModel.generatedAt).toLocaleString("en-US")}</p>
              </div>
            </div>
          ) : null}
        </header>

        <fieldset className="mt-4 rounded-2xl border border-white/15 bg-[#08182E] p-2 shadow-[inset_0_1px_4px_rgba(0,0,0,0.48)]">
          <legend className="sr-only">Fixture scenario</legend>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6" role="radiogroup" aria-label="Fixture scenarios">
            {SCENARIOS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setScenario(option.id)}
                role="radio"
                aria-checked={scenario === option.id}
                className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-black transition-[background-color,border-color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A7C7F5] ${
                  scenario === option.id
                    ? "border-[#4A92F9] bg-[#173E70] text-white shadow-[inset_0_3px_0_#4A92F9,0_5px_12px_rgba(0,0,0,0.30)]"
                    : "border-white/10 bg-white/[0.045] text-slate-300 hover:border-white/20 hover:bg-white/[0.08] active:translate-y-px"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-5">
          {scenario === "LOADING" ? <LoadingState /> : null}
          {scenario === "ERROR" ? <ErrorState onReset={reset} /> : null}
          {viewModel?.status === "EMPTY" ? <EmptyState onReset={reset} /> : null}

          {viewModel && viewModel.status !== "EMPTY" ? (
            <>
              {viewModel.status === "INSUFFICIENT_DATA" ? (
                <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-300/35 bg-amber-400/[0.10] p-4 text-sm font-medium leading-6 text-amber-50">
                  <AlertTriangle className="mt-1 h-4 w-4 shrink-0" aria-hidden />
                  <p>
                    <strong>INSUFFICIENT_DATA.</strong> Components remain visible
                    for design QA, but this scenario cannot support commercial
                    conclusions.
                  </p>
                </div>
              ) : null}

              <section className="rounded-2xl border border-white/15 bg-[#08182E] p-2 shadow-[0_18px_42px_-30px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.08)]" aria-label="Foundation metrics">
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {viewModel.metrics.map((metric) => (
                    <IntelligenceMetricCard key={metric.label} metric={metric} />
                  ))}
                </div>
              </section>

              <div className="mt-4 grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
                <QuotePurchaseJourney viewModel={viewModel} />
                <OutcomeCoveragePanel viewModel={viewModel} />
              </div>

              <div className="mt-4">
                <DataQualityCommandCenter viewModel={viewModel} />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
