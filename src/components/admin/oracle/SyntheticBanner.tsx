import { AlertTriangle } from "lucide-react";
import { SYNTHETIC_DATA_BANNER } from "@/lib/windowOracle";

export function SyntheticBanner() {
  return (
    <div
      data-testid="oracle-synthetic-banner"
      className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950"
      role="status"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
      <span className="font-semibold tracking-wide">{SYNTHETIC_DATA_BANNER}</span>
      <span className="text-amber-900/80">
        Fixture-only — not connected to Supabase or production UX.
      </span>
    </div>
  );
}
