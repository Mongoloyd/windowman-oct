/**
 * brokerOpportunityQualification.ts — Pure Broker Opportunity Qualification contract.
 *
 * Answers: do we have enough credible information (and approved commercial policy)
 * to advance a homeowner into a conditional broker opportunity?
 *
 * WindowMan is a broker / middleman — not the fulfillment contractor.
 * This module does NOT guarantee installed price or perform construction underwriting.
 *
 * Pure functions only. No I/O, no env, no database, no production default policy.
 */

export const BROKER_OPPORTUNITY_RULESET_VERSION =
  "broker_opportunity_qualification.v1";

export type BrokerOpportunityQualificationOutcome =
  | "ELIGIBLE_TO_PRESENT"
  | "MANUAL_REVIEW"
  | "INSUFFICIENT_INFORMATION"
  | "NO_MEANINGFUL_OPPORTUNITY";

export type BrokerOpportunityReasonCode =
  | "ANALYSIS_NOT_COMPLETE"
  | "DOCUMENT_NOT_USABLE"
  | "INSUFFICIENT_SCOPE"
  | "MISSING_QUOTE_TOTAL"
  | "MISSING_OPENING_COUNT"
  | "QUOTE_MATH_UNCERTAIN"
  | "OPENING_COUNT_MISMATCH"
  | "OPTIONAL_TRUST_SIGNAL_REQUIRES_REVIEW"
  | "DUPLICATE_SUSPECTED"
  | "COMMERCIAL_POLICY_NOT_CONFIGURED"
  | "COMMERCIAL_POLICY_NOT_SATISFIED"
  | "COMMERCIAL_POLICY_SATISFIED";

const TRUST_REVIEW_ANOMALY_STATUSES = new Set([
  "review",
  "quarantine",
  "reject",
]);

export type BrokerOpportunityAnalysisInput = {
  analysisStatus: string | null;
  confidenceScore: number | null;
  documentType: string | null;
};

export type BrokerOpportunityScopeInput = {
  totalOpenings: number | null;
  windowOpenings: number | null;
  doorOpenings: number | null;
  lineItemCount: number;
  hasScopeDetail: boolean;
  openingCountMismatch: boolean;
};

export type BrokerOpportunityFinancialInput = {
  contractTotal: number | null;
  contractPricePerOpening: number | null;
  installedPricePerOpening: number | null;
  quoteMathConfidence: number | null;
  quoteMathWarnings: string[];
  countyBenchmarkStatus: string | null;
  countyBenchmarkComparisonAvailable: boolean;
  countyBenchmarkDeltaPct: number | null;
};

export type BrokerOpportunityContextInput = {
  county: string | null;
  projectType: string | null;
  clientSlug: string | null;
};

/** Optional wm_quote_facts support — never required for evaluation. */
export type BrokerOpportunitySupportInput = {
  manualReviewRequired: boolean | null;
  duplicateSuspected: boolean | null;
  trustScore: number | null;
  anomalyStatus: string | null;
  isQuoteDocument: boolean | null;
};

export type BrokerOpportunityQualificationInput = {
  analysis: BrokerOpportunityAnalysisInput;
  scope: BrokerOpportunityScopeInput;
  financial: BrokerOpportunityFinancialInput;
  context: BrokerOpportunityContextInput;
  support?: BrokerOpportunitySupportInput | null;
};

export type BrokerOpportunityCommercialContext = {
  contractTotal: number | null;
  totalOpenings: number | null;
  contractPricePerOpening: number | null;
  installedPricePerOpening: number | null;
  countyBenchmarkStatus: string | null;
  countyBenchmarkDeltaPct: number | null;
  countyBenchmarkComparisonAvailable: boolean;
};

export type BrokerOpportunityEvidencePolicy = {
  /** Minimum diagnostics.quote_math_confidence (0–100). Caller-supplied only. */
  minQuoteMathConfidence: number;
  /** When true, opening-count mismatch routes to manual review instead of blocking earlier. */
  openingCountMismatchRequiresReview?: boolean;
};

export type BrokerOpportunityCommercialPolicy = {
  isCommerciallyInteresting: (
    ctx: BrokerOpportunityCommercialContext,
  ) => boolean;
};

/** Explicit policy boundary — no production default export. */
export type BrokerOpportunityQualificationPolicy = {
  evidence: BrokerOpportunityEvidencePolicy;
  commercial?: BrokerOpportunityCommercialPolicy | null;
};

export type BrokerOpportunityQualificationEvidence = {
  analysis_status: string | null;
  document_type: string | null;
  contract_total: number | null;
  total_openings: number | null;
  line_item_count: number;
  quote_math_confidence: number | null;
  county_benchmark_status: string | null;
  county_benchmark_delta_pct: number | null;
  county_benchmark_comparison_available: boolean;
  manual_review_required: boolean | null;
  duplicate_suspected: boolean | null;
  anomaly_status: string | null;
  support_present: boolean;
};

