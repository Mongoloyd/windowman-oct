export type ForensicVerdictPanelVariant = "classic" | "forensic";

export type ForensicVerdictPanelProps = {
  grade?: string | null;
  redCount?: number | null;
  amberCount?: number | null;
  variant: ForensicVerdictPanelVariant;
};

type ForensicVerdictTone = "danger" | "caution" | "safe";

function resolveForensicVerdictTone(
  grade: string,
  redCount: number,
  amberCount: number,
): ForensicVerdictTone {
  if (redCount > 0 || grade === "D" || grade === "F") return "danger";
  if (amberCount > 0 || grade === "C") return "caution";
  return "safe";
}

const forensicVerdictCopy: Record<
  ForensicVerdictTone,
  { lead: string; bullets: string[] }
> = {
  danger: {
    lead:
      "You may be asked to trust a hurricane protection system before the quote provides enough visible proof on system approvals, scope, and homeowner risk protections.",
    bullets: [
      "Brand or system claims may not be backed by enough visible approval detail.",
      "Deposit, cancellation, or payment language may create leverage against the homeowner.",
      "Warranty and workmanship terms may not match the lifespan of the installed asset.",
    ],
  },
  caution: {
    lead:
      "This quote may look complete at first glance, but several contract details still appear to need confirmation before signing.",
    bullets: [
      "Scope and permit handling may not be documented with enough specificity.",
      "Payment timing and change-order language may leave room for surprise costs.",
      "Warranty coverage may require written confirmation beyond marketing claims.",
    ],
  },
  safe: {
    lead:
      "This quote appears comparatively well documented, but you should still confirm approvals, scope, and warranty terms in writing before committing.",
    bullets: [
      "Product approval references should still be confirmed against the proposed system.",
      "Deposit and cancellation terms should be reviewed before any payment.",
      "Warranty and workmanship coverage should match the expected lifespan of the install.",
    ],
  },
};

const classicToneColors: Record<ForensicVerdictTone, string> = {
  danger: "hsl(var(--color-danger))",
  caution: "hsl(var(--color-caution))",
  safe: "hsl(var(--color-emerald))",
};

const forensicToneColors: Record<ForensicVerdictTone, string> = {
  danger: "hsl(var(--fr-danger))",
  caution: "hsl(var(--fr-caution))",
  safe: "hsl(var(--fr-success))",
};

const variantStyles = {
  classic: {
    section: "px-4 md:px-8 py-4 md:py-5 border-b border-border",
    shell: "max-w-4xl mx-auto rounded-[var(--radius-card)] bg-slate-900 px-4 py-4 md:px-5 md:py-5",
    title: "font-mono text-xs font-bold uppercase tracking-[0.12em]",
    body: "font-body text-slate-100 mt-2 text-sm md:text-[15px] leading-relaxed",
    bullet: "font-body text-slate-300 text-sm leading-snug pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-slate-500",
    bulletList: "mt-3 space-y-2",
  },
  forensic: {
    section: "",
    shell: "fr-card px-5 py-4 sm:px-6 sm:py-5",
    title: "fr-mono text-xs font-bold uppercase tracking-[0.12em]",
    body: "mt-2 text-sm sm:text-[15px] leading-relaxed text-[hsl(var(--fr-text))]",
    bullet:
      "text-sm leading-snug pl-4 relative text-[hsl(var(--fr-text-muted))] before:content-['•'] before:absolute before:left-0 before:text-[hsl(var(--fr-text-dim))]",
    bulletList: "mt-3 space-y-2",
  },
} as const;

export function ForensicVerdictPanel({
  grade,
  redCount,
  amberCount,
  variant,
}: ForensicVerdictPanelProps) {
  const safeGrade =
    typeof grade === "string" && grade.trim()
      ? grade.trim().toUpperCase()
      : "UNKNOWN";

  const safeRedCount =
    typeof redCount === "number" && Number.isFinite(redCount)
      ? Math.max(0, Math.trunc(redCount))
      : 0;

  const safeAmberCount =
    typeof amberCount === "number" && Number.isFinite(amberCount)
      ? Math.max(0, Math.trunc(amberCount))
      : 0;

  const tone = resolveForensicVerdictTone(safeGrade, safeRedCount, safeAmberCount);
  const { lead, bullets } = forensicVerdictCopy[tone];
  const toneColor =
    variant === "classic" ? classicToneColors[tone] : forensicToneColors[tone];
  const styles = variantStyles[variant];

  return (
    <section
      className={styles.section}
      aria-labelledby="forensic-verdict-heading"
    >
      <div className={styles.shell} style={{ borderLeft: `4px solid ${toneColor}` }}>
        <p
          id="forensic-verdict-heading"
          className={styles.title}
          style={{ color: toneColor }}
        >
          THE FORENSIC VERDICT
        </p>
        <p className={styles.body}>{lead}</p>
        <ul className={styles.bulletList}>
          {bullets.map((bullet) => (
            <li key={bullet} className={styles.bullet}>
              {bullet}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
