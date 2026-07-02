/**
 * Landing-page tracking call sites.
 * Keeps landingHandoff.ts dependency-free while wiring low-intent dataLayer events.
 */

import {
  HANDOFF_SOURCE_ROUTE_KEY,
  pushLowIntentEvent,
} from "@/lib/tracking/dataLayer";
import { handoffToCanonicalUpload, openFirstQuoteIntake } from "./landingHandoff";

export function trackAndHandoffToCanonicalUpload(ctaSource: string): void {
  pushLowIntentEvent("windowman_handoff_has_quote", {
    page_path: "/windowman",
    destination_path: "/",
    destination_hash: "#truth-gate",
    wm_intent: "has_quote",
    cta_source: ctaSource,
  });

  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(HANDOFF_SOURCE_ROUTE_KEY, "/windowman");
    } catch {
      // Non-blocking
    }
  }

  handoffToCanonicalUpload();
}

export function trackAndOpenFirstQuoteIntake(ctaSource: string): void {
  pushLowIntentEvent("first_quote_modal_opened", {
    page_path: "/windowman",
    wm_intent: "no_quote",
    cta_source: ctaSource,
  });

  openFirstQuoteIntake();
}
