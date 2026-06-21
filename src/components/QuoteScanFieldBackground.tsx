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
      className={`pointer-events-none absolute inset-0 z-0 ${className}`}
    >
      {isHero ? (
        <>
          {/* Local forensic accents — page backdrop lives in NextdoorPageBackground */}
          <div
            className="absolute inset-0 hidden md:block"
            style={{
              background:
                "linear-gradient(115deg, transparent 38%, rgba(6, 182, 212, 0.06) 50%, transparent 62%)",
              filter: "blur(24px)",
            }}
          />

          <div
            className="absolute right-[-8%] top-[-4%] h-[80%] w-[52%] md:right-[-10%] md:top-[-5%] md:h-[85%] md:w-[55%]"
            style={{
              background:
                "radial-gradient(ellipse at 70% 40%, rgba(6, 182, 212, 0.08) 0%, transparent 70%)," +
                "radial-gradient(ellipse at 60% 55%, hsl(28 45% 88% / 0.12) 0%, transparent 65%)",
              filter: "blur(40px)",
            }}
          />

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
