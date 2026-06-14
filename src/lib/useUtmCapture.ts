/**
 * useUtmCapture.ts — Dynamic, platform-agnostic attribution capture
 *
 * Captures on page load from URL:
 * - Standard UTMs
 * - Platform click IDs: ttclid, fbclid, gclid, wbraid, gbraid, msclkid
 * - Nextdoor / paid intent: ndclid, wm_intent, nd_lead_id, nd_form_id,
 *   nd_ad_id, nd_ad_group_id, nd_campaign_id
 * - Multi-tenant routing slug: client_slug/client/partner/syndicate
 * - Full raw query string and normalized query param JSON
 *
 * Captures from cookies passively seeded by pixels / GTM:
 * - _fbp, _fbc for Meta CAPI match quality
 * - _ttp for TikTok Events API match quality when available
 *
 * Persists to localStorage so attribution survives SPA navigation, refreshes,
 * upload/scan flow transitions, and OTP verification.
 *
 * Frontend code should call getAttributionPayload() at submit time instead of
 * relying on hook state captured during render. That prevents stale state
 * closures from losing late-arriving cookies or URL updates.
 */

import { useEffect, useState } from "react";

const UTM_STORAGE_KEY = "wm_utm_data";
const UTM_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

const CLICK_ID_KEYS = [
  "ttclid",
  "fbclid",
  "gclid",
  "wbraid",
  "gbraid",
  "msclkid",
] as const;

const CLIENT_SLUG_KEYS = [
  "client_slug",
  "client",
  "partner",
  "syndicate",
] as const;

const NEXTDOOR_KEYS = [
  "ndclid",
  "nd_lead_id",
  "nd_form_id",
  "nd_ad_id",
  "nd_ad_group_id",
  "nd_campaign_id",
] as const;

const INTENT_KEYS = ["wm_intent"] as const;

export type WmIntent = "has_quote" | "no_quote" | "unknown";

export function normalizeWmIntent(raw: string | null | undefined): WmIntent {
  if (!raw?.trim()) return "unknown";

  const normalized = raw.trim().toLowerCase().replace(/-/g, "_");

  if (normalized === "has_quote") return "has_quote";
  if (normalized === "no_quote") return "no_quote";

  return "unknown";
}

type QueryParams = Record<string, string | string[]>;

export interface UtmData {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;

  ttclid: string | null;
  fbclid: string | null;
  gclid: string | null;
  wbraid: string | null;
  gbraid: string | null;
  msclkid: string | null;

  ndclid: string | null;
  wm_intent: WmIntent;
  nd_lead_id: string | null;
  nd_form_id: string | null;
  nd_ad_id: string | null;
  nd_ad_group_id: string | null;
  nd_campaign_id: string | null;

  fbc: string | null;
  fbp: string | null;
  ttp: string | null;

  client_slug: string;
  landing_page: string | null;
  landing_page_url: string | null;
  raw_query_string: string | null;
  query_params: QueryParams;
  referrer: string | null;
  captured_at: number;
}

const EMPTY_UTM: UtmData = {
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_term: null,
  utm_content: null,

  ttclid: null,
  fbclid: null,
  gclid: null,
  wbraid: null,
  gbraid: null,
  msclkid: null,

  ndclid: null,
  wm_intent: "unknown",
  nd_lead_id: null,
  nd_form_id: null,
  nd_ad_id: null,
  nd_ad_group_id: null,
  nd_campaign_id: null,

  fbc: null,
  fbp: null,
  ttp: null,

  client_slug: "direct",
  landing_page: null,
  landing_page_url: null,
  raw_query_string: null,
  query_params: {},
  referrer: null,
  captured_at: 0,
};

/**
 * Read a cookie value by name. Returns null if absent or in a non-browser
 * context. Decodes URL-encoded values where possible.
 */
function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const target = `${name}=`;
  const parts = document.cookie ? document.cookie.split("; ") : [];

  for (const part of parts) {
    if (part.startsWith(target)) {
      const raw = part.slice(target.length);
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }

  return null;
}

function firstNonEmptyParam(
  params: URLSearchParams,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = params.get(key)?.trim();
    if (value) return value;
  }

  return null;
}

function hasAttributionParams(params: URLSearchParams): boolean {
  return [
    ...UTM_KEYS,
    ...CLICK_ID_KEYS,
    ...CLIENT_SLUG_KEYS,
    ...NEXTDOOR_KEYS,
    ...INTENT_KEYS,
  ].some((key) => params.has(key));
}

