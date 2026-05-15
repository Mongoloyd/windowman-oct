/**
 * PartialRevealHero — premium forensic teaser shown ONLY in preview/locked mode.
 *
 * Pure presentation. No data fetch, no gating logic. Receives the same numeric
 * props the ExecutiveSummaryCard does and re-presents them as a high-conversion
 * teaser: headline → grade → 3 metric tiles → locked teaser block.
 *
 * Full reveal continues to use ExecutiveSummaryCard. This component is only
 * rendered when `accessLevel === "preview"`.
 */
import { Lock, AlertOctagon, DollarSign, FileWarning } from "lucide-react";
import GradeDial from "./GradeDial";

interface Props {
  grade: string;
  flagRedCount: number;
  flagAmberCount: number;
  overpaymentLow?: number | null;
  overpaymentHigh?: number | null;
  overpaymentBasis?: string | null;
  signalsExtracted?: number | null;
  signalsTotal?: number | null;
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

function midpoint(a?: number | null, b?: number | null): number | null {
  if (a != null && b != null) return Math.round((a + b) / 2);
  return a ?? b ?? null;
}

export default function PartialRevealHero({
  grade,
  flagRedCount,
  flagAmberCount,
  overpaymentLow,
  overpaymentHigh,
  overpaymentBasis,
  signalsExtracted,
  signalsTotal,
}: Props) {
  // "Missing Regulatory Items" = signals expected but not found
  const missingRegulatory =
    signalsTotal != null && signalsExtracted != null
      ? Math.max(0, signalsTotal - signalsExtracted)
      : flagAmberCount;

  const overpayMid = midpoint(overpaymentLow, overpaymentHigh);

  return (
    <section
      className="relative fr-card overflow-hidden"
      style={{
        borderColor: "hsl(var(--fr-danger) / 0.45)",
        boxShadow:
          "0 0 0 1px hsl(var(--fr-danger) / 0.15), 0 24px 70px -28px hsl(var(--fr-danger) / 0.35), 0 8px 32px -12px hsl(220 60% 2% / 0.7)",
      }}
    >
      {/* Soft red glow wash, behind everything */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, hsl(var(--fr-danger) / 0.18) 0%, hsl(var(--fr-danger) / 0.04) 35%, transparent 70%)",
        }}
      />

      <div className="relative p-6 sm:p-8">
        {/* Eyebrow */}
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[hsl(var(--fr-danger))] shadow-[0_0_10px_hsl(var(--fr-danger)/0.8)]" />
          <span className="fr-mono text-[10px] font-bold text-[hsl(var(--fr-danger))]">
            FORENSIC AUDIT · PREVIEW LOCKED
          </span>
        </div>

        {/* Heading + subtitle */}
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight">
          Unlock Your Forensic Audit
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-400 leading-relaxed max-w-2xl">
          We've scanned your quote. Here's a preview of what we found —
          verify your phone below to unlock the full Truth Report.
        </p>

        {/* Grade + tiles row */}
        <div className="mt-7 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-7 md:gap-8 items-center">
          {/* Grade with red glow */}
          <div className="flex justify-center md:justify-start">
            <div
              className="rounded-full p-1"
              style={{
                background:
                  "radial-gradient(circle, hsl(var(--fr-danger) / 0.28) 0%, transparent 70%)",
              }}
            >
              <GradeDial grade={grade} />
            </div>
          </div>

          {/* Three metric tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <MetricTile
              variant="critical"
              icon={<AlertOctagon size={16} />}
              value={String(flagRedCount)}
              label="Critical Issues Detected"
            />
            <MetricTile
              variant="warning"
              icon={<DollarSign size={16} />}
              value={overpayMid != null ? fmtMoney(overpayMid) : "—"}
              label="Potential Overcharge"
            />
            <MetricTile
              variant="info"
              icon={<FileWarning size={16} />}
              value={String(missingRegulatory)}
              label="Missing Regulatory Items"
            />
          </div>
        </div>

        {/* Locked teaser block */}
        <div
          className="mt-7 relative rounded-2xl p-5 sm:p-6 text-center"
          style={{
            background: "hsl(var(--fr-bg) / 0.7)",
            border: "1px solid hsl(var(--fr-border) / 0.9)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }}
        >
          <div
            className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full"
            style={{
              background: "hsl(var(--fr-cyan) / 0.12)",
              border: "1px solid hsl(var(--fr-cyan) / 0.4)",
            }}
          >
            <Lock size={18} className="text-[hsl(var(--fr-cyan-soft))]" />
          </div>
          <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-xl mx-auto">
            Your quote received a{" "}
            <span className="font-bold text-[hsl(var(--fr-danger))]">{grade}</span>.
            We detected{" "}
            <span className="font-bold text-[hsl(var(--fr-danger))]">
              {missingRegulatory} missing regulatory line item
              {missingRegulatory === 1 ? "" : "s"}
            </span>{" "}
            and a potential overcharge of{" "}
            <span className="font-bold text-[hsl(var(--fr-caution))]">
              {overpayMid != null ? fmtMoney(overpayMid) : "—"}
            </span>
            . Verify your phone below to unlock the full Truth Report.
          </p>
          {overpaymentBasis && (
            <p className="mt-2 text-[11px] text-slate-500 leading-snug max-w-md mx-auto">
              {overpaymentBasis}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── Internal: metric tile primitive (uses .fr-tile foundation classes) ── */

function MetricTile({
  variant,
  icon,
  value,
  label,
}: {
  variant: "critical" | "warning" | "info";
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  const colorClass =
    variant === "critical"
      ? "text-[hsl(var(--fr-danger))]"
      : variant === "warning"
        ? "text-[hsl(var(--fr-caution))]"
        : "text-[hsl(var(--fr-cyan-soft))]";

  return (
    <div className={`fr-tile fr-tile--${variant} text-center`}>
      <div className={`flex items-center justify-center gap-1.5 ${colorClass}`}>
        {icon}
        <span className="font-mono text-xl sm:text-2xl font-extrabold leading-none">
          {value}
        </span>
      </div>
      <div className="mt-1.5 text-[11px] sm:text-xs font-medium text-slate-300 leading-tight">
        {label}
      </div>
    </div>
  );
}
