/**
 * Shared constants for the `/scan` real upload bridge — mirrors UploadZone limits
 * without importing homepage UI or tracking helpers.
 */

export const REAL_SCAN_QUOTES_BUCKET = "quotes" as const;

/** Matches UploadZone `MAX_FILE_SIZE` (10 MiB). */
export const MAX_REAL_SCAN_FILE_BYTES = 10 * 1024 * 1024;

export const SCAN_QUOTE_TERMINAL_STATUSES = new Set([
  "invalid_document",
  "needs_better_upload",
  "failed",
  "error",
  "unreadable",
]);

export const SCAN_QUOTE_TERMINAL_USER_MESSAGES: Record<string, string> = {
  invalid_document:
    "This does not appear to be a valid window estimate or quote.",
  needs_better_upload:
    "We could not read enough quote details from this file. Please upload a clearer window estimate, proposal, PDF, screenshot, or photo.",
  failed: "Scan encountered an issue. Tap retry to try again.",
  error: "Scan encountered an issue. Tap retry to try again.",
  unreadable:
    "We could not read enough quote details from this file. Please upload a clearer window estimate, proposal, PDF, screenshot, or photo.",
};

export type ScanQuoteResponseKind = "valid" | "terminal" | "incomplete";

export function resolveScanQuoteTerminalStatus(fnData: unknown): string | null {
  if (!fnData || typeof fnData !== "object") return null;
  const obj = fnData as Record<string, unknown>;
  const analysisStatus =
    typeof obj.analysis_status === "string" ? obj.analysis_status : null;
  const sessionStatus =
    typeof obj.scan_session_status === "string" ? obj.scan_session_status : null;
  if (analysisStatus && SCAN_QUOTE_TERMINAL_STATUSES.has(analysisStatus)) {
    return analysisStatus;
  }
  if (sessionStatus && SCAN_QUOTE_TERMINAL_STATUSES.has(sessionStatus)) {
    return sessionStatus;
  }
  return null;
}

export function classifyScanQuoteResponse(fnData: unknown): ScanQuoteResponseKind {
  const terminalStatus = resolveScanQuoteTerminalStatus(fnData);
  if (terminalStatus) return "terminal";

  if (!fnData || typeof fnData !== "object") return "valid";

  const obj = fnData as Record<string, unknown>;
  const analysisStatus =
    typeof obj.analysis_status === "string" ? obj.analysis_status : null;
  const sessionStatus =
    typeof obj.scan_session_status === "string" ? obj.scan_session_status : null;

  if (
    analysisStatus === "complete" ||
    sessionStatus === "preview_ready" ||
    sessionStatus === "complete"
  ) {
    return "valid";
  }

  if (analysisStatus || sessionStatus) return "incomplete";
  return "valid";
}

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidScanUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_V4_RE.test(value);
}

export function makeTransportEventId(): string {
  const id = crypto.randomUUID();
  if (typeof id !== "string" || id.length === 0 || id.length > 128) {
    return crypto.randomUUID();
  }
  return id;
}

export const SCAN_PROGRESS_LABELS: Record<string, string> = {
  uploading: "Securing your estimate",
  bootstrapping: "Preparing your WindowMan scan",
  processing: "Reviewing price, scope, glass, warranty, and fine print",
  preview_loading: "Building your Quote Preview",
};

export const CONTACT_REQUIRED_USER_MESSAGE =
  "WindowMan needs your contact connected before this estimate can upload. That step is planned for the next sprint.";

export const BOOTSTRAP_GENERIC_FAILURE =
  "We could not start your scan session. Please try again or choose another file.";

export const UPLOAD_GENERIC_FAILURE = "Upload failed. Please try again.";

export const PREVIEW_GENERIC_FAILURE =
  "Your scan finished, but the safe Quote Preview is not available yet. Please try again.";
