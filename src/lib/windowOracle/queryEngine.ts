import { buildCallSummary } from "./callSummary";
import { evaluateOracleConfidence } from "./confidence";
import {
  quoteEligibilityFromObservation,
  soldEligibilityFromObservation,
} from "./eligibility";
import { broadenCohort } from "./fallback";
import {
  buildDistribution,
  quotedToSoldDeltaPct,
} from "./statistics";
import type {
  BrandSeriesStat,
  ContractorBenchmark,
  MarketDistribution,
  OracleConfidencePolicy,
  OracleObservation,
  OracleQueryRequest,
  OracleQueryResponse,
} from "./types";

export type RunOracleQueryInput = {
  observations: OracleObservation[];
  request: OracleQueryRequest;
  policy: OracleConfidencePolicy;
  /** Minimum samples before fallback stops (typically policy.insufficientMax + 1). */
  minSamplesForFallback?: number;
  nowMs?: number;
};

/**
 * Pure Oracle query orchestrator over pre-normalized observations.
 * Never mixes QUOTED and VERIFIED_SOLD into a single unlabeled distribution.
 */
export function runOracleQuery(input: RunOracleQueryInput): OracleQueryResponse {
  const { request, policy } = input;
  const minSamples = input.minSamplesForFallback ?? policy.insufficientMax + 1;

  const eligibilitySummary = {
    candidatesConsidered: 0,
    eligibleAfterTrustGates: 0,
    excludedManualReview: 0,
    excludedDuplicateSuspected: 0,
    excludedMissingPpo: 0,
    excludedOther: 0,
  };

  const eligible = input.observations.filter((obs) => {
    eligibilitySummary.candidatesConsidered += 1;
    const result =
      obs.provenance === "QUOTED"
        ? quoteEligibilityFromObservation(obs)
        : soldEligibilityFromObservation(obs);

    if (result.decision === "INCLUDE") {
      eligibilitySummary.eligibleAfterTrustGates += 1;
      return true;
    }

    const reasons = result.reasons.join(",");
    if (reasons.includes("MANUAL_REVIEW")) {
      eligibilitySummary.excludedManualReview += 1;
    } else if (reasons.includes("DUPLICATE")) {
      eligibilitySummary.excludedDuplicateSuspected += 1;
    } else if (reasons.includes("PPO") || reasons.includes("FINAL_SOLD")) {
      eligibilitySummary.excludedMissingPpo += 1;
    } else {
      eligibilitySummary.excludedOther += 1;
    }
    return false;
  });

  // Provenance filter before fallback (COMPARE keeps both for side-by-side)
  const provenancePool =
    request.provenance === "COMPARE"
      ? eligible
      : eligible.filter((o) => o.provenance === request.provenance);

  const plan = broadenCohort({
    pool: provenancePool,
    request,
    minSamples,
    nowMs: input.nowMs,
  });

  const cohort = plan.observations;
  const quoted = cohort.filter((o) => o.provenance === "QUOTED");
  const sold = cohort.filter((o) => o.provenance === "VERIFIED_SOLD");

  // Primary distribution never mixes provenance
  let primaryObs: OracleObservation[];
  let marketScopeLabel: string;
  if (request.provenance === "VERIFIED_SOLD") {
    primaryObs = sold;
    marketScopeLabel = "WindowMan-observed verified sold market";
  } else if (request.provenance === "COMPARE") {
    primaryObs = quoted;
    marketScopeLabel = "WindowMan-observed quoted market (compare mode)";
  } else {
    primaryObs = quoted;
    marketScopeLabel = "WindowMan-observed quoted market";
  }

  const ppo = buildDistribution(primaryObs.map((o) => o.ppo));
  const projectTotals = buildDistribution(primaryObs.map((o) => o.projectTotal));
  const quotedPpo =
    request.provenance === "COMPARE" || request.provenance === "QUOTED"
      ? buildDistribution(quoted.map((o) => o.ppo))
      : null;
  const verifiedSoldPpo =
    request.provenance === "COMPARE" || request.provenance === "VERIFIED_SOLD"
      ? buildDistribution(sold.map((o) => o.ppo))
      : null;

  const quotedToSoldMedianDeltaPct =
    request.provenance === "COMPARE"
      ? quotedToSoldDeltaPct(quotedPpo?.median ?? null, verifiedSoldPpo?.median ?? null)
      : null;

  const trustedPct = trustedPercentage(primaryObs);
  const geographyLevel = resolveGeographyLevel(plan);
  const confidence = evaluateOracleConfidence(
    {
      sampleCount: ppo.sampleCount,
      distribution: ppo,
      geographyLevel,
      trustedPct,
      fallbackCount: plan.fallbacksApplied.length,
      mixedProductCategories: hasMixedProductTypes(primaryObs),
    },
    policy,
  );

  const dateRange = computeDateRange(primaryObs);
  const contractors = buildContractorBenchmarks(cohort, ppo);
  const brandSeries = buildBrandSeries(primaryObs);

  const callSummary =
    request.homeownerPpo !== undefined
      ? buildCallSummary({
          confidence,
          ppo,
          homeownerPpo: request.homeownerPpo ?? null,
          provenanceLabel:
            request.provenance === "VERIFIED_SOLD" ? "verified sold" : "quoted",
        })
      : null;

  return {
    confidence,
    sampleCount: ppo.sampleCount,
    cohortDefinition: {
      geographyLevel:
        plan.selected.zip ? "zip" : plan.selected.county ? "county" : "none",
      zip: plan.selected.zip,
      county: plan.selected.county,
      projectType: plan.selected.projectType,
      brand: plan.selected.brand,
      series: plan.selected.series,
      productType: plan.selected.productType,
      openingCountMin: plan.selected.openingCountMin,
      openingCountMax: plan.selected.openingCountMax,
      dateRangeMonths: request.dateRangeMonths ?? null,
    },
    fallbacksApplied: plan.fallbacksApplied,
    exactMatchCount: plan.exactMatchCount,
    dateRange,
    ppo,
    projectTotals,
    contractors,
    brandSeries,
    provenance: {
      quoted: quoted.length,
      verifiedSold: sold.length,
    },
    quotedPpo,
    verifiedSoldPpo,
    quotedToSoldMedianDeltaPct,
    ppoMetricUsed: resolveMetricUsed(primaryObs),
    eligibilitySummary,
    geographyMatch: {
      level: geographyLevel === "broadened" ? "broadened" : geographyLevel === "zip" ? "zip" : geographyLevel === "county" ? "county" : "none",
      zipMatchPct: zipMatchPct(primaryObs, request.geography?.zip),
    },
    wording: {
      marketScopeLabel,
      notClaimed: [
        "universal market price",
        "guaranteed install price",
        "top contractor in ZIP",
      ],
    },
    callSummary,
    recentObservationIds: primaryObs.slice(0, 25).map((o) => o.id),
  };
}

