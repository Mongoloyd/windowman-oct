import type { FullReportSummarySource, ReportSummaryFlag } from "./types.ts";

/** Minimal analysis row shape for server-side summary fact-pack construction. */
export type AnalysisRowForSummary = {
  id: string;
  grade: string | null;
  rubric_version: string | null;
  flags: unknown;
  full_json: unknown;
  proof_of_read: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function normalizeFlags(raw: unknown): ReportSummaryFlag[] {
  if (!Array.isArray(raw)) return [];
  const out: ReportSummaryFlag[] = [];
  for (const item of raw) {
    const rec = asRecord(item);
    if (!rec || typeof rec.flag !== "string") continue;
    out.push({
      flag: rec.flag,
      severity: typeof rec.severity === "string" ? rec.severity : "Unknown",
      pillar: typeof rec.pillar === "string" ? rec.pillar : null,
      detail: typeof rec.detail === "string" ? rec.detail : null,
      tip: typeof rec.tip === "string" ? rec.tip : null,
    });
  }
  return out;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Builds FullReportSummarySource from a canonical analyses row.
 * Uses established report fields only — never forwards raw full_json.
 */
export function buildSummarySourceFromAnalysisRow(
  row: AnalysisRowForSummary,
): FullReportSummarySource | null {
  if (!row.id) return null;

  const fullJson = asRecord(row.full_json);
  if (!fullJson) return null;

  const flags = normalizeFlags(row.flags ?? fullJson.flags);
  const proof = asRecord(row.proof_of_read);
  const extraction = asRecord(fullJson.extraction);

  const has_warranty = readBoolean(fullJson.has_warranty) ??
    (extraction?.warranty != null ? Boolean(extraction.warranty) : null);
  const has_permits = readBoolean(fullJson.has_permits) ??
    (extraction?.permits != null ? Boolean(extraction.permits) : null);

  const contractorName = readOptionalString(proof?.contractor_name) ??
    readOptionalString(extraction?.contractor_name);

  return {
    analysis_id: row.id,
    rubric_version: row.rubric_version ??
      readOptionalString(fullJson.rubric_version),
    grade: row.grade ?? readOptionalString(fullJson.grade),
    flags,
    missing_items: asStringArray(fullJson.missing_items),
    warnings: asStringArray(fullJson.warnings),
    summary: readOptionalString(fullJson.summary),
    has_warranty,
    has_permits,
    contractor_name_present: contractorName !== null,
  };
}
