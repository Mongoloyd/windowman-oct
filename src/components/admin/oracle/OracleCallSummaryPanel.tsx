import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OracleCallSummary } from "@/lib/windowOracle";

type Props = {
  summary: OracleCallSummary | null;
};

export function OracleCallSummaryPanel({ summary }: Props) {
  if (!summary) {
    return (
      <Card data-testid="oracle-call-summary">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Call summary</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          Enter a homeowner PPO and search to generate a phone-call script.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="oracle-call-summary">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Call summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {summary.scriptLines.map((line) => (
          <p key={line} className="text-slate-800">
            {line}
          </p>
        ))}
        {summary.approvedInterpretation && (
          <p className="rounded-md border border-slate-200 bg-slate-50 p-2 text-slate-800 italic">
            {summary.approvedInterpretation}
          </p>
        )}
        <p className="text-xs text-slate-500">
          Never claim guaranteed install price or that the homeowner is being
          ripped off.
        </p>
      </CardContent>
    </Card>
  );
}
