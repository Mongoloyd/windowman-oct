import { cn } from "@/lib/utils";
import { landingContainerWide, landingSectionPad } from "./landingTypes";

const steps = [
  {
    title: "Quote Document",
    body: "Your impact-window estimate — PDF or photo — is the starting point.",
  },
  {
    title: "Data Extraction",
    body: "Product details, labor scope, permits, warranty, and payment language are pulled from the document.",
  },
  {
    title: "Quote Normalization",
    body: "Line items and terms are organized into comparable scope patterns and structure.",
  },
  {
    title: "Market Signals",
    body: "Patterns from the quote-intelligence database add context on pricing and scope norms.",
  },
  {
    title: "Risk Indicators",
    body: "Missing scope, vague terms, and uneven assumptions surface as plain-English risk signals.",
  },
  {
    title: "Truth Report",
    body: "A homeowner-readable summary of what matters — and what to ask before you sign.",
  },
];

export default function SystemExplainerSection() {
  return (
    <section
      id="system-explainer"
      className={cn("border-t border-border bg-card", landingSectionPad)}
    >
      <div className={landingContainerWide}>
        <p className="wm-eyebrow mb-3 text-primary">How WindowMan works</p>
        <h2 className="wm-title-section mb-4 text-foreground">From quote document to Truth Report</h2>
        <p className="mb-10 max-w-3xl text-base leading-relaxed text-muted-foreground">
          A quote by itself is hard to judge. WindowMan breaks it into the parts that actually matter:
          product details, labor scope, permit language, payment terms, warranty, exclusions, and pricing
          structure. Then those details become plain-English quote intelligence.
        </p>

        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {steps.map((step, index) => (
            <li key={step.title} className="card-raised relative p-4 md:p-5">
              <span className="mb-2 block font-mono text-[10px] font-semibold uppercase tracking-widest text-primary">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mb-2 font-display text-sm font-bold leading-snug text-foreground">
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              {index < steps.length - 1 ? (
                <span
                  className="absolute -right-2 top-1/2 hidden -translate-y-1/2 text-primary/40 xl:block"
                  aria-hidden="true"
                >
                  →
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
