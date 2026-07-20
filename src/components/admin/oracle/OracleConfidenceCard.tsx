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
    <Card data-testid="oracle-confidence-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Confidence</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-slate-900">
            {confidence.level}
          </span>
          <Badge variant="outline">{confidence.sampleCount} observations</Badge>
        </div>
        <p className="text-sm text-slate-700">
          Exact match: {exactMatchCount} · Geography: {geographyLevel}
        </p>
        {dateRange.from && dateRange.to && (
          <p className="text-xs text-slate-600">
            Observation range: {dateRange.from.slice(0, 10)} →{" "}
            {dateRange.to.slice(0, 10)}
          </p>
        )}
        {fallbacksApplied.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-950 space-y-1">
            <p className="font-semibold">Fallbacks applied (not silent)</p>
            {fallbacksApplied.map((f) => (
              <p key={f.code}>
                {f.code}: {f.detail}
              </p>
            ))}
          </div>
        )}
        <details className="text-xs text-slate-600">
          <summary className="cursor-pointer font-medium">
            Why this confidence?
          </summary>
          <ul className="mt-1 list-disc pl-4 space-y-0.5">
            {confidence.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </details>
      </CardContent>
    </Card>
  );
}
