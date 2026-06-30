import { useState } from "react";
import { ArrowRight, CheckCircle2, FileText } from "lucide-react";
import type { DiagnosticConfig, DiagnosticContext } from "../types";
import { PropertyAndConsentStep } from "@/components/HomeownerHumanContext/PropertyAndConsentStep";
import {
  finalCtaCard,
  heroCard,
  innerPanelElevated,
  PAGE_GRADIENT_CLASS,
  pathCard,
  sectionHeadline,
  sectionLabel,
} from "./prescription/prescriptionTokens";

interface SuccessScreenProps {
  context: DiagnosticContext;
  activeConfig: DiagnosticConfig | null;
  onReturn: () => void;
}

export function SuccessScreen({ context, activeConfig, onReturn }: SuccessScreenProps) {
  const [contextCaptured, setContextCaptured] = useState(false);
  const canCapture = !!context.lead_id && !!context.scan_session_id;

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center p-6 md:p-10 text-center relative overflow-hidden ${PAGE_GRADIENT_CLASS}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(37,99,235,0.1)_0%,transparent_55%),radial-gradient(ellipse_at_70%_80%,rgba(6,182,212,0.08)_0%,transparent_55%)]"
      />

      <div className={`${heroCard} p-8 md:p-12 max-w-md w-full relative z-10`}>
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-b from-blue-500 to-blue-700 flex items-center justify-center mb-7 shadow-[0_16px_40px_rgba(37,99,235,0.35)] ring-4 ring-white/80">
          <CheckCircle2 className="w-8 h-8 text-white" strokeWidth={2.5} />
        </div>
        <p className={`${sectionLabel} mb-3`}>Better Quote Path</p>
        <h2 className={`${sectionHeadline} text-2xl md:text-3xl lg:text-[2rem] mb-4 leading-tight`}>
          Your Better Quote Brief Is Saved
        </h2>
        <p className="text-slate-600 mb-8 leading-relaxed text-sm md:text-base max-w-sm mx-auto">
          WindowMan captured what was off in your quote and what you need in the next one. Your advisor
          brief is attached to your report.
        </p>

        {activeConfig && (
          <div className={`${pathCard} p-5 mb-6 text-left shadow-none border-blue-100/60`}>
            <p className={`${sectionLabel} mb-2 text-[10px]`}>Recommended Path</p>
            <p className="font-bold text-slate-900 text-base md:text-lg leading-snug">
              {activeConfig.guaranteeTitle}
            </p>
          </div>
        )}

        <div className={`${innerPanelElevated} p-5 md:p-6 mb-8 text-left`}>
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-11 h-11 rounded-2xl bg-gradient-to-b from-blue-500 to-blue-700 flex items-center justify-center shadow-[0_6px_18px_rgba(37,99,235,0.3)]">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className={`${sectionLabel} mb-1.5 text-[10px]`}>Next Step</p>
              <p className="text-base md:text-lg font-bold text-slate-900 leading-snug">
                Return to your Truth Report
              </p>
              <p className="text-sm mt-2 text-slate-600 leading-relaxed">
                Your better-quote brief is now attached. Revisit it any time before you sign.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onReturn}
          className="inline-flex items-center gap-2 text-blue-700 font-bold hover:text-blue-800 transition-colors text-sm md:text-base px-4 py-2 rounded-xl hover:bg-blue-50/80"
        >
          Use This Report Before I Sign
          <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
        </button>
      </div>

      {canCapture && !contextCaptured && (
        <div className={`relative z-10 mt-8 max-w-md w-full ${finalCtaCard} p-1`}>
          <PropertyAndConsentStep
            leadId={context.lead_id!}
            scanSessionId={context.scan_session_id!}
            onSubmitted={() => setContextCaptured(true)}
            onSkipped={() => setContextCaptured(true)}
          />
        </div>
      )}
    </div>
  );
}
