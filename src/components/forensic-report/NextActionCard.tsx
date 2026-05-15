/**
 * NextActionCard — customer-facing recommended next step.
 * Pure presentation. Buttons accept optional handlers; if none provided,
 * renders as informational (visually secondary) so we don't imply broken wiring.
 */
import { ArrowRight, Phone } from "lucide-react";

interface Props {
  onPrimary?: () => void;
  onSecondary?: () => void;
  primaryLabel?: string;
  secondaryLabel?: string;
}

export default function NextActionCard({
  onPrimary,
  onSecondary,
  primaryLabel = "Get a vetted second opinion",
  secondaryLabel = "Talk to a WindowMan analyst",
}: Props) {
  const primaryDisabled = !onPrimary;

  return (
    <section
      className="fr-card relative overflow-hidden p-6 sm:p-8"
      style={{ borderColor: "hsl(var(--fr-cyan) / 0.4)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 60% at 100% 100%, hsl(var(--fr-cyan) / 0.10), transparent 60%)",
        }}
      />
      <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div className="min-w-0">
          <div className="fr-mono text-[11px] font-bold tracking-wider uppercase text-[hsl(var(--fr-cyan))] mb-1">
            Recommended Next Step
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-[hsl(var(--fr-text))] leading-tight">
            Want WindowMan to help you get a cleaner quote?
          </h2>
          <p className="mt-1.5 text-sm text-[hsl(var(--fr-text-muted))] max-w-xl">
            We'll route your file to a vetted, county-matched installer for a transparent re-quote — no obligation.
          </p>
        </div>
        <div className="flex flex-col sm:items-end gap-2 sm:min-w-[260px]">
          <button
            type="button"
            disabled={primaryDisabled}
            onClick={onPrimary}
            className="fr-cta-primary w-full sm:w-auto inline-flex items-center justify-center gap-2"
          >
            {primaryLabel}
            <ArrowRight size={16} />
          </button>
          <button
            type="button"
            onClick={onSecondary}
            className="text-xs sm:text-sm text-[hsl(var(--fr-text-muted))] hover:text-[hsl(var(--fr-text))] inline-flex items-center gap-1.5 transition-colors"
          >
            <Phone size={12} />
            {secondaryLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
