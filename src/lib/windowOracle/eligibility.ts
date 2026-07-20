import type {
  EligibilityDecision,
  OracleObservation,
  QuoteEligibilityInput,
  SoldEligibilityInput,
} from "./types";

export type EligibilityResult = {
  decision: EligibilityDecision;
  reasons: string[];
};

const BAD_ANOMALY = new Set(["reject", "quarantine"]);

/**
 * Quote observation trust gate. Caller supplies already-normalized facts.
 */
export function evaluateQuoteEligibility(
  input: QuoteEligibilityInput,
): EligibilityResult {
  const reasons: string[] = [];

  if (!input.analysisComplete) {
    return { decision: "EXCLUDE", reasons: ["ANALYSIS_NOT_COMPLETE"] };
  }
  if (!input.documentUsable) {
    return { decision: "EXCLUDE", reasons: ["DOCUMENT_NOT_USABLE"] };
  }
  if (input.quoteTotal === null || input.quoteTotal <= 0) {
    reasons.push("MISSING_QUOTE_TOTAL");
  }
  if (input.openingCount === null || input.openingCount <= 0) {
    reasons.push("MISSING_OPENING_COUNT");
  }
  if (input.ppo === null || input.ppo <= 0) {
    reasons.push("MISSING_OR_INVALID_PPO");
  }
  if (!input.hasGeography) {
    reasons.push("MISSING_GEOGRAPHY");
  }
  if (reasons.length) {
    return { decision: "EXCLUDE", reasons };
  }

  if (input.duplicateSuspected === true) {
    return { decision: "EXCLUDE", reasons: ["DUPLICATE_SUSPECTED"] };
  }
  if (input.impossibleValuesDetected === true) {
    return { decision: "EXCLUDE", reasons: ["IMPOSSIBLE_VALUES"] };
  }
  if (
    input.anomalyStatus &&
    BAD_ANOMALY.has(input.anomalyStatus.toLowerCase())
  ) {
    return { decision: "EXCLUDE", reasons: ["ANOMALY_REJECT"] };
  }
  if (input.manualReviewRequired === true) {
    return { decision: "EXCLUDE", reasons: ["MANUAL_REVIEW_REQUIRED"] };
  }
  if (input.approvedForIndex === false) {
    return { decision: "EXCLUDE", reasons: ["NOT_APPROVED_FOR_INDEX"] };
  }

  // approvedForIndex null → allow with REVIEW? Plan says preferred approved_for_index=true
  // but wm_quote_facts may be absent. Treat null as INCLUDE (optional support).
  return { decision: "INCLUDE", reasons: ["ELIGIBLE"] };
}

export function evaluateSoldEligibility(
  input: SoldEligibilityInput,
): EligibilityResult {
  if (!input.outcomeVerified) {
    return { decision: "EXCLUDE", reasons: ["OUTCOME_NOT_VERIFIED"] };
  }
  if (!input.hasCanonicalProjectLink) {
    return { decision: "EXCLUDE", reasons: ["MISSING_PROJECT_LINK"] };
  }
  if (input.finalSoldValue === null || input.finalSoldValue <= 0) {
    return { decision: "EXCLUDE", reasons: ["MISSING_FINAL_SOLD_VALUE"] };
  }
  if (input.openingCount === null || input.openingCount <= 0) {
    return { decision: "EXCLUDE", reasons: ["MISSING_OPENING_COUNT"] };
  }
  if (input.soldScopeComparable === false) {
    return { decision: "EXCLUDE", reasons: ["SOLD_SCOPE_NOT_COMPARABLE"] };
  }
  return { decision: "INCLUDE", reasons: ["ELIGIBLE"] };
}

/** Map an OracleObservation into quote eligibility facts. */
export function quoteEligibilityFromObservation(
  obs: OracleObservation,
): EligibilityResult {
  return evaluateQuoteEligibility({
    analysisComplete: true,
    documentUsable: true,
    quoteTotal: obs.projectTotal,
    openingCount: obs.openingCount,
    ppo: obs.ppo,
    hasGeography: Boolean(obs.zip || obs.county),
    approvedForIndex: obs.approvedForIndex,
    manualReviewRequired: obs.manualReviewRequired,
    duplicateSuspected: obs.duplicateSuspected,
    anomalyStatus: obs.anomalyStatus,
    impossibleValuesDetected: obs.anomalyStatus === "reject",
  });
}

export function soldEligibilityFromObservation(
  obs: OracleObservation,
): EligibilityResult {
  return evaluateSoldEligibility({
    outcomeVerified: obs.outcomeVerified === true,
    finalSoldValue: obs.projectTotal,
    openingCount: obs.openingCount,
    soldScopeComparable: obs.soldScopeComparable ?? true,
    hasCanonicalProjectLink: true,
  });
}
