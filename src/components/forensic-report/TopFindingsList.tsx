/**
 * TopFindingsList — top 3 critical/high flag cards.
 * In preview mode renders blurred placeholder cards so PartialUnlockOverlay can sit on top.
 * Real flag data is NEVER passed in preview mode (orchestrator enforces this).
 */
import type { AnalysisFlag } from "@/hooks/useAnalysisData";
import { AlertTriangle } from "lucide-react";

interface Props {
  flags: AnalysisFlag[];
  blurred?: boolean;
  totalRedCount?: number;
}

const PILLAR_LABELS: Record<string, string> = {
  safety_code: "Compliance",
  install_scope: "Install & Scope",
  price_fairness: "Financial Integrity",
  fine_print: "Financial Integrity",
  warranty: "Warranty",
};

type Severity = "red" | "amber" | "blue" | "green";

function severityToken(sev: Severity): { var: string; label: string } {
  switch (sev) {
    case "amber":
      return { var: "--fr-caution", label: "Warning" };
    case "blue":
      return { var: "--fr-cyan-soft", label: "Info" };
    case "green":
      return { var: "--fr-success", label: "Verified" };
    default:
      return { var: "--fr-danger", label: "Critical" };
  }
}

export default function TopFindingsList({ flags, blurred, totalRedCount }: Props) {
  // In preview/blurred mode, render skeleton placeholders (NOT real flags).
  const itemsToRender: (AnalysisFlag | null)[] = blurred
    ? [null, null, null]
    : flags.slice(0, 5);

  return (
    <section>
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle size={14} className="text-[hsl(var(--fr-danger))]" />
        <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
          Top Forensic Findings
        </h2>
      </div>
      <p className="text-xs sm:text-sm text-slate-400 mb-4">
        {blurred
          ? totalRedCount != null
            ? `${Math.min(3, totalRedCount)} critical red flags identified in your quote`
            : "The 3 most critical red flags in your quote"
          : "Plain-English breakdown of what we found in your contract"}
      </p>

      <div className={blurred ? "space-y-3 select-none pointer-events-none" : "space-y-3"}>
        {itemsToRender.map((flag, idx) => {
          const sev = severityToken((flag?.severity as Severity) ?? "red");
          return (
            <article
              key={idx}
              className="fr-card overflow-hidden relative"
              style={{
                borderColor: `hsl(var(${sev.var}) / 0.4)`,
                filter: blurred ? "blur(6px)" : undefined,
              }}
            >
              <div
                className="absolute left-0 top-0 bottom-0 w-[3px]"
                style={{
                  background: `hsl(var(${sev.var}))`,
                  boxShadow: `0 0 10px hsl(var(${sev.var}) / 0.6)`,
                }}
              />
              <div className="p-4 sm:p-5 pl-5 sm:pl-6">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <AlertTriangle size={14} style={{ color: `hsl(var(${sev.var}))` }} />
                  <span className="text-sm sm:text-base font-bold text-[hsl(var(--fr-text))]">
                    {flag?.label ?? "Hidden Finding Placeholder"}
                  </span>
                  <span
                    className="ml-auto fr-mono text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider"
                    style={{
                      background: `hsl(var(${sev.var}) / 0.12)`,
                      color: `hsl(var(${sev.var}))`,
                    }}
                  >
                    {sev.label}
                    {flag ? ` · ${PILLAR_LABELS[flag.pillar] ?? flag.pillar}` : ""}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[hsl(var(--fr-text-muted))] leading-relaxed">
                  {flag?.detail ??
                    "Verify your phone number to view the detailed finding, evidence, and benchmark for this critical signal."}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
