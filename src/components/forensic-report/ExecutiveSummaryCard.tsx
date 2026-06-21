/**
 * ExecutiveSummaryCard — grade dial + confidence bar + flag counts + overpayment range.
 * Mirrors the top card in both reference mockups (preview shows same layout).
 */
import { createContext, useContext } from "react";
import GradeDial from "./GradeDial";

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
}: Props) {
  const onDiagnosisCta = useContext(ForensicDiagnosisCtaContext);
  const conf = Math.max(0, Math.min(100, Math.round(confidenceScore ?? 0)));

  const hasPositiveOverpayment =
    (overpaymentLow ?? 0) > 0 || (overpaymentHigh ?? 0) > 0;
  const hasMarketBenchmark = marketLow != null || marketHigh != null;

  let heroMetricLabel: string;
  if (hasPositiveOverpayment) {
    heroMetricLabel = "Estimated Overpayment";
  } else if (hasMarketBenchmark) {
    heroMetricLabel = "Benchmark Result";
  } else {
    heroMetricLabel = "Benchmark Status";
  }

  return (
    <section
      className="fr-card p-5 sm:p-6"
      style={{ borderColor: "hsl(var(--fr-cyan) / 0.35)" }}
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
              <div className="mt-1 font-mono text-2xl font-extrabold text-[hsl(var(--fr-danger))] leading-tight">
                {overpaymentLow != null && overpaymentHigh != null ? (
                  <>
                    {fmtMoney(overpaymentLow)}{" "}
                    <span className="text-[hsl(var(--fr-text-dim))] text-lg">–</span>
                  </>
                ) : (
                  fmtMoney(overpaymentLow ?? overpaymentHigh)
                )}
              </div>
              {overpaymentLow != null && overpaymentHigh != null && (
                <div className="font-mono text-2xl font-extrabold text-[hsl(var(--fr-danger))] leading-tight">
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
            <div className="mt-1 text-base font-semibold text-[hsl(var(--fr-text-muted))] leading-snug max-w-[200px]">
              {hasMarketBenchmark ? "No confirmed overpayment" : "Needs market benchmark"}
            </div>
          )}
        </div>
      </div>

      {onDiagnosisCta ? (
        <div
          className="mt-5 pt-4 border-t"
          style={{ borderColor: "hsl(var(--fr-border) / 0.6)" }}
        >
          <button
            type="button"
            onClick={onDiagnosisCta}
            className="group w-full text-left rounded-xl border-2 border-[hsl(25_95%_53%)] bg-gradient-to-br from-[hsl(var(--fr-cyan))] to-[hsl(217_91%_43%)] px-4 py-3.5 shadow-[0_2px_8px_hsl(var(--fr-cyan)/0.22),inset_0_1px_0_hsl(0_0%_100%/0.14)] transition-[transform,filter,box-shadow] duration-150 hover:brightness-[1.03] hover:shadow-[0_4px_12px_hsl(var(--fr-cyan)/0.28),inset_0_1px_0_hsl(0_0%_100%/0.18)] active:scale-[0.98]"
          >
            <span className="block text-sm font-semibold text-white">
              WindowMan&apos;s next move is ready →
            </span>
            <span className="mt-1 block text-xs text-white/90 leading-snug">
              Use this report to compare your quote against a cleaner same-scope option.
            </span>
          </button>
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
