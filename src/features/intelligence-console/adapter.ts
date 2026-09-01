import type {
  IntelligenceOutcomeState,
  SyntheticIntelligenceDataset,
} from "./types";
import { canRenderRegisteredMetric } from "@/types/domainMetric";

export interface IntelligenceMetricViewModel {
  label: string;
  value: string;
  detail: string;
  tone: "blue" | "green" | "amber" | "neutral";
}
export interface OutcomeSegmentViewModel {
  state: IntelligenceOutcomeState;
  label: string;
  count: number;
  shareBasisPoints: number;
  colorClass: string;
}

export interface MoneyStageViewModel {
  key: "INITIAL_QUOTE" | "ACCEPTED_CONTRACT" | "FINAL_INVOICE";
  label: string;
  medianCents: number | null;
  sampleCount: number;
}

export interface QualitySignalViewModel {
  label: string;
  valueBasisPoints: number;
  detail: string;
  tone: "blue" | "green" | "amber";
}

export interface InternalIntelligenceViewModel {
  status: "SUCCESS" | "INSUFFICIENT_DATA" | "EMPTY";
  fixtureId: string;
  fixtureLabel: string;
  generatedAt: string;
  metrics: IntelligenceMetricViewModel[];
  outcomes: OutcomeSegmentViewModel[];
  knownOutcomeCoverageBasisPoints: number;
  moneyStages: MoneyStageViewModel[];
  initialToAcceptedDeltaCents: number | null;
  initialToAcceptedDeltaBasisPoints: number | null;
  acceptedToFinalDeltaCents: number | null;
  acceptedToFinalDeltaBasisPoints: number | null;
  eligibleCount: number;
  quarantinedCount: number;
  pendingCount: number;
  qualitySignals: QualitySignalViewModel[];
  insight: string;
}

const OUTCOME_META: Record<
  IntelligenceOutcomeState,
  { label: string; colorClass: string }
> = {
  VERIFIED_SOLD: { label: "Verified sold", colorClass: "bg-emerald-400" },
  VERIFIED_NOT_SOLD: {
    label: "Verified not sold",
    colorClass: "bg-rose-400",
  },
  REPORTED_SOLD_UNVERIFIED: {
    label: "Reported sold, unverified",
    colorClass: "bg-amber-400",
  },
  OUTCOME_UNKNOWN: {
    label: "Outcome unknown",
    colorClass: "bg-slate-400",
  },
};

const OUTCOME_ORDER: IntelligenceOutcomeState[] = [
  "VERIFIED_SOLD",
  "VERIFIED_NOT_SOLD",
  "REPORTED_SOLD_UNVERIFIED",
  "OUTCOME_UNKNOWN",
];

function integerMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function toBasisPoints(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part * 10_000) / whole);
}

