import { cn } from "@/lib/utils";
import type { LandingIntent } from "./landingTypes";
import {
  handoffToCanonicalUpload,
  handoffToCompareGuidance,
  handoffToFirstQuoteEducation,
  handoffToSystemExplainer,
} from "./landingHandoff";

type RouterCard = {
  id: Exclude<LandingIntent, null>;
  headline: string;
  description: string;
  ctaLabel: string;
  onCta: () => void;
  dominant?: boolean;
  compact?: boolean;
};

const cards: RouterCard[] = [
  {
    id: "quote_ready",
    headline: "I already have a quote.",
    description:
      "Upload your estimate and start with quote intelligence built for scope, pricing, warranty, and risk clarity.",
    ctaLabel: "Analyze My Quote",
    onCta: handoffToCanonicalUpload,
    dominant: true,
  },
  {
    id: "needs_first_quote",
    headline: "I need my first quote.",
    description:
      "Start with guidance on what a strong estimate should include before you talk to contractors.",
    ctaLabel: "Help Me Get My First Quote",
    onCta: handoffToFirstQuoteEducation,
  },
  {
    id: "compare_quotes",
    headline: "I want to compare quotes.",
    description: "Learn how to compare assumptions, not just prices.",
    ctaLabel: "Compare Quote Assumptions",
    onCta: handoffToCompareGuidance,
    compact: true,
  },
  {
    id: "education_mode",
    headline: "I want to learn more.",
    description:
      "See how WindowMan checks scope, product details, warranty terms, payment language, and risk signals.",
    ctaLabel: "Show Me How It Works",
    onCta: handoffToSystemExplainer,
    compact: true,
  },
];

type VisitorIdentityRouterProps = {
  selectedIntent: LandingIntent;
  onSelectIntent: (intent: LandingIntent) => void;
};

export default function VisitorIdentityRouter({
  selectedIntent,
  onSelectIntent,
}: VisitorIdentityRouterProps) {
  const primaryCards = cards.filter((c) => !c.compact);
  const compactCards = cards.filter((c) => c.compact);

  const renderCard = (card: RouterCard) => {
    const isSelected = selectedIntent === card.id;
    const isCompact = card.compact;

    return (
      <article
        key={card.id}
        className={cn(
          "flex flex-col rounded-xl border transition-shadow",
          card.dominant ? "card-raised-hero border-primary/25 shadow-md" : "card-raised",
          isSelected && "ring-2 ring-primary/50",
          isCompact ? "p-4" : "p-5 md:p-6",
        )}
      >
        <button
          type="button"
          onClick={() => onSelectIntent(card.id)}
          className="mb-3 text-left"
          aria-pressed={isSelected}
        >
          <h3
            className={cn(
              "font-display font-bold text-foreground",
              isCompact ? "text-sm leading-snug" : "text-lg",
            )}
          >
            {card.headline}
          </h3>
        </button>
        <p
          className={cn(
            "mb-4 flex-1 leading-relaxed text-muted-foreground",
            isCompact ? "text-xs" : "text-sm",
          )}
        >
          {card.description}
        </p>
        {card.id === "compare_quotes" ? (
          <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
            Guidance only — not live multi-quote analysis.
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => {
            onSelectIntent(card.id);
            card.onCta();
          }}
          className={cn(
            card.dominant ? "btn-depth-primary" : "btn-secondary-tactile",
            "w-full",
          )}
          style={{ padding: isCompact ? "10px 14px" : "12px 20px", fontSize: isCompact ? 13 : 14 }}
        >
          {card.ctaLabel}
        </button>
      </article>
    );
  };

  return (
    <section id="visitor-router" className="border-t border-border px-4 py-14 md:px-8 md:py-20">
      <div className="mx-auto max-w-7xl">
        <p className="wm-eyebrow mb-3 text-primary">CHOOSE YOUR WINDOWMAN PATH</p>
        <h2 className="wm-title-section mb-4 text-foreground">Where are you in the quote process?</h2>
        <p className="mb-10 max-w-3xl wm-body leading-relaxed text-muted-foreground">
          Whether you already have an estimate, need your first one, or are comparing companies,
          WindowMan helps you understand the next smart move before you sign.
        </p>

        <div className="hidden gap-5 md:grid md:grid-cols-2">
          {cards.map((card) => renderCard(card))}
        </div>

        <div className="space-y-4 md:hidden">
          {primaryCards.map((card) => renderCard(card))}
          <div className="grid grid-cols-2 gap-3">
            {compactCards.map((card) => renderCard(card))}
          </div>
        </div>
      </div>
    </section>
  );
}
