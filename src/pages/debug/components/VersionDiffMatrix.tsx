import { AlertTriangle, CheckCircle2, MinusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type {
  FixtureRubricComparison,
  RubricComparisonSuite,
} from "../rubricVersionSimulator";

interface VersionDiffMatrixProps {
  suite: RubricComparisonSuite;
  selectedFixtureId: string;
  onSelectFixture: (fixtureId: string) => void;
}

function statusFor(comparison: FixtureRubricComparison) {
  if (!comparison.goldenIntegrity.pass) {
    return {
      label: "Baseline drift",
      icon: AlertTriangle,
      className: "border-rose-500/45 bg-rose-500/[0.08] text-rose-200",
    };
  }
  if (comparison.experimental.kind === "unavailable") {
    return {
      label: "Unavailable",
      icon: MinusCircle,
      className: "border-amber-400/40 bg-amber-400/[0.07] text-amber-200",
    };
  }
  if (comparison.regressionPass) {
    return {
      label: "Pass",
      icon: CheckCircle2,
      className: "border-emerald-500/40 bg-emerald-500/[0.07] text-emerald-200",
    };
  }
  return {
    label: "Regression",
    icon: AlertTriangle,
    className: "border-rose-500/45 bg-rose-500/[0.08] text-rose-200",
  };
}

export function VersionDiffMatrix({
  suite,
  selectedFixtureId,
  onSelectFixture,
}: VersionDiffMatrixProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Golden fixture regression matrix">
      {suite.comparisons.map((comparison) => {
        const status = statusFor(comparison);
        const StatusIcon = status.icon;
        const selected = comparison.fixture.id === selectedFixtureId;
        const expected = comparison.fixture.expected_results;
        const experimental =
          comparison.experimental.kind === "ready" ? comparison.experimental.result : null;

        return (
          <button
            key={comparison.fixture.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelectFixture(comparison.fixture.id)}
            className={`min-h-44 rounded-lg border p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070a0f] ${
              selected
                ? "border-blue-400/70 bg-blue-500/[0.09]"
                : "border-slate-800 bg-[#0d1219] hover:border-slate-700"
            }`}
            data-testid={`golden-fixture-${comparison.fixture.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-100">{comparison.fixture.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {comparison.fixture.description}
                </p>
              </div>
              <Badge variant="outline" className={`shrink-0 ${status.className}`}>
                <StatusIcon className="mr-1 h-3 w-3" />
                {status.label}
              </Badge>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-800 pt-3 text-xs">
              <div>
                <p className="text-slate-600">Expected</p>
                <p className="mt-1 font-semibold text-slate-200">
                  {expected.kind === "scored" ? expected.baselineGrade : "Terminal"}
                </p>
              </div>
              <div>
                <p className="text-slate-600">Experiment</p>
                <p className="mt-1 font-semibold text-slate-200">
                  {experimental?.finalGrade ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-slate-600">Δ score</p>
                <p
                  className={`mt-1 font-semibold ${
                    comparison.delta.scoreDelta === 0 ? "text-emerald-300" : "text-amber-200"
                  }`}
                >
                  {comparison.delta.scoreDelta === null
                    ? "—"
                    : `${comparison.delta.scoreDelta > 0 ? "+" : ""}${comparison.delta.scoreDelta.toFixed(2)}`}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
