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
    <Card data-testid="oracle-quoted-vs-sold">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Quoted vs verified sold</CardTitle>
      </CardHeader>
      <CardContent className="grid sm:grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border border-slate-100 p-3 space-y-1">
          <p className="font-semibold text-slate-900">Quoted market</p>
          <p>Samples: {quoted?.sampleCount ?? 0}</p>
          <p>Median PPO: {money(quoted?.median ?? null)}</p>
        </div>
        <div className="rounded-lg border border-slate-100 p-3 space-y-1">
          <p className="font-semibold text-slate-900">Verified sold market</p>
          <p>Samples: {verifiedSold?.sampleCount ?? 0}</p>
          <p>Median PPO: {money(verifiedSold?.median ?? null)}</p>
        </div>
        {deltaPct !== null && (
          <p className="sm:col-span-2 text-slate-700">
            Within the synthetic fixture cohort, verified sold prices were{" "}
            <span className="font-semibold">{Math.abs(deltaPct)}%</span>{" "}
            {deltaPct < 0 ? "below" : "above"} initial quoted prices at the
            median.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