function trimmedParam(
  params: URLSearchParams,
  key: string,
): string | null {
  const value = params.get(key)?.trim();
  return value || null;
}

/**
 * Normalizes the full URL query string into JSON-safe key/value pairs.
 * Repeated params are preserved as arrays instead of silently overwriting.
 */
export function normalizeQueryParams(params: URLSearchParams): QueryParams {
  const normalized: QueryParams = {};

  for (const [key, value] of params.entries()) {
    const existing = normalized[key];

    if (existing === undefined) {
      normalized[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      normalized[key] = [existing, value];
    }
  }

  return normalized;
}

function persistUtmData(data: UtmData): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Attribution must never block the funnel.
  }
}

function withFreshCookies(data: Partial<UtmData>): UtmData {
  return {
    ...EMPTY_UTM,
    ...data,
    client_slug: data.client_slug || "direct",
    wm_intent: data.wm_intent ?? "unknown",
    fbp: readCookie("_fbp") || data.fbp || null,
    fbc: readCookie("_fbc") || data.fbc || null,
    ttp: readCookie("_ttp") || data.ttp || null,
  };
}

export function getUtmData(): UtmData {
  if (typeof window === "undefined") return EMPTY_UTM;

  try {
    const stored = localStorage.getItem(UTM_STORAGE_KEY);

    if (stored) {
      const parsed = JSON.parse(stored) as Partial<UtmData>;

      if (
        typeof parsed.captured_at === "number" &&
        Date.now() - parsed.captured_at < UTM_EXPIRY_MS
      ) {
        return withFreshCookies(parsed);
      }
    }
  } catch {
    // Ignore corrupted or unavailable localStorage.
  }

  return withFreshCookies({});
}

export function captureUtmFromUrl(): UtmData {
  if (typeof window === "undefined") return EMPTY_UTM;

  const params = new URLSearchParams(window.location.search);
  const existing = getUtmData();
  const urlClientSlug = firstNonEmptyParam(params, CLIENT_SLUG_KEYS);
  const currentHasAttribution = hasAttributionParams(params);

  const fbclid = params.get("fbclid")?.trim() || null;
  let synthesizedFbc: string | null = null;

  if (fbclid) {
    synthesizedFbc = `fb.1.${Date.now()}.${fbclid}`;
    const expires = new Date(Date.now() + 90 * 864e5).toUTCString();
    document.cookie = `_fbc=${encodeURIComponent(
      synthesizedFbc,
    )};expires=${expires};path=/;SameSite=Lax`;
  }

  // Path + search only — exclude `window.location.hash` so anchor noise
  // ("#section") never lands in attribution rollups. `window.location.href`
  // is also never falsy in a browser, so the previous
  // `fullUrl || fullPathWithQuery` fallback was dead code.
  const fullPathWithQuery = `${window.location.pathname}${window.location.search}`;
  const rawQueryString = window.location.search || null;
  const queryParams = normalizeQueryParams(params);

  // If this page has no new attribution and we already have a valid record,
  // refresh volatile cookie values only. This preserves first-touch data while
  // still capturing late-seeded browser IDs.
  if (!currentHasAttribution && existing.captured_at > 0) {
    const refreshed = withFreshCookies({
      ...existing,
      client_slug: existing.client_slug || "direct",
    });

    persistUtmData(refreshed);
    return refreshed;
  }

  const rawIntent = trimmedParam(params, "wm_intent");

  const next: UtmData = withFreshCookies({
    utm_source: params.get("utm_source") || existing.utm_source,
    utm_medium: params.get("utm_medium") || existing.utm_medium,
    utm_campaign: params.get("utm_campaign") || existing.utm_campaign,
    utm_term: params.get("utm_term") || existing.utm_term,
    utm_content: params.get("utm_content") || existing.utm_content,

    ttclid: params.get("ttclid") || existing.ttclid,
    fbclid: fbclid || existing.fbclid,
    gclid: params.get("gclid") || existing.gclid,
    wbraid: params.get("wbraid") || existing.wbraid,
    gbraid: params.get("gbraid") || existing.gbraid,
    msclkid: params.get("msclkid") || existing.msclkid,

    ndclid: trimmedParam(params, "ndclid") || existing.ndclid,
    wm_intent: rawIntent
      ? normalizeWmIntent(rawIntent)
      : existing.wm_intent ?? "unknown",
    nd_lead_id: trimmedParam(params, "nd_lead_id") || existing.nd_lead_id,
    nd_form_id: trimmedParam(params, "nd_form_id") || existing.nd_form_id,
    nd_ad_id: trimmedParam(params, "nd_ad_id") || existing.nd_ad_id,
    nd_ad_group_id:
      trimmedParam(params, "nd_ad_group_id") || existing.nd_ad_group_id,
    nd_campaign_id:
      trimmedParam(params, "nd_campaign_id") || existing.nd_campaign_id,

    // Prefer the fresh fbc derived from the current fbclid, then cookie,
    // then storage.
    fbc: synthesizedFbc || readCookie("_fbc") || existing.fbc,
    fbp: readCookie("_fbp") || existing.fbp,
    ttp: readCookie("_ttp") || existing.ttp,

    // Required fallback order: URL param -> existing storage -> direct.
    client_slug: urlClientSlug || existing.client_slug || "direct",

    landing_page: window.location.pathname,
    landing_page_url: fullPathWithQuery,
    raw_query_string: rawQueryString,
    query_params: queryParams,
    referrer: document.referrer || existing.referrer || null,
    captured_at: Date.now(),
  });

  persistUtmData(next);
  return next;
}

