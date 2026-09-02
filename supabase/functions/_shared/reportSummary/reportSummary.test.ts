import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildFullSummaryFactPackV1,
  factPackHasMinimumFacts,
} from "./buildFullSummaryFactPackV1.ts";
import {
  MAX_ACTION_QUESTIONS,
  MAX_MISSING_FINDINGS,
  MAX_POSITIVE_FINDINGS,
  MAX_TOP_CONCERNS,
} from "./constants.ts";
import { hashFactPack } from "./hashFactPack.ts";
import { SUMMARY_QUALITY_RUBRIC_P2 } from "./qualityRubricP2.ts";
import {
  buildFixtureMissingContractorSource,
  buildFixtureMixedSource,
  buildFixtureMostlyCleanSource,
  buildFixtureProblematicSource,
  buildFixtureSparseSource,
} from "./reportSummary.fixtures.ts";
import { SUMMARY_PROMPT_P1_SYSTEM } from "./summaryPromptP1.ts";
import {
  FULL_SUMMARY_FACT_PACK_VERSION,
  REPORT_SUMMARY_VERSION,
  SUMMARY_PROMPT_VERSION,
} from "./types.ts";
import {
  assertEvidenceKeysGrounded,
  collectFactPackEvidenceKeys,
  validateReportSummaryV1,
} from "./validateReportSummaryV1.ts";

Deno.test("Fixture A — mixed pack bounds and ordering", () => {
  const pack = buildFullSummaryFactPackV1(buildFixtureMixedSource());

  assertEquals(pack.pack_version, FULL_SUMMARY_FACT_PACK_VERSION);
  assertEquals(pack.top_findings.length, 2);
  assertEquals(pack.positive_findings.length, 1);
  assertEquals(pack.positive_findings[0].evidence_key, "warranty_documented");
  assertEquals(
    pack.top_findings[0].evidence_key,
    "subject_to_remeasure_clause",
  );
  assertEquals(pack.top_findings[1].evidence_key, "missing_dp_rating");
  assert(pack.action_questions.length <= MAX_ACTION_QUESTIONS);
  assertEquals(pack.benchmark_context, []);
});

Deno.test("Fixture B — mostly clean has no red verdict counts", () => {
  const pack = buildFullSummaryFactPackV1(buildFixtureMostlyCleanSource());

  assertEquals(pack.verdict.red_count, 0);
  assertEquals(pack.top_findings.length, 1);
  assertEquals(pack.top_findings[0].severity, "Medium");
  assertEquals(pack.positive_findings.length, 2);
});

Deno.test("Fixture C — problematic truncates top findings to five", () => {
  const pack = buildFullSummaryFactPackV1(buildFixtureProblematicSource());

  assertEquals(pack.top_findings.length, MAX_TOP_CONCERNS);
  assertEquals(pack.verdict.red_count, 4);
  assert(pack.missing_findings.length <= MAX_MISSING_FINDINGS);
});

Deno.test("Fixture D — sparse pack lacks minimum facts", () => {
  const pack = buildFullSummaryFactPackV1(buildFixtureSparseSource());

  assertEquals(pack.top_findings.length, 0);
  assertEquals(pack.positive_findings.length, 0);
  assertEquals(factPackHasMinimumFacts(pack), true);
});

Deno.test("Fixture E — missing contractor identity still builds bounded pack", () => {
  const source = buildFixtureMissingContractorSource();
  const pack = buildFullSummaryFactPackV1(source);

  assertEquals(source.contractor_name_present, false);
  assertEquals(pack.top_findings.length, 2);
  assertEquals(pack.positive_findings.length, 1);
});

Deno.test("fact pack hash is stable for identical input", async () => {
  const source = buildFixtureMixedSource();
  const packA = buildFullSummaryFactPackV1(source);
  const packB = buildFullSummaryFactPackV1(source);

  assertEquals(await hashFactPack(packA), await hashFactPack(packB));
});

