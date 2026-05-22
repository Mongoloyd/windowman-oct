/**
 * ForensicLabSectionDivider — visual rhythm between lab evidence modules.
 * Pure presentation; no data dependencies.
 */
interface ForensicLabSectionDividerProps {
  eyebrow?: string;
  label?: string;
  index?: number;
}

export default function ForensicLabSectionDivider({
  eyebrow = "Evidence Module",
  label,
  index,
}: ForensicLabSectionDividerProps) {
  const indexLabel =
    typeof index === "number" && Number.isFinite(index)
      ? String(index).padStart(2, "0")
      : null;

  return (
    <div
      role="separator"
      aria-label={label ?? eyebrow}
      className="relative my-8 sm:my-10"
    >
      <div
        className="absolute inset-0 flex items-center"
        aria-hidden
      >
        <div className="w-full border-t border-[hsl(var(--fr-border))]" />
      </div>
      <div className="relative flex justify-center">
        <div
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 sm:px-4 backdrop-blur-sm"
          style={{
            borderColor: "hsl(var(--fr-cyan) / 0.28)",
            background:
              "linear-gradient(135deg, hsl(var(--fr-surface) / 0.92), hsl(var(--fr-surface-2) / 0.78))",
            boxShadow: "0 0 24px hsl(var(--fr-cyan) / 0.08)",
          }}
        >
          {indexLabel ? (
            <span className="font-mono text-[10px] font-bold tracking-widest text-[hsl(var(--fr-cyan))]">
              {indexLabel}
            </span>
          ) : null}
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--fr-text-dim))]">
            {eyebrow}
          </span>
          {label ? (
            <>
              <span className="text-[hsl(var(--fr-border))]" aria-hidden>
                ·
              </span>
              <span className="text-[11px] font-semibold text-[hsl(var(--fr-text-muted))]">
                {label}
              </span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
