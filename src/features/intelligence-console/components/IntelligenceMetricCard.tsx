import type { IntelligenceMetricViewModel } from "../adapter";

const TONE_CLASSES: Record<IntelligenceMetricViewModel["tone"], string> = {
  blue: "border-blue-300/20 bg-blue-400/[0.09] text-blue-100",
  green: "border-emerald-300/20 bg-emerald-400/[0.09] text-emerald-100",
  amber: "border-amber-300/25 bg-amber-400/[0.09] text-amber-100",
  neutral: "border-white/10 bg-white/[0.055] text-white",
};

export function IntelligenceMetricCard({
  metric,
}: {
  metric: IntelligenceMetricViewModel;
}) {
  return (
    <article
      className={`relative overflow-hidden rounded-2xl border p-4 shadow-[0_18px_40px_-26px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.09)] ${TONE_CLASSES[metric.tone]}`}
    >
      <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-current/70">
        {metric.label}
      </p>
      <p className="mt-3 text-3xl font-semibold tabular-nums tracking-[-0.04em]">
        {metric.value}
      </p>
      <p className="mt-1 text-xs leading-5 text-current/65">{metric.detail}</p>
    </article>
  );
}
