/**
 * Summary provider runtime configuration — independent from scanner/QI models.
 */
export const DEFAULT_REPORT_SUMMARY_MODEL_ID = "gemini-3.1-flash-lite";
export const DEFAULT_REPORT_SUMMARY_TIMEOUT_MS = 15_000;
export const DEFAULT_REPORT_SUMMARY_MAX_OUTPUT_TOKENS = 2048;
export const DEFAULT_REPORT_SUMMARY_TEMPERATURE = 0.3;

function readPositiveInt(name: string, fallback: number): number {
  const raw = Deno.env.get(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function readNonEmptyString(name: string, fallback: string): string {
  const raw = Deno.env.get(name);
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

export function resolveReportSummaryModelId(): string {
  return readNonEmptyString(
    "REPORT_SUMMARY_GEMINI_MODEL",
    DEFAULT_REPORT_SUMMARY_MODEL_ID,
  );
}

export function resolveReportSummaryTimeoutMs(): number {
  return readPositiveInt(
    "REPORT_SUMMARY_GEMINI_TIMEOUT_MS",
    DEFAULT_REPORT_SUMMARY_TIMEOUT_MS,
  );
}

export function resolveReportSummaryMaxOutputTokens(): number {
  return readPositiveInt(
    "REPORT_SUMMARY_GEMINI_MAX_OUTPUT_TOKENS",
    DEFAULT_REPORT_SUMMARY_MAX_OUTPUT_TOKENS,
  );
}
