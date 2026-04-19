/**
 * AppTrackingProvider — App-level tracking wrapper.
 *
 * Responsibilities:
 *   1. Passive UTM capture on mount (via useUtmCapture).
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

import { createContext, useContext, useEffect, useMemo } from "react";
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
  const leadId = useLeadId();
  const utmData = useUtmCapture();

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

  useEffect(() => {
    // Canonical, vendor-agnostic SPA page-view signal.
    // GTM owns any downstream routing (GA4, Ads, etc.).
    trackGtmEvent("virtual_page_view", {
      page_path: location.pathname,
      page_search: location.search,
      lead_id: getLeadId(),
    });

    // Additive top-of-funnel browser PageView for the WindowMan Meta pixel.
    // No-op if the pixel was never initialized. PageView only — never a
    // conversion event. Skips the very first mount because `initMetaBrowserPixel`
    // already fires PageView during init.
    trackMetaPageView();
  }, [location.pathname, location.search]);

  return null;
}
