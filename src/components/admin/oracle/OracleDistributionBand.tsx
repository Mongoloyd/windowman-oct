import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MarketDistribution } from "@/lib/windowOracle";

type Props = {
  ppo: MarketDistribution;
  homeownerPpo?: number | null;
  title?: string;
};

function money(n: number | null): string {
  if (n === null) return "—";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function OracleDistributionBand({
  ppo,
  homeownerPpo,
  title = "Median price per opening",
}: Props) {
  if (ppo.median === null) {
    return (
      <Card data-testid="oracle-distribution-band" className="rounded-2xl border-slate-300 shadow-[0_18px_38px_-30px_rgba(15,23,42,0.45)]">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-black">{title}</CardTitle></CardHeader>
        <CardContent>
          <div role="status" className="rounded-xl border border-dashed border-amber-400 bg-amber-50 p-5 text-sm font-black text-amber-950">INSUFFICIENT_DATA · No governed synthetic distribution is available for this cohort.</div>
        </CardContent>
      </Card>
    );
  }

  const scaleMin = ppo.min ?? ppo.p25 ?? ppo.median;
  const scaleMax = ppo.max ?? ppo.p75 ?? ppo.median;
  const scaleSpan = Math.max(1, scaleMax - scaleMin);
  const position = (value: number | null | undefined) => {
    if (value === null || value === undefined) return null;
    return Math.min(100, Math.max(0, ((value - scaleMin) / scaleSpan) * 100));
  };
  const p25Position = position(ppo.p25) ?? 0;
  const p75Position = position(ppo.p75) ?? 100;
  const medianPosition = position(ppo.median) ?? 50;
  const homeownerPosition = position(homeownerPpo);
  const medianLabelPosition = Math.min(92, Math.max(8, medianPosition));
  const homeownerLabelPosition = homeownerPosition === null
    ? null
    : Math.min(88, Math.max(12, homeownerPosition));

  return (
    <Card data-testid="oracle-distribution-band" className="overflow-hidden rounded-2xl border-2 border-[#AFC7E3] bg-white shadow-[0_22px_44px_-26px_rgba(7,28,62,0.46),inset_0_1px_0_rgba(255,255,255,0.96)]">
      <CardHeader className="border-b border-[#D6E1EE] bg-[#F5F9FF] pb-3">
        <CardTitle className="text-sm font-black">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <p className="font-mono text-3xl font-black tabular-nums tracking-[-0.04em] text-slate-950">
          {money(ppo.median)}
        </p>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <Stat label="P25" value={money(ppo.p25)} />
          <Stat label="Average" value={money(ppo.average)} />
          <Stat label="P75" value={money(ppo.p75)} />
        </div>
        <div className="rounded-xl border-2 border-[#CAD8E8] bg-[#F6F9FD] p-4 shadow-[inset_0_2px_4px_rgba(15,23,42,0.06)]" aria-label="Synthetic price distribution visualization">
          <div className="relative h-14" aria-hidden="true">
            <div className="absolute inset-x-0 top-7 h-2 rounded-full border border-slate-300 bg-slate-200 shadow-inner" />
            <div
              className="absolute top-[25px] h-3 rounded-full border border-[#2F7CE8] bg-[#8EC0FF] shadow-[0_4px_10px_rgba(47,124,232,0.28)]"
              style={{ left: `${p25Position}%`, width: `${Math.max(2, p75Position - p25Position)}%` }}
            />
            <div className="absolute top-3 h-8 w-0.5 bg-[#071C3E]" style={{ left: `${medianPosition}%` }} />
            <span className="absolute top-0 -translate-x-1/2 font-mono text-[9px] font-black uppercase tracking-[0.08em] text-[#071C3E]" style={{ left: `${medianLabelPosition}%` }}>Median</span>
            {homeownerPosition !== null ? (
              <>
                <div className="absolute top-5 h-6 w-1 -translate-x-1/2 rounded-full bg-[#F98224] shadow-[0_0_0_3px_rgba(249,130,36,0.18)]" style={{ left: `${homeownerPosition}%` }} />
                <span className="absolute bottom-0 -translate-x-1/2 font-mono text-[9px] font-black uppercase tracking-[0.06em] text-[#9A3D05]" style={{ left: `${homeownerLabelPosition}%` }}>Homeowner</span>
              </>
            ) : null}
          </div>
          <div className="mt-1 flex justify-between font-mono text-[10px] font-bold tabular-nums text-slate-600">
            <span>{money(scaleMin)}</span>
            <span>{money(scaleMax)}</span>
          </div>
          <p className="mt-2 text-[11px] font-semibold leading-4 text-slate-600">Outlined band shows the middle 50%; markers show the cohort median and supplied synthetic homeowner PPO.</p>
        </div>
        <div className="grid grid-cols-5 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 font-mono text-[10px] tabular-nums text-slate-700">
          <BandPoint label="LOW" value={money(ppo.min)} />
          <BandPoint label="P25" value={money(ppo.p25)} />
          <BandPoint label="MEDIAN" value={money(ppo.median)} emphasis />
          <BandPoint label="P75" value={money(ppo.p75)} />
          <BandPoint label="HIGH" value={money(ppo.max)} />
        </div>
        {homeownerPpo != null && (
          <p className="rounded-lg border border-[#4A92F9]/35 bg-[#EAF3FF] px-3 py-2 font-mono text-sm font-black tabular-nums text-[#164D91]">
            Synthetic homeowner PPO · ${Math.round(homeownerPpo).toLocaleString("en-US")}
          </p>
        )}
        <p className="text-xs font-semibold text-slate-600">
          Samples: {ppo.sampleCount} · Median is primary; average is secondary
        </p>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className="mt-1 font-mono font-black tabular-nums text-slate-950">{value}</p>
    </div>
  );
}

function BandPoint({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`min-w-0 border-r border-slate-200 px-1 py-2 text-center last:border-r-0 ${emphasis ? "bg-[#EAF3FF] text-[#164D91]" : ""}`}>
      <p className="font-black tracking-[0.08em]">{label}</p>
      <p className="mt-1 truncate font-bold">{value}</p>
    </div>
  );
}
