import { cn } from "@/lib/utils";

interface KeyValueRowProps {
  label: string;
  value: React.ReactNode;
  pill?: React.ReactNode;
  onEdit?: () => void;
  className?: string;
}

export function KeyValueRow({ label, value, pill, onEdit, className }: KeyValueRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-2 border-b border-dossier-border/60 last:border-b-0",
        className,
      )}
    >
      <span className="text-sm text-dossier-txt-secondary shrink-0">{label}</span>
      <div className="flex items-center gap-2 min-w-0 justify-end">
        <span className="font-mono text-sm text-dossier-txt-primary truncate">{value}</span>
        {pill}
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="text-xs text-dossier-accent hover:underline min-h-[44px] px-2"
          >
            [Edit]
          </button>
        )}
      </div>
    </div>
  );
}
