import {
  NEXTDOOR_PAGE_BG,
  NEXTDOOR_PAGE_PATTERN,
  NEXTDOOR_VIGNETTE,
} from "@/components/nextdoor/nextdoorUi";

/**
 * Full-viewport ambient surface for /nextdoor.
 * Fixed so content scrolls over a continuous gradient + pattern (no hero box clip).
 */
export function NextdoorPageBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      aria-hidden="true"
    >
      {/* Base — soft blue desk with orange warmth at top-right and mid-page */}
      <div className="absolute inset-0" style={{ background: NEXTDOOR_PAGE_BG }} />

      {/* Ambient blue wash — upper-left trust anchor */}
      <div
        className="absolute -left-[10%] -top-[8%] h-[70%] w-[65%] opacity-80"
        style={{
          background:
            "radial-gradient(ellipse at 30% 25%, hsl(204 62% 88% / 0.35) 0%, transparent 68%)",
          filter: "blur(48px)",
        }}
      />

      {/* Ambient orange wash — upper-right + lower fold (desaturated) */}
      <div
        className="absolute -right-[8%] top-[2%] h-[55%] w-[50%] opacity-70"
        style={{
          background:
            "radial-gradient(ellipse at 70% 30%, hsl(28 48% 88% / 0.28) 0%, transparent 70%)",
          filter: "blur(52px)",
        }}
      />
      <div
        className="absolute bottom-[8%] left-[20%] h-[45%] w-[60%] opacity-60"
        style={{
          background:
            "radial-gradient(ellipse at 50% 70%, hsl(32 42% 90% / 0.22) 0%, transparent 72%)",
          filter: "blur(56px)",
        }}
      />

      {/* Very light page-wide pattern — no section mask, fades via opacity only */}
      <div
        className="absolute inset-0 opacity-[0.22]"
        style={NEXTDOOR_PAGE_PATTERN}
      />

      {/* Bottom depth vignette */}
      <div className="absolute inset-0" style={{ background: NEXTDOOR_VIGNETTE }} />
    </div>
  );
}