export type BrokerOpportunityQualificationResult = {
  result: BrokerOpportunityQualificationOutcome;
  reasonCodes: BrokerOpportunityReasonCode[];
  evidence: BrokerOpportunityQualificationEvidence;
  rulesetVersion: string;
};

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function boolOrNull(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function hasOpeningCountMismatchWarning(warnings: string[]): boolean {
  return warnings.some((warning) =>
    /opening count mismatch/i.test(warning)
  );
}

function buildEvidence(
  input: BrokerOpportunityQualificationInput,
): BrokerOpportunityQualificationEvidence {
  const support = input.support ?? null;
  return {
    analysis_status: input.analysis.analysisStatus,
    document_type: input.analysis.documentType,
    contract_total: input.financial.contractTotal,
    total_openings: input.scope.totalOpenings,
    line_item_count: input.scope.lineItemCount,
    quote_math_confidence: input.financial.quoteMathConfidence,
    county_benchmark_status: input.financial.countyBenchmarkStatus,
    county_benchmark_delta_pct: input.financial.countyBenchmarkDeltaPct,
    county_benchmark_comparison_available:
      input.financial.countyBenchmarkComparisonAvailable,
    manual_review_required: support?.manualReviewRequired ?? null,
    duplicate_suspected: support?.duplicateSuspected ?? null,
    anomaly_status: support?.anomalyStatus ?? null,
    support_present: support !== null && support !== undefined,
  };
}

function buildCommercialContext(
  input: BrokerOpportunityQualificationInput,
): BrokerOpportunityCommercialContext {
  return {
    contractTotal: input.financial.contractTotal,
    totalOpenings: input.scope.totalOpenings,
    contractPricePerOpening: input.financial.contractPricePerOpening,
    installedPricePerOpening: input.financial.installedPricePerOpening,
    countyBenchmarkStatus: input.financial.countyBenchmarkStatus,
    countyBenchmarkDeltaPct: input.financial.countyBenchmarkDeltaPct,
    countyBenchmarkComparisonAvailable:
      input.financial.countyBenchmarkComparisonAvailable,
  };
}

function collectInsufficientReasons(
  input: BrokerOpportunityQualificationInput,
): BrokerOpportunityReasonCode[] {
  const reasons: BrokerOpportunityReasonCode[] = [];
  const status = input.analysis.analysisStatus;

  if (status !== "complete") {
    if (
      status === "invalid_document" ||
      status === "needs_better_upload" ||
      status === "unreadable_quote"
    ) {
      reasons.push("DOCUMENT_NOT_USABLE");
    } else {
      reasons.push("ANALYSIS_NOT_COMPLETE");
    }
    return reasons;
  }

  if (input.support?.isQuoteDocument === false) {
    reasons.push("DOCUMENT_NOT_USABLE");
    return reasons;
  }

  const contractTotal = input.financial.contractTotal;
  if (contractTotal === null || contractTotal <= 0) {
    reasons.push("MISSING_QUOTE_TOTAL");
  }

  const totalOpenings = input.scope.totalOpenings;
  if (totalOpenings === null || totalOpenings <= 0) {
    reasons.push("MISSING_OPENING_COUNT");
  }

  if (input.scope.lineItemCount < 1) {
    reasons.push("INSUFFICIENT_SCOPE");
  }

  return reasons;
}

function collectReviewReasons(
  input: BrokerOpportunityQualificationInput,
  policy: BrokerOpportunityQualificationPolicy,
): BrokerOpportunityReasonCode[] {
  const reasons: BrokerOpportunityReasonCode[] = [];
  const support = input.support;

  const quoteMathConfidence = input.financial.quoteMathConfidence;
  if (
    quoteMathConfidence === null ||
    quoteMathConfidence < policy.evidence.minQuoteMathConfidence
  ) {
    reasons.push("QUOTE_MATH_UNCERTAIN");
  }

  const mismatch = input.scope.openingCountMismatch ||
    hasOpeningCountMismatchWarning(input.financial.quoteMathWarnings);
  if (mismatch && policy.evidence.openingCountMismatchRequiresReview !== false) {
    reasons.push("OPENING_COUNT_MISMATCH");
  }

  if (support?.manualReviewRequired === true) {
    reasons.push("OPTIONAL_TRUST_SIGNAL_REQUIRES_REVIEW");
  }

  if (support?.duplicateSuspected === true) {
    reasons.push("DUPLICATE_SUSPECTED");
  }

  const anomalyStatus = support?.anomalyStatus?.toLowerCase() ?? null;
  if (anomalyStatus && TRUST_REVIEW_ANOMALY_STATUSES.has(anomalyStatus)) {
    reasons.push("OPTIONAL_TRUST_SIGNAL_REQUIRES_REVIEW");
  }

  return reasons;
}

/**
 * Normalize existing analysis / lead / optional wm_quote_facts shapes into the
 * narrow qualification input contract.
 */
export function normalizeBrokerOpportunityInput(args: {
  analysisStatus: string | null;
  confidenceScore?: number | null;
  documentType?: string | null;
  fullJson?: Record<string, unknown> | null;
  lead?: {
    county?: string | null;
    project_type?: string | null;
    client_slug?: string | null;
  } | null;
  quoteFacts?: BrokerOpportunitySupportInput | null;
}): BrokerOpportunityQualificationInput {
  const fullJson = readRecord(args.fullJson);
  const extraction = readRecord(fullJson?.extraction);
  const derivedMetrics = readRecord(fullJson?.derived_metrics);
  const totals = readRecord(derivedMetrics?.totals);
  const counts = readRecord(derivedMetrics?.counts);
  const perOpening = readRecord(derivedMetrics?.per_opening);
  const diagnostics = readRecord(derivedMetrics?.diagnostics);
  const countyBenchmark = readRecord(derivedMetrics?.county_benchmark);
  const trustSignals = readRecord(derivedMetrics?.trust_signals);

  const lineItems = Array.isArray(extraction?.line_items)
    ? extraction.line_items
    : [];

  const quoteMathWarnings = readStringArray(diagnostics?.warnings);
  const extractedOpenings = finiteNumber(extraction?.opening_count);
  const derivedOpenings = finiteNumber(counts?.total_openings);
  const inferredCoreOpenings = finiteNumber(counts?.inferred_core_openings);

  const openingCountMismatch = (
    extractedOpenings !== null &&
    inferredCoreOpenings !== null &&
    extractedOpenings > 0 &&
    inferredCoreOpenings > 0 &&
    extractedOpenings !== inferredCoreOpenings
  ) || hasOpeningCountMismatchWarning(quoteMathWarnings);

  const contractTotal = finiteNumber(totals?.contract_total) ??
    finiteNumber(extraction?.total_quoted_price);

  const installation = readRecord(extraction?.installation);

  return {
    analysis: {
      analysisStatus: stringOrNull(args.analysisStatus),
      confidenceScore: finiteNumber(args.confidenceScore),
      documentType: stringOrNull(args.documentType) ??
        stringOrNull(extraction?.document_type),
    },
    scope: {
      totalOpenings: derivedOpenings ?? extractedOpenings,
      windowOpenings: finiteNumber(counts?.window_openings),
      doorOpenings: finiteNumber(counts?.door_openings),
      lineItemCount: lineItems.length,
      hasScopeDetail: Boolean(installation?.scope_detail) ||
        boolOrNull(trustSignals?.scope_present) === true,
      openingCountMismatch,
    },
    financial: {
      contractTotal,
      contractPricePerOpening: finiteNumber(
        perOpening?.contract_price_per_opening,
      ),
      installedPricePerOpening: finiteNumber(
        perOpening?.installed_price_per_opening,
      ),
      quoteMathConfidence: finiteNumber(diagnostics?.quote_math_confidence),
      quoteMathWarnings,
      countyBenchmarkStatus: stringOrNull(countyBenchmark?.status),
      countyBenchmarkComparisonAvailable:
        countyBenchmark?.comparison_available === true,
      countyBenchmarkDeltaPct: finiteNumber(countyBenchmark?.delta_pct),
    },
    context: {
      county: stringOrNull(args.lead?.county),
      projectType: stringOrNull(args.lead?.project_type),
      clientSlug: stringOrNull(args.lead?.client_slug),
    },
    support: args.quoteFacts ?? null,
  };
}

/**
 * Deterministic broker opportunity qualification evaluator.
 * Policy must be supplied by the caller — no hidden commercial defaults.
 */
export function evaluateBrokerOpportunity(
  input: BrokerOpportunityQualificationInput,
  policy: BrokerOpportunityQualificationPolicy,
): BrokerOpportunityQualificationResult {
  const evidence = buildEvidence(input);

  const insufficientReasons = collectInsufficientReasons(input);
  if (insufficientReasons.length > 0) {
    return {
      result: "INSUFFICIENT_INFORMATION",
      reasonCodes: insufficientReasons,
      evidence,
      rulesetVersion: BROKER_OPPORTUNITY_RULESET_VERSION,
    };
  }

  const reviewReasons = collectReviewReasons(input, policy);
  if (reviewReasons.length > 0) {
    return {
      result: "MANUAL_REVIEW",
      reasonCodes: reviewReasons,
      evidence,
      rulesetVersion: BROKER_OPPORTUNITY_RULESET_VERSION,
    };
  }

  const commercial = policy.commercial;
  if (!commercial) {
    return {
      result: "MANUAL_REVIEW",
      reasonCodes: ["COMMERCIAL_POLICY_NOT_CONFIGURED"],
      evidence,
      rulesetVersion: BROKER_OPPORTUNITY_RULESET_VERSION,
    };
  }

  const commercialContext = buildCommercialContext(input);
  const commerciallyInteresting = commercial.isCommerciallyInteresting(
    commercialContext,
  );

  if (!commerciallyInteresting) {
    return {
      result: "NO_MEANINGFUL_OPPORTUNITY",
      reasonCodes: ["COMMERCIAL_POLICY_NOT_SATISFIED"],
      evidence,
      rulesetVersion: BROKER_OPPORTUNITY_RULESET_VERSION,
    };
  }

  return {
    result: "ELIGIBLE_TO_PRESENT",
    reasonCodes: ["COMMERCIAL_POLICY_SATISFIED"],
    evidence,
    rulesetVersion: BROKER_OPPORTUNITY_RULESET_VERSION,
  };
}
