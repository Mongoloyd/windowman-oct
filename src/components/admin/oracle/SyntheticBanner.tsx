import { FlaskConical } from "lucide-react";
import { SYNTHETIC_DATA_BANNER } from "@/lib/windowOracle";
import { OracleStatusRail } from "@/features/intelligence/components/OracleVisualSystem";

export function SyntheticBanner() {
  return (
    <OracleStatusRail
      testId="oracle-synthetic-banner"
      tone="synthetic"
      icon={<FlaskConical className="h-4 w-4 shrink-0 text-[#356AC3]" aria-hidden />}
      title={SYNTHETIC_DATA_BANNER}
      detail="Local fixture evidence only · no Supabase or production market connection."
    />
  );
}
