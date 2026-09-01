/**
 * Synthetic Oracle observations for fixture-only UI and unit tests.
 * NOT real market data. Always label UI with SYNTHETIC_DATA_BANNER.
 */

import { resolveCanonicalPpo } from "./statistics";
import type { OracleObservation } from "./types";
import { SYNTHETIC_DATA_BANNER } from "./fixtures.testPolicy";

export { SYNTHETIC_DATA_BANNER };

type Seed = {
  id: string;
  provenance: "QUOTED" | "VERIFIED_SOLD";
  daysAgo: number;
  zip: string | null;
  county: string;
  projectType: string;
  openings: number;
  installedPpo: number | null;
  contractPpo: number | null;
  brand: string | null;
  series: string | null;
  productType: string;
  width: number | null;
  height: number | null;
  contractorKey: string;
  contractorLabel: string;
  approvedForIndex?: boolean | null;
  manualReviewRequired?: boolean;
  duplicateSuspected?: boolean;
  anomalyStatus?: string | null;
  outcomeVerified?: boolean | null;
  soldScopeComparable?: boolean | null;
  didBeatPrice?: boolean | null;
};

const CONTRACTORS = [
  { key: "synthetic-contractor-a", label: "Synthetic Contractor A" },
  { key: "synthetic-contractor-b", label: "Synthetic Contractor B" },
  { key: "synthetic-contractor-c", label: "Synthetic Contractor C" },
  { key: "synthetic-contractor-d", label: "Synthetic Contractor D" },
] as const;

const BRANDS = [
  { brand: "PGT", series: "WinGuard", type: "single_hung" },
  { brand: "PGT", series: "WinGuard", type: "picture" },
  { brand: "ES", series: "Series 500", type: "sliding_glass_door" },
  { brand: "CGI", series: "Sentinel", type: "casement" },
  { brand: null, series: null, type: "single_hung" },
] as const;

function makeObservation(seed: Seed, nowMs: number): OracleObservation {
  const { ppo, metric } = resolveCanonicalPpo({
    installedPpo: seed.installedPpo,
    contractPpo: seed.contractPpo,
  });
  const observedAt = new Date(
    nowMs - seed.daysAgo * 24 * 60 * 60 * 1000,
  ).toISOString();
  const projectTotal =
    ppo !== null && seed.openings > 0
      ? Math.round(ppo * seed.openings)
      : null;

  return {
    id: seed.id,
    provenance: seed.provenance,
    observedAt,
    zip: seed.zip,
    county: seed.county,
    projectType: seed.projectType,
    openingCount: seed.openings,
    windowCount: seed.productType.includes("door")
      ? Math.max(0, seed.openings - 2)
      : seed.openings,
    doorCount: seed.productType.includes("door") ? 2 : 0,
    projectTotal,
    ppo,
    ppoMetricUsed: metric,
    brand: seed.brand,
    series: seed.series,
    productType: seed.productType,
    widthIn: seed.width,
    heightIn: seed.height,
    dimensionsRaw:
      seed.width && seed.height ? `${seed.width}x${seed.height}` : null,
    contractorKey: seed.contractorKey,
    contractorLabel: seed.contractorLabel,
    approvedForIndex: seed.approvedForIndex ?? true,
    manualReviewRequired: seed.manualReviewRequired ?? false,
    duplicateSuspected: seed.duplicateSuspected ?? false,
    anomalyStatus: seed.anomalyStatus ?? "safe",
    outcomeVerified:
      seed.provenance === "VERIFIED_SOLD"
        ? (seed.outcomeVerified ?? true)
        : null,
    soldScopeComparable:
      seed.provenance === "VERIFIED_SOLD"
        ? (seed.soldScopeComparable ?? true)
        : null,
    didBeatPrice:
      seed.provenance === "VERIFIED_SOLD" ? (seed.didBeatPrice ?? null) : null,
  };
}