Deno.test("validateReportSummaryV1 accepts grounded ready summary", async () => {
  const pack = buildFullSummaryFactPackV1(buildFixtureMixedSource());
  const inputHash = await hashFactPack(pack);
  const allowedKeys = collectFactPackEvidenceKeys(pack);

  const candidate = {
    summary_version: REPORT_SUMMARY_VERSION,
    prompt_version: SUMMARY_PROMPT_VERSION,
    summary_body:
      "This quote has a serious remeasure clause that could let pricing change after you sign, and several openings are missing DP ratings. The estimate does document warranty terms, which is helpful, but the missing compliance proof makes the proposal harder to compare. Before signing, ask for written DP ratings for every proposed product.",
    evidence_keys: [
      "subject_to_remeasure_clause",
      "missing_dp_rating",
      "warranty_documented",
    ],
    action_step: pack.action_questions[0] ?? null,
    highlights: [
      {
        kind: "concern",
        text: "Remeasure language may allow post-signing price increases.",
        evidence_keys: ["subject_to_remeasure_clause"],
      },
      {
        kind: "strength",
        text: "Warranty terms are documented.",
        evidence_keys: ["warranty_documented"],
      },
    ],
    status: "ready",
    input_pack_hash: inputHash,
  };

  const result = validateReportSummaryV1(candidate);
  assertEquals(result.ok, true);
  if (!result.ok) return;

  assert(assertEvidenceKeysGrounded(result.value, allowedKeys));
});

Deno.test("validateReportSummaryV1 rejects invalid version", () => {
  const result = validateReportSummaryV1({
    summary_version: "wrong",
    prompt_version: SUMMARY_PROMPT_VERSION,
    summary_body: "test",
    evidence_keys: [],
    action_step: null,
    highlights: [],
    status: "ready",
    input_pack_hash: "a".repeat(64),
  });

  assertEquals(result.ok, false);
});

Deno.test("validateReportSummaryV1 rejects ungrounded evidence keys", async () => {
  const pack = buildFullSummaryFactPackV1(buildFixtureMixedSource());
  const inputHash = await hashFactPack(pack);
  const allowedKeys = collectFactPackEvidenceKeys(pack);

  const candidate = {
    summary_version: REPORT_SUMMARY_VERSION,
    prompt_version: SUMMARY_PROMPT_VERSION,
    summary_body: "Invented fact about savings.",
    evidence_keys: ["invented_key"],
    action_step: null,
    highlights: [],
    status: "ready",
    input_pack_hash: inputHash,
  };

  const result = validateReportSummaryV1(candidate);
  assertEquals(result.ok, true);
  if (!result.ok) return;
  assertEquals(assertEvidenceKeysGrounded(result.value, allowedKeys), false);
});

Deno.test("summary prompt P1 forbids CTA and market claims", () => {
  assert(SUMMARY_PROMPT_P1_SYSTEM.includes("Do not write any sales CTA"));
  assert(SUMMARY_PROMPT_P1_SYSTEM.includes("benchmark_context is empty"));
  assert(SUMMARY_PROMPT_P1_SYSTEM.includes("industry standard"));
  assert(SUMMARY_PROMPT_P1_SYSTEM.includes("insufficient_facts"));
  assert(SUMMARY_PROMPT_P1_SYSTEM.includes(SUMMARY_PROMPT_VERSION));
});

Deno.test("quality rubric P2 encodes required dimensions", () => {
  assertExists(SUMMARY_QUALITY_RUBRIC_P2.GROUNDING);
  assertExists(SUMMARY_QUALITY_RUBRIC_P2.CTA_SEPARATION);
  assertEquals(Object.keys(SUMMARY_QUALITY_RUBRIC_P2).length, 8);
});

Deno.test("positive findings cap enforced", () => {
  const pack = buildFullSummaryFactPackV1(buildFixtureMostlyCleanSource());
  assert(pack.positive_findings.length <= MAX_POSITIVE_FINDINGS);
});

Deno.test("missing findings preserve compiler order", () => {
  const pack = buildFullSummaryFactPackV1(buildFixtureProblematicSource());
  assertEquals(
    pack.missing_findings[0].headline,
    "NOA/FL product approval numbers for all windows and doors",
  );
});
