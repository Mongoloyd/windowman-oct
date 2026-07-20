/**
 * Deterministic market statistics for Window Oracle.
 * Pure functions — aligns percentile approach with refresh-benchmarks / metrics helpers.
 */

import type { MarketDistribution } from "./types";

export function cleanFinite(values: Array<number | null | undefined>): number[] {
  return values.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
}

export function round2(v: number | null): number | null {
  if (v === null || !Number.isFinite(v)) return null;
  return Math.round(v * 100) / 100;
}

/** Linear-interpolation percentile on a pre-sorted ascending array. */
export function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return round2(sorted[0]);
  const rank = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  const weight = rank - lower;
  return round2(sorted[lower] * (1 - weight) + sorted[upper] * weight);
}

export function median(values: number[]): number | null {
  return percentile([...values].sort((a, b) => a - b), 50);
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return round2(values.reduce((s, v) => s + v, 0) / values.length);
}

export function buildDistribution(
  values: Array<number | null | undefined>,
): MarketDistribution {
  const clean = cleanFinite(values).sort((a, b) => a - b);
  return {
    sampleCount: clean.length,
    min: clean.length ? round2(clean[0]) : null,
    p25: percentile(clean, 25),
    median: percentile(clean, 50),
    average: average(clean),
    p75: percentile(clean, 75),
    max: clean.length ? round2(clean[clean.length - 1]) : null,
  };
}

/** (soldMedian - quotedMedian) / quotedMedian * 100 */
export function quotedToSoldDeltaPct(
  quotedMedian: number | null,
  soldMedian: number | null,
): number | null {
  if (
    quotedMedian === null ||
    soldMedian === null ||
    !Number.isFinite(quotedMedian) ||
    quotedMedian === 0
  ) {
    return null;
  }
  return round2(((soldMedian - quotedMedian) / quotedMedian) * 100);
}

export function dispersionRatio(
  averageValue: number | null,
  medianValue: number | null,
): number | null {
  if (
    averageValue === null ||
    medianValue === null ||
    !Number.isFinite(medianValue) ||
    medianValue === 0
  ) {
    return null;
  }
  return round2(averageValue / medianValue);
}

export function resolveCanonicalPpo(input: {
  installedPpo: number | null | undefined;
  contractPpo: number | null | undefined;
  sanityMax?: number;
}): { ppo: number | null; metric: "installed_price_per_opening" | "contract_price_per_opening" | null } {
  const max = input.sanityMax ?? 10000;
  const installed =
    typeof input.installedPpo === "number" && Number.isFinite(input.installedPpo)
      ? input.installedPpo
      : null;
  const contract =
    typeof input.contractPpo === "number" && Number.isFinite(input.contractPpo)
      ? input.contractPpo
      : null;

  if (installed !== null && installed > 0 && installed <= max) {
    return { ppo: round2(installed), metric: "installed_price_per_opening" };
  }
  if (contract !== null && contract > 0 && contract <= max) {
    return { ppo: round2(contract), metric: "contract_price_per_opening" };
  }
  return { ppo: null, metric: null };
}
