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
          className="h-40 animate-pulse rounded-3xl border border-white/10 bg-white/[0.055] shadow-inner"
        />
      ))}
    </div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-blue-300/25 bg-blue-400/[0.055] px-6 py-16 text-center">
      <DatabaseZap className="mx-auto h-9 w-9 text-blue-300" aria-hidden />
      <h2 className="mt-4 text-xl font-semibold text-white">
        INSUFFICIENT_DATA
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
        No synthetic projects are available in this scenario. The UI stays
        explicit instead of inventing a market result.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-6 min-h-11 rounded-xl border border-blue-300/30 bg-[#356AC3] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_-16px_rgba(53,106,195,0.9)] transition-colors hover:bg-[#2f5faf] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
      >
        Restore healthy fixture
      </button>
    </div>
  );
}

function ErrorState({ onReset }: { onReset: () => void }) {
  return (
    <div
      className="rounded-3xl border border-rose-300/25 bg-rose-400/[0.07] px-6 py-16 text-center"
      role="alert"
    >
      <AlertTriangle className="mx-auto h-9 w-9 text-rose-300" aria-hidden />
      <h2 className="mt-4 text-xl font-semibold text-white">
        Fixture adapter unavailable
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
        This is the recoverable UI error state. No source fixture or user input
        has been discarded.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-300/30 bg-[#356AC3] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_-16px_rgba(53,106,195,0.9)] transition-colors hover:bg-[#2f5faf] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
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
      className="min-h-[calc(100vh-6.75rem)] bg-[radial-gradient(circle_at_15%_0%,rgba(53,106,195,0.24),transparent_35%),linear-gradient(145deg,#061326_0%,#0a1a33_48%,#071426_100%)] px-4 py-5 text-white sm:px-6 lg:px-8"
      data-testid="internal-intelligence-console"
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-200/70">
              <FlaskConical className="h-4 w-4" aria-hidden />
              Synthetic product laboratory
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">
              Internal Intelligence Console
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
              A fixture-first view of estimates, exact revisions, verified
              outcomes, purchase movement, and data quality. No live backend.
            </p>
          </div>

          <div className="rounded-2xl border border-blue-300/20 bg-blue-400/[0.08] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-200">
              Synthetic data only
            </p>
            <p className="mt-1 text-xs text-blue-100/60">
              Not connected to Supabase, OCR, or production reports
            </p>
          </div>
        </div>

        <div
          className="mt-5 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Fixture scenarios"
        >
          {SCENARIOS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setScenario(option.id)}
              aria-pressed={scenario === option.id}
              className={`min-h-11 shrink-0 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${
                scenario === option.id
                  ? "border-blue-300/40 bg-[#356AC3] text-white shadow-[0_12px_28px_-18px_rgba(53,106,195,0.95)]"
                  : "border-white/10 bg-white/[0.045] text-slate-300 hover:bg-white/[0.08]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {viewModel ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <p>
              Fixture: <span className="font-medium text-slate-300">{viewModel.fixtureLabel}</span>
            </p>
            <p className="tabular-nums">
              Generated {new Date(viewModel.generatedAt).toLocaleString("en-US")}
            </p>
          </div>
        ) : null}

        <div className="mt-5">
          {scenario === "LOADING" ? <LoadingState /> : null}
          {scenario === "ERROR" ? <ErrorState onReset={reset} /> : null}
          {viewModel?.status === "EMPTY" ? <EmptyState onReset={reset} /> : null}

          {viewModel && viewModel.status !== "EMPTY" ? (
            <>
              {viewModel.status === "INSUFFICIENT_DATA" ? (
                <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-300/25 bg-amber-400/[0.08] p-4 text-sm leading-6 text-amber-100">
                  <AlertTriangle className="mt-1 h-4 w-4 shrink-0" aria-hidden />
                  <p>
                    <strong>INSUFFICIENT_DATA.</strong> Components remain visible
                    for design QA, but this scenario cannot support commercial
                    conclusions.
                  </p>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {viewModel.metrics.map((metric) => (
                  <IntelligenceMetricCard key={metric.label} metric={metric} />
                ))}
              </div>

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
