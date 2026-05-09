/**
 * ScopeOverviewCard — total openings, price-per-opening, total contract price.
 */
interface Props {
  totalOpenings?: number | null;
  pricePerOpening?: number | null;
  pricePerOpeningBand?: "low" | "market" | "high" | "extreme" | null;
  marketLow?: number | null;
  marketHigh?: number | null;
  totalContractPrice?: number | null;
}

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

function bandColor(band?: string | null): string {
  if (band === "high" || band === "extreme") return "hsl(var(--fr-caution))";
  if (band === "low") return "hsl(var(--fr-success))";
  return "hsl(var(--fr-text))";
}

export default function ScopeOverviewCard({
  totalOpenings,
  pricePerOpening,
  pricePerOpeningBand,
  marketLow,
  marketHigh,
  totalContractPrice,
}: Props) {
  if (totalOpenings == null && pricePerOpening == null && totalContractPrice == null) return null;

  return (
    <section>
      <h2 className="fr-mono text-[11px] font-bold text-[hsl(var(--fr-cyan))] mb-4">
        ▢ SCOPE OVERVIEW
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Tile
          value={totalOpenings != null ? String(totalOpenings) : "—"}
          label="Total Openings"
        />
        <Tile
          value={fmt(pricePerOpening)}
          valueColor={bandColor(pricePerOpeningBand)}
          label="Price Per Opening"
          sub={
            marketLow != null && marketHigh != null
              ? `Market avg: ${fmt(marketLow)}–${fmt(marketHigh)}`
              : undefined
          }
        />
        <Tile value={fmt(totalContractPrice)} label="Total Contract Price" />
      </div>
    </section>
  );
}

function Tile({
  value,
  label,
  sub,
  valueColor,
}: {
  value: string;
  label: string;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <div className="fr-card p-5 text-center">
      <div
        className="font-mono font-extrabold text-3xl leading-none"
        style={{ color: valueColor ?? "hsl(var(--fr-text))" }}
      >
        {value}
      </div>
      <div className="mt-2 text-xs text-[hsl(var(--fr-text-muted))]">{label}</div>
      {sub && <div className="mt-1 text-[10px] text-[hsl(var(--fr-text-dim))]">{sub}</div>}
    </div>
  );
}
