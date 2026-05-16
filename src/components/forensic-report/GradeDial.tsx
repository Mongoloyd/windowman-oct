/**
 * GradeDial — translucent color-coded circle with the letter grade in solid color inside.
 */
interface Props {
  grade: string;
  size?: number;
}

function bandColor(grade: string): string {
  const g = (grade || "").toUpperCase().charAt(0);
  if (g === "A") return "16, 185, 129";   // emerald
  if (g === "B") return "132, 204, 22";   // lime
  if (g === "C") return "245, 158, 11";   // amber
  if (g === "D") return "239, 68, 68";    // red
  return "220, 38, 38";                   // F — deep red
}

export default function GradeDial({ grade, size = 96 }: Props) {
  const rgb = bandColor(grade);

  return (
    <div className="flex flex-col items-center">
      <div
        className="flex items-center justify-center rounded-full font-mono font-extrabold"
        style={{
          width: size,
          height: size,
          background: `rgba(${rgb}, 0.15)`,
          border: `1.5px solid rgba(${rgb}, 0.4)`,
          color: `rgb(${rgb})`,
          fontSize: size * 0.42,
          letterSpacing: "0.02em",
        }}
      >
        {grade}
      </div>
      <span className="mt-2 fr-mono text-[10px] text-[hsl(var(--fr-text-dim))]">Overall Grade</span>
    </div>
  );
}