export function useUtmCapture(searchKey?: string): UtmData {
  const [utmData, setUtmData] = useState<UtmData>(() => {
    return typeof window !== "undefined" ? captureUtmFromUrl() : EMPTY_UTM;
  });

  useEffect(() => {
    setUtmData(captureUtmFromUrl());
  }, [searchKey]);

  return utmData;
}

/**
 * Legacy string-only payload consumed by existing dataLayer / lead code.
 *
 * IMPORTANT: this payload is spread directly into `supabase.from("leads")
 * .insert({ ...utmPayload })` by callers like `MarketBaselineTool.tsx`.
 * PostgREST rejects unknown column keys (PGRST204), so this helper MUST
 * only emit keys that exist as actual `public.leads` columns. New
 * platform-neutral fields (ttclid / wbraid / gbraid / msclkid / ttp /
 * raw_query_string / referrer) are intentionally NOT included here —
 * they belong in the structured `attribution` jsonb column on `leads`
 * (and on `scan_sessions` / `wm_event_log`), populated via
 * `getAttributionPayload()` below.
 */
export function getUtmPayload(): Record<string, string> {
  const data = getUtmData();
  const payload: Record<string, string> = {};

  if (data.utm_source) payload.utm_source = data.utm_source;
  if (data.utm_medium) payload.utm_medium = data.utm_medium;
  if (data.utm_campaign) payload.utm_campaign = data.utm_campaign;
  if (data.utm_term) payload.utm_term = data.utm_term;
  if (data.utm_content) payload.utm_content = data.utm_content;

  if (data.fbclid) payload.fbclid = data.fbclid;
  if (data.gclid) payload.gclid = data.gclid;

  if (data.fbc) payload.fbc = data.fbc;
  if (data.fbp) payload.fbp = data.fbp;

  if (data.client_slug) payload.client_slug = data.client_slug;
  if (data.landing_page) payload.landing_page = data.landing_page;
  if (data.landing_page_url) payload.landing_page_url = data.landing_page_url;

  return payload;
}

/**
 * Fresh submit-time attribution payload. Use this in lead submission, scan
 * session creation, and OTP payloads instead of closing over hook state.
 */
export function getAttributionPayload(): Record<string, unknown> {
  const data = captureUtmFromUrl();

  return {
    utm_source: data.utm_source,
    utm_medium: data.utm_medium,
    utm_campaign: data.utm_campaign,
    utm_term: data.utm_term,
    utm_content: data.utm_content,

    ttclid: data.ttclid,
    fbclid: data.fbclid,
    gclid: data.gclid,
    wbraid: data.wbraid,
    gbraid: data.gbraid,
    msclkid: data.msclkid,

    ndclid: data.ndclid,
    wm_intent: data.wm_intent,
    nd_lead_id: data.nd_lead_id,
    nd_form_id: data.nd_form_id,
    nd_ad_id: data.nd_ad_id,
    nd_ad_group_id: data.nd_ad_group_id,
    nd_campaign_id: data.nd_campaign_id,

    fbc: data.fbc,
    fbp: data.fbp,
    ttp: data.ttp,

    client_slug: data.client_slug || "direct",
    landing_page: data.landing_page,
    landing_page_url: data.landing_page_url,
    raw_query_string: data.raw_query_string,
    query_params: data.query_params,
    referrer: data.referrer,
    captured_at: data.captured_at,
  };
}
