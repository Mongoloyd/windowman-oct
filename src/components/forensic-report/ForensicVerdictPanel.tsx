import type { AnalysisFlag } from "@/hooks/useAnalysisData";

export type ForensicVerdictPanelProps = {
  grade?: string | null;
  redCount?: number | null;
  amberCount?: number | null;
  /** Full/unlocked mode only — omit in preview to avoid flag leakage. */
  flags?: AnalysisFlag[];
};

type ForensicVerdictTone = "danger" | "caution" | "safe";

const PILLAR_PRIORITY = [
  "safety_code",
  "price_fairness",
  "warranty",
  "fine_print",
  "install_scope",
] as const;

const PILLAR_BULLETS: Record<string, string> = {
  safety_code:
    "Product approval or code proof needs written confirmation before signing.",
  fine_print:
    "Payment, cancellation, or contract leverage terms need written confirmation before money changes hands.",
  warranty:
    "Warranty and workmanship responsibilities need to be clear enough to enforce later.",
  install_scope:
    "Install scope should be clarified in writing before accepting the quote.",
  price_fairness:
    "Pricing and line-item assumptions should be clarified before treating this as a safe quote.",
};

const MAX_BULLETS = 3;

const GENERIC_FALLBACK_DANGER_CAUTION =
  "Several quote areas scored below WindowMan's signing threshold. Review the Detailed Findings below before accepting or comparing this estimate.";

const GENERIC_SAFE =
  "This quote appears more complete than most, but important terms should still be confirmed in writing before signing.";

export function resolveForensicVerdictTone(
  grade: string,
  redCount: number,
  amberCount: number,
): ForensicVerdictTone {
  if (redCount > 0 || grade === "D" || grade === "F") return "danger";
  if (amberCount > 0 || grade === "C") return "caution";
  return "safe";
}

const evidenceLeads: Record<ForensicVerdictTone, string> = {
  danger:
    "You may be asked to trust a hurricane protection system before the quote provides enough visible proof on system approvals, scope, and homeowner risk protections.",
  caution:
    "This quote may look complete at first glance, but several contract details still appear to need confirmation before signing.",
  safe:
    "This quote appears comparatively well documented, but you should still confirm key terms in writing before committing.",
};

const previewLeads: Record<ForensicVerdictTone, string> = {
  danger: "This quote needs further review before signing or comparing estimates.",
  caution: "Some contract details may still need confirmation before you commit.",
  safe:
    "This quote shows fewer warning signals than average, but key terms should still be confirmed before signing.",
};

const previewBullets: Record<ForensicVerdictTone, string[]> = {
  danger: [
    "Unlock the full report to see what WindowMan found before you sign or compare quotes.",
  ],
  caution: [
    "Unlock the full report to confirm which contract details still need written clarification.",
  ],
  safe: [GENERIC_SAFE],
};

function getActivePillars(flags: AnalysisFlag[]): string[] {
  const pillars = new Set<string>();
  for (const flag of flags) {
    if (flag.severity !== "red" && flag.severity !== "amber") continue;
    if (flag.pillar) pillars.add(flag.pillar);
  }
  return PILLAR_PRIORITY.filter((pillar) => pillars.has(pillar));
}

function buildEvidenceBullets(activePillars: string[]): string[] {
  return activePillars
    .map((pillar) => PILLAR_BULLETS[pillar])
    .filter((bullet): bullet is string => Boolean(bullet))
    .slice(0, MAX_BULLETS);
}

/** Pure content resolver — exported for unit tests. */
export function resolveForensicVerdictContent(
  tone: ForensicVerdictTone,
  flags: AnalysisFlag[] | undefined,
): { lead: string; bullets: string[] } {
  const isPreviewContext = flags === undefined;

  if (isPreviewContext) {
    return { lead: previewLeads[tone], bullets: previewBullets[tone] };
  }

  const activePillars = getActivePillars(flags);
  const evidenceBullets = buildEvidenceBullets(activePillars);

  if (tone === "safe") {
    if (evidenceBullets.length > 0) {
      return { lead: evidenceLeads.safe, bullets: evidenceBullets };
    }
    return { lead: evidenceLeads.safe, bullets: [GENERIC_SAFE] };
  }

  if (evidenceBullets.length > 0) {
    return { lead: evidenceLeads[tone], bullets: evidenceBullets };
  }

  return {
    lead: evidenceLeads[tone],
    bullets: [GENERIC_FALLBACK_DANGER_CAUTION],
  };
}

const forensicToneColors: Record<ForensicVerdictTone, string> = {
  danger: "hsl(var(--fr-danger))",
  caution: "hsl(var(--fr-caution))",
  safe: "hsl(var(--fr-success))",
};

export function ForensicVerdictPanel({
  grade,
  redCount,
  amberCount,
  flags,
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
  const { lead, bullets } = resolveForensicVerdictContent(tone, flags);
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
