import { formatCompactMoneyCents, formatMoneyCents } from "../format";
import type { DistributionSummary } from "../types";

type Props = {
  quoted: DistributionSummary;
  accepted: DistributionSummary;
  final?: DistributionSummary;
  compact?: boolean;
};

function scaleMaxFor(distributions: DistributionSummary[]): number {
  const maximum = Math.max(0, ...distributions.map((distribution) => distribution.highCents));
  const increment = maximum <= 1_000_000 ? 100_000 : maximum <= 5_000_000 ? 500_000 : 1_000_000;
  return Math.max(increment, Math.ceil(maximum / increment) * increment);
}

function pct(value: number, scaleMaxCents: number): number {
  return Math.min(100, Math.max(0, (value / scaleMaxCents) * 100));
}

function DistributionRow({ label, distribution, tone, scaleMaxCents }: { label: string; distribution: DistributionSummary; tone: "blue" | "orange" | "emerald"; scaleMaxCents: number }) {
  const color = tone === "blue" ? "#356AC3" : tone === "orange" ? "#C27040" : "#17825B";
  const background = tone === "blue" ? "rgba(53,106,195,0.15)" : tone === "orange" ? "rgba(194,112,64,0.16)" : "rgba(23,130,91,0.15)";
  const left = pct(distribution.p25Cents, scaleMaxCents);
  const right = pct(distribution.p75Cents, scaleMaxCents);

  return (
    <div className="grid gap-2 sm:grid-cols-[140px_1fr] sm:items-center">
      <div>
        <div className="text-xs font-black" style={{ color }}>{label}</div>
        <div className="mt-1 font-mono text-lg font-black tabular-nums text-slate-950">{formatMoneyCents(distribution.medianCents)}</div>
        <div className="text-[11px] font-semibold text-slate-500">median · n={distribution.sampleSize}</div>
      </div>
      <div className="relative h-16" aria-hidden="true">
        <div className="absolute inset-x-0 top-8 h-px bg-slate-300" />
        <div className="absolute top-[29px] h-[7px] rounded-full" style={{ left: `${pct(distribution.lowCents, scaleMaxCents)}%`, width: `${pct(distribution.highCents, scaleMaxCents) - pct(distribution.lowCents, scaleMaxCents)}%`, backgroundColor: color }} />
        <div className="absolute top-4 h-8 rounded-md border-2" style={{ left: `${left}%`, width: `${Math.max(2, right - left)}%`, borderColor: color, backgroundColor: background }} />
        <div className="absolute top-2 h-12 w-0.5" style={{ left: `${pct(distribution.medianCents, scaleMaxCents)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export function QuotedVsBoughtChart({ quoted, accepted, final, compact = false }: Props) {
  const distributions = final ? [quoted, accepted, final] : [quoted, accepted];
  const scaleMaxCents = scaleMaxFor(distributions);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => Math.round(scaleMaxCents * fraction));

  return (
    <figure className="rounded-2xl border border-slate-200 bg-[linear-gradient(to_right,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-[size:12.5%_100%] p-4 shadow-inner sm:p-6">
      <div className={compact ? "space-y-4" : "space-y-5"}>
        <DistributionRow label="Quoted · offered" distribution={quoted} tone="blue" scaleMaxCents={scaleMaxCents} />
        <DistributionRow label="Verified accepted" distribution={accepted} tone="orange" scaleMaxCents={scaleMaxCents} />
        {final ? <DistributionRow label="Verified final" distribution={final} tone="emerald" scaleMaxCents={scaleMaxCents} /> : null}
      </div>
      <div className="ml-0 mt-3 flex justify-between border-t border-slate-200 pt-2 font-mono text-[10px] font-bold text-slate-500 sm:ml-[140px]">
        {ticks.map((value) => <span key={value}>{formatCompactMoneyCents(value)}</span>)}
      </div>
      <figcaption className="mt-4 border-t border-slate-200 pt-3 text-xs font-medium leading-5 text-slate-600">
        Synthetic comparison of separately labeled populations. Lines show observed range; outlined bands show the middle 50%; vertical markers show medians. No causal or market-wide claim is made.
      </figcaption>
    </figure>
  );
}
