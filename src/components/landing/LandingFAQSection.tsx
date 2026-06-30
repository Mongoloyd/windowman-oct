import { useState } from "react";
import { cn } from "@/lib/utils";
import type { LandingFaqItem } from "./landingTypes";
import {
  handoffToCanonicalUpload,
  handoffToFirstQuoteEducation,
} from "./landingHandoff";
import {
  landingContainerNarrow,
  landingCtaMinH,
  landingFocusRing,
  landingSectionPad,
} from "./landingTypes";

const topFaqItems: LandingFaqItem[] = [
  {
    id: "contractor",
    question: "Are you a window contractor?",
    answer:
      "No. WindowMan does not sell or install windows directly. WindowMan helps homeowners understand quotes, scope, pricing signals, warranty language, and questions worth asking before they sign.",
    voice: "brand",
  },
  {
    id: "why-free",
    question: "Why is this free?",
    answer:
      "I built WindowMan this way because education builds trust. If the free review helps you understand your quote, you may later ask WindowMan for help getting a better estimate. That step is optional. You are not required to use any contractor.",
    voice: "sam",
  },
  {
    id: "uploaded-quote",
    question: "What happens to my uploaded quote?",
    answer:
      "Your quote is used to create your analysis. WindowMan may use anonymized, aggregated quote patterns to improve the quote-intelligence system, but your personal quote file is not treated as a public contractor handout.",
    voice: "brand",
  },
  {
    id: "after-upload",
    question: "What happens after I upload?",
    answer:
      "The quote is reviewed for scope, product details, payment terms, warranty language, pricing signals, and risk indicators. You may see a safe preview first. Full personalized report access may require mobile verification.",
    voice: "brand",
  },
  {
    id: "no-quote",
    question: "What if I do not have a quote yet?",
    answer:
      "You can still use WindowMan. Start with first-quote guidance so you know what a strong estimate should include before you talk to contractors.",
    voice: "brand",
  },
  {
    id: "good-quote",
    question: "What if my quote is actually good?",
    answer:
      "Then the report should say that. WindowMan is not built to make every quote look bad. It is built to make the quote clearer.",
    voice: "brand",
  },
];

const moreFaqItems: LandingFaqItem[] = [
  {
    id: "compare-multiple",
    question: "Can I compare multiple quotes?",
    answer:
      "You can upload and review quotes one at a time. WindowMan helps you understand assumptions in each estimate so you can compare more fairly — educational guidance, not live side-by-side analysis on this page.",
    voice: "brand",
  },
  {
    id: "legal-advice",
    question: "Is this legal advice?",
    answer:
      "No. WindowMan provides educational quote intelligence to help you ask better questions. It is not legal advice.",
    voice: "brand",
  },
  {
    id: "engineering-advice",
    question: "Is this engineering or code-compliance advice?",
    answer:
      "No. WindowMan does not certify code compliance, engineering suitability, or permitting outcomes. It highlights quote language and scope signals worth clarifying.",
    voice: "brand",
  },
  {
    id: "sent-to-contractors",
    question: "Will my quote be sent to contractors?",
    answer:
      "Not without your consent. Contractor help only happens if you ask for it. WindowMan does not broadcast your quote to random contractors.",
    voice: "brand",
  },
  {
    id: "mobile-verification",
    question: "Why is mobile verification required?",
    answer:
      "Mobile verification helps protect full report access and reduces spam or automated use. It is part of the reveal process for personalized report access.",
    voice: "brand",
  },
  {
    id: "pressure-after-verify",
    question: "Will I be pressured after verifying?",
    answer:
      "No contractor pressure is the goal. Verification unlocks your personalized report path — it does not obligate you to hire anyone or accept contractor outreach you did not request.",
    voice: "brand",
  },
];

type LandingFAQSectionProps = {
  expandedItems: string[];
  onToggleItem: (itemId: string) => void;
};

function faqTriggerId(itemId: string): string {
  return `faq-trigger-${itemId}`;
}

function faqPanelId(itemId: string): string {
  return `faq-panel-${itemId}`;
}

function FaqAccordionItem({
  item,
  open,
  onToggle,
}: {
  item: LandingFaqItem;
  open: boolean;
  onToggle: () => void;
}) {
  const triggerId = faqTriggerId(item.id);
  const panelId = faqPanelId(item.id);

  return (
    <div className="card-raised overflow-hidden">
      <button
        id={triggerId}
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full min-h-[56px] items-center justify-between gap-4 p-4 text-left",
          landingFocusRing,
        )}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span className="font-display text-base font-bold text-foreground">{item.question}</span>
        <span className="shrink-0 text-muted-foreground" aria-hidden="true">
          {open ? "−" : "+"}
        </span>
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={triggerId}
        hidden={!open}
        className="border-t border-border px-4 pb-4"
      >
        <p className="pt-3 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
      </div>
    </div>
  );
}

export default function LandingFAQSection({ expandedItems, onToggleItem }: LandingFAQSectionProps) {
  const [moreQuestionsOpen, setMoreQuestionsOpen] = useState(false);

  return (
    <section id="faq" className={cn("border-t border-border bg-card", landingSectionPad)}>
      <div className={landingContainerNarrow}>
        <p className="wm-eyebrow mb-3 text-primary">COMMON QUESTIONS</p>
        <h2 className="wm-title-section mb-4 text-foreground">
          Straight answers before you upload anything.
        </h2>
        <p className="mb-10 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          WindowMan should feel clear before you ever send a document.
        </p>

        <div className="space-y-3">
          {topFaqItems.map((item) => (
            <FaqAccordionItem
              key={item.id}
              item={item}
              open={expandedItems.includes(item.id)}
              onToggle={() => onToggleItem(item.id)}
            />
          ))}
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={() => setMoreQuestionsOpen((prev) => !prev)}
            className={cn(
              "mb-3 flex w-full min-h-[48px] items-center justify-between rounded-lg border border-dashed border-border px-4 py-3 text-left text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5",
              landingFocusRing,
            )}
            aria-expanded={moreQuestionsOpen}
          >
            More questions
            <span className="text-muted-foreground" aria-hidden="true">
              {moreQuestionsOpen ? "−" : "+"}
            </span>
          </button>
          {moreQuestionsOpen ? (
            <div className="space-y-3">
              {moreFaqItems.map((item) => (
                <FaqAccordionItem
                  key={item.id}
                  item={item}
                  open={expandedItems.includes(item.id)}
                  onToggle={() => onToggleItem(item.id)}
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-border pt-8 sm:flex-row">
          <button
            type="button"
            onClick={() => handoffToCanonicalUpload()}
            className={cn(
              "btn-depth-primary w-full px-7 py-3.5 text-[15px] sm:w-auto",
              landingCtaMinH,
              landingFocusRing,
            )}
          >
            Analyze My Quote
          </button>
          <button
            type="button"
            onClick={() => handoffToFirstQuoteEducation()}
            className={cn(
              "btn-secondary-tactile w-full px-7 py-3.5 text-[15px] sm:w-auto",
              landingCtaMinH,
              landingFocusRing,
            )}
          >
            Help Me Get My First Quote
          </button>
        </div>
      </div>
    </section>
  );
}
