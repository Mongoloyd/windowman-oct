/**
 * Browser adapter for the OpenAI Ads Measurement Pixel.
 *
 * OpenAI measurement is consent-gated and vendor-specific by design. The only
 * supported events in this sprint are:
 *   - page_viewed: initial app load and real SPA route changes
 *   - lead_created: after capture-truth-gate-lead confirms a new persisted lead
 *
 * The browser never creates the lead conversion ID. It reuses the server-issued
 * ID unchanged so the Pixel event can deduplicate with the server CAPI event.
 */

const OPENAI_ADS_SDK_URL = "https://bzrcdn.openai.com/sdk/oaiq.min.js";
const OPENAI_ADS_CONSENT_STORAGE_KEY = "wg_consent_mode_v2";
const OPENAI_ADS_SCRIPT_SELECTOR = "script[data-openai-ads-pixel]";

let initialized = false;
let scriptInjected = false;
let lastMeasuredPageKey: string | null = null;
let resumePageViewAfterSuppression = false;

export interface OpenAiAdsCaptureContext {
  measurementConsent: true;
  sourceUrl: string;
  oppref?: string;
  obref?: string;
}

function configuredPixelId(): string | null {
  const value = import.meta.env.VITE_OPENAI_ADS_PIXEL_ID;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function hasOpenAiAdsMeasurementConsent(): boolean {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(OPENAI_ADS_CONSENT_STORAGE_KEY) === "granted";
  } catch {
    return false;
  }
}

function installQueueAndScript(): void {
  if (scriptInjected || typeof window === "undefined") return;

  if (!window.oaiq) {
    const queue: OpenAiAdsQueue = ((...args: unknown[]) => {
      queue.q = queue.q ?? [];
      queue.q.push(args);
    }) as OpenAiAdsQueue;
    queue.q = [];
    window.oaiq = queue;
  }

  if (!document.querySelector(OPENAI_ADS_SCRIPT_SELECTOR)) {
    const script = document.createElement("script");
    script.async = true;
    script.src = OPENAI_ADS_SDK_URL;
    script.dataset.openaiAdsPixel = "true";

    const firstScript = document.getElementsByTagName("script")[0];
    if (firstScript?.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
    } else {
      document.head.appendChild(script);
    }
  }

  scriptInjected = true;
}

function syncConsent(): boolean {
  const granted = hasOpenAiAdsMeasurementConsent();
  window.oaiq?.("consent", granted);
  return granted;
}

function currentPageKey(): string | null {
  if (typeof window === "undefined") return null;
  return `${window.location.pathname}${window.location.search}`;
}

function ensureInitialized(): {
  ready: boolean;
  consentGranted: boolean;
  initializedNow: boolean;
} {
  if (typeof window === "undefined") {
    return { ready: false, consentGranted: false, initializedNow: false };
  }

  const pixelId = configuredPixelId();
  if (!pixelId) {
    return { ready: false, consentGranted: false, initializedNow: false };
  }

  installQueueAndScript();
  if (!window.oaiq) {
    return { ready: false, consentGranted: false, initializedNow: false };
  }

  const consentGranted = syncConsent();
  if (initialized) {
    return { ready: true, consentGranted, initializedNow: false };
  }

  window.oaiq("init", { pixelId });
  initialized = true;

  if (consentGranted) {
    window.oaiq("measure", "page_viewed", { type: "contents" });
    lastMeasuredPageKey = currentPageKey();
    resumePageViewAfterSuppression = false;
  }

  return { ready: true, consentGranted, initializedNow: true };
}

/** Initialize once. Unset or denied consent is applied before init. */
export function initOpenAiAdsPixel(): void {
  try {
    ensureInitialized();
  } catch {
    // Measurement must never affect app startup.
  }
}

/** Allow one eligible page view after the app deliberately suppresses a route. */
export function markOpenAiAdsPageViewSuppressed(): void {
  resumePageViewAfterSuppression = true;
}

/** Emit one SPA page_viewed event; an initializing call already emits once. */
export function trackOpenAiAdsPageViewed(): void {
  try {
    const state = ensureInitialized();
    if (!state.ready || !state.consentGranted || state.initializedNow) return;

    const pageKey = currentPageKey();
    if (
      !pageKey ||
      (pageKey === lastMeasuredPageKey && !resumePageViewAfterSuppression)
    ) {
      return;
    }

    const oaiq = window.oaiq;
    if (!oaiq) return;

    oaiq("measure", "page_viewed", { type: "contents" });
    lastMeasuredPageKey = pageKey;
    resumePageViewAfterSuppression = false;
  } catch {
    // Measurement must never affect navigation.
  }
}

/** Mirror a server-confirmed new lead with the server event ID unchanged. */
export function trackOpenAiAdsLeadCreated(eventId: string): void {
  try {
    if (typeof eventId !== "string" || eventId.trim().length === 0) return;

    const state = ensureInitialized();
    if (!state.ready || !state.consentGranted) return;

    window.oaiq?.(
      "measure",
      "lead_created",
      { type: "customer_action" },
      { event_id: eventId },
    );
  } catch {
    // Measurement must never affect a successfully persisted lead.
  }
}

function readRawCookie(name: string): string | null {
  if (typeof document === "undefined" || !document.cookie) return null;
  const prefix = `${name}=`;

  for (const rawPart of document.cookie.split(";")) {
    const part = rawPart.startsWith(" ") ? rawPart.slice(1) : rawPart;
    if (!part.startsWith(prefix)) continue;
    const value = part.slice(prefix.length);
    return value.trim().length > 0 ? value : null;
  }

  return null;
}

function readRawQueryParameter(name: string): string | null {
  if (typeof window === "undefined") return null;
  const search = window.location.search.startsWith("?")
    ? window.location.search.slice(1)
    : window.location.search;

  for (const part of search.split("&")) {
    const separator = part.indexOf("=");
    const key = separator >= 0 ? part.slice(0, separator) : part;
    if (key !== name) continue;
    const value = separator >= 0 ? part.slice(separator + 1) : "";
    return value.trim().length > 0 ? value : null;
  }

  return null;
}

/**
 * Consent-gated browser context for the existing TruthGate request.
 * Opaque OpenAI identifiers are intentionally not decoded or normalized.
 */
export function getOpenAiAdsCaptureContext(): OpenAiAdsCaptureContext | null {
  try {
    if (typeof window === "undefined" || !hasOpenAiAdsMeasurementConsent()) {
      return null;
    }

    const sourceUrl = window.location.href;
    if (typeof sourceUrl !== "string" || sourceUrl.trim().length === 0) {
      return null;
    }

    const oppref = readRawCookie("__oppref") ?? readRawQueryParameter("oppref");
    const obref = readRawCookie("__obref");

    return {
      measurementConsent: true,
      sourceUrl,
      ...(oppref ? { oppref } : {}),
      ...(obref ? { obref } : {}),
    };
  } catch {
    return null;
  }
}
