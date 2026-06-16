import { useEffect, useRef, useState } from "react";

/**
 * Tiny IntersectionObserver reveal hook for the /nextdoor visual sprint.
 *
 * - Reveals once, then disconnects (no continuous loops).
 * - Reduced-motion users and environments without IntersectionObserver
 *   are revealed immediately (no opacity/transform gate).
 * - Visual-only: no data, no tracking, no backend.
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(options?: {
  rootMargin?: string;
  threshold?: number;
}): { ref: React.RefObject<T>; revealed: boolean } {
  const ref = useRef<T>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      setRevealed(true);
      return;
    }

    const prefersReduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReduced || typeof IntersectionObserver === "undefined") {
      setRevealed(true);
      return;
    }

    const node = ref.current;
    if (!node) {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.disconnect();
            break;
          }
        }
      },
      {
        rootMargin: options?.rootMargin ?? "0px 0px -10% 0px",
        threshold: options?.threshold ?? 0.12,
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [options?.rootMargin, options?.threshold]);

  return { ref, revealed };
}
