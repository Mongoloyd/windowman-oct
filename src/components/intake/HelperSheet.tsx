import { useEffect, useId, useRef } from "react";
import { HelpCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConciergeAvatar } from "./ConciergeAvatar";
import { CONCIERGE_NAME } from "./intakeCopy";
import { HELPER_TOPICS } from "./intakeHelpers";

type HelperSheetProps = {
  open: boolean;
  onClose: () => void;
  /** Optional topic id to scroll into view / emphasize when opened. */
  initialTopicId?: string | null;
};

/**
 * Read-only helper / info sheet. Bottom sheet on mobile, side card on desktop.
 * Never mutates IntakeFormState — purely informational. Closing returns the
 * user to the exact same intake step.
 */
export function HelperSheet({ open, onClose, initialTopicId }: HelperSheetProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !initialTopicId) return;
    const el = document.getElementById(`helper-topic-${initialTopicId}`);
    el?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [open, initialTopicId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-stretch sm:justify-end">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close help"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[#040a14]/70 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative flex max-h-[85dvh] w-full flex-col overflow-hidden border border-slate-400/25",
          "bg-gradient-to-b from-[#132238] to-[#0a1422] text-slate-100 shadow-2xl",
          "rounded-t-2xl sm:max-h-none sm:h-full sm:max-w-sm sm:rounded-none sm:rounded-l-2xl sm:border-l",
          "motion-safe:animate-in motion-safe:slide-in-from-bottom motion-safe:duration-300",
          "sm:motion-safe:slide-in-from-right",
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-600/35 p-5">
          <div className="flex items-center gap-3">
            <ConciergeAvatar className="h-9 w-9" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300/85">
                {CONCIERGE_NAME}
              </p>
              <h2 id={titleId} className="mt-0.5 flex items-center gap-1.5 text-base font-bold text-white">
                <HelpCircle className="h-4 w-4 text-cyan-300/80" aria-hidden />
                Good questions
              </h2>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-500/40 bg-slate-900/70 text-slate-300 transition-colors hover:border-slate-400/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
            aria-label="Close help"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          <ul className="flex flex-col gap-4">
            {HELPER_TOPICS.map((topic) => (
              <li
                key={topic.id}
                id={`helper-topic-${topic.id}`}
                className={cn(
                  "rounded-xl border border-slate-600/35 bg-[#152536]/80 p-4",
                  initialTopicId === topic.id && "ring-1 ring-cyan-400/40",
                )}
              >
                <h3 className="text-sm font-bold text-cyan-100">{topic.question}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{topic.answer}</p>
              </li>
            ))}
          </ul>
        </div>

        <footer className="border-t border-slate-600/35 p-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-slate-500/45 bg-slate-800/65 px-5 py-3 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-400/55 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
          >
            Back to setup
          </button>
        </footer>
      </div>
    </div>
  );
}
