/**
 * PriceRiskClarificationCard — resolves the "low price looks safe" paradox.
 *
 * Renders only when the quote is priced low for the area but the report still
 * carries risk (weak grade or red/amber flags). Pure presentation; self-gating.
 */
import { ShieldAlert } from "lucide-react";

type PriceBand = "low" | "market" | "high" | "extreme" | null | undefined;

interface Props {
  grade: string;
  pricePerOpeningBand?: PriceBand;
  flagRedCount?: number | null;
  flagAmberCount?: number | null;
  marketLow?: number | null;
  marketHigh?: number | null;
}

const WEAK_GRADES = new Set(["C", "D", "F"]);

export function shouldShowPriceRiskClarification({
  grade,
  pricePerOpeningBand,
  flagRedCount,
  flagAmberCount,
}: Pick<Props, "grade" | "pricePerOpeningBand" | "flagRedCount" | "flagAmberCount">): boolean {
  if (pricePerOpeningBand !== "low") return false;
  const reds = flagRedCount ?? 0;
  const ambers = flagAmberCount ?? 0;
  const gradeUpper = (grade ?? "").trim().toUpperCase();
  if (WEAK_GRADES.has(gradeUpper) || reds > 0) return true;
  if (ambers >= 2) return true;
  return false;
}

const BULLETS: { lead: string; body: string }[] = [
  {
    lead: "Your grade is based on quote safety, not just price.",
    body: "WindowMan is checking whether the estimate is complete enough to sign.",
  },
  {
    lead: "Missing scope can erase the savings.",
    body: "Permits, product specs, labor exclusions, or change-order rules can turn a cheap quote into a costly one.",
  },
  {
    lead: "The next quote should fix the gaps.",
    body: "Use this report to ask for clearer scope, safer terms, and pricing that does not hide surprises.",
  },
];

export default function PriceRiskClarificationCard(props: Props) {
  if (!shouldShowPriceRiskClarification(props)) return null;

  const hasMarketRange = props.marketLow != null && props.marketHigh != null;

  return (
    <section
      className="fr-card relative overflow-hidden p-5 sm:p-6"
      style={{ borderColor: "hsl(var(--fr-caution) / 0.45)" }}
      aria-labelledby="price-risk-heading"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(80% 60% at 100% 0%, hsl(var(--fr-caution) / 0.12), transparent 60%)",
        }}
      />
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert size={14} className="text-[hsl(var(--fr-caution))]" />
          <span className="fr-mono text-[11px] font-bold tracking-wider uppercase text-[hsl(var(--fr-caution))]">
            Price vs. Quote Safety
          </span>
        </div>
        <h2
          id="price-risk-heading"
          className="text-base sm:text-lg font-bold text-[hsl(var(--fr-text))] mb-4"
        >
          A low upfront price can still become an expensive project.
        </h2>

        <ul className="space-y-3">
          {BULLETS.map((bullet) => (
            <li key={bullet.lead} className="text-sm leading-relaxed text-[hsl(var(--fr-text-muted))]">
              <span className="font-semibold text-[hsl(var(--fr-text))]">{bullet.lead}</span>{" "}
              {bullet.body}
            </li>
          ))}
        </ul>

        {hasMarketRange && (
          <p className="mt-4 rounded-lg border border-[hsl(var(--fr-caution)/0.35)] bg-[hsl(var(--fr-caution)/0.08)] px-4 py-3 text-xs sm:text-sm text-[hsl(var(--fr-text-muted))] leading-relaxed">
            Your installed price per opening appears below the typical local range. That may be a good
            deal — or a sign that required work is missing. Do not treat it as safe until the gaps are
            confirmed in writing.
          </p>
        )}
      </div>
    </section>
  );
}
