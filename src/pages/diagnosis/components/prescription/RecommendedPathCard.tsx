import { CheckCircle, ShieldCheck } from "lucide-react";
import {
  iconFrame,
  innerPanelElevated,
  pathCard,
  sectionGap,
  sectionHeadline,
  sectionLabel,
} from "./prescriptionTokens";
import type { DiagnosticConfig } from "../../types";

interface RecommendedPathCardProps {
  activeConfig: DiagnosticConfig;
}

export function RecommendedPathCard({ activeConfig }: RecommendedPathCardProps) {
  return (
    <div className={`${pathCard} ${sectionGap} p-7 md:p-9`}>
      <div className="flex items-start gap-4 mb-7 pb-6 border-b border-blue-100/80">
        <div className={`${iconFrame} w-12 h-12`}>
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <div className="min-w-0 pt-0.5">
          <p className={`${sectionLabel} mb-2`}>Recommended Path</p>
          <h3 className={`${sectionHeadline} text-xl md:text-2xl lg:text-[1.65rem] leading-tight`}>
            Better Quote Strategy · {activeConfig.guaranteeTitle}
          </h3>
        </div>
      </div>
      <ul className="space-y-3.5">
        {activeConfig.guarantees.map((item, index) => (
          <li
            key={item}
            className={`${innerPanelElevated} flex items-start gap-4 p-4 md:p-5 transition-shadow hover:shadow-[0_6px_24px_rgba(37,99,235,0.1)]`}
          >
            <span className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              {index + 1}
            </span>
            <CheckCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <span className="text-sm md:text-base text-slate-700 leading-relaxed font-medium">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
