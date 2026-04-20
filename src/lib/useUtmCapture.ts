/**
 * useUtmCapture.ts — Dynamic UTM Parameter Capture & Persistence
 *
 * Captures on first page load from URL:
 * - utm_source, utm_medium, utm_campaign, utm_term, utm_content
 * - fbclid (Facebook Click ID → builds _fbc cookie)
 * - gclid (Google Click ID)
 * - fbc (Facebook Click cookie, if set by pixel)
 *
 * Persists to localStorage so attribution survives:
 * - SPA navigation (no page reload)
 * - Multi-step funnel completion
 * - Page refresh during OTP flow
 *
 * First-touch attribution: only captures on first visit with UTM params.
 * Subsequent visits with new UTM params will overwrite (last-touch for ads).
 */

const UTM_STORAGE_KEY = "wm_utm_data";
const UTM_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface UtmData {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  client_slug: string | null;
  fbclid: string | null;
  gclid: string | null;
  fbc: string | null;
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
  client_slug: null,
  fbclid: null,
  gclid: null,
  fbc: null,
  landing_page: null,
  landing_page_url: null,
  captured_at: 0,
};

// ── Core getter (works outside React) ───────────────────────────────────────

export function getUtmData(): UtmData {
  if (typeof window === "undefined") return EMPTY_UTM;

  try {
    const stored = localStorage.getItem(UTM_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as UtmData;
      // Check expiry
      if (Date.now() - parsed.captured_at < UTM_EXPIRY_MS) {
        return parsed;
      }
    }
  } catch {
    // Corrupted data — will re-capture
  }

  return EMPTY_UTM;
}

// ── Capture from URL ────────────────────────────────────────────────────────

export function captureUtmFromUrl(): UtmData {
  if (typeof window === "undefined") return EMPTY_UTM;

  const params = new URLSearchParams(window.location.search);

  // Check if URL has any UTM or click ID params
  const hasUtmParams = [
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "client",
    "fbclid", "gclid",
  ].some((key) => params.has(key));

  if (!hasUtmParams) {
    // No new UTM data — return existing stored data
    return getUtmData();
  }

  // Build _fbc cookie from fbclid
  const fbclid = params.get("fbclid");
  let fbc: string | null = null;
  if (fbclid) {
    fbc = `fb.1.${Date.now()}.${fbclid}`;
    // Set _fbc cookie for pixel
    const expires = new Date(Date.now() + 90 * 864e5).toUTCString();
    document.cookie = `_fbc=${encodeURIComponent(fbc)};expires=${expires};path=/;SameSite=Lax`;
  }

  const existing = getUtmData();

  const utmData: UtmData = {
    utm_source: params.get("utm_source"),
    utm_medium: params.get("utm_medium"),
    utm_campaign: params.get("utm_campaign"),
    utm_term: params.get("utm_term"),
    utm_content: params.get("utm_content"),
    client_slug: params.get("client"),
    fbclid,
    gclid: params.get("gclid"),
    fbc,
    landing_page: `${window.location.pathname}${window.location.search}`,
    landing_page_url: `${window.location.pathname}${window.location.search}`,
    captured_at: Date.now(),
  };

  // Preserve first-touch client_slug if current URL doesn't include ?client=
  if (!params.has("client") && existing.client_slug) {
    utmData.client_slug = existing.client_slug;
  }

  // Persist to localStorage
  try {
    localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utmData));
  } catch {
    // Storage full — non-critical
  }

  return utmData;
}

// ── React hook ──────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";

export function useUtmCapture(): UtmData {
  const [utmData, setUtmData] = useState<UtmData>(EMPTY_UTM);

  useEffect(() => {
    const data = captureUtmFromUrl();
    setUtmData(data);
  }, []);

  return utmData;
}

// ── Utility: Get UTM params as flat object for form submissions ─────────────

export function getUtmPayload(): Record<string, string> {
  const data = getUtmData();
  const payload: Record<string, string> = {};

  if (data.utm_source) payload.utm_source = data.utm_source;
  if (data.utm_medium) payload.utm_medium = data.utm_medium;
  if (data.utm_campaign) payload.utm_campaign = data.utm_campaign;
  if (data.utm_term) payload.utm_term = data.utm_term;
  if (data.utm_content) payload.utm_content = data.utm_content;
  if (data.client_slug) payload.client_slug = data.client_slug;
  if (data.fbclid) payload.fbclid = data.fbclid;
  if (data.gclid) payload.gclid = data.gclid;
  if (data.fbc) payload.fbc = data.fbc;
  if (data.landing_page) payload.landing_page = data.landing_page;
  if (data.landing_page_url) payload.landing_page_url = data.landing_page_url;

  return payload;
}
