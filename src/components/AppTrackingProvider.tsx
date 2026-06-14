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
import { useLeadId, getLeadId } from "@/lib/useLeadId";
import {
  useUtmCapture,
  getUtmData,
  getUtmPayload,
  type UtmData,
} from "@/lib/useUtmCapture";
import { trackGtmEvent } from "@/lib/trackConversion";
import { initMetaBrowserPixel, trackMetaPageView } from "@/lib/metaBrowserPixel";

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
  // Guards against double-firing the initial Meta PageView. The canonical
  // owner of the FIRST browser Meta `PageView` is `initMetaBrowserPixel()`
  // in `src/lib/metaBrowserPixel.ts`, which runs in the provider mount
  // effect. This RouteTracker owns SPA route-change PageViews ONLY, so we
  // must skip the very first effect run (which corresponds to the initial
  // mount, not a navigation).
  const isFirstRouteEffect = useRef(true);

  useEffect(() => {
    // Canonical, vendor-agnostic SPA page-view signal — fires on every
    // route change AND initial mount. GTM owns downstream routing.
    trackGtmEvent("virtual_page_view", {
      page_path: location.pathname,
      page_search: location.search,
      lead_id: getLeadId(),
    });

    // Browser Meta PageView: skip the first effect run because
    // `initMetaBrowserPixel` already fired the initial PageView.
    // Subsequent runs correspond to real SPA navigations.
    if (isFirstRouteEffect.current) {
      isFirstRouteEffect.current = false;
      return;
    }
    trackMetaPageView();
  }, [location.pathname, location.search]);

  return null;
}
