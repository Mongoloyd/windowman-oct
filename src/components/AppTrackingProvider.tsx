/**
 * AppTrackingProvider — App-level tracking wrapper.
 *
 * Responsibilities:
 *   1. Passive UTM capture on mount and SPA route-search changes (via useUtmCapture).
 *   2. Passive lead ID context (via useLeadId).
 *   3. Vendor-agnostic `virtual_page_view` push on eligible SPA route changes,
 *      routed through the canonical `trackGtmEvent` dataLayer path so GTM
 *      (and any vendor it owns) decides where to forward it.
 *   4. NARROW EXCEPTION: initialize one WindowMan-controlled Meta browser
 *      pixel and fire `PageView` on initial load + SPA route change for
 *      top-of-funnel attribution and `_fbp` / `_fbc` cookie seeding only.
 *      Conversion ownership remains server-side. See `metaBrowserPixel.ts`.
 *   5. Initialize the consent-gated OpenAI Ads Pixel once and emit
 *      `page_viewed` on initial load + real SPA route changes. OpenAI's
 *      `lead_created` mirror is owned by the confirmed lead service instead.
 *   6. NARROW EXCEPTION: `/wmchat` keeps passive first-party attribution but
 *      emits no application-owned browser page measurement.
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

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
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
  markOpenAiAdsPageViewSuppressed,
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
  const pageMeasurementSuppressedRef = useRef(
    isWmChatMeasurementPath(location.pathname),
  );

  useLayoutEffect(() => {
    pageMeasurementSuppressedRef.current = isWmChatMeasurementPath(
      location.pathname,
    );
  }, [location.pathname]);

  // RouteTracker owns page-adapter initialization so a direct /wmchat load
  // cannot trigger the initial events built into either adapter.
  useEffect(() => {
    // The consent UI owns the persisted choice. Re-sync the existing OpenAI
    // adapter when that choice changes so a first-page grant can emit the
    // current page_viewed without waiting for navigation or reload.
    const handleConsentChanged = () => {
      if (pageMeasurementSuppressedRef.current) return;
      trackOpenAiAdsPageViewed();
    };
    window.addEventListener("consentChanged", handleConsentChanged);

    return () => {
      window.removeEventListener("consentChanged", handleConsentChanged);
    };
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

function isWmChatMeasurementPath(pathname: string): boolean {
  const normalizedPathname = pathname.toLowerCase();
  return (
    normalizedPathname === "/wmchat" ||
    normalizedPathname.startsWith("/wmchat/")
  );
}

function RouteTracker() {
  const location = useLocation();
  const lastObservedRouteKey = useRef<string | null>(null);
  const hasEligibleRoute = useRef(false);
  const wasWmChatRoute = useRef(isWmChatMeasurementPath(location.pathname));

  useEffect(() => {
    const routeKey = `${location.pathname}${location.search}${location.hash}`;
    if (lastObservedRouteKey.current === routeKey) return;
    lastObservedRouteKey.current = routeKey;

    const isWmChatRoute = isWmChatMeasurementPath(location.pathname);
    const enteredWmChat = isWmChatRoute && !wasWmChatRoute.current;
    wasWmChatRoute.current = isWmChatRoute;

    if (isWmChatRoute) {
      if (enteredWmChat && hasEligibleRoute.current) {
        markOpenAiAdsPageViewSuppressed();
      }
      return;
    }

    // Canonical, vendor-agnostic SPA page-view signal — fires on every
    // eligible route change and eligible initial mount. GTM owns downstream
    // routing. Passive attribution capture remains mounted above this guard.
    pushVirtualPageView({
      page_path: location.pathname,
      page_search: location.search,
    });

    pushTruthGateViewedOnce({
      page_path: location.pathname,
      page_search: location.search,
      page_hash: location.hash,
    });

    // Adapter initialization owns the first eligible page event. This may be
    // the initial route or the first destination after a suppressed /wmchat
    // visit. Later eligible routes use the adapters' SPA event functions.
    if (!hasEligibleRoute.current) {
      hasEligibleRoute.current = true;
      initMetaBrowserPixel();
      initOpenAiAdsPixel();
      return;
    }
    trackMetaPageView();
    trackOpenAiAdsPageViewed();
  }, [location.pathname, location.search, location.hash]);

  return null;
}
