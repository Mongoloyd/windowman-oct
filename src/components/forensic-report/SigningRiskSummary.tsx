/**

 * SigningRiskSummary — compact "Your 3 Biggest Signing Risks" block.

 *

 * Pure presentation. Derives the top 3 risks from existing flags via

 * selectSigningRisks (red-by-pillar, then amber, with safe fallbacks).

 */

import { AlertTriangle, HelpCircle, ShieldAlert } from "lucide-react";

import type { AnalysisFlag } from "@/hooks/useAnalysisData";

import { selectSigningRisks } from "./utils/selectSigningRisks";

import { mapSigningRiskSeverityToVisual, toneIconClass } from "./visualState";



interface Props {

  flags?: AnalysisFlag[] | null;

}



const SEVERITY_LABELS: Record<"critical" | "warning", string> = {

  critical: "Critical",

  warning: "Warning",

};



export default function SigningRiskSummary({ flags }: Props) {

  const risks = selectSigningRisks(flags);



  return (

    <section aria-labelledby="signing-risk-heading">

      <div className="flex items-center gap-2 mb-1">

        <ShieldAlert size={16} className="text-[hsl(var(--fr-danger))]" />

        <h2

          id="signing-risk-heading"

          className="text-base sm:text-lg font-bold text-[hsl(var(--fr-text))] tracking-tight"

        >

          Your 3 Biggest Signing Risks

        </h2>

      </div>

      <p className="text-xs sm:text-sm mb-4 text-[hsl(var(--fr-text-muted))] font-medium leading-relaxed">

        Before you chase a better quote, make sure these problems do not follow you into the next one.

      </p>



      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">

        {risks.map((risk, idx) => {

          const visual = mapSigningRiskSeverityToVisual(risk.severity);



          return (

            <article

              key={`${risk.title}-${idx}`}

              className={`${visual.cardClass} relative overflow-hidden p-4 sm:p-5 flex flex-col gap-3`}

            >

              <div className="flex items-start gap-2">

                <AlertTriangle

                  size={14}

                  className={`mt-0.5 shrink-0 ${toneIconClass(visual.tone)}`}

                />

                <div className="min-w-0 flex-1">

                  <div className="flex items-center gap-2 mb-1">

                    <span

                      className={`fr-mono text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider inline-block ${visual.pillClass}`}

                    >

                      {SEVERITY_LABELS[risk.severity]}

                    </span>

                    <span className="fr-mono text-[10px] text-[hsl(var(--fr-text-dim))]">

                      Risk {idx + 1}

                    </span>

                  </div>

                  <h3 className={`text-sm font-bold leading-snug ${visual.titleClass}`}>

                    {risk.title}

                  </h3>

                </div>

              </div>



              <div>

                <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--fr-text-dim))] mb-1">

                  Why it matters

                </p>

                <p className="text-xs text-[hsl(var(--fr-text-muted))] leading-relaxed">{risk.why}</p>

              </div>



              <div className={`mt-auto pl-3 ${visual.accentClass}`}>

                <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--fr-text-dim))] mb-1 flex items-center gap-1">

                  <HelpCircle size={11} aria-hidden /> What to ask for next

                </p>

                <p className="text-xs font-medium text-[hsl(var(--fr-text))] leading-relaxed">

                  {risk.ask}

                </p>

              </div>

            </article>

          );

        })}

      </div>

    </section>

  );

}


