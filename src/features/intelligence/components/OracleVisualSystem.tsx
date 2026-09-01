import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const ORACLE_VISUAL_TOKENS = {
  panel:
    "rounded-2xl border border-slate-200 bg-white shadow-[0_1px_0_rgba(255,255,255,0.95)_inset,0_12px_30px_rgba(15,23,42,0.06),0_2px_5px_rgba(15,23,42,0.04)]",
  panelDark:
    "rounded-2xl border border-white/15 bg-[#0D2444] shadow-[0_22px_46px_-28px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.10)]",
  metricValue: "font-mono font-black tabular-nums tracking-tight",
  focusRing:
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A92F9] focus-visible:ring-offset-2",
  control:
    "min-h-11 rounded-lg border border-slate-300 bg-white shadow-[inset_0_1px_1px_rgba(15,23,42,0.03),0_1px_2px_rgba(15,23,42,0.05)]",
} as const;

type OracleStatusTone =
  | "synthetic"
  | "legacy"
  | "loading"
  | "error"
  | "empty"
  | "insufficient"
  | "suppressed"
  | "success";

const TONE_CLASSES: Record<OracleStatusTone, string> = {
  synthetic: "border-slate-300 bg-slate-100 text-slate-950",
  legacy: "border-blue-200 bg-blue-50 text-blue-950",
  loading: "border-blue-200 bg-blue-50 text-blue-950",
  error: "border-rose-200 bg-rose-50 text-rose-950",
  empty: "border-blue-200 bg-blue-50 text-blue-950",
  insufficient: "border-amber-300 bg-amber-50 text-amber-950",
  suppressed: "border-slate-300 bg-slate-100 text-slate-950",
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
};

export function OracleStatusRail({
  title,
  detail,
  icon,
  tone = "synthetic",
  compact = false,
  className,
  testId,
}: {
  title: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  tone?: OracleStatusTone;
  compact?: boolean;
  className?: string;
  testId?: string;
}) {
  return (
    <div
      role="status"
      data-testid={testId}
      className={cn(
        "flex border shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_5px_16px_rgba(15,23,42,0.045)]",
        compact
          ? "min-h-9 items-center justify-center gap-2 rounded-lg px-3 py-2 text-center"
          : "flex-col gap-1 rounded-xl px-4 py-3 sm:flex-row sm:items-center sm:gap-3",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <span className="flex items-center gap-2 font-mono text-[11px] font-black uppercase tracking-[0.1em]">
        {icon}
        {title}
      </span>
      {detail ? (
        <span
          className={cn(
            "text-xs font-medium leading-5 opacity-75",
            !compact && "sm:border-l sm:border-current/20 sm:pl-3",
          )}
        >
          {detail}
        </span>
      ) : null}
    </div>
  );
}
