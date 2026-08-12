import { useEffect, useRef, useState } from "react";

/**
 * Drives the decorative illumination layer on the NQ3/NQ4 landing pages.
 *
 * The architecture is stationary; only the light moves. This hook is the single source
 * of that movement and it does three things:
 *
 * 1. Writes `--lit-x` / `--lit-y` (viewport fractions, 0-1) so a CSS light pool can be
 *    positioned by `translate3d`.
 * 2. Optionally writes a named 0-1 document scroll progress property.
 * 3. Toggles `data-lit` on section elements **live** as they enter and leave the active
 *    band. This is deliberately not a reveal-once latch: the observer stays connected
 *    for the lifetime of the page so sections wake on the way down and settle again on
 *    the way back up.
 *
 * Performance contract:
 * - Exactly one listener per driver, all passive, all coalesced into one
 *   `requestAnimationFrame` write per frame.
 * - No animation frame is ever scheduled while the page is idle.
 * - Properties are written to the ref'd element rather than the document root, which is
 *   what contains style invalidation. Mount the hook on the closest common ancestor of
 *   the layers that consume the properties, not on the outermost wrapper.
 *   Note the properties must stay *unregistered* (inheriting): the consuming layers are
 *   pseudo-elements, and a non-inherited custom property never reaches a pseudo-element,
 *   so `@property { inherits: false }` would silently freeze the light.
 *
 * Accessibility contract:
 * - Under `prefers-reduced-motion: reduce` the hook attaches nothing and writes
 *   nothing, so the stylesheets render a single static resting state.
 * - Without fine hover (touch devices) the pointer driver falls back to the scroll
 *   driver, because there is no cursor to follow.
 *
 * This layer is decorative only: no data, no tracking, no backend, no measurement.
 */

export type CampaignNqIlluminationDriver = "pointer" | "scroll";

export type CampaignNqIlluminationOptions = {
  /**
   * `"pointer"` follows the cursor. `"scroll"` sweeps the light with document progress.
   * `"pointer"` degrades to `"scroll"` when the device has no fine hover.
   */
  driver: CampaignNqIlluminationDriver;
  /** Selector, resolved within the ref'd element, for sections that wake as they pass through. */
  sectionSelector: string;
  /** Custom property that receives clamped 0-1 document scroll progress. */
  progressProperty?: string;
  /**
   * `rootMargin` defining the active band. The default insets the viewport to its
   * middle 30% so a section lights while it holds the reader's attention rather than
   * the moment one pixel of it appears.
   */
  activeBandMargin?: string;
};

const DEFAULT_ACTIVE_BAND_MARGIN = "-35% 0px -35% 0px";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const FINE_HOVER_QUERY = "(hover: hover) and (pointer: fine)";

function matches(query: string): boolean {
  return window.matchMedia?.(query).matches ?? false;
}

/** Clamped document scroll progress. Returns 0 when the page is too short to scroll. */
function readScrollProgress(): number {
  const travel = document.documentElement.scrollHeight - window.innerHeight;
  if (travel <= 0) return 0;
  return Math.min(1, Math.max(0, window.scrollY / travel));
}

export function useCampaignNqIllumination<T extends HTMLElement = HTMLDivElement>({
  driver,
  sectionSelector,
  progressProperty,
  activeBandMargin = DEFAULT_ACTIVE_BAND_MARGIN,
}: CampaignNqIlluminationOptions) {
  const ref = useRef<T>(null);
  // Bumped when a relevant media query flips so the driver is rebuilt for the new mode.
  const [mediaEpoch, setMediaEpoch] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const queries = [
      window.matchMedia(REDUCED_MOTION_QUERY),
      window.matchMedia(FINE_HOVER_QUERY),
    ];
    const onChange = () => setMediaEpoch((epoch) => epoch + 1);
    for (const query of queries) query.addEventListener("change", onChange);
    return () => {
      for (const query of queries) query.removeEventListener("change", onChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = ref.current;
    if (!root) return;

    // Reduced motion opts out of movement entirely; the stylesheets hold a static state.
    if (matches(REDUCED_MOTION_QUERY)) return;

    const teardown: Array<() => void> = [];

    if (typeof IntersectionObserver !== "undefined") {
      const sections = Array.from(root.querySelectorAll<HTMLElement>(sectionSelector));
      if (sections.length > 0) {
        const observer = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              const section = entry.target as HTMLElement;
              // Live, not latched: set on entry and clear on exit.
              if (entry.isIntersecting) section.dataset.lit = "on";
              else delete section.dataset.lit;
            }
          },
          { rootMargin: activeBandMargin, threshold: 0 },
        );
        for (const section of sections) observer.observe(section);
        teardown.push(() => {
          observer.disconnect();
          for (const section of sections) delete section.dataset.lit;
        });
      }
    }

    let frame = 0;
    let dirty = false;
    let nextX = 0.5;
    let nextY = -0.5;
    let nextProgress = 0;

    const flush = () => {
      frame = 0;
      if (!dirty) return;
      dirty = false;
      root.style.setProperty("--lit-x", nextX.toFixed(4));
      root.style.setProperty("--lit-y", nextY.toFixed(4));
      if (progressProperty) root.style.setProperty(progressProperty, nextProgress.toFixed(4));
    };

    // Only ever scheduled from a real event, so an idle page schedules no frames.
    const schedule = () => {
      dirty = true;
      if (!frame) frame = window.requestAnimationFrame(flush);
    };

    if (driver === "pointer" && matches(FINE_HOVER_QUERY)) {
      const onPointerMove = (event: PointerEvent) => {
        nextX = event.clientX / window.innerWidth;
        nextY = event.clientY / window.innerHeight;
        schedule();
      };
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      teardown.push(() => window.removeEventListener("pointermove", onPointerMove));
    } else {
      const readScrollDrivenLight = () => {
        nextProgress = readScrollProgress();
        // The light stays centred horizontally and rides scroll progress vertically,
        // so a pointer-designed pool keeps working with no cursor present.
        nextX = 0.5;
        nextY = nextProgress;
      };

      // Paint the entry state synchronously: the page may load already scrolled.
      readScrollDrivenLight();
      dirty = true;
      flush();

      const onScroll = () => {
        readScrollDrivenLight();
        schedule();
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
      teardown.push(() => {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
      });
    }

    teardown.push(() => {
      if (frame) window.cancelAnimationFrame(frame);
      root.style.removeProperty("--lit-x");
      root.style.removeProperty("--lit-y");
      if (progressProperty) root.style.removeProperty(progressProperty);
    });

    return () => {
      for (const dispose of teardown.reverse()) dispose();
    };
  }, [driver, sectionSelector, progressProperty, activeBandMargin, mediaEpoch]);

  return ref;
}