/** Build ~90 synthetic observations covering thin ZIPs, outliers, review rows. */
export function buildSyntheticOracleObservations(
  nowMs: number = Date.now(),
): OracleObservation[] {
  const seeds: Seed[] = [];
  let n = 0;

  const counties: Array<{
    county: string;
    zips: string[];
    projectType: string;
  }> = [
    { county: "Synthetic Region A", zips: ["00001", "00002", "00003"], projectType: "full_home" },
    { county: "Synthetic Region B", zips: ["00011", "00012"], projectType: "partial" },
    { county: "Synthetic Region C", zips: ["00021", "00022"], projectType: "full_home" },
  ];

  // Dense synthetic Region A quoted market
  for (let i = 0; i < 40; i++) {
    n += 1;
    const brand = BRANDS[i % 3];
    const c = CONTRACTORS[i % CONTRACTORS.length];
    const base = 1700 + (i % 12) * 45 + (i % 5) * 20;
    seeds.push({
      id: `OBS-${String(n).padStart(3, "0")}`,
      provenance: "QUOTED",
      daysAgo: 10 + (i % 300),
      zip: i < 28 ? "00001" : counties[0].zips[i % 3],
      county: "Synthetic Region A",
      projectType: "full_home",
      openings: 8 + (i % 10),
      installedPpo: i === 7 ? 4200 : base, // outlier
      contractPpo: base + 50,
      brand: brand.brand,
      series: brand.series,
      productType: brand.type,
      width: 36 + (i % 3),
      height: 60,
      contractorKey: c.key,
      contractorLabel: c.label,
    });
  }

  // Thin synthetic ZIP 00022 (Region C) — few samples
  for (let i = 0; i < 3; i++) {
    n += 1;
    const c = CONTRACTORS[i % CONTRACTORS.length];
    seeds.push({
      id: `OBS-${String(n).padStart(3, "0")}`,
      provenance: "QUOTED",
      daysAgo: 40 + i * 10,
      zip: "00022",
      county: "Synthetic Region C",
      projectType: "full_home",
      openings: 12,
      installedPpo: 2100 + i * 80,
      contractPpo: 2150 + i * 80,
      brand: "PGT",
      series: "WinGuard",
      productType: "single_hung",
      width: 36,
      height: 60,
      contractorKey: c.key,
      contractorLabel: c.label,
    });
  }

  // Synthetic Region B mix + missing brand/series
  for (let i = 0; i < 20; i++) {
    n += 1;
    const brand = BRANDS[i % BRANDS.length];
    const c = CONTRACTORS[i % CONTRACTORS.length];
    seeds.push({
      id: `OBS-${String(n).padStart(3, "0")}`,
      provenance: "QUOTED",
      daysAgo: 20 + i * 7,
      zip: counties[1].zips[i % 2],
      county: "Synthetic Region B",
      projectType: i % 2 === 0 ? "partial" : "full_home",
      openings: 10 + (i % 8),
      installedPpo: 1600 + i * 35,
      contractPpo: 1650 + i * 35,
      brand: brand.brand,
      series: brand.series,
      productType: brand.type,
      width: i % 4 === 0 ? null : 48,
      height: i % 4 === 0 ? null : 60,
      contractorKey: c.key,
      contractorLabel: c.label,
      approvedForIndex: i % 9 === 0 ? false : true,
    });
  }

  // Manual review / duplicate / missing PPO rows (should be excluded)
  n += 1;
  seeds.push({
    id: `OBS-${String(n).padStart(3, "0")}`,
    provenance: "QUOTED",
    daysAgo: 5,
    zip: "00001",
    county: "Synthetic Region A",
    projectType: "full_home",
    openings: 14,
    installedPpo: 1900,
    contractPpo: 1900,
    brand: "PGT",
    series: "WinGuard",
    productType: "single_hung",
    width: 36,
    height: 60,
    contractorKey: "synthetic-contractor-a",
    contractorLabel: "Synthetic Contractor A",
    manualReviewRequired: true,
  });

  n += 1;
  seeds.push({
    id: `OBS-${String(n).padStart(3, "0")}`,
    provenance: "QUOTED",
    daysAgo: 6,
    zip: "00001",
    county: "Synthetic Region A",
    projectType: "full_home",
    openings: 14,
    installedPpo: 1900,
    contractPpo: 1900,
    brand: "PGT",
    series: "WinGuard",
    productType: "single_hung",
    width: 36,
    height: 60,
    contractorKey: "synthetic-contractor-a",
    contractorLabel: "Synthetic Contractor A",
    duplicateSuspected: true,
  });

  n += 1;
  seeds.push({
    id: `OBS-${String(n).padStart(3, "0")}`,
    provenance: "QUOTED",
    daysAgo: 8,
    zip: "00001",
    county: "Synthetic Region A",
    projectType: "full_home",
    openings: 10,
    installedPpo: null,
    contractPpo: null,
    brand: "CGI",
    series: null,
    productType: "casement",
    width: 36,
    height: 60,
    contractorKey: "synthetic-contractor-b",
    contractorLabel: "Synthetic Contractor B",
  });

  // Verified sold outcomes
  for (let i = 0; i < 25; i++) {
    n += 1;
    const c = CONTRACTORS[i % CONTRACTORS.length];
    const brand = BRANDS[i % 3];
    const quoteLike = 1750 + (i % 10) * 40;
    seeds.push({
      id: `OBS-${String(n).padStart(3, "0")}`,
      provenance: "VERIFIED_SOLD",
      daysAgo: 15 + i * 11,
      zip: i < 15 ? "00001" : counties[1].zips[i % 2],
      county: i < 15 ? "Synthetic Region A" : "Synthetic Region B",
      projectType: "full_home",
      openings: 10 + (i % 6),
      installedPpo: quoteLike - 120,
      contractPpo: quoteLike - 100,
      brand: brand.brand,
      series: brand.series,
      productType: brand.type,
      width: 36,
      height: 60,
      contractorKey: c.key,
      contractorLabel: c.label,
      outcomeVerified: i === 3 ? false : true, // one unverified
      didBeatPrice: i % 3 !== 0,
      soldScopeComparable: i === 8 ? false : true,
    });
  }

  // Missing ZIP but county present
  n += 1;
  seeds.push({
    id: `OBS-${String(n).padStart(3, "0")}`,
    provenance: "QUOTED",
    daysAgo: 50,
    zip: null,
    county: "Synthetic Region A",
    projectType: "full_home",
    openings: 16,
    installedPpo: 1880,
    contractPpo: 1900,
    brand: "ES",
    series: "Series 500",
    productType: "sliding_glass_door",
    width: 72,
    height: 80,
    contractorKey: "synthetic-contractor-c",
    contractorLabel: "Synthetic Contractor C",
  });

  return seeds.map((s) => makeObservation(s, nowMs));
}

/** Stable fixture set for tests (fixed epoch). */
export const SYNTHETIC_ORACLE_NOW_MS = Date.parse("2026-07-01T12:00:00.000Z");

export const SYNTHETIC_ORACLE_OBSERVATIONS = buildSyntheticOracleObservations(
  SYNTHETIC_ORACLE_NOW_MS,
);
