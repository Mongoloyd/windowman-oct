import { Link } from "react-router-dom";
import { Shield, AlertTriangle, CheckCircle2 } from "lucide-react";
import SectionEyebrow from "./SectionEyebrow";

interface AboutHeroProps {
  onTrack?: (eventName: string) => void;
}

export default function AboutHero({ onTrack }: AboutHeroProps) {
  const handlePrimaryCTA = () => {
    if (onTrack) onTrack("about_hero_primary_cta_clicked");
  };

  return (
    <section className="relative overflow-hidden px-6 py-16 md:px-8 md:py-24" style={{ background: "transparent" }}>
      {/* Depth L1 — deep blue radial field, upper-left */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          top: "-10%",
          left: "-8%",
          width: "70%",
          height: "80%",
          background: "radial-gradient(ellipse at 30% 40%, rgba(30,80,180,0.11) 0%, rgba(56,130,220,0.06) 45%, transparent 70%)",
          filter: "blur(32px)",
        }}
      />
      {/* Depth L2 — cyan accent field, right column */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          top: "5%",
          right: "-5%",
          width: "55%",
          height: "90%",
          background: "radial-gradient(ellipse at 70% 35%, rgba(6,182,212,0.10) 0%, rgba(14,165,233,0.05) 50%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />
      {/* Depth L3 — section atmosphere wash */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: "linear-gradient(160deg, rgba(219,234,254,0.18) 0%, transparent 55%, rgba(186,230,255,0.10) 100%)",
        }}
      />
      <div className="relative mx-auto max-w-7xl">
        <div className="grid gap-12 md:grid-cols-2 md:gap-16 lg:gap-20">
          {/* Left Column: Narrative + CTAs */}
          <div className="flex flex-col justify-center">
            <SectionEyebrow className="mb-4">
              MARKET INTELLIGENCE FOR HOME IMPROVEMENT
            </SectionEyebrow>

            <h1 className="mb-6 font-display text-4xl font-extrabold leading-tight tracking-tight text-foreground md:text-5xl lg:text-6xl">
              The Home Improvement Industry Has a Data Problem
            </h1>

            <p className="mb-8 text-base leading-relaxed text-foreground/80 md:text-lg">
              Homeowners make high-cost decisions with limited visibility.
              Contractors operate with full pricing, scope, and margin awareness.
              The result is inconsistent pricing, unclear scopes, and uneven
              outcomes.
            </p>

            {/* CTA Block */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link
                to="/"
                onClick={handlePrimaryCTA}
                className="btn-depth-primary inline-flex items-center justify-center rounded-lg px-8 py-4 text-base font-bold"
              >
                Analyze My Quote
              </Link>
            </div>
          </div>

          {/* Right Column: Forensic Visual Panel */}
          <div className="flex items-center justify-center">
            <div className="card-raised-hero relative w-full max-w-md rounded-2xl bg-white p-8 border-double border-8 border-emerald-100" style={{ boxShadow: "0 4px 8px rgba(10,30,80,0.12), 0 20px 60px rgba(10,30,80,0.18), 0 40px 80px rgba(10,30,80,0.08), inset 0 1px 0 rgba(255,255,255,0.95), 0 0 0 1px rgba(30,80,180,0.07)" }}>
              {/* Subtle cyan ambient behind scanner card */}
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-2xl" style={{ background: "radial-gradient(ellipse at 60% 20%, rgba(6,182,212,0.07) 0%, transparent 65%)" }} />
              {/* Mock Scanner Interface */}
              <div className="mb-6">
                <div className="mb-3 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-cobalt" />
                  <span className="font-mono font-semibold uppercase tracking-wider text-foreground text-sm">
                    Quote Analysis Engine
                  </span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-slate-200" style={{ boxShadow: "inset 0 1px 2px rgba(0,0,0,0.08)" }}>
                  <div className="h-full w-4/5 bg-gradient-to-r from-cobalt to-cyan-500" style={{ boxShadow: "0 0 8px rgba(6,182,212,0.5)" }}></div>
                </div>
              </div>

              {/* Mock Data Signals */}
              <div className="space-y-4">
                {/* Signal 1: Green Check */}
                <div className="flex items-start gap-3 rounded-lg bg-emerald-50 p-3 border-2 border-double border-emerald-300">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">
                      Design Pressure Validated
                    </p>
                    <p className="text-xs text-emerald-700">
                      DP50 rating meets Florida Building Code
                    </p>
                  </div>
                </div>

                {/* Signal 2: Warning */}
                <div className="flex items-start gap-3 rounded-lg bg-orange-50 p-3 border-double border-2">
                  <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" />
                  <div>
                    <p className="text-sm font-semibold text-orange-900">
                      Installation Scope Unclear
                    </p>
                    <p className="text-xs text-orange-700">
                      No demolition or trim detail specified
                    </p>
                  </div>
                </div>

                {/* Signal 3: Warning */}
                <div className="flex items-start gap-3 rounded-lg bg-orange-50 p-3 border-destructive border border-solid">
                  <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" />
                  <div>
                    <p className="text-sm font-semibold text-orange-900">
                      Warranty Terms Missing
                    </p>
                    <p className="text-xs text-orange-700">
                      No labor warranty duration found
                    </p>
                  </div>
                </div>
              </div>

              {/* Mock Grade Output */}
              <div className="relative mt-6 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 p-4 border-slate-400 border-double border-4" style={{ boxShadow: "inset 0 2px 6px rgba(10,25,55,0.06), 0 1px 0 rgba(255,255,255,0.8)" }}>
                <div className="mb-2 text-center">
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Overall Grade
                  </span>
                </div>
                <div className="text-center">
                  <span className="font-display text-6xl font-extrabold text-caution">
                    C+
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
