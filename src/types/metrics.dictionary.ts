export type OracleProductSurface =
  | "PUBLIC_ORACLE"
  | "OBSERVATORY"
  | "FOUNDATION"
  | "COCKPIT"
  | "DATALAB";

export type MetricExposure = "PUBLIC" | "INTERNAL";

export type MetricUnit =
  | "INT_CENTS"
  | "SIGNED_INT_CENTS"
  | "USD_LEGACY"
  | "PERCENT"
  | "BASIS_POINTS"
  | "COUNT"
  | "RATIO"
  | "BOOLEAN"
  | "LABEL"
  | "DATE_RANGE"
  | "DISTRIBUTION";

export type MetricSourceMode =
  | "SYNTHETIC_LITERAL"
  | "SYNTHETIC_DERIVED"
  | "LIVE_BOUND";

export type MetricSemanticStatus =
  | "VERIFIED_CONTRACT"
  | "SYNTHETIC_DEMO"
  | "UNBOUND"
  | "CONFLICTED";

export interface MetricDefinitionShape {
  readonly id: string;
  readonly label: string;
  readonly ownerSurface: OracleProductSurface;
  readonly unit: MetricUnit;
  readonly calculation: string;
  readonly denominator: string;
  readonly sourceModule: string;
  readonly exposure: MetricExposure;
  readonly minSampleSize: number;
  readonly sourceMode: MetricSourceMode;
  readonly semanticStatus: MetricSemanticStatus;
  readonly profileable: boolean;
  readonly note?: string;
}

function metric<const Id extends string>(
  id: Id,
  label: string,
  ownerSurface: OracleProductSurface,
  unit: MetricUnit,
  calculation: string,
  denominator: string,
  sourceModule: string,
  exposure: MetricExposure,
  minSampleSize: number,
  sourceMode: MetricSourceMode,
  semanticStatus: MetricSemanticStatus,
  profileable: boolean,
  note?: string,
): MetricDefinitionShape & { readonly id: Id } {
  return Object.freeze({
    id,
    label,
    ownerSurface,
    unit,
    calculation,
    denominator,
    sourceModule,
    exposure,
    minSampleSize,
    sourceMode,
    semanticStatus,
    profileable,
    ...(note ? { note } : {}),
  });
}

const PUBLIC_SOURCE = "src/features/intelligence/fixtures.ts";
const OBSERVATORY_SOURCE = "src/features/intelligence/fixtures.ts";
const FOUNDATION_SOURCE = "src/features/intelligence-console/adapter.ts";
const COCKPIT_SOURCE = "src/lib/windowOracle/queryEngine.ts";
const DATALAB_SOURCE = "src/lib/windowOracle/queryEngine.ts";

/**
 * Canonical identity and ownership for every metric currently represented by
 * the five Oracle Lab surfaces. A metric has exactly one ownerSurface. Other
 * surfaces must define a new, explicitly named view metric rather than reuse a
 * metric under a second meaning.
 */
