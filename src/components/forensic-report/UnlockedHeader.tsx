/**
 * UnlockedHeader — premium "Case File Unlocked" header for full-reveal mode.
 * Pure presentation. No data fetching. No gating.
 */
import { ShieldCheck, Lock } from "lucide-react";
import { useMemo } from "react";
import { formatReportId } from "./tokens";

interface Props {
  analysisId: string | null | undefined;
  generatedAt?: Date;
  verifiedPhone?: string | null;
}

export default function UnlockedHeader({ analysisId, generatedAt, verifiedPhone }: Props) {
  const date = useMemo(() => generatedAt ?? new Date(), [generatedAt]);
  const dateStr = date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <header
      className="fr-card relative overflow-hidden p-5 sm:p-7"
      style={{ borderColor: "hsl(var(--fr-success) / 0.35)" }}
    >
      {/* emerald wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(120% 80% at 0% 0%, hsl(var(--fr-success) / 0.10), transparent 60%)",
        }}
      />
      <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase"
              style={{
                background: "hsl(var(--fr-success) / 0.14)",
                color: "hsl(var(--fr-success))",
                border: "1px solid hsl(var(--fr-success) / 0.4)",
              }}
            >
              <ShieldCheck size={12} />
              Identity Verified
            </span>
            <span
              className="hidden sm:inline-flex items-center gap-1 fr-mono text-[10px] font-bold px-2 py-1 rounded-md"
              style={{
                background: "hsl(var(--fr-cyan) / 0.08)",
                color: "hsl(var(--fr-cyan))",
                border: "1px solid hsl(var(--fr-cyan) / 0.35)",
              }}
            >
              <Lock size={10} />
              FORENSIC AUDIT
            </span>
          </div>
          <h1 className="text-2xl sm:text-[28px] font-extrabold text-[hsl(var(--fr-text))] tracking-tight leading-tight">
            Case File Unlocked
          </h1>
          <p className="mt-1 text-sm text-[hsl(var(--fr-text-muted))]">
            Your WindowMan Truth Report is ready. Review the verdict, the money at risk, and the next safest step.
          </p>
        </div>

        <div className="shrink-0 sm:text-right space-y-1.5">
          <div className="text-[10px] fr-mono uppercase tracking-wider text-[hsl(var(--fr-text-dim))]">
            Report ID
          </div>
          <div className="font-mono text-sm font-bold text-[hsl(var(--fr-text))]">
            {formatReportId(analysisId, date)}
          </div>
          <div className="text-[11px] text-[hsl(var(--fr-text-muted))]">
            Unlocked {dateStr}
          </div>
          {verifiedPhone && (
            <div className="text-[11px] text-[hsl(var(--fr-text-dim))] font-mono">
              {verifiedPhone}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
