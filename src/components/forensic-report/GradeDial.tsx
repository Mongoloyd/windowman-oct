/**
 * GradeDial — solid color-coded circle with the letter grade inside.
 * Color follows grade band; bright, high-contrast.
 */
interface Props {
  grade: string;
  size?: number;
}

function bandColor(grade: string): { bg: string; ring: string; glow: string } {
  const g = (grade || "").toUpperCase().charAt(0);
  if (g === "A") return { bg: "#10B981", ring: "#34D399", glow: "#10B981" }; // emerald
  if (g === "B") return { bg: "#84CC16", ring: "#A3E635", glow: "#84CC16" }; // lime
  if (g === "C") return { bg: "#F59E0B", ring: "#FBBF24", glow: "#F59E0B" }; // amber
  if (g === "D") return { bg: "#EF4444", ring: "#F87171", glow: "#EF4444" }; // red
  return { bg: "#B91C1C", ring: "#EF4444", glow: "#DC2626" }; // deep red (F)
}

export default function GradeDial({ grade, size = 96 }: Props) {
  const { bg, ring, glow } = bandColor(grade);

  return (
    <div className="flex flex-col items-center">
      <div
        className="flex items-center justify-center rounded-full font-mono font-extrabold text-white"
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle at 35% 30%, ${ring} 0%, ${bg} 60%, ${bg} 100%)`,
          boxShadow: `0 0 24px ${glow}99, inset 0 -6px 16px rgba(0,0,0,0.25), inset 0 2px 6px rgba(255,255,255,0.25)`,
          border: `2px solid ${ring}`,
          fontSize: size * 0.42,
          letterSpacing: "0.02em",
          textShadow: "0 2px 6px rgba(0,0,0,0.35)",
        }}
      >
        {grade}
      </div>
      <span className="mt-2 fr-mono text-[10px] text-[hsl(var(--fr-text-dim))]">Overall Grade</span>
    </div>
  );
}
