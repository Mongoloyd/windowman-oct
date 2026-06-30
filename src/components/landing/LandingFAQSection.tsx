import { handoffToFaq } from "./landingHandoff";

const faqItems = [
  {
    id: "what-is-windowman",
    question: "What is WindowMan?",
    answer:
      "WindowMan provides quote intelligence for Florida homeowners — helping you understand scope, pricing signals, and risk signals before you sign an impact-window contract.",
  },
  {
    id: "is-free",
    question: "Is the quote review free for homeowners?",
    answer:
      "Yes. Uploading your quote and receiving your Truth Report path is free for homeowners. Contractor introductions are optional.",
  },
  {
    id: "verification",
    question: "Why is mobile verification required?",
    answer:
      "Mobile verification protects your full Truth Report and ensures report access stays tied to you — preview first, then verify to unlock.",
  },
  {
    id: "marketplace",
    question: "Is WindowMan a contractor marketplace?",
    answer:
      "No. WindowMan is quote intelligence and homeowner protection — not a lead marketplace or contractor ranking service.",
  },
];

type LandingFAQSectionProps = {
  expandedItems: string[];
  onToggleItem: (itemId: string) => void;
};

export default function LandingFAQSection({ expandedItems, onToggleItem }: LandingFAQSectionProps) {
  return (
    <section id="faq" className="border-t border-border bg-card px-4 py-16 md:px-8 md:py-20">
      <div className="mx-auto max-w-3xl">
        <p className="wm-eyebrow mb-3 text-primary">FAQ</p>
        <h2 className="wm-title-section mb-8 text-foreground">Common questions</h2>
        <div className="space-y-3">
          {faqItems.map((item) => {
            const open = expandedItems.includes(item.id);
            return (
              <div key={item.id} className="card-raised overflow-hidden">
                <button
                  type="button"
                  onClick={() => onToggleItem(item.id)}
                  className="flex w-full items-center justify-between gap-4 p-4 text-left"
                  aria-expanded={open}
                >
                  <span className="font-display text-base font-bold text-foreground">{item.question}</span>
                  <span className="shrink-0 text-muted-foreground">{open ? "−" : "+"}</span>
                </button>
                {open ? (
                  <div className="border-t border-border px-4 pb-4">
                    <p className="text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => handoffToFaq()}
          className="mt-6 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Read FAQ
        </button>
      </div>
    </section>
  );
}
