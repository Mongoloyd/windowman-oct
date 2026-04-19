import SectionEyebrow from "./SectionEyebrow";
import SectionHeading from "./SectionHeading";
import ArbitrageEngine from "@/components/arbitrageengine";

export default function ArbitrageEngineSection() {
  return (
    <section className="relative overflow-hidden px-6 py-16 md:px-8 md:py-24" style={{ background: "transparent" }}>
      {/* Depth L1 — blue radial field, left (mechanism 01 side) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          top: "-5%",
          left: "-8%",
          width: "55%",
          height: "90%",
          background:
            "radial-gradient(ellipse at 30% 45%, rgba(6,182,212,0.09) 0%, rgba(30,80,180,0.07) 45%, transparent 70%)",
          filter: "blur(44px)",
        }}
      />
      {/* Depth L2 — orange underglow, right (arbitrage/pressure side) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          bottom: "5%",
          right: "-8%",
          width: "50%",
          height: "75%",
          background:
            "radial-gradient(ellipse at 70% 65%, rgba(249,115,22,0.07) 0%, rgba(234,88,12,0.04) 45%, transparent 70%)",
          filter: "blur(50px)",
        }}
      />
      <div className="relative mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="mb-12 text-center md:mb-16">
          <SectionEyebrow className="mb-4">THE SECRET WEAPON</SectionEyebrow>
          <SectionHeading className="mb-6">
            We See Everyone's Homework. That's How We Force Better Prices.
          </SectionHeading>
          <p className="mx-auto max-w-3xl text-base leading-relaxed text-foreground/80 md:text-lg">
            Because We Process Thousands of Quotes, We Know Exactly Where The Fat is Hidden. When Contractors Know
            They're Quoting Against the WindowMan Engine, They Stop Playing Games. They Give You Their Best, Cleanest
            Price Because They Know They Can't Hide Bloated Margins in the Fine Print.
          </p>
        </div>

        {/* Two heavyweight cards */}
        <div className="mb-8 grid gap-6 md:grid-cols-2">
          {/* Card 1 */}
          <div
            className="flex flex-col rounded-2xl bg-white p-8 md:p-10 border-double border-4 border-[#07b6d5] shadow-2xl"
            style={{
              boxShadow:
                "0 4px 8px rgba(10,25,60,0.09), 0 16px 48px rgba(10,25,60,0.14), 0 0 0 1px rgba(6,182,212,0.08), inset 0 1px 0 rgba(255,255,255,0.95)",
            }}
          >
            <div className="mb-6 flex items-center gap-3">
              <span
                className="inline-block h-1.5 w-10 rounded-full"
                style={{ background: "#06B6D4" }}
                aria-hidden="true"
              />
              <span className="font-mono tracking-[0.12em] text-muted-foreground font-semibold text-xs">MECHANISM 01</span>
            </div>
            <h3 className="mb-4 font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              How We Create Pricing Pressure
            </h3>
            <p className="text-base leading-relaxed text-foreground/75">
              We Use Our Data Pulse To Create Leverage. Contractors In Our Orbit Know We Verify Scope, Materials,
              Exclusions, and Pricing Logic. If The Quote is Bloated or Weak, The Engine Flags It. To Stay Competitive,
              They're Pushed Toward Cleaner Structure and Sharper Pricing.
            </p>
            <div className="mt-auto pt-8">
              <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                <span
                  className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{ background: "#06B6D4", boxShadow: "0 0 6px #06B6D4" }}
                  aria-hidden="true"
                />
                <span className="font-mono text-[11px] tracking-[0.08em] text-foreground/60">
                  BLOATED MARGIN → ENGINE FLAG → COMPETITIVE PRESSURE
                </span>
              </div>
            </div>
          </div>

          {/* Card 2 */}
          <div
            className="flex flex-col rounded-2xl bg-white p-8 md:p-10 border-double border-4 border-orange-400 shadow-2xl"
            style={{
              boxShadow:
                "0 4px 8px rgba(10,25,60,0.09), 0 16px 48px rgba(10,25,60,0.14), 0 0 0 1px rgba(249,115,22,0.07), inset 0 1px 0 rgba(255,255,255,0.95)",
            }}
          >
            <div className="mb-6 flex items-center gap-3">
              <span
                className="inline-block h-1.5 w-10 rounded-full"
                style={{ background: "#f97316" }}
                aria-hidden="true"
              />
              <span className="font-mono tracking-[0.12em] text-muted-foreground font-semibold text-xs">MECHANISM 02</span>
            </div>
            <h3 className="mb-4 font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              This is the Arbitrage
            </h3>
            <p className="text-base leading-relaxed text-foreground/75">
              We Identify The Gap Between What A Homeowner Is Being Offered And What A Cleaner, More Competitive Quote
              Could Look Like. That Gap Is Where WindowMan Creates Pressure. We Do Not Guess. We Compare. Then We Make
              The Market React.
            </p>
            <div className="mt-auto pt-8">
              <div className="flex items-center gap-3 rounded-lg border border-orange-100 bg-orange-50/60 px-4 py-3">
                <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-orange-400" aria-hidden="true" />
                <span className="font-mono text-[11px] tracking-[0.08em] text-foreground/60">
                  OFFERED PRICE vs. COMPETITIVE BASELINE → SPREAD EXPOSED
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Centered statement panel */}
        <div
          className="mx-auto max-w-2xl rounded-xl bg-white px-8 py-6 text-center shadow-2xl border-8 border-double border-slate-400"
          style={{ boxShadow: "0 2px 12px rgba(15,30,60,0.07)" }}
        >
          <p className="text-base font-semibold leading-relaxed text-foreground/80 md:text-lg">
            This Is Not Wall Street Arbitrage. Its Market Arbitrage: Turning Quote Confusion Into Pricing Pressure.
          </p>
        </div>

        {/* Interactive Arbitrage Engine showcase */}
        <div className="mt-16 md:mt-24 rounded-2xl overflow-hidden">
          <ArbitrageEngine />
        </div>
      </div>
    </section>
  );
}
