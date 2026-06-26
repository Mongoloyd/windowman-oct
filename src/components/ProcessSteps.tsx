import React from "react";
import { ScanSearch, Target, Flag, Diamond, CheckCircle2, FileCheck } from "lucide-react";

const steps = [
  {
    num: "01",
    title: "Start your free quote check",
    desc: "Enter your contact details so WindowMan can save your quote check and results in one place.",
  },
  {
    num: "02",
    title: "Upload your quote",
    desc: "Drop in the estimate you received from a window contractor. PDF or image works.",
  },
  {
    num: "03",
    title: "AI scans every line",
    desc: "WindowMan checks the quote for missing scope, unclear terms, pricing signals, and risk flags.",
  },
  {
    num: "04",
    title: "Your grade is calculated",
    desc: "You get a clear read on how the quote stacks up and what deserves a closer look.",
  },
  {
    num: "05",
    title: "Decide your next move",
    desc: "Use the results to ask better questions, compare options, or move forward with more confidence.",
  },
];

const takeaways = [
  {
    icon: Target,
    text: "Whether your price looks fair relative to comparable impact-window quotes",
  },
  {
    icon: Flag,
    text: "Which Line Items Are Vague, Missing, or Potentially Inflated",
  },
  {
    icon: Diamond,
    text: "What Window Brand — If Any — Your Contractor Actually Specified",
  },
  {
    icon: CheckCircle2,
    text: "A Letter Grade: A Through F",
  },
];

interface ProcessStepsProps {
  onScanClick?: () => void;
  onDemoClick?: () => void;
}

