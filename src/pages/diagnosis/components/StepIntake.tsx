import { ArrowRight, CheckCircle2 } from "lucide-react";
import { trackGtmEvent } from "@/lib/trackConversion";
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
  const gradeKey = context.report_grade?.[0]?.toUpperCase() ?? "F";
  const gradeColor = GRADE_COLORS[gradeKey] ?? GRADE_COLORS.F;
  const isRiskGrade = ["D", "F"].includes(gradeKey);
  const topInsights = context.top_insights.slice(0, 3);

  const handleConsultationCtaClick = () => {
    const eventId = crypto.randomUUID();

    trackGtmEvent("wm_phone_call_cta_click", {
      event_id: eventId,
      category: "diagnosis",
      source: "diagnosis_step_1_sticky_cta",
      conversion_type: "phone_call_intent",
      value: 200,
      currency: "USD",
      meta: {
        category: "opt",
        funnel_step: "diagnosis_step_1",
        cta_label: "Schedule Free Measurement",
        report_grade: context.report_grade ?? null,
        top_insight_count: context.top_insights?.length ?? 0,
      },
    });

    // TODO: wire this CTA to the PhoneCaptureForm / scheduling modal.
    // For now, this click only records phone-call intent tracking.
  };

  return (
    <section className="relative overflow-hidden px-4 pt-10 pb-40 md:px-8 md:pt-14 md:pb-32 bg-gradient-to-b from-slate-50 via-blue-50/60 to-slate-100">
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
          <div className="relative overflow-hidden rounded-[28px] bg-white/85 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/60 border border-white/70 backdrop-blur-xl md:p-7">
            <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/70 to-transparent" />

            <div className="flex items-start gap-4 md:gap-6">
              <div
                className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border md:h-20 md:w-20 ${
                  isRiskGrade ? "border-red-200 bg-red-50" : "border-blue-200 bg-blue-50"
                }`}
              >
                <span
                  className="font-display text-4xl font-black leading-none tracking-tight md:text-5xl"
                  style={{ color: gradeColor }}
                >
                  {context.report_grade}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-blue-600">Audit Result</p>
                <h2 className="font-display text-xl font-black tracking-tight text-slate-950 md:text-3xl">
                  High-risk quote signals found
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
                  We found issues that affect code confidence, product clarity, and negotiation leverage.
                </p>

                {topInsights.length > 0 && (
                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 md:mt-5">
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

            <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/80 px-3.5 py-2.5 text-xs font-semibold leading-5 text-blue-950 md:mt-5 md:px-4 md:py-3 md:text-sm md:leading-6">
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

        <div className="mt-10 rounded-[30px] border border-white/70 bg-white/90 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/60 backdrop-blur-xl md:p-8">
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
                    <span className="block text-[15px] font-semibold leading-snug text-slate-950">{config.label}</span>
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

      <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-32px)] max-w-[360px] -translate-x-1/2 md:left-auto md:right-6 md:max-w-[340px] md:translate-x-0">
        <div className="relative rounded-[28px] before:absolute before:inset-[-10px] before:-z-10 before:rounded-[32px] before:bg-[radial-gradient(circle_at_50%_50%,rgba(251,146,60,0.30),rgba(251,191,36,0.12),transparent_70%)] before:blur-xl">
          <button
            type="button"
            onClick={handleConsultationCtaClick}
            className="flex w-full items-center justify-between gap-4 rounded-[24px] border-2 border-amber-300/80 bg-white/95 px-5 py-4 text-left text-slate-950 shadow-[0_18px_50px_rgba(251,146,60,0.22),0_8px_24px_rgba(15,23,42,0.10)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-[0_22px_60px_rgba(251,146,60,0.30),0_10px_28px_rgba(15,23,42,0.12)] active:scale-[0.99]"
          >
            <span className="min-w-0">
              <span className="block text-[15px] font-black tracking-tight">Schedule Free Measurement</span>
              <span className="mt-1 block text-xs font-medium text-slate-500">
                Lock in your price right on the phone.
              </span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-amber-500" />
          </button>
        </div>
      </div>
    </section>
  );
}

