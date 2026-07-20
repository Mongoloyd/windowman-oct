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
  return (
    <Card data-testid="oracle-contractor-table">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          Contractor observations (WindowMan-observed)
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-600 border-b">
              <th className="py-2 pr-3">Contractor</th>
              <th className="py-2 pr-3">Quotes</th>
              <th className="py-2 pr-3">Verified sold</th>
              <th className="py-2 pr-3">Median quoted PPO</th>
              <th className="py-2 pr-3">Median sold PPO</th>
              <th className="py-2">Tier</th>
            </tr>
          </thead>
          <tbody>
            {contractors.map((row) => (
              <tr key={row.contractorKey} className="border-b border-slate-50">
                <td className="py-2 pr-3">{row.contractorLabel}</td>
                <td className="py-2 pr-3 tabular-nums">{row.quoteCount}</td>
                <td className="py-2 pr-3 tabular-nums">{row.verifiedSoldCount}</td>
                <td className="py-2 pr-3 tabular-nums">{money(row.medianQuotedPpo)}</td>
                <td className="py-2 pr-3 tabular-nums">{money(row.medianSoldPpo)}</td>
                <td className="py-2">
                  <Badge variant="outline">{row.pricingTierLabel}</Badge>
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
