/**
 * _shared/scannerLogger.ts
 *
 * Tiny structured-logging helper shared by the scan-quote pipeline. Emits a
 * single-line JSON record per stage so operators can grep failures by stage
 * without parsing free-form `console.error` strings.
 *
 * Kept deliberately small: this is not a logging framework. It exists so the
 * scanner's failure surface is observable at a glance from edge function logs.
 *
 * ⚠️  Pure helpers only. Never log document contents, base64 payloads, or
 * Gemini raw responses. Truncate any error string to 500 chars.
 */

export type ScanStage =
  | "request_validation"
  | "session_load"
  | "rate_limit"
  | "status_processing"
  | "quote_file_load"
  | "storage_download"
  | "gemini_request"
  | "gemini_parse"
  | "classification"
  | "extraction_validation"
  | "scoring"
  | "report_compile"
  | "analysis_persist"
  | "session_finalize"
  | "lead_snapshot"
  | "canonical_event"
  | "recovery_takeover";

export type ScanLogLevel = "info" | "warn" | "error";

export interface ScanLogFields {
  scan_session_id?: string | null;
  lead_id?: string | null;
  detail?: string;
  // Free-form numeric/string metadata. Avoid putting raw document text here.
  [key: string]: unknown;
}

function truncate(value: unknown, max = 500): unknown {
  if (typeof value !== "string") return value;
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

function emit(
  level: ScanLogLevel,
  stage: ScanStage,
  fields: ScanLogFields,
): void {
  // Single-line JSON keeps log scrapers simple and prevents accidental dumps.
  const safeFields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    safeFields[k] = truncate(v);
  }
  const line = JSON.stringify({
    tag: "WM_SCAN",
    level,
    stage,
    ts: new Date().toISOString(),
    ...safeFields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function logScanInfo(
  stage: ScanStage,
  fields: ScanLogFields = {},
): void {
  emit("info", stage, fields);
}

export function logScanWarn(
  stage: ScanStage,
  fields: ScanLogFields = {},
): void {
  emit("warn", stage, fields);
}

export function logScanError(
  stage: ScanStage,
  fields: ScanLogFields = {},
): void {
  emit("error", stage, fields);
}
