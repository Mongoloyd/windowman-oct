/**
 * Quality rubric for Summary V1 Pass 2 evaluation.
 * Testable criteria for mocked/local summary generation harness.
 */
export const SUMMARY_QUALITY_RUBRIC_P2 = {
  GROUNDING:
    "Every factual statement must map to provided evidence keys in FullSummaryFactPackV1.",
  COMPRESSION:
    "summary_body contains 3–5 substantive sentences when status is ready.",
  PRIORITIZATION:
    "Most important existing findings appear first in summary_body.",
  BALANCE:
    "Meaningful positive evidence may be acknowledged when positive_findings is non-empty.",
  ACTIONABILITY:
    "One supported next step when action_questions is non-empty (action_step not null).",
  NO_INVENTION: "No facts, prices, savings, or outcomes outside the fact pack.",
  NO_MARKET_CLAIM: "No comparative language when benchmark_context is empty.",
  CTA_SEPARATION: "Gemini never writes the sales CTA — application copy only.",
} as const;

export type SummaryQualityRubricKey = keyof typeof SUMMARY_QUALITY_RUBRIC_P2;

export const SUMMARY_QUALITY_RUBRIC_KEYS = Object.keys(
  SUMMARY_QUALITY_RUBRIC_P2,
) as SummaryQualityRubricKey[];
