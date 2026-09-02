import { normalizeGeminiJsonText } from "../geminiJson.ts";
import type { FullSummaryFactPackV1, ReportSummaryV1 } from "./types.ts";
import { REPORT_SUMMARY_VERSION, SUMMARY_PROMPT_VERSION } from "./types.ts";
import {
  assertEvidenceKeysGrounded,
  collectFactPackEvidenceKeys,
  validateReportSummaryV1,
} from "./validateReportSummaryV1.ts";

export type ReportSummaryParseFailureClass =
  | "invalid_json"
  | "invalid_summary_contract"
  | "input_pack_hash_mismatch"
  | "evidence_grounding_failure";

export type ReportSummaryParseSuccess = {
  ok: true;
  summary: ReportSummaryV1;
};

export type ReportSummaryParseFailure = {
  ok: false;
  failureClass: ReportSummaryParseFailureClass;
  retryable: boolean;
};

export type ReportSummaryParseResult =
  | ReportSummaryParseSuccess
  | ReportSummaryParseFailure;

/**
 * Untrusted Gemini text → normalized JSON → contract validation → grounding checks.
 */
export function parseAndValidateProviderSummary(
  rawText: string,
  factPack: FullSummaryFactPackV1,
  expectedInputPackHash: string,
): ReportSummaryParseResult {
  const { normalizedText } = normalizeGeminiJsonText(rawText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(normalizedText);
  } catch {
    return {
      ok: false,
      failureClass: "invalid_json",
      retryable: false,
    };
  }

  const validated = validateReportSummaryV1(parsed);
  if (!validated.ok) {
    return {
      ok: false,
      failureClass: "invalid_summary_contract",
      retryable: false,
    };
  }

  const summary = validated.value;

  if (summary.summary_version !== REPORT_SUMMARY_VERSION) {
    return {
      ok: false,
      failureClass: "invalid_summary_contract",
      retryable: false,
    };
  }

  if (summary.prompt_version !== SUMMARY_PROMPT_VERSION) {
    return {
      ok: false,
      failureClass: "invalid_summary_contract",
      retryable: false,
    };
  }

  if (
    summary.input_pack_hash.toLowerCase() !==
      expectedInputPackHash.toLowerCase()
  ) {
    return {
      ok: false,
      failureClass: "input_pack_hash_mismatch",
      retryable: false,
    };
  }

  const allowedKeys = collectFactPackEvidenceKeys(factPack);
  if (!assertEvidenceKeysGrounded(summary, allowedKeys)) {
    return {
      ok: false,
      failureClass: "evidence_grounding_failure",
      retryable: false,
    };
  }

  return { ok: true, summary };
}
