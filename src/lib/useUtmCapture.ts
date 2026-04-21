/**
 * useUtmCapture.ts — Dynamic attribution capture & persistence
 *
 * Captures on page load from URL:
 * - utm_source, utm_medium, utm_campaign, utm_term, utm_content
 * - fbclid (Facebook Click ID, used to derive fbc when present)
 * - gclid (Google Click ID)
 * - client (WindowMan client slug from URL)
 *
 * Captures from cookies (passively seeded by Meta Pixel / GTM):
 * - _fbp (Facebook browser ID — required for CAPI match quality)
 * - _fbc (Facebook click ID cookie — used when no ?fbclid is present
 *         in the URL but the user landed from a prior Meta-attributed session)
 *
 * Persists to localStorage so attribution survives:
 * - SPA navigation
 * - Multi-step funnel completion
 * - Page refresh during OTP flow
 *
 * NOTE: Adding `fbp` to the captured payload does NOT change tracking
 * architecture or introduce browser-side conversion sends. It only ensures
 * the `leads.fbp` column (already in schema) is actually populated when
 * the existing intake forms write attribution. Without this, every
 * downstream server-side CAPI dispatch loses match quality.
 */

import { useEffect, useState } from "react";

const UTM_STORAGE_KEY = "wm_utm_data";
const UTM_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface UtmData {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  fbclid: string | null;
  gclid: string | null;
  fbc: string | null;
  fbp: string | null;
  client_slug: string | null;
  landing_page: string | null;
  landing_page_url: string | null;
  captured_at: number;
}

const EMPTY_UTM: UtmData = {
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_term: null,
  utm_content: null,
  fbclid: null,
  gclid: null,
  fbc: null,
  fbp: null,
  client_slug: null,
  landing_page: null,
  landing_page_url: null,
  captured_at: 0,
};

/**
 * Read a cookie value by name. Returns null if absent or in a non-browser
 * context. Decodes URL-encoded values (Meta writes `_fbc` as encoded).
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

export function getUtmData(): UtmData {
  if (typeof window === "undefined") return EMPTY_UTM;

  // Always re-read fbp/fbc cookies on access — they may have been
  // seeded AFTER the last localStorage write (e.g., Pixel script loaded
  // late, or GTM consent granted mid-session).
  const fbpCookie = readCookie("_fbp");
  const fbcCookie = readCookie("_fbc");

  try {
    const stored = localStorage.getItem(UTM_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<UtmData>;
      if (
        typeof parsed.captured_at === "number" &&
        Date.now() - parsed.captured_at < UTM_EXPIRY_MS
      ) {
        return {
          ...EMPTY_UTM,
          ...parsed,
          // Cookie values always win over stale localStorage copies.
          fbp: fbpCookie || parsed.fbp || null,
          fbc: fbcCookie || parsed.fbc || null,
        };
      }
    }
  } catch {
    // ignore corrupted storage
  }

  // No stored UTM yet, but cookies may still exist (organic Meta traffic
  // with the Pixel firing on first visit). Surface them anyway so leads
  // captured before the URL-driven capture path runs still get fbp/fbc.
  if (fbpCookie || fbcCookie) {
    return {
      ...EMPTY_UTM,
      fbp: fbpCookie,
      fbc: fbcCookie,
    };
  }

  return EMPTY_UTM;
}

export function captureUtmFromUrl(): UtmData {
  if (typeof window === "undefined") return EMPTY_UTM;

  const params = new URLSearchParams(window.location.search);
  const hasAttributionParams = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "fbclid",
    "gclid",
    "client",
  ].some((key) => params.has(key));

  const existing = getUtmData();

  // Even on a "no-new-attribution" visit, refresh fbp/fbc from cookies
  // before returning — the Pixel may have just dropped them on this load.
  if (!hasAttributionParams && existing.captured_at > 0) {
    const fbpCookie = readCookie("_fbp");
    const fbcCookie = readCookie("_fbc");
    if (
      (fbpCookie && fbpCookie !== existing.fbp) ||
      (fbcCookie && fbcCookie !== existing.fbc)
    ) {
      const refreshed: UtmData = {
        ...existing,
        fbp: fbpCookie || existing.fbp,
        fbc: fbcCookie || existing.fbc,
      };
      try {
        localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(refreshed));
      } catch {
        // ignore storage limits
      }
      return refreshed;
    }
    return existing;
  }

  const fbclid = params.get("fbclid");
  let fbc: string | null = null;
  if (fbclid) {
    fbc = `fb.1.${Date.now()}.${fbclid}`;
    const expires = new Date(Date.now() + 90 * 864e5).toUTCString();
    document.cookie = `_fbc=${encodeURIComponent(fbc)};expires=${expires};path=/;SameSite=Lax`;
  }

  const fbpCookie = readCookie("_fbp");
  const fbcCookie = readCookie("_fbc");

  const fullPathWithQuery = `${window.location.pathname}${window.location.search}`;

  const utmData: UtmData = {
    utm_source: params.get("utm_source") || existing.utm_source,
    utm_medium: params.get("utm_medium") || existing.utm_medium,
    utm_campaign: params.get("utm_campaign") || existing.utm_campaign,
    utm_term: params.get("utm_term") || existing.utm_term,
    utm_content: params.get("utm_content") || existing.utm_content,
    fbclid: fbclid || existing.fbclid,
    gclid: params.get("gclid") || existing.gclid,
    // Prefer freshly synthesized fbc from this visit's fbclid, then the
    // existing cookie (which Meta keeps in sync), then any stale stored value.
    fbc: fbc || fbcCookie || existing.fbc,
    fbp: fbpCookie || existing.fbp,
    client_slug: params.get("client"),
    landing_page: window.location.pathname,
    landing_page_url: fullPathWithQuery,
    captured_at: Date.now(),
  };

  // Preserve first-touch client_slug if current URL doesn't include ?client=
  if (!params.has("client") && existing.client_slug) {
    utmData.client_slug = existing.client_slug;
  }

  // Persist to local storage as intended by the file header
  try {
    localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utmData));
  } catch (e) {
    // ignore storage limits
  }

  return utmData;
}

export function useUtmCapture(): UtmData {
  // Initialize state synchronously so it is NEVER empty on first render
  const [utmData, setUtmData] = useState<UtmData>(() => {
    return typeof window !== "undefined" ? captureUtmFromUrl() : EMPTY_UTM;
  });

  useEffect(() => {
    // Catch subsequent client-side URL updates
    const data = captureUtmFromUrl();
    setUtmData(data);
  }, []);

  return utmData;
}

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