export const METRIC_DICTIONARY = Object.freeze({
  "public.sample_size": metric("public.sample_size", "Sample", "PUBLIC_ORACLE", "COUNT", "evidence.governedQuoteCount", "governed synthetic quote observations", PUBLIC_SOURCE, "PUBLIC", 30, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", true),
  "public.outcome_coverage_pct": metric("public.outcome_coverage_pct", "Outcomes known", "PUBLIC_ORACLE", "PERCENT", "evidence.outcomeCoveragePct; never recompute from another displayed value", "governed synthetic quote observations", PUBLIC_SOURCE, "PUBLIC", 30, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", true),
  "public.cohort_mode": metric("public.cohort_mode", "Cohort", "PUBLIC_ORACLE", "LABEL", "evidence.broadened ? 'Broadened' : 'Exact'", "governed synthetic quote observations", PUBLIC_SOURCE, "PUBLIC", 30, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", true),
  "public.quoted_median": metric("public.quoted_median", "Quoted median", "PUBLIC_ORACLE", "INT_CENTS", "quoted.medianCents", "quoted observations in the selected synthetic cohort", PUBLIC_SOURCE, "PUBLIC", 30, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", true),
  "public.accepted_median": metric("public.accepted_median", "Verified accepted median", "PUBLIC_ORACLE", "INT_CENTS", "verifiedAccepted.medianCents", "verified-accepted observations in the selected synthetic cohort", PUBLIC_SOURCE, "PUBLIC", 30, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", true),
  "public.quoted_accepted_gap": metric("public.quoted_accepted_gap", "Synthetic difference", "PUBLIC_ORACLE", "SIGNED_INT_CENTS", "quoted.medianCents - verifiedAccepted.medianCents", "separately computed quoted and verified-accepted synthetic medians", PUBLIC_SOURCE, "PUBLIC", 30, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", true),
  "public.verified_accepted_count": metric("public.verified_accepted_count", "Verified accepted observations", "PUBLIC_ORACLE", "COUNT", "evidence.verifiedAcceptedCount", "verified-accepted observations in the selected synthetic cohort", PUBLIC_SOURCE, "PUBLIC", 30, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", true),
  "public.date_range": metric("public.date_range", "Date range", "PUBLIC_ORACLE", "DATE_RANGE", "evidence.dateFrom through evidence.dateTo", "governed synthetic quote observations", PUBLIC_SOURCE, "PUBLIC", 30, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", true),
  "public.distribution_quoted": metric("public.distribution_quoted", "Quoted · offered", "PUBLIC_ORACLE", "DISTRIBUTION", "quoted low/p25/median/p75/high integer-cent distribution", "quoted observations in the selected synthetic cohort", PUBLIC_SOURCE, "PUBLIC", 30, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", true),
  "public.distribution_accepted": metric("public.distribution_accepted", "Verified accepted", "PUBLIC_ORACLE", "DISTRIBUTION", "verifiedAccepted low/p25/median/p75/high integer-cent distribution", "verified-accepted observations in the selected synthetic cohort", PUBLIC_SOURCE, "PUBLIC", 30, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", true),
  "public.revision_below_initial": metric("public.revision_below_initial", "Accepted below initial quote", "PUBLIC_ORACLE", "PERCENT", "legacy JSX literal 46", "not bound", PUBLIC_SOURCE, "PUBLIC", 30, "SYNTHETIC_LITERAL", "UNBOUND", false),
  "public.revision_within_5pct": metric("public.revision_within_5pct", "Accepted within ±5%", "PUBLIC_ORACLE", "PERCENT", "legacy JSX literal 32", "not bound", PUBLIC_SOURCE, "PUBLIC", 30, "SYNTHETIC_LITERAL", "UNBOUND", false),
  "public.revision_above_initial": metric("public.revision_above_initial", "Accepted above initial quote", "PUBLIC_ORACLE", "PERCENT", "legacy JSX literal 22", "not bound", PUBLIC_SOURCE, "PUBLIC", 30, "SYNTHETIC_LITERAL", "UNBOUND", false),
  "public.initial_to_accepted_delta": metric("public.initial_to_accepted_delta", "Initial → accepted", "PUBLIC_ORACLE", "PERCENT", "legacy display literal −6.8%; not paired at project level", "not bound", PUBLIC_SOURCE, "PUBLIC", 30, "SYNTHETIC_LITERAL", "UNBOUND", false),
  "public.accepted_to_final_delta": metric("public.accepted_to_final_delta", "Accepted → final", "PUBLIC_ORACLE", "PERCENT", "legacy display literal +3.9%", "not bound", PUBLIC_SOURCE, "PUBLIC", 30, "SYNTHETIC_LITERAL", "UNBOUND", false),
  "public.bid_position_lowest": metric("public.bid_position_lowest", "Lowest price selected", "PUBLIC_ORACLE", "PERCENT", "legacy display literal 29%", "not bound", PUBLIC_SOURCE, "PUBLIC", 30, "SYNTHETIC_LITERAL", "UNBOUND", false),
  "public.bid_position_middle": metric("public.bid_position_middle", "Middle price selected", "PUBLIC_ORACLE", "PERCENT", "legacy display literal 51%", "not bound", PUBLIC_SOURCE, "PUBLIC", 30, "SYNTHETIC_LITERAL", "UNBOUND", false),
  "public.bid_position_highest": metric("public.bid_position_highest", "Highest price selected", "PUBLIC_ORACLE", "PERCENT", "legacy display literal 20%", "not bound", PUBLIC_SOURCE, "PUBLIC", 30, "SYNTHETIC_LITERAL", "UNBOUND", false),
  "public.scope_completeness_bar": metric("public.scope_completeness_bar", "Visible scope completeness", "PUBLIC_ORACLE", "PERCENT", "legacy display literal 74; conflicts with insight.scope_completeness 64%", "conflicting synthetic definitions", PUBLIC_SOURCE, "PUBLIC", 30, "SYNTHETIC_LITERAL", "CONFLICTED", false),
  "public.product_fit_bar": metric("public.product_fit_bar", "Product fit", "PUBLIC_ORACLE", "PERCENT", "legacy display literal 61", "not bound", PUBLIC_SOURCE, "PUBLIC", 30, "SYNTHETIC_LITERAL", "UNBOUND", false),
  "public.warranty_specificity_bar": metric("public.warranty_specificity_bar", "Warranty specificity", "PUBLIC_ORACLE", "PERCENT", "legacy display literal 48; conflicts with insight.warranty_specificity 58%", "conflicting synthetic definitions", PUBLIC_SOURCE, "PUBLIC", 30, "SYNTHETIC_LITERAL", "CONFLICTED", false),
  "observatory.governed_estimates": metric("observatory.governed_estimates", "Governed estimates", "OBSERVATORY", "COUNT", "evidence.governedQuoteCount", "governed synthetic quote observations", OBSERVATORY_SOURCE, "INTERNAL", 5, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", true),
  "observatory.verified_accepted": metric("observatory.verified_accepted", "Verified accepted", "OBSERVATORY", "COUNT", "evidence.verifiedAcceptedCount", "governed synthetic quote observations", OBSERVATORY_SOURCE, "INTERNAL", 5, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", true),
  "observatory.verified_final": metric("observatory.verified_final", "Verified final", "OBSERVATORY", "COUNT", "evidence.verifiedFinalCount", "governed synthetic quote observations", OBSERVATORY_SOURCE, "INTERNAL", 5, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", true),
  "observatory.outcome_coverage": metric("observatory.outcome_coverage", "Outcome coverage", "OBSERVATORY", "PERCENT", "evidence.outcomeCoveragePct", "governed synthetic quote observations", OBSERVATORY_SOURCE, "INTERNAL", 5, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", true),
  "observatory.date_range": metric("observatory.date_range", "Date range", "OBSERVATORY", "DATE_RANGE", "evidence.dateFrom through evidence.dateTo", "governed synthetic quote observations", OBSERVATORY_SOURCE, "INTERNAL", 5, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", true),
  "observatory.cohort_label": metric("observatory.cohort_label", "Cohort label", "OBSERVATORY", "LABEL", "evidence.cohortLabel", "governed synthetic quote observations", OBSERVATORY_SOURCE, "INTERNAL", 5, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", true),
  "observatory.geography_label": metric("observatory.geography_label", "Geography label", "OBSERVATORY", "LABEL", "evidence.geographyLabel", "governed synthetic quote observations", OBSERVATORY_SOURCE, "INTERNAL", 5, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", true),
  "observatory.distribution_quoted": metric("observatory.distribution_quoted", "Quoted distribution", "OBSERVATORY", "DISTRIBUTION", "quoted low/p25/median/p75/high distribution", "quoted synthetic observations", OBSERVATORY_SOURCE, "INTERNAL", 5, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", true),
  "observatory.distribution_accepted": metric("observatory.distribution_accepted", "Verified accepted distribution", "OBSERVATORY", "DISTRIBUTION", "verifiedAccepted low/p25/median/p75/high distribution", "verified-accepted synthetic observations", OBSERVATORY_SOURCE, "INTERNAL", 5, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", true),
  "observatory.distribution_final": metric("observatory.distribution_final", "Verified final", "OBSERVATORY", "DISTRIBUTION", "verifiedFinal low/p25/median/p75/high distribution", "verified-final synthetic observations", OBSERVATORY_SOURCE, "INTERNAL", 5, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", true),
  "observatory.module_sample_size": metric("observatory.module_sample_size", "n=", "OBSERVATORY", "COUNT", "fixture heuristic by insight number", "insight-specific synthetic observations", OBSERVATORY_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", true),
  "observatory.registered_concept_count": metric("observatory.registered_concept_count", "registered concepts", "OBSERVATORY", "COUNT", "VIEW_INSIGHTS[view] after module filtering", "registered insight concepts", "src/features/intelligence/IntelligenceConsoleSurface.tsx", "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", true),
  "observatory.quality_extraction_contract": metric("observatory.quality_extraction_contract", "Closed extraction contract", "OBSERVATORY", "PERCENT", "legacy fixture literal 32", "not production-bound", OBSERVATORY_SOURCE, "INTERNAL", 5, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", false),
  "observatory.quality_outcome_verification": metric("observatory.quality_outcome_verification", "Outcome verification coverage", "OBSERVATORY", "PERCENT", "legacy fixture literal 41", "not production-bound", OBSERVATORY_SOURCE, "INTERNAL", 5, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", false),
  "observatory.quality_revision_linkage": metric("observatory.quality_revision_linkage", "Quote/revision linkage", "OBSERVATORY", "PERCENT", "legacy fixture literal 18", "not production-bound", OBSERVATORY_SOURCE, "INTERNAL", 5, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", false),
  "observatory.quality_public_readiness": metric("observatory.quality_public_readiness", "Public cohort readiness", "OBSERVATORY", "PERCENT", "legacy fixture literal 12", "not production-bound", OBSERVATORY_SOURCE, "INTERNAL", 5, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", false),
  "observatory.suppressed_cohorts": metric("observatory.suppressed_cohorts", "Suppressed cohorts", "OBSERVATORY", "COUNT", "legacy fixture literal 9", "not production-bound", OBSERVATORY_SOURCE, "INTERNAL", 5, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", false),
  "observatory.live_insights": metric("observatory.live_insights", "Live insights", "OBSERVATORY", "COUNT", "legacy fixture literal 0", "registered insight concepts", OBSERVATORY_SOURCE, "INTERNAL", 5, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", true),

  "insight.quoted_vs_accepted_price": metric("insight.quoted_vs_accepted_price", "Quoted price versus verified accepted price", "OBSERVATORY", "LABEL", "preformatted metricSets[1] synthetic fixture", "insight-specific synthetic observations", OBSERVATORY_SOURCE, "PUBLIC", 5, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", true),
  "insight.acceptance_by_price_position": metric("insight.acceptance_by_price_position", "Acceptance by quoted-price position", "OBSERVATORY", "LABEL", "preformatted metricSets[2] synthetic fixture", "insight-specific synthetic observations", OBSERVATORY_SOURCE, "PUBLIC", 5, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", true),
  "insight.initial_to_accepted_delta": metric("insight.initial_to_accepted_delta", "Initial quote to accepted contract", "OBSERVATORY", "LABEL", "preformatted metricSets[3] synthetic fixture", "unpaired synthetic populations", OBSERVATORY_SOURCE, "PUBLIC", 5, "SYNTHETIC_LITERAL", "UNBOUND", false),
  "insight.accepted_to_final_delta": metric("insight.accepted_to_final_delta", "Accepted contract to final outcome", "OBSERVATORY", "LABEL", "preformatted metricSets[4] synthetic fixture", "insight-specific synthetic observations", OBSERVATORY_SOURCE, "PUBLIC", 5, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", true),
  "insight.price_per_opening": metric("insight.price_per_opening", "Price per physical opening", "OBSERVATORY", "LABEL", "preformatted metricSets[5] synthetic fixture", "opening semantics not production-bound", OBSERVATORY_SOURCE, "PUBLIC", 5, "SYNTHETIC_LITERAL", "UNBOUND", false),
  "insight.size_adjusted_price": metric("insight.size_adjusted_price", "Size-adjusted pricing", "OBSERVATORY", "LABEL", "preformatted metricSets[6] synthetic fixture", "normalization policy not production-bound", OBSERVATORY_SOURCE, "PUBLIC", 5, "SYNTHETIC_LITERAL", "UNBOUND", false),
  "insight.product_tier_migration": metric("insight.product_tier_migration", "Product-tier migration", "OBSERVATORY", "LABEL", "preformatted metricSets[7] synthetic fixture", "product taxonomy not production-bound", OBSERVATORY_SOURCE, "PUBLIC", 5, "SYNTHETIC_LITERAL", "UNBOUND", false),
  "insight.glass_package_premium": metric("insight.glass_package_premium", "Glass-package premium", "OBSERVATORY", "LABEL", "preformatted metricSets[8] synthetic fixture", "glass taxonomy not production-bound", OBSERVATORY_SOURCE, "PUBLIC", 5, "SYNTHETIC_LITERAL", "UNBOUND", false),
  "insight.scope_completeness": metric("insight.scope_completeness", "Scope completeness", "OBSERVATORY", "LABEL", "preformatted metricSets[9] synthetic fixture", "scope policy not production-bound", OBSERVATORY_SOURCE, "PUBLIC", 5, "SYNTHETIC_LITERAL", "CONFLICTED", false),
  "insight.payment_structure": metric("insight.payment_structure", "Deposit, payment, and financing structure", "OBSERVATORY", "LABEL", "preformatted metricSets[10] synthetic fixture", "payment semantics not production-bound", OBSERVATORY_SOURCE, "PUBLIC", 5, "SYNTHETIC_LITERAL", "UNBOUND", false),
  "insight.warranty_specificity": metric("insight.warranty_specificity", "Warranty specificity", "OBSERVATORY", "LABEL", "preformatted metricSets[11] synthetic fixture", "warranty policy not production-bound", OBSERVATORY_SOURCE, "PUBLIC", 5, "SYNTHETIC_LITERAL", "CONFLICTED", false),
  "insight.quote_clarity": metric("insight.quote_clarity", "Quote clarity", "OBSERVATORY", "LABEL", "preformatted metricSets[12] synthetic fixture", "clarity policy not production-bound", OBSERVATORY_SOURCE, "PUBLIC", 5, "SYNTHETIC_LITERAL", "UNBOUND", false),
  "insight.multi_bid_spread": metric("insight.multi_bid_spread", "Multi-bid spread", "OBSERVATORY", "LABEL", "preformatted metricSets[13] synthetic fixture", "same-project bid identity not production-bound", OBSERVATORY_SOURCE, "PUBLIC", 5, "SYNTHETIC_LITERAL", "UNBOUND", false),
  "insight.contractor_discipline": metric("insight.contractor_discipline", "Contractor pricing discipline", "OBSERVATORY", "LABEL", "preformatted metricSets[14] synthetic fixture", "contractor-level synthetic observations", OBSERVATORY_SOURCE, "INTERNAL", 5, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", false),
  "insight.market_movement": metric("insight.market_movement", "Market movement over time and geography", "OBSERVATORY", "LABEL", "preformatted metricSets[15] synthetic fixture", "market time series not production-bound", OBSERVATORY_SOURCE, "PUBLIC", 5, "SYNTHETIC_LITERAL", "UNBOUND", false),

  "foundation.observed_estimates": metric("foundation.observed_estimates", "Observed estimates", "FOUNDATION", "COUNT", "dataset.quotes.length", "synthetic quote records", FOUNDATION_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", true),
  "foundation.known_outcome_coverage": metric("foundation.known_outcome_coverage", "Known outcomes", "FOUNDATION", "BASIS_POINTS", "known verified outcomes / projects.length * 10000", "synthetic projects", FOUNDATION_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", true),
  "foundation.verified_sold_count": metric("foundation.verified_sold_count", "Verified sold", "FOUNDATION", "COUNT", "count outcome.state === VERIFIED_SOLD", "synthetic projects", FOUNDATION_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", true),
  "foundation.eligible_count": metric("foundation.eligible_count", "Intelligence eligible", "FOUNDATION", "COUNT", "count quality.eligibility === ELIGIBLE", "synthetic quality records", FOUNDATION_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", true),
  "foundation.quarantined_count": metric("foundation.quarantined_count", "Quarantined", "FOUNDATION", "COUNT", "count quality.eligibility === QUARANTINED", "synthetic quality records", FOUNDATION_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", true),
  "foundation.pending_count": metric("foundation.pending_count", "Pending", "FOUNDATION", "COUNT", "count quality.eligibility === PENDING", "synthetic quality records", FOUNDATION_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", true),
  "foundation.outcome_share": metric("foundation.outcome_share", "Outcome share", "FOUNDATION", "BASIS_POINTS", "count outcome state / projects.length * 10000", "synthetic projects", FOUNDATION_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", true),
  "foundation.initial_quote_median": metric("foundation.initial_quote_median", "Initial quote", "FOUNDATION", "INT_CENTS", "integer median of initial quotedTotalCents", "all synthetic quotes", FOUNDATION_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", true),
  "foundation.accepted_contract_median": metric("foundation.accepted_contract_median", "Accepted contract", "FOUNDATION", "INT_CENTS", "integer median of verified-sold acceptedContractTotalCents", "verified-sold synthetic outcomes", FOUNDATION_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", true),
  "foundation.final_invoice_median": metric("foundation.final_invoice_median", "Final invoice", "FOUNDATION", "INT_CENTS", "integer median of verified-sold finalInvoiceTotalCents", "verified-sold synthetic outcomes", FOUNDATION_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", true),
  "foundation.initial_to_accepted_delta": metric("foundation.initial_to_accepted_delta", "Initial → accepted", "FOUNDATION", "BASIS_POINTS", "accepted median minus initial median divided by initial median", "unpaired synthetic populations", FOUNDATION_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "UNBOUND", false),
  "foundation.accepted_to_final_delta": metric("foundation.accepted_to_final_delta", "Accepted → final", "FOUNDATION", "BASIS_POINTS", "final median minus accepted median divided by accepted median", "verified-sold synthetic outcomes", FOUNDATION_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", true),
  "foundation.extraction_version_coverage": metric("foundation.extraction_version_coverage", "Extraction version coverage", "FOUNDATION", "BASIS_POINTS", "non-null extractionVersion / quality.length * 10000", "synthetic quality records", FOUNDATION_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", true),
  "foundation.normalization_version_coverage": metric("foundation.normalization_version_coverage", "Normalization version coverage", "FOUNDATION", "BASIS_POINTS", "non-null normalizationVersion / quality.length * 10000", "synthetic quality records", FOUNDATION_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", true),
  "foundation.evidence_coverage_average": metric("foundation.evidence_coverage_average", "Average evidence coverage", "FOUNDATION", "BASIS_POINTS", "mean quality.evidenceCoverageBasisPoints", "synthetic quality records", FOUNDATION_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", true),
  "foundation.eligibility_coverage": metric("foundation.eligibility_coverage", "Eligibility coverage", "FOUNDATION", "BASIS_POINTS", "eligible count / quality.length * 10000", "synthetic quality records", FOUNDATION_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", true),
  "foundation.fixture_label": metric("foundation.fixture_label", "Fixture", "FOUNDATION", "LABEL", "dataset.label", "one named synthetic fixture", FOUNDATION_SOURCE, "INTERNAL", 5, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", false),
  "foundation.generated_at": metric("foundation.generated_at", "Generated", "FOUNDATION", "LABEL", "dataset.generatedAt normalized for display", "one named synthetic fixture", FOUNDATION_SOURCE, "INTERNAL", 5, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", false),
  "foundation.money_stage_sample_count": metric("foundation.money_stage_sample_count", "Eligible sample", "FOUNDATION", "COUNT", "count of values contributing to each displayed median", "synthetic money-stage observations", FOUNDATION_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", true),

  "cockpit.confidence_level": metric("cockpit.confidence_level", "Confidence", "COCKPIT", "LABEL", "evaluateOracleConfidence under fixture-only policy", "eligible synthetic observations", COCKPIT_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", true),
  "cockpit.sample_count": metric("cockpit.sample_count", "observations", "COCKPIT", "COUNT", "ppo.sampleCount", "eligible synthetic observations", COCKPIT_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", true),
  "cockpit.exact_match_count": metric("cockpit.exact_match_count", "Exact match", "COCKPIT", "COUNT", "broadenCohort().exactMatchCount", "eligible synthetic observations", COCKPIT_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", true),
  "cockpit.geography_level": metric("cockpit.geography_level", "Geography", "COCKPIT", "LABEL", "zip, county, broadened, or none", "eligible synthetic observations", COCKPIT_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", true),
  "cockpit.ppo_median": metric("cockpit.ppo_median", "Median price per opening", "COCKPIT", "USD_LEGACY", "percentile sorted PPO at 50", "eligible synthetic observations", COCKPIT_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", false, "Legacy fixture dollars; future canonical monetary facts require integer cents."),
  "cockpit.ppo_p25": metric("cockpit.ppo_p25", "P25", "COCKPIT", "USD_LEGACY", "percentile sorted PPO at 25", "eligible synthetic observations", COCKPIT_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", false),
  "cockpit.ppo_p75": metric("cockpit.ppo_p75", "P75", "COCKPIT", "USD_LEGACY", "percentile sorted PPO at 75", "eligible synthetic observations", COCKPIT_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", false),
  "cockpit.ppo_average": metric("cockpit.ppo_average", "Average", "COCKPIT", "USD_LEGACY", "sum PPO / n rounded to two decimals", "eligible synthetic observations", COCKPIT_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", false),
  "cockpit.ppo_min": metric("cockpit.ppo_min", "LOW", "COCKPIT", "USD_LEGACY", "first sorted clean PPO", "eligible synthetic observations", COCKPIT_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", false),
  "cockpit.ppo_max": metric("cockpit.ppo_max", "HIGH", "COCKPIT", "USD_LEGACY", "last sorted clean PPO", "eligible synthetic observations", COCKPIT_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", false),
  "cockpit.homeowner_ppo": metric("cockpit.homeowner_ppo", "Homeowner PPO", "COCKPIT", "USD_LEGACY", "operator request.homeownerPpo", "one synthetic operator input", COCKPIT_SOURCE, "INTERNAL", 5, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", false),
  "cockpit.provenance_counts": metric("cockpit.provenance_counts", "Provenance counts", "COCKPIT", "COUNT", "quoted and verified-sold counts after eligibility and fallback", "eligible synthetic observations", COCKPIT_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", true),
  "cockpit.quoted_vs_sold_delta_pct": metric("cockpit.quoted_vs_sold_delta_pct", "Quoted vs sold delta", "COCKPIT", "PERCENT", "sold median minus quoted median divided by quoted median", "separately labeled synthetic provenance populations", COCKPIT_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", false),
  "cockpit.contractor_quote_count": metric("cockpit.contractor_quote_count", "Quotes", "COCKPIT", "COUNT", "quoted observations grouped by contractorKey", "synthetic contractor observations", COCKPIT_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", false),
  "cockpit.contractor_sold_count": metric("cockpit.contractor_sold_count", "Verified sold", "COCKPIT", "COUNT", "verified-sold observations grouped by contractorKey", "synthetic contractor observations", COCKPIT_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", false),
  "cockpit.contractor_median_quoted_ppo": metric("cockpit.contractor_median_quoted_ppo", "Median quoted PPO", "COCKPIT", "USD_LEGACY", "median quoted PPO grouped by contractorKey", "synthetic contractor observations", COCKPIT_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", false),
  "cockpit.contractor_median_sold_ppo": metric("cockpit.contractor_median_sold_ppo", "Median sold PPO", "COCKPIT", "USD_LEGACY", "median verified-sold PPO grouped by contractorKey", "synthetic contractor observations", COCKPIT_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", false),
  "cockpit.contractor_beat_price_freq": metric("cockpit.contractor_beat_price_freq", "Beat-price freq", "COCKPIT", "RATIO", "true didBeatPrice / non-null didBeatPrice", "synthetic contractor observations", COCKPIT_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", false),
  "cockpit.contractor_tier": metric("cockpit.contractor_tier", "Tier", "COCKPIT", "LABEL", "contractor median relative to market p25 and p75", "synthetic contractor observations", COCKPIT_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", false),
  "cockpit.brand_series_median_ppo": metric("cockpit.brand_series_median_ppo", "Median PPO", "COCKPIT", "USD_LEGACY", "median PPO grouped by brand and series", "synthetic product observations", COCKPIT_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", false),
  "cockpit.call_summary_position": metric("cockpit.call_summary_position", "Position", "COCKPIT", "LABEL", "homeowner PPO relative to p25, median, and p75", "eligible synthetic observations", "src/lib/windowOracle/callSummary.ts", "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", false),
  "cockpit.eligibility_summary": metric("cockpit.eligibility_summary", "Eligibility summary", "COCKPIT", "COUNT", "candidate, eligible, and exclusion counters", "synthetic candidate observations", COCKPIT_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", true),
  "cockpit.date_range": metric("cockpit.date_range", "Observation range", "COCKPIT", "DATE_RANGE", "minimum and maximum observedAt for the selected synthetic cohort", "eligible synthetic observations", COCKPIT_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", true),
  "cockpit.fallbacks": metric("cockpit.fallbacks", "Fallbacks applied", "COCKPIT", "LABEL", "ordered fallback codes from broadenCohort", "selected synthetic cohort", COCKPIT_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", true),
  "cockpit.brand_series_observation_count": metric("cockpit.brand_series_observation_count", "Brand / series observations", "COCKPIT", "COUNT", "count observations grouped by brand and series", "eligible synthetic observations", COCKPIT_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", false),
  "cockpit.recent_observation_id": metric("cockpit.recent_observation_id", "Recent observation ID", "COCKPIT", "LABEL", "synthetic OBS-* fixture identifier", "individual synthetic observations", COCKPIT_SOURCE, "INTERNAL", 5, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", false),
  "cockpit.high_price_outlier_flag": metric("cockpit.high_price_outlier_flag", "High-price outliers present", "COCKPIT", "BOOLEAN", "confidence.highPriceOutliersPresent", "selected synthetic cohort", COCKPIT_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", false),
  "cockpit.tight_distribution_flag": metric("cockpit.tight_distribution_flag", "Tight price distribution", "COCKPIT", "BOOLEAN", "confidence.tightDistribution", "selected synthetic cohort", COCKPIT_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", false),

  "datalab.intake_quotes": metric("datalab.intake_quotes", "Quotes", "DATALAB", "COUNT", "count provenance === QUOTED", "synthetic observations", DATALAB_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", true),
  "datalab.intake_analyses": metric("datalab.intake_analyses", "Analyses", "DATALAB", "COUNT", "observations.length", "synthetic observations", DATALAB_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", true),
  "datalab.intake_trusted": metric("datalab.intake_trusted", "Trusted", "DATALAB", "COUNT", "count approvedForIndex === true", "synthetic observations", DATALAB_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", true),
  "datalab.intake_rejected": metric("datalab.intake_rejected", "Rejected", "DATALAB", "COUNT", "count rejected anomaly, duplicate, or invalid PPO", "synthetic observations", DATALAB_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", true),
  "datalab.intake_manual_review": metric("datalab.intake_manual_review", "Manual review", "DATALAB", "COUNT", "count manualReviewRequired === true", "synthetic observations", DATALAB_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", true),
  "datalab.field_coverage_pct": metric("datalab.field_coverage_pct", "Field coverage", "DATALAB", "PERCENT", "present / total rounded to one decimal", "synthetic observations", DATALAB_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", true),
  "datalab.project_market_distribution": metric("datalab.project_market_distribution", "Project Market (Quoted PPO)", "DATALAB", "USD_LEGACY", "quoted PPO distribution grouped by county and projectType", "synthetic quoted observations", DATALAB_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", false),
  "datalab.contractor_label": metric("datalab.contractor_label", "Synthetic contractor label", "DATALAB", "LABEL", "fixture contractorLabel grouped by contractorKey", "synthetic contractor observations", DATALAB_SOURCE, "INTERNAL", 5, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", false),
  "datalab.contractor_quote_count": metric("datalab.contractor_quote_count", "Quotes", "DATALAB", "COUNT", "quoted observations grouped by contractorKey", "synthetic contractor observations", DATALAB_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", false),
  "datalab.contractor_sold_count": metric("datalab.contractor_sold_count", "Verified sold", "DATALAB", "COUNT", "verified-sold observations grouped by contractorKey", "synthetic contractor observations", DATALAB_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", false),
  "datalab.contractor_median_quoted_ppo": metric("datalab.contractor_median_quoted_ppo", "Median quoted PPO", "DATALAB", "USD_LEGACY", "median quoted PPO grouped by contractorKey", "synthetic contractor observations", DATALAB_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", false),
  "datalab.contractor_median_sold_ppo": metric("datalab.contractor_median_sold_ppo", "Median sold PPO", "DATALAB", "USD_LEGACY", "median verified-sold PPO grouped by contractorKey", "synthetic contractor observations", DATALAB_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", false),
  "datalab.contractor_beat_price_frequency": metric("datalab.contractor_beat_price_frequency", "Beat-price frequency", "DATALAB", "RATIO", "true didBeatPrice / non-null didBeatPrice", "synthetic contractor observations", DATALAB_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", false),
  "datalab.recent_observation_id": metric("datalab.recent_observation_id", "Synthetic observation ID", "DATALAB", "LABEL", "synthetic OBS-* fixture identifier", "individual synthetic observations", DATALAB_SOURCE, "INTERNAL", 5, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", false),
  "datalab.recent_observation_provenance": metric("datalab.recent_observation_provenance", "Provenance", "DATALAB", "LABEL", "observation provenance enum", "individual synthetic observations", DATALAB_SOURCE, "INTERNAL", 5, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", false),
  "datalab.recent_observation_region": metric("datalab.recent_observation_region", "Synthetic region", "DATALAB", "LABEL", "fixture geography labels", "individual synthetic observations", DATALAB_SOURCE, "INTERNAL", 5, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", false),
  "datalab.recent_observation_zip": metric("datalab.recent_observation_zip", "Synthetic ZIP", "DATALAB", "LABEL", "fixture ZIP label", "individual synthetic observations", DATALAB_SOURCE, "INTERNAL", 5, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", false),
  "datalab.recent_observation_brand": metric("datalab.recent_observation_brand", "Brand", "DATALAB", "LABEL", "fixture brand label", "individual synthetic observations", DATALAB_SOURCE, "INTERNAL", 5, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", false),
  "datalab.recent_observation_opening_count": metric("datalab.recent_observation_opening_count", "Opening count", "DATALAB", "COUNT", "fixture openingCount", "individual synthetic observations with unapproved production opening semantics", DATALAB_SOURCE, "INTERNAL", 5, "SYNTHETIC_LITERAL", "SYNTHETIC_DEMO", false),
  "datalab.recent_observation_ppo": metric("datalab.recent_observation_ppo", "PPO", "DATALAB", "USD_LEGACY", "PPO for the twelve most recent synthetic observations", "individual synthetic observations", DATALAB_SOURCE, "INTERNAL", 5, "SYNTHETIC_DERIVED", "SYNTHETIC_DEMO", false),
} as const satisfies Readonly<Record<string, MetricDefinitionShape>>);

export type MetricId = keyof typeof METRIC_DICTIONARY;
export type MetricDefinition = (typeof METRIC_DICTIONARY)[MetricId];

export const METRIC_IDS = Object.freeze(Object.keys(METRIC_DICTIONARY) as MetricId[]);

export function metricIdsForSurface(surface: OracleProductSurface): readonly MetricId[] {
  return Object.freeze(
    METRIC_IDS.filter((id) => METRIC_DICTIONARY[id].ownerSurface === surface),
  );
}
