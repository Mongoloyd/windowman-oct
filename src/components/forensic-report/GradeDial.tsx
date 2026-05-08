/**
 * GradeDial — SVG circular grade indicator.
 * Color follows grade band; fully responsive.
 */
interface Props {
  grade: string;
  size?: number;
}

function bandColor(grade: string): string {
  const g = (grade || "").toUpperCase().charAt(0);
  if (g === "A") return "hsl(var(--fr-success))";
  if (g === "B") return "hsl(var(--fr-success))";
  if (g === "C") return "hsl(var(--fr-caution))";
  if (g === "D") return "hsl(var(--fr-danger))";
  return "hsl(var(--fr-danger))";
}

export default function GradeDial({ grade, size = 96 }: Props) {
  const color = bandColor(grade);
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // Arc length suggests "risk" — for D/F nearly full red ring; A small red.
  const g = (grade || "").toUpperCase().charAt(0);
  const fillPct = g === "A" ? 0.1 : g === "B" ? 0.3 : g === "C" ? 0.55 : g === "D" ? 0.8 : 0.95;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="hsl(var(--fr-border))"
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${c * fillPct} ${c}`}
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center font-mono font-extrabold"
          style={{ color, fontSize: size * 0.36, letterSpacing: "0.02em" }}
        >
          {grade}
        </div>
      </div>
      <span className="mt-2 fr-mono text-[10px] text-[hsl(var(--fr-text-dim))]">Overall Grade</span>
    </div>
  );
}
