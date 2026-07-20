import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  BROKER_OPPORTUNITY_RULESET_VERSION,
  evaluateBrokerOpportunity,
  normalizeBrokerOpportunityInput,
} from "./brokerOpportunityQualification.ts";
import {
  buildFixtureConflictingEvidenceInput,
  buildFixtureEligibleInput,
  buildFixtureInsufficientScopeInput,
  buildFixtureNotCommerciallyInterestingInput,
  buildFixtureTrustSignalInput,
  buildFixtureUncertainQuoteMathInput,
  buildFixtureWithoutQuoteFactsInput,
  FIXTURE_TEST_POLICY_ELIGIBLE,
  FIXTURE_TEST_POLICY_NO_COMMERCIAL,
} from "./brokerOpportunityQualification.fixtures.ts";

Deno.test("Fixture 1 — clean commercially interesting quote → ELIGIBLE_TO_PRESENT", () => {
  const input = buildFixtureEligibleInput();
  const result = evaluateBrokerOpportunity(input, FIXTURE_TEST_POLICY_ELIGIBLE);

  assertEquals(result.result, "ELIGIBLE_TO_PRESENT");
  assertEquals(result.reasonCodes, ["COMMERCIAL_POLICY_SATISFIED"]);
  assertEquals(result.rulesetVersion, BROKER_OPPORTUNITY_RULESET_VERSION);
  assertEquals(result.evidence.contract_total, 51800);
  assertEquals(result.evidence.total_openings, 14);
  assertEquals(result.evidence.support_present, false);
});

Deno.test("Fixture 2 — structurally valid but not commercially interesting → NO_MEANINGFUL_OPPORTUNITY", () => {
  const input = buildFixtureNotCommerciallyInterestingInput();
  const result = evaluateBrokerOpportunity(input, FIXTURE_TEST_POLICY_ELIGIBLE);

  assertEquals(result.result, "NO_MEANINGFUL_OPPORTUNITY");
  assertEquals(result.reasonCodes, ["COMMERCIAL_POLICY_NOT_SATISFIED"]);
});

Deno.test("Fixture 3 — incomplete/missing critical scope → INSUFFICIENT_INFORMATION", () => {
  const input = buildFixtureInsufficientScopeInput();
  const result = evaluateBrokerOpportunity(input, FIXTURE_TEST_POLICY_ELIGIBLE);

  assertEquals(result.result, "INSUFFICIENT_INFORMATION");
  assert(result.reasonCodes.includes("MISSING_QUOTE_TOTAL"));
  assert(result.reasonCodes.includes("MISSING_OPENING_COUNT"));
  assert(result.reasonCodes.includes("INSUFFICIENT_SCOPE"));
});

Deno.test("Fixture 4 — conflicting/uncertain evidence → MANUAL_REVIEW", () => {
  const input = buildFixtureConflictingEvidenceInput();
  const result = evaluateBrokerOpportunity(input, FIXTURE_TEST_POLICY_ELIGIBLE);

  assertEquals(result.result, "MANUAL_REVIEW");
  assert(result.reasonCodes.includes("OPENING_COUNT_MISMATCH"));
});

Deno.test("Fixture 5 — wm_quote_facts absent still evaluates deterministically", () => {
  const input = buildFixtureWithoutQuoteFactsInput();
  const result = evaluateBrokerOpportunity(input, FIXTURE_TEST_POLICY_ELIGIBLE);

  assertEquals(result.result, "ELIGIBLE_TO_PRESENT");
  assertEquals(result.evidence.support_present, false);
  assertEquals(result.evidence.manual_review_required, null);
});

Deno.test("Fixture 6 — optional trust/anomaly signal routes to MANUAL_REVIEW", () => {
  const input = buildFixtureTrustSignalInput({
    manualReviewRequired: true,
    duplicateSuspected: false,
    trustScore: 0.72,
    anomalyStatus: "review",
    isQuoteDocument: true,
  });
  const result = evaluateBrokerOpportunity(input, FIXTURE_TEST_POLICY_ELIGIBLE);

  assertEquals(result.result, "MANUAL_REVIEW");
  assert(result.reasonCodes.includes("OPTIONAL_TRUST_SIGNAL_REQUIRES_REVIEW"));
  assertEquals(result.evidence.support_present, true);
});

Deno.test("Fixture 7 — uncertain quote math → MANUAL_REVIEW (QUOTE_MATH_UNCERTAIN)", () => {
  const input = buildFixtureUncertainQuoteMathInput();
  const result = evaluateBrokerOpportunity(input, FIXTURE_TEST_POLICY_ELIGIBLE);

  assertEquals(result.result, "MANUAL_REVIEW");
  assert(result.reasonCodes.includes("QUOTE_MATH_UNCERTAIN"));
});

Deno.test("normalizeBrokerOpportunityInput maps full_json + lead context", () => {
  const input = normalizeBrokerOpportunityInput({
    analysisStatus: "complete",
    confidenceScore: 0.9,
    fullJson: {
      extraction: {
        opening_count: 7,
        total_quoted_price: 16381.4,
        line_items: [{ description: "Impact window" }],
        installation: { scope_detail: "Full replacement scope." },
      },
      derived_metrics: {
        totals: { contract_total: 16381.4 },
        counts: {
          total_openings: 7,
          window_openings: 6,
          door_openings: 1,
        },
        per_opening: { contract_price_per_opening: 2340.2 },
        diagnostics: { quote_math_confidence: 88, warnings: [] },
        county_benchmark: {
          status: "within_county_range",
          comparison_available: true,
          delta_pct: 3,
        },
      },
    },
    lead: {
      county: "Miami-Dade",
      project_type: "partial",
      client_slug: "partner-a",
    },
  });

  assertEquals(input.scope.totalOpenings, 7);
  assertEquals(input.financial.contractTotal, 16381.4);
  assertEquals(input.context.county, "Miami-Dade");
  assertEquals(input.context.clientSlug, "partner-a");
});

Deno.test("missing commercial policy → MANUAL_REVIEW with COMMERCIAL_POLICY_NOT_CONFIGURED", () => {
  const input = buildFixtureEligibleInput();
  const result = evaluateBrokerOpportunity(input, FIXTURE_TEST_POLICY_NO_COMMERCIAL);

  assertEquals(result.result, "MANUAL_REVIEW");
  assertEquals(result.reasonCodes, ["COMMERCIAL_POLICY_NOT_CONFIGURED"]);
});

Deno.test("analysis not complete → INSUFFICIENT_INFORMATION", () => {
  const input = buildFixtureEligibleInput();
  const result = evaluateBrokerOpportunity(
    {
      ...input,
      analysis: { ...input.analysis, analysisStatus: "processing" },
    },
    FIXTURE_TEST_POLICY_ELIGIBLE,
  );

  assertEquals(result.result, "INSUFFICIENT_INFORMATION");
  assert(result.reasonCodes.includes("ANALYSIS_NOT_COMPLETE"));
});

Deno.test("duplicate suspected support signal → MANUAL_REVIEW", () => {
  const input = buildFixtureTrustSignalInput({
    manualReviewRequired: false,
    duplicateSuspected: true,
    trustScore: 0.8,
    anomalyStatus: "safe",
    isQuoteDocument: true,
  });
  const result = evaluateBrokerOpportunity(input, FIXTURE_TEST_POLICY_ELIGIBLE);

  assertEquals(result.result, "MANUAL_REVIEW");
  assert(result.reasonCodes.includes("DUPLICATE_SUSPECTED"));
});
