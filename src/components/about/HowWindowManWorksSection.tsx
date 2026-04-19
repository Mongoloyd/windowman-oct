import SectionEyebrow from "./SectionEyebrow";
import SectionHeading from "./SectionHeading";

const steps = [
  {
    number: "01",
    title: "Upload Quote",
    body: "You upload a PDF, screenshot, or image of the estimate.",
    connector: true,
  },
  {
    number: "02",
    title: "Data Extraction",
    body: "We normalize the hidden variables—scope, material assumptions, exclusions, and warranty posture—so the quote can actually be compared.",
    connector: true,
  },
  {
    number: "03",
    title: "Market Baseline",
    body: "We line that quote up against the pulse of your county and the patterns we've already seen.",
    connector: false,
  },
];

export default function HowWindowManWorksSection() {
  return (
    <section className="relative overflow-hidden px-6 py-16 md:px-8 md:py-24" style={{ background: "transparent" }}>
      {/* Depth L1 — cyan-tinted radial behind mechanism panel */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          top: "10%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "80%",
          height: "85%",
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(6,182,212,0.09) 0%, rgba(30,80,180,0.08) 40%, transparent 70%)",
          filter: "blur(48px)",
        }}
      />
      {/* Depth L2 — deep blue flanks */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          top: "-10%",
          left: "-10%",
          width: "40%",
          height: "80%",
          background: "radial-gradient(ellipse at 25% 45%, rgba(14,40,100,0.08) 0%, transparent 70%)",
          filter: "blur(36px)",
        }}
      />
      <div className="relative mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="mb-12 text-center md:mb-16">
          <SectionEyebrow className="mb-4">THE MECHANISM</SectionEyebrow>
          <SectionHeading className="mb-6">We Read the Fine Print So You Don't Have To.</SectionHeading>
          <p className="mx-auto max-w-3xl text-base leading-relaxed text-foreground/80 md:text-lg">
            You Drop Your Confusing Quote Into The Slot. Our Engine Rips Out The Raw Data—Scope, Materials, Warranties,
            Fine Print, and Hidden Exclusions—And Lines it up Against Our Actual Independent Market Baseline.
          </p>
        </div>

        {/* Machine Interior — recessed inset zone */}
        <div
          className="mb-10 overflow-hidden rounded-2xl border border-slate-200"
          style={{
            background: "#f8fafc",
            boxShadow:
              "inset 0 4px 18px rgba(15,30,60,0.08), 0 4px 20px rgba(10,30,100,0.10), 0 16px 48px rgba(6,182,212,0.06)",
          }}
        >
          {/* Machine Header Bar */}
          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-100/80 px-6 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
            <span className="ml-3 font-mono text-[10px] tracking-[0.12em] text-muted-foreground">
              WINDOWMAN DATA ENGINE — ACTIVE
            </span>
          </div>

          {/* 3-Step Timeline */}
          <div className="flex flex-col gap-0 md:flex-row">
            {steps.map((step, idx) => (
              <div key={step.number} className="flex flex-1 flex-col md:flex-row">
                {/* Step Panel */}
                <div className="relative flex flex-1 flex-col gap-4 p-8">
                  {/* Step number accent */}
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold text-white"
                      style={{ background: "#06B6D4" }}
                    >
                      {step.number}
                    </span>
                    <h3 className="font-display text-lg font-bold tracking-tight text-foreground">{step.title}</h3>
                  </div>
                  <p className="leading-relaxed text-foreground/70 text-lg">{step.body}</p>
                </div>

                {/* Connector — only between steps */}
                {step.connector && (
                  <>
                    {/* Desktop: vertical divider with arrow */}
                    <div className="hidden items-center justify-center md:flex">
                      <div className="relative flex h-full w-10 flex-col items-center justify-center">
                        <div
                          className="h-full w-px"
                          style={{ background: "linear-gradient(to bottom, transparent, #06B6D4, transparent)" }}
                        />
                        <div
                          className="absolute h-3 w-3 rotate-45 border-r-2 border-t-2"
                          style={{ borderColor: "#06B6D4" }}
                        />
                      </div>
                    </div>

                    {/* Mobile: horizontal divider */}
                    <div className="flex items-center justify-center md:hidden">
                      <div className="relative flex w-full flex-row items-center justify-center py-2">
                        <div className="w-full border-t" style={{ borderColor: "#06B6D4", opacity: 0.5 }} />
                        <div
                          className="absolute h-3 w-3 rotate-[135deg] border-b-2 border-r-2"
                          style={{ borderColor: "#06B6D4" }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Machine footer status bar */}
          <div className="border-t border-slate-200 bg-slate-100/60 px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: "#06B6D4", boxShadow: "0 0 6px #06B6D4" }}
                />
                <span className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground">
                  NORMALIZATION COMPLETE
                </span>
              </div>
              <span className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground">
                ENGINE v3 · COUNTY-CALIBRATED
              </span>
            </div>
          </div>
        </div>

        {/* Supporting micro-line */}
        <p className="text-center text-sm italic text-foreground/60">
          The Quote Starts As A Sales Document. We Turn It Into Something You Can Actually Understand and Evaluate.
        </p>
      </div>
    </section>
  );
}
