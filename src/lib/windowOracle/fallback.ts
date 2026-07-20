import type {
  FallbackCode,
  OracleObservation,
  OracleQueryRequest,
  QueryFallback,
} from "./types";

export type CohortMatchSpec = {
  zip: string | null;
  county: string | null;
  brand: string | null;
  series: string | null;
  productType: string | null;
  projectType: string | null;
  openingCountMin: number | null;
  openingCountMax: number | null;
  width: number | null;
  height: number | null;
  dimensionToleranceIn: number;
  dateFromMs: number | null;
};

export type FallbackPlanResult = {
  exactMatchCount: number;
  selected: CohortMatchSpec;
  observations: OracleObservation[];
  fallbacksApplied: QueryFallback[];
};

function norm(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim().toLowerCase();
  return t.length ? t : null;
}

function withinDate(obs: OracleObservation, fromMs: number | null): boolean {
  if (fromMs === null) return true;
  const t = Date.parse(obs.observedAt);
  if (!Number.isFinite(t)) return false;
  return t >= fromMs;
}

function dimMatch(
  obs: OracleObservation,
  width: number | null,
  height: number | null,
  tol: number,
): boolean {
  if (width === null && height === null) return true;
  if (obs.widthIn === null || obs.heightIn === null) return false;
  if (width !== null && Math.abs(obs.widthIn - width) > tol) return false;
  if (height !== null && Math.abs(obs.heightIn - height) > tol) return false;
  return true;
}

export function matchesSpec(
  obs: OracleObservation,
  spec: CohortMatchSpec,
): boolean {
  if (!withinDate(obs, spec.dateFromMs)) return false;

  if (spec.zip) {
    if (norm(obs.zip) !== norm(spec.zip)) return false;
  } else if (spec.county) {
    if (norm(obs.county) !== norm(spec.county)) return false;
  }

  if (spec.projectType && norm(obs.projectType) !== norm(spec.projectType)) {
    return false;
  }
  if (spec.brand && norm(obs.brand) !== norm(spec.brand)) return false;
  if (spec.series && norm(obs.series) !== norm(spec.series)) return false;
  if (spec.productType && norm(obs.productType) !== norm(spec.productType)) {
    return false;
  }

  if (spec.openingCountMin !== null && (obs.openingCount ?? -1) < spec.openingCountMin) {
    return false;
  }
  if (spec.openingCountMax !== null && (obs.openingCount ?? Infinity) > spec.openingCountMax) {
    return false;
  }

  return dimMatch(obs, spec.width, spec.height, spec.dimensionToleranceIn);
}

function filterObs(
  pool: OracleObservation[],
  spec: CohortMatchSpec,
): OracleObservation[] {
  return pool.filter((o) => matchesSpec(o, spec));
}

function buildExactSpec(
  request: OracleQueryRequest,
  nowMs: number,
): CohortMatchSpec {
  const months = request.dateRangeMonths ?? null;
  const dateFromMs =
    months !== null && months > 0
      ? nowMs - months * 30.44 * 24 * 60 * 60 * 1000
      : null;

  return {
    zip: request.geography?.zip?.trim() || null,
    county: request.geography?.county?.trim() || null,
    brand: request.product?.brand?.trim() || null,
    series: request.product?.series?.trim() || null,
    productType: request.product?.type?.trim() || null,
    projectType: request.project?.projectType?.trim() || null,
    openingCountMin: request.project?.openingCountMin ?? null,
    openingCountMax: request.project?.openingCountMax ?? null,
    width: request.product?.width ?? null,
    height: request.product?.height ?? null,
    dimensionToleranceIn: 0,
    dateFromMs,
  };
}

/**
 * Progressive cohort broadening. Never silent — every step is recorded.
 * Stops when sampleCount >= minSamples or no further steps remain.
 */
export function broadenCohort(input: {
  pool: OracleObservation[];
  request: OracleQueryRequest;
  minSamples: number;
  nowMs?: number;
}): FallbackPlanResult {
  const nowMs = input.nowMs ?? Date.now();
  const fallbacksApplied: QueryFallback[] = [];
  let selected = buildExactSpec(input.request, nowMs);
  let observations = filterObs(input.pool, selected);
  const exactMatchCount = observations.length;

  if (observations.length >= input.minSamples) {
    return { exactMatchCount, selected, observations, fallbacksApplied };
  }

  const steps: Array<{
    code: FallbackCode;
    detail: string;
    apply: (s: CohortMatchSpec) => CohortMatchSpec;
  }> = [];

  if (selected.width !== null || selected.height !== null) {
    const tol = input.request.product?.dimensionToleranceIn ?? 2;
    steps.push({
      code: "DIMENSION_TOLERANCE_EXPANDED",
      detail: `Width/height tolerance ±${tol}"`,
      apply: (s) => ({ ...s, dimensionToleranceIn: tol }),
    });
  }

  if (selected.series) {
    steps.push({
      code: "SERIES_REMOVED",
      detail: "Series filter removed",
      apply: (s) => ({ ...s, series: null }),
    });
  }

  if (selected.zip && selected.county) {
    steps.push({
      code: "ZIP_TO_COUNTY",
      detail: `ZIP ${selected.zip} → county ${selected.county}`,
      apply: (s) => ({ ...s, zip: null }),
    });
  } else if (selected.zip && !selected.county) {
    // Infer county from first exact-zip observation's county if present in pool
    const zipCounty =
      input.pool.find((o) => norm(o.zip) === norm(selected.zip))?.county ?? null;
    if (zipCounty) {
      steps.push({
        code: "ZIP_TO_COUNTY",
        detail: `ZIP ${selected.zip} → county ${zipCounty}`,
        apply: (s) => ({ ...s, zip: null, county: zipCounty }),
      });
    }
  }

  if (selected.brand && selected.productType) {
    steps.push({
      code: "BRAND_TO_PRODUCT_TYPE",
      detail: "Brand removed; keep product type",
      apply: (s) => ({ ...s, brand: null }),
    });
  }

  for (const step of steps) {
    selected = step.apply(selected);
    observations = filterObs(input.pool, selected);
    fallbacksApplied.push({ code: step.code, detail: step.detail });
    if (observations.length >= input.minSamples) break;
  }

  return { exactMatchCount, selected, observations, fallbacksApplied };
}
