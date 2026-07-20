/**
 * Sanitized fixture-only shapes for Broker Opportunity Qualification tests.
 * No PII. Synthetic data shaped from forensic_report_v2 analysis interfaces.
 */

import type {
  BrokerOpportunityQualificationInput,
  BrokerOpportunityQualificationPolicy,
  BrokerOpportunitySupportInput,
} from "./brokerOpportunityQualification.ts";
import { normalizeBrokerOpportunityInput } from "./brokerOpportunityQualification.ts";

/** Fixture-only test policy — not a production default. */
export const FIXTURE_EVIDENCE_POLICY = {
  minQuoteMathConfidence: 60,
  openingCountMismatchRequiresReview: true,
} as const;

/** Fixture-only commercial policy: above-county-range quotes with >= 5% delta. */
export const FIXTURE_COMMERCIAL_POLICY_INTERESTING: BrokerOpportunityQualificationPolicy[
  "commercial"
] = {
  isCommerciallyInteresting: (ctx) =>
    ctx.countyBenchmarkComparisonAvailable === true &&
    ctx.countyBenchmarkStatus === "above_county_range" &&
    ctx.countyBenchmarkDeltaPct !== null &&
    ctx.countyBenchmarkDeltaPct >= 5,
};

/** Fixture-only commercial policy: same gate, used to prove non-interesting quotes. */
export const FIXTURE_COMMERCIAL_POLICY_STRICT: BrokerOpportunityQualificationPolicy[
  "commercial"
] = FIXTURE_COMMERCIAL_POLICY_INTERESTING;

export const FIXTURE_TEST_POLICY_ELIGIBLE: BrokerOpportunityQualificationPolicy =
  {
    evidence: FIXTURE_EVIDENCE_POLICY,
    commercial: FIXTURE_COMMERCIAL_POLICY_INTERESTING,
  };

export const FIXTURE_TEST_POLICY_NO_COMMERCIAL: BrokerOpportunityQualificationPolicy =
  {
    evidence: FIXTURE_EVIDENCE_POLICY,
    commercial: null,
  };

const CLEAN_EXTRACTION = {
  document_type: "window_quote",
  opening_count: 14,
  total_quoted_price: 51800,
  installation: {
    scope_detail:
      "Remove and replace impact windows and one entry door per written scope.",
  },
  line_items: [
    {
      description: "Impact Window 32x54",
      quantity: 10,
      unit_price: 1250,
      total_price: 12500,
    },
    {
      description: "Impact Horizontal Roller Window",
      quantity: 3,
      unit_price: 1325,
      total_price: 3975,
    },
    {
      description: "Impact Entry Door",
      quantity: 1,
      unit_price: 2200,
      total_price: 2200,
    },
  ],
};

const CLEAN_DERIVED_METRICS = {
  totals: {
    contract_total: 51800,
    core_product_subtotal: 18675,
    install_like_subtotal: 8500,
  },
  counts: {
    total_openings: 14,
    opening_count_source: "extracted_header",
    inferred_core_openings: 14,
    window_openings: 13,
    door_openings: 1,
    total_line_items: 3,
    priced_line_items: 3,
  },
  per_opening: {
    contract_price_per_opening: 3700,
    installed_price_per_opening: 1941.07,
  },
  diagnostics: {
    quote_math_confidence: 92,
    warnings: [],
  },
  county_benchmark: {
    status: "above_county_range",
    comparison_available: true,
    delta_pct: 12.5,
    delta_amount: 215,
  },
  trust_signals: {
    scope_present: true,
  },
};

export const FIXTURE_CLEAN_FULL_JSON = {
  extraction: CLEAN_EXTRACTION,
  derived_metrics: CLEAN_DERIVED_METRICS,
};

export function buildFixtureEligibleInput(): BrokerOpportunityQualificationInput {
  return normalizeBrokerOpportunityInput({
    analysisStatus: "complete",
    confidenceScore: 0.91,
    documentType: "window_quote",
    fullJson: FIXTURE_CLEAN_FULL_JSON,
    lead: {
      county: "Broward",
      project_type: "full_home",
      client_slug: "direct",
    },
    quoteFacts: null,
  });
}

export function buildFixtureNotCommerciallyInterestingInput():
  BrokerOpportunityQualificationInput {
  const input = buildFixtureEligibleInput();
  return {
    ...input,
    financial: {
      ...input.financial,
      countyBenchmarkStatus: "within_county_range",
      countyBenchmarkDeltaPct: 2,
    },
  };
}

export function buildFixtureInsufficientScopeInput():
  BrokerOpportunityQualificationInput {
  return normalizeBrokerOpportunityInput({
    analysisStatus: "complete",
    confidenceScore: 0.88,
    fullJson: {
      extraction: {
        opening_count: null,
        total_quoted_price: null,
        line_items: [],
      },
      derived_metrics: {
        totals: { contract_total: null },
        counts: { total_openings: null },
        diagnostics: { quote_math_confidence: 20, warnings: [] },
      },
    },
    lead: { county: "Palm Beach" },
  });
}

export function buildFixtureConflictingEvidenceInput():
  BrokerOpportunityQualificationInput {
  return normalizeBrokerOpportunityInput({
    analysisStatus: "complete",
    confidenceScore: 0.86,
    fullJson: {
      extraction: {
        ...CLEAN_EXTRACTION,
        opening_count: 14,
      },
      derived_metrics: {
        ...CLEAN_DERIVED_METRICS,
        counts: {
          ...CLEAN_DERIVED_METRICS.counts,
          inferred_core_openings: 12,
        },
        diagnostics: {
          quote_math_confidence: 85,
          warnings: [
            "Opening count mismatch: extracted=14, inferred_from_lines=12",
          ],
        },
      },
    },
    lead: { county: "Broward" },
  });
}

export function buildFixtureWithoutQuoteFactsInput():
  BrokerOpportunityQualificationInput {
  return buildFixtureEligibleInput();
}

export function buildFixtureTrustSignalInput(
  quoteFacts: BrokerOpportunitySupportInput,
): BrokerOpportunityQualificationInput {
  return normalizeBrokerOpportunityInput({
    analysisStatus: "complete",
    confidenceScore: 0.9,
    fullJson: FIXTURE_CLEAN_FULL_JSON,
    lead: { county: "Broward" },
    quoteFacts,
  });
}

export function buildFixtureUncertainQuoteMathInput():
  BrokerOpportunityQualificationInput {
  return normalizeBrokerOpportunityInput({
    analysisStatus: "complete",
    confidenceScore: 0.75,
    fullJson: {
      extraction: {
        ...CLEAN_EXTRACTION,
        total_quoted_price: 51800,
      },
      derived_metrics: {
        ...CLEAN_DERIVED_METRICS,
        diagnostics: {
          quote_math_confidence: 45,
          warnings: [
            "Low pricing coverage: many line items are missing unit_price and total_price.",
          ],
        },
        county_benchmark: {
          status: "above_county_range",
          comparison_available: true,
          delta_pct: 15,
        },
      },
    },
    lead: { county: "Broward" },
  });
}
