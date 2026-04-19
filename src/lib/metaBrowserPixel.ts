/**
 * metaBrowserPixel.ts — Browser-side Meta Pixel (TOP-OF-FUNNEL ONLY)
 *
 * SCOPE (intentionally narrow):
 *   - Initialize one WindowMan-controlled Meta Pixel exactly once.
 *   - Fire `PageView` on initial app load and on every SPA route change.
 *   - Allow Meta to passively seed/read `_fbp` and `_fbc` cookies for
 *     server-side CAPI deduplication and attribution support.
 *
 * NON-GOALS (HARD RULES — DO NOT EXTEND):
 *   - ❌ No `Lead`, `CompleteRegistration`, `Purchase`, `SubmitApplication`,
 *        `Schedule`, OTP-verified, or report-revealed events from the browser.
 *   - ❌ No browser POSTs to `/functions/v1/capi-event` or any conversion
 *        endpoint. Conversion ownership is server-side (Edge Functions).
 *   - ❌ No multi-pixel routing, no per-client init, no `metaConversions`
 *        helper resurrection, no Meta access tokens in the frontend.
 *
 * If a future need arises for a browser conversion event, STOP and open a
 * dedicated, scoped sprint. Do not add it here.
 *
 * See: docs/measurement/BROWSER_META_DECOUPLING_COMPLETE.md
 */

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & {
      callMethod?: (...args: unknown[]) => void;
      queue?: unknown[];
      loaded?: boolean;
      version?: string;
      push?: (...args: unknown[]) => void;
    };
    _fbq?: Window["fbq"];
  }
}

let initialized = false;
let scriptInjected = false;

/** Inject the official Meta Pixel base script and create the `fbq` queue. */
function injectBaseScript(): void {
  if (scriptInjected || typeof window === "undefined") return;
  if (window.fbq) {
    scriptInjected = true;
    return;
  }

  // Standard Meta Pixel base snippet, ported to TS without `eval`.
  const fbq: Window["fbq"] = function (...args: unknown[]) {
    if (fbq.callMethod) {
      fbq.callMethod.apply(fbq, args);
    } else {
      (fbq.queue = fbq.queue || []).push(args);
    }
  } as Window["fbq"];

  if (!window._fbq) window._fbq = fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  window.fbq = fbq;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  const first = document.getElementsByTagName("script")[0];
  first?.parentNode?.insertBefore(script, first);

  scriptInjected = true;
}

/**
 * Initialize the pixel exactly once, then fire the initial PageView.
 * Safe to call repeatedly — subsequent calls are no-ops.
 */
export function initMetaBrowserPixel(): void {
  if (initialized || typeof window === "undefined") return;

  const pixelId = import.meta.env.VITE_META_PIXEL_ID as string | undefined;
  if (!pixelId || pixelId === "test-pixel-id") {
    // No real pixel configured (or running with the placeholder dev value).
    // Stay silent — do not inject the script and do not pretend to track.
    return;
  }

  injectBaseScript();
  if (!window.fbq) return;

  window.fbq("init", pixelId);
  window.fbq("track", "PageView");
  initialized = true;
}

/**
 * Fire a PageView for an SPA route change. No-op if the pixel was never
 * initialized (e.g. no `VITE_META_PIXEL_ID` configured).
 *
 * This is ADDITIVE to the canonical `virtual_page_view` dataLayer push —
 * it does not replace it.
 */
export function trackMetaPageView(): void {
  if (typeof window === "undefined") return;
  if (!initialized || !window.fbq) return;
  window.fbq("track", "PageView");
}
