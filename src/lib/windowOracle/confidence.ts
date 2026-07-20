import { dispersionRatio } from "./statistics";
import type {
  ConfidenceResult,
  MarketDistribution,
  OracleConfidencePolicy,
} from "./types";

export type ConfidenceInput = {
  sampleCount: number;
  distribution: MarketDistribution;
  geographyLevel: "zip" | "county" | "none" | "broadened";
  trustedPct: number | null;
  fallbackCount: number;
  mixedProductCategories: boolean;
};

/**
 * Deterministic confidence. Thresholds come from injected policy (fixture/test only until approved).
 */
export function evaluateOracleConfidence(
  input: ConfidenceInput,
  policy: OracleConfidencePolicy,
): ConfidenceResult {
  const reasons: string[] = [];
  let level: ConfidenceResult["level"];

  if (input.sampleCount <= policy.insufficientMax) {
    level = "INSUFFICIENT";
    reasons.push(`Sample count ${input.sampleCount} ≤ ${policy.insufficientMax}`);
  } else if (input.sampleCount <= policy.lowMax) {
    level = "LOW";
    reasons.push(`Sample count ${input.sampleCount} ≤ ${policy.lowMax}`);
  } else if (input.sampleCount <= policy.moderateMax) {
    level = "MODERATE";
    reasons.push(`Sample count ${input.sampleCount} ≤ ${policy.moderateMax}`);
  } else {
    level = "HIGH";
    reasons.push(`Sample count ${input.sampleCount} > ${policy.moderateMax}`);
  }

  const ratio = dispersionRatio(
    input.distribution.average,
    input.distribution.median,
  );
  const highPriceOutliersPresent =
    ratio !== null && ratio >= policy.outlierRatioThreshold;
  if (highPriceOutliersPresent) {
    reasons.push("HIGH-PRICE OUTLIERS PRESENT");
  }

  const median = input.distribution.median;
  const average = input.distribution.average;
  let tightDistribution = false;
  if (
    median !== null &&
    average !== null &&
    median > 0 &&
    Math.abs(average - median) / median <= policy.tightRelativeDelta
  ) {
    tightDistribution = true;
    reasons.push("TIGHT PRICE DISTRIBUTION");
  }

  // Degrade one step for weak geography / many fallbacks / low trust / mixed categories
  const degrade =
    (input.geographyLevel === "broadened" || input.geographyLevel === "none"
      ? 1
      : 0) +
    (input.fallbackCount >= 2 ? 1 : 0) +
    (input.trustedPct !== null && input.trustedPct < 0.5 ? 1 : 0) +
    (input.mixedProductCategories ? 1 : 0);

  if (degrade > 0 && level !== "INSUFFICIENT") {
    reasons.push(`Confidence degraded by ${degrade} factor(s)`);
    level = degradeLevel(level, degrade);
  }

  return {
    level,
    sampleCount: input.sampleCount,
    reasons,
    highPriceOutliersPresent,
    tightDistribution,
  };
}

function degradeLevel(
  level: ConfidenceResult["level"],
  steps: number,
): ConfidenceResult["level"] {
  const order: ConfidenceResult["level"][] = [
    "HIGH",
    "MODERATE",
    "LOW",
    "INSUFFICIENT",
  ];
  const idx = order.indexOf(level);
  return order[Math.min(order.length - 1, idx + steps)];
}
