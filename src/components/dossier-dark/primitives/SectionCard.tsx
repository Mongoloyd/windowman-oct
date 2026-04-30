import { cn } from "@/lib/utils";

interface SectionCardProps {
  eyebrow: string;
  title?: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  rightSlot?: React.ReactNode;
}

export function SectionCard({
  eyebrow,
  title,
  children,
  className,
  contentClassName,
  rightSlot,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "bg-dossier-elevated border border-dossier-border rounded-xl p-5 md:p-6",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-sm uppercase tracking-widest text-dossier-accent font-semibold">
            {eyebrow}
          </h2>
          {title && (
            <h3 className="mt-1 text-lg font-semibold text-dossier-txt-primary">
              {title}
            </h3>
          )}
        </div>
        {rightSlot}
      </header>
      <div className={cn("space-y-3", contentClassName)}>{children}</div>
    </section>
  );
}
