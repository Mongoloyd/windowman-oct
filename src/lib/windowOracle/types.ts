/**
 * Window Oracle — pure domain contract.
 *
 * No I/O, no Supabase, no env. Future admin-data / Edge layers must speak this language.
 * Broker Opportunity Qualification may consume OracleQueryResponse as marketEvidence later.
 */

export type ObservationProvenance = "QUOTED" | "VERIFIED_SOLD";

export type OracleProvenanceMode = "QUOTED" | "VERIFIED_SOLD" | "COMPARE";

export type OracleConfidenceLevel =
  | "HIGH"
  | "MODERATE"
  | "LOW"
  | "INSUFFICIENT";

export type EligibilityDecision = "INCLUDE" | "EXCLUDE" | "REVIEW";

export type FallbackCode =
  | "DIMENSION_TOLERANCE_EXPANDED"
  | "SERIES_REMOVED"
  | "ZIP_TO_COUNTY"
  | "BRAND_TO_PRODUCT_TYPE"
  | "DATE_RANGE_EXPANDED";

export type PpoMetricUsed =
  | "installed_price_per_opening"
  | "contract_price_per_opening";

/** Normalized observation already resolved by the caller (DB or fixtures). */
export type OracleObservation = {
  id: string;
  provenance: ObservationProvenance;
  observedAt: string;
  zip: string | null;
  county: string | null;
  projectType: string | null;
  openingCount: number | null;
  windowCount: number | null;
  doorCount: number | null;
  projectTotal: number | null;
  /** Canonical PPO after installed → contract precedence. */
  ppo: number | null;
  ppoMetricUsed: PpoMetricUsed | null;
  brand: string | null;
  series: string | null;
  productType: string | null;
  widthIn: number | null;
  heightIn: number | null;
  dimensionsRaw: string | null;
  contractorKey: string | null;
  contractorLabel: string | null;
  approvedForIndex: boolean | null;
  manualReviewRequired: boolean | null;
  duplicateSuspected: boolean | null;
  anomalyStatus: string | null;
  outcomeVerified: boolean | null;
  soldScopeComparable: boolean | null;
  didBeatPrice: boolean | null;
};

export type OracleQueryRequest = {
  geography?: {
    zip?: string;
    county?: string;
  };
  project?: {
    projectType?: string;
    openingCountMin?: number;
    openingCountMax?: number;
  };
  product?: {
    brand?: string;
    series?: string;
    type?: string;
    width?: number;
    height?: number;
    dimensionToleranceIn?: number;
  };
  provenance: OracleProvenanceMode;
  dateRangeMonths?: number | null;
  /** Optional homeowner PPO for call-summary positioning. */
  homeownerPpo?: number | null;
};

export type MarketDistribution = {
  sampleCount: number;
  min: number | null;
  p25: number | null;
  median: number | null;
  average: number | null;
  p75: number | null;
  max: number | null;
};

export type ConfidenceResult = {
  level: OracleConfidenceLevel;
  sampleCount: number;
  reasons: string[];
  highPriceOutliersPresent: boolean;
  tightDistribution: boolean;
};

export type QueryFallback = {
  code: FallbackCode;
  detail: string;
};

export type ContractorBenchmark = {
  contractorKey: string;
  contractorLabel: string;
  quoteCount: number;
  verifiedSoldCount: number;
  medianQuotedPpo: number | null;
  medianSoldPpo: number | null;
  beatPriceFrequency: number | null;
  pricingTierLabel:
    | "LOWER-PRICED"
    | "MID-MARKET"
    | "PREMIUM"
    | "INSUFFICIENT DATA";
};

export type BrandSeriesStat = {
  brand: string | null;
  series: string | null;
  observationCount: number;
  medianPpo: number | null;
};

export type FieldCoverageStat = {
  field: string;
  present: number;
  total: number;
  pct: number | null;
};

export type DataIntakeSummary = {
  quotes: number;
  analyses: number;
  trusted: number;
  rejected: number;
  manualReview: number;
};

export type OracleQueryResponse = {
  confidence: ConfidenceResult;
  sampleCount: number;
  cohortDefinition: {
    geographyLevel: "zip" | "county" | "none";
    zip: string | null;
    county: string | null;
    projectType: string | null;
    brand: string | null;
    series: string | null;
    productType: string | null;
    openingCountMin: number | null;
    openingCountMax: number | null;
    dateRangeMonths: number | null;
  };
  fallbacksApplied: QueryFallback[];
  exactMatchCount: number;
  dateRange: {
    from: string | null;
    to: string | null;
  };
  ppo: MarketDistribution;
  projectTotals: MarketDistribution;
  contractors: ContractorBenchmark[];
  brandSeries: BrandSeriesStat[];
  provenance: {
    quoted: number;
    verifiedSold: number;
  };
  quotedPpo: MarketDistribution | null;
  verifiedSoldPpo: MarketDistribution | null;
  quotedToSoldMedianDeltaPct: number | null;
  ppoMetricUsed: PpoMetricUsed | "mixed" | null;
  eligibilitySummary: {
    candidatesConsidered: number;
    eligibleAfterTrustGates: number;
    excludedManualReview: number;
    excludedDuplicateSuspected: number;
    excludedMissingPpo: number;
    excludedOther: number;
  };
  geographyMatch: {
    level: "zip" | "county" | "broadened" | "none";
    zipMatchPct: number | null;
  };
  wording: {
    marketScopeLabel: string;
    notClaimed: string[];
  };
  callSummary: OracleCallSummary | null;
  /** Recent anonymized observation ids only — never PII. */
  recentObservationIds: string[];
};

export type OracleCallSummary = {
  confidenceLevel: OracleConfidenceLevel;
  sampleCount: number;
  medianPpo: number | null;
  p25: number | null;
  p75: number | null;
  homeownerPpo: number | null;
  position:
    | "BELOW_P25"
    | "WITHIN_MIDDLE_50"
    | "ABOVE_P75"
    | "AT_MEDIAN"
    | "UNKNOWN";
  scriptLines: string[];
  approvedInterpretation: string | null;
};

/** Injected policy — never hard-code production thresholds in evaluators. */
export type OracleConfidencePolicy = {
  insufficientMax: number;
  lowMax: number;
  moderateMax: number;
  /** average/median ratio above which HIGH-PRICE OUTLIERS PRESENT */
  outlierRatioThreshold: number;
  /** |average-median|/median below which TIGHT DISTRIBUTION */
  tightRelativeDelta: number;
};

export type QuoteEligibilityInput = {
  analysisComplete: boolean;
  documentUsable: boolean;
  quoteTotal: number | null;
  openingCount: number | null;
  ppo: number | null;
  hasGeography: boolean;
  approvedForIndex: boolean | null;
  manualReviewRequired: boolean | null;
  duplicateSuspected: boolean | null;
  anomalyStatus: string | null;
  impossibleValuesDetected: boolean | null;
};

export type SoldEligibilityInput = {
  outcomeVerified: boolean;
  finalSoldValue: number | null;
  openingCount: number | null;
  soldScopeComparable: boolean | null;
  hasCanonicalProjectLink: boolean;
};
