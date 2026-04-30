/**
 * ctaSource.ts — capture & retrieve the originating CTA tag (e.g. `hero_dev1`)
 *
 * Lightweight attribution helper for **micro-source** tracking inside the
 * funnel. The full UTM/attribution payload still flows through
 * `useUtmCapture` and `getAttributionPayload`. This helper layers a
 * single, opinionated value on top of that — the specific button the
 * user clicked to enter the truth-gate funnel — so we can A/B compare
 * hero variants without polluting `utm_*`.
 *
 * Storage: `localStorage("wm_cta_source")`, 60-minute TTL. First-touch
 * wins inside the TTL window so a user clicking a /dev/hero-* CTA and
 * then bouncing through navigation still attributes correctly when they
 * submit the lead.
 */

const KEY = "wm_cta_source";
const TTL_MS = 60 * 60 * 1000; // 60 minutes
const MAX_LEN = 32;
const VALID = /^[a-z0-9_-]+$/i;

type Stored = { value: string; captured_at: number };

function safeParse(raw: string | null): Stored | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Stored;
    if (
      parsed &&
      typeof parsed.value === "string" &&
      typeof parsed.captured_at === "number"
    ) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Read `?cta=` from the current URL and persist it (first-touch within
 * the TTL window). Returns the effective stored value, or `null`.
 * Safe to call repeatedly; idempotent inside the TTL.
 */
export function captureCtaSourceFromUrl(): string | null {
  if (typeof window === "undefined") return null;

  let next: string | null = null;
  try {
    const raw = new URLSearchParams(window.location.search).get("cta");
    if (raw && VALID.test(raw) && raw.length <= MAX_LEN) {
      next = raw;
    }
  } catch {
    /* ignore */
  }

  let existing: Stored | null = null;
  try {
    existing = safeParse(localStorage.getItem(KEY));
  } catch {
    /* ignore */
  }

  const fresh =
    existing && Date.now() - existing.captured_at < TTL_MS ? existing : null;

  // First-touch wins: don't overwrite a still-valid stored cta.
  if (next && !fresh) {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({ value: next, captured_at: Date.now() }),
      );
    } catch {
      /* ignore */
    }
    return next;
  }

  return fresh?.value ?? next ?? null;
}

/** Read the current cta source without touching the URL. */
export function getCtaSource(): string | null {
  if (typeof window === "undefined") return null;
  let stored: Stored | null = null;
  try {
    stored = safeParse(localStorage.getItem(KEY));
  } catch {
    /* ignore */
  }
  if (!stored) return null;
  if (Date.now() - stored.captured_at > TTL_MS) return null;
  return stored.value;
}

/** Clear the stored cta source (used after lead submission completes). */
export function clearCtaSource(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
