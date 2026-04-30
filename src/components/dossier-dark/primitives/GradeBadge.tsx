import { cn } from "@/lib/utils";

interface GradeBadgeProps {
  grade: string; // "A+", "A", "B", "C", "D", "D-", "F"
  className?: string;
}

function gradeBand(grade: string): "A" | "B" | "C" | "D" | "F" {
  const letter = grade.charAt(0).toUpperCase();
  if (letter === "A") return "A";
  if (letter === "B") return "B";
  if (letter === "C") return "C";
  if (letter === "D") return "D";
  return "F";
}

const bandStyles: Record<"A" | "B" | "C" | "D" | "F", string> = {
  A: "bg-gradient-to-br from-green-500 to-green-800 ring-4 ring-green-500/30",
  B: "bg-gradient-to-br from-blue-500 to-blue-800 ring-4 ring-blue-500/30",
  C: "bg-gradient-to-br from-amber-500 to-amber-800 ring-4 ring-amber-500/30",
  D: "bg-gradient-to-br from-red-600 to-red-900 ring-4 ring-red-500/30",
  F: "bg-gradient-to-br from-red-600 to-red-900 ring-4 ring-red-500/30",
};

export function GradeBadge({ grade, className }: GradeBadgeProps) {
  const band = gradeBand(grade);
  return (
    <div
      className={cn(
        "w-24 h-24 rounded-full flex items-center justify-center shrink-0",
        bandStyles[band],
        className,
      )}
      aria-label={`Grade ${grade}`}
    >
      <span
        className="text-3xl font-black text-white"
        style={{
          WebkitTextStroke: "0.5px rgba(0,0,0,0.6)",
          textShadow: "0 2px 4px rgba(0,0,0,0.5)",
          paintOrder: "stroke fill",
        }}
      >
        {grade}
      </span>
    </div>
  );
}
