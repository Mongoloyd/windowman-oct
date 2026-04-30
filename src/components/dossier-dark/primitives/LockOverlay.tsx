import { Lock } from "lucide-react";

interface LockOverlayProps {
  message?: string;
}

export function LockOverlay({
  message = "Complete verification to unlock your full forensic analysis",
}: LockOverlayProps) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-xl z-10"
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-3 text-center px-6 max-w-sm">
        <div className="w-12 h-12 rounded-full bg-dossier-accent/20 border border-dossier-accent/40 flex items-center justify-center">
          <Lock className="w-6 h-6 text-dossier-accent" />
        </div>
        <p className="text-sm font-semibold text-white">{message}</p>
      </div>
    </div>
  );
}
