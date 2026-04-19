import { useState } from "react";
import SectionEyebrow from "./SectionEyebrow";
import SectionHeading from "./SectionHeading";

interface InformationAsymmetrySectionProps {
  onTrack?: (eventName: string) => void;
}

const bullets = [
  "Price is visible. Scope quality often is not.",
  "Margins are hidden inside line-item structure.",
  "Exclusions can matter more than headline price.",
  "Without normalization, comparison is guesswork.",
];

const buyerItems = ["Total Price", "Brand Name", "Monthly Payment", '"Looks Complete"'];

const contractorItems = [
  "Scope omissions",
  "Labor assumptions",
  "Exclusion language",
  "Warranty weakness",
  "Margin structure",
  "Change-order exposure",
];

export default function InformationAsymmetrySection({ onTrack }: InformationAsymmetrySectionProps) {
  const [activeTab, setActiveTab] = useState<"buyer" | "contractor">("buyer");

  const handleTabSwitch = (tab: "buyer" | "contractor") => {
    setActiveTab(tab);
    if (onTrack) onTrack(`asymmetry_tab_${tab}_clicked`);
  };

  return (
    <section className="relative overflow-hidden px-6 py-16 md:px-8 md:py-24" style={{ background: "transparent" }}>
      {/* Depth L1 — blue radial, left side */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          top: "0%",
          left: "-12%",
          width: "55%",
          height: "100%",
          background:
            "radial-gradient(ellipse at 30% 50%, rgba(30,80,180,0.09) 0%, rgba(56,130,220,0.04) 50%, transparent 72%)",
          filter: "blur(40px)",
        }}
      />
      <div className="relative mx-auto max-w-7xl">
        <div className="grid gap-12 md:grid-cols-2 md:gap-16 lg:gap-20">
          {/* Left Column: Narrative + Bullets */}
          <div className="flex flex-col justify-center">
            <SectionEyebrow className="mb-4">THE HIDDEN SYSTEM</SectionEyebrow>
            <SectionHeading className="mb-6">Most Buyers See a Price. Professionals See a Structure.</SectionHeading>
            <p className="mb-8 text-base leading-relaxed text-foreground/80 md:text-lg">
              Homeowners usually experience a quote as a final number. Contractors experience it as a structured
              instrument made up of scope, labor assumptions, exclusions, material choices, warranty posture, and margin
              strategy.
            </p>
            <ul className="space-y-3">
              {bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-cyan-500" aria-hidden="true" />
                  <span className="text-base leading-relaxed text-foreground/80">{bullet}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right Column: Buyer / Contractor split panel */}
          <div className="flex items-center justify-center">
            <div
              className="card-raised w-full max-w-md overflow-hidden rounded-2xl border-double border-8 border-emerald-100"
              style={{ boxShadow: "0 8px 32px rgba(15,30,60,0.12)" }}
            >
              {/* Tab header */}
              <div className="flex border-b border-slate-200">
                <button
                  onClick={() => handleTabSwitch("buyer")}
                  className={`flex-1 py-3 text-sm font-semibold tracking-wide transition-colors focus:outline-none ${
                    activeTab === "buyer"
                      ? "border-b-2 border-cyan-500 bg-white text-foreground"
                      : "bg-slate-50 text-foreground/50 hover:text-foreground/70"
                  }`}
                >
                  Buyer Sees
                </button>
                <button
                  onClick={() => handleTabSwitch("contractor")}
                  className={`flex-1 py-3 text-sm font-semibold tracking-wide transition-colors focus:outline-none ${
                    activeTab === "contractor"
                      ? "border-b-2 border-cyan-300 bg-white text-foreground"
                      : "bg-slate-50 text-foreground/50 hover:text-foreground/70"
                  }`}
                >
                  Contractor Sees
                </button>
              </div>

              {/* Panel body */}
              <div className="p-6">
                {activeTab === "buyer" ? (
                  <ul className="space-y-3">
                    {buyerItems.map((item) => (
                      <li
                        key={item}
                        className="flex items-center gap-3 rounded-lg border bg-slate-50 px-4 py-3 shadow-sm border-solid border-black"
                      >
                        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-slate-300" />
                        <span className="text-sm font-medium text-foreground/80">{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className="space-y-3">
                    {contractorItems.map((item) => (
                      <li
                        key={item}
                        className="flex items-center gap-3 rounded-lg bg-cyan-50/60 px-4 py-3 shadow-sm border-2 border-emerald-400"
                      >
                        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-cyan-500" />
                        <span className="text-sm font-medium text-foreground/80">{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Footer label */}
              <div className="border-t border-slate-100 bg-slate-50/80 px-6 py-3 text-center">
                <p className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground">
                  {activeTab === "buyer"
                    ? "SIMPLIFIED SURFACE — 4 VISIBLE SIGNALS"
                    : "UNDERLYING STRUCTURE — 6 HIDDEN VARIABLES"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
