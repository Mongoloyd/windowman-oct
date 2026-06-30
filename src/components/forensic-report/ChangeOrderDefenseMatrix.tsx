/**
 * ChangeOrderDefenseMatrix — lab-only change-order risk translation (full reveal companion).
 * Presentation-only; receives pre-mapped rows. No fetch, no backend imports.
 */
import type {
  ChangeOrderDefenseMatrixProps,
  ChangeOrderRiskRow,
  ChangeOrderRiskSeverity,
} from "./ChangeOrderDefenseMatrix.types";
import { FR } from "./tokens";

const DEFAULT_TITLE = "Change-Order Defense Matrix";
const DEFAULT_SUBTITLE =
  "This is where surprise invoices can hide. WindowMan checks whether the quote defines the rules before demolition starts.";
const EVIDENCE_FALLBACK = "No specific clause text detected in parsed quote.";

function isNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function severityBadgeClass(severity: ChangeOrderRiskSeverity): string {
  const base = "inline-flex rounded-md px-2 py-0.5 text-xs font-medium border";
  switch (severity) {
    case "clear":
      return `${base} border-emerald-500/40 text-emerald-300 bg-emerald-950/30`;
    case "warn":
      return `${base} border-amber-500/40 text-amber-300 bg-amber-950/30`;
    case "fail":
      return `${base} border-red-500/40 text-red-300 bg-red-950/40`;
    case "unknown":
    default:
      return `${base} border-neutral-500/40 text-neutral-300 bg-neutral-950/30`;
  }
}

function resolveRisks(risks: ChangeOrderDefenseMatrixProps["risks"]): ChangeOrderRiskRow[] {
  return Array.isArray(risks) ? risks : [];
}

function computeSummaryCounts(risks: ChangeOrderRiskRow[]) {
  const protectedCount = risks.filter((risk) => risk.severity === "clear").length;
  const exposureCount = risks.filter(
    (risk) => risk.severity === "warn" || risk.severity === "fail",
  ).length;
  const needsReviewCount = risks.filter((risk) => risk.severity === "unknown").length;
  return { protectedCount, exposureCount, needsReviewCount };
}

function MatrixHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <header className="space-y-2">
      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[hsl(var(--fr-cyan))]">
        CHANGE-ORDER DEFENSE
      </p>
      <h2 id="codm-title" className="text-xl sm:text-2xl font-bold text-[hsl(var(--fr-text))]">
        {title}
      </h2>
      <p className="text-sm text-[hsl(var(--fr-text-muted))] leading-relaxed max-w-3xl">
        {subtitle}
      </p>
      <p className="text-xs text-[hsl(var(--fr-text-dim))] leading-relaxed border-l-2 border-[hsl(var(--fr-border))] pl-3">
        <span className="font-semibold text-[hsl(var(--fr-text-muted))]">WindowMan Filter:</span>{" "}
        We look for written approval rules, substrate pricing, and remeasure limits so the final
        bill cannot quietly drift after signing.
      </p>
    </header>
  );
}

function SummaryChips({
  protectedCount,
  exposureCount,
  needsReviewCount,
}: {
  protectedCount: number;
  exposureCount: number;
  needsReviewCount: number;
}) {
  const chips = [
    { label: "Protected", value: String(protectedCount) },
    { label: "Exposure", value: String(exposureCount) },
    { label: "Needs Review", value: String(needsReviewCount) },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <div
            key={chip.label}
            className="inline-flex flex-col rounded-lg border border-[hsl(var(--fr-border))] bg-slate-900/60 px-3 py-2 min-w-[120px]"
          >
            <span className="text-[10px] uppercase tracking-wide text-[hsl(var(--fr-text-dim))]">
              {chip.label}
            </span>
            <span className="mt-0.5 text-sm font-semibold tabular-nums text-[hsl(var(--fr-text))] text-right">
              {chip.value}
            </span>
          </div>
        ))}
        <div className="inline-flex items-center rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-xs text-amber-200/90">
          Parsed quote · Not independently verified
        </div>
      </div>
      <p className="text-xs text-[hsl(var(--fr-text-dim))] leading-relaxed">
        This matrix reflects change-order language detected in the parsed quote. Attachments,
        revisions, or verbal promises may contain additional terms not shown here.
      </p>
    </div>
  );
}

function RiskRowCard({ row }: { row: ChangeOrderRiskRow }) {
  const evidence = isNonEmptyString(row.evidenceText) ? row.evidenceText : EVIDENCE_FALLBACK;

  return (
    <article className="rounded-lg border border-[hsl(var(--fr-border))] bg-slate-900/50 p-4 sm:p-5 space-y-3 break-words">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <h3 className="text-sm font-semibold text-[hsl(var(--fr-text))]">{row.displayLabel}</h3>
        <span className={severityBadgeClass(row.severity)}>{row.statusText}</span>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--fr-text-dim))] mb-1">
          Parsed clause evidence
        </p>
        <p className="text-xs text-[hsl(var(--fr-text-muted))] leading-relaxed whitespace-pre-wrap">
          {evidence}
        </p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--fr-text-dim))] mb-1">
          Potential change-order exposure
        </p>
        <p className="text-sm text-[hsl(var(--fr-text-muted))] leading-relaxed">
          {row.homeownerRiskCopy}
        </p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--fr-text-dim))] mb-1">
          Ask contractor to confirm in writing
        </p>
        <p className="text-sm text-[hsl(var(--fr-text))] leading-relaxed">{row.contractorQuestion}</p>
      </div>
    </article>
  );
}

