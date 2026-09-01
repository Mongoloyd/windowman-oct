import { CircleAlert, ShieldCheck } from "lucide-react";
import {
  formatBasisPoints,
  type InternalIntelligenceViewModel,
} from "../adapter";

const BAR_CLASSES = {
  blue: "bg-blue-400",
  green: "bg-emerald-400",
  amber: "bg-amber-400",
} as const;

export function DataQualityCommandCenter({
  viewModel,
}: {
  viewModel: InternalIntelligenceViewModel;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-[#0b1e3b]/90 p-5 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-200/65">
            Data quality command center
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
            Trust before intelligence
          </h2>
        </div>
        <ShieldCheck className="h-6 w-6 text-emerald-300" aria-hidden />
      </div>

      <div className="mt-6 space-y-5">
        {viewModel.qualitySignals.map((signal) => (
          <div key={signal.label}>
            <div className="mb-2 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-200">
                  {signal.label}
                </p>
                <p className="text-xs leading-5 text-slate-500">
                  {signal.detail}
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums text-white">
                {formatBasisPoints(signal.valueBasisPoints)}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full border border-white/[0.06] bg-slate-950/70 shadow-inner">
              <div
                className={`h-full rounded-full ${BAR_CLASSES[signal.tone]}`}
                style={{ width: `${signal.valueBasisPoints / 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2 border-t border-white/[0.08] pt-4">
        {[
          ["Eligible", viewModel.eligibleCount, "text-emerald-300"],
          ["Quarantined", viewModel.quarantinedCount, "text-amber-300"],
          ["Pending", viewModel.pendingCount, "text-blue-300"],
        ].map(([label, value, tone]) => (
          <div
            key={String(label)}
            className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-3 text-center"
          >
            <p className={`text-xl font-semibold tabular-nums ${tone}`}>
              {value}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300/15 bg-amber-400/[0.06] p-3 text-xs leading-5 text-amber-100/75">
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>
          Fixture quality states draft the future contract. They are not claims
          about current production extraction quality.
        </p>
      </div>
    </section>
  );
}
