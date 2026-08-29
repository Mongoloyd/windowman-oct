import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PillarScores } from "../../../../supabase/functions/scan-quote/scoring.ts";
import type { FixtureRubricComparison } from "../rubricVersionSimulator";

interface FixtureDeltaCardProps {
  comparison: FixtureRubricComparison;
}

const PILLARS: Array<{ key: keyof PillarScores; label: string }> = [
  { key: "safety", label: "Safety" },
  { key: "install", label: "Install" },
  { key: "price", label: "Price" },
  { key: "finePrint", label: "Fine Print" },
  { key: "warranty", label: "Warranty" },
];

function CapList({ values, empty }: { values: readonly string[]; empty: string }) {
  return values.length ? (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <Badge key={value} variant="outline" className="border-slate-700 text-slate-300">
          {value}
        </Badge>
      ))}
    </div>
  ) : (
    <p className="text-xs text-slate-600">{empty}</p>
  );
}

export function FixtureDeltaCard({ comparison }: FixtureDeltaCardProps) {
  const expected = comparison.fixture.expected_results;
  const canonical = comparison.canonical.kind === "scored" ? comparison.canonical : null;
  const experimental =
    comparison.experimental.kind === "ready" ? comparison.experimental.result : null;

  return (
    <Card className="border-slate-800/90 bg-[#11161e] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_18px_45px_rgba(0,0,0,0.22)]">
      <CardHeader className="border-b border-slate-800">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Diff Inspector · {comparison.fixture.label}</CardTitle>
            <p className="mt-2 text-xs text-slate-500">
              Source {comparison.fixture.provenance.sourceFixtureKey} · captured at{" "}
              {comparison.fixture.provenance.capturedAtCommit.slice(0, 8)} ·{" "}
              {comparison.fixture.provenance.inputFingerprint}
            </p>
          </div>
          <Badge
            variant="outline"
            className={
              comparison.goldenIntegrity.pass
                ? "border-emerald-500/40 text-emerald-300"
                : "border-rose-500/45 text-rose-300"
            }
          >
            {comparison.goldenIntegrity.pass ? (
              <CheckCircle2 className="mr-1 h-3 w-3" />
            ) : (
              <AlertTriangle className="mr-1 h-3 w-3" />
            )}
            {comparison.goldenIntegrity.pass ? "Golden intact" : "Golden drift"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-5">
        {!comparison.goldenIntegrity.pass ? (
          <div className="rounded-md border border-rose-500/35 bg-rose-500/[0.07] p-4" role="alert">
            <p className="flex items-center gap-2 text-sm font-semibold text-rose-200">
              <ShieldAlert className="h-4 w-4" />
              Simulation suppressed: reviewed baseline drifted
            </p>
            <p className="mt-2 text-xs text-rose-200/75">
              {comparison.goldenIntegrity.issues.join(", ")}. Update goldens only through a reviewed scoring change.
            </p>
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3">
          {[
            {
              label: "Pinned expectation",
              grade: expected.kind === "scored" ? expected.baselineGrade : "Terminal",
              score: expected.kind === "scored" ? expected.weightedScore.toFixed(2) : "—",
            },
            {
              label: "Canonical observed",
              grade: canonical?.result.letterGrade ?? "Terminal",
              score: canonical?.result.weightedAverage.toFixed(2) ?? "—",
            },
            {
              label: "Hypothetical experiment",
              grade: experimental?.finalGrade ?? "Suppressed",
              score: experimental?.weightedScore.toFixed(2) ?? "—",
            },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-slate-800 bg-[#0d1219] p-4">
              <p className="text-xs uppercase tracking-wider text-slate-600">{item.label}</p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <span className="text-3xl font-bold text-blue-300">{item.grade}</span>
                <span className="font-mono text-sm text-slate-300">{item.score}</span>
              </div>
            </div>
          ))}
        </div>

        {expected.kind === "scored" && canonical ? (
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Side-by-side pillar math
            </p>
            <div className="overflow-hidden rounded-lg border border-slate-800">
              <div className="grid grid-cols-[1fr_repeat(3,minmax(70px,0.55fr))] bg-slate-950/70 px-4 py-3 text-xs text-slate-500">
                <span>Pillar</span>
                <span className="text-right">Expected</span>
                <span className="text-right">Canonical</span>
                <span className="text-right">Experiment input</span>
              </div>
              {PILLARS.map(({ key, label }) => (
                <div
                  key={key}
                  className="grid grid-cols-[1fr_repeat(3,minmax(70px,0.55fr))] border-t border-slate-800 px-4 py-3 text-sm"
                >
                  <span className="text-slate-300">{label}</span>
                  <span className="text-right font-mono text-slate-300">
                    {expected.pillarBreakdown[key]}
                  </span>
                  <span className="text-right font-mono text-slate-300">
                    {canonical.result.pillarScores[key]}
                  </span>
                  <span className="text-right font-mono text-blue-300">
                    {canonical.trace.pillarScores[key]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Pinned triggered caps
            </p>
            <CapList
              values={expected.kind === "scored" ? expected.triggeredHardCaps : []}
              empty="No caps in the reviewed baseline"
            />
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Experimental triggered caps
            </p>
            <CapList values={experimental?.triggeredHardCaps ?? []} empty="No enabled caps triggered" />
          </div>
        </div>

        {(comparison.delta.newlyTriggeredHardCaps.length > 0 ||
          comparison.delta.clearedHardCaps.length > 0) && experimental ? (
          <div className="grid gap-4 rounded-lg border border-amber-400/25 bg-amber-400/[0.05] p-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold text-amber-200">New vs baseline</p>
              <CapList values={comparison.delta.newlyTriggeredHardCaps} empty="None" />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-amber-200">Cleared by local toggle</p>
              <CapList values={comparison.delta.clearedHardCaps} empty="None" />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
