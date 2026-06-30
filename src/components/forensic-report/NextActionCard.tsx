/**
 * NextActionCard — Advisor-mode final verdict and recommended next move.
 * Pure presentation. Buttons accept optional handlers; if none provided,
 * renders as informational (visually secondary) so we don't imply broken wiring.
 */
import { ArrowRight } from "lucide-react";

interface Props {
  onPrimary?: () => void;
  onSecondary?: () => void;
  primaryLabel?: string;
  secondaryLabel?: string;
}

export default function NextActionCard({
  onPrimary,
  onSecondary,
  primaryLabel = "Show My Best Next Move",
  secondaryLabel = "Build My Quote Defense Plan",
}: Props) {
  const primaryDisabled = !onPrimary;
  const secondaryDisabled = !onSecondary;

  return (
    <section
      className="fr-card relative overflow-hidden p-6 sm:p-8"
      style={{
        borderColor: "hsl(var(--fr-cyan) / 0.55)",
        background:
          "linear-gradient(165deg, hsl(var(--fr-surface)) 0%, hsl(var(--fr-surface-2)) 100%)",
        boxShadow: "0 4px 24px -8px hsl(218 40% 2% / 0.65), inset 0 1px 0 hsl(0 0% 100% / 0.06)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(70% 60% at 100% 100%, hsl(var(--fr-cyan) / 0.08), transparent 60%)",
        }}
      />
      <div className="relative flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white"
            style={{
              background:
                "linear-gradient(180deg, hsl(var(--fr-cyan) / 0.95), hsl(var(--fr-cyan) / 0.65))",
              boxShadow: "0 2px 10px hsl(var(--fr-cyan) / 0.35)",
            }}
            aria-hidden
          >
            WM
          </div>
          <div className="min-w-0 flex-1">
            <div className="fr-mono text-[11px] font-bold tracking-wider uppercase text-[hsl(var(--fr-cyan-soft))] mb-1.5">
              WindowMan&apos;s Recommended Next Move
            </div>
            <p className="text-sm sm:text-base text-[hsl(var(--fr-text))] max-w-2xl leading-relaxed">
              Your scan is complete. The next step turns this report into a plan — urgency, timeline,
              and what you want WindowMan to do before you sign.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-stretch sm:justify-end gap-3">
          <button
            type="button"
            disabled={primaryDisabled}
            onClick={onPrimary}
            className="fr-cta-primary w-full sm:w-auto inline-flex items-center justify-center gap-2 text-white active:scale-[0.98] transition-transform shadow-[0_4px_16px_hsl(var(--fr-cyan)/0.35)] disabled:bg-[hsl(var(--fr-cyan)/0.55)] disabled:text-white/80 disabled:opacity-100 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {primaryLabel}
            <ArrowRight size={16} />
          </button>
          <button
            type="button"
            disabled={secondaryDisabled}
            onClick={onSecondary}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md border border-[hsl(var(--fr-border-strong))] bg-[hsl(var(--fr-surface-2))] px-4 py-3 text-sm font-semibold text-[hsl(var(--fr-text))] transition-colors hover:border-[hsl(var(--fr-cyan)/0.45)] hover:bg-[hsl(var(--fr-surface-2)/0.92)] active:scale-[0.98] disabled:border-[hsl(var(--fr-border))] disabled:bg-[hsl(var(--fr-surface)/0.9)] disabled:text-[hsl(var(--fr-text)/0.75)] disabled:opacity-100 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {secondaryLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
