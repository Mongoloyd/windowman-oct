import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import {
  formatBasisPoints,
  formatCents,
  type InternalIntelligenceViewModel,
} from "../adapter";

function Delta({
  label,
  cents,
  basisPoints,
}: {
  label: string;
  cents: number | null;
  basisPoints: number | null;
}) {
  const isIncrease = (cents ?? 0) > 0;
  const Icon = isIncrease ? TrendingUp : TrendingDown;

  return (
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span>{label}</span>
      <span className="font-semibold tabular-nums text-slate-200">
        {cents === null
          ? "INSUFFICIENT_DATA"
          : `${formatCents(cents)} · ${formatBasisPoints(basisPoints)}`}
      </span>
    </div>
  );
}
export function QuotePurchaseJourney({
  viewModel,
}: {
  viewModel: InternalIntelligenceViewModel;
}) {
  const largest = Math.max(
    1,
    ...viewModel.moneyStages.map((stage) => stage.medianCents ?? 0),
  );

  return (
    <section className="rounded-3xl border border-white/10 bg-[#0b1e3b]/90 p-5 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.08)]">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-200/65">
        Quote-to-purchase journey
      </p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
        Three prices, never one “sold price”
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
        Initial quote, accepted contract, and final invoice remain separate so
        negotiation and change-order movement stay visible.
      </p>

      <div className="mt-6 space-y-5">
        {viewModel.moneyStages.map((stage, index) => {
          const width = stage.medianCents
            ? Math.max(12, Math.round((stage.medianCents / largest) * 100))
            : 0;
          return (
            <div key={stage.key}>
              <div className="mb-2 flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-200">
                    {stage.label}
                  </p>
                  <p className="text-xs text-slate-500">
                    Eligible sample n={stage.sampleCount}
                  </p>
                </div>
                <p className="text-lg font-semibold tabular-nums tracking-tight text-white">
                  {formatCents(stage.medianCents)}
                </p>
              </div>
              <div className="h-3 overflow-hidden rounded-full border border-white/[0.06] bg-slate-950/70 shadow-inner">
                <div
                  className={`h-full rounded-full ${
                    index === 0
                      ? "bg-blue-400"
                      : index === 1
                        ? "bg-cyan-300"
                        : "bg-emerald-400"
                  }`}
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-3 border-t border-white/[0.08] pt-4">
        <Delta
          label="Initial → accepted"
          cents={viewModel.initialToAcceptedDeltaCents}
          basisPoints={viewModel.initialToAcceptedDeltaBasisPoints}
        />
        <Delta
          label="Accepted → final"
          cents={viewModel.acceptedToFinalDeltaCents}
          basisPoints={viewModel.acceptedToFinalDeltaBasisPoints}
        />
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-blue-300/15 bg-blue-400/[0.07] p-3.5 text-sm leading-6 text-blue-100/80">
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-blue-300" aria-hidden />
        <p>{viewModel.insight}</p>
      </div>
    </section>
  );
}