function resolveGeographyLevel(
  plan: ReturnType<typeof broadenCohort>,
): "zip" | "county" | "none" | "broadened" {
  const widened = plan.fallbacksApplied.some((f) => f.code === "ZIP_TO_COUNTY");
  if (widened) return "broadened";
  if (plan.selected.zip) return "zip";
  if (plan.selected.county) return "county";
  return "none";
}

function trustedPercentage(obs: OracleObservation[]): number | null {
  if (!obs.length) return null;
  const known = obs.filter((o) => o.approvedForIndex !== null);
  if (!known.length) return null;
  const trusted = known.filter((o) => o.approvedForIndex === true).length;
  return trusted / known.length;
}

function hasMixedProductTypes(obs: OracleObservation[]): boolean {
  const types = new Set(
    obs.map((o) => (o.productType || "").trim().toLowerCase()).filter(Boolean),
  );
  return types.size > 2;
}

function computeDateRange(obs: OracleObservation[]) {
  if (!obs.length) return { from: null, to: null };
  const times = obs
    .map((o) => Date.parse(o.observedAt))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  if (!times.length) return { from: null, to: null };
  return {
    from: new Date(times[0]).toISOString(),
    to: new Date(times[times.length - 1]).toISOString(),
  };
}

function zipMatchPct(
  obs: OracleObservation[],
  zip: string | undefined,
): number | null {
  if (!zip || !obs.length) return null;
  const target = zip.trim().toLowerCase();
  const matches = obs.filter((o) => (o.zip || "").trim().toLowerCase() === target)
    .length;
  return Math.round((matches / obs.length) * 1000) / 1000;
}

function resolveMetricUsed(
  obs: OracleObservation[],
): OracleQueryResponse["ppoMetricUsed"] {
  const metrics = new Set(
    obs.map((o) => o.ppoMetricUsed).filter(Boolean) as string[],
  );
  if (metrics.size === 0) return null;
  if (metrics.size === 1) {
    return [...metrics][0] as OracleQueryResponse["ppoMetricUsed"];
  }
  return "mixed";
}

