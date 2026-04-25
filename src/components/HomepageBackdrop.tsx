/* Animated gradient blobs — absolute-positioned, zigzag pattern, soft blending */

const blobs: Array<{
  top: string;
  left?: string;
  right?: string;
  color: string;
  animClass: string;
}> = [
  // ~0% — BLUE left
  { top: "0%", left: "-8%", color: "hsl(var(--primary) / 0.06)", animClass: "motion-safe:animate-blob-drift-1" },
  // ~10% — ORANGE right
  { top: "10%", right: "-6%", color: "hsl(var(--color-vivid-orange) / 0.045)", animClass: "motion-safe:animate-blob-drift-2" },
  // ~25% — ORANGE left
  { top: "25%", left: "-6%", color: "hsl(var(--color-vivid-orange) / 0.04)", animClass: "motion-safe:animate-blob-drift-3" },
  // ~40% — BLUE right
  { top: "40%", right: "-8%", color: "hsl(var(--primary) / 0.055)", animClass: "motion-safe:animate-blob-drift-4" },
  // ~55% — BLUE left
  { top: "55%", left: "-5%", color: "hsl(var(--primary) / 0.05)", animClass: "motion-safe:animate-blob-drift-1" },
  // ~65% — ORANGE right
  { top: "65%", right: "-5%", color: "hsl(var(--color-vivid-orange) / 0.04)", animClass: "motion-safe:animate-blob-drift-2" },
  // ~80% — ORANGE left
  { top: "80%", left: "-6%", color: "hsl(var(--color-vivid-orange) / 0.035)", animClass: "motion-safe:animate-blob-drift-3" },
  // ~90% — BLUE right
  { top: "90%", right: "-6%", color: "hsl(var(--primary) / 0.05)", animClass: "motion-safe:animate-blob-drift-4" },
];

const HomepageBackdrop = () => (
  <div
    className="absolute inset-0 z-0 pointer-events-none overflow-hidden contain-layout"
    style={{ minHeight: "100%" }}
    aria-hidden="true"
  >
    {blobs.map((b, i) => (
      <div
        key={i}
        className={`absolute ${b.animClass}`}
        style={{
          top: b.top,
          left: b.left,
          right: b.right,
          width: "clamp(400px, 50vw, 900px)",
          height: "clamp(500px, 35vh, 800px)",
          borderRadius: "50%",
          background: b.color,
          filter: "blur(160px)",
          willChange: "transform",
        }}
      />
    ))}
  </div>
);

export default HomepageBackdrop;
