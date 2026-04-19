/**
 * FacebookConversionProvider — App-level wrapper for Facebook conversion tracking.
 *
 * Responsibilities:
 * 1. Initialize Meta Pixel on mount
 * 2. Capture UTM params + fbclid from URL
 * 3. Generate persistent lead ID
 * 4. Provide conversion tracking context to all children
 * 5. Track SPA route changes as PageView events
 *
 * Usage: Wrap <App /> with this provider in main.tsx
 */

import { useEffect, createContext, useContext, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { initMetaPixel, metaConversions, captureFbc } from "@/lib/metaPixel";
import { useLeadId, getLeadId } from "@/lib/useLeadId";
import { useUtmCapture, getUtmData, getUtmPayload } from "@/lib/useUtmCapture";
import type { UtmData } from "@/lib/useUtmCapture";

// ── Context ─────────────────────────────────────────────────────────────────

interface ConversionContextValue {
  leadId: string;
  utmData: UtmData;
  track: typeof metaConversions;
  getUtmPayload: typeof getUtmPayload;
}

const ConversionContext = createContext<ConversionContextValue | null>(null);

export function useConversion(): ConversionContextValue {
  const ctx = useContext(ConversionContext);
  if (!ctx) {
    // Fallback for components outside provider
    return {
      leadId: getLeadId(),
      utmData: getUtmData(),
      track: metaConversions,
      getUtmPayload,
    };
  }
  return ctx;
}

// ── Provider ────────────────────────────────────────────────────────────────

export function FacebookConversionProvider({ children }: { children: React.ReactNode }) {
  const leadId = useLeadId();
  const utmData = useUtmCapture();

  // Defer pixel init until browser is idle (saves ~750ms FCP)
  useEffect(() => {
    const init = () => { initMetaPixel(); captureFbc(); };
    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(init, { timeout: 3000 });
    } else {
      setTimeout(init, 3000);
    }
  }, []);

  // Track SPA route changes
  // Note: This requires being inside <BrowserRouter>
  // We use a child component to access useLocation

  const value = useMemo<ConversionContextValue>(
    () => ({
      leadId,
      utmData,
      track: metaConversions,
      getUtmPayload,
    }),
    [leadId, utmData]
  );

  return (
    <ConversionContext.Provider value={value}>
      <RouteTracker />
      {children}
    </ConversionContext.Provider>
  );
}

// ── Route change tracker (must be inside BrowserRouter) ─────────────────────

function RouteTracker() {
  const location = useLocation();

  useEffect(() => {
    // Fire PageView on every route change (SPA navigation)
    if (typeof window !== "undefined" && (window as any).fbq) {
      (window as any).fbq("track", "PageView");
    }

    // Also push to dataLayer for GTM
    if (typeof window !== "undefined" && (window as any).dataLayer) {
      (window as any).dataLayer.push({
        event: "virtual_page_view",
        page_path: location.pathname,
        page_search: location.search,
        lead_id: getLeadId(),
      });
    }
  }, [location.pathname]);

  return null;
}
