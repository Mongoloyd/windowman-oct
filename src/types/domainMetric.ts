import {
  METRIC_DICTIONARY,
  type MetricExposure,
  type MetricId,
  type MetricSemanticStatus,
  type MetricSourceMode,
  type MetricUnit,
  type OracleProductSurface,
} from "./metrics.dictionary";

declare const intCentsBrand: unique symbol;
declare const signedIntCentsBrand: unique symbol;

export type IntCents = number & { readonly [intCentsBrand]: "IntCents" };
export type SignedIntCents = number & {
  readonly [signedIntCentsBrand]: "SignedIntCents";
};

export type MetricProvenance =
  | "QUOTED"
  | "VERIFIED_ACCEPTED"
  | "VERIFIED_FINAL"
  | "QUALITY"
  | "SYNTHETIC_INFERRED";

export type MetricSuppressionReason =
  | "BELOW_MINIMUM_SAMPLE"
  | "FORCED"
  | "UNBOUND_SEMANTICS"
  | "CONFLICTED_SEMANTICS";

export interface DomainMetric<T> {
  readonly metricId: MetricId;
  readonly value: T;
  readonly provenance: MetricProvenance;
  readonly sampleSize: number;
  readonly exposureLevel: MetricExposure;
  readonly ownerSurface: OracleProductSurface;
  readonly sourceMode: MetricSourceMode;
  readonly semanticStatus: MetricSemanticStatus;
  readonly suppressionState: boolean;
  readonly suppressionReason: MetricSuppressionReason | null;
  readonly freshness: string;
}

export interface MetricInput {
  provenance: MetricProvenance;
  sampleSize: number;
  freshness: string;
  forceSuppressed?: boolean;
}

export function isIntCents(value: number): value is IntCents {
  return Number.isSafeInteger(value) && value >= 0;
}

export function toIntCents(value: number): IntCents {
  if (!isIntCents(value)) {
    throw new TypeError(`Expected non-negative integer cents; received ${value}`);
  }
  return value;
}

export function toSignedIntCents(value: number): SignedIntCents {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`Expected signed integer cents; received ${value}`);
  }
  return value as SignedIntCents;
}

function isIsoDate(value: string): boolean {
  if (value.trim() !== value || value.length === 0) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isDistribution(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const points = [
    value.lowCents,
    value.p25Cents,
    value.medianCents,
    value.p75Cents,
    value.highCents,
  ];
  return (
    points.every(isNonNegativeSafeInteger) &&
    isNonNegativeSafeInteger(value.sampleSize) &&
    points.every((point, index) => index === 0 || point >= points[index - 1])
  );
}

function isDateRange(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.from === "string" &&
    typeof value.to === "string" &&
    isIsoDate(value.from) &&
    isIsoDate(value.to) &&
    Date.parse(value.from) <= Date.parse(value.to)
  );
}

function metricValueMatchesUnit(value: unknown, unit: MetricUnit): boolean {
  switch (unit) {
    case "INT_CENTS":
      return isNonNegativeSafeInteger(value);
    case "SIGNED_INT_CENTS":
      return typeof value === "number" && Number.isSafeInteger(value);
    case "COUNT":
      return isNonNegativeSafeInteger(value);
    case "PERCENT":
      return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
    case "BASIS_POINTS":
      return typeof value === "number" && Number.isSafeInteger(value);
    case "RATIO":
      return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
    case "BOOLEAN":
      return typeof value === "boolean";
    case "LABEL":
      return typeof value === "string" && value.trim().length > 0;
    case "DATE_RANGE":
      return isDateRange(value);
    case "DISTRIBUTION":
      return isDistribution(value);
    case "USD_LEGACY":
      return isNonNegativeFinite(value);
  }
}

