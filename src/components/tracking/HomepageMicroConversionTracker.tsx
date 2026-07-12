import { useEffect } from "react";
import { pushLowIntentEvent } from "@/lib/tracking/dataLayer";

const ENGAGED_SESSION_MS = 30_000;
const SCROLL_THRESHOLDS = [25, 50, 75] as const;
const CTA_HOVER_MS = 2_000;

function isActiveForeground(): boolean {
  return document.visibilityState === "visible" && document.hasFocus();
}

function getScrollPercent(): number {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  if (scrollable <= 0) return 0;
  const raw = (window.scrollY / scrollable) * 100;
  return Math.min(100, Math.max(0, raw));
}

/**
 * Passive homepage micro-conversion tracker. Renders null; all signals route
 * through pushLowIntentEvent for vendor-neutral GTM consumption.
 */
export default function HomepageMicroConversionTracker() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const pagePath = window.location.pathname;

    let engagedFired = false;
    let accumulatedActiveMs = 0;
    let activeIntervalStart: number | null = null;
    let engagedTimer: ReturnType<typeof setInterval> | null = null;

    const scrollFired = new Set<number>();
    let scrollRafId: number | null = null;

    const formStartFired = new Set<string>();

    const ctaHoverFired = new Set<string>();
    let hoverTimer: ReturnType<typeof setTimeout> | null = null;
    let currentHoverCta: HTMLElement | null = null;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

    let engagedComplete = false;
    let scroll50Complete = false;
    let qpvFired = false;

    function maybeFireQpv() {
      if (qpvFired || !engagedComplete || !scroll50Complete) return;
      qpvFired = true;
      pushLowIntentEvent("quality_page_view", {
        page_path: pagePath,
        active_time_seconds: 30,
        scroll_percent: 50,
        qpv_definition: "30s_active_and_50_scroll",
        qpv_version: "v1",
      });
    }

    function fireEngagedSession() {
      if (engagedFired) return;
      engagedFired = true;
      engagedComplete = true;
      pushLowIntentEvent("engaged_session", {
        page_path: pagePath,
        active_time_seconds: 30,
        engagement_definition: "30s_active_foreground",
      });
      maybeFireQpv();
    }

    function stopEngagementTicker() {
      if (engagedTimer !== null) {
        clearInterval(engagedTimer);
        engagedTimer = null;
      }
    }

    function flushActiveTime() {
      if (activeIntervalStart !== null) {
        accumulatedActiveMs += Date.now() - activeIntervalStart;
        activeIntervalStart = null;
      }
    }

    function tickEngagement() {
      if (!isActiveForeground()) return;

      const now = Date.now();
      if (activeIntervalStart === null) {
        activeIntervalStart = now;
        return;
      }

      accumulatedActiveMs += now - activeIntervalStart;
      activeIntervalStart = now;

      if (accumulatedActiveMs >= ENGAGED_SESSION_MS) {
        fireEngagedSession();
        stopEngagementTicker();
      }
    }

    function startEngagementTicker() {
      if (engagedFired || engagedTimer !== null) return;
      if (isActiveForeground()) {
        activeIntervalStart = Date.now();
      }
      engagedTimer = setInterval(tickEngagement, 250);
    }

    function onFocusOrVisible() {
      if (engagedFired) return;
      if (isActiveForeground()) {
        if (activeIntervalStart === null) {
          activeIntervalStart = Date.now();
        }
        startEngagementTicker();
      }
    }

    function onBlurOrHidden() {
      if (engagedFired) return;
      flushActiveTime();
      stopEngagementTicker();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        onFocusOrVisible();
      } else {
        onBlurOrHidden();
      }
    }

    function checkScrollDepth() {
      scrollRafId = null;
      const percent = getScrollPercent();

      for (const threshold of SCROLL_THRESHOLDS) {
        if (percent >= threshold && !scrollFired.has(threshold)) {
          scrollFired.add(threshold);
          pushLowIntentEvent("scroll_depth", {
            page_path: pagePath,
            scroll_percent: threshold,
            scroll_unit: "percent",
          });
          if (threshold === 50) {
            scroll50Complete = true;
            maybeFireQpv();
          }
        }
      }
    }

    function onScroll() {
      if (scrollRafId !== null) return;
      scrollRafId = requestAnimationFrame(checkScrollDepth);
    }

    function onFocusIn(e: FocusEvent) {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

      const formId = target.getAttribute("data-wm-form-start");
      if (!formId || formStartFired.has(formId)) return;

      formStartFired.add(formId);
      pushLowIntentEvent("form_start", {
        page_path: pagePath,
        form_id: formId,
        form_step: target.getAttribute("data-wm-form-step") ?? "",
        field_name: target.getAttribute("data-wm-field-name") ?? "",
      });
    }

    function clearHoverTimer() {
      if (hoverTimer !== null) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
      }
      currentHoverCta = null;
    }

    function onPointerOver(e: PointerEvent) {
      if (!finePointer.matches) return;

      const el = (e.target as Element | null)?.closest?.('[data-wm-primary-cta="true"]');
      if (!(el instanceof HTMLElement)) return;

      // Bubbled pointerover from a child of the CTA that is already active must
      // not restart the timer. Only a transition to a *different* CTA proceeds.
      if (el === currentHoverCta) return;

      const ctaId = el.getAttribute("data-wm-cta-id");
      if (!ctaId || ctaHoverFired.has(ctaId)) return;

      clearHoverTimer();
      currentHoverCta = el;
      hoverTimer = setTimeout(() => {
        if (currentHoverCta !== el) return;
        if (ctaHoverFired.has(ctaId)) return;

        ctaHoverFired.add(ctaId);
        pushLowIntentEvent("cta_hover", {
          page_path: pagePath,
          cta_id: ctaId,
          cta_location: el.getAttribute("data-wm-cta-location") ?? "",
          hover_duration_ms: CTA_HOVER_MS,
        });
        clearHoverTimer();
      }, CTA_HOVER_MS);
    }

    function onPointerOut(e: PointerEvent) {
      if (!finePointer.matches) return;

      const activeCta = currentHoverCta;
      if (!activeCta) return;

      // Ignore pointerout events that did not originate inside the active CTA.
      const target = e.target;
      if (!(target instanceof Node) || !activeCta.contains(target)) return;

      // Movement between children inside the same CTA keeps relatedTarget within
      // the CTA boundary — preserve the timer in that case.
      const related = e.relatedTarget;
      if (related instanceof Node && activeCta.contains(related)) return;

      clearHoverTimer();
    }

    function onPointerDown(e: PointerEvent) {
      if (!finePointer.matches) return;

      const el = (e.target as Element | null)?.closest?.('[data-wm-primary-cta="true"]');
      if (el) clearHoverTimer();
    }

    window.addEventListener("focus", onFocusOrVisible);
    window.addEventListener("blur", onBlurOrHidden);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("focusin", onFocusIn, true);

    if (finePointer.matches) {
      document.addEventListener("pointerover", onPointerOver, true);
      document.addEventListener("pointerout", onPointerOut, true);
      document.addEventListener("pointerdown", onPointerDown, true);
    }

    startEngagementTicker();
    onScroll();

    return () => {
      stopEngagementTicker();
      flushActiveTime();

      if (scrollRafId !== null) {
        cancelAnimationFrame(scrollRafId);
      }
      clearHoverTimer();

      window.removeEventListener("focus", onFocusOrVisible);
      window.removeEventListener("blur", onBlurOrHidden);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("pointerover", onPointerOver, true);
      document.removeEventListener("pointerout", onPointerOut, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, []);

  return null;
}