function buildContractorBenchmarks(
  cohort: OracleObservation[],
  marketPpo: MarketDistribution,
): ContractorBenchmark[] {
  const byKey = new Map<string, OracleObservation[]>();
  for (const o of cohort) {
    if (!o.contractorKey) continue;
    const list = byKey.get(o.contractorKey) ?? [];
    list.push(o);
    byKey.set(o.contractorKey, list);
  }

  const rows: ContractorBenchmark[] = [];
  for (const [key, list] of byKey) {
    const quotes = list.filter((o) => o.provenance === "QUOTED");
    const sold = list.filter((o) => o.provenance === "VERIFIED_SOLD");
    const medianQuotedPpo = buildDistribution(quotes.map((o) => o.ppo)).median;
    const medianSoldPpo = buildDistribution(sold.map((o) => o.ppo)).median;
    const beatKnown = sold.filter((o) => o.didBeatPrice !== null);
    const beatPriceFrequency =
      beatKnown.length === 0
        ? null
        : beatKnown.filter((o) => o.didBeatPrice === true).length /
          beatKnown.length;

    rows.push({
      contractorKey: key,
      contractorLabel: list[0].contractorLabel || key,
      quoteCount: quotes.length,
      verifiedSoldCount: sold.length,
      medianQuotedPpo,
      medianSoldPpo,
      beatPriceFrequency,
      pricingTierLabel: classifyTier(medianQuotedPpo, marketPpo),
    });
  }

  return rows.sort((a, b) => b.quoteCount + b.verifiedSoldCount - (a.quoteCount + a.verifiedSoldCount));
}

function classifyTier(
  contractorMedian: number | null,
  market: MarketDistribution,
): ContractorBenchmark["pricingTierLabel"] {
  if (
    contractorMedian === null ||
    market.p25 === null ||
    market.p75 === null ||
    market.sampleCount < 5
  ) {
    return "INSUFFICIENT DATA";
  }
  if (contractorMedian < market.p25) return "LOWER-PRICED";
  if (contractorMedian > market.p75) return "PREMIUM";
  return "MID-MARKET";
}

function buildBrandSeries(obs: OracleObservation[]): BrandSeriesStat[] {
  const map = new Map<string, OracleObservation[]>();
  for (const o of obs) {
    const key = `${(o.brand || "").toLowerCase()}|${(o.series || "").toLowerCase()}`;
    const list = map.get(key) ?? [];
    list.push(o);
    map.set(key, list);
  }
  return [...map.values()]
    .map((list) => ({
      brand: list[0].brand,
      series: list[0].series,
      observationCount: list.length,
      medianPpo: buildDistribution(list.map((o) => o.ppo)).median,
    }))
    .sort((a, b) => b.observationCount - a.observationCount);
}

/** Data Lab helpers — fixture-driven coverage / intake. */
export function computeFieldCoverage(observations: OracleObservation[]) {
  const total = observations.length;
  const fields: Array<{ field: string; pred: (o: OracleObservation) => boolean }> = [
    { field: "ZIP", pred: (o) => Boolean(o.zip) },
    { field: "County", pred: (o) => Boolean(o.county) },
    { field: "Brand", pred: (o) => Boolean(o.brand) },
    { field: "Series", pred: (o) => Boolean(o.series) },
    { field: "Dimensions", pred: (o) => Boolean(o.dimensionsRaw || (o.widthIn && o.heightIn)) },
    { field: "Contractor", pred: (o) => Boolean(o.contractorKey) },
    { field: "Opening count", pred: (o) => (o.openingCount ?? 0) > 0 },
    { field: "Usable PPO", pred: (o) => (o.ppo ?? 0) > 0 },
    {
      field: "Verified sold coverage",
      pred: (o) => o.provenance === "VERIFIED_SOLD" && o.outcomeVerified === true,
    },
  ];

  return fields.map(({ field, pred }) => {
    const present = observations.filter(pred).length;
    return {
      field,
      present,
      total,
      pct: total ? Math.round((present / total) * 1000) / 10 : null,
    };
  });
}

export function computeDataIntake(observations: OracleObservation[]) {
  const quoted = observations.filter((o) => o.provenance === "QUOTED");
  return {
    quotes: quoted.length,
    analyses: observations.length,
    trusted: observations.filter((o) => o.approvedForIndex === true).length,
    rejected: observations.filter(
      (o) =>
        o.anomalyStatus === "reject" ||
        o.duplicateSuspected === true ||
        (o.ppo ?? 0) <= 0,
    ).length,
    manualReview: observations.filter((o) => o.manualReviewRequired === true)
      .length,
  };
}

export function computeProjectMarketBuckets(observations: OracleObservation[]) {
  const quoted = observations.filter(
    (o) => o.provenance === "QUOTED" && (o.ppo ?? 0) > 0,
  );
  const map = new Map<string, number[]>();
  for (const o of quoted) {
    const key = `${o.county || "unknown"}|${o.projectType || "all"}`;
    const list = map.get(key) ?? [];
    list.push(o.ppo!);
    map.set(key, list);
  }
  return [...map.entries()].map(([key, values]) => {
    const [county, projectType] = key.split("|");
    const dist = buildDistribution(values);
    return { county, projectType, ...dist };
  });
}
