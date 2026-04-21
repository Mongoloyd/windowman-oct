/**
 * fbCookies.ts — Attribution truth helpers for `_fbp` / `_fbc`.
 *
 * Single source of truth for:
 *   1. Cookie reads (decoded, browser-safe, SSR-safe)
 *   2. Strict validation — only Meta's documented `fb.<subdomainIndex>.<ts>.<value>` shape
 *   3. Late re-read at submission time so values seeded after first paint
 *      (Pixel/GTM dropped late, consent granted mid-funnel) still land
 *   4. One-shot per-session diagnostic logger so malformed cookies are
 *      reported once, never spammed
 *
 * NON-GOALS:
 *   - Does NOT introduce a second attribution pipeline.
 *   - Does NOT POST to capi-event from the browser.
 *   - Does NOT write to any storage (callers persist via the existing
 *     `leads.fbp` / `leads.fbc` columns through their normal insert path).
 */
import { supabase } from "@/integrations/supabase/client";

// Meta's documented shape: `fb.<subdomainIndex>.<creationTimestamp>.<value>`
// subdomainIndex ∈ {0,1,2}, creationTimestamp is ms epoch (10–13 digits),
// value is the random ID for fbp or the fbclid for fbc. Anything else is
// garbage we refuse to write.
const FBP_REGEX = /^fb\.[0-2]\.\d{10,13}\.\d{6,}$/;
const FBC_REGEX = /^fb\.[0-2]\.\d{10,13}\.[A-Za-z0-9_\-]{6,}$/;

export function isValidFbp(value: string | null | undefined): value is string {
  if (!value || typeof value !== "string") return false;
  if (value.length > 256) return false;
  return FBP_REGEX.test(value);
}

export function isValidFbc(value: string | null | undefined): value is string {
  if (!value || typeof value !== "string") return false;
  if (value.length > 512) return false;
  return FBC_REGEX.test(value);
}

/** SSR-safe cookie reader. Decodes URL-encoded values (Meta writes `_fbc` encoded). */
export function readCookie(name: string): string | null {
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

export interface FbAttribution {
  /** Validated `_fbp` cookie value, or null if absent / malformed. */
  fbp: string | null;
  /** Validated `_fbc` cookie value, or null if absent / malformed. */
  fbc: string | null;
}

/**
 * Late re-read of `_fbp` / `_fbc` cookies right before submission.
 *
 * Always prefer the freshest validated cookie value; fall back to whatever
 * the caller already had (e.g. captured earlier from URL → localStorage).
 *
 * If a cookie is present but malformed, fires ONE diagnostic event per
 * session per surface and returns `null` for that field — we never write
 * garbage values into `leads.fbp` / `leads.fbc`.
 */
export function readLateFbCookies(
  fallback: { fbp?: string | null; fbc?: string | null },
  context: { surface: string; sessionId?: string | null; leadId?: string | null },
): FbAttribution {
  const rawFbp = readCookie("_fbp");
  const rawFbc = readCookie("_fbc");

  let fbp: string | null = null;
  let fbc: string | null = null;
  const invalidFields: string[] = [];

  if (rawFbp !== null) {
    if (isValidFbp(rawFbp)) {
      fbp = rawFbp;
    } else {
      invalidFields.push("fbp_cookie");
    }
  }
  // Cookie missing or invalid — fall back to validated fallback only
  if (fbp === null && isValidFbp(fallback.fbp ?? null)) {
    fbp = fallback.fbp ?? null;
  } else if (fbp === null && fallback.fbp) {
    invalidFields.push("fbp_fallback");
  }

  if (rawFbc !== null) {
    if (isValidFbc(rawFbc)) {
      fbc = rawFbc;
    } else {
      invalidFields.push("fbc_cookie");
    }
  }
  if (fbc === null && isValidFbc(fallback.fbc ?? null)) {
    fbc = fallback.fbc ?? null;
  } else if (fbc === null && fallback.fbc) {
    invalidFields.push("fbc_fallback");
  }

  if (invalidFields.length > 0) {
    logInvalidAttributionOnce(context, invalidFields, { rawFbp, rawFbc });
  }

  return { fbp, fbc };
}

// ── one-shot diagnostic dedup ──────────────────────────────────────────────
//
// Spamming `event_logs` with one row per malformed cookie per pageview
// would be useless noise. We fire the diagnostic at most once per
// (surface + invalid-field-set) per browser session.

const DIAG_LOGGED = new Set<string>();

function logInvalidAttributionOnce(
  context: { surface: string; sessionId?: string | null; leadId?: string | null },
  invalidFields: string[],
  raw: { rawFbp: string | null; rawFbc: string | null },
): void {
  const dedupKey = `${context.surface}::${invalidFields.sort().join(",")}`;
  if (DIAG_LOGGED.has(dedupKey)) return;
  DIAG_LOGGED.add(dedupKey);

  // Mask raw values — we want the SHAPE of the failure, not PII-adjacent strings.
  const maskedFbp = raw.rawFbp ? `len=${raw.rawFbp.length}` : "absent";
  const maskedFbc = raw.rawFbc ? `len=${raw.rawFbc.length}` : "absent";

  // Best-effort. Never block submission. Never throw.
  void supabase
    .from("event_logs")
    .insert({
      event_name: "attribution_invalid_fb_cookie",
      session_id: context.sessionId ?? null,
      lead_id: context.leadId ?? null,
      route: typeof window !== "undefined" ? window.location.pathname : null,
      metadata: {
        surface: context.surface,
        invalid_fields: invalidFields,
        masked_fbp: maskedFbp,
        masked_fbc: maskedFbc,
        timestamp: new Date().toISOString(),
      },
    })
    .then(({ error }) => {
      if (error) {
        // Stay silent in prod; surface in dev only
        if (typeof console !== "undefined") {
          console.warn("[attribution] diagnostic insert failed:", error.message);
        }
      }
    });
}

/** Test-only: clear the per-session dedup set so unit tests stay isolated. */
export function __resetAttributionDiagnosticsForTests(): void {
  DIAG_LOGGED.clear();
}
