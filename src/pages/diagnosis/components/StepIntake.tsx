import { Bot, CheckCircle2, FileCheck2 } from "lucide-react";
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

  const headline = firstName ? `${firstName}, I’ve Got You.` : "I’ve Got You.";
  const subhead = "Your report is loaded. Choose the biggest problem — or let WindowMan guide the safest move.";

  let gradeLine = "Your quote has findings worth resolving before you commit.";
  let contextLine = "Your quote has findings worth resolving before you commit.";

  if (gradeKey === "D" || gradeKey === "F") {
    gradeLine = "This is not a maybe. This quote needs a safer move before you sign.";
    contextLine = `Your quote scored ${gradeKey}. WindowMan has the risk signals loaded.`;
  } else if (gradeKey === "B" || gradeKey === "C") {
    gradeLine = "This quote may be workable, but the weak spots need to be handled first.";
    contextLine = `Your quote scored ${gradeKey}. The weak spots need a cleaner next move.`;
  } else if (gradeKey === "A") {
    gradeLine = "This quote looks stronger than most. Let’s pressure-test the final details.";
    contextLine = "Your quote scored A. Now we pressure-test the final details.";
  }

  return { headline, subhead, gradeLine, contextLine };
}

export function StepIntake({ context, onSelectPrimary }: StepIntakeProps) {
  const gradeKey = context.report_grade?.[0]?.toUpperCase() ?? "F";
  const gradeColor = GRADE_COLORS[gradeKey] ?? GRADE_COLORS.F;
  const visibleInsights = context.top_insights.slice(0, 3);
  const copy = getPersonalizedDiagnosisCopy(context);

  return (
    <section
      className="relative overflow-hidden px-5 pt-8 pb-16 md:px-8 md:pt-12"
      style={{ background: "transparent" }}
    >
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
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(160deg, rgba(219,234,254,0.18) 0%, transparent 55%, rgba(186,230,255,0.10) 100%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-5xl">
        <div className="grid items-stretch gap-5 lg:grid-cols-[1.45fr_0.9fr] lg:gap-6">
          <div className="space-y-5">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border-2 border-blue-300 bg-white px-4 py-2 text-sm font-black text-slate-900 shadow-[0_10px_25px_rgba(15,23,42,0.08)]">
                <FileCheck2 className="h-4 w-4 text-blue-700" />
                Report Loaded. Strategy Builder Ready.
              </div>
              <h1 className="font-display text-4xl font-black leading-[0.96] tracking-tight text-slate-950 md:text-6xl">
                {copy.headline}
              </h1>
              <p className="mt-5 max-w-2xl text-lg font-bold leading-relaxed text-slate-800 md:text-xl">
                {copy.subhead}
              </p>
              <p className="mt-3 max-w-2xl text-base font-black leading-relaxed text-slate-950 md:text-lg">
                {copy.gradeLine}
              </p>
            </div>

            {context.report_grade && (
              <div
                className="rounded-3xl bg-white p-5 shadow-[0_22px_55px_rgba(15,23,42,0.14)] md:p-6"
                style={{
                  border: `2px solid ${gradeColor}33`,
                  boxShadow: `0 22px 55px rgba(15,23,42,0.14), 0 18px 46px -18px ${gradeColor}66`,
                }}
              >
                <div className="flex items-start gap-4 md:gap-5">
                  <div
                    className="flex aspect-square w-20 shrink-0 items-center justify-center rounded-2xl md:w-24"
                    style={{
                      background: `${gradeColor}12`,
                      border: `2px solid ${gradeColor}38`,
                    }}
                  >
                    <span
                      className="font-display text-5xl font-black leading-none md:text-6xl"
                      style={{ color: gradeColor }}
                    >
                      {context.report_grade}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="mb-1 text-xs font-black uppercase tracking-[0.18em] text-slate-700">
                      Your Audit Score
                    </p>
                    <p className="mb-4 text-base font-bold leading-relaxed text-slate-900">{copy.contextLine}</p>
                    {visibleInsights.length > 0 && (
                      <div className="grid gap-2">
                        {visibleInsights.map((insight, i) => (
                          <div
                            key={`${insight}-${i}`}
                            className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 animate-fade-in"
                            style={{
                              animationDelay: `${i * 120}ms`,
                              animationFillMode: "both",
                            }}
                          >
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
                            <span className="min-w-0">{insight}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-3 border-t border-slate-200 pt-4">
                  <span className="block h-4 w-1 rounded-full" style={{ background: gradeColor }} />
                  <p className="text-sm font-black text-slate-900">Report Loaded. Strategy Builder Ready.</p>
                </div>
              </div>
            )}
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-blue-300/30 bg-slate-950 p-5 text-white shadow-[0_24px_70px_rgba(15,23,42,0.28)] md:p-6">
            <div
              aria-hidden="true"
              className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-blue-400/25 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-orange-300/15 blur-3xl"
            />
            <div className="relative z-10 flex h-full min-h-[240px] flex-col justify-between gap-5">
              <div>
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-200/25 bg-blue-400/10 text-blue-100 shadow-sm">
                  <Bot className="h-6 w-6" />
                </div>
                <h2 className="font-display text-2xl font-black leading-tight text-white md:text-3xl">
                  WindowMan Has Your Report.
                </h2>
                <p className="mt-3 text-base font-bold leading-relaxed text-blue-50/90">
                  Pick The Problem. I’ll Build The Next Move.
                </p>
              </div>
              <div className="relative mx-auto flex w-full max-w-[220px] items-end justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-2">
                <img
                  src="/images/wman-reading.avif"
                  alt="WindowMan advisor reviewing a report"
                  className="max-h-[190px] w-full object-contain"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border-2 border-slate-200 bg-white/95 p-5 shadow-[0_20px_58px_rgba(15,23,42,0.12)] md:mt-10 md:p-8">
          <div className="mx-auto mb-6 max-w-3xl text-center">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-blue-700">Root Question</p>
            <h2 className="font-display text-2xl font-black tracking-tight text-slate-950 md:text-4xl">
              What Was The Biggest Problem With This Quote?
            </h2>
            <p className="mt-3 text-base font-bold leading-relaxed text-slate-700 md:text-lg">
              Choose the closest answer. We’ll turn it into your next move.
            </p>
          </div>

          <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
            {DIAGNOSIS_ORDER.map((code) => {
              const config = DIAGNOSTIC_MAP[code];
              const Icon = config.Icon;
              const isNotSure = code === "not_sure";
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => onSelectPrimary(code)}
                  className={`group flex min-h-[104px] w-full items-center gap-4 rounded-2xl border-2 border-slate-300 bg-white px-5 py-5 text-left shadow-[0_16px_38px_rgba(15,23,42,0.12)] transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-500 hover:shadow-[0_20px_48px_rgba(37,99,235,0.18)] focus:outline-none focus:ring-4 focus:ring-blue-500/20 active:scale-[0.99] ${isNotSure ? "sm:col-span-2" : ""}`}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 shadow-sm transition-colors group-hover:border-blue-300 group-hover:bg-blue-100">
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[16px] font-black leading-tight text-slate-950 md:text-[17px]">
                      {config.label}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-slate-600">{config.cardDescription}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
