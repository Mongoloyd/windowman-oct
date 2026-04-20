/**
 * useUtmCapture.ts — Dynamic attribution capture & persistence
 *
 * Captures on page load from URL:
 * - utm_source, utm_medium, utm_campaign, utm_term, utm_content
 * - fbclid (Facebook Click ID, used to derive fbc when present)
 * - gclid (Google Click ID)
 * - client (WindowMan client slug from URL)
 *
 * Persists to localStorage so attribution survives:
 * - SPA navigation
 * - Multi-step funnel completion
 * - Page refresh during OTP flow
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
  client_slug: null,
  landing_page: null,
  landing_page_url: null,
  captured_at: 0,
};

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
        return {
          ...EMPTY_UTM,
          ...parsed,
        };
      }
    }
  } catch {
    // ignore corrupted storage
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

  if (!hasAttributionParams && existing.captured_at > 0) {
    return existing;
  }

  const fbclid = params.get("fbclid");
  let fbc: string | null = null;
  if (fbclid) {
    fbc = `fb.1.${Date.now()}.${fbclid}`;
    const expires = new Date(Date.now() + 90 * 864e5).toUTCString();
    document.cookie = `_fbc=${encodeURIComponent(fbc)};expires=${expires};path=/;SameSite=Lax`;
  }

  const fullPathWithQuery = `${window.location.pathname}${window.location.search}`;

  const utmData: UtmData = {
    utm_source: params.get("utm_source") || existing.utm_source,
    utm_medium: params.get("utm_medium") || existing.utm_medium,
    utm_campaign: params.get("utm_campaign") || existing.utm_campaign,
    utm_term: params.get("utm_term") || existing.utm_term,
    utm_content: params.get("utm_content") || existing.utm_content,
    fbclid: fbclid || existing.fbclid,
    gclid: params.get("gclid") || existing.gclid,
    fbc: fbc || existing.fbc,
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
  if (data.client_slug) payload.client_slug = data.client_slug;
  if (data.landing_page) payload.landing_page = data.landing_page;
  if (data.landing_page_url) payload.landing_page_url = data.landing_page_url;

  return payload;
}
