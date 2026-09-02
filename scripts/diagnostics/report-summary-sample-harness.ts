/**
 * Local-only Report Summary V1 sample harness.
 *
 * Builds a fixture fact pack, optionally invokes the summary provider, and prints
 * validated ReportSummaryV1 JSON. Never touches DB, Storage, or report-access.
 *
 * Usage (dry-run — no Gemini call):
 *   deno run --allow-read --allow-env=REPORT_SUMMARY_GEMINI_MODEL,REPORT_SUMMARY_GEMINI_TIMEOUT_MS \
 *     scripts/diagnostics/report-summary-sample-harness.ts --fixture A --dry-run
 *
 * Usage (operator-triggered live sample — requires GEMINI_API_KEY):
 *   deno run --allow-read --allow-net=generativelanguage.googleapis.com \
 *     --allow-env=GEMINI_API_KEY,REPORT_SUMMARY_GEMINI_MODEL,REPORT_SUMMARY_GEMINI_TIMEOUT_MS,REPORT_SUMMARY_GEMINI_MAX_OUTPUT_TOKENS \
 *     scripts/diagnostics/report-summary-sample-harness.ts --fixture A
 *
 * Fixtures: A | B | C | D | E
 */

import { buildFullSummaryFactPackV1 } from "../../supabase/functions/_shared/reportSummary/buildFullSummaryFactPackV1.ts";
import { hashFactPack } from "../../supabase/functions/_shared/reportSummary/hashFactPack.ts";
import {
  buildFixtureMissingContractorSource,
  buildFixtureMixedSource,
  buildFixtureMostlyCleanSource,
  buildFixtureProblematicSource,
  buildFixtureSparseSource,
} from "../../supabase/functions/_shared/reportSummary/reportSummary.fixtures.ts";
import { callReportSummaryProvider } from "../../supabase/functions/_shared/reportSummary/reportSummaryProvider.ts";
import {
  DEFAULT_REPORT_SUMMARY_MODEL_ID,
  resolveReportSummaryModelId,
  resolveReportSummaryTimeoutMs,
} from "../../supabase/functions/_shared/reportSummary/summaryProviderConfig.ts";
import type { FullReportSummarySource } from "../../supabase/functions/_shared/reportSummary/types.ts";

const FIXTURES: Record<string, () => FullReportSummarySource> = {
  A: buildFixtureMixedSource,
  B: buildFixtureMostlyCleanSource,
  C: buildFixtureProblematicSource,
  D: buildFixtureSparseSource,
  E: buildFixtureMissingContractorSource,
};

function readArg(name: string): string | undefined {
  const idx = Deno.args.indexOf(name);
  if (idx < 0 || idx + 1 >= Deno.args.length) return undefined;
  return Deno.args[idx + 1];
}

function hasFlag(name: string): boolean {
  return Deno.args.includes(name);
}

const fixtureKey = (readArg("--fixture") ?? "A").toUpperCase();
const dryRun = hasFlag("--dry-run");

if (!(fixtureKey in FIXTURES)) {
  console.error(
    `Unknown fixture "${fixtureKey}". Use one of: ${
      Object.keys(FIXTURES).join(", ")
    }`,
  );
  Deno.exit(1);
}

const source = FIXTURES[fixtureKey]();
const factPack = buildFullSummaryFactPackV1(source);
const inputPackHash = await hashFactPack(factPack);

console.log(
  JSON.stringify(
    {
      harness: "report-summary-sample-harness",
      fixture: fixtureKey,
      dry_run: dryRun,
      model_default: DEFAULT_REPORT_SUMMARY_MODEL_ID,
      model_resolved: resolveReportSummaryModelId(),
      timeout_ms: resolveReportSummaryTimeoutMs(),
      input_pack_hash: inputPackHash,
      fact_pack: factPack,
    },
    null,
    2,
  ),
);

if (dryRun) {
  console.error(
    "Dry-run complete. Re-run without --dry-run and with GEMINI_API_KEY to invoke the provider.",
  );
  Deno.exit(0);
}

if (!Deno.env.get("GEMINI_API_KEY")) {
  console.error(
    "GEMINI_API_KEY is not set. Export it locally before running a live sample.",
  );
  Deno.exit(2);
}

const result = await callReportSummaryProvider(factPack);

if (!result.ok) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        failure_class: result.failureClass,
        retryable: result.retryable,
      },
      null,
      2,
    ),
  );
  Deno.exit(3);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      model_id: result.modelId,
      input_pack_hash: result.inputPackHash,
      summary: result.summary,
    },
    null,
    2,
  ),
);
