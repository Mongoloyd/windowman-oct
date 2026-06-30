/**
 * SigningRiskSummary — compact "Your 3 Biggest Signing Risks" block.
 *
 * Pure presentation. Derives the top 3 risks from existing flags via
 * selectSigningRisks (red-by-pillar, then amber, with safe fallbacks).
 */
import { AlertTriangle, HelpCircle, ShieldAlert } from "lucide-react";
import type { AnalysisFlag } from "@/hooks/useAnalysisData";
import { selectSigningRisks, type SigningRisk } from "./utils/selectSigningRisks";

interface Props {
  flags?: AnalysisFlag[] | null;
}

function severityToken(severity: SigningRisk["severity"]): { var: string; label: string } {
  if (severity === "critical") return { var: "--fr-danger", label: "Critical" };
  return { var: "--fr-caution", label: "Warning" };
}

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
          const sev = severityToken(risk.severity);
          return (
            <article
              key={`${risk.title}-${idx}`}
              className="fr-card relative overflow-hidden p-4 sm:p-5 flex flex-col gap-3"
              style={{ borderColor: `hsl(var(${sev.var}) / 0.4)` }}
            >
              <div
                className="absolute left-0 top-0 bottom-0 w-[3px]"
                style={{
                  background: `hsl(var(${sev.var}))`,
                  boxShadow: `0 0 14px hsl(var(${sev.var}) / 0.6)`,
                }}
                aria-hidden
              />
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} style={{ color: `hsl(var(${sev.var}))` }} className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="fr-mono text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider"
                      style={{
                        background: `hsl(var(${sev.var}) / 0.12)`,
                        color: `hsl(var(${sev.var}))`,
                      }}
                    >
                      {sev.label}
                    </span>
                    <span className="fr-mono text-[10px] text-[hsl(var(--fr-text-dim))]">
                      Risk {idx + 1}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-[hsl(var(--fr-text))] leading-snug">
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

              <div className="mt-auto border-l-2 pl-3" style={{ borderColor: `hsl(var(${sev.var}) / 0.4)` }}>
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
