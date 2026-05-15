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
        <div className="inline-flex items-center gap-2 mb-3 px-2.5 py-1 rounded-full border border-[hsl(var(--fr-danger)/0.35)] bg-[hsl(var(--fr-danger)/0.08)]">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[hsl(var(--fr-danger))] shadow-[0_0_10px_hsl(var(--fr-danger)/0.8)]" />
          <span className="fr-mono text-[10px] font-bold tracking-[0.18em] text-[hsl(var(--fr-danger))]">
            FORENSIC AUDIT · PREVIEW LOCKED
          </span>
        </div>

        {/* Heading + subtitle */}
        <h1 className="text-2xl sm:text-3xl md:text-[2.5rem] font-extrabold tracking-tight text-white leading-[1.1]">
          Unlock Your Forensic Audit
        </h1>
        <p className="mt-3 text-sm sm:text-base text-slate-300/90 leading-relaxed max-w-2xl">
          WindowMan reviewed your quote like a private forensic second opinion.
          Here's the preview of what we found before you sign.
        </p>

        {/* Grade + tiles row */}
        <div className="mt-7 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-7 md:gap-8 items-center">
          {/* Grade with red glow */}
          <div className="flex flex-col items-center md:items-start gap-2">
            <div
              className="rounded-full p-1.5 ring-1 ring-[hsl(var(--fr-danger)/0.35)]"
              style={{
                background:
                  "radial-gradient(circle, hsl(var(--fr-danger) / 0.38) 0%, hsl(var(--fr-danger) / 0.08) 55%, transparent 75%)",
              }}
            >
              <GradeDial grade={grade} />
            </div>
            <span className="fr-mono text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">
              Audit Verdict · Quote Grade
            </span>
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
          className="mt-8 relative rounded-2xl p-5 sm:p-7 text-center"
          style={{
            background: "hsl(var(--fr-bg) / 0.75)",
            border: "1px solid hsl(var(--fr-border) / 0.9)",
            boxShadow: "inset 0 1px 0 hsl(0 0% 100% / 0.04), 0 8px 28px -16px hsl(220 60% 2% / 0.6)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <div
            className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full"
            style={{
              background: "hsl(var(--fr-cyan) / 0.14)",
              border: "1px solid hsl(var(--fr-cyan) / 0.45)",
              boxShadow: "0 0 24px -6px hsl(var(--fr-cyan) / 0.35)",
            }}
          >
            <Lock size={18} className="text-[hsl(var(--fr-cyan-soft))]" />
          </div>
          <p className="fr-mono text-[10px] font-bold tracking-[0.2em] text-[hsl(var(--fr-cyan-soft))] mb-2">
            SCAN COMPLETE · CASE FILE READY
          </p>
          <h2 className="text-lg sm:text-xl font-bold text-white leading-snug mb-2">
            Unlock Your Private Truth Report
          </h2>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl mx-auto">
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
            . Verify your phone to unlock the full forensic audit.
          </p>
          {overpaymentBasis && (
            <p className="mt-3 text-[11px] text-slate-500 leading-snug max-w-md mx-auto">
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

  const railVar =
    variant === "critical"
      ? "--fr-danger"
      : variant === "warning"
        ? "--fr-caution"
        : "--fr-cyan-soft";

  return (
    <div className={`fr-tile fr-tile--${variant} text-center relative overflow-hidden pt-4`}>
      <div
        aria-hidden
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, transparent 0%, hsl(var(${railVar})) 50%, transparent 100%)`,
        }}
      />
      <div className={`flex items-center justify-center gap-1.5 ${colorClass}`}>
        {icon}
        <span className="font-mono text-2xl sm:text-3xl font-extrabold leading-none tracking-tight">
          {value}
        </span>
      </div>
      <div className="mt-2 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400 leading-tight">
        {label}
      </div>
    </div>
  );
}
