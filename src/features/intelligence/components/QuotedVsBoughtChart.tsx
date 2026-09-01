import { formatCompactMoneyCents, formatMoneyCents } from "../format";
import type { DistributionSummary } from "../types";

type Props = {
  quoted: DistributionSummary;
  accepted: DistributionSummary;
  final?: DistributionSummary;
  compact?: boolean;
  variant?: "default" | "public-stage-1a" | "observatory-stage-2";
};

function scaleMaxFor(distributions: DistributionSummary[]): number {
  const maximum = Math.max(0, ...distributions.map((distribution) => distribution.highCents));
  const increment = maximum <= 1_000_000 ? 100_000 : maximum <= 5_000_000 ? 500_000 : 1_000_000;
  return Math.max(increment, Math.ceil(maximum / increment) * increment);
}

function pct(value: number, scaleMaxCents: number): number {
  return Math.min(100, Math.max(0, (value / scaleMaxCents) * 100));
}

function DistributionRow({ label, distribution, population, scaleMaxCents, variant }: { label: string; distribution: DistributionSummary; population: "quoted" | "accepted" | "final"; scaleMaxCents: number; variant: NonNullable<Props["variant"]> }) {
  const publicVariant = variant === "public-stage-1a";
  const observatoryVariant = variant === "observatory-stage-2";
  const instrumentVariant = publicVariant || observatoryVariant;
  const color = instrumentVariant
    ? population === "quoted" ? "#4A92F9" : population === "accepted" ? observatoryVariant ? "#315F9F" : "#087A55" : "#087A55"
    : population === "quoted" ? "#356AC3" : population === "accepted" ? "#C27040" : "#17825B";
  const labelColor = instrumentVariant && population === "quoted" ? "#215EA8" : color;
  const background = instrumentVariant
    ? population === "quoted" ? "rgba(74,146,249,0.16)" : population === "accepted" ? observatoryVariant ? "rgba(49,95,159,0.14)" : "rgba(8,122,85,0.14)" : "rgba(8,122,85,0.14)"
    : population === "quoted" ? "rgba(53,106,195,0.15)" : population === "accepted" ? "rgba(194,112,64,0.16)" : "rgba(23,130,91,0.15)";
  const left = pct(distribution.p25Cents, scaleMaxCents);
  const right = pct(distribution.p75Cents, scaleMaxCents);

  return (
    <div className="grid gap-2 sm:grid-cols-[140px_1fr] sm:items-center">
      <div>
        <div className="text-xs font-black" style={{ color: labelColor }}>{label}</div>
        <div className={instrumentVariant ? "mt-1 font-mono text-xl font-black tabular-nums tracking-tight text-[#0B1830]" : "mt-1 font-mono text-lg font-black tabular-nums text-slate-950"}>{formatMoneyCents(distribution.medianCents)}</div>
        <div className={instrumentVariant ? "text-[11px] font-semibold text-[#667085]" : "text-[11px] font-semibold text-slate-500"}>median · n={distribution.sampleSize}</div>
      </div>
      <div className={instrumentVariant ? "relative h-[52px]" : "relative h-16"} aria-hidden="true">
        <div className={instrumentVariant ? "absolute inset-x-0 top-[25px] h-px bg-[#C3CEDB]" : "absolute inset-x-0 top-8 h-px bg-slate-300"} />
        <div className={instrumentVariant ? "absolute top-[24px] h-1 rounded-full" : "absolute top-[29px] h-[7px] rounded-full"} style={{ left: `${pct(distribution.lowCents, scaleMaxCents)}%`, width: `${pct(distribution.highCents, scaleMaxCents) - pct(distribution.lowCents, scaleMaxCents)}%`, backgroundColor: color }} />
        <div className={instrumentVariant ? "absolute top-5 h-3 rounded border-2" : "absolute top-4 h-8 rounded-md border-2"} style={{ left: `${left}%`, width: `${Math.max(2, right - left)}%`, borderColor: color, backgroundColor: background }} />
        <div className={instrumentVariant ? "absolute top-3 h-8 w-0.5" : "absolute top-2 h-12 w-0.5"} style={{ left: `${pct(distribution.medianCents, scaleMaxCents)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export function QuotedVsBoughtChart({ quoted, accepted, final, compact = false, variant = "default" }: Props) {
  const distributions = final ? [quoted, accepted, final] : [quoted, accepted];
  const scaleMaxCents = scaleMaxFor(distributions);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => Math.round(scaleMaxCents * fraction));
  const mobileTicks = [ticks[0], ticks[2], ticks[4]];
  const instrumentVariant = variant !== "default";

  return (
    <figure aria-label={final ? "Quoted, verified accepted, and verified final price distributions" : "Quoted and verified accepted price distributions"} className={instrumentVariant ? "rounded-xl border border-[#D6E0EC] bg-[#F4F7FB] p-3 shadow-[inset_0_1px_2px_rgba(11,24,48,0.05)] sm:p-5" : "rounded-2xl border border-slate-200 bg-[linear-gradient(to_right,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-[size:12.5%_100%] p-4 shadow-inner sm:p-6"}>
      <div className={compact ? "space-y-4" : "space-y-5"}>
        <DistributionRow label="Quoted · offered" distribution={quoted} population="quoted" scaleMaxCents={scaleMaxCents} variant={variant} />
        <DistributionRow label="Verified accepted" distribution={accepted} population="accepted" scaleMaxCents={scaleMaxCents} variant={variant} />
        {final ? <DistributionRow label="Verified final" distribution={final} population="final" scaleMaxCents={scaleMaxCents} variant={variant} /> : null}
      </div>
      {instrumentVariant ? (
        <>
          <div className="mt-3 flex justify-between border-t border-[#D6E0EC] pt-2 font-mono text-[10px] font-bold tabular-nums text-[#667085] sm:hidden" data-testid="public-oracle-mobile-axis">
            {mobileTicks.map((value) => <span key={value}>{formatCompactMoneyCents(value)}</span>)}
          </div>
          <div className="ml-[140px] mt-3 hidden justify-between border-t border-[#D6E0EC] pt-2 font-mono text-[10px] font-bold tabular-nums text-[#667085] sm:flex" data-testid="public-oracle-desktop-axis">
            {ticks.map((value) => <span key={value}>{formatCompactMoneyCents(value)}</span>)}
          </div>
        </>
      ) : (
        <div className="ml-0 mt-3 flex justify-between border-t border-slate-200 pt-2 font-mono text-[10px] font-bold text-slate-500 sm:ml-[140px]">
          {ticks.map((value) => <span key={value}>{formatCompactMoneyCents(value)}</span>)}
        </div>
      )}
      <figcaption className={instrumentVariant ? "mt-4 border-t border-[#D6E0EC] pt-3 text-xs font-medium leading-[18px] text-[#667085]" : "mt-4 border-t border-slate-200 pt-3 text-xs font-medium leading-5 text-slate-600"}>
        Synthetic comparison of separately labeled populations. Lines show observed range; outlined bands show the middle 50%; vertical markers show medians. No causal or market-wide claim is made.
      </figcaption>
    </figure>
  );
}
