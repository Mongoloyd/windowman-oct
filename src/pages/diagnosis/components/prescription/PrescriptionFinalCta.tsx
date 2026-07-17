import { AlertCircle, ArrowRight, BadgeCheck, Lock, PhoneCall } from "lucide-react";
import { maskEmail, maskPhone } from "../../lib/formatters";
import {
  bodyMuted,
  finalCtaCard,
  innerPanelElevated,
  primaryCta,
  primaryCtaDisabled,
  sectionHeadline,
  sectionLabel,
} from "./prescriptionTokens";
import type { DiagnosticContext } from "../../types";

interface PrescriptionFinalCtaProps {
  context: DiagnosticContext;
  hasCounterOffer: boolean;
  isSubmitting: boolean;
  submitError: string | null;
  onSubmit: (e: React.FormEvent) => void;
}

export function PrescriptionFinalCta({
  context,
  hasCounterOffer,
  isSubmitting,
  submitError,
  onSubmit,
}: PrescriptionFinalCtaProps) {
  const ctaEnabled = hasCounterOffer && !isSubmitting;

  return (
    <div className={`${finalCtaCard} p-7 md:p-10 relative overflow-hidden`}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-400 via-blue-600 to-cyan-500"
      />

      <div
        className={`${innerPanelElevated} flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 mb-8 border-emerald-200/90 bg-gradient-to-r from-emerald-50/90 to-white/80`}
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-b from-emerald-500 to-emerald-600 flex items-center justify-center shadow-[0_8px_20px_rgba(16,185,129,0.3)]">
            <BadgeCheck className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <p className={`${sectionLabel} text-emerald-800/90 mb-1`}>Verified Profile</p>
            <p className="text-sm md:text-[0.95rem] text-slate-800 leading-snug">
              <span className="font-bold">{context.first_name}</span>
              <span className="text-slate-400 mx-1.5">·</span>
              <span className="font-mono font-medium">{maskPhone(context.phone)}</span>
              <span className="text-slate-400 mx-1.5">·</span>
              <span className="font-medium">{maskEmail(context.email)}</span>
            </p>
          </div>
        </div>
      </div>

      <p className={`${sectionLabel} mb-2`}>Final Step</p>
      <h3 className={`${sectionHeadline} text-xl md:text-2xl lg:text-[1.65rem] mb-3 leading-tight`}>
        Ready for a Better Quote Conversation?
      </h3>
      <p className={`${bodyMuted} mb-7 max-w-2xl`}>
        Your request includes your quote report, risk findings, and preferences, so WindowMan has the
        context needed to follow up.
      </p>

      <div className={`${innerPanelElevated} flex items-start gap-4 p-5 md:p-6 mb-8`}>
        <div className="shrink-0 w-11 h-11 rounded-2xl bg-gradient-to-b from-blue-500 to-blue-700 flex items-center justify-center shadow-[0_6px_18px_rgba(37,99,235,0.3)]">
          <PhoneCall className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-slate-900 text-sm md:text-base">
            Your request includes your report and answers
          </p>
          <p className={`${bodyMuted} mt-1.5`}>
            No repeating yourself · your report and answers stay attached
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="rounded-2xl border border-blue-100/80 bg-white/50 p-5 md:p-6">
        <button
          type="submit"
          disabled={!ctaEnabled}
          className={ctaEnabled ? primaryCta : primaryCtaDisabled}
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Sending your request...
            </>
          ) : (
            <>
              Request a Call From WindowMan
              <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
            </>
          )}
        </button>
        {submitError && (
          <p
            role="alert"
            aria-live="assertive"
            className="flex items-start justify-center gap-2 text-sm text-red-600 text-center mt-4 font-medium"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </p>
        )}
        {!hasCounterOffer && !isSubmitting && (
          <p className="text-sm text-slate-500 text-center mt-4 font-medium">
            Pick at least one term your advisor should fight for.
          </p>
        )}
        {hasCounterOffer && !isSubmitting && (
          <p className="flex items-center justify-center gap-2 text-xs text-slate-500 text-center mt-4">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            No obligation. No contract. Just a real conversation.
          </p>
        )}
      </form>
    </div>
  );
}
