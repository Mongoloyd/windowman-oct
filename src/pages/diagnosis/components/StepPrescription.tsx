import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Lock,
  ShieldCheck,
  Edit3,
  PhoneCall,
  Asterisk,
  BadgeCheck,
  MessageSquareQuote,
} from "lucide-react";
import { BRANCH_DYNAMIC_CHIPS, generateConditionalStatement } from "../constants/branchChips";
import { DIAGNOSTIC_MAP } from "../constants/diagnosticMap";
import { getSLAPromise } from "../lib/sla";
import { maskPhone, maskEmail } from "../lib/formatters";
import type { DiagnosisCode, DiagnosticConfig, DiagnosticContext } from "../types";

interface StepPrescriptionProps {
  activeConfig: DiagnosticConfig;
  primaryDiagnosis: DiagnosisCode;
  context: DiagnosticContext;
  secondaryClarifiers: string[];
  otherFreeText: string;
  windowStyles: string[];
  windowConcerns: string[];
  frameMaterial: string;
  counterOfferTerms: string[];
  counterOfferFreeText: string;
  hasCounterOffer: boolean;
  isSubmitting: boolean;
  onBack: () => void;
  onContactEdit: () => void;
  onSubmit: (e: React.FormEvent) => void;
  setCounterOfferFreeText: (v: string) => void;
  setCounterOfferTerms: React.Dispatch<React.SetStateAction<string[]>>;
  toggleInArray: (arr: string[], setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) => void;
}

