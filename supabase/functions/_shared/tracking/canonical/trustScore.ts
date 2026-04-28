import { WM_TRUST_THRESHOLDS, WM_TRUST_WEIGHTS } from "./constants.ts";
import { evaluateAnomaly } from "./anomaly.ts";
import type {
  WMAnomalyStatus,
  WMTrustScoreInput,
  WMTrustScoreResult,
} from "./types.ts";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function weightedTrustScore(input: WMTrustScoreInput): number {
  const rawScore = input.ocrConfidence * WM_TRUST_WEIGHTS.ocrConfidence +
    input.completeness * WM_TRUST_WEIGHTS.completeness +
    input.mathConsistency * WM_TRUST_WEIGHTS.mathConsistency +
    input.cohortFit * WM_TRUST_WEIGHTS.cohortFit +
    input.scopeConsistency * WM_TRUST_WEIGHTS.scopeConsistency +
    input.documentValidity * WM_TRUST_WEIGHTS.documentValidity +
    input.identityStrength * WM_TRUST_WEIGHTS.identityStrength;

  return clamp01(rawScore);
}

function routeAnomalyStatus(
  trustScore: number,
  anomalyScore: number,
): WMAnomalyStatus {
  if (anomalyScore >= 0.95) return "reject";
  if (anomalyScore >= 0.75 || trustScore < WM_TRUST_THRESHOLDS.quarantine) {
    return "quarantine";
  }
  if (anomalyScore >= 0.4 || trustScore < WM_TRUST_THRESHOLDS.review) {
    return "review";
  }
  if (trustScore >= WM_TRUST_THRESHOLDS.safe && anomalyScore < 0.25) {
    return "safe";
  }
  return "review";
}

export function evaluateQuoteTrust(
  input: WMTrustScoreInput,
): WMTrustScoreResult {
  const reasons: string[] = [];
  let trustScore = weightedTrustScore(input);

  if (
    !input.isQuoteDocument ||
    /\b(?:invoice|receipt|brochure|ad|advert|advertisement|advertising)\b/i
      .test(input.documentType ?? "")
  ) {
    reasons.push("document_not_quote");
    return {
      trustScore: 0,
      anomalyScore: 1,
      anomalyStatus: "reject",
      manualReviewRequired: true,
      approvedForIndex: false,
      approvedForAds: false,
      reasons,
    };
  }

  if (input.impossibleValuesDetected) {
    reasons.push("impossible_values_detected");
    return {
      trustScore: 0,
      anomalyScore: 1,
      anomalyStatus: "reject",
      manualReviewRequired: true,
      approvedForIndex: false,
      approvedForAds: false,
      reasons,
    };
  }

  const anomaly = evaluateAnomaly({
    ...input.anomalyInput,
    impossibleValuesDetected: input.impossibleValuesDetected,
  });

  if (input.mathConsistency < 0.4) {
    trustScore = clamp01(trustScore - 0.25);
    reasons.push("severe_math_mismatch");
  }

  if (input.duplicateSuspected) {
    trustScore = clamp01(trustScore - 0.18);
    reasons.push("duplicate_suspected");
  }

  trustScore = clamp01(trustScore - anomaly.anomalyScoreContribution * 0.3);

  reasons.push(...anomaly.reasons);

  const anomalyScore = clamp01(
    anomaly.anomalyScoreContribution + (1 - trustScore) * 0.35,
  );
  const anomalyStatus = routeAnomalyStatus(trustScore, anomalyScore);

  const manualReviewRequired = anomalyStatus !== "safe";
  const approvedForIndex = anomalyStatus === "safe";
  const approvedForAds = anomalyStatus === "safe";

  return {
    trustScore,
    anomalyScore,
    anomalyStatus,
    manualReviewRequired,
    approvedForIndex,
    approvedForAds,
    reasons,
  };
}
