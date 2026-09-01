import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ContractorBenchmark } from "@/lib/windowOracle";

type Props = {
  contractors: ContractorBenchmark[];
};

function money(n: number | null): string {
  if (n === null) return "—";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function OracleContractorTable({ contractors }: Props) {
  const maxQuotedPpo = Math.max(1, ...contractors.map((row) => row.medianQuotedPpo ?? 0));

  return (
    <Card data-testid="oracle-contractor-table" className="overflow-hidden rounded-2xl border-2 border-[#B8CAE0] bg-white shadow-[0_22px_44px_-28px_rgba(7,28,62,0.42),inset_0_1px_0_rgba(255,255,255,0.96)]">
      <CardHeader className="border-b border-[#D6E1EE] bg-[#F6F9FD] pb-3">
        <CardTitle className="text-sm font-black">
          Contractor observations (synthetic fixture)
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto pt-4">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b-2 border-slate-200 bg-slate-50 text-left text-[11px] font-black uppercase tracking-[0.06em] text-slate-600">
              <th className="px-3 py-3">Contractor</th>
              <th className="px-3 py-3">Quotes</th>
              <th className="px-3 py-3">Verified sold</th>
              <th className="px-3 py-3">Median quoted PPO</th>
              <th className="px-3 py-3">Median sold PPO</th>
              <th className="px-3 py-3">Tier</th>
            </tr>
          </thead>
          <tbody>
            {contractors.map((row) => (
              <tr key={row.contractorKey} className="border-b border-slate-200 transition-colors last:border-0 hover:bg-[#F7FAFE]">
                <td className="px-3 py-3 font-bold text-slate-900">{row.contractorLabel}</td>
                <td className="px-3 py-3 font-mono font-bold tabular-nums">{row.quoteCount}</td>
                <td className="px-3 py-3 font-mono font-bold tabular-nums">{row.verifiedSoldCount}</td>
                <td className="min-w-44 px-3 py-3 font-mono font-bold tabular-nums">
                  <span>{money(row.medianQuotedPpo)}</span>
                  {row.medianQuotedPpo !== null ? (
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
                      <span className="block h-full rounded-full bg-[#4A92F9]" style={{ width: `${Math.max(4, (row.medianQuotedPpo / maxQuotedPpo) * 100)}%` }} />
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-3 font-mono font-bold tabular-nums">{money(row.medianSoldPpo)}</td>
                <td className="px-3 py-3">
                  <Badge variant="outline" className="rounded-md border-slate-300 bg-white font-mono font-bold shadow-sm">{row.pricingTierLabel}</Badge>
                </td>
              </tr>
            ))}
            {contractors.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-slate-600">
                  No contractor observations in this cohort.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
