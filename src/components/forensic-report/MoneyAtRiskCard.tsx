/**
 * MoneyAtRiskCard — high-impact "Why should I care?" module for full-reveal.
 * Renders only when overpayment data exists. Pure presentation.
 */
import { TrendingUp } from "lucide-react";

interface Props {
  overpaymentLow?: number | null;
  overpaymentHigh?: number | null;
  overpaymentBasis?: string | null;
  totalContractPrice?: number | null;
  marketLow?: number | null;
  marketHigh?: number | null;
}

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

export default function MoneyAtRiskCard({
  overpaymentLow,
  overpaymentHigh,
  overpaymentBasis,
  totalContractPrice,
  marketLow,
  marketHigh,
}: Props) {
  if (overpaymentLow == null && overpaymentHigh == null) return null;

  const range =
    overpaymentLow != null && overpaymentHigh != null
      ? `${fmt(overpaymentLow)} – ${fmt(overpaymentHigh)}`
      : fmt(overpaymentLow ?? overpaymentHigh);

  const pct =
    totalContractPrice && overpaymentHigh
      ? Math.round((overpaymentHigh / totalContractPrice) * 100)
      : null;

  return (
    <section
      className="fr-card relative overflow-hidden p-6 sm:p-8"
      style={{ borderColor: "hsl(var(--fr-danger) / 0.4)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(80% 60% at 100% 0%, hsl(var(--fr-danger) / 0.14), transparent 60%)",
        }}
      />
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp size={14} className="text-[hsl(var(--fr-danger))]" />
          <span className="fr-mono text-[11px] font-bold tracking-wider uppercase text-[hsl(var(--fr-danger))]">
            Money at Risk
          </span>
        </div>
        <h2 className="text-base sm:text-lg font-bold text-[hsl(var(--fr-text))] mb-4">
          Estimated overpayment vs. local market
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-end">
          <div>
            <div className="font-mono text-4xl sm:text-5xl font-black leading-none text-[hsl(var(--fr-danger))] tracking-tight">
              {range}
            </div>
            {overpaymentBasis && (
              <p className="mt-3 text-xs sm:text-sm text-[hsl(var(--fr-text-muted))] leading-relaxed max-w-xl">
                {overpaymentBasis}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-1 gap-2 md:min-w-[200px]">
            {totalContractPrice != null && (
              <div className="fr-tile p-3">
                <div className="text-[10px] fr-mono uppercase tracking-wider text-[hsl(var(--fr-text-dim))]">
                  Contract Total
                </div>
                <div className="mt-1 font-mono text-lg font-bold text-[hsl(var(--fr-text))]">
                  {fmt(totalContractPrice)}
                </div>
              </div>
            )}
            {pct != null && (
              <div className="fr-tile fr-tile--critical p-3">
                <div className="text-[10px] fr-mono uppercase tracking-wider text-[hsl(var(--fr-text-dim))]">
                  Of Quote
                </div>
                <div className="mt-1 font-mono text-lg font-bold text-[hsl(var(--fr-danger))]">
                  ~{pct}%
                </div>
              </div>
            )}
            {marketLow != null && marketHigh != null && totalContractPrice == null && (
              <div className="fr-tile p-3">
                <div className="text-[10px] fr-mono uppercase tracking-wider text-[hsl(var(--fr-text-dim))]">
                  Market Range
                </div>
                <div className="mt-1 font-mono text-sm font-bold text-[hsl(var(--fr-text))]">
                  {fmt(marketLow)}–{fmt(marketHigh)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
