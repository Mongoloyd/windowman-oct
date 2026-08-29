import { useMemo, useState } from "react";
import { Beaker, RotateCcw, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  computeGrade,
  RUBRIC_VERSION,
} from "../../../../supabase/functions/scan-quote/scoring.ts";
import { GOLDEN_FIXTURES } from "../fixtures/goldenFixtures";
import {
  collectCanonicalHardCaps,
  compareRubricVersions,
  createDefaultHardCapSettings,
  type HardCapSettings,
} from "../rubricVersionSimulator";
import type { ExperimentalWeights } from "../scoringPlaygroundModel";
import { FixtureDeltaCard } from "./FixtureDeltaCard";
import { VersionDiffMatrix } from "./VersionDiffMatrix";

interface GoldenRegressionStudioProps {
  weights: ExperimentalWeights;
}

const HARD_CAP_IDS = collectCanonicalHardCaps(GOLDEN_FIXTURES);
const DEFAULT_HARD_CAP_SETTINGS = createDefaultHardCapSettings(GOLDEN_FIXTURES);

function SummaryMetric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-[#0d1219] p-4">
      <p className="text-xs uppercase tracking-wider text-slate-600">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

export function GoldenRegressionStudio({ weights }: GoldenRegressionStudioProps) {
  const [enabledHardCaps, setEnabledHardCaps] = useState<HardCapSettings>(() => ({
    ...DEFAULT_HARD_CAP_SETTINGS,
  }));
  const [selectedFixtureId, setSelectedFixtureId] = useState(GOLDEN_FIXTURES[0].id);

  const suite = useMemo(
    () =>
      compareRubricVersions(GOLDEN_FIXTURES, computeGrade, {
        weights,
        enabledHardCaps,
      }),
    [enabledHardCaps, weights],
  );
  const selectedComparison =
    suite.comparisons.find((comparison) => comparison.fixture.id === selectedFixtureId) ??
    suite.comparisons[0];

  const toggleHardCap = (cap: string, enabled: boolean) => {
    setEnabledHardCaps((current) => ({ ...current, [cap]: enabled }));
  };

  return (
    <section className="mt-8 space-y-5" aria-labelledby="golden-regression-title">
      <Card className="border-blue-500/25 bg-gradient-to-br from-blue-500/[0.08] to-[#11161e] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.045),0_20px_60px_rgba(0,0,0,0.24)]">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-blue-400/30 bg-blue-500/10 text-blue-300">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 id="golden-regression-title" className="text-xl font-bold text-slate-50">
                    Golden Fixture Regression Studio
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Canonical rubric {RUBRIC_VERSION} versus a hypothetical in-memory configuration.
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-400">
                Goldens are pinned human-reviewed expectations. The simulator uses the pillar weights above and can only suppress already-triggered canonical cap predicates.
              </p>
            </div>
            <Badge variant="outline" className="border-amber-400/40 bg-amber-400/[0.07] px-3 py-2 text-amber-200">
              <Beaker className="mr-2 h-4 w-4" />
              Hypothetical local simulation — not production scoring
            </Badge>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryMetric label="Golden integrity" value={`${suite.summary.goldenIntegrityPasses}/${suite.summary.total}`} tone={suite.summary.goldenIntegrityPasses === suite.summary.total ? "text-emerald-300" : "text-rose-300"} />
            <SummaryMetric label="Regression passes" value={`${suite.summary.experimentalPasses}/${suite.summary.total}`} tone={suite.summary.experimentalPasses === suite.summary.total ? "text-emerald-300" : "text-amber-200"} />
            <SummaryMetric label="Regressions" value={String(suite.summary.regressions)} tone={suite.summary.regressions === 0 ? "text-emerald-300" : "text-rose-300"} />
            <SummaryMetric label="Unavailable" value={String(suite.summary.unavailable)} tone={suite.summary.unavailable === 0 ? "text-slate-300" : "text-amber-200"} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-800/90 bg-[#11161e] text-slate-100">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Canonical hard-cap predicates</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Turning a predicate off affects only the hypothetical run. It cannot force an untriggered cap or change canonical output.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEnabledHardCaps({ ...DEFAULT_HARD_CAP_SETTINGS })}
              className="min-h-12 border-slate-700 bg-transparent text-slate-100 hover:bg-slate-800 hover:text-white focus-visible:ring-blue-400"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset Cap Toggles
            </Button>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {HARD_CAP_IDS.map((cap) => (
              <div key={cap} className="flex min-h-14 items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-950/45 px-3 py-2">
                <Label htmlFor={`golden-cap-${cap}`} className="cursor-pointer font-mono text-xs text-slate-300">
                  {cap}
                </Label>
                <Switch
                  id={`golden-cap-${cap}`}
                  aria-label={`Include ${cap} in hypothetical simulation`}
                  checked={enabledHardCaps[cap] !== false}
                  onCheckedChange={(enabled) => toggleHardCap(cap, enabled)}
                  className="data-[state=checked]:bg-blue-500"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <VersionDiffMatrix
        suite={suite}
        selectedFixtureId={selectedFixtureId}
        onSelectFixture={setSelectedFixtureId}
      />
      <FixtureDeltaCard comparison={selectedComparison} />
    </section>
  );
}
