import { CheckCircle2 } from "lucide-react";
import {
  formatBasisPoints,
  type InternalIntelligenceViewModel,
} from "../adapter";

export function OutcomeCoveragePanel({
  viewModel,
}: {
  viewModel: InternalIntelligenceViewModel;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-[#0b1e3b]/90 p-5 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-200/65">
            Outcome coverage
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
            Unknown is not lost
          </h2>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-emerald-100">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          <span className="text-sm font-semibold tabular-nums">
            {formatBasisPoints(viewModel.knownOutcomeCoverageBasisPoints)} known
          </span>
        </div>
      </div>

      <div
        className="mt-6 flex h-4 overflow-hidden rounded-full border border-white/10 bg-slate-950/70 shadow-inner"
        aria-label="Synthetic project outcome distribution"
      >
        {viewModel.outcomes.map((segment) => (
          <div
            key={segment.state}
            className={segment.colorClass}
            style={{ width: `${segment.shareBasisPoints / 100}%` }}
            title={`${segment.label}: ${segment.count}`}
          />
        ))}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {viewModel.outcomes.map((segment) => (
          <div
            key={segment.state}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2.5"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${segment.colorClass}`}
              />
              <span className="truncate text-sm text-slate-200">
                {segment.label}
              </span>
            </div>
            <div className="text-right">
              <span className="block text-sm font-semibold tabular-nums text-white">
                {segment.count}
              </span>
              <span className="text-[11px] tabular-nums text-slate-400">
                {formatBasisPoints(segment.shareBasisPoints)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
