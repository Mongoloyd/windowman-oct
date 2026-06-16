import type { ReactNode } from "react";
import { useScrollReveal } from "@/lib/nextdoor/useScrollReveal";

type Props = {
  children: ReactNode;
  className?: string;
  /** Stagger delay in ms (kept small; ignored for reduced motion). */
  delayMs?: number;
  /** Optional id passthrough for anchor targets. */
  id?: string;
  ariaLabelledby?: string;
};

/**
 * Wraps section content in a subtle scroll-reveal (fade + slide-up).
 * Reduced-motion users see content immediately with no transform.
 * Presentational only — no data, no tracking.
 */
export function NextdoorReveal({
  children,
  className,
  delayMs = 0,
  id,
  ariaLabelledby,
}: Props) {
  const { ref, revealed } = useScrollReveal<HTMLDivElement>();

  return (
    <div
      ref={ref}
      id={id}
      aria-labelledby={ariaLabelledby}
      className={[
        "transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none",
        revealed
          ? "translate-y-0 opacity-100"
          : "translate-y-4 opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100",
        className ?? "",
      ].join(" ")}
      style={revealed && delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}