function RiskMatrix({ risks }: { risks: ChangeOrderRiskRow[] }) {
  return (
    <div className="space-y-3">
      {risks.map((row) => (
        <RiskRowCard key={row.fieldKey} row={row} />
      ))}
    </div>
  );
}

function ContractorChecklist({ risks }: { risks: ChangeOrderRiskRow[] }) {
  const checklistRows = risks.filter(
    (row) => row.severity === "warn" || row.severity === "fail" || row.severity === "unknown",
  );
  const allClear = risks.length > 0 && checklistRows.length === 0;

  return (
    <div className="rounded-lg border border-[hsl(var(--fr-border))] bg-slate-950/50 p-5 sm:p-6">
      <p className="text-sm text-[hsl(var(--fr-text-muted))] mb-3">
        Before signing, ask the contractor to confirm these items in writing.
      </p>
      <h3 className="text-base font-bold text-[hsl(var(--fr-text))]">
        Contractor Confirmation Checklist
      </h3>
      {allClear ? (
        <p className="mt-3 text-sm text-[hsl(var(--fr-text-muted))] leading-relaxed">
          The parsed quote shows stronger change-order guardrails, but homeowners should still
          request signed confirmation before contract execution.
        </p>
      ) : (
        <ul
          role="list"
          className="mt-3 space-y-2 list-disc list-inside text-sm text-[hsl(var(--fr-text-muted))]"
        >
          {checklistRows.map((row) => (
            <li key={row.fieldKey} aria-label={row.contractorQuestion}>
              {row.contractorQuestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ParsedPolicySection({ policyBlobText }: { policyBlobText?: string | null }) {
  if (isNonEmptyString(policyBlobText)) {
    return (
      <div className="rounded-lg border border-[hsl(var(--fr-border))] bg-slate-900/40 p-5 sm:p-6 space-y-2">
        <h3 className="text-base font-bold text-[hsl(var(--fr-text))]">Parsed policy language</h3>
        <p className="text-xs text-amber-200/80">
          This is OCR-extracted language, not independent legal review.
        </p>
        <p className="text-sm text-[hsl(var(--fr-text-muted))] leading-relaxed whitespace-pre-wrap">
          {policyBlobText}
        </p>
      </div>
    );
  }

  return (
    <p className="text-sm text-[hsl(var(--fr-text-muted))] leading-relaxed rounded-lg border border-[hsl(var(--fr-border))] bg-slate-900/40 px-4 py-3">
      No clear change-order policy language was detected in the parsed quote.
    </p>
  );
}

function EmptyMatrixState() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-lg border border-[hsl(var(--fr-border))] bg-slate-900/40 p-8 text-center"
    >
      <h3 className="text-lg font-semibold text-[hsl(var(--fr-text))]">
        No change-order defense matrix could be built from this quote.
      </h3>
      <p className="mt-3 text-sm text-[hsl(var(--fr-text-muted))] leading-relaxed max-w-xl mx-auto">
        WindowMan could not detect enough structured change-order language in the parsed document.
        Ask the contractor for written rules covering change orders, substrate repair, rotten
        wood, buck replacement, and remeasure price changes.
      </p>
    </div>
  );
}

export default function ChangeOrderDefenseMatrix(
  props: ChangeOrderDefenseMatrixProps & { suppressFooterChecklist?: boolean },
) {
  const risks = resolveRisks(props.risks);
  const isEmpty = risks.length === 0;
  const { protectedCount, exposureCount, needsReviewCount } = computeSummaryCounts(risks);
  const title = isNonEmptyString(props.title) ? props.title : DEFAULT_TITLE;
  const subtitle = isNonEmptyString(props.subtitle) ? props.subtitle : DEFAULT_SUBTITLE;

  return (
    <section
      className={`report-dark ${FR.cardPad} rounded-xl border border-[hsl(var(--fr-border))] bg-slate-950/70 ${FR.sectionGap}`}
      aria-labelledby="codm-title"
    >
      <MatrixHeader title={title} subtitle={subtitle} />
      <SummaryChips
        protectedCount={protectedCount}
        exposureCount={exposureCount}
        needsReviewCount={needsReviewCount}
      />

      {isEmpty ? (
        <EmptyMatrixState />
      ) : (
        <>
          <RiskMatrix risks={risks} />
          {props.suppressFooterChecklist ? null : <ContractorChecklist risks={risks} />}
        </>
      )}

      <ParsedPolicySection policyBlobText={props.policyBlobText} />
    </section>
  );
}
