import type { IntelligenceMetricViewModel } from "../adapter";

const TONE_CLASSES: Record<IntelligenceMetricViewModel["tone"], string> = {
  blue: "border-[#4A92F9]/35 bg-[#102B50] text-[#DCEBFF] before:bg-[#4A92F9]",
  green: "border-[#35D399]/30 bg-[#0C3240] text-[#D8FFF0] before:bg-[#35D399]",
  amber: "border-amber-300/30 bg-[#2B2A2A] text-amber-50 before:bg-amber-300",
  neutral: "border-white/15 bg-[#10233F] text-white before:bg-slate-300",
};

export function IntelligenceMetricCard({
  metric,
}: {
  metric: IntelligenceMetricViewModel;
}) {
  return (
    <article
      className={`relative min-h-[132px] overflow-hidden rounded-xl border p-4 pl-5 shadow-[0_12px_26px_-20px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.09)] before:absolute before:inset-y-3 before:left-0 before:w-1 before:rounded-r-full ${TONE_CLASSES[metric.tone]}`}
    >
      <p className="font-mono text-[10px] font-black uppercase tracking-[0.12em] text-current opacity-85">
        {metric.label}
      </p>
      <p className="mt-3 font-mono text-3xl font-black tabular-nums tracking-[-0.045em]">
        {metric.value}
      </p>
      <p className="mt-1 text-xs font-semibold leading-5 text-current opacity-80">{metric.detail}</p>
    </article>
  );
}
