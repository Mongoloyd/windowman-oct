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
  return (
    <Card data-testid="oracle-distribution-band">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-3xl font-bold text-slate-900 tabular-nums">
          {money(ppo.median)}
        </p>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <Stat label="P25" value={money(ppo.p25)} />
          <Stat label="Average" value={money(ppo.average)} />
          <Stat label="P75" value={money(ppo.p75)} />
        </div>
        <div className="text-xs text-slate-600 font-mono leading-relaxed">
          LOW {money(ppo.min)} ── P25 {money(ppo.p25)} ─── MEDIAN{" "}
          {money(ppo.median)} ─── P75 {money(ppo.p75)} ─── HIGH {money(ppo.max)}
        </div>
        {homeownerPpo != null && (
          <p className="text-sm font-medium text-rose-800">
            Homeowner ▲ ${Math.round(homeownerPpo).toLocaleString("en-US")}
          </p>
        )}
        <p className="text-xs text-slate-500">
          Samples: {ppo.sampleCount} · Median is primary; average is secondary
        </p>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5">
      <p className="text-xs text-slate-600">{label}</p>
      <p className="font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}
