import type {
  ReportSummaryHighlightKind,
  ReportSummaryV1,
  ReportSummaryV1Status,
} from "./types.ts";
import { REPORT_SUMMARY_VERSION, SUMMARY_PROMPT_VERSION } from "./types.ts";

const SHA256_HEX = /^[a-f0-9]{64}$/i;

const HIGHLIGHT_KINDS = new Set<ReportSummaryHighlightKind>([
  "strength",
  "concern",
  "missing",
  "question",
]);

const STATUSES = new Set<ReportSummaryV1Status>([
  "ready",
  "insufficient_facts",
  "failed",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const items: string[] = [];
  for (const entry of value) {
    const text = readNonEmptyString(entry);
    if (!text) return null;
    items.push(text);
  }
  return items;
}

export type ReportSummaryValidationSuccess = {
  ok: true;
  value: ReportSummaryV1;
};

export type ReportSummaryValidationFailure = {
  ok: false;
  error: string;
};

export type ReportSummaryValidationResult =
  | ReportSummaryValidationSuccess
  | ReportSummaryValidationFailure;

export function validateReportSummaryV1(
  raw: unknown,
): ReportSummaryValidationResult {
  if (!isRecord(raw)) {
    return { ok: false, error: "summary must be an object" };
  }

  if (raw.summary_version !== REPORT_SUMMARY_VERSION) {
    return { ok: false, error: "invalid summary_version" };
  }

  if (raw.prompt_version !== SUMMARY_PROMPT_VERSION) {
    return { ok: false, error: "invalid prompt_version" };
  }

  const status = raw.status;
  if (
    typeof status !== "string" || !STATUSES.has(status as ReportSummaryV1Status)
  ) {
    return { ok: false, error: "invalid status" };
  }

  const summaryBody = typeof raw.summary_body === "string"
    ? raw.summary_body
    : null;
  if (summaryBody === null) {
    return { ok: false, error: "summary_body must be a string" };
  }

  if (status === "ready" && summaryBody.trim().length === 0) {
    return {
      ok: false,
      error: "ready summary requires non-empty summary_body",
    };
  }

  const evidenceKeys = readStringArray(raw.evidence_keys);
  if (!evidenceKeys) {
    return { ok: false, error: "evidence_keys must be a string array" };
  }

  const actionStep = raw.action_step === null
    ? null
    : readNonEmptyString(raw.action_step);

  if (raw.action_step !== null && actionStep === null) {
    return { ok: false, error: "action_step must be null or non-empty string" };
  }

  if (!Array.isArray(raw.highlights)) {
    return { ok: false, error: "highlights must be an array" };
  }

  const highlights: ReportSummaryV1["highlights"] = [];
  for (const entry of raw.highlights) {
    if (!isRecord(entry)) {
      return { ok: false, error: "highlight entries must be objects" };
    }
    const kind = entry.kind;
    if (
      typeof kind !== "string" ||
      !HIGHLIGHT_KINDS.has(kind as ReportSummaryHighlightKind)
    ) {
      return { ok: false, error: "invalid highlight kind" };
    }
    const text = readNonEmptyString(entry.text);
    if (!text) {
      return { ok: false, error: "highlight text required" };
    }
    const keys = readStringArray(entry.evidence_keys);
    if (!keys) {
      return {
        ok: false,
        error: "highlight evidence_keys must be a string array",
      };
    }
    highlights.push({
      kind: kind as ReportSummaryHighlightKind,
      text,
      evidence_keys: keys,
    });
  }

  const inputPackHash = readNonEmptyString(raw.input_pack_hash);
  if (!inputPackHash || !SHA256_HEX.test(inputPackHash)) {
    return { ok: false, error: "input_pack_hash must be a sha256 hex string" };
  }

  return {
    ok: true,
    value: {
      summary_version: REPORT_SUMMARY_VERSION,
      prompt_version: SUMMARY_PROMPT_VERSION,
      summary_body: summaryBody,
      evidence_keys: evidenceKeys,
      action_step: actionStep,
      highlights,
      status: status as ReportSummaryV1Status,
      input_pack_hash: inputPackHash.toLowerCase(),
    },
  };
}

/** Ensures evidence_keys in output are subset of fact-pack keys when provided. */
export function assertEvidenceKeysGrounded(
  summary: ReportSummaryV1,
  allowedKeys: ReadonlySet<string>,
): boolean {
  for (const key of summary.evidence_keys) {
    if (!allowedKeys.has(key)) return false;
  }
  for (const highlight of summary.highlights) {
    for (const key of highlight.evidence_keys) {
      if (!allowedKeys.has(key)) return false;
    }
  }
  return true;
}

export function collectFactPackEvidenceKeys(
  pack: {
    top_findings: Array<{ evidence_key: string }>;
    positive_findings: Array<{ evidence_key: string }>;
    missing_findings: Array<{ evidence_key: string }>;
  },
): Set<string> {
  const keys = new Set<string>();
  for (const item of pack.top_findings) keys.add(item.evidence_key);
  for (const item of pack.positive_findings) keys.add(item.evidence_key);
  for (const item of pack.missing_findings) keys.add(item.evidence_key);
  return keys;
}
