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
    <section className="rounded-2xl border border-white/15 bg-[#0D2444] p-4 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.09)] sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.13em] text-[#A7C7F5]">
            Data quality command center
          </p>
          <h2 className="mt-2 text-xl font-black tracking-tight text-white">
            Trust before intelligence
          </h2>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-xl border border-[#35D399]/30 bg-[#0C3240] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"><ShieldCheck className="h-5 w-5 text-[#8FF0C9]" aria-hidden /></div>
      </div>

      <div className="mt-6 grid gap-2 lg:grid-cols-2">
        {viewModel.qualitySignals.map((signal) => (
          <article key={signal.label} className="rounded-xl border border-white/12 bg-[#10233F] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="mb-2 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black text-slate-100">
                  {signal.label}
                </p>
                <p className="text-xs font-medium leading-5 text-slate-300">
                  {signal.detail}
                </p>
              </div>
              <span className="font-mono text-sm font-black tabular-nums text-white">
                {formatBasisPoints(signal.valueBasisPoints)}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-md border border-white/10 bg-[#061326] shadow-inner">
              <div
                className={`h-full rounded-full ${BAR_CLASSES[signal.tone]}`}
                style={{ width: `${signal.valueBasisPoints / 100}%` }}
              />
            </div>
          </article>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
        {[
          ["Eligible", viewModel.eligibleCount, "text-emerald-300"],
          ["Quarantined", viewModel.quarantinedCount, "text-amber-300"],
          ["Pending", viewModel.pendingCount, "text-blue-300"],
        ].map(([label, value, tone]) => (
          <div
            key={String(label)}
            className="rounded-xl border border-white/12 bg-[#10233F] p-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
          >
            <p className={`font-mono text-xl font-black tabular-nums ${tone}`}>
              {value}
            </p>
            <p className="mt-1 text-[11px] font-semibold text-slate-300">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300/30 bg-amber-400/[0.09] p-3 text-xs font-medium leading-5 text-amber-50">
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>
          Fixture quality states draft the future contract. They are not claims
          about current production extraction quality.
        </p>
      </div>
    </section>
  );
}
