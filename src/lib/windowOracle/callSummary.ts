import type {
  ConfidenceResult,
  MarketDistribution,
  OracleCallSummary,
} from "./types";

const FORBIDDEN_PHRASES = [
  "ripped off",
  "guarantee",
  "should cost exactly",
  "we can beat this",
] as const;

export function containsForbiddenLanguage(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_PHRASES.some((p) => lower.includes(p));
}

export function buildCallSummary(input: {
  confidence: ConfidenceResult;
  ppo: MarketDistribution;
  homeownerPpo: number | null | undefined;
  provenanceLabel: "quoted" | "verified sold";
}): OracleCallSummary {
  const { confidence, ppo, homeownerPpo } = input;
  const position = resolvePosition(homeownerPpo ?? null, ppo);

  const scriptLines: string[] = [
    `Confidence: ${confidence.level}`,
    `${confidence.sampleCount} comparable synthetic ${input.provenanceLabel} projects.`,
  ];

  if (ppo.median !== null) {
    scriptLines.push(`Median: $${formatMoney(ppo.median)} / opening`);
  }
  if (ppo.p25 !== null && ppo.p75 !== null) {
    scriptLines.push(
      `Typical middle 50%: $${formatMoney(ppo.p25)}–$${formatMoney(ppo.p75)}`,
    );
  }
  if (homeownerPpo !== null && homeownerPpo !== undefined) {
    scriptLines.push(
      `Homeowner quote: $${formatMoney(homeownerPpo)} / opening`,
    );
    scriptLines.push(`Position: ${positionLabel(position)}`);
  }

  let approvedInterpretation: string | null = null;
  if (
    position === "ABOVE_P75" &&
    confidence.level !== "INSUFFICIENT" &&
    confidence.sampleCount >= 5
  ) {
    approvedInterpretation =
      "This synthetic input appears materially above the middle of the fixture cohort for comparable projects.";
  } else if (
    position === "BELOW_P25" &&
    confidence.level !== "INSUFFICIENT" &&
    confidence.sampleCount >= 5
  ) {
    approvedInterpretation =
      "This synthetic input appears below the middle of the fixture cohort for comparable projects.";
  } else if (
    (position === "WITHIN_MIDDLE_50" || position === "AT_MEDIAN") &&
    confidence.level !== "INSUFFICIENT"
  ) {
    approvedInterpretation =
      "This synthetic input sits within the middle of the fixture cohort for comparable projects.";
  }

  if (
    approvedInterpretation &&
    containsForbiddenLanguage(approvedInterpretation)
  ) {
    approvedInterpretation = null;
  }

  return {
    confidenceLevel: confidence.level,
    sampleCount: confidence.sampleCount,
    medianPpo: ppo.median,
    p25: ppo.p25,
    p75: ppo.p75,
    homeownerPpo: homeownerPpo ?? null,
    position,
    scriptLines,
    approvedInterpretation,
  };
}

function resolvePosition(
  homeownerPpo: number | null,
  ppo: MarketDistribution,
): OracleCallSummary["position"] {
  if (
    homeownerPpo === null ||
    ppo.median === null ||
    ppo.p25 === null ||
    ppo.p75 === null
  ) {
    return "UNKNOWN";
  }
  if (homeownerPpo === ppo.median) return "AT_MEDIAN";
  if (homeownerPpo < ppo.p25) return "BELOW_P25";
  if (homeownerPpo > ppo.p75) return "ABOVE_P75";
  return "WITHIN_MIDDLE_50";
}

function positionLabel(position: OracleCallSummary["position"]): string {
  switch (position) {
    case "BELOW_P25":
      return "Below observed P25";
    case "WITHIN_MIDDLE_50":
      return "Within observed middle 50%";
    case "ABOVE_P75":
      return "Above observed P75";
    case "AT_MEDIAN":
      return "At observed median";
    default:
      return "Unknown";
  }
}

function formatMoney(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}
