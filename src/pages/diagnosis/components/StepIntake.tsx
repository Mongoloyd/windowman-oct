import { useRef } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
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

const ANSWER_DESCRIPTIONS: Record<DiagnosisCode, string> = {
  price_shock: "The price felt inflated or hard to justify.",
  trust_breakdown: "Something felt rushed, vague, or pressured.",
  financial: "The deposit, financing, or payment terms felt wrong.",
  timing: "The urgency, deadline, or install timing felt off.",
  scope_mismatch: "The scope or product mix did not match your goal.",
  other: "You know something is wrong, even if it is hard to name.",
};

export function StepIntake({ context, onSelectPrimary }: StepIntakeProps) {
  const rootQuestionRef = useRef<HTMLDivElement>(null);
  const gradeKey = context.report_grade?.[0]?.toUpperCase() ?? "F";
  const gradeColor = GRADE_COLORS[gradeKey] ?? GRADE_COLORS.F;
  const isRiskGrade = ["D", "F"].includes(gradeKey);
  const topInsights = context.top_insights.slice(0, 3);
  const handleStickyCta = () => {
    rootQuestionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <section className="relative overflow-hidden px-4 pt-10 pb-28 md:px-8 md:pt-14 md:pb-32 bg-gradient-to-b from-slate-50 via-blue-50/60 to-slate-100">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-blue-300/30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-40 -left-32 h-80 w-80 rounded-full bg-cyan-200/30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-12 -right-28 h-96 w-96 rounded-full bg-blue-400/20 blur-3xl"
      />

      <div className="relative z-10 mx-auto max-w-4xl">
        {context.report_grade && (
          <div className="relative overflow-hidden rounded-[28px] bg-white/85 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/60 border border-white/70 backdrop-blur-xl md:p-7">
            <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/70 to-transparent" />

            <div className="flex flex-col gap-5 md:flex-row md:items-start md:gap-6">
              <div
                className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border ${
                  isRiskGrade ? "border-red-200 bg-red-50" : "border-blue-200 bg-blue-50"
                }`}
              >
                <span
                  className="font-display text-5xl font-black leading-none tracking-tight"
                  style={{ color: gradeColor }}
                >
                  {context.report_grade}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-blue-600">Audit Result</p>
                <h2 className="font-display text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
                  High-risk quote signals found
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
                  We found issues that affect code confidence, product clarity, and negotiation leverage.
                </p>

                {topInsights.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {topInsights.map((insight, i) => (
                      <span
                        key={i}
                        className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold leading-none ${
                          isRiskGrade
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                        }`}
                      >
                        {insight}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-sm font-semibold leading-6 text-blue-950">
              Next: choose what felt wrong. We’ll turn the audit into a counter-offer.
            </div>
          </div>
        )}

        <div className="mx-auto mt-12 max-w-[720px] text-center md:mt-16">
          <h1 className="mx-auto max-w-[720px] font-display text-4xl font-black leading-[0.95] tracking-[-0.04em] text-slate-950 md:text-6xl">
            Tell Us What Felt Wrong.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-600 md:text-lg">
            We’ll use your audit findings to build the right next move: negotiate, compare, or walk away.
          </p>
          <p className="mt-4 text-sm font-semibold text-slate-500">Private consultation. No contractor sees this.</p>
        </div>

        <div
          ref={rootQuestionRef}
          className="mt-10 rounded-[30px] border border-white/70 bg-white/90 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/60 backdrop-blur-xl md:p-8"
        >
          <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600">Step 1 · Root Concern</p>
          <h2 className="mt-4 max-w-2xl font-display text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
            What frustrated you most about this quote?
          </h2>
          <p className="mt-3 text-sm text-slate-500">Pick the answer that feels closest. You can refine it later.</p>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4">
            {DIAGNOSIS_ORDER.map((code) => {
              const config = DIAGNOSTIC_MAP[code];
              const Icon = config.Icon;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => onSelectPrimary(code)}
                  className="group flex min-h-[76px] w-full items-center gap-4 rounded-2xl border border-slate-200/80 bg-white/80 px-5 py-4 text-left shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-[0_18px_40px_rgba(37,99,235,0.14)] focus:outline-none focus:ring-4 focus:ring-blue-500/15"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-100">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold leading-snug text-slate-950">{config.label}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                      {ANSWER_DESCRIPTIONS[code]}
                    </span>
                  </span>
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-blue-500 opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-3xl border border-white/20 bg-slate-950/95 p-3 shadow-[0_24px_80px_rgba(15,23,42,0.35)] backdrop-blur-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="hidden min-w-0 sm:block">
            <p className="text-sm font-black text-white">Ready for a locked-in price?</p>
            <p className="text-xs font-medium text-slate-300">Schedule a free phone measurement.</p>
          </div>
          <button
            type="button"
            onClick={handleStickyCta}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-4 text-sm font-black text-white shadow-[0_12px_30px_rgba(37,99,235,0.35)] transition-all hover:bg-blue-500 active:scale-[0.99] sm:w-auto"
          >
            Schedule Free Measurement
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

