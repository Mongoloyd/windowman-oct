/**
 * AppTrackingProvider — App-level tracking wrapper.
 *
 * Responsibilities:
 *   1. Passive UTM capture on mount and SPA route-search changes (via useUtmCapture).
 *   2. Passive lead ID context (via useLeadId).
 *   3. Vendor-agnostic `virtual_page_view` push on every SPA route change,
 *      routed through the canonical `trackGtmEvent` dataLayer path so GTM
 *      (and any vendor it owns) decides where to forward it.
 *   4. NARROW EXCEPTION: initialize one WindowMan-controlled Meta browser
 *      pixel and fire `PageView` on initial load + SPA route change for
 *      top-of-funnel attribution and `_fbp` / `_fbc` cookie seeding only.
 *      Conversion ownership remains server-side. See `metaBrowserPixel.ts`.
 *   5. Initialize the consent-gated OpenAI Ads Pixel once and emit
 *      `page_viewed` on initial load + real SPA route changes. OpenAI's
 *      `lead_created` mirror is owned by the confirmed lead service instead.
 *
 * NON-GOALS:
 *   - No browser-side Meta conversion events (no `Lead`, no `Purchase`,
 *     no OTP-verified, no report-revealed).
 *   - No direct `capi-event` browser calls.
 *   - No OTP, verification, or report-reveal awareness.
 *   - No multi-pixel routing.
 *
 * Must render INSIDE <BrowserRouter> because it uses `useLocation`.
 */

import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { getLeadId, useLeadId } from "@/lib/useLeadId";
import {
  useUtmCapture,
  getUtmData,
  getUtmPayload,
  type UtmData,
} from "@/lib/useUtmCapture";
import {
  pushTruthGateViewedOnce,
  pushVirtualPageView,
} from "@/lib/tracking/dataLayer";
import { initMetaBrowserPixel, trackMetaPageView } from "@/lib/metaBrowserPixel";
import {
  initOpenAiAdsPixel,
  trackOpenAiAdsPageViewed,
} from "@/lib/openAiAdsPixel";

// ── Context ─────────────────────────────────────────────────────────────────

interface AppTrackingContextValue {
  leadId: string;
  utmData: UtmData;
  getUtmPayload: typeof getUtmPayload;
}

const AppTrackingContext = createContext<AppTrackingContextValue | null>(null);

export function useAppTracking(): AppTrackingContextValue {
  const ctx = useContext(AppTrackingContext);
  if (!ctx) {
    // Safe fallback for components rendered outside the provider (e.g. tests).
    return {
      leadId: getLeadId(),
      utmData: getUtmData(),
      getUtmPayload,
    };
  }
  return ctx;
}

// ── Provider ────────────────────────────────────────────────────────────────

export function AppTrackingProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const leadId = useLeadId();
  const utmData = useUtmCapture(`${location.pathname}${location.search}`);

  // Initialize the WindowMan Meta browser pixel exactly once on mount.
  // No-op if VITE_META_PIXEL_ID is unset or set to the dev placeholder.
  // The init call itself fires the initial PageView.
  useEffect(() => {
    initMetaBrowserPixel();
    initOpenAiAdsPixel();
  }, []);

  const value = useMemo<AppTrackingContextValue>(
    () => ({ leadId, utmData, getUtmPayload }),
    [leadId, utmData]
  );

  return (
    <AppTrackingContext.Provider value={value}>
      <RouteTracker />
      {children}
    </AppTrackingContext.Provider>
  );
}

// ── Route change tracker ────────────────────────────────────────────────────

function RouteTracker() {
  const location = useLocation();
  // Guards against double-firing the initial vendor page views. The browser
  // adapters initialize in the provider mount effect; this RouteTracker owns
  // SPA route-change views only, so the initial effect is skipped.
  const isFirstRouteEffect = useRef(true);

  useEffect(() => {
    // Canonical, vendor-agnostic SPA page-view signal — fires on every
    // route change AND initial mount. GTM owns downstream routing.
    pushVirtualPageView({
      page_path: location.pathname,
      page_search: location.search,
    });

    pushTruthGateViewedOnce({
      page_path: location.pathname,
      page_search: location.search,
      page_hash: location.hash,
    });

    // Skip vendor route events on initial mount because their adapters own
    // initial-load measurement. Subsequent runs are real SPA navigations.
    if (isFirstRouteEffect.current) {
      isFirstRouteEffect.current = false;
      return;
    }
    trackMetaPageView();
    trackOpenAiAdsPageViewed();
  }, [location.pathname, location.search, location.hash]);

  return null;
}
