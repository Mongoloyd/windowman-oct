/**
 * PartialRevealHero — FOG layer of the forensic ritual.
 *
 * Pure presentation. No data fetch, no gating logic. The hero leads with a
 * safe proof-of-read evidence and falls down to severity counts, metric tiles,
 * and a locked teaser pointing at the OTP gate.
 *
 * Rendered only when the orchestrator passes accessLevel === "preview".
 */
import {
  AlertOctagon,
  ClipboardCheck,
  FileQuestion,
  FileSearch,
  FileText,
  ListChecks,
  Lock,
  ShieldCheck,
} from "lucide-react";
import WindowManMark from "./WindowManMark";
import { formatContractorName } from "./utils/formatContractorName";

interface Props {
  contractorName?: string | null;
  documentType?: string | null;
  pageCount?: number | null;
  openingCount?: number | null;
  lineItemCount?: number | null;
  flagRedCount: number;
  flagAmberCount: number;
}

type Band = {
  rgb: string;
  foregroundRgb: string;
};

function readinessBand(flagRedCount: number, flagAmberCount: number): Band {
  if (flagRedCount > 0) {
    return { rgb: "239, 68, 68", foregroundRgb: "248, 113, 113" };
  }
  if (flagAmberCount > 0) {
    return { rgb: "245, 158, 11", foregroundRgb: "251, 191, 36" };
  }
  return { rgb: "16, 185, 129", foregroundRgb: "52, 211, 153" };
}

function cleanDisplayText(value: string | null | undefined, maxLength = 80): string | null {
  const normalized = value?.trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, maxLength) : null;
}

function safeCount(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : null;
}

function safeAggregateCount(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
}

