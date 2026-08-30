/**

 * TopFindingsList — top 5 critical/high flag cards.

 * In preview mode renders blurred placeholder cards so PartialUnlockOverlay can sit on top.

 * Real flag data is NEVER passed in preview mode (orchestrator enforces this).

 */

import type { AnalysisFlag } from "@/hooks/useAnalysisData";

import { AlertTriangle, CircleDashed } from "lucide-react";

import { mapFlagSeverityToVisual, toneIconClass } from "./visualState";



interface Props {

  flags: AnalysisFlag[];

  blurred?: boolean;

  totalReviewCount?: number;

  /**

   * "summary" (default) preserves the legacy "Top Forensic Findings" framing.

   * "detail" reframes the full/unlocked heading as evidence detail behind the grade.

   */

  variant?: "summary" | "detail";

}



const PILLAR_LABELS: Record<string, string> = {

  safety_code: "Compliance",

  install_scope: "Install & Scope",

  price_fairness: "Financial Integrity",

  fine_print: "Financial Integrity",

  warranty: "Warranty",

};



const SEVERITY_LABELS: Record<"red" | "amber" | "green", string> = {

  red: "Critical",

  amber: "Warning",

  green: "Verified",

};



function resolveFlagSeverity(flag: AnalysisFlag | null): "red" | "amber" | "green" {

  if (!flag) return "red";

  if (flag.severity === "amber" || flag.severity === "green") return flag.severity;

  return "red";

}



function safeAggregateCount(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
}

export default function TopFindingsList({
  flags,
  blurred,
  totalReviewCount,
  variant = "summary",
}: Props) {
  const safeTotalReviewCount = safeAggregateCount(totalReviewCount);
  const showBlurredPreviewPlaceholders = Boolean(blurred && safeTotalReviewCount > 0);
  const showNeutralPreviewState = Boolean(blurred && safeTotalReviewCount === 0);

  // In preview/blurred mode, render skeleton placeholders (NOT real flags).

  const itemsToRender: (AnalysisFlag | null)[] = blurred
    ? showBlurredPreviewPlaceholders
      ? [null, null, null]
      : []
    : flags.slice(0, 5);



  // Detail framing only applies to the full/unlocked report (never the blurred preview).

  const isDetail = variant === "detail" && !blurred;



  return (

    <section>

      <div className="flex items-center gap-2 mb-1">

        <AlertTriangle size={14} className="text-[hsl(var(--fr-danger))]" aria-hidden="true" />

        <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">

          {isDetail ? "Detailed Findings" : blurred ? "Quote Review Items" : "Top Forensic Findings"}

        </h2>

      </div>

      <p className="text-sm mb-4 text-slate-300 sm:text-base font-semibold">

        {blurred

          ? showBlurredPreviewPlaceholders
            ? "Material concerns and clarifications were identified in this quote"
            : "No review items are indicated in this preview."
          : isDetail

            ? "The specific quote issues behind your grade."

            : "Plain-English breakdown of what we found in your contract"}

      </p>



      {showNeutralPreviewState ? (
        <article className="relative overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-950/60">
          <div className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <CircleDashed size={14} className="text-slate-400" aria-hidden="true" />
              <span className="text-sm sm:text-base font-bold text-white">
                No review items are previewed here
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[hsl(var(--fr-text-muted))] leading-relaxed">
              Category-level details are available in the full analysis after verification.
            </p>
          </div>
        </article>
      ) : (
        <div
          className={blurred ? "space-y-3 select-none pointer-events-none" : "space-y-3"}
          aria-hidden={blurred ? "true" : undefined}
        >
          {itemsToRender.map((flag, idx) => {
            const severity = resolveFlagSeverity(flag);
            const visual = mapFlagSeverityToVisual(severity);
            const severityLabel = SEVERITY_LABELS[severity];

            return (
              <article
                key={idx}
                className={`${visual.cardClass} overflow-hidden relative`}
                style={{
                  filter: blurred ? "blur(7px) saturate(85%)" : undefined,
                  minHeight: blurred ? 96 : undefined,
                }}
              >
                <div className="p-4 sm:p-5 pl-5 sm:pl-6">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <AlertTriangle
                      size={14}
                      className={toneIconClass(visual.tone)}
                      aria-hidden="true"
                    />

                    <span className={`text-sm sm:text-base font-bold ${visual.titleClass}`}>
                      {flag?.label ?? "Locked Review Item"}
                    </span>

                    <span
                      className={`ml-auto fr-mono text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider inline-block ${visual.pillClass}`}
                    >
                      {flag ? severityLabel : "Details Locked"}
                      {flag ? ` · ${PILLAR_LABELS[flag.pillar ?? ""] ?? flag.pillar}` : ""}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-[hsl(var(--fr-text-muted))] leading-relaxed">
                    {flag?.detail ??
                      "Verify your phone number to unlock what was found, why it matters, and the exact questions to ask before signing."}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
