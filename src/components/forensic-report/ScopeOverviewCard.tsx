/**
 * ScopeOverviewCard — total openings, price-per-opening, total contract price.
 */
const LOCKED_METRIC_VALUE = "Locked";

interface Props {
  accessLevel?: "preview" | "full";
  totalOpenings?: number | null;
  pricePerOpening?: number | null;
  pricePerOpeningBand?: "low" | "market" | "high" | "extreme" | null;
  marketLow?: number | null;
  marketHigh?: number | null;
  totalContractPrice?: number | null;
  /** When true, a low price band is treated as caution (not "good deal" green). */
  riskContext?: boolean;
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtPreviewMoney(n: number | null | undefined, lockedWhenMissing: boolean): string {
  if (n != null && Number.isFinite(n)) return fmtMoney(n);
  if (lockedWhenMissing) return LOCKED_METRIC_VALUE;
  return "—";
}

function bandColor(band?: string | null, riskContext?: boolean): string {
  if (band === "high" || band === "extreme") return "hsl(var(--fr-caution))";
  // A low price on a high-risk report is not a "good deal" — never paint it green.
  if (band === "low") return riskContext ? "hsl(var(--fr-caution))" : "hsl(var(--fr-success))";
  return "hsl(var(--fr-text))";
}

export default function ScopeOverviewCard({
  accessLevel = "full",
  totalOpenings,
  pricePerOpening,
  pricePerOpeningBand,
  marketLow,
  marketHigh,
  totalContractPrice,
  riskContext = false,
}: Props) {
  const isPreview = accessLevel === "preview";
  const hasContractTotal =
    totalContractPrice != null && Number.isFinite(totalContractPrice);

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
          value={isPreview ? fmtPreviewMoney(pricePerOpening, true) : fmtMoney(pricePerOpening)}
          valueColor={bandColor(pricePerOpeningBand, riskContext)}
          label="Installed Price Per Opening"
          sub={
            marketLow != null && marketHigh != null
              ? `Product + install scope, before tax where available · Market range uses installed price assumptions where available: ${fmtMoney(marketLow)}–${fmtMoney(marketHigh)}`
              : "Product + install scope, before tax where available"
          }
        />
        <Tile
          value={
            isPreview
              ? fmtPreviewMoney(totalContractPrice, !hasContractTotal)
              : fmtMoney(totalContractPrice)
          }
          label={
            isPreview
              ? hasContractTotal
                ? "Quote Total Detected"
                : "Contract Total"
              : "Total Contract Price"
          }
        />
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
      <div className="mt-2 text-[hsl(var(--fr-text-muted))] text-sm">{label}</div>
      {sub && <div className="mt-1 text-[hsl(var(--fr-text-dim))] text-sm">{sub}</div>}
    </div>
  );
}
