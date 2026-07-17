import { ArrowLeft } from "lucide-react";
import type { DiagnosisCode, DiagnosticConfig, DiagnosticContext } from "../types";
import { AdvisorBriefCard } from "./prescription/AdvisorBriefCard";
import { BetterQuoteProcessBlock } from "./prescription/BetterQuoteProcessBlock";
import { CounterOfferPanel } from "./prescription/CounterOfferPanel";
import { PrescriptionFinalCta } from "./prescription/PrescriptionFinalCta";
import { PrescriptionHero } from "./prescription/PrescriptionHero";
import { QuoteComparisonBlock } from "./prescription/QuoteComparisonBlock";
import { RecommendedPathCard } from "./prescription/RecommendedPathCard";

interface StepPrescriptionProps {
  activeConfig: DiagnosticConfig;
  primaryDiagnosis: DiagnosisCode;
  context: DiagnosticContext;
  secondaryClarifiers: string[];
  otherFreeText: string;
  windowStyles: string[];
  windowConcerns: string[];
  frameMaterial: string;
  contractorContext: string[];
  desiredNextMove: string[];
  counterOfferTerms: string[];
  counterOfferFreeText: string;
  hasCounterOffer: boolean;
  isSubmitting: boolean;
  submitError: string | null;
  onBack: () => void;
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
  contractorContext,
  desiredNextMove,
  counterOfferTerms,
  counterOfferFreeText,
  hasCounterOffer,
  isSubmitting,
  submitError,
  onBack,
  onSubmit,
  setCounterOfferFreeText,
  setCounterOfferTerms,
  toggleInArray,
}: StepPrescriptionProps) {
  return (
    <section className="relative py-12 md:py-16 px-4 sm:px-6 lg:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(37,99,235,0.1)_0%,transparent_55%),radial-gradient(ellipse_at_80%_100%,rgba(6,182,212,0.08)_0%,transparent_55%)]"
      />
      <div className="max-w-3xl mx-auto relative z-10 space-y-0">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 mb-8 md:mb-10 px-3 py-2 -ml-3 rounded-xl hover:bg-white/60 transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <PrescriptionHero
          reportGrade={context.report_grade}
          prescriptionSubhead={activeConfig.prescriptionSubhead}
        />

        <RecommendedPathCard activeConfig={activeConfig} />

        <AdvisorBriefCard
          activeConfig={activeConfig}
          secondaryClarifiers={secondaryClarifiers}
          otherFreeText={otherFreeText}
          windowConcerns={windowConcerns}
          windowStyles={windowStyles}
          frameMaterial={frameMaterial}
          contractorContext={contractorContext}
          desiredNextMove={desiredNextMove}
          onEdit={onBack}
        />

        <QuoteComparisonBlock
          topInsights={context.top_insights ?? []}
          primaryDiagnosis={primaryDiagnosis}
          mainConcernLabel={activeConfig.label}
          secondaryClarifiers={secondaryClarifiers}
          desiredNextMove={desiredNextMove}
        />

        <CounterOfferPanel
          primaryDiagnosis={primaryDiagnosis}
          counterOfferTerms={counterOfferTerms}
          counterOfferFreeText={counterOfferFreeText}
          hasCounterOffer={hasCounterOffer}
          setCounterOfferFreeText={setCounterOfferFreeText}
          setCounterOfferTerms={setCounterOfferTerms}
          toggleInArray={toggleInArray}
        />

        <BetterQuoteProcessBlock />

        <PrescriptionFinalCta
          context={context}
          hasCounterOffer={hasCounterOffer}
          isSubmitting={isSubmitting}
          submitError={submitError}
          onSubmit={onSubmit}
        />
      </div>
    </section>
  );
}
