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
        className="pointer-events-auto rounded-lg px-6 py-5 max-w-xs text-center"
        style={{
          background: "hsl(var(--fr-bg) / 0.92)",
          border: "1px solid hsl(var(--fr-border-strong))",
          boxShadow: "0 12px 40px hsl(0 0% 0% / 0.5)",
          backdropFilter: "blur(4px)",
        }}
      >
        <div
          className="mx-auto w-10 h-10 rounded-full flex items-center justify-center mb-3"
          style={{
            background: "hsl(var(--fr-cyan) / 0.12)",
            border: "1px solid hsl(var(--fr-cyan) / 0.4)",
          }}
        >
          <Lock size={18} className="text-[hsl(var(--fr-cyan))]" />
        </div>
        <p className="text-sm font-semibold text-[hsl(var(--fr-text))] leading-snug">
          {message}
        </p>
      </div>
    </div>
  );
}
