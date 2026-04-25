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

function getPersonalizedDiagnosisCopy(context: DiagnosticContext) {
  const gradeKey = context.report_grade?.[0]?.toUpperCase() ?? "";
  const firstName = context.first_name?.trim();
  const insightsText = context.top_insights.join(" ").toLowerCase();
  const hasWarranty = /warranty|warranties|guarantee|labor coverage|manufacturer coverage/.test(insightsText);
  const hasCode = /\b(noa|dp rating|design pressure|wind load|hvhz)\b/.test(insightsText);
  const hasPrice = /price|pricing|markup|overcharge|high|expensive|market/.test(insightsText);

  const headline = firstName ? `${firstName}, Tell Us What Felt Wrong.` : "Tell Us What Felt Wrong.";

  let contextLine = "Your quote has findings worth resolving before you commit.";
  let toneCopy = "Your quote has findings worth resolving. Let’s choose the safest next move.";

  if (gradeKey === "D" || gradeKey === "F") {
    contextLine = `Your quote scored ${gradeKey}. We found issues worth acting on before you sign.`;
    toneCopy = "Your quote is high-risk. Let’s choose the safest next move.";
  } else if (gradeKey === "B" || gradeKey === "C") {
    contextLine = `Your quote scored ${gradeKey}. A few findings are worth resolving before you commit.`;
    toneCopy = "This quote may be workable, but a few items need clarification.";
  } else if (gradeKey === "A") {
    contextLine = "Your quote scored A. It looks stronger than most, but the details are still worth pressure-testing.";
    toneCopy = "This quote looks stronger than most, but we can still help you pressure-test the details.";
  }

  const focusCopy = hasCode
    ? "Code documentation is the key thing to clarify."
    : hasWarranty
      ? "Warranty clarity is the key thing to clarify."
      : hasPrice
        ? "A cleaner price comparison is the key next step."
        : null;

  return { headline, contextLine, toneCopy, focusCopy };
}

export function StepIntake({ context, onSelectPrimary }: StepIntakeProps) {
  const gradeKey = context.report_grade?.[0]?.toUpperCase() ?? "F";
  const gradeColor = GRADE_COLORS[gradeKey] ?? GRADE_COLORS.F;
  const visibleInsights = context.top_insights.slice(0, 3);
  const copy = getPersonalizedDiagnosisCopy(context);

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
            className="bg-white rounded-2xl p-5 md:p-6 mb-8"
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
                <p className="text-xs font-black tracking-[0.2em] uppercase text-gray-500 mb-1">Your Audit Score</p>
                <p className="text-sm font-semibold text-foreground/75 mb-3">{copy.contextLine}</p>
                {visibleInsights.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {visibleInsights.map((insight, i) => (
                      <span
                        key={`${insight}-${i}`}
                        className="inline-flex max-w-full items-center rounded-full border bg-white/70 px-3 py-1.5 text-xs font-semibold text-foreground/80 animate-fade-in"
                        style={{
                          borderColor: `${gradeColor}26`,
                          animationDelay: `${i * 120}ms`,
                          animationFillMode: "both",
                        }}
                      >
                        <span className="truncate">{insight}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Reassurance Ribbon */}
            <div className="border-t border-gray-200/60 mt-5 pt-4 flex items-center gap-3">
              <span className="block w-0.5 h-3.5 rounded-full" style={{ background: gradeColor }} />
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
              color: "hsl(217 91% 70%)",
              border: "1px solid rgba(37,99,235,0.18)",
            }}
          >
            <Handshake className="w-4 h-4" />
            This Isn't a Sales Form. It's a Consultation.
          </div>
          <h1 className="font-display text-3xl md:text-5xl font-extrabold tracking-tight mb-5 leading-tight text-foreground">
            {copy.headline}
          </h1>
          <p className="text-base md:text-lg text-foreground/75 max-w-2xl mx-auto leading-relaxed">
            {copy.toneCopy} {copy.focusCopy ?? "One tap is all it takes to start."}
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
