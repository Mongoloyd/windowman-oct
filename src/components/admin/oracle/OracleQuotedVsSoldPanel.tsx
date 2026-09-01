import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MarketDistribution } from "@/lib/windowOracle";

type Props = {
  quoted: MarketDistribution | null;
  verifiedSold: MarketDistribution | null;
  deltaPct: number | null;
};

function money(n: number | null): string {
  if (n === null) return "—";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function OracleQuotedVsSoldPanel({
  quoted,
  verifiedSold,
  deltaPct,
}: Props) {
  return (
    <Card data-testid="oracle-quoted-vs-sold" className="overflow-hidden rounded-2xl border-2 border-[#B8CAE0] bg-white shadow-[0_22px_44px_-28px_rgba(7,28,62,0.42),inset_0_1px_0_rgba(255,255,255,0.96)]">
      <CardHeader className="border-b border-[#D6E1EE] bg-[#F6F9FD] pb-3">
        <CardTitle className="text-sm font-black">Quoted vs verified sold</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 pt-5 text-sm sm:grid-cols-2">
        <div className="relative space-y-2 overflow-hidden rounded-xl border-2 border-[#9CC8FF] bg-[#EEF6FF] p-5 shadow-[0_10px_24px_-18px_rgba(47,124,232,0.7),inset_0_1px_0_white] before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-[#4A92F9]">
          <p className="font-black text-[#164D91]">Quoted evidence</p>
          <p className="font-mono text-xs font-bold tabular-nums text-slate-700">Samples: {quoted?.sampleCount ?? 0}</p>
          <p className="font-mono text-lg font-black tabular-nums text-slate-950">Median PPO: {money(quoted?.median ?? null)}</p>
        </div>
        <div className="relative space-y-2 overflow-hidden rounded-xl border-2 border-emerald-300 bg-emerald-50 p-5 shadow-[0_10px_24px_-18px_rgba(8,122,85,0.65),inset_0_1px_0_white] before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-emerald-500">
          <p className="font-black text-emerald-900">Verified-sold evidence</p>
          <p className="font-mono text-xs font-bold tabular-nums text-slate-700">Samples: {verifiedSold?.sampleCount ?? 0}</p>
          <p className="font-mono text-lg font-black tabular-nums text-slate-950">Median PPO: {money(verifiedSold?.median ?? null)}</p>
        </div>
        {deltaPct !== null ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 font-medium leading-6 text-slate-700 sm:col-span-2">
            Within the synthetic fixture cohort, verified sold prices were{" "}
            <span className="font-mono font-black tabular-nums">{Math.abs(deltaPct)}%</span>{" "}
            {deltaPct < 0 ? "below" : "above"} initial quoted prices at the
            median.
          </p>
        ) : (
          <div role="status" className="rounded-xl border-2 border-dashed border-amber-400 bg-amber-50 p-5 text-sm font-black leading-6 text-amber-950 shadow-inner sm:col-span-2">
            INSUFFICIENT_DATA · A governed quoted-to-verified-sold comparison is not available for this synthetic cohort.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
