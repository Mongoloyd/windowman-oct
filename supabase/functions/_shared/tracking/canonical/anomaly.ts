import type { WMAnomalyInput, WMAnomalyResult } from "./types.ts";

const EPSILON = 1e-9;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function robustZScore(
  value: number,
  median: number,
  mad: number,
): number {
  if (mad <= EPSILON) return 0;
  return (0.6745 * (value - median)) / mad;
}

export function iqrFenceScore(value: number, p25: number, p75: number): number {
  const iqr = p75 - p25;
  if (iqr <= EPSILON) return 0;

  const lowerFence = p25 - 1.5 * iqr;
  const upperFence = p75 + 1.5 * iqr;

  if (value >= lowerFence && value <= upperFence) return 0;

  const distance = value < lowerFence ? lowerFence - value : value - upperFence;
  const normalized = distance / Math.max(iqr, 1);

  return clamp01(normalized / 3);
}

export function evaluateAnomaly(input: WMAnomalyInput): WMAnomalyResult {
  const reasons: string[] = [];
  let score = 0;

  const {
    quoteAmount,
    pricePerOpening,
    depositPercent,
    cohortStats,
    impossibleValuesDetected,
  } = input;

  if (impossibleValuesDetected) {
    reasons.push("impossible_values_detected");
    return { anomalyScoreContribution: 1, reasons };
  }

  if (typeof quoteAmount === "number" && quoteAmount <= 0) {
    reasons.push("quote_amount_non_positive");
    score += 0.8;
  }

  if (typeof pricePerOpening === "number" && pricePerOpening <= 0) {
    reasons.push("price_per_opening_non_positive");
    score += 0.8;
  }

  if (typeof depositPercent === "number") {
    if (depositPercent < 0 || depositPercent > 100) {
      reasons.push("deposit_percent_invalid");
      score += 1;
    } else if (depositPercent > 50) {
      reasons.push("deposit_percent_high");
      score += 0.35;
    }
  }

  if (typeof pricePerOpening === "number" && cohortStats) {
    if (
      typeof cohortStats.median === "number" &&
      typeof cohortStats.mad === "number"
    ) {
      const z = Math.abs(
        robustZScore(pricePerOpening, cohortStats.median, cohortStats.mad),
      );
      if (z >= 4.5) {
        reasons.push("price_per_opening_robust_z_extreme");
        score += 0.5;
      } else if (z >= 3) {
        reasons.push("price_per_opening_robust_z_high");
        score += 0.3;
      }
    }

    if (
      typeof cohortStats.p25 === "number" && typeof cohortStats.p75 === "number"
    ) {
      const fence = iqrFenceScore(
        pricePerOpening,
        cohortStats.p25,
        cohortStats.p75,
      );
      if (fence >= 0.6) {
        reasons.push("price_per_opening_outside_iqr_fence");
      }
      score += fence * 0.5;
    }

    if (
      typeof cohortStats.p10 === "number" &&
      typeof cohortStats.p90 === "number" &&
      (pricePerOpening < cohortStats.p10 || pricePerOpening > cohortStats.p90)
    ) {
      reasons.push("price_per_opening_outside_p10_p90");
      score += 0.2;
    }
  }

  return {
    anomalyScoreContribution: clamp01(score),
    reasons,
  };
}
