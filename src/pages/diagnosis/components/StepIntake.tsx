import { Handshake } from "lucide-react";
import { DIAGNOSIS_ORDER, DIAGNOSTIC_MAP } from "../constants/diagnosticMap";
import type { DiagnosisCode, DiagnosticContext } from "../types";

interface StepIntakeProps {
  context: DiagnosticContext;
  onSelectPrimary: (code: DiagnosisCode) => void;
}

const GRADE_COLORS: Record<string, string> = {
  A: "#15803D",
  B: "#4D7C0F",
  C: "#A16207",
  D: "#C2410C",
  F: "#B91C1C",
};

export function StepIntake({ context, onSelectPrimary }: StepIntakeProps) {
  const gradeKey = context.report_grade?.[0]?.toUpperCase() ?? "F";
  const gradeColor = GRADE_COLORS[gradeKey] ?? GRADE_COLORS.F;
  const insightCount = context.top_insights.length;
  const gridColsClass =
    insightCount <= 4
      ? "grid-cols-1"
      : insightCount <= 8
        ? "grid-cols-1 md:grid-cols-2"
        : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";

  return (
    <section className="relative overflow-hidden px-6 pt-16 pb-20 md:px-8" style={{ background: "transparent" }}>
      {/* Depth L1 — deep cobalt radial field, upper-left */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          top: "-10%",
          left: "-8%",
          width: "70%",
          height: "80%",
          background:
            "radial-gradient(ellipse at 30% 40%, rgba(30,80,180,0.11) 0%, rgba(56,130,220,0.06) 45%, transparent 70%)",
          filter: "blur(32px)",
        }}
      />
      {/* Depth L2 — cyan accent field, right */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          top: "5%",
          right: "-5%",
          width: "55%",
          height: "90%",
          background:
            "radial-gradient(ellipse at 70% 35%, rgba(6,182,212,0.10) 0%, rgba(14,165,233,0.05) 50%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />
      {/* Depth L3 — atmosphere wash */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(160deg, rgba(219,234,254,0.18) 0%, transparent 55%, rgba(186,230,255,0.10) 100%)",
        }}
      />

      <div className="max-w-3xl mx-auto relative z-10">
        {context.report_grade && (
          <div
            className="bg-white rounded-2xl p-6 md:p-8 mb-10"
            style={{
              boxShadow: `0 20px 50px -12px ${gradeColor}33`,
              border: `1px solid ${gradeColor}1A`,
            }}
          >
            <div className="flex items-start gap-5 md:gap-6">
              {/* Grade Stage */}
              <div
                className="shrink-0 aspect-square w-20 md:w-24 rounded-xl flex items-center justify-center"
                style={{
                  background: `${gradeColor}0D`,
                  border: `1px solid ${gradeColor}26`,
                }}
              >
                <span
                  className="font-display font-black text-5xl md:text-6xl leading-none"
                  style={{ color: gradeColor }}
                >
                  {context.report_grade}
                </span>
              </div>

              {/* Header + Smart Grid */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black tracking-[0.2em] uppercase text-gray-500 mb-1">
                  Your Audit Score
                </p>
                <p className="text-sm font-semibold text-foreground/70 mb-4">
                  Here's What We Flagged
                </p>
                <ul className={`grid ${gridColsClass} gap-x-5 gap-y-2.5`}>
                  {context.top_insights.map((insight, i) => (
                    <li
                      key={i}
                      className="text-sm font-medium text-foreground/85 flex items-start gap-2 animate-fade-in"
                      style={{
                        animationDelay: `${Math.min(i, 9) * 200}ms`,
                        animationFillMode: "both",
                      }}
                    >
                      <span
                        className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: gradeColor }}
                      />
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Reassurance Ribbon */}
            <div className="border-t border-gray-200/60 mt-5 pt-4 flex items-center gap-3">
              <span
                className="block w-0.5 h-3.5 rounded-full"
                style={{ background: gradeColor }}
              />
              <p className="font-mono text-[11px] tracking-wider uppercase text-gray-500">
                We Have Your Quote · We Have Your Answers · Let's Build Your Counter-Offer
              </p>
            </div>
          </div>
        )}

        <div className="mb-10 text-center">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-6"
            style={{
              background: "rgba(37,99,235,0.08)",
              color: "hsl(217 91% 40%)",
              border: "1px solid rgba(37,99,235,0.18)",
            }}
          >
            <Handshake className="w-4 h-4" />
            This Isn't a Sales Form. It's a Consultation.
          </div>
          <h1 className="font-display text-3xl md:text-5xl font-extrabold tracking-tight mb-5 leading-tight text-foreground">
            Before We Build Your Better Estimate, Tell Us What Didn't Feel Right.
          </h1>
          <p className="text-base md:text-lg text-foreground/75 max-w-2xl mx-auto leading-relaxed">
            You Can Be Completely Honest—We Work For You, Not The Contractor. One Tap Is All It Takes To Start.
          </p>
        </div>

        <div className="card-raised-hero rounded-2xl p-6 md:p-8 border-double border-4 border-cobalt/15">
          <p className="wm-eyebrow uppercase text-muted-foreground mb-3">Root Question</p>
          <h2 className="font-display text-xl md:text-2xl font-extrabold text-foreground mb-6 tracking-tight">
            What Frustrated You Most About The Quote You Received?
          </h2>
          <div className="flex flex-wrap gap-3">
            {DIAGNOSIS_ORDER.map((code) => {
              const config = DIAGNOSTIC_MAP[code];
              const Icon = config.Icon;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => onSelectPrimary(code)}
                  className="btn-secondary-tactile group inline-flex items-center gap-2 px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cobalt/40"
                >
                  <Icon className="w-4 h-4 text-muted-foreground group-hover:text-cobalt transition-colors" />
                  {config.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-5 italic">
            Tap The One That Hits Closest. Don't Overthink It.
          </p>
        </div>
      </div>
    </section>
  );
}

