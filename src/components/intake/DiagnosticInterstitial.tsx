import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { INTERSTITIAL_LINES } from "./intakeCopy";

type DiagnosticInterstitialProps = {
  onComplete: () => void;
  /** Delay in ms before auto-advance. Default 2000. */
  delayMs?: number;
};

export function DiagnosticInterstitial({
  onComplete,
  delayMs = 2000,
}: DiagnosticInterstitialProps) {
  const [lineIndex, setLineIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const effectiveDelay = prefersReducedMotion ? Math.min(delayMs, 800) : delayMs;
    const lineInterval = prefersReducedMotion
      ? 0
      : Math.floor(effectiveDelay / INTERSTITIAL_LINES.length);

    let lineTimer: ReturnType<typeof setInterval> | undefined;
    if (lineInterval > 0) {
      lineTimer = setInterval(() => {
        setLineIndex((prev) =>
          prev < INTERSTITIAL_LINES.length - 1 ? prev + 1 : prev,
        );
      }, lineInterval);
    }

    const completeTimer = setTimeout(onComplete, effectiveDelay);

    return () => {
      if (lineTimer) clearInterval(lineTimer);
      clearTimeout(completeTimer);
    };
  }, [delayMs, onComplete, prefersReducedMotion]);

  const activeLine = INTERSTITIAL_LINES[lineIndex];

  return (
    <div
      className="flex flex-col items-center justify-center px-2 py-8 text-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative mb-6" aria-hidden>
        <div className="absolute inset-0 -m-4 rounded-full bg-cyan-500/10 blur-xl motion-safe:animate-pulse" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/25 bg-slate-900/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <FileText className="h-6 w-6 text-cyan-300/90" />
        </div>
        <div
          className="absolute -bottom-1 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent motion-safe:animate-pulse"
          style={prefersReducedMotion ? { animation: "none", opacity: 0.7 } : undefined}
        />
      </div>

      <div className="mb-5 h-1 w-full max-w-[200px] overflow-hidden rounded-full bg-slate-800/80">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-700 via-cyan-400 to-cyan-300 motion-safe:animate-pulse"
          style={{
            width: `${((lineIndex + 1) / INTERSTITIAL_LINES.length) * 100}%`,
            transition: prefersReducedMotion ? "none" : "width 0.4s ease-out",
          }}
        />
      </div>

      <p className="text-base font-medium text-cyan-100/95 md:text-lg">{activeLine}</p>
      <p className="mt-3 max-w-xs text-xs leading-relaxed text-slate-400">
        Assembling your protection file locally — no scan, pricing, or contractor match yet.
      </p>
    </div>
  );
}
