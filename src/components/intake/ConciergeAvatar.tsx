import { cn } from "@/lib/utils";

type ConciergeAvatarProps = {
  /** Diameter in Tailwind sizing; defaults to a header-friendly size. */
  className?: string;
  /** Adds a soft pulsing presence ring (disabled under reduced motion). */
  active?: boolean;
};

/**
 * WindowMan Concierge mark — an abstract four-pane impact window, built with
 * pure CSS/Tailwind. No external image asset, no face, no mascot. Decorative.
 */
export function ConciergeAvatar({ className, active = false }: ConciergeAvatarProps) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-xl",
        "border border-cyan-400/40 bg-gradient-to-b from-[#0e2034] to-[#081320]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_18px_-8px_rgba(34,211,238,0.6)]",
        "h-11 w-11",
        className,
      )}
      aria-hidden
    >
      {active && (
        <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-cyan-400/30 motion-safe:animate-pulse" />
      )}
      {/* Four-pane mullion grid */}
      <span className="grid h-5 w-5 grid-cols-2 grid-rows-2 gap-[2px]">
        {[0, 1, 2, 3].map((pane) => (
          <span
            key={pane}
            className="rounded-[2px] bg-gradient-to-br from-cyan-300/85 to-cyan-500/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
          />
        ))}
      </span>
    </span>
  );
}
