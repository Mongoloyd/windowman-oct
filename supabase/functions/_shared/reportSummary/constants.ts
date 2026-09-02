/** Bounded selection limits for FullSummaryFactPackV1. */
export const MAX_TOP_CONCERNS = 5;
export const MAX_POSITIVE_FINDINGS = 2;
export const MAX_MISSING_FINDINGS = 8;
export const MAX_ACTION_QUESTIONS = 3;

export const DOCUMENTED_STRENGTHS = [
  {
    evidence_key: "warranty_documented",
    headline: "Warranty terms are documented in the quote",
    when: (source: {
      has_warranty?: boolean | null;
    }) => source.has_warranty === true,
  },
  {
    evidence_key: "permits_addressed",
    headline: "Permit responsibility is mentioned in the quote",
    when: (source: { has_permits?: boolean | null }) =>
      source.has_permits === true,
  },
] as const;

export const ASK_BY_PILLAR: Record<string, string> = {
  safety_code:
    "Ask for written NOA numbers and DP ratings for every proposed product.",
  price_fairness:
    "Ask for itemized pricing per opening so each line can be checked.",
  warranty:
    "Ask for written manufacturer and labor warranty terms, including durations.",
  fine_print:
    "Ask for written cancellation, deposit, and change-order terms before signing.",
  install_scope:
    "Ask for a written scope covering permits, waterproofing, wall repair, and debris removal.",
};

export const DEFAULT_ACTION_QUESTION =
  "Ask the contractor to confirm this item in writing before you sign.";
