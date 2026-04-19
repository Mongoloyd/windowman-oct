import SectionEyebrow from "./SectionEyebrow";
import SectionHeading from "./SectionHeading";
import SkeuoCard from "./SkeuoCard";

export default function TransparencyShiftSection() {
  return (
    <section className="relative overflow-hidden px-6 py-16 md:px-8 md:py-24" style={{ background: "transparent" }}>
      {/* Depth L1 — blue radial, upper left */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          top: "-15%",
          left: "-5%",
          width: "60%",
          height: "85%",
          background: "radial-gradient(ellipse at 30% 35%, rgba(30,80,180,0.09) 0%, rgba(56,130,220,0.04) 50%, transparent 72%)",
          filter: "blur(42px)",
        }}
      />
      <div className="relative mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="mb-12 text-center md:mb-16">
          <SectionEyebrow className="mb-4">THE NEW NORMAL</SectionEyebrow>
          <SectionHeading className="mb-6">
            When the Lights Go On, the Games Stop.
          </SectionHeading>
          <p className="mx-auto max-w-3xl text-base leading-relaxed text-foreground/80 md:text-lg">
            Homeowners stop signing blind and getting screwed. But just as
            important, good contractors win too. Honest companies are tired of
            losing jobs to competitors who hide cheap materials and weak scope
            inside confusing contracts. We fix the market for everyone who plays
            fair.
          </p>
        </div>

        {/* 2-column winner cards */}
        <div className="mb-10 grid gap-6 md:grid-cols-2">
          {/* Homeowners Win */}
          <SkeuoCard className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <span
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-lg"
                style={{ background: "#e0f7fa", color: "#06B6D4" }}
                aria-hidden="true"
              >
                🏠
              </span>
              <h3 className="font-display text-xl font-bold tracking-tight text-foreground">
                Homeowners Win
              </h3>
            </div>
            <p className="text-base leading-relaxed text-foreground/75">
              They stop guessing from a total price. They get visibility into
              the real structure of the quote, stronger negotiation leverage,
              and a better chance of signing a deal that actually holds up.
            </p>
            <ul className="space-y-2 pt-2">
              {[
                "Quote structure is visible before signing",
                "Negotiation leverage improves",
                "Weak scope is flagged early",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full"
                    style={{ background: "#06B6D4" }}
                    aria-hidden="true"
                  />
                  <span className="text-sm text-foreground/70">{item}</span>
                </li>
              ))}
            </ul>
          </SkeuoCard>

          {/* Good Contractors Win */}
          <SkeuoCard className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <span
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-lg"
                style={{ background: "#f0fdf4", color: "#16a34a" }}
                aria-hidden="true"
              >
                ✅
              </span>
              <h3 className="font-display text-xl font-bold tracking-tight text-foreground">
                Good Contractors Win
              </h3>
            </div>
            <p className="text-base leading-relaxed text-foreground/75">
              They no longer have to compete only against confusion tactics.
              When the scope becomes visible, quality and honesty become easier
              to prove.
            </p>
            <ul className="space-y-2 pt-2">
              {[
                "Honest scope stands out clearly",
                "Quality work is easier to demonstrate",
                "Competing on confusion becomes harder",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full"
                    style={{ background: "#16a34a" }}
                    aria-hidden="true"
                  />
                  <span className="text-sm text-foreground/70">{item}</span>
                </li>
              ))}
            </ul>
          </SkeuoCard>
        </div>

        {/* Closing statement */}
        <p className="text-center text-base font-semibold italic text-foreground/60 md:text-lg">
          The goal is not more noise. The goal is a smoother market with less
          room for bullshit.
        </p>
      </div>
    </section>
  );
}
