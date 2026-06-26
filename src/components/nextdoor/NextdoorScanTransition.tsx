import { useEffect, useMemo, useState } from "react";
import { FileSearch } from "lucide-react";
import {
  NEXTDOOR_GRID_TEXTURE,
  nextdoorProofEyebrowClass,
} from "@/components/nextdoor/nextdoorUi";

export type NextdoorScanTransitionProps = {
  fileName?: string;
  reducedMotion?: boolean;
};

const TRANSITION_STEPS = [
  "Quote received",
  "Reading scope and pricing",
  "Building your private preview",
  "Opening your preview",
] as const;

const STEP_INTERVAL_MS = 750;
const PROGRESS_TICK_MS = 80;

function safeDisplayFileName(fileName?: string): string | null {
  if (!fileName?.trim()) return null;
  const trimmed = fileName.trim();
  const base = trimmed.split(/[/\\]/).pop() ?? trimmed;
  if (base.length > 64) {
    return `${base.slice(0, 61)}…`;
  }
  return base;
}

export function NextdoorScanTransition({
  fileName,
  reducedMotion = false,
}: NextdoorScanTransitionProps) {
  const displayName = useMemo(() => safeDisplayFileName(fileName), [fileName]);
  const [activeStep, setActiveStep] = useState(0);
  const [progress, setProgress] = useState(reducedMotion ? 88 : 8);

  useEffect(() => {
    if (reducedMotion) {
      setActiveStep(TRANSITION_STEPS.length - 1);
      setProgress(92);
      return;
    }

    const stepTimer = window.setInterval(() => {
      setActiveStep((prev) => (prev + 1) % TRANSITION_STEPS.length);
    }, STEP_INTERVAL_MS);

    const progressTimer = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 94) return prev;
        return prev + 2 + Math.random() * 3;
      });
    }, PROGRESS_TICK_MS);

    return () => {
      window.clearInterval(stepTimer);
      window.clearInterval(progressTimer);
    };
  }, [reducedMotion]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Preparing your private preview"
    >
      <div className="absolute inset-0 bg-slate-950/72 backdrop-blur-sm" aria-hidden="true" />

      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[#06b6d4]/30 bg-gradient-to-br from-slate-950 via-slate-900 to-[#0b2436] p-6 shadow-[0_28px_70px_-24px_rgba(8,47,73,0.75),0_0_48px_-12px_rgba(6,182,212,0.35)] md:p-8"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.22]"
          style={NEXTDOOR_GRID_TEXTURE}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#06b6d4]/8 via-transparent to-amber-500/5"
          aria-hidden="true"
        />

        <div className="relative">
          <p className={nextdoorProofEyebrowClass}>Private quote review</p>
          <h2 className="mt-2 font-display text-xl font-extrabold leading-tight text-white md:text-2xl">
            Quote received — reading your file
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300/90">
            We&apos;re preparing your private preview. You&apos;ll review it next.
          </p>

          {displayName ? (
            <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-slate-700/80 bg-slate-900/70 px-3 py-2.5">
              <FileSearch className="h-4 w-4 shrink-0 text-[#5fd6ec]" aria-hidden="true" />
              <p className="truncate font-mono text-xs text-slate-300">{displayName}</p>
            </div>
          ) : null}

          <ul className="mt-6 space-y-2.5" aria-label="Scan progress steps">
            {TRANSITION_STEPS.map((step, index) => {
              const isComplete = index < activeStep;
              const isCurrent = index === activeStep;
              return (
                <li
                  key={step}
                  className={[
                    "flex items-center gap-3 rounded-lg border px-3 py-2.5 font-mono text-xs transition-colors duration-300",
                    isCurrent
                      ? "border-[#06b6d4]/45 bg-[#06b6d4]/10 text-[#a5f3fc]"
                      : isComplete
                        ? "border-emerald-500/25 bg-emerald-500/5 text-emerald-200/90"
                        : "border-slate-700/60 bg-slate-900/40 text-slate-500",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold",
                      isCurrent
                        ? "border-[#5fd6ec] text-[#5fd6ec]"
                        : isComplete
                          ? "border-emerald-400/60 text-emerald-300"
                          : "border-slate-600 text-slate-500",
                    ].join(" ")}
                    aria-hidden="true"
                  >
                    {isComplete ? "✓" : index + 1}
                  </span>
                  <span className={isCurrent ? "font-semibold" : undefined}>{step}</span>
                  {isCurrent && !reducedMotion ? (
                    <span
                      className="ml-auto inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#5fd6ec] motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">
              <span>Preparing your preview</span>
              <span className="text-[#5fd6ec]">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full border border-slate-700/80 bg-slate-900/80">
              <div
                className={[
                  "h-full rounded-full bg-gradient-to-r from-[#06b6d4] via-[#5fd6ec] to-amber-400/90",
                  reducedMotion ? "" : "transition-[width] duration-300 ease-out",
                ].join(" ")}
                style={{ width: `${Math.min(progress, 96)}%` }}
              />
            </div>
          </div>

          <p className="mt-5 text-center text-xs leading-relaxed text-slate-400">
            Full Truth Report details unlock after SMS verification on the next screen.
          </p>
        </div>
      </div>
    </div>
  );
}
