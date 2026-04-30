import { cn } from "@/lib/utils";

export type PillVariant = "critical" | "clear" | "warning" | "info";

const variantClasses: Record<PillVariant, string> = {
  critical: "bg-red-900/30 text-dossier-danger",
  clear: "bg-green-900/30 text-dossier-success",
  warning: "bg-amber-900/30 text-dossier-warning",
  info: "bg-blue-900/30 text-dossier-info",
};

interface StatusPillProps {
  variant: PillVariant;
  children: React.ReactNode;
  className?: string;
}

export function StatusPill({ variant, children, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-extrabold uppercase tracking-wide",
        variantClasses[variant],
        className,
      )}
      style={{
        WebkitTextStroke: "0.5px rgba(0,0,0,0.8)",
        textShadow: "0 1px 2px rgba(0,0,0,0.6)",
        paintOrder: "stroke fill",
      }}
    >
      {children}
    </span>
  );
}
