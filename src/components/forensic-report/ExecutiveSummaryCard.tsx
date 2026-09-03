/**
 * ExecutiveSummaryCard — grade dial + confidence bar + flag counts + overpayment range.
 * Mirrors the top card in both reference mockups (preview shows same layout).
 */
import { createContext, useContext } from "react";
import GradeDial from "./GradeDial";
import { deriveExecutiveSummaryVisual } from "./visualState";

export const ForensicDiagnosisCtaContext = createContext<(() => void) | null>(null);

interface Props {
  grade: string;
  confidenceScore: number | null;
  signalsExtracted?: number | null;
  signalsTotal?: number | null;
  flagRedCount: number;
  flagAmberCount: number;
  flagClearCount?: number;
  overpaymentLow?: number | null;
  overpaymentHigh?: number | null;
  overpaymentBasis?: string | null;
  marketLow?: number | null;
  marketHigh?: number | null;
  pricePerOpeningBand?: "low" | "market" | "high" | "extreme" | null;
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

export default function ExecutiveSummaryCard({
  grade,
  confidenceScore,
  signalsExtracted,
  signalsTotal,
  flagRedCount,
  flagAmberCount,
  flagClearCount,
  overpaymentLow,
  overpaymentHigh,
  overpaymentBasis,
  marketLow,
  marketHigh,
  pricePerOpeningBand,
}: Props) {
  const onDiagnosisCta = useContext(ForensicDiagnosisCtaContext);
  const conf = Math.max(0, Math.min(100, Math.round(confidenceScore ?? 0)));

  const hasPositiveOverpayment =
    (overpaymentLow ?? 0) > 0 || (overpaymentHigh ?? 0) > 0;
  const hasMarketBenchmark = marketLow != null || marketHigh != null;

  const gradeUpper = (grade ?? "").trim().toUpperCase();
  const weakGrade = gradeUpper === "C" || gradeUpper === "D" || gradeUpper === "F";
  const hasRiskContext = weakGrade || (flagRedCount ?? 0) > 0;
  const isLowBand = pricePerOpeningBand === "low";

  let benchmarkStatusText: string;
  if (isLowBand) {
    benchmarkStatusText = hasRiskContext
      ? "Below market range — verify what is missing"
      : "Below market range — verify scope in writing";
  } else if (hasMarketBenchmark) {
    benchmarkStatusText = "Within local range — contract terms still matter";
  } else {
    benchmarkStatusText = "Needs market benchmark";
  }

  let heroMetricLabel: string;
  if (hasPositiveOverpayment) {
    heroMetricLabel = "Estimated Overpayment";
  } else if (hasMarketBenchmark) {
    heroMetricLabel = "Benchmark Result";
  } else {
    heroMetricLabel = "Benchmark Status";
  }

  const sectionVisual = deriveExecutiveSummaryVisual({
    grade,
    flagRedCount,
    overpaymentLow,
    overpaymentHigh,
  });

  return (
    <section
      className="fr-card p-5 sm:p-6"
      style={{
        borderColor: "hsl(var(--fr-border))",
        boxShadow: "var(--fr-elev-1)",
      }}
    >
      <h2 className="fr-mono text-[11px] font-bold text-[hsl(var(--fr-cyan))] mb-5">
        ▦ VERDICT AT A GLANCE
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto_auto] gap-6 md:gap-8 items-center">
        {/* Grade dial */}
        <GradeDial grade={grade} />

        {/* Confidence + signals */}
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[hsl(var(--fr-text))]">Confidence Score</div>
          <div className="mt-1 text-lg font-bold text-[hsl(var(--fr-text))]">
            {conf}% <span className="text-xs font-normal text-[hsl(var(--fr-text-muted))]">Signal Coverage</span>
          </div>
          <div
            className="mt-2 h-1.5 w-full rounded-full overflow-hidden"
            style={{ background: "hsl(var(--fr-border))" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${conf}%`,
                background: "hsl(var(--fr-cyan))",
                boxShadow: "0 0 8px hsl(var(--fr-cyan) / 0.6)",
              }}
            />
          </div>
          {signalsExtracted != null && signalsTotal != null && (
            <div className="mt-3 text-xs text-[hsl(var(--fr-text-muted))]">
              <span className="block fr-mono text-[10px]">Signals Extracted</span>
              <span className="font-mono text-sm font-bold text-[hsl(var(--fr-text))]">
                {signalsExtracted} <span className="text-[hsl(var(--fr-text-dim))]">of {signalsTotal}</span>
              </span>
            </div>
          )}
        </div>

        {/* Flag counts */}
        <div className="space-y-1.5 text-sm">
          <FlagRow color="hsl(var(--fr-danger))" label="Critical Flags" count={flagRedCount} />
          <FlagRow color="hsl(var(--fr-caution))" label="Warnings" count={flagAmberCount} />
          {flagClearCount != null && (
            <FlagRow color="hsl(var(--fr-success))" label="Clear" count={flagClearCount} />
          )}
        </div>

        {/* Hero metric: overpayment or benchmark status */}
        <div className="min-w-0">
          <div className="text-xs text-[hsl(var(--fr-text-muted))]">{heroMetricLabel}</div>
          {hasPositiveOverpayment ? (
            <>
              <div className={`mt-1 ${sectionVisual.valueClass} text-base sm:text-lg font-semibold text-[hsl(var(--fr-caution))] leading-tight`}>
                {overpaymentLow != null && overpaymentHigh != null ? (
                  <>
                    {fmtMoney(overpaymentLow)}{" "}
                    <span className="text-[hsl(var(--fr-text-dim))] text-sm">–</span>
                  </>
                ) : (
                  fmtMoney(overpaymentLow ?? overpaymentHigh)
                )}
              </div>
              {overpaymentLow != null && overpaymentHigh != null && (
                <div className={`${sectionVisual.valueClass} text-base sm:text-lg font-semibold text-[hsl(var(--fr-caution))] leading-tight`}>
                  {fmtMoney(overpaymentHigh)}
                </div>
              )}
              {overpaymentBasis && (
                <div className="mt-1.5 text-[10px] text-[hsl(var(--fr-text-dim))] leading-snug max-w-[200px]">
                  {overpaymentBasis}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="mt-1 text-base font-semibold text-[hsl(var(--fr-text-muted))] leading-snug max-w-[200px]">
                {benchmarkStatusText}
              </div>
              <div className="mt-1.5 text-[10px] text-[hsl(var(--fr-text-dim))] leading-snug max-w-[200px]">
                The grade reflects quote safety — not price alone.
              </div>
            </>
          )}
        </div>
      </div>

      {onDiagnosisCta ? (
        <div
          className="mt-5 pt-4 border-t"
          style={{ borderColor: "hsl(var(--fr-border) / 0.6)" }}
        >
          {/* Low-emphasis microcopy only — the Better Quote bridge below is the single dominant early CTA. */}
          <p className="text-sm text-slate-400">
            Next step: answer 5 quick questions so WindowMan can help you get a better quote.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function FlagRow({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ background: color, boxShadow: `0 0 6px ${color}` }}
      />
      <span className="text-[hsl(var(--fr-text-muted))] text-xs">{label}</span>
      <span className="ml-auto font-mono font-bold" style={{ color }}>
        {count}
      </span>
    </div>
  );
}
