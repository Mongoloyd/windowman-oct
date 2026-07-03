/**
 * OpeningMixSummary — window vs door opening counts (full-mode lab only).
 * Presentational only; no data fetching.
 */

interface OpeningMixSummaryProps {
  windows: number;
  doors: number;
  sourceLabel: "derived";
}

function formatSourceLabel(sourceLabel: "derived"): string {
  return sourceLabel === "derived" ? "Source: derived" : "Source: derived";
}

export default function OpeningMixSummary({
  windows,
  doors,
  sourceLabel,
}: OpeningMixSummaryProps) {
  if (windows <= 0 && doors <= 0) {
    return null;
  }

  return (
    <section className="fr-card p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
        <h2 className="fr-mono text-[11px] font-bold tracking-wider text-[hsl(var(--fr-cyan))]">
          OPENING MIX
        </h2>
      </div>

      <dl className="divide-y divide-white/10">
        {windows > 0 ? (
          <div className="flex flex-col gap-1 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <dt className="fr-text-t3 text-xs font-medium uppercase tracking-wide shrink-0">
              Window openings
            </dt>
            <dd className="fr-num fr-text-t1 text-sm font-semibold sm:text-right">{windows}</dd>
          </div>
        ) : null}
        {doors > 0 ? (
          <div className="flex flex-col gap-1 py-3 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <dt className="fr-text-t3 text-xs font-medium uppercase tracking-wide shrink-0">
              Door openings
            </dt>
            <dd className="fr-num fr-text-t1 text-sm font-semibold sm:text-right">{doors}</dd>
          </div>
        ) : null}
      </dl>

      <p className="mt-3 fr-text-t3 text-[11px] leading-snug">{formatSourceLabel(sourceLabel)}</p>
    </section>
  );
}
