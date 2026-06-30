import type { ReactNode } from "react";
import { CheckCircle, Edit3 } from "lucide-react";
import {
  bodyMuted,
  briefCard,
  briefRow,
  chipPill,
  fieldValue,
  iconFrame,
  sectionGap,
  sectionHeadline,
  sectionLabel,
} from "./prescriptionTokens";
import type { DiagnosticConfig } from "../../types";

interface AdvisorBriefCardProps {
  activeConfig: DiagnosticConfig;
  secondaryClarifiers: string[];
  otherFreeText: string;
  windowConcerns: string[];
  windowStyles: string[];
  frameMaterial: string;
  contractorContext: string[];
  desiredNextMove: string[];
  onEdit: () => void;
}

function BriefSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className={`${briefRow} p-4 md:p-5`}>
      <p className={`${sectionLabel} mb-2.5 text-[10px]`}>{label}</p>
      {children}
    </div>
  );
}

export function AdvisorBriefCard({
  activeConfig,
  secondaryClarifiers,
  otherFreeText,
  windowConcerns,
  windowStyles,
  frameMaterial,
  contractorContext,
  desiredNextMove,
  onEdit,
}: AdvisorBriefCardProps) {
  return (
    <div className={`${briefCard} ${sectionGap} p-7 md:p-9`}>
      <div className="flex items-start justify-between gap-4 mb-7 pb-6 border-b border-slate-200/70">
        <div className="flex items-start gap-4 min-w-0">
          <div className={`${iconFrame} w-11 h-11`}>
            <CheckCircle className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className={`${sectionLabel} mb-1.5`}>Advisor Brief</p>
            <h3 className={`${sectionHeadline} text-xl md:text-2xl`}>Your Advisor Brief</h3>
            <p className={`${bodyMuted} mt-2.5 max-w-xl`}>
              This is what your WindowMan advisor will use so you do not have to repeat yourself.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-800 px-3 py-2 rounded-xl border border-blue-200/80 bg-white/90 hover:bg-blue-50/80 shadow-sm transition-all"
          aria-label="Edit your selections"
        >
          <Edit3 className="w-3.5 h-3.5" />
          Edit
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:gap-3.5">
        <BriefSection label="Main Concern">
          <p className={fieldValue}>{activeConfig.label}</p>
        </BriefSection>

        {secondaryClarifiers.length > 0 && (
          <BriefSection label="Specifically">
            <div className="flex flex-wrap gap-2">
              {secondaryClarifiers.map((item) => (
                <span key={item} className={chipPill}>
                  {item}
                </span>
              ))}
            </div>
          </BriefSection>
        )}

        {otherFreeText && (
          <BriefSection label="In Your Words">
            <p className="text-sm md:text-base text-slate-700 italic leading-relaxed font-medium">
              &ldquo;{otherFreeText}&rdquo;
            </p>
          </BriefSection>
        )}

        {windowConcerns.length > 0 && (
          <BriefSection label="Urgency & Motivation">
            <div className="flex flex-wrap gap-2">
              {windowConcerns.map((item) => (
                <span key={item} className={chipPill}>
                  {item}
                </span>
              ))}
            </div>
          </BriefSection>
        )}

        {windowStyles.length > 0 && (
          <BriefSection label="Timeline">
            <div className="flex flex-wrap gap-2">
              {windowStyles.map((item) => (
                <span key={item} className={chipPill}>
                  {item}
                </span>
              ))}
            </div>
          </BriefSection>
        )}

        {frameMaterial && (
          <BriefSection label="Decision Authority">
            <span className={chipPill}>{frameMaterial}</span>
          </BriefSection>
        )}

        {contractorContext.length > 0 && (
          <BriefSection label="Contractor Context">
            <div className="flex flex-wrap gap-2">
              {contractorContext.map((item) => (
                <span key={item} className={chipPill}>
                  {item}
                </span>
              ))}
            </div>
          </BriefSection>
        )}

        {desiredNextMove.length > 0 && (
          <BriefSection label="Desired Next Move">
            <div className="flex flex-wrap gap-2">
              {desiredNextMove.map((item) => (
                <span key={item} className={chipPill}>
                  {item}
                </span>
              ))}
            </div>
          </BriefSection>
        )}
      </div>
    </div>
  );
}
