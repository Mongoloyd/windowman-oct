/**
 * Route ID guards — format-only validation for UUID-shaped route parameters.
 *
 * These utilities validate shape only. Database existence and authorization
 * remain the responsibility of the server (RLS, edge functions, admin-data
 * RPCs). Never extend this module to query Supabase or call network APIs.
 */

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeRouteId(
  value: string | null | undefined,
): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

// Strict shape check. We deliberately do NOT trim here: downstream consumers
// (e.g. useAnalysisData) match the raw route param against a UUID regex, so
// silently accepting whitespace-wrapped values here would desync the guard
// from its consumers and route malformed URLs into the wrong error path.
// Callers that want to accept surrounding whitespace should explicitly pass
// the value through normalizeRouteId first.
export function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

// Semantic aliases — same shape check today, but named so future changes
// (e.g. prefixed IDs) do not require hunting every call site.
export function isValidScanSessionId(
  value: string | null | undefined,
): value is string {
  return isUuid(value);
}

export function isValidLeadId(
  value: string | null | undefined,
): value is string {
  return isUuid(value);
}
