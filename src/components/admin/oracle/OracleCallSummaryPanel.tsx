import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OracleCallSummary } from "@/lib/windowOracle";

type Props = {
  summary: OracleCallSummary | null;
};

export function OracleCallSummaryPanel({ summary }: Props) {
  if (!summary) {
    return (
      <Card data-testid="oracle-call-summary" className="overflow-hidden rounded-2xl border-2 border-[#B8CAE0] bg-white shadow-[0_22px_44px_-28px_rgba(7,28,62,0.42),inset_0_1px_0_rgba(255,255,255,0.96)]">
        <CardHeader className="border-b border-[#D6E1EE] bg-[#F6F9FD] pb-3">
          <CardTitle className="text-sm font-black">Operator call summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div role="status" className="rounded-xl border border-dashed border-amber-400 bg-amber-50 p-5 text-sm font-black text-amber-950">
            INSUFFICIENT_DATA · Select a synthetic homeowner PPO and run the local fixture query to generate an operator script.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="oracle-call-summary" className="overflow-hidden rounded-2xl border-2 border-[#B8CAE0] bg-white shadow-[0_22px_44px_-28px_rgba(7,28,62,0.42),inset_0_1px_0_rgba(255,255,255,0.96)]">
      <CardHeader className="border-b border-[#D6E1EE] bg-[#F6F9FD] pb-3">
        <CardTitle className="text-sm font-black">Operator call summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-5 text-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          {summary.scriptLines.map((line, index) => (
            <div key={line} className="grid grid-cols-[28px_1fr] items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 shadow-[inset_0_1px_0_white]">
              <span className="flex h-7 w-7 items-center justify-center rounded-md border border-[#AFC7E3] bg-white font-mono text-[10px] font-black text-[#356AC3]">{String(index + 1).padStart(2, "0")}</span>
              <p className="font-semibold leading-5 text-slate-800">{line}</p>
            </div>
          ))}
        </div>
        {summary.approvedInterpretation && (
          <div className="rounded-xl border-2 border-[#AFC7E3] bg-[#EEF5FF] p-4 shadow-inner">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#356AC3]">Approved synthetic interpretation</p>
            <p className="mt-2 font-semibold leading-6 text-slate-800 italic">{summary.approvedInterpretation}</p>
          </div>
        )}
        <p className="border-t border-slate-200 pt-3 text-xs font-semibold leading-5 text-slate-600">
          Never claim guaranteed install price or that the homeowner is being
          ripped off.
        </p>
      </CardContent>
    </Card>
  );
}
