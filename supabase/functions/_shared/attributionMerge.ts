/**
 * attributionMerge.ts — Pure attribution sanitization + non-destructive merge.
 *
 * Used by upload bootstrap and truth-gate lead capture Edge Functions.
 * Never throws on malformed input; never treats nd_lead_id as a DB FK.
 */

export type WmIntent = "has_quote" | "no_quote" | "unknown";

const ALLOWED_ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "ndclid",
  "wm_intent",
  "nd_lead_id",
  "nd_form_id",
  "nd_ad_id",
  "nd_ad_group_id",
  "nd_campaign_id",
  "ttclid",
  "fbclid",
  "gclid",
  "wbraid",
  "gbraid",
  "msclkid",
  "fbc",
  "fbp",
  "ttp",
  "client_slug",
  "landing_page",
  "landing_page_url",
  "current_page_url",
  "raw_query_string",
  "referrer",
  "captured_at",
  "first_touch_at",
  "latest_touch_at",
] as const;

const STRING_LIMITS: Record<string, number> = {
  utm_source: 255,
  utm_medium: 255,
  utm_campaign: 255,
  utm_term: 255,
  utm_content: 255,
  ndclid: 500,
  nd_lead_id: 500,
  nd_form_id: 500,
  nd_ad_id: 500,
  nd_ad_group_id: 500,
  nd_campaign_id: 500,
  ttclid: 500,
  fbclid: 500,
  gclid: 500,
  wbraid: 500,
  gbraid: 500,
  msclkid: 500,
  fbc: 500,
  fbp: 500,
  ttp: 500,
  client_slug: 100,
  landing_page: 500,
  landing_page_url: 1000,
  current_page_url: 1000,
  raw_query_string: 2000,
  referrer: 1000,
};

const MAX_QUERY_PARAM_KEYS = 50;
const MAX_QUERY_PARAM_VALUE_LEN = 500;
const MAX_QUERY_PARAM_ARRAY_LEN = 10;

function trimString(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

export function normalizeWmIntent(raw: unknown): WmIntent {
  if (typeof raw !== "string") return "unknown";
  const normalized = raw.trim().toLowerCase().replace(/-/g, "_");
  if (normalized === "has_quote") return "has_quote";
  if (normalized === "no_quote") return "no_quote";
  return "unknown";
}

export function isNonEmptyValue(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === "string" && val.trim() === "") return false;
  if (Array.isArray(val) && val.length === 0) return false;
  if (
    typeof val === "object" &&
    !Array.isArray(val) &&
    Object.keys(val as object).length === 0
  ) {
    return false;
  }
  return true;
}

export function sanitizeAttributionInput(
  input: unknown,
): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const src = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const key of ALLOWED_ATTRIBUTION_KEYS) {
    if (!(key in src)) continue;
    const val = src[key];

    if (key === "wm_intent") {
      out.wm_intent = normalizeWmIntent(val);
      continue;
    }

    if (
      key === "captured_at" ||
      key === "first_touch_at" ||
      key === "latest_touch_at"
    ) {
      if (typeof val === "number" && Number.isFinite(val)) {
        out[key] = Math.trunc(val);
      }
      continue;
    }

    const max = STRING_LIMITS[key] ?? 500;
    const s = trimString(val, max);
    if (s) out[key] = s;
  }

  return out;
}

export function sanitizeQueryParamsInput(
  input: unknown,
): Record<string, string | string[]> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const out: Record<string, string | string[]> = {};
  let count = 0;

  for (const [rawKey, rawVal] of Object.entries(input as Record<string, unknown>)) {
    if (count >= MAX_QUERY_PARAM_KEYS) break;

    const key = trimString(rawKey, 128);
    if (!key) continue;

    if (typeof rawVal === "string") {
      const value = trimString(rawVal, MAX_QUERY_PARAM_VALUE_LEN);
      if (value) {
        out[key] = value;
        count++;
      }
      continue;
    }

    if (Array.isArray(rawVal)) {
      const values = rawVal
        .filter((item): item is string => typeof item === "string")
        .map((item) => trimString(item, MAX_QUERY_PARAM_VALUE_LEN))
        .filter((item): item is string => Boolean(item))
        .slice(0, MAX_QUERY_PARAM_ARRAY_LEN);

      if (values.length === 1) {
        out[key] = values[0];
        count++;
      } else if (values.length > 1) {
        out[key] = values;
        count++;
      }
    }
  }

  return out;
}

export function mergeAttribution(
  existing: unknown,
  incoming: unknown,
): Record<string, unknown> {
  const merged = sanitizeAttributionInput(existing);
  const inc = sanitizeAttributionInput(incoming);

  for (const [key, val] of Object.entries(inc)) {
    if (!isNonEmptyValue(val)) continue;

    if (key === "captured_at") {
      const existingTs =
        typeof merged.captured_at === "number" ? merged.captured_at : null;
      const incomingTs = typeof val === "number" ? val : null;
      if (existingTs !== null && incomingTs !== null) {
        merged.captured_at = Math.min(existingTs, incomingTs);
      } else {
        merged.captured_at = existingTs ?? incomingTs;
      }
      continue;
    }

    const existingVal = merged[key];
    if (!isNonEmptyValue(existingVal)) {
      merged[key] = val;
    }
  }

  return merged;
}

export function mergeQueryParams(
  existing: unknown,
  incoming: unknown,
): Record<string, string | string[]> {
  const base = sanitizeQueryParamsInput(existing);
  if (Object.keys(base).length > 0) return base;
  return sanitizeQueryParamsInput(incoming);
}

export function isPaidAttribution(
  attribution: Record<string, unknown>,
): boolean {
  if (
    attribution.wm_intent === "has_quote" ||
    attribution.wm_intent === "no_quote"
  ) {
    return true;
  }
  if (isNonEmptyValue(attribution.ndclid)) return true;
  if (isNonEmptyValue(attribution.nd_lead_id)) return true;

  const source =
    typeof attribution.utm_source === "string"
      ? attribution.utm_source.toLowerCase()
      : "";
  return (
    source.includes("nextdoor") ||
    source.includes("tiktok") ||
    source.includes("meta") ||
    source.includes("facebook")
  );
}

export function resolveUploadLeadSource(
  attribution: Record<string, unknown>,
): string {
  return isPaidAttribution(attribution) ? "paid_upload" : "direct_upload";
}

export function promoteLeadScalarFields(
  attribution: Record<string, unknown>,
  existingRow: Record<string, unknown> = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  const directScalars = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "fbclid",
    "gclid",
    "fbc",
    "fbp",
    "ttclid",
    "msclkid",
    "wbraid",
    "gbraid",
    "client_slug",
    "landing_page_url",
  ] as const;

  for (const col of directScalars) {
    if (isNonEmptyValue(existingRow[col])) continue;
    const val = attribution[col];
    if (isNonEmptyValue(val)) out[col] = val;
  }

  if (!isNonEmptyValue(existingRow.first_page_path)) {
    const landingPage = attribution.landing_page;
    if (isNonEmptyValue(landingPage)) out.first_page_path = landingPage;
  }

  if (!isNonEmptyValue(existingRow.initial_referrer)) {
    const referrer = attribution.referrer;
    if (isNonEmptyValue(referrer)) out.initial_referrer = referrer;
  }

  // wm_intent stays in attribution JSONB only — public.leads has no `intent` column.

  return out;
}

export function hasAttributionPayload(
  attribution: Record<string, unknown>,
  queryParams: Record<string, string | string[]>,
): boolean {
  return (
    Object.keys(attribution).length > 0 || Object.keys(queryParams).length > 0
  );
}
