import { cn } from "@/lib/utils";
import {
  landingContainerMid,
  landingSectionPad,
} from "./landingTypes";

const trustCards = [
  {
    title: "Not a contractor",
    body: "WindowMan does not sell or install windows directly.",
  },
  {
    title: "Good quotes can pass",
    body: "The goal is clarity, not criticism. Strong quotes should be recognized as strong.",
  },
  {
    title: "You control next steps",
    body: "Contractor help only happens if you ask for it.",
  },
  {
    title: "Sample content is labeled",
    body: "Public report examples are representative, not personalized findings.",
  },
];

const doesItems = [
  "Analyzes quote assumptions",
  "Explains scope and risk signals",
  "Helps you ask better questions",
  "May help you request a better estimate if you ask",
];

const doesNotItems = [
  "Sell windows directly",
  "Guarantee savings",
  "Provide legal or engineering advice",
  "Say every contractor is dishonest",
  "Send your quote to random contractors without your consent",
];

export default function TrustCredibilitySection() {
  return (
    <section
      id="trust-credibility"
      className={cn("border-t border-border bg-background", landingSectionPad)}
    >
      <div className={landingContainerMid}>
        <p className="wm-eyebrow mb-3 text-primary">TRUST RULES</p>
        <h2 className="wm-title-section mb-4 text-foreground">Clear rules. No contractor pressure.</h2>
        <p className="mb-10 max-w-3xl text-base leading-relaxed text-muted-foreground">
          WindowMan is built to help homeowners understand quotes, not to pressure them into signing
          with anyone.
        </p>

        <blockquote className="card-raised-hero mb-10 border-l-4 border-l-primary/40 p-6 md:p-8">
          <p className="text-sm leading-relaxed text-foreground md:text-base">
            I am not here to tell you every contractor is bad. I am here to help you understand your
            quote before you sign it. If your estimate is strong and the scope is clear, WindowMan
            should say that. If something is vague, missing, or worth questioning, the report should
            show you where to look.
          </p>
          <footer className="mt-4 text-sm font-semibold text-muted-foreground">— Sam Glass, WindowMan</footer>
        </blockquote>

        <div className="mb-10 grid gap-4 sm:grid-cols-2">
          {trustCards.map((card) => (
            <div key={card.title} className="card-raised p-5">
              <h3 className="mb-2 font-display text-base font-bold text-foreground">{card.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{card.body}</p>
            </div>
          ))}
        </div>

        <div className="mb-10 grid gap-5 md:grid-cols-2">
          <div className="card-raised p-5 md:p-6">
            <h3 className="mb-4 font-display text-lg font-bold text-foreground">WindowMan Does</h3>
            <ul className="space-y-2.5">
              {doesItems.map((item) => (
                <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/70"
                    aria-hidden="true"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="card-raised p-5 md:p-6">
            <h3 className="mb-4 font-display text-lg font-bold text-foreground">WindowMan Does Not</h3>
            <ul className="space-y-2.5">
              {doesNotItems.map((item) => (
                <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50"
                    aria-hidden="true"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="card-raised mb-6 p-5 md:p-6">
          <h3 className="mb-3 font-display text-base font-bold text-foreground">Why is this free?</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            WindowMan starts with free quote help because education builds trust. If you later ask for
            help getting a better estimate, WindowMan may support that request. You are not required to
            use any contractor, and you stay in control of the next step.
          </p>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Your quote is used to create your analysis. If you ask for help getting a better estimate, we
          only share what is needed to support that request.
        </p>
      </div>
    </section>
  );
}
