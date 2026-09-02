/**
 * Display-eligible Summary V1 projection for authorized FULL report-access only.
 *
 * Isolated from `_shared/reportSummary` on purpose: report-access must not
 * import shared scanner/summary worker paths. This module extracts one
 * nullable browser field after full authorization already succeeded.
 */

export const REPORT_SUMMARY_VERSION = "report_summary_v1";
export const REPORT_SUMMARY_BODY_FIELD = "report_summary_body";

export const UNAUTHORIZED_FULL_ENVELOPE = {
  ok: true,
  mode: "full",
  authorized: false,
  locked: true,
  reason: "unauthorized",
} as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SummaryLookupRow = {
  analysis_id?: unknown;
  status?: unknown;
  summary_version?: unknown;
  summary_json?: unknown;
  generated_at?: unknown;
};

export type ReportSummaryQueryBuilder = {
  select: (columns: string) => ReportSummaryQueryBuilder;
  eq: (column: string, value: string) => ReportSummaryQueryBuilder;
  order: (
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean },
  ) => ReportSummaryQueryBuilder;
  limit: (count: number) => ReportSummaryQueryBuilder;
  maybeSingle: () => Promise<{
    data: unknown;
    error: { message?: string } | null;
  }>;
};

export type ReportSummaryLookupClient = {
  from: (table: string) => ReportSummaryQueryBuilder;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function fullAuthorizationAllowsSummaryLookup(grade: string): boolean {
  return grade !== "__UNAUTHORIZED__";
}

export function extractDisplayEligibleSummaryBody(
  row: SummaryLookupRow | null | undefined,
): string | null {
  if (!row) return null;
  if (row.status !== "ready") return null;
  if (row.summary_version !== REPORT_SUMMARY_VERSION) return null;
  if (!isRecord(row.summary_json)) return null;
  const body = row.summary_json.summary_body;
  if (typeof body !== "string") return null;
  const trimmed = body.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function attachReportSummaryBody(
  row: Record<string, unknown>,
  summaryBody: string | null,
): Record<string, unknown> {
  return {
    ...row,
    [REPORT_SUMMARY_BODY_FIELD]: summaryBody,
  };
}

export function stripPreviewUnsafeFields(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const {
    full_json: _fullJson,
    report_summary_body: _reportSummaryBody,
    ...safeRow
  } = row;
  return safeRow;
}

export async function loadDisplayEligibleSummaryBody(
  supabase: ReportSummaryLookupClient,
  analysisId: string,
): Promise<string | null> {
  if (!UUID_RE.test(analysisId)) return null;

  try {
    const { data, error } = await supabase
      .from("wm_report_summaries")
      .select("status, summary_version, summary_json")
      .eq("analysis_id", analysisId)
      .eq("status", "ready")
      .eq("summary_version", REPORT_SUMMARY_VERSION)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data || !isRecord(data)) return null;
    return extractDisplayEligibleSummaryBody(data);
  } catch (err) {
    console.error(
      "[report-access] summary lookup failed:",
      err instanceof Error ? err.message : "unknown",
    );
    return null;
  }
}
