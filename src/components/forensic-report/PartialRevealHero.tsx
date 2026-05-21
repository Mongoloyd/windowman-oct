/**
 * PartialRevealHero — FOG layer of the forensic ritual.
 *
 * Pure presentation. No data fetch, no gating logic. Same prop signature as
 * before; visual hierarchy now leads with a dominant, frosted, grade-tinted
 * verdict plate ("the glass before it clears") and falls down to severity
 * counts, metric tiles, and a locked teaser pointing at the OTP gate.
 *
 * Rendered only when the orchestrator passes accessLevel === "preview".
 */
import { Lock, AlertOctagon, DollarSign, FileWarning } from "lucide-react";
import WindowManMark from "./WindowManMark";

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

type Band = {
  rgb: string;
  tone: "good" | "fair" | "poor" | "critical";
};

function gradeBand(grade: string): Band {
  const g = (grade || "").toUpperCase().charAt(0);
  if (g === "A") return { rgb: "16, 185, 129", tone: "good" };
  if (g === "B") return { rgb: "132, 204, 22", tone: "good" };
  if (g === "C") return { rgb: "245, 158, 11", tone: "fair" };
  if (g === "D") return { rgb: "239, 68, 68", tone: "poor" };
  return { rgb: "220, 38, 38", tone: "critical" };
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
  const band = gradeBand(grade);
  const totalIssues = flagRedCount + flagAmberCount;

  // "Missing Regulatory Items" = signals expected but not found (preserved from prior behavior)
  const missingRegulatory =
    signalsTotal != null && signalsExtracted != null
      ? Math.max(0, signalsTotal - signalsExtracted)
      : flagAmberCount;

  const overpayMid = midpoint(overpaymentLow, overpaymentHigh);

  return (
    <section
      className="relative fr-card overflow-hidden"
      aria-label="Forensic audit preview"
      style={{
        borderColor: `rgba(${band.rgb}, 0.45)`,
        boxShadow: `0 0 0 1px rgba(${band.rgb}, 0.15), 0 24px 70px -28px rgba(${band.rgb}, 0.35), 0 8px 32px -12px hsl(220 60% 2% / 0.7)`,
      }}
    >
      {/* Layer 1 — grade-tinted radial wash from the top */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(70% 60% at 50% 0%, rgba(${band.rgb}, 0.20) 0%, rgba(${band.rgb}, 0.05) 38%, transparent 72%)`,
        }}
      />

      {/* Layer 2 — frosted scan-line / condensation texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] mix-blend-overlay"
        style={{
          background:
            "repeating-linear-gradient(180deg, hsl(0 0% 100% / 0.04) 0px, hsl(0 0% 100% / 0.04) 1px, transparent 1px, transparent 3px)",
        }}
      />

      {/* Layer 3 — soft inner vignette to deepen the glass feel */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          boxShadow:
            "inset 0 1px 0 hsl(0 0% 100% / 0.05), inset 0 -80px 120px -60px hsl(220 60% 2% / 0.6)",
        }}
      />

      {/* WindowMan presence — corner watermark, no face, no motion */}
      <WindowManMark
        size={28}
        opacity={0.18}
        className="absolute top-4 right-4 sm:top-6 sm:right-6"
        style={{ color: `rgba(${band.rgb}, 1)` }}
      />

      <div className="relative p-6 sm:p-8 md:p-10">
        {/* Eyebrow — tinted to grade band */}
        <div
          className="inline-flex items-center gap-2 mb-3 px-2.5 py-1 rounded-full"
          style={{
            border: `1px solid rgba(${band.rgb}, 0.35)`,
            background: `rgba(${band.rgb}, 0.08)`,
          }}
        >
          <span
            className="inline-flex h-1.5 w-1.5 rounded-full"
            style={{
              background: `rgb(${band.rgb})`,
              boxShadow: `0 0 10px rgba(${band.rgb}, 0.8)`,
            }}
          />
          <span
            className="fr-mono text-[10px] font-bold tracking-[0.18em] uppercase"
            style={{ color: `rgb(${band.rgb})` }}
          >
            Forensic Audit · Preview Locked
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
        {totalIssues > 0 && (
          <p className="mt-2 text-sm sm:text-base text-slate-200 leading-relaxed">
            We found{" "}
            <span
              className="font-bold"
              style={{ color: `rgb(${band.rgb})` }}
            >
              {totalIssues}
            </span>{" "}
            {totalIssues === 1 ? "issue" : "issues"} with your estimate.
          </p>
        )}

        {/* Dominant grade plate — the focal point of the FOG layer */}
        <div className="mt-8 sm:mt-10 flex flex-col items-center text-center">
          <div
            className="relative flex items-center justify-center"
            style={{ width: "min(190px, 60vw)", height: "min(190px, 60vw)" }}
          >
            {/* Outer halo */}
            <div
              aria-hidden
              className="absolute -inset-3 rounded-full"
              style={{
                background: `radial-gradient(circle, rgba(${band.rgb}, 0.22) 0%, rgba(${band.rgb}, 0.08) 50%, transparent 75%)`,
                filter: "blur(10px)",
              }}
            />
            {/* Frosted plate */}
            <div
              className="relative flex items-center justify-center rounded-full"
              style={{
                width: "100%",
                height: "100%",
                background: `linear-gradient(180deg, rgba(${band.rgb}, 0.18) 0%, rgba(${band.rgb}, 0.08) 55%, hsl(var(--fr-surface) / 0.65) 100%)`,
                border: `1.5px solid rgba(${band.rgb}, 0.45)`,
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                boxShadow: `inset 0 1px 0 hsl(0 0% 100% / 0.08), inset 0 -2px 0 rgba(0,0,0,0.25), 0 12px 40px -10px rgba(${band.rgb}, 0.35)`,
              }}
            >
              <span
                className="font-mono font-extrabold leading-none text-[4.5rem] sm:text-[5.5rem] md:text-[6.25rem]"
                style={{
                  color: `rgb(${band.rgb})`,
                  letterSpacing: "0.02em",
                  textShadow: `0 0 28px rgba(${band.rgb}, 0.55)`,
                }}
                aria-label={`Quote grade ${grade}`}
              >
                {grade}
              </span>
            </div>
          </div>
          <div className="mt-4 fr-mono text-[11px] font-bold tracking-[0.22em] text-slate-200 uppercase">
            Audit Verdict · Quote Grade
          </div>

          {/* Inline severity summary */}
          {totalIssues > 0 && (
            <div className="mt-4 inline-flex items-center gap-3 text-sm font-medium text-slate-200">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    background: "hsl(var(--fr-danger))",
                    boxShadow: "0 0 8px hsl(var(--fr-danger) / 0.6)",
                  }}
                />
                <span className="tabular-nums">{flagRedCount}</span>{" "}
                <span className="text-slate-300">critical</span>
              </span>
              <span aria-hidden className="text-slate-600">·</span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    background: "hsl(var(--fr-caution))",
                    boxShadow: "0 0 8px hsl(var(--fr-caution) / 0.6)",
                  }}
                />
                <span className="tabular-nums">{flagAmberCount}</span>{" "}
                <span className="text-slate-300">warnings</span>
              </span>
            </div>
          )}
        </div>

        {/* Metric tiles — frosted, secondary to the grade */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
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

        {/* Locked teaser block — points at the OTP gate */}
        <div
          className="mt-8 relative rounded-2xl p-5 sm:p-7 text-center overflow-hidden"
          style={{
            background: "hsl(var(--fr-bg) / 0.78)",
            border: "1px solid hsl(var(--fr-border) / 0.9)",
            boxShadow:
              "inset 0 1px 0 hsl(0 0% 100% / 0.05), 0 8px 28px -16px hsl(220 60% 2% / 0.6)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          {/* Frosted underlay — subtle grade tint on the locked block */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(80% 60% at 50% 0%, rgba(${band.rgb}, 0.10) 0%, transparent 60%)`,
            }}
          />

          <div className="relative">
            <div
              className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
              style={{
                background: "hsl(var(--fr-cyan) / 0.14)",
                border: "1px solid hsl(var(--fr-cyan) / 0.45)",
                boxShadow: "0 0 24px -6px hsl(var(--fr-cyan) / 0.35)",
                color: "hsl(var(--fr-cyan-soft))",
              }}
            >
              <Lock size={20} strokeWidth={2.25} />
            </div>
            <p className="fr-mono text-[10px] font-bold tracking-[0.2em] text-[hsl(var(--fr-cyan-soft))] mb-2 uppercase">
              Scan Complete · Case File Created
            </p>
            <h2 className="text-lg sm:text-xl font-bold text-white leading-snug mb-2">
              Unlock Your Private Truth Report
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl mx-auto">
              Your quote received a{" "}
              <span
                className="font-bold"
                style={{ color: `rgb(${band.rgb})` }}
              >
                {grade}
              </span>
              . We detected{" "}
              <span
                className="font-bold"
                style={{ color: `rgb(${band.rgb})` }}
              >
                {missingRegulatory} missing regulatory line item
                {missingRegulatory === 1 ? "" : "s"}
              </span>{" "}
              and a potential overcharge of{" "}
              <span className="font-bold text-[hsl(var(--fr-caution))]">
                {overpayMid != null ? fmtMoney(overpayMid) : "—"}
              </span>
              . Verify your phone to access your full Forensic Audit.
            </p>
            {overpaymentBasis && (
              <p className="mt-3 text-[11px] leading-snug max-w-md mx-auto text-slate-400">
                {overpaymentBasis}
              </p>
            )}
          </div>
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
    <div
      className={`fr-tile fr-tile--${variant} text-center relative overflow-hidden pt-4`}
      style={{
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <div
        aria-hidden
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, transparent 0%, hsl(var(${railVar})) 50%, transparent 100%)`,
        }}
      />
      <div className={`flex items-center justify-center gap-1.5 ${colorClass}`}>
        {icon}
        <span className="font-mono text-2xl sm:text-3xl font-extrabold leading-none tracking-tight tabular-nums">
          {value}
        </span>
      </div>
      <div className="mt-2 text-[10px] sm:text-[11px] uppercase tracking-wider leading-tight text-slate-300 font-semibold">
        {label}
      </div>
    </div>
  );
}
