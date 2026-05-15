/**
 * ExecutiveSummaryBand — thin full-width strip that summarizes the audit verdict.
 *
 * Sits between the Top Forensic Findings block and the Scope Overview row.
 * Pure presentation. The issue count is derived from red + amber flag counts
 * and updates automatically once live OCR-derived data flows through.
 */
interface Props {
  flagRedCount: number;
  flagAmberCount: number;
  summary?: string | null;
}

const DEFAULT_SUMMARY =
  "This quote shows multiple high-risk issues, including contract traps and missing technical proof that should be resolved before signing.";

export default function ExecutiveSummaryBand({
  flagRedCount,
  flagAmberCount,
  summary,
}: Props) {
  const totalIssues = (flagRedCount ?? 0) + (flagAmberCount ?? 0);

  return (
    <section
      className="fr-card py-3 sm:py-4 px-5 sm:px-6"
      style={{ borderColor: "hsl(var(--fr-cyan) / 0.35)" }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-5">
        <h2 className="fr-mono text-[11px] font-bold text-[hsl(var(--fr-cyan))] whitespace-nowrap">
          ▦ EXECUTIVE SUMMARY
        </h2>

        <div className="flex-1 min-w-0">
          {totalIssues > 0 && (
            <p className="text-sm sm:text-base text-[hsl(var(--fr-text))] leading-snug">
              We found{" "}
              <span className="font-bold text-[hsl(var(--fr-danger))]">
                {totalIssues}
              </span>{" "}
              {totalIssues === 1 ? "issue" : "issues"} with your estimate.
            </p>
          )}
          <p className="text-sm sm:text-[15px] text-[hsl(var(--fr-text-muted))] leading-snug mt-1">
            {summary ?? DEFAULT_SUMMARY}
          </p>
        </div>
      </div>
    </section>
  );
}
