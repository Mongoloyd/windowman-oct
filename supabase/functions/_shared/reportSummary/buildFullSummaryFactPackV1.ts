import {
  DOCUMENTED_STRENGTHS,
  MAX_ACTION_QUESTIONS,
  MAX_MISSING_FINDINGS,
  MAX_POSITIVE_FINDINGS,
  MAX_TOP_CONCERNS,
} from "./constants.ts";
import {
  countFlagSeverities,
  humanizeFlag,
  isConcernSeverity,
  normalizePillarKey,
  resolveActionQuestion,
  slugifyMissingItem,
} from "./helpers.ts";
import type {
  FullReportSummarySource,
  FullSummaryFactPackV1,
} from "./types.ts";
import { FULL_SUMMARY_FACT_PACK_VERSION } from "./types.ts";

/**
 * Deterministically builds FullSummaryFactPackV1 from established report facts.
 *
 * Ordering law:
 * 1. Preserve scanner flag source order (detectFlags array order).
 * 2. Filter to concern severities only for top_findings.
 * 3. Truncate to bounded maximums — no secondary ranking score.
 */
export function buildFullSummaryFactPackV1(
  source: FullReportSummarySource,
): FullSummaryFactPackV1 {
  const safeFlags = Array.isArray(source.flags) ? source.flags : [];
  const safeMissing = Array.isArray(source.missing_items)
    ? source.missing_items
    : [];

  const derivedCounts = countFlagSeverities(safeFlags);
  const red_count = typeof source.flag_red_count === "number"
    ? source.flag_red_count
    : derivedCounts.red;
  const amber_count = typeof source.flag_amber_count === "number"
    ? source.flag_amber_count
    : derivedCounts.amber;
  const clear_count = derivedCounts.clear > 0 ? derivedCounts.clear : null;

  const top_findings = safeFlags
    .filter((flag) => isConcernSeverity(flag.severity))
    .slice(0, MAX_TOP_CONCERNS)
    .map((flag) => ({
      evidence_key: flag.flag,
      severity: flag.severity,
      headline: humanizeFlag(flag.flag),
      detail: flag.detail?.trim() || null,
      pillar: normalizePillarKey(flag.pillar),
    }));

  const positive_findings = DOCUMENTED_STRENGTHS
    .filter((strength) => strength.when(source))
    .slice(0, MAX_POSITIVE_FINDINGS)
    .map(({ evidence_key, headline }) => ({ evidence_key, headline }));

  const missing_findings = safeMissing
    .slice(0, MAX_MISSING_FINDINGS)
    .map((headline, index) => ({
      evidence_key: slugifyMissingItem(headline, index),
      headline,
    }));

  const action_questions: string[] = [];
  const seenQuestions = new Set<string>();
  for (const flag of safeFlags) {
    if (!isConcernSeverity(flag.severity)) continue;
    const question = resolveActionQuestion(flag);
    const key = question.toLowerCase();
    if (seenQuestions.has(key)) continue;
    seenQuestions.add(key);
    action_questions.push(question);
    if (action_questions.length >= MAX_ACTION_QUESTIONS) break;
  }

  if (
    action_questions.length < MAX_ACTION_QUESTIONS &&
    missing_findings.length > 0
  ) {
    const fallback = `Ask whether the quote can include: ${
      missing_findings[0].headline
    }.`;
    if (!seenQuestions.has(fallback.toLowerCase())) {
      action_questions.push(fallback);
    }
  }

  return {
    pack_version: FULL_SUMMARY_FACT_PACK_VERSION,
    analysis_identity: {
      analysis_id: source.analysis_id,
      rubric_version: source.rubric_version,
    },
    verdict: {
      grade: source.grade,
      red_count,
      amber_count,
      clear_count,
    },
    top_findings,
    positive_findings,
    missing_findings,
    action_questions: action_questions.slice(0, MAX_ACTION_QUESTIONS),
    benchmark_context: [],
  };
}

/** Whether the fact pack has enough substance for a summary attempt. */
export function factPackHasMinimumFacts(pack: FullSummaryFactPackV1): boolean {
  return pack.top_findings.length > 0 ||
    pack.missing_findings.length > 0 ||
    pack.positive_findings.length > 0 ||
    (typeof pack.verdict.grade === "string" && pack.verdict.grade.length > 0);
}
