/**
 * LazySection — Intersection Observer-based lazy loading wrapper.
 *
 * Facebook traffic is 85%+ mobile. This component:
 * 1. Only renders children when they enter the viewport
 * 2. Reduces initial DOM size and JS execution
 * 3. Shows a lightweight skeleton placeholder until loaded
 * 4. Uses rootMargin to pre-load before visible (smooth UX)
 *
 * Structural stability:
 * The wrapper <div> is rendered in BOTH the pre-visible and post-visible
 * states. Only the wrapper's children swap. This keeps the host node and
 * ref target stable across reveal, which prevents:
 *   - sibling reconciliation hiccups under shared <Suspense> boundaries
 *   - useInView({ once: true }) state loss on scroll-back
 *   - the "Function components cannot be given refs" warning
 *
 * Local Suspense boundary:
 * When children become visible, they are rendered inside a LOCAL
 * <Suspense> boundary scoped to this LazySection. This prevents one
 * pending lazy chunk from collapsing an entire shared parent Suspense
 * region into a single giant blank fallback.
 *
 * Usage:
 *   <LazySection height="400px">
 *     <HeavyComponent />
 *   </LazySection>
 */

import { Suspense, useRef, useState, useEffect, type ReactNode } from "react";

interface LazySectionProps {
  children: ReactNode;
  /** Minimum height for the placeholder to prevent layout shift */
  height?: string;
  /** CSS class for the placeholder */
  className?: string;
  /** How far before the viewport to start loading (default: 200px) */
  rootMargin?: string;
  /** Show a skeleton animation while loading */
  skeleton?: boolean;
}

export function LazySection({
  children,
  height = "200px",
  className = "",
  rootMargin = "200px",
  skeleton = true,
}: LazySectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Fallback for browsers without IntersectionObserver
    if (!("IntersectionObserver" in window)) {
      setIsVisible(true);
      return;
    }

    // Already visible at mount? (e.g., SSR hydration above the fold)
    if (isVisible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin, isVisible]);

  const placeholder = skeleton ? (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-6 w-48 rounded bg-slate-800/50" />
      <div className="h-4 w-full rounded bg-slate-800/30" />
      <div className="h-4 w-3/4 rounded bg-slate-800/30" />
      <div className="h-20 w-full rounded-lg bg-slate-800/20" />
    </div>
  ) : null;

  return (
    <div
      ref={ref}
      className={className}
      style={{ minHeight: height }}
      aria-hidden={isVisible ? undefined : true}
    >
      {isVisible ? (
        <Suspense fallback={placeholder}>{children}</Suspense>
      ) : (
        placeholder
      )}
    </div>
  );
}
