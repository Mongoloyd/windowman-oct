import SectionEyebrow from "./SectionEyebrow";
import SectionHeading from "./SectionHeading";
import SkeuoCard from "./SkeuoCard";

const cards = [
  {
    title: "Quality Becomes Visible",
    body: "When scope and materials are exposed, a stronger quote no longer has to lose to a weaker one just because the paperwork was more confusing.",
    icon: "🔨",
  },
  {
    title: "Less Friction",
    body: "Better-informed homeowners make faster, cleaner decisions. Less guesswork means fewer bad expectations and more productive sales conversations.",
    icon: "⚖️",
  },
  {
    title: "Junk Competition Weakens",
    body: "WindowMan rewards structural clarity and punishes vague, padded, or low-information quoting. That helps honest contractors compete without playing the same games.",
    icon: "🛡️",
  },
];

export default function ContractorBenefitSection() {
  return (
    <section className="relative overflow-hidden px-6 py-16 md:px-8 md:py-24" style={{ background: "transparent" }}>
      {/* Depth L1 — soft blue radial, right side */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          top: "5%",
          right: "-10%",
          width: "55%",
          height: "85%",
          background: "radial-gradient(ellipse at 65% 40%, rgba(30,80,180,0.08) 0%, transparent 70%)",
          filter: "blur(44px)",
        }}
      />
      <div className="relative mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="mb-12 text-center md:mb-16">
          <SectionEyebrow className="mb-4">THE PRO-MARKET STANCE</SectionEyebrow>
          <SectionHeading className="mb-6">
            Good Contractors Are Tired of Losing to Confusion.
          </SectionHeading>
          <p className="mx-auto max-w-3xl text-base leading-relaxed text-foreground/80 md:text-lg">
            Contractors who price fairly, define scope clearly, and stand behind
            their work benefit from a market where structure is visible. WindowMan
            removes the camouflage that vague contracts and weak comparisons rely
            on.
          </p>
        </div>

        {/* 3-Card Grid */}
        <div className="mb-10 grid gap-8 md:grid-cols-3">
          {cards.map((card) => (
            <SkeuoCard key={card.title} className="flex flex-col gap-4">
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                style={{ background: "#e0f7fa", color: "#06B6D4" }}
                aria-hidden="true"
              >
                <span className="text-base font-bold">{card.icon}</span>
              </div>
              <h3 className="font-display text-xl font-bold tracking-tight text-foreground">
                {card.title}
              </h3>
              <p className="text-base leading-relaxed text-foreground/70">
                {card.body}
              </p>
            </SkeuoCard>
          ))}
        </div>

        {/* Bottom Note */}
        <p className="text-center text-base font-semibold italic text-foreground/60 md:text-lg">
          This system is not anti-contractor. It is anti-confusion.
        </p>
      </div>
    </section>
  );
}