export function StepPrescription({
  activeConfig,
  primaryDiagnosis,
  context,
  secondaryClarifiers,
  otherFreeText,
  windowStyles,
  windowConcerns,
  frameMaterial,
  counterOfferTerms,
  counterOfferFreeText,
  hasCounterOffer,
  isSubmitting,
  onBack,
  onContactEdit,
  onSubmit,
  setCounterOfferFreeText,
  setCounterOfferTerms,
  toggleInArray,
}: StepPrescriptionProps) {
  return (
    <section className="relative py-12 px-6" style={{ background: "transparent" }}>
      {/* Soft cobalt ambient */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 20% 0%, rgba(30,80,180,0.07) 0%, transparent 55%), radial-gradient(ellipse at 80% 100%, rgba(6,182,212,0.06) 0%, transparent 55%)",
        }}
      />
      <div className="max-w-3xl mx-auto relative z-10">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* Dynamic Headline */}
        <div className="mb-8 text-center">
          <div
            className={`inline-flex items-center gap-2 ${activeConfig.accentBg} ${activeConfig.accent} px-4 py-1.5 rounded-full text-sm font-medium mb-5 border ${activeConfig.accentBorder}`}
          >
            <activeConfig.Icon className="w-4 h-4" />
            Prescribed For You
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-foreground mb-4 leading-tight">
            {activeConfig.prescriptionHeadline}
          </h2>
          <p className="text-base md:text-lg text-foreground/75 max-w-2xl mx-auto">
            {activeConfig.prescriptionSubhead}
          </p>
        </div>

        {/* Prescribed Guarantee */}
        <div className="card-raised-hero rounded-2xl p-6 md:p-8 mb-6 border-8 border-double">
          <div className="flex items-center gap-3 mb-5">
            <ShieldCheck className={`w-7 h-7 ${activeConfig.accent}`} />
            <h3 className="font-display font-extrabold tracking-tight text-foreground text-2xl">
              {activeConfig.guaranteeTitle}
            </h3>
          </div>
          <ul className="space-y-3">
            {activeConfig.guarantees.map((g, i) => (
              <li key={i} className="flex items-start gap-3">
                <CheckCircle className={`w-5 h-5 ${activeConfig.accent} shrink-0 mt-0.5`} />
                <span className="text-foreground/85 text-base">{g}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* MIRROR PANEL — reflects everything they told us */}
        <div
          className="card-raised rounded-2xl p-6 md:p-8 mb-8 border-8 border-double"
          style={{
            background: "linear-gradient(180deg, rgba(219,234,254,0.45) 0%, rgba(239,246,255,0.65) 100%)",
            borderColor: "hsl(217 91% 53% / 0.18)",
          }}
        >
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{
                  background: "linear-gradient(180deg, #6bb8ff 0%, #3b82f6 40%, #1d4ed8 100%)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 6px rgba(37,99,235,0.25)",
                }}
              >
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-display font-extrabold tracking-tight text-foreground text-2xl">
                Here's What We Heard
              </h3>
            </div>
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1 text-xs font-medium text-cobalt hover:text-cobalt-dim transition-colors px-2 py-1 rounded-md hover:bg-white/60"
              aria-label="Edit your selections"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <p className="wm-eyebrow uppercase text-muted-foreground mb-1 text-sm">Your Frustration</p>
              <p className="text-foreground font-medium text-lg">{activeConfig.label}</p>
            </div>

            {secondaryClarifiers.length > 0 && (
              <div>
                <p className="wm-eyebrow uppercase text-muted-foreground mb-1 text-sm">Specifically</p>
                <div className="flex flex-wrap gap-1.5">
                  {secondaryClarifiers.map((c) => (
                    <span
                      key={c}
                      className="inline-block px-3 py-1 bg-white border border-cobalt/20 rounded-full font-medium text-foreground/80 text-sm"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {otherFreeText && (
              <div>
                <p className="wm-eyebrow uppercase text-muted-foreground mb-1 text-sm">In Your Words</p>
                <p className="text-foreground/80 italic font-medium">"{otherFreeText}"</p>
              </div>
            )}

            {windowStyles.length > 0 && (
              <div>
                <p className="wm-eyebrow uppercase text-muted-foreground mb-2 text-sm">Window Styles</p>
                <div className="flex flex-wrap gap-1.5">
                  {windowStyles.map((s) => (
                    <span
                      key={s}
                      className="inline-block px-3 py-1 bg-white border border-cobalt/20 rounded-full font-medium text-foreground/80 text-sm"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {windowConcerns.length > 0 && (
              <div>
                <p className="wm-eyebrow uppercase text-muted-foreground mb-2 text-sm">What Matters</p>
                <div className="flex flex-wrap gap-1.5">
                  {windowConcerns.map((c) => (
                    <span
                      key={c}
                      className="inline-block px-3 py-1 bg-white border border-emerald/30 rounded-full font-medium text-foreground/80 text-sm"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {frameMaterial && (
              <div>
                <p className="wm-eyebrow uppercase text-muted-foreground mb-1 text-sm">Frame Material</p>
                <span className="inline-block px-3 py-1 bg-white border border-cobalt/20 rounded-full font-medium text-foreground/80 text-sm">
                  {frameMaterial}
                </span>
              </div>
            )}
          </div>

          <p className="text-foreground/70 mt-6 pt-5 border-t border-cobalt/15 font-semibold text-base">
            Your advisor gets all of this upfront—so your next conversation starts where this one left off.
          </p>
        </div>

        {/* NO-FORM VERIFIED PROFILE BADGE */}
        <div className="card-raised-hero rounded-2xl p-6 md:p-8 border-double border-cobalt/15 border-8">
          {/* Verified Profile Header */}
          <div
            className="flex items-center justify-between gap-3 p-4 mb-6 rounded-xl"
            style={{
              background: "linear-gradient(180deg, hsl(160 75% 95%) 0%, hsl(160 84% 92%) 100%)",
              border: "1px solid hsl(160 84% 39% / 0.3)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                style={{
                  background:
                    "linear-gradient(180deg, hsl(160 75% 48%) 0%, hsl(160 84% 39%) 50%, hsl(160 84% 32%) 100%)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 6px hsla(160 84% 39% / 0.25)",
                }}
              >
                <BadgeCheck className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="wm-eyebrow uppercase text-emerald mb-0.5" style={{ color: "hsl(160 84% 28%)" }}>
                  Verified Profile
                </p>
                <p className="text-sm text-foreground/85 truncate">
                  <span className="font-semibold">{context.first_name}</span>
                  <span className="text-muted-foreground mx-1.5">•</span>
                  <span className="font-mono">{maskPhone(context.phone)}</span>
                  <span className="text-muted-foreground mx-1.5">•</span>
                  <span>{maskEmail(context.email)}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onContactEdit}
              className="shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md hover:bg-white/60 transition-colors"
              style={{ color: "hsl(160 84% 28%)" }}
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit
            </button>
          </div>

          {/* COUNTER-OFFER PANEL — The Money Question */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{
                  background: "linear-gradient(180deg, hsl(38 92% 60%) 0%, hsl(38 92% 50%) 100%)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 6px hsla(38 92% 50% / 0.25)",
                }}
              >
                <Asterisk className="w-4 h-4 text-white" />
              </div>
              <p className="wm-eyebrow uppercase text-lg" style={{ color: "hsl(38 92% 32%)" }}>
                The Money Question
              </p>
            </div>
            <h3 className="font-display font-extrabold tracking-tight text-foreground text-2xl mb-2">
              What Would Get You To "Yes"? Here's Your Chance
            </h3>
            <p className="text-sm text-foreground/75 mb-5 font-bold">
              Tap everything that would make you move forward. Your advisor walks into the contractor call with these as
              non-negotiables on your behalf.
            </p>

            <div className="flex flex-wrap gap-2 mb-5">
              {BRANCH_DYNAMIC_CHIPS[primaryDiagnosis].map((term) => {
                const isSelected = counterOfferTerms.includes(term);
                return (
                  <button
                    key={term}
                    type="button"
                    onClick={() => toggleInArray(counterOfferTerms, setCounterOfferTerms, term)}
                    className={`px-4 py-2.5 rounded-full text-sm font-medium border-2 transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-amber-500/50 ${
                      isSelected
                        ? "bg-amber-50 border-amber-500 text-amber-900 shadow-sm"
                        : "bg-white border-border text-foreground/80 hover:border-amber-300 hover:bg-amber-50/30"
                    }`}
                  >
                    {term}
                  </button>
                );
              })}
            </div>

            {/* LIVE CONDITIONAL STATEMENT — updates as chips toggle */}
            <div className="mb-5">
              <p className="wm-eyebrow uppercase text-muted-foreground mb-2 flex items-center gap-1.5 font-semibold text-sm">
                <MessageSquareQuote className="w-3.5 h-3.5" />
                Here's what you're saying
              </p>
              <blockquote
                className={`border-l-4 pl-5 pr-4 py-4 rounded-r-lg text-base leading-relaxed transition-all ${
                  hasCounterOffer
                    ? "border-amber-500 bg-amber-50/70 text-foreground italic"
                    : "border-border bg-muted/40 text-muted-foreground italic"
                }`}
              >
                {generateConditionalStatement(DIAGNOSTIC_MAP[primaryDiagnosis].label, counterOfferTerms)}
              </blockquote>
            </div>

            {/* Optional free-text — advisor context only, not part of the statement */}
            <details className="group">
              <summary className="font-medium text-muted-foreground hover:text-foreground cursor-pointer select-none list-none inline-flex items-center gap-1 text-base">
                <span className="group-open:rotate-90 transition-transform inline-block">›</span>
                Anything specific your advisor should know? (optional)
              </summary>
              <textarea
                value={counterOfferFreeText}
                onChange={(e) => setCounterOfferFreeText(e.target.value)}
                rows={3}
                placeholder="Example: 'If you can beat $18,400 with the same warranty, I'll sign this week.'"
                className="wm-input-well mt-3 w-full px-4 py-3 outline-none transition-all resize-none text-sm text-foreground placeholder:text-muted-foreground"
              />
            </details>
          </div>

          {/* SLA PROMISE — Trust Guardrail */}
          <div
            className="flex items-start gap-3 p-4 mb-5 rounded-xl"
            style={{
              background: "rgba(37,99,235,0.06)",
              border: "1px solid rgba(37,99,235,0.18)",
            }}
          >
            <div
              className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center mt-0.5"
              style={{
                background: "linear-gradient(180deg, #6bb8ff 0%, #3b82f6 40%, #1d4ed8 100%)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 6px rgba(37,99,235,0.25)",
              }}
            >
              <PhoneCall className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground text-base">{getSLAPromise().text}</p>
              <p className="text-foreground/70 mt-1 leading-relaxed text-sm font-bold">
                Your advisor sees everything: your diagnosis, window preferences, and counter-offer terms. No repeating
                yourself.
              </p>
            </div>
          </div>

          {/* SINGLE-TAP CONFIRMATION */}
          <form onSubmit={onSubmit}>
            <button
              type="submit"
              disabled={!hasCounterOffer || isSubmitting}
              className={`btn-depth-primary w-full flex items-center justify-center gap-2 py-5 px-6 text-lg ${
                !hasCounterOffer || isSubmitting ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Notifying your advisor...
                </>
              ) : (
                <>
                  Yes, have someone call me
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
            {!hasCounterOffer && !isSubmitting && (
              <p className="text-xs text-muted-foreground text-center mt-3 italic">Tap What Would Get You To Yes.</p>
            )}
            {hasCounterOffer && !isSubmitting && (
              <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground text-center mt-3">
                <Lock className="w-3 h-3" />
                No obligation. No contract. Just a real conversation.
              </p>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