function deltaBasisPoints(base: number | null, next: number | null): number | null {
  if (base === null || next === null || base === 0) return null;
  return Math.round(((next - base) * 10_000) / base);
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function outcomeCounts(dataset: SyntheticIntelligenceDataset) {
  const counts = new Map<IntelligenceOutcomeState, number>();
  for (const state of OUTCOME_ORDER) counts.set(state, 0);
  for (const outcome of dataset.outcomes) {
    counts.set(outcome.state, (counts.get(outcome.state) ?? 0) + 1);
  }
  return counts;
}

export function buildInternalIntelligenceViewModel(
  dataset: SyntheticIntelligenceDataset,
): InternalIntelligenceViewModel {
  const counts = outcomeCounts(dataset);
  const projectCount = dataset.projects.length;
  const verifiedSoldCount = counts.get("VERIFIED_SOLD") ?? 0;
  const verifiedNotSoldCount = counts.get("VERIFIED_NOT_SOLD") ?? 0;
  const knownOutcomeCount = verifiedSoldCount + verifiedNotSoldCount;

  const initialRevisionIds = new Set(
    dataset.quotes.map((quote) => quote.initialRevisionId),
  );
  const initialQuoteTotals = dataset.revisions
    .filter((revision) => initialRevisionIds.has(revision.id))
    .map((revision) => revision.quotedTotalCents);
  const acceptedTotals = dataset.outcomes
    .filter((outcome) => outcome.state === "VERIFIED_SOLD")
    .map((outcome) => outcome.acceptedContractTotalCents)
    .filter((value): value is number => value !== null);
  const finalInvoiceTotals = dataset.outcomes
    .filter((outcome) => outcome.state === "VERIFIED_SOLD")
    .map((outcome) => outcome.finalInvoiceTotalCents)
    .filter((value): value is number => value !== null);

  const initialMedian = integerMedian(initialQuoteTotals);
  const acceptedMedian = integerMedian(acceptedTotals);
  const finalMedian = integerMedian(finalInvoiceTotals);
  const initialToAcceptedAllowed = canRenderRegisteredMetric(
    "foundation.initial_to_accepted_delta",
    "FOUNDATION",
    Math.min(initialQuoteTotals.length, acceptedTotals.length),
  );
  const acceptedToFinalAllowed = canRenderRegisteredMetric(
    "foundation.accepted_to_final_delta",
    "FOUNDATION",
    Math.min(acceptedTotals.length, finalInvoiceTotals.length),
  );

  const eligibleCount = dataset.quality.filter(
    (record) => record.eligibility === "ELIGIBLE",
  ).length;
  const quarantinedCount = dataset.quality.filter(
    (record) => record.eligibility === "QUARANTINED",
  ).length;
  const pendingCount = dataset.quality.filter(
    (record) => record.eligibility === "PENDING",
  ).length;
  const extractionVersionedCount = dataset.quality.filter(
    (record) => record.extractionVersion !== null,
  ).length;
  const normalizationVersionedCount = dataset.quality.filter(
    (record) => record.normalizationVersion !== null,
  ).length;
  const evidenceCoverageAverage =
    dataset.quality.length === 0
      ? 0
      : Math.round(
          dataset.quality.reduce(
            (total, record) => total + record.evidenceCoverageBasisPoints,
            0,
          ) / dataset.quality.length,
        );

  const status: InternalIntelligenceViewModel["status"] =
    dataset.quotes.length === 0
      ? "EMPTY"
      : projectCount < 10 || verifiedSoldCount < 5
        ? "INSUFFICIENT_DATA"
        : "SUCCESS";

  const outcomes = OUTCOME_ORDER.map((state) => ({
    state,
    label: OUTCOME_META[state].label,
    count: counts.get(state) ?? 0,
    shareBasisPoints: toBasisPoints(counts.get(state) ?? 0, projectCount),
    colorClass: OUTCOME_META[state].colorClass,
  }));

  const qualityDenominator = dataset.quality.length;
  const knownOutcomeCoverageBasisPoints = toBasisPoints(
    knownOutcomeCount,
    projectCount,
  );

  return {
    status,
    fixtureId: dataset.fixtureId,
    fixtureLabel: dataset.label,
    generatedAt: dataset.generatedAt,
    metrics: [
      {
        label: "Observed estimates",
        value: formatCount(dataset.quotes.length),
        detail: `${formatCount(projectCount)} synthetic projects`,
        tone: "blue",
      },
      {
        label: "Known outcomes",
        value: formatBasisPoints(knownOutcomeCoverageBasisPoints),
        detail: `${formatCount(knownOutcomeCount)} verified decisions`,
        tone: knownOutcomeCoverageBasisPoints >= 5_000 ? "green" : "amber",
      },
      {
        label: "Verified sold",
        value: formatCount(verifiedSoldCount),
        detail: "Accepted revision linked",
        tone: "green",
      },
      {
        label: "Intelligence eligible",
        value: formatCount(eligibleCount),
        detail: `${formatCount(quarantinedCount)} quarantined · ${formatCount(pendingCount)} pending`,
        tone: quarantinedCount > 0 ? "amber" : "neutral",
      },
    ],
    outcomes,
    knownOutcomeCoverageBasisPoints,
    moneyStages: [
      {
        key: "INITIAL_QUOTE",
        label: "Initial quote",
        medianCents: initialMedian,
        sampleCount: initialQuoteTotals.length,
      },
      {
        key: "ACCEPTED_CONTRACT",
        label: "Accepted contract",
        medianCents: acceptedMedian,
        sampleCount: acceptedTotals.length,
      },
      {
        key: "FINAL_INVOICE",
        label: "Final invoice",
        medianCents: finalMedian,
        sampleCount: finalInvoiceTotals.length,
      },
    ],
    initialToAcceptedDeltaCents:
      !initialToAcceptedAllowed || initialMedian === null || acceptedMedian === null
        ? null
        : acceptedMedian - initialMedian,
    initialToAcceptedDeltaBasisPoints: initialToAcceptedAllowed
      ? deltaBasisPoints(initialMedian, acceptedMedian)
      : null,
    acceptedToFinalDeltaCents:
      !acceptedToFinalAllowed || acceptedMedian === null || finalMedian === null
        ? null
        : finalMedian - acceptedMedian,
    acceptedToFinalDeltaBasisPoints: acceptedToFinalAllowed
      ? deltaBasisPoints(acceptedMedian, finalMedian)
      : null,
    eligibleCount,
    quarantinedCount,
    pendingCount,
    qualitySignals: [
      {
        label: "Extraction version coverage",
        valueBasisPoints: toBasisPoints(
          extractionVersionedCount,
          qualityDenominator,
        ),
        detail: `${formatCount(extractionVersionedCount)} of ${formatCount(qualityDenominator)} revisions`,
        tone:
          extractionVersionedCount === qualityDenominator ? "green" : "amber",
      },
      {
        label: "Normalization version coverage",
        valueBasisPoints: toBasisPoints(
          normalizationVersionedCount,
          qualityDenominator,
        ),
        detail: `${formatCount(normalizationVersionedCount)} of ${formatCount(qualityDenominator)} revisions`,
        tone:
          normalizationVersionedCount === qualityDenominator
            ? "green"
            : "amber",
      },
      {
        label: "Average evidence coverage",
        valueBasisPoints: evidenceCoverageAverage,
        detail: "Synthetic field-level evidence references",
        tone: evidenceCoverageAverage >= 8_000 ? "green" : "blue",
      },
      {
        label: "Eligibility coverage",
        valueBasisPoints: toBasisPoints(eligibleCount, qualityDenominator),
        detail: "Strict synthetic eligibility policy",
        tone: eligibleCount === qualityDenominator ? "green" : "blue",
      },
    ],
    insight:
      status === "SUCCESS"
        ? "Quoted, accepted, and final amounts stay separate so negotiation and change-order movement remain visible."
        : "INSUFFICIENT_DATA — keep the component visible, but withhold commercial conclusions until the verified population is large enough.",
  };
}

export function formatCents(value: number | null): string {
  if (value === null) return "INSUFFICIENT_DATA";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

export function formatBasisPoints(value: number | null): string {
  if (value === null) return "INSUFFICIENT_DATA";
  const sign = value < 0 ? "−" : "";
  const absolute = Math.abs(value);
  const whole = Math.floor(absolute / 100);
  const fractional = absolute % 100;
  return fractional === 0
    ? `${sign}${whole}%`
    : `${sign}${whole}.${String(fractional).padStart(2, "0")}%`;
}
