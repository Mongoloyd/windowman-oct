/**
 * ChangeOrderDefenseMatrix — lab-only change-order risk translation (full reveal companion).
 * Presentation-only; receives pre-mapped rows. No fetch, no backend imports.
 */
import { AlertCircle, AlertTriangle, CheckCircle2, Shield } from "lucide-react";
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

const PILL_BASE =
  "inline-flex shrink-0 items-center px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider";

function isNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function severityVisual(severity: ChangeOrderRiskSeverity) {
  switch (severity) {
    case "clear":
      return {
        cardClass: "fr-card fr-card--verified fr-accent-l--verified",
        pillClass: "fr-pill--verified",
        titleClass: "fr-text-t2",
        icon: CheckCircle2,
        iconClass: "text-[hsl(var(--fr-success))]",
      };
    case "warn":
      return {
        cardClass: "fr-card fr-card--warning fr-accent-l--warning",
        pillClass: "fr-pill--warning",
        titleClass: "fr-text-t2 text-[hsl(var(--fr-caution))]",
        icon: AlertCircle,
        iconClass: "text-[hsl(var(--fr-caution))]",
      };
    case "fail":
      return {
        cardClass: "fr-card fr-card--critical fr-accent-l--critical",
        pillClass: "fr-pill--critical",
        titleClass: "fr-text-t1",
        icon: AlertTriangle,
        iconClass: "text-[hsl(var(--fr-danger))]",
      };
    case "unknown":
    default:
      return {
        cardClass: "fr-card fr-card--warning fr-accent-l--warning",
        pillClass: "fr-pill--info",
        titleClass: "fr-text-t2",
        icon: AlertCircle,
        iconClass: "text-[hsl(var(--fr-cyan))]",
      };
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
      <p className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-[hsl(var(--fr-cyan))]">
        <Shield size={12} className="text-[hsl(var(--fr-cyan))]" aria-hidden />
        CHANGE-ORDER DEFENSE
      </p>
      <h2 id="codm-title" className="fr-text-t1 text-xl font-bold sm:text-2xl">
        {title}
      </h2>
      <p className="fr-text-t3 max-w-3xl text-sm leading-relaxed">{subtitle}</p>
      <p className="fr-text-t3 border-l-2 border-[hsl(var(--fr-border))] pl-3 text-xs leading-relaxed">
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
  const tiles = [
    {
      label: "Protected",
      value: protectedCount,
      tileClass: "fr-tile fr-tile--success",
      valueClass: "text-[hsl(var(--fr-success))]",
    },
    {
      label: "Exposure",
      value: exposureCount,
      tileClass: "fr-tile fr-tile--critical",
      valueClass: "text-[hsl(var(--fr-danger))]",
    },
    {
      label: "Needs Review",
      value: needsReviewCount,
      tileClass: "fr-tile fr-tile--warning",
      valueClass: "text-[hsl(var(--fr-caution))]",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map((tile) => (
          <div key={tile.label} className={`${tile.tileClass} min-w-0 px-3 py-3`}>
            <span className="fr-text-t3 block text-[10px] uppercase tracking-wide">
              {tile.label}
            </span>
            <span className={`fr-num mt-1 block text-2xl font-black ${tile.valueClass}`}>
              {tile.value}
            </span>
          </div>
        ))}
      </div>
      <div className="fr-card fr-card--warning fr-accent-l--warning px-3 py-2.5">
        <p className="fr-text-t3 text-xs leading-relaxed">
          <span className="font-semibold text-[hsl(var(--fr-caution))]">
            Parsed quote · Not independently verified
          </span>
        </p>
      </div>
      <p className="fr-text-t3 text-xs leading-relaxed">
        This matrix reflects change-order language detected in the parsed quote. Attachments,
        revisions, or verbal promises may contain additional terms not shown here.
      </p>
    </div>
  );
}

function ContractorQuestionCallout({ question }: { question: string }) {
  return (
    <div className="fr-card fr-card--quiet border border-[hsl(var(--fr-cyan)/0.25)] bg-[hsl(var(--fr-cyan)/0.06)] px-3 py-2.5">
      <p className="fr-text-t3 mb-1 text-[10px] uppercase tracking-wide">
        Ask contractor to confirm in writing
      </p>
      <p className="fr-text-t2 text-sm font-medium leading-relaxed">{question}</p>
    </div>
  );
}

function RiskRowCard({ row }: { row: ChangeOrderRiskRow }) {
  const evidence = isNonEmptyString(row.evidenceText) ? row.evidenceText : EVIDENCE_FALLBACK;
  const visual = severityVisual(row.severity);
  const Icon = visual.icon;

  return (
    <article className={`${visual.cardClass} min-w-0 space-y-3 break-words p-4 sm:p-5`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <Icon size={16} className={`mt-0.5 shrink-0 ${visual.iconClass}`} aria-hidden />
          <h3 className={`min-w-0 text-sm font-bold sm:text-base ${visual.titleClass}`}>
            {row.displayLabel}
          </h3>
        </div>
        <span className={`${PILL_BASE} ${visual.pillClass} ml-auto`} role="status">
          {row.statusText}
        </span>
      </div>
      <div>
        <p className="fr-text-t3 mb-1 text-[10px] uppercase tracking-wide">Parsed clause evidence</p>
        <p className="fr-text-t3 text-xs leading-relaxed whitespace-pre-wrap">{evidence}</p>
      </div>
      <div>
        <p className="fr-text-t3 mb-1 text-[10px] uppercase tracking-wide">
          Potential change-order exposure
        </p>
        <p className="fr-text-t2 text-sm leading-relaxed">{row.homeownerRiskCopy}</p>
      </div>
      <ContractorQuestionCallout question={row.contractorQuestion} />
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
    <div className="fr-card fr-card--quiet p-5 sm:p-6">
      <p className="fr-text-t3 mb-3 text-sm leading-relaxed">
        Before signing, ask the contractor to confirm these items in writing.
      </p>
      <h3 className="fr-text-t1 text-base font-bold">Contractor Confirmation Checklist</h3>
      {allClear ? (
        <p className="fr-text-t3 mt-3 text-sm leading-relaxed">
          The parsed quote shows stronger change-order guardrails, but homeowners should still
          request signed confirmation before contract execution.
        </p>
      ) : (
        <ul role="list" className="mt-3 space-y-2">
          {checklistRows.map((row) => (
            <li key={row.fieldKey} aria-label={row.contractorQuestion}>
              <ContractorQuestionCallout question={row.contractorQuestion} />
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
      <div className="fr-card fr-card--quiet space-y-2 p-5 sm:p-6">
        <h3 className="fr-text-t1 text-base font-bold">Parsed policy language</h3>
        <p className="fr-pill--warning inline-block px-2 py-0.5 text-[10px] font-bold uppercase">
          OCR-extracted · Not legal review
        </p>
        <p className="fr-text-t3 text-sm leading-relaxed whitespace-pre-wrap">{policyBlobText}</p>
      </div>
    );
  }

  return (
    <div className="fr-card fr-card--warning fr-accent-l--warning px-4 py-3">
      <p className="fr-text-t3 text-sm leading-relaxed">
        No clear change-order policy language was detected in the parsed quote.
      </p>
    </div>
  );
}

function EmptyMatrixState() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fr-card fr-card--quiet p-8 text-center"
    >
      <h3 className="fr-text-t1 text-lg font-semibold">
        No change-order defense matrix could be built from this quote.
      </h3>
      <p className="fr-text-t3 mx-auto mt-3 max-w-xl text-sm leading-relaxed">
        WindowMan could not detect enough structured change-order language in the parsed document.
        Ask the contractor for written rules covering change orders, substrate repair, rotten wood,
        buck replacement, and remeasure price changes.
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
      className={`report-dark fr-card fr-card-elevated ${FR.cardPad} ${FR.sectionGap} min-w-0`}
      style={{ borderColor: "hsl(var(--fr-cyan) / 0.28)" }}
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
