/**
 * PartialUnlockOverlay — centered lock card sitting over blurred Top Findings.
 * Decorative — actual gating is server-side via OTP.
 */
import { Lock } from "lucide-react";

interface Props {
  message?: string;
}

export default function PartialUnlockOverlay({
  message = "Complete verification to unlock your full forensic analysis",
}: Props) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div
        className="pointer-events-auto rounded-2xl px-7 py-6 max-w-sm text-center bg-slate-900/80 border border-slate-700/60 shadow-2xl"
        style={{ backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}
      >
        <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 bg-blue-500/15 border border-blue-500/40">
          <Lock size={20} className="text-blue-400" />
        </div>
        <p className="text-[10px] font-mono tracking-widest text-blue-400 mb-2">
          LOCKED · VERIFICATION REQUIRED
        </p>
        <p className="text-sm font-semibold text-white leading-snug">
          {message}
        </p>
      </div>
    </div>
  );
}
