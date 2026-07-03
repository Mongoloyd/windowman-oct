/**
 * ScopeOverviewCard — total openings, price-per-opening, total contract price.
 */
import { LayoutGrid, Lock } from "lucide-react";

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
  openingCountSource?: string | null;
  quoteMathConfidence?: number | null;
  benchmarkSourceLabel?: string | null;
  benchmarkUpdatedAt?: string | null;
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
  if (band === "low") return riskContext ? "hsl(var(--fr-caution))" : "hsl(var(--fr-success))";
  return "hsl(var(--fr-text))";
}

function bandLabel(band?: string | null, riskContext?: boolean): string | null {
  if (!band) return null;
  if (band === "high" || band === "extreme") return "Above market";
  if (band === "low") return riskContext ? "Low price · high risk" : "Below market";
  if (band === "market") return "Market range";
  return null;
}

function bandTileClass(band?: string | null, riskContext?: boolean): string {
  if (band === "high" || band === "extreme") return "fr-tile--warning";
  if (band === "low") return riskContext ? "fr-tile--warning" : "fr-tile--success";
  return "";
}

function ppoSubcopy(
  marketLow: number | null | undefined,
  marketHigh: number | null | undefined,
  isPreview: boolean,
): string {
  const base = "Product + install · before tax";
  if (isPreview || marketLow == null || marketHigh == null) return base;
  return `${base} · Market ${fmtMoney(marketLow)}–${fmtMoney(marketHigh)}`;
}

function openingCountSourceLabel(source: string | null | undefined): string | null {
  if (source === "extracted_header") return "Count from quote header";
  if (source === "inferred_from_lines") return "Count inferred from line items";
  return null;
}

function benchmarkProvenanceLine(
  label: string | null | undefined,
  updatedAt: string | null | undefined,
): string | null {
  if (label && updatedAt) return `Benchmark source: ${label} · Updated ${updatedAt}`;
  if (label) return `Benchmark source: ${label}`;
  if (updatedAt) return `Updated ${updatedAt}`;
  return null;
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
  openingCountSource,
  quoteMathConfidence,
  benchmarkSourceLabel,
  benchmarkUpdatedAt,
}: Props) {
  const isPreview = accessLevel === "preview";
  const isFull = !isPreview;
  const hasContractTotal =
    totalContractPrice != null && Number.isFinite(totalContractPrice);
  const ppoLocked = isPreview && (pricePerOpening == null || !Number.isFinite(pricePerOpening));
  const ppoBandLabel = bandLabel(pricePerOpeningBand, riskContext);
  const openingsSub = isFull ? openingCountSourceLabel(openingCountSource) : null;
  const benchmarkSub = isFull
    ? benchmarkProvenanceLine(benchmarkSourceLabel, benchmarkUpdatedAt)
    : null;
  const showQuoteMathConfidence =
    isFull && quoteMathConfidence != null && Number.isFinite(quoteMathConfidence);

  if (totalOpenings == null && pricePerOpening == null && totalContractPrice == null) return null;

  return (
    <section className="fr-card p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
        <LayoutGrid
          size={14}
          className="shrink-0 text-[hsl(var(--fr-cyan))]"
          aria-hidden="true"
        />
        <h2 className="fr-mono text-[11px] font-bold tracking-wider text-[hsl(var(--fr-cyan))]">
          SCOPE OVERVIEW
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 items-stretch">
        <Tile
          value={totalOpenings != null ? String(totalOpenings) : "—"}
          label="Total Openings"
          sub={openingsSub ?? undefined}
        />
        <Tile
          value={isPreview ? fmtPreviewMoney(pricePerOpening, true) : fmtMoney(pricePerOpening)}
          valueColor={bandColor(pricePerOpeningBand, riskContext)}
          label="Installed Price Per Opening"
          sub={ppoSubcopy(marketLow, marketHigh, isPreview)}
          subExtra={benchmarkSub ?? undefined}
          tileClass={bandTileClass(pricePerOpeningBand, riskContext)}
          bandLabel={ppoBandLabel}
          locked={ppoLocked}
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
          locked={
            isPreview &&
            (totalContractPrice == null || !Number.isFinite(totalContractPrice))
          }
        />
      </div>

      {showQuoteMathConfidence && (
        <p className="mt-4 border-t border-white/10 pt-3 fr-text-t3 text-[11px] sm:text-xs leading-snug text-pretty">
          Quote math confidence:{" "}
          <span className="fr-num font-semibold text-[hsl(var(--fr-text))]">
            {Math.round(quoteMathConfidence!)}
          </span>
          /100
        </p>
      )}
    </section>
  );
}

function Tile({
  value,
  label,
  sub,
  subExtra,
  valueColor,
  tileClass = "",
  bandLabel: bandLabelText,
  locked = false,
}: {
  value: string;
  label: string;
  sub?: string;
  subExtra?: string;
  valueColor?: string;
  tileClass?: string;
  bandLabel?: string | null;
  locked?: boolean;
}) {
  return (
    <div
      className={`fr-tile flex h-full min-h-[7.5rem] flex-col justify-between p-4 sm:p-5 text-center ${tileClass}`.trim()}
    >
      <div className="flex flex-col items-center gap-2">
        {bandLabelText && (
          <span
            className={`fr-mono inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
              tileClass === "fr-tile--warning"
                ? "fr-pill--warning border-transparent"
                : tileClass === "fr-tile--success"
                  ? "fr-pill--verified border-transparent"
                  : "fr-pill--info border-transparent"
            }`}
          >
            {bandLabelText}
          </span>
        )}
        <div className="flex items-center justify-center gap-1.5">
          {locked && (
            <Lock
              size={16}
              className="shrink-0 text-[hsl(var(--fr-text-dim))]"
              aria-hidden="true"
            />
          )}
          <div
            className="fr-num fr-text-t1 text-3xl sm:text-[2rem] font-extrabold leading-none tracking-tight"
            style={{ color: valueColor ?? "hsl(var(--fr-text))" }}
          >
            {value}
          </div>
        </div>
      </div>
      <div className="mt-3 space-y-1">
        <div className="fr-text-t2 text-xs sm:text-sm font-semibold leading-snug">{label}</div>
        {sub && (
          <div className="fr-text-t3 text-[11px] sm:text-xs leading-snug text-pretty">{sub}</div>
        )}
        {subExtra && (
          <div className="fr-text-t3 text-[11px] sm:text-xs leading-snug text-pretty opacity-90">
            {subExtra}
          </div>
        )}
        {locked && <span className="sr-only">Locked until SMS verification</span>}
      </div>
    </div>
  );
}
