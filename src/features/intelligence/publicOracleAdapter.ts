import {
  makeDomainMetric,
  toIntCents,
  toSignedIntCents,
  type DomainMetric,
  type IntCents,
  type SignedIntCents,
} from "@/types/domainMetric";
import type { DistributionSummary, PublicOracleResponse } from "./types";

export interface PublicPriceDistribution {
  readonly lowCents: IntCents;
  readonly p25Cents: IntCents;
  readonly medianCents: IntCents;
  readonly p75Cents: IntCents;
  readonly highCents: IntCents;
  readonly sampleSize: number;
}

export interface PublicOracleViewModel {
  readonly contractVersion: "public-oracle-view-model/v1";
  readonly evidence: {
    readonly sampleSize: DomainMetric<number>;
    readonly outcomeCoveragePct: DomainMetric<number>;
    readonly verifiedAcceptedCount: DomainMetric<number>;
    readonly cohortMode: DomainMetric<"Broadened" | "Exact">;
    readonly dateRange: DomainMetric<Readonly<{ from: string; to: string }>>;
  };
  readonly prices: {
    readonly quotedDistribution: DomainMetric<PublicPriceDistribution>;
    readonly acceptedDistribution: DomainMetric<PublicPriceDistribution>;
    readonly quotedMedianCents: DomainMetric<IntCents>;
    readonly acceptedMedianCents: DomainMetric<IntCents>;
    readonly quotedAcceptedGapCents: DomainMetric<SignedIntCents>;
  };
}

function requireNonNegativeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative safe integer`);
  }
}

function requirePercent(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new TypeError(`${name} must be between 0 and 100`);
  }
}

function requireIso(value: string, name: string): void {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new TypeError(`${name} must be a normalized ISO timestamp`);
  }
}

function toPriceDistribution(
  distribution: DistributionSummary,
  name: string,
): PublicPriceDistribution {
  requireNonNegativeInteger(distribution.sampleSize, `${name}.sampleSize`);
  const lowCents = toIntCents(distribution.lowCents);
  const p25Cents = toIntCents(distribution.p25Cents);
  const medianCents = toIntCents(distribution.medianCents);
  const p75Cents = toIntCents(distribution.p75Cents);
  const highCents = toIntCents(distribution.highCents);
  if (!(lowCents <= p25Cents && p25Cents <= medianCents && medianCents <= p75Cents && p75Cents <= highCents)) {
    throw new TypeError(`${name} percentile values must be monotonically ordered`);
  }
  return Object.freeze({
    lowCents,
    p25Cents,
    medianCents,
    p75Cents,
    highCents,
    sampleSize: distribution.sampleSize,
  });
}

function validateSnapshot(snapshot: PublicOracleResponse): void {
  if (snapshot.contractVersion !== "public-oracle-fixture/v1") {
    throw new TypeError("Unsupported public Oracle fixture contract");
  }
  if (snapshot.dataSource !== "SYNTHETIC_PREVIEW") {
    throw new TypeError("Public Oracle visual-lab adapter accepts synthetic preview data only");
  }

  const evidence = snapshot.evidence;
  for (const [name, value] of [
    ["governedQuoteCount", evidence.governedQuoteCount],
    ["outcomeKnownCount", evidence.outcomeKnownCount],
    ["verifiedAcceptedCount", evidence.verifiedAcceptedCount],
    ["verifiedFinalCount", evidence.verifiedFinalCount],
    ["exactMatchCount", evidence.exactMatchCount],
  ] as const) {
    requireNonNegativeInteger(value, `evidence.${name}`);
  }
  requirePercent(evidence.outcomeCoveragePct, "evidence.outcomeCoveragePct");
  requireIso(evidence.dateFrom, "evidence.dateFrom");
  requireIso(evidence.dateTo, "evidence.dateTo");
  requireIso(evidence.generatedAt, "evidence.generatedAt");

  if (Date.parse(evidence.dateFrom) > Date.parse(evidence.dateTo)) {
    throw new TypeError("Evidence date range is reversed");
  }
  if (Date.parse(evidence.dateTo) > Date.parse(evidence.generatedAt)) {
    throw new TypeError("Evidence date range cannot extend beyond generation time");
  }
  if (
    evidence.outcomeKnownCount > evidence.governedQuoteCount ||
    evidence.verifiedAcceptedCount > evidence.outcomeKnownCount ||
    evidence.verifiedFinalCount > evidence.verifiedAcceptedCount ||
    evidence.exactMatchCount > evidence.governedQuoteCount
  ) {
    throw new TypeError("Evidence counts violate the governed population hierarchy");
  }
  const expectedCoverage = evidence.governedQuoteCount === 0
    ? 0
    : Math.round((evidence.outcomeKnownCount / evidence.governedQuoteCount) * 100);
  if (evidence.outcomeCoveragePct !== expectedCoverage) {
    throw new TypeError("Outcome coverage does not reconcile to known outcomes / governed quotes");
  }
  if (snapshot.quoted.sampleSize !== evidence.governedQuoteCount) {
    throw new TypeError("Quoted distribution sample does not match governed quote count");
  }
  if (snapshot.verifiedAccepted.sampleSize !== evidence.verifiedAcceptedCount) {
    throw new TypeError("Accepted distribution sample does not match verified accepted count");
  }
}

export function transformSnapshotToPublicOracle(
  snapshot: PublicOracleResponse,
): PublicOracleViewModel {
  validateSnapshot(snapshot);
  const freshness = snapshot.evidence.generatedAt;
  const governedSample = snapshot.evidence.governedQuoteCount;
  const quotedDistribution = toPriceDistribution(snapshot.quoted, "quoted");
  const acceptedDistribution = toPriceDistribution(snapshot.verifiedAccepted, "verifiedAccepted");
  const dateRange = Object.freeze({
    from: snapshot.evidence.dateFrom,
    to: snapshot.evidence.dateTo,
  });

  return Object.freeze({
    contractVersion: "public-oracle-view-model/v1",
    evidence: Object.freeze({
      sampleSize: makeDomainMetric("public.sample_size", governedSample, {
        provenance: "SYNTHETIC_INFERRED",
        sampleSize: governedSample,
        freshness,
      }),
      outcomeCoveragePct: makeDomainMetric(
        "public.outcome_coverage_pct",
        snapshot.evidence.outcomeCoveragePct,
        {
          provenance: "QUALITY",
          sampleSize: governedSample,
          freshness,
        },
      ),
      verifiedAcceptedCount: makeDomainMetric(
        "public.verified_accepted_count",
        snapshot.evidence.verifiedAcceptedCount,
        {
          provenance: "VERIFIED_ACCEPTED",
          sampleSize: governedSample,
          freshness,
        },
      ),
      cohortMode: makeDomainMetric(
        "public.cohort_mode",
        snapshot.evidence.broadened ? "Broadened" : "Exact",
        {
          provenance: "QUALITY",
          sampleSize: governedSample,
          freshness,
        },
      ),
      dateRange: makeDomainMetric(
        "public.date_range",
        dateRange,
        {
          provenance: "QUALITY",
          sampleSize: governedSample,
          freshness,
        },
      ),
    }),
    prices: Object.freeze({
      quotedDistribution: makeDomainMetric(
        "public.distribution_quoted",
        quotedDistribution,
        {
          provenance: "QUOTED",
          sampleSize: snapshot.quoted.sampleSize,
          freshness,
        },
      ),
      acceptedDistribution: makeDomainMetric(
        "public.distribution_accepted",
        acceptedDistribution,
        {
          provenance: "VERIFIED_ACCEPTED",
          sampleSize: snapshot.verifiedAccepted.sampleSize,
          freshness,
        },
      ),
      quotedMedianCents: makeDomainMetric(
        "public.quoted_median",
        toIntCents(snapshot.quoted.medianCents),
        {
          provenance: "QUOTED",
          sampleSize: snapshot.quoted.sampleSize,
          freshness,
        },
      ),
      acceptedMedianCents: makeDomainMetric(
        "public.accepted_median",
        toIntCents(snapshot.verifiedAccepted.medianCents),
        {
          provenance: "VERIFIED_ACCEPTED",
          sampleSize: snapshot.verifiedAccepted.sampleSize,
          freshness,
        },
      ),
      quotedAcceptedGapCents: makeDomainMetric(
        "public.quoted_accepted_gap",
        toSignedIntCents(snapshot.quoted.medianCents - snapshot.verifiedAccepted.medianCents),
        {
          provenance: "SYNTHETIC_INFERRED",
          sampleSize: Math.min(snapshot.quoted.sampleSize, snapshot.verifiedAccepted.sampleSize),
          freshness,
        },
      ),
    }),
  });
}