export default function PartialRevealHero({
  contractorName,
  documentType,
  pageCount,
  openingCount,
  lineItemCount,
  flagRedCount,
  flagAmberCount,
}: Props) {
  const safeRedCount = safeAggregateCount(flagRedCount);
  const safeAmberCount = safeAggregateCount(flagAmberCount);
  const band = readinessBand(safeRedCount, safeAmberCount);
  const totalReviewItems = safeRedCount + safeAmberCount;
  const safeContractorName = formatContractorName(contractorName, 80);
  const safeDocumentType = cleanDisplayText(documentType, 32)?.toLowerCase();
  const safeOpeningCount = safeCount(openingCount);
  const safePageCount = safeCount(pageCount);
  const safeLineItemCount = safeCount(lineItemCount);
  const documentLabel = safeContractorName
    ? `${safeContractorName}’s quote`
    : safeDocumentType
      ? `this ${safeDocumentType}`
      : "this quote";
  const evidenceFacts = [
    {
      key: "openings",
      value: safeOpeningCount,
      label: safeOpeningCount === 1 ? "opening detected" : "openings detected",
      icon: FileSearch,
    },
    {
      key: "pages",
      value: safePageCount,
      label: safePageCount === 1 ? "page read" : "pages read",
      icon: FileText,
    },
    {
      key: "line-items",
      value: safeLineItemCount,
      label:
        safeLineItemCount === 1
          ? "quoted line item parsed"
          : "quoted line items parsed",
      icon: ListChecks,
    },
  ].filter((fact): fact is typeof fact & { value: number } => fact.value !== null);

  return (
    <section
      className="relative fr-card overflow-hidden"
      aria-label="Quote analysis preview"
      style={{
        borderColor: `rgba(${band.rgb}, 0.45)`,
        boxShadow: `0 0 0 1px rgba(${band.rgb}, 0.15), 0 24px 70px -28px rgba(${band.rgb}, 0.35), 0 8px 32px -12px hsl(220 60% 2% / 0.7)`,
      }}
    >
      {/* Layer 1 — readiness-tinted radial wash from the top */}
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
        {/* Eyebrow — tinted to the qualitative readiness band */}
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
            className="fr-mono text-xs font-bold tracking-[0.14em] uppercase"
            style={{ color: `rgb(${band.foregroundRgb})` }}
          >
            Quote Analysis Preview
          </span>
        </div>

        {/* Heading + subtitle */}
        <h1 className="text-2xl sm:text-3xl md:text-[2.5rem] font-extrabold tracking-tight text-white leading-[1.1]">
          Your Quote Analysis Preview
        </h1>
        <p className="mt-3 text-sm sm:text-base text-slate-300/90 leading-relaxed max-w-2xl">
          Windowman reviewed the information documented in your quote. Below is a quick snapshot of what appears clear and what may need clarification before you sign. Verify your phone below to unlock the complete audit, supporting context and the questions you may want to ask.
        </p>
        {/* Safe proof-of-read evidence replaces the unreliable pillar preview. */}
        <div className="mt-6 sm:mt-8 flex flex-col items-center text-center">
          <div
            className="w-full overflow-hidden rounded-2xl border border-slate-600/75 bg-slate-950/45 p-4 text-left shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06),0_18px_42px_-28px_hsl(220_60%_2%/0.9)] backdrop-blur-sm sm:p-6"
            aria-label="Document evidence summary"
          >
            <div className="flex items-center gap-2.5 text-emerald-300">
              <ShieldCheck size={22} strokeWidth={2.1} aria-hidden />
              <h2 className="fr-mono text-xs font-bold uppercase tracking-[0.14em]">
                Evidence Summary
              </h2>
            </div>

            <p className="mt-5 max-w-3xl text-xl font-extrabold leading-tight tracking-tight text-white sm:text-2xl md:text-3xl">
              We read {documentLabel}
              {totalReviewItems > 0 ? (
                <>
                  {" "}and found{" "}
                  <span className="text-emerald-300 tabular-nums">{totalReviewItems}</span>{" "}
                  {totalReviewItems === 1 ? "item" : "items"} worth reviewing before you sign.
                </>
              ) : (
                <> and completed a documentation review before you sign.</>
              )}
            </p>

            {evidenceFacts.length > 0 ? (
              <dl
                className="mt-5 grid border-y border-slate-700/80 py-4"
                style={{ gridTemplateColumns: `repeat(${evidenceFacts.length}, minmax(0, 1fr))` }}
                aria-label="Detected document facts"
              >
                {evidenceFacts.map((fact, index) => {
                  const FactIcon = fact.icon;
                  return (
                    <div
                      key={fact.key}
                      className={`min-w-0 px-2 text-center first:pl-0 last:pr-0 sm:px-4 ${index > 0 ? "border-l border-slate-700/80" : ""}`}
                    >
                      <div className="flex items-center justify-center gap-1.5 text-emerald-300">
                        <FactIcon size={18} strokeWidth={2} aria-hidden />
                        <dd className="text-xl font-extrabold leading-none text-white tabular-nums sm:text-2xl">
                          {fact.value}
                        </dd>
                      </div>
                      <dt className="mt-1.5 min-h-8 text-xs font-medium leading-snug text-slate-300">
                        {fact.label}
                      </dt>
                    </div>
                  );
                })}
              </dl>
            ) : null}

            <div className="mt-4 flex items-center gap-2 text-left text-sm leading-snug text-slate-400">
              <Lock size={16} strokeWidth={2} aria-hidden />
              <span>Specific findings unlock after verification.</span>
            </div>
          </div>

          <p className="mt-4 max-w-3xl rounded-xl border border-slate-700/70 bg-slate-950/45 px-4 py-3 text-left text-sm leading-relaxed text-[#aab3c0] shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04)]">
            This review evaluates what is documented in this quote. It does not grade the contractor’s workmanship, reputation, or professional quality. A missing item means it was omitted from the document—not necessarily from the contractor’s planned work. It does not verify legal compliance, engineering suitability, installed conditions, or whether the quote is safe to sign.
          </p>
        </div>

        {/* Metric tiles — frosted, secondary to the evidence summary */}
        <dl className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MetricTile
            variant="critical"
            icon={<AlertOctagon size={16} />}
            value={String(safeRedCount)}
            label={safeRedCount === 1 ? "Material Quote Concern" : "Material Quote Concerns"}
          />
          <MetricTile
            variant="info"
            icon={<ClipboardCheck size={16} />}
            value="Analysis Ready"
            label="Pricing & Scope Review"
            compactValue
          />
          <MetricTile
            variant="warning"
            icon={<FileQuestion size={16} />}
            value={String(safeAmberCount)}
            label={safeAmberCount === 1 ? "Clarification Needed" : "Clarifications Needed"}
          />
        </dl>

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
  compactValue = false,
}: {
  variant: "critical" | "warning" | "info";
  icon: React.ReactNode;
  value: string;
  label: string;
  compactValue?: boolean;
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
      <dd className={`flex items-center justify-center gap-1.5 ${colorClass}`}>
        {icon}
        <span
          className={`font-mono font-extrabold leading-none tracking-tight tabular-nums ${
            compactValue ? "text-base sm:text-lg" : "text-2xl sm:text-3xl"
          }`}
        >
          {value}
        </span>
      </dd>
      <dt className="mt-2 text-xs sm:text-sm uppercase tracking-wider leading-snug text-slate-300 font-semibold">
        {label}
      </dt>
    </div>
  );
}
