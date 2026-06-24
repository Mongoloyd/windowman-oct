import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type IntakeOptionCardProps = {
  label: string;
  selected: boolean;
  onSelect: () => void;
  className?: string;
  /** Tailwind ring color when selected, e.g. ring-cyan-400/55 */
  selectedRingClass?: string;
};

/**
 * Tactile switchgear response control. Reads like a physical toggle that locks
 * in when selected — raised default, hover lift, mechanical press, cyan
 * lock-ring on select. No radio dots.
 */
export function IntakeOptionCard({
  label,
  selected,
  onSelect,
  className,
  selectedRingClass = "ring-cyan-400/55",
}: IntakeOptionCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group relative w-full rounded-xl border px-4 py-4 text-left",
        "transition-[transform,box-shadow,border-color,background-color] duration-150 ease-out motion-reduce:transition-none",
        "min-h-[3.75rem] touch-manipulation",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1628]",
        "active:translate-y-px active:scale-[0.985]",
        selected
          ? [
              "border-cyan-400/65 bg-gradient-to-b from-slate-700/90 to-slate-900/95",
              "shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_0_0_1px_rgba(34,211,238,0.32),0_10px_30px_-16px_rgba(34,211,238,0.5)]",
              "ring-2",
              selectedRingClass,
            ]
          : [
              "border-slate-400/45 bg-gradient-to-b from-slate-700/75 to-slate-800/90",
              "shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_6px_16px_-8px_rgba(0,0,0,0.5)]",
              "hover:-translate-y-0.5 hover:border-slate-300/55 hover:from-slate-600/80 hover:to-slate-700/90",
              "hover:shadow-[0_1px_0_rgba(255,255,255,0.1)_inset,0_12px_28px_-12px_rgba(0,0,0,0.6)]",
            ],
        className,
      )}
    >
      <span className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "text-[15px] font-semibold leading-snug sm:text-base",
            selected ? "text-white" : "text-slate-100",
          )}
        >
          {label}
        </span>

        {/* Switchgear toggle indicator — locks to the right when selected */}
        <span
          className={cn(
            "relative flex h-7 w-12 shrink-0 items-center rounded-full border px-0.5 transition-colors duration-150",
            selected
              ? "border-cyan-300/70 bg-cyan-500/30 shadow-[inset_0_0_10px_-2px_rgba(34,211,238,0.7)]"
              : "border-slate-500/55 bg-slate-900/80 group-hover:border-slate-400/70",
          )}
          aria-hidden
        >
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full transition-transform duration-150 ease-out motion-reduce:transition-none",
              "shadow-[0_1px_2px_rgba(0,0,0,0.5)]",
              selected
                ? "translate-x-5 bg-gradient-to-b from-white to-cyan-100 text-cyan-700"
                : "translate-x-0 bg-gradient-to-b from-slate-300 to-slate-500 text-transparent",
            )}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
        </span>
      </span>
    </button>
  );
}
