import SectionEyebrow from "./SectionEyebrow";
import SectionHeading from "./SectionHeading";

export default function HowWeMakeMoneySection() {
  return (
    <section className="relative overflow-hidden px-6 py-16 md:px-8 md:py-24" style={{ background: "transparent" }}>
      {/* Depth L1 — soft blue, left */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          top: "10%",
          left: "-10%",
          width: "50%",
          height: "80%",
          background: "radial-gradient(ellipse at 30% 50%, rgba(30,80,180,0.08) 0%, transparent 68%)",
          filter: "blur(40px)",
        }}
      />
      <div className="relative mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="mb-12 text-center md:mb-16">
          <SectionEyebrow className="mb-4">HOW WE MAKE MONEY</SectionEyebrow>
          <SectionHeading className="mb-6">We Get Paid When the System Produces a Better Opportunity.</SectionHeading>
          <p className="mx-auto max-w-3xl text-base leading-relaxed text-foreground/80 md:text-lg">
            WindowMan is Free For Homeowners To Use. We Make Money When Our Intelligence Layer Produces Qualified
            Opportunities and Contractor Introductions—Not When Homeowners Stay Confused.
          </p>
        </div>

        {/* Main explanation card */}
        <div
          className="mx-auto mb-8 max-w-4xl rounded-2xl bg-white p-8 md:p-12"
          style={{
            boxShadow:
              "0 4px 6px rgba(15,30,60,0.06), 0 16px 48px rgba(15,30,60,0.11), inset 0 1px 0 rgba(255,255,255,0.9)",
          }}
        >
          <div className="grid gap-8 md:grid-cols-2">
            {/* Left: Homeowner side */}
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-8 md:border-b-0 md:border-r md:pb-0 md:pr-8">
              <div className="flex items-center gap-3">
                <span className="h-1 w-8 rounded-full" style={{ background: "#06B6D4" }} aria-hidden="true" />
                <span className="font-mono tracking-[0.12em] text-muted-foreground text-base">HOMEOWNER</span>
              </div>
              <h3 className="font-display text-xl font-bold tracking-tight text-foreground">Always Free For You</h3>
              <p className="leading-relaxed text-foreground/70 text-base">
                Upload Your Quote, Get The Analysis, View Your Truth Report. We Dont Charge Homeowners. Our Model Only
                Works If You Trust The Output, and That Trust Requires Us To Stay On Your Side Til The End.
              </p>
            </div>

            {/* Right: Contractor/revenue side */}
            <div className="flex flex-col gap-4 md:pl-8">
              <div className="flex items-center gap-3">
                <span className="h-1 w-8 rounded-full bg-orange-400" aria-hidden="true" />
                <span className="font-mono tracking-[0.12em] text-muted-foreground text-base">
                  CONTRACTOR REFERRAL
                </span>
              </div>
              <h3 className="font-display text-xl font-bold tracking-tight text-foreground">
                We Earn From Better Matches
              </h3>
              <p className="leading-relaxed text-foreground/70 text-base">
                If You Use Our Data To Move Forward With One Of Our Referred Contractor Partners, They May Pay Us a
                Referral Fee. But They Cannot Simply Hide That Fee By Bloating The Quote, Because The Same Engine That
                Created The Opportunity Is Also What Would Expose The Markup.
              </p>
            </div>
          </div>

          {/* Divider + aligned incentive statement */}
          <div className="mt-8 border-t border-slate-100 pt-8">
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  label: "Opacity Pays Us Nothing",
                  accent: "bg-slate-300",
                },
                {
                  label: "Clarity Creates Our Opportunity",
                  accent: "bg-cyan-400",
                },
                {
                  label: "Better Match = Our Revenue",
                  accent: "bg-orange-400",
                },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className={`h-2 w-2 flex-shrink-0 rounded-full ${item.accent}`} aria-hidden="true" />
                  <span className="text-sm font-medium text-foreground/70">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Trust line */}
        <p className="text-center text-sm italic text-foreground/60">
          We Only Get Paid When The Market Gets Clearer And The Opportunities Get Better.
        </p>
      </div>
    </section>
  );
}
