/**
 * AppTrackingProvider — Vendor-agnostic app-level tracking wrapper.
 *
 * Responsibilities:
 *   1. Passive UTM capture on mount (via useUtmCapture).
 *   2. Passive lead ID context (via useLeadId).
 *   3. Vendor-agnostic `virtual_page_view` push on every SPA route change,
 *      routed through the canonical `trackGtmEvent` dataLayer path so GTM
 *      (and any vendor it owns) decides where to forward it.
 *
 * NON-GOALS:
 *   - No Meta Pixel init, no `fbq`, no direct `capi-event` browser calls.
 *   - No OTP, verification, or report-reveal awareness.
 *   - No vendor SDK imports of any kind.
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

// ── Route change tracker (vendor-agnostic) ──────────────────────────────────

function RouteTracker() {
  const location = useLocation();

  useEffect(() => {
    // Canonical, vendor-agnostic SPA page-view signal.
    // GTM owns any downstream routing (GA4, Ads, Meta, etc.).
    trackGtmEvent("virtual_page_view", {
      page_path: location.pathname,
      page_search: location.search,
      lead_id: getLeadId(),
    });
  }, [location.pathname, location.search]);

  return null;
}
