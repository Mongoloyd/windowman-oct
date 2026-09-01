import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ConfidenceResult, QueryFallback } from "@/lib/windowOracle";

type Props = {
  confidence: ConfidenceResult;
  exactMatchCount: number;
  fallbacksApplied: QueryFallback[];
  dateRange: { from: string | null; to: string | null };
  geographyLevel: string;
};

export function OracleConfidenceCard({
  confidence,
  exactMatchCount,
  fallbacksApplied,
  dateRange,
  geographyLevel,
}: Props) {
  return (
    <Card data-testid="oracle-confidence-card" className="overflow-hidden rounded-2xl border-2 border-[#C8BCE9] bg-white shadow-[0_22px_44px_-28px_rgba(62,44,105,0.42),inset_0_1px_0_rgba(255,255,255,0.96)]">
      <CardHeader className="border-b border-[#DED7F2] bg-[#F9F7FF] pb-3">
        <CardTitle className="text-sm font-black">Evidence confidence</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#C8BCE9] bg-[#F4F0FF] px-4 py-3 shadow-inner">
          <span className="font-mono text-2xl font-black tracking-tight text-[#4F378B]">
            {confidence.level}
          </span>
          <Badge variant="outline" className="rounded-md border-[#B8A8E1] bg-white font-mono font-black tabular-nums text-[#4F378B] shadow-sm">{confidence.sampleCount} observations</Badge>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-[#C9D8E8] bg-[#F5F9FD] p-3 shadow-[inset_0_1px_0_white]">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Exact match</p>
            <p className="mt-1 font-mono text-lg font-black tabular-nums text-slate-950">{exactMatchCount}</p>
          </div>
          <div className="rounded-lg border border-[#C9D8E8] bg-[#F5F9FD] p-3 shadow-[inset_0_1px_0_white]">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Geography</p>
            <p className="mt-1 font-mono text-sm font-black uppercase text-slate-950">{geographyLevel}</p>
          </div>
        </div>
        {dateRange.from && dateRange.to && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs font-bold tabular-nums text-slate-700">
            Observation range: {dateRange.from.slice(0, 10)} →{" "}
            {dateRange.to.slice(0, 10)}
          </p>
        )}
        {fallbacksApplied.length > 0 && (
          <div className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
            <p className="font-semibold">Fallbacks applied (not silent)</p>
            {fallbacksApplied.map((f) => (
              <p key={f.code}>
                {f.code}: {f.detail}
              </p>
            ))}
          </div>
        )}
        <details className="overflow-hidden rounded-lg border border-[#C8BCE9] bg-[#FCFBFF] text-xs text-slate-700">
          <summary className="flex min-h-11 cursor-pointer items-center px-3 font-black text-[#4F378B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A92F9]">
            Why this confidence?
          </summary>
          <ul className="space-y-1 border-t border-[#DED7F2] bg-white px-7 py-3 leading-5">
            {confidence.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </details>
      </CardContent>
    </Card>
  );
}
