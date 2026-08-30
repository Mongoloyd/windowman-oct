/**
 * ExecutiveSummaryBand — thin full-width strip that summarizes the audit verdict.
 *
 * Sits between the Top Forensic Findings block and the Scope Overview row.
 * Pure presentation. The issue count is derived from red + amber flag counts
 * and updates automatically once live OCR-derived data flows through.
 */
import type { PillarScore } from "@/hooks/useAnalysisData";
import { formatContractorName } from "./utils/formatContractorName";

interface Props {
  accessLevel?: "preview" | "full";
  flagRedCount: number;
  flagAmberCount: number;
  contractorName?: string | null;
  pillarScores?: readonly PillarScore[];
  summary?: string | null;
}

const DEFAULT_SUMMARY =
  "This quote shows multiple high-risk issues, including contract traps and missing technical proof that should be resolved before signing.";

const CANONICAL_PILLARS = [
  ["safety_code", "Safety & Code"],
  ["install_scope", "Installation Scope"],
  ["price_fairness", "Price Clarity"],
  ["fine_print", "Fine Print"],
  ["warranty", "Warranty Coverage"],
] as const;

function joinCategoryLabels(labels: readonly string[]): string {
  if (labels.length === 1) return labels[0];
  return `${labels[0]} and ${labels[1]}`;
}

function isPillarStatus(value: string): value is PillarScore["status"] {
  return value === "pass" || value === "warn" || value === "fail" || value === "pending";
}

function previewSummary(
  contractorName: string | null | undefined,
  pillarScores: readonly PillarScore[] | undefined,
): string {
  const cleanContractorName = formatContractorName(contractorName, 80);
  const estimateLabel = cleanContractorName
    ? `${cleanContractorName}’s estimate`
    : "this estimate";

  const statusesByKey = new Map<string, PillarScore["status"]>();
  for (const pillar of pillarScores ?? []) {
    if (
      !CANONICAL_PILLARS.some(([key]) => key === pillar.key) ||
      !isPillarStatus(pillar.status)
    ) {
      continue;
    }
    if (statusesByKey.has(pillar.key)) {
      statusesByKey.set(pillar.key, "pending");
      continue;
    }
    statusesByKey.set(pillar.key, pillar.status);
  }

  const priorityCategories = (["fail", "warn"] as const)
    .flatMap((status) =>
      CANONICAL_PILLARS.flatMap(([key, label]) =>
        statusesByKey.get(key) === status ? [label] : [],
      ),
    )
    .slice(0, 2);

  if (priorityCategories.length > 0) {
    return `We analyzed ${estimateLabel}. The closest review is concentrated in ${joinCategoryLabels(priorityCategories)}. The full report explains what needs clarification and the questions to ask before signing.`;
  }

  return `We analyzed ${estimateLabel}. The full report explains exactly which details appear clear and the specific questions you should ask before signing.`;
}

export default function ExecutiveSummaryBand({
  accessLevel = "full",
  flagRedCount,
  flagAmberCount,
  contractorName,
  pillarScores,
  summary,
}: Props) {
  const isPreview = accessLevel === "preview";
  const totalIssues = (flagRedCount ?? 0) + (flagAmberCount ?? 0);

  return (
    <section
      className="fr-card py-3 sm:py-4 px-5 sm:px-6"
      style={{ borderColor: "hsl(var(--fr-cyan) / 0.35)" }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-5">
        <h2 className="fr-mono text-[11px] font-bold text-[hsl(var(--fr-cyan))] whitespace-nowrap">
          {isPreview ? "▦ QUOTE READINESS SUMMARY" : "▦ PLAIN-ENGLISH SUMMARY"}
        </h2>

        <div className="flex-1 min-w-0">
          {!isPreview && totalIssues > 0 && (
            <p className="text-sm sm:text-base text-[hsl(var(--fr-text))] leading-snug">
              We found{" "}
              <span className="font-bold text-[hsl(var(--fr-danger))]">
                {totalIssues}
              </span>{" "}
              {totalIssues === 1
                ? isPreview
                  ? "review item"
                  : "issue"
                : isPreview
                  ? "review items"
                  : "issues"}{" "}
              {isPreview ? "in your estimate." : "with your estimate."}
            </p>
          )}
          <p
            className={`text-sm sm:text-[15px] text-[hsl(var(--fr-text-muted))] leading-snug ${
              isPreview ? "" : "mt-1"
            }`}
          >
            {isPreview
              ? previewSummary(contractorName, pillarScores)
              : summary ?? DEFAULT_SUMMARY}
          </p>
        </div>
      </div>
    </section>
  );
}
