export type ForensicVerdictPanelProps = {
  grade?: string | null;
  redCount?: number | null;
  amberCount?: number | null;
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

const forensicToneColors: Record<ForensicVerdictTone, string> = {
  danger: "hsl(var(--fr-danger))",
  caution: "hsl(var(--fr-caution))",
  safe: "hsl(var(--fr-success))",
};

export function ForensicVerdictPanel({
  grade,
  redCount,
  amberCount,
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
  const toneColor = forensicToneColors[tone];

  return (
    <section aria-labelledby="forensic-verdict-heading">
      <div className="fr-card px-5 py-4 sm:px-6 sm:py-5" style={{ borderLeft: `4px solid ${toneColor}` }}>
        <p
          id="forensic-verdict-heading"
          className="fr-mono text-xs font-bold uppercase tracking-[0.12em]"
          style={{ color: toneColor }}
        >
          THE FORENSIC VERDICT
        </p>
        <p className="mt-2 text-sm sm:text-[15px] leading-relaxed text-[hsl(var(--fr-text))]">{lead}</p>
        <ul className="mt-3 space-y-2">
          {bullets.map((bullet) => (
            <li
              key={bullet}
              className="text-sm leading-snug pl-4 relative text-[hsl(var(--fr-text-muted))] before:content-['•'] before:absolute before:left-0 before:text-[hsl(var(--fr-text-dim))]"
            >
              {bullet}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
