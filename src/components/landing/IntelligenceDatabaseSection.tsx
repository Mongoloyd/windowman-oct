import { cn } from "@/lib/utils";
import { landingContainerWide, landingSectionPad } from "./landingTypes";

const signals = [
  {
    title: "Scope patterns",
    body: "How installers describe removal, disposal, trim, and opening counts across Florida quotes.",
  },
  {
    title: "Pricing signals",
    body: "Context for line-item structure — not a guaranteed savings promise.",
  },
  {
    title: "Missing scope",
    body: "Common gaps in permit language, product approvals, and warranty coverage.",
  },
  {
    title: "Risk signals",
    body: "Patterns that warrant clarification before you sign.",
  },
];

export default function IntelligenceDatabaseSection() {
  return (
    <section id="intelligence-database" className={cn("bg-background", landingSectionPad)}>
      <div className={landingContainerWide}>
        <p className="wm-eyebrow mb-3 text-primary">Quote-intelligence database</p>
        <h2 className="wm-title-section mb-4 text-foreground">
          Market signals built from real quote patterns
        </h2>
        <p className="mb-10 max-w-3xl text-base leading-relaxed text-muted-foreground">
          WindowMan maintains a quote-intelligence database of scope patterns and market signals to
          help homeowners compare quotes with more context — educational tone, not surveillance.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {signals.map((signal) => (
            <div key={signal.title} className="card-raised p-5">
              <h3 className="mb-2 font-display text-base font-bold text-foreground">{signal.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{signal.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
