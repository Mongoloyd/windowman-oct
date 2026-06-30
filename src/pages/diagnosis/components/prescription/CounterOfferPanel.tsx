import { Check, MessageSquareQuote } from "lucide-react";
import { BRANCH_DYNAMIC_CHIPS, generateConditionalStatement } from "../../constants/branchChips";
import { DIAGNOSTIC_MAP } from "../../constants/diagnosticMap";
import {
  bodyMuted,
  chipSelected,
  chipUnselected,
  counterOfferCard,
  innerPanelElevated,
  sectionGap,
  sectionHeadline,
  sectionLabel,
} from "./prescriptionTokens";
import type { DiagnosisCode } from "../../types";

interface CounterOfferPanelProps {
  primaryDiagnosis: DiagnosisCode;
  counterOfferTerms: string[];
  counterOfferFreeText: string;
  hasCounterOffer: boolean;
  setCounterOfferFreeText: (v: string) => void;
  setCounterOfferTerms: React.Dispatch<React.SetStateAction<string[]>>;
  toggleInArray: (
    arr: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    value: string,
  ) => void;
}

export function CounterOfferPanel({
  primaryDiagnosis,
  counterOfferTerms,
  counterOfferFreeText,
  hasCounterOffer,
  setCounterOfferFreeText,
  setCounterOfferTerms,
  toggleInArray,
}: CounterOfferPanelProps) {
  return (
    <div className={`${counterOfferCard} ${sectionGap} p-7 md:p-9`}>
      <div className="mb-6">
        <p className={`${sectionLabel} mb-2`}>Your Terms</p>
        <h3 className={`${sectionHeadline} text-xl md:text-2xl lg:text-[1.65rem] mb-2.5 leading-tight`}>
          What Would Make This Quote Worth Saying Yes To?
        </h3>
        <p className={bodyMuted}>
          Pick the terms your advisor should fight for before you accept another quote.
        </p>
      </div>

      <div className="rounded-2xl border border-blue-100/80 bg-white/60 p-4 md:p-5 mb-6">
        <div className="flex flex-wrap gap-2.5 md:gap-3">
          {BRANCH_DYNAMIC_CHIPS[primaryDiagnosis].map((term) => {
            const isSelected = counterOfferTerms.includes(term);
            return (
              <button
                key={term}
                type="button"
                onClick={() => toggleInArray(counterOfferTerms, setCounterOfferTerms, term)}
                className={`inline-flex items-center gap-2 px-4 py-3.5 text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 ${
                  isSelected ? chipSelected : chipUnselected
                }`}
              >
                {isSelected ? <Check className="w-4 h-4 text-blue-600 shrink-0" strokeWidth={2.5} /> : null}
                {term}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className={`${innerPanelElevated} p-5 md:p-6 mb-6 ${
          hasCounterOffer ? "ring-2 ring-blue-200/60 border-blue-200/80" : ""
        }`}
      >
        <p className={`${sectionLabel} mb-3 flex items-center gap-2 text-[10px]`}>
          <MessageSquareQuote className="w-4 h-4 text-blue-600" />
          Here&apos;s what you&apos;re saying
        </p>
        <blockquote
          className={`text-sm md:text-lg leading-relaxed transition-all ${
            hasCounterOffer ? "text-slate-900 italic font-medium" : "text-slate-500 italic"
          }`}
        >
          {generateConditionalStatement(DIAGNOSTIC_MAP[primaryDiagnosis].label, counterOfferTerms)}
        </blockquote>
      </div>

      <details className="group rounded-2xl border border-slate-200/70 bg-white/50 px-4 py-3 open:pb-4 open:shadow-inner">
        <summary className="text-sm font-semibold text-slate-600 hover:text-slate-900 cursor-pointer select-none list-none inline-flex items-center gap-1.5 py-1">
          <span className="group-open:rotate-90 transition-transform inline-block text-blue-600">›</span>
          Anything specific your advisor should know? (optional)
        </summary>
        <textarea
          value={counterOfferFreeText}
          onChange={(e) => setCounterOfferFreeText(e.target.value)}
          rows={3}
          placeholder="Example: 'If you can beat $18,400 with the same warranty, I'll sign this week.'"
          className="mt-3 w-full rounded-2xl border border-slate-200/90 bg-white px-4 py-3.5 outline-none transition-all resize-none text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 shadow-[inset_0_1px_3px_rgba(15,23,42,0.04)]"
        />
      </details>
    </div>
  );
}
