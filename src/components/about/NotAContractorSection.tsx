import SectionEyebrow from "./SectionEyebrow";
import SectionHeading from "./SectionHeading";
import SkeuoCard from "./SkeuoCard";

const identityCards = [
  {
    label: "Not a Contractor",
    body: "We do not profit by installing the job.",
    accent: "bg-slate-200",
  },
  {
    label: "Not a Blind Directory",
    body: "We are not a generic list of names or form-fill marketplace.",
    accent: "bg-slate-200",
  },
  {
    label: "Not a Surface-Level Comparison",
    body: "We do not reduce contract intelligence to price alone.",
    accent: "bg-slate-200",
  },
  {
    label: "An Intelligence Layer",
    body: "We sit between quote confusion and informed action.",
    accent: "bg-cyan-500",
  },
];

export default function NotAContractorSection() {
  return (
    <section className="relative overflow-hidden px-6 py-16 md:px-8 md:py-24" style={{ background: "transparent" }}>
      {/* Depth L1 — soft blue radial, centered */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          top: "-10%",
          left: "15%",
          width: "70%",
          height: "110%",
          background:
            "radial-gradient(ellipse at 50% 45%, rgba(30,80,180,0.07) 0%, rgba(56,130,220,0.03) 55%, transparent 72%)",
          filter: "blur(50px)",
        }}
      />
      <div className="relative mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="mb-12 text-center md:mb-16">
          <SectionEyebrow className="mb-4">OUR ROLE</SectionEyebrow>
          <SectionHeading className="mb-6">WindowMan Is Not the Contractor. It's the Layer Between.</SectionHeading>
          <p className="mx-auto max-w-3xl text-base leading-relaxed text-foreground/80 md:text-lg">
            We Do Not Install Windows. We Do Not Operate As A Generic Lead Marketplace. We Function As An Independent
            Intelligence Layer Designed To Bring More Visibility To One Of The Least Standardized Decisions In Home
            Improvement.
          </p>
        </div>

        {/* Identity Card Grid */}
        <div className="mb-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {identityCards.map((card) => (
            <SkeuoCard key={card.label} className="flex flex-col">
              <span className={`mb-4 inline-block h-1.5 w-8 rounded-full ${card.accent}`} aria-hidden="true" />
              <h3 className="mb-3 font-display text-lg font-bold tracking-tight text-foreground">{card.label}</h3>
              <p className="text-sm leading-relaxed text-foreground/70 font-medium">{card.body}</p>
            </SkeuoCard>
          ))}
        </div>

        {/* Closing Statement */}
        <p className="text-center font-display text-lg font-semibold tracking-tight text-foreground/60 md:text-xl">
          The Goal Is Not More Noise. The Goal Is Better Visibility Before Commitment.
        </p>
      </div>
    </section>
  );
}
