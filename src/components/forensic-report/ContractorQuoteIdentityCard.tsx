/**
 * ContractorQuoteIdentityCard — lab-only proof that WindowMan read the quote document.
 * Fixture-driven; returns null when no meaningful rows exist.
 */
import { FileCheck2, Shield } from "lucide-react";
import type { ContractorQuoteIdentityCardProps } from "./ContractorQuoteIdentityCard.types";
import { formatReportId } from "./tokens";

function isNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatDocumentType(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

interface MetadataRow {
  label: string;
  value: string;
  mono?: boolean;
}

function buildRows(props: ContractorQuoteIdentityCardProps): MetadataRow[] {
  const rows: MetadataRow[] = [];

  if (isNonEmptyString(props.contractorName)) {
    rows.push({ label: "Contractor / Company", value: props.contractorName });
  }
  if (isNonEmptyString(props.documentType)) {
    rows.push({ label: "Document Type", value: formatDocumentType(props.documentType) });
  }
  if (isFiniteNumber(props.pageCount)) {
    rows.push({ label: "Pages Scanned", value: String(props.pageCount), mono: true });
  }
  if (isFiniteNumber(props.lineItemCount)) {
    rows.push({ label: "Extracted Quote Rows", value: String(props.lineItemCount), mono: true });
  }
  if (isFiniteNumber(props.openingCount)) {
    rows.push({ label: "Openings Counted", value: String(props.openingCount), mono: true });
  }
  if (isNonEmptyString(props.analysisId)) {
    rows.push({
      label: "Analysis ID",
      value: formatReportId(props.analysisId),
      mono: true,
    });
  }
  if (isNonEmptyString(props.rubricVersion)) {
    rows.push({ label: "Rubric Version", value: props.rubricVersion, mono: true });
  }
  if (isFiniteNumber(props.confidenceScore)) {
    rows.push({
      label: "Parse Confidence",
      value: `${props.confidenceScore}%`,
      mono: true,
    });
  }

  return rows;
}

export default function ContractorQuoteIdentityCard(props: ContractorQuoteIdentityCardProps) {
  const rows = buildRows(props);
  if (rows.length === 0) return null;

  return (
    <section
      className="fr-card relative overflow-hidden p-5 sm:p-7"
      style={{
        borderColor: "hsl(var(--fr-cyan) / 0.32)",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(90% 70% at 0% 0%, hsl(var(--fr-cyan) / 0.10), transparent 55%), radial-gradient(60% 50% at 100% 100%, hsl(var(--fr-caution) / 0.06), transparent 60%)",
        }}
      />

      <div className="relative space-y-5">
        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--fr-cyan)/0.35)] bg-[hsl(var(--fr-cyan)/0.08)] px-2 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-[hsl(var(--fr-cyan))]">
              <Shield size={11} />
              Document Proof
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-950/25 px-2 py-1 text-[10px] font-medium text-emerald-300">
              <FileCheck2 size={11} />
              Quote file parsed
            </span>
          </div>
          <h2
            id="cqic-title"
            className="text-xl sm:text-2xl font-bold text-[hsl(var(--fr-text))] tracking-tight"
          >
            What WindowMan Actually Read
          </h2>
          <p className="text-sm text-[hsl(var(--fr-text-muted))] leading-relaxed max-w-3xl">
            Key quote facts WindowMan extracted from your uploaded quote — before scoring, flags,
            or recommendations.
          </p>
        </header>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rows.map((row) => (
            <div
              key={row.label}
              className="rounded-lg border border-[hsl(var(--fr-border))] bg-slate-950/45 px-4 py-3 backdrop-blur-[2px]"
              style={{ boxShadow: "inset 0 1px 0 hsl(var(--fr-border) / 0.35)" }}
            >
              <dt className="text-[10px] font-mono uppercase tracking-[0.14em] text-[hsl(var(--fr-text-dim))]">
                {row.label}
              </dt>
              <dd
                className={`mt-1 text-sm font-semibold text-[hsl(var(--fr-text))] ${
                  row.mono ? "font-mono tabular-nums" : ""
                }`}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>

        <p className="text-xs text-[hsl(var(--fr-text-dim))] leading-relaxed border-l-2 border-[hsl(var(--fr-border))] pl-3">
          OCR-extracted metadata only. WindowMan does not independently verify contractor licensing,
          licensing status, or document authenticity beyond what appears in the parsed file.
        </p>
      </div>
    </section>
  );
}
