import { NEXTDOOR_GRID_TEXTURE } from "@/components/nextdoor/nextdoorUi";

/** v1: hero only. Future: vault | market | proof for section-specific accents. */
export function QuoteScanFieldBackground({
  variant = "hero",
  className = "",
}: {
  variant?: "hero" | "vault" | "market" | "proof";
  className?: string;
}) {
  const isHero = variant === "hero";

  const evidenceTags = [
    { label: "SCOPE", className: "left-[5%] top-[20%]" },
    { label: "PERMITS", className: "left-[7%] top-[44%]" },
    { label: "WARRANTY", className: "right-[14%] top-[24%]" },
    { label: "PRICING", className: "right-[9%] bottom-[24%]" },
  ] as const;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-0 overflow-hidden ${className}`}
    >
      {/* Layer 1 — blue-white desk base */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(168deg, hsl(214 35% 95% / 0.92) 0%, hsl(216 38% 93% / 0.88) 45%, hsl(218 32% 94% / 0.90) 100%)",
        }}
      />

      {/* Layer 2 — blueprint grid */}
      <div
        className="absolute inset-0 opacity-[0.30]"
        style={{
          ...NEXTDOOR_GRID_TEXTURE,
          maskImage:
            "linear-gradient(to bottom, black 0%, black 85%, transparent 100%), linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, black 0%, black 85%, transparent 100%), linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
          maskComposite: "intersect",
          WebkitMaskComposite: "source-in",
        }}
      />

      {isHero ? (
        <>
          {/* Layer 3 — static diagonal scan beam */}
          <div
            className="absolute inset-0 hidden md:block"
            style={{
              background:
                "linear-gradient(115deg, transparent 38%, rgba(6, 182, 212, 0.07) 50%, transparent 62%)",
              filter: "blur(24px)",
            }}
          />

          {/* Layer 3 — data halo behind mascot / grade card */}
          <div
            className="absolute right-[-8%] top-[-4%] h-[80%] w-[52%] md:right-[-10%] md:top-[-5%] md:h-[85%] md:w-[55%]"
            style={{
              background:
                "radial-gradient(ellipse at 70% 40%, rgba(6, 182, 212, 0.09) 0%, transparent 70%)",
              filter: "blur(40px)",
            }}
          />

          {/* Layer 3 — evidence tags (desktop only) */}
          <div className="absolute inset-0 hidden sm:block">
            {evidenceTags.map(({ label, className: tagClassName }) => (
              <div
                key={label}
                aria-hidden="true"
                className={`pointer-events-none absolute font-mono text-[10px] font-semibold tracking-[0.14em] text-slate-500/10 ${tagClassName}`}
              >
                {label}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
