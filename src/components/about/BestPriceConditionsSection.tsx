import SectionEyebrow from "./SectionEyebrow";
import SectionHeading from "./SectionHeading";

const conditionCards = [
  {
    number: "01",
    title: "We Expose Weak Quotes",
    body: "If a quote is vague, padded, or structurally weak, the homeowner sees it before they sign.",
    accentColor: "#06B6D4",
    accentBg: "#e0f7fa",
  },
  {
    number: "02",
    title: "We Normalize Comparison",
    body: "Once the quote is translated into comparable structure, price stops being a guessing game.",
    accentColor: "#1e3a5f",
    accentBg: "#e8edf4",
  },
  {
    number: "03",
    title: "We Create Competitive Pressure",
    body: "When contractors know the quote is being evaluated through WindowMan, they are more likely to come sharper, cleaner, and more disciplined.",
    accentColor: "#f97316",
    accentBg: "#fff7ed",
  },
];

export default function BestPriceConditionsSection() {
  return (
    <section className="relative overflow-hidden px-6 py-16 md:px-8 md:py-24" style={{ background: "transparent" }}>
      {/* Depth L1 — soft blue, right */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          top: "-5%",
          right: "-8%",
          width: "55%",
          height: "90%",
          background: "radial-gradient(ellipse at 65% 40%, rgba(30,80,180,0.08) 0%, transparent 70%)",
          filter: "blur(42px)",
        }}
      />
      <div className="relative mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="mb-12 text-center md:mb-16">
          <SectionEyebrow className="mb-4">
            How You Get Better Pricing
          </SectionEyebrow>
          <SectionHeading className="mb-6">
            No One Can Promise the Best Price Every Time. We Can Create the
            Conditions That Make Better Prices Far More Likely.
          </SectionHeading>
          <p className="mx-auto max-w-3xl text-base leading-relaxed text-foreground/80 md:text-lg">
            By exposing weak scope, flagging inflated pricing, and making
            contractors compete in the light, WindowMan helps homeowners get
            cleaner and more competitive offers than they would usually get on
            their own.
          </p>
        </div>

        {/* 3-card row */}
        <div className="mb-10 grid gap-6 md:grid-cols-3">
          {conditionCards.map((card) => (
            <div
              key={card.number}
              className="flex flex-col rounded-2xl bg-white p-7 border-double border-4 border-[#07b6d5]"
              style={{
                boxShadow:
                  "0 2px 4px rgba(15,30,60,0.05), 0 8px 28px rgba(15,30,60,0.09)",
              }}
            >
              {/* Number badge */}
              <div
                className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg font-mono text-sm font-bold"
                style={{
                  background: card.accentBg,
                  color: card.accentColor,
                }}
              >
                {card.number}
              </div>

              {/* Accent line */}
              <div
                className="mb-4 h-1 w-8 rounded-full"
                style={{ background: card.accentColor }}
                aria-hidden="true"
              />

              <h3 className="mb-3 font-display text-lg font-bold tracking-tight text-foreground">
                {card.title}
              </h3>
              <p className="text-sm leading-relaxed text-foreground/70">
                {card.body}
              </p>
            </div>
          ))}
        </div>

        {/* Bottom credibility note */}
        <p className="text-center text-sm italic text-foreground/60">
          We do not sell fantasy savings. We build better negotiating
          conditions.
        </p>
      </div>
    </section>
  );
}
