/**
 * NextActionCard — Advisor-mode final verdict and recommended next move.
 * Pure presentation. Buttons accept optional handlers; if none provided,
 * renders as informational (visually secondary) so we don't imply broken wiring.
 */
import { ArrowRight, Printer } from "lucide-react";

interface Props {
  onPrimary?: () => void;
  onSecondary?: () => void;
  primaryLabel?: string;
  secondaryLabel?: string;
}

export default function NextActionCard({
  onPrimary,
  onSecondary,
  primaryLabel = "Get a Same-Scope Second Opinion",
  secondaryLabel = "Show Me My Safest Next Move",
}: Props) {
  const primaryDisabled = !onPrimary;
  const secondaryDisabled = !onSecondary;

  return (
    <section
      className="fr-card relative overflow-hidden p-6 sm:p-8"
      style={{
        borderColor: "hsl(var(--fr-cyan) / 0.4)",
        background:
          "linear-gradient(165deg, hsl(var(--fr-surface) / 0.95) 0%, hsl(var(--fr-bg) / 0.88) 100%)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 60% at 100% 100%, hsl(var(--fr-cyan) / 0.10), transparent 60%)",
        }}
      />
      <div className="relative flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white"
            style={{
              background:
                "linear-gradient(180deg, hsl(var(--fr-cyan) / 0.85), hsl(var(--fr-cyan) / 0.5))",
              boxShadow: "0 2px 10px hsl(var(--fr-cyan) / 0.3)",
            }}
            aria-hidden
          >
            WM
          </div>
          <div className="min-w-0 flex-1">
            <div className="fr-mono text-[11px] font-bold tracking-wider uppercase text-[hsl(var(--fr-cyan))] mb-1">
              WindowMan&apos;s Recommended Next Move
            </div>
            <p className="text-sm sm:text-base text-[hsl(var(--fr-text-muted))] max-w-2xl leading-relaxed">
              Do not compare this quote by price alone. Use the same scope, same openings, same install
              expectations, and clearer terms.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
          <button
            type="button"
            disabled={primaryDisabled}
            onClick={onPrimary}
            className="fr-cta-primary w-full sm:w-auto inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-[0_4px_16px_hsl(var(--fr-cyan)/0.22)] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {primaryLabel}
            <ArrowRight size={16} />
          </button>
          <button
            type="button"
            disabled={secondaryDisabled}
            onClick={onSecondary}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md border border-[hsl(var(--fr-border))] bg-[hsl(var(--fr-surface)/0.6)] px-4 py-2.5 text-sm font-medium text-[hsl(var(--fr-text))] backdrop-blur-sm transition-colors hover:border-[hsl(var(--fr-cyan)/0.35)] hover:bg-[hsl(var(--fr-surface)/0.85)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {secondaryLabel}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="text-xs sm:text-sm text-[hsl(var(--fr-text-muted))] hover:text-[hsl(var(--fr-text))] inline-flex items-center justify-center gap-1.5 transition-colors py-2"
          >
            <Printer size={12} />
            Save This Report
          </button>
        </div>
      </div>
    </section>
  );
}
