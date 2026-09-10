/**
 * Landing-page tracking call sites.
 * Keeps landingHandoff.ts dependency-free while wiring low-intent dataLayer events.
 */

import {
  HANDOFF_SOURCE_ROUTE_KEY,
  pushLowIntentEvent,
} from "@/lib/tracking/dataLayer";
import { handoffToCanonicalUpload, openFirstQuoteIntake } from "./landingHandoff";

export const WINDOWMAN_ANALYZE_QUOTE_EVENT = "wm-landing-open-analyze-quote";

export function trackAndHandoffToCanonicalUpload(ctaSource: string): void {
  let handledInline = false;

  if (typeof window !== "undefined") {
    const event = new CustomEvent(WINDOWMAN_ANALYZE_QUOTE_EVENT, {
      cancelable: true,
      detail: { ctaSource },
    });
    handledInline = !window.dispatchEvent(event);
  }

  pushLowIntentEvent("windowman_handoff_has_quote", {
    page_path: "/windowman",
    destination_path: handledInline ? "/windowman" : "/",
    destination_hash: handledInline ? "#windowman-upload" : "#truth-gate",
    wm_intent: "has_quote",
    cta_source: ctaSource,
  });

  if (handledInline) return;

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