export default function ProcessSteps({ onScanClick, onDemoClick }: ProcessStepsProps) {
  return (
    <section className="bg-transparent py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-16">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-b from-white to-[#F8FAFC] border border-border mb-5"
            style={{
              boxShadow:
                "inset 0 1px 2px rgba(255,255,255,0.6), inset 0 -1px 2px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.08)",
            }}
          >
            <ScanSearch className="w-8 h-8 text-primary" strokeWidth={1.8} />
          </div>
          <div className="font-mono text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase mb-4">
            How it works
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-extrabold uppercase tracking-tight text-foreground leading-[1.08]">
            What Happens When You Scan
          </h2>
          <p className="mt-4 text-base md:text-lg leading-relaxed text-foreground/80">
            Upload Your Quote Details and Instantly Know the Truth About Your Estimate
          </p>
        </div>

        {/* Two-column layout */}
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          {/* Timeline */}
          <div className="lg:col-span-7 relative">
            <div className="hidden sm:block absolute left-[22px] top-6 bottom-6 w-px bg-gradient-to-b from-primary/30 via-border to-border" />
            <div className="space-y-5 sm:space-y-6">
              {steps.map((step) => (
                <div key={step.num} className="relative z-10 flex items-start gap-4 sm:gap-5 group">
                  {/* Convex Step Number Circle */}
                  <div
                    className="shrink-0 w-11 h-11 rounded-full bg-gradient-to-b from-white to-[#F8FAFC] border border-primary/40 text-primary flex items-center justify-center"
                    style={{
                      boxShadow:
                        "inset 0 1px 2px rgba(255,255,255,0.6), inset 0 -1px 2px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.1)",
                    }}
                  >
                    <span className="font-mono text-sm font-bold tracking-wide">{step.num}</span>
                  </div>

                  {/* 3D raised card */}
                  <div
                    className="flex-1 rounded-[10px] border border-[hsl(214_30%_82%)] bg-gradient-to-b from-white to-[#F8FAFC] p-5 sm:p-6 transition-all duration-300 group-hover:-translate-y-1.5"
                    style={{
                      boxShadow:
                        "inset 0 1px 0 0 rgba(255,255,255,0.7), 0 2px 4px rgba(0,0,0,0.04), 0 8px 20px rgba(0,0,0,0.06)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow =
                        "inset 0 1px 0 0 rgba(255,255,255,0.7), 0 8px 16px rgba(0,0,0,0.06), 0 24px 48px rgba(0,0,0,0.12)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow =
                        "inset 0 1px 0 0 rgba(255,255,255,0.7), 0 2px 4px rgba(0,0,0,0.04), 0 8px 20px rgba(0,0,0,0.06)";
                    }}
                  >
                    <h3 className="text-lg sm:text-xl font-semibold text-foreground">{step.title}</h3>
                    <p className="mt-2 text-sm sm:text-[15px] leading-7 text-muted-foreground max-w-[42ch]">
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sticky takeaway card — 3-ring graduated depth */}
          <div className="lg:col-span-5 lg:sticky lg:top-24">
            {/* Outer ring */}
            <div className="rounded-[16px] border border-border/50 p-[3px]">
              {/* Middle ring */}
              <div className="rounded-[14px] border border-border/30 p-[3px]">
                {/* Inner ring */}
                <div className="rounded-[12px] border border-border/15 overflow-hidden">
                  <div
                    className="rounded-[11px] bg-gradient-to-b from-white to-[#F8FAFC] overflow-hidden"
                    style={{
                      boxShadow:
                        "inset 0 1px 0 0 rgba(255,255,255,0.7), 0 8px 24px rgba(0,0,0,0.06), 0 20px 60px rgba(0,0,0,0.10)",
                    }}
                  >
                    <div className="h-2 bg-gradient-to-r from-primary via-primary/80 to-primary/60" />
                    <div className="relative p-6 sm:p-8">
                      <FileCheck
                        className="absolute right-4 bottom-4 w-32 h-32 text-muted/30 pointer-events-none"
                        strokeWidth={1.25}
                      />
                      <div className="relative z-10">
                        <h3 className="text-2xl sm:text-[30px] leading-tight font-bold text-foreground pb-5 border-b border-border">
                          You'll Walk Away <span className="text-primary">Knowing:</span>
                        </h3>

                        <ul className="mt-6 space-y-5 sm:space-y-6">
                          {takeaways.map((item, index) => {
                            const Icon = item.icon;
                            return (
                              <li
                                key={index}
                                className="flex items-start gap-4 transition-all duration-200 hover:scale-[1.02]"
                              >
                                {/* Convex icon circle */}
                                <div
                                  className="w-11 h-11 shrink-0 rounded-full bg-gradient-to-b from-white to-[#F8FAFC] border border-border flex items-center justify-center"
                                  style={{
                                    boxShadow:
                                      "inset 0 1px 2px rgba(255,255,255,0.6), inset 0 -1px 2px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.08)",
                                  }}
                                >
                                  <Icon className="w-5 h-5 text-primary" strokeWidth={2} />
                                </div>
                                <p className="text-[15px] sm:text-base font-medium leading-7 text-foreground/80">
                                  {item.text}
                                </p>
                              </li>
                            );
                          })}
                        </ul>

                        {/* Action plan badge — embossed */}
                        <div
                          className="mt-8 rounded-[10px] border border-primary/20 bg-gradient-to-b from-primary/5 to-primary/10 p-4 sm:p-5 flex items-center gap-4"
                          style={{
                            boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.5), 0 2px 8px rgba(0,0,0,0.06)",
                          }}
                        >
                          <div
                            className="w-14 h-14 rounded-xl bg-gradient-to-b from-white to-[#F8FAFC] border border-primary/20 text-primary flex items-center justify-center shrink-0 font-bold text-lg"
                            style={{
                              boxShadow:
                                "inset 0 1px 2px rgba(255,255,255,0.6), inset 0 -1px 2px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.08)",
                            }}
                          >
                            A–F
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">Clear Action Plan</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              Grade, Flags, and Negotiation Direction In One Report
                            </p>
                          </div>
                        </div>

                        {/* Includes Chips — Embossed */}
                        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div
                            className="rounded-[10px] bg-gradient-to-b from-white to-[#F8FAFC] border border-border px-4 py-3"
                            style={{
                              boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.5), 0 1px 4px rgba(0,0,0,0.05)",
                            }}
                          >
                            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                              Includes
                            </div>
                            <div className="mt-1 text-sm font-semibold text-foreground">Dollar Delta vs Market</div>
                          </div>
                          <div
                            className="rounded-[10px] bg-gradient-to-b from-white to-[#F8FAFC] border border-border px-4 py-3"
                            style={{
                              boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.5), 0 1px 4px rgba(0,0,0,0.05)",
                            }}
                          >
                            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                              Includes
                            </div>
                            <div className="mt-1 text-sm font-semibold text-foreground">Red Flags Explained</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
