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
    <section className="rounded-2xl border border-white/15 bg-[#0D2444] p-4 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.09)] sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.13em] text-[#A7C7F5]">
            Outcome coverage
          </p>
          <h2 className="mt-2 text-xl font-black tracking-tight text-white">
            Unknown is not lost
          </h2>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[#35D399]/35 bg-[#0C3240] px-3 py-2 text-[#D8FFF0] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          <span className="font-mono text-sm font-black tabular-nums">
            {formatBasisPoints(viewModel.knownOutcomeCoverageBasisPoints)} known
          </span>
        </div>
      </div>

      <div
        className="mt-6 flex h-4 overflow-hidden rounded-md border border-white/15 bg-[#061326] shadow-inner"
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

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {viewModel.outcomes.map((segment) => (
          <div
            key={segment.state}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/12 bg-[#10233F] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${segment.colorClass}`}
              />
              <span className="text-sm font-semibold leading-5 text-slate-200">
                {segment.label}
              </span>
            </div>
            <div className="text-right">
              <span className="block font-mono text-sm font-black tabular-nums text-white">
                {segment.count}
              </span>
              <span className="font-mono text-[11px] font-bold tabular-nums text-slate-300">
                {formatBasisPoints(segment.shareBasisPoints)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
