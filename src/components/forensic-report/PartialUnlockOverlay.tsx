/**
 * PartialUnlockOverlay — centered lock card sitting over blurred Top Findings.
 * Decorative — actual gating is server-side via OTP.
 */
import { Lock } from "lucide-react";

interface Props {
  message?: string;
}

export default function PartialUnlockOverlay({
  message = "Verify your phone number to unlock what was found, why it matters, and the exact questions to ask before signing.",
}: Props) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4">
      <div
        className="pointer-events-auto rounded-2xl px-6 sm:px-8 py-6 sm:py-7 max-w-sm w-full text-center bg-slate-900/75 border border-slate-700/70 ring-1 ring-blue-500/20 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]"
        style={{ backdropFilter: "blur(14px) saturate(140%)", WebkitBackdropFilter: "blur(14px) saturate(140%)" }}
      >
        <div
          className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4 bg-blue-500/15 border border-blue-500/40"
          style={{ boxShadow: "0 0 30px -6px hsl(217 91% 60% / 0.45)" }}
        >
          <span className="text-[26px] leading-none">🔒</span>
        </div>
        <p className="text-[10px] font-mono tracking-[0.22em] text-blue-300/90 mb-2">
          LOCKED · VERIFICATION REQUIRED
        </p>
        <p className="text-sm sm:text-base font-semibold text-white leading-snug">
          {message}
        </p>
      </div>
    </div>
  );
}