function stabilizeMetricValue<T>(value: T, unit: MetricUnit): T {
  if (unit === "DATE_RANGE" && isRecord(value)) {
    return Object.freeze({ from: value.from, to: value.to }) as T;
  }
  if (unit === "DISTRIBUTION" && isRecord(value)) {
    return Object.freeze({
      lowCents: value.lowCents,
      p25Cents: value.p25Cents,
      medianCents: value.medianCents,
      p75Cents: value.p75Cents,
      highCents: value.highCents,
      sampleSize: value.sampleSize,
    }) as T;
  }
  return value;
}

export function makeDomainMetric<T>(
  metricId: MetricId,
  value: T,
  input: MetricInput,
): DomainMetric<T> {
  const definition = METRIC_DICTIONARY[metricId];
  if (!definition) {
    throw new TypeError(`Unknown metric id: ${String(metricId)}`);
  }
  if (!Number.isSafeInteger(input.sampleSize) || input.sampleSize < 0) {
    throw new TypeError(`Metric ${metricId} requires a non-negative integer sampleSize`);
  }
  if (!isIsoDate(input.freshness)) {
    throw new TypeError(`Metric ${metricId} requires a normalized ISO freshness timestamp`);
  }
  if (!metricValueMatchesUnit(value, definition.unit)) {
    throw new TypeError(`Metric ${metricId} value does not match unit ${definition.unit}`);
  }
  const stableValue = stabilizeMetricValue(value, definition.unit);

  let suppressionReason: MetricSuppressionReason | null = null;
  if (input.forceSuppressed === true) {
    suppressionReason = "FORCED";
  } else if (definition.semanticStatus === "UNBOUND") {
    suppressionReason = "UNBOUND_SEMANTICS";
  } else if (definition.semanticStatus === "CONFLICTED") {
    suppressionReason = "CONFLICTED_SEMANTICS";
  } else if (input.sampleSize < definition.minSampleSize) {
    suppressionReason = "BELOW_MINIMUM_SAMPLE";
  }

  return Object.freeze({
    metricId,
    value: stableValue,
    provenance: input.provenance,
    sampleSize: input.sampleSize,
    exposureLevel: definition.exposure,
    ownerSurface: definition.ownerSurface,
    sourceMode: definition.sourceMode,
    semanticStatus: definition.semanticStatus,
    suppressionState: suppressionReason !== null,
    suppressionReason,
    freshness: new Date(input.freshness).toISOString(),
  });
}

export function canRenderMetricOnSurface(
  metric: DomainMetric<unknown>,
  surface: OracleProductSurface,
): boolean {
  const definition = METRIC_DICTIONARY[metric.metricId];
  if (!definition) return false;
  if (
    metric.ownerSurface !== definition.ownerSurface ||
    metric.exposureLevel !== definition.exposure ||
    metric.sourceMode !== definition.sourceMode ||
    metric.semanticStatus !== definition.semanticStatus
  ) {
    return false;
  }
  if (
    metric.suppressionState ||
    metric.suppressionReason !== null ||
    metric.ownerSurface !== surface ||
    definition.semanticStatus === "UNBOUND" ||
    definition.semanticStatus === "CONFLICTED" ||
    !Number.isSafeInteger(metric.sampleSize) ||
    metric.sampleSize < 0 ||
    metric.sampleSize < definition.minSampleSize ||
    !isIsoDate(metric.freshness) ||
    !metricValueMatchesUnit(metric.value, definition.unit)
  ) {
    return false;
  }
  if (surface === "PUBLIC_ORACLE" && definition.exposure !== "PUBLIC") return false;
  return true;
}

export function canRenderRegisteredMetric(
  metricId: MetricId,
  surface: OracleProductSurface,
  sampleSize: number,
): boolean {
  const definition = METRIC_DICTIONARY[metricId];
  return Boolean(
    definition &&
      definition.ownerSurface === surface &&
      definition.semanticStatus !== "UNBOUND" &&
      definition.semanticStatus !== "CONFLICTED" &&
      Number.isSafeInteger(sampleSize) &&
      sampleSize >= definition.minSampleSize,
  );
}
