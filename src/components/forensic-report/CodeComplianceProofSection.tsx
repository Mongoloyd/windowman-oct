/**
 * CodeComplianceProofSection — lab-only code/compliance documentation review.
 */
import { AlertCircle, AlertTriangle, CheckCircle2, Scale } from "lucide-react";
import type {
  CodeComplianceProofRow,
  CodeComplianceProofSectionProps,
} from "./CodeComplianceProofSection.types";
import {
  deriveEvidenceRowTier,
  mapCodeComplianceStatusToVisual,
  splitMoneyPhrases,
  toneIconClass,
} from "./visualState";

const DEFAULT_TITLE = "Code & Compliance Proof";
const DEFAULT_SUBTITLE =
  "Does this quote document the product approval, performance ratings, and permit/code proof a homeowner would expect before signing?";
const DEFAULT_WHY =
  "This section checks whether the quote shows approval documentation, performance ratings, and permit/code language visible in the parsed quote. Jurisdiction-specific terms (for example NOA, HVHZ, or Miami-Dade) appear only when extracted from the quote. It does not independently validate whether a product is approved or legal to install.";

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const PILL_BASE =
  "inline-flex shrink-0 items-center px-3 py-1 text-[10px] font-bold uppercase tracking-wider";

function statusBadgeLabel(status: CodeComplianceProofRow["status"]): string {
  switch (status) {
    case "documented":
      return "Documented";
    case "partial":
      return "Partial";
    case "missing":
      return "Missing";
    case "unclear":
    default:
      return "Needs Verification";
  }
}

function partitionComplianceRows(rows: CodeComplianceProofRow[]) {
  const proofRows: CodeComplianceProofRow[] = [];
  const warningRows: CodeComplianceProofRow[] = [];
  const criticalRows: CodeComplianceProofRow[] = [];
  const quietRows: CodeComplianceProofRow[] = [];

  for (const row of rows) {
    const tier = deriveEvidenceRowTier({
      severity: row.severity,
      status: row.status,
      domain: "compliance",
    });
    switch (tier) {
      case "summary":
        proofRows.push(row);
        break;
      case "warning-alert":
        warningRows.push(row);
        break;
      case "critical-alert":
        criticalRows.push(row);
        break;
      default:
        quietRows.push(row);
    }
  }

  return { proofRows, warningRows, criticalRows, quietRows };
}

function MoneyEmphasis({
  text,
  moneyClass,
}: {
  text: string;
  moneyClass: string;
}) {
  return (
    <>
      {splitMoneyPhrases(text).map((part, index) =>
        part.isMoney ? (
          <span key={`${part.text}-${index}`} className={moneyClass}>
            {part.text}
          </span>
        ) : (
          <span key={`${part.text}-${index}`}>{part.text}</span>
        ),
      )}
    </>
  );
}

function ProofRow({ row }: { row: CodeComplianceProofRow }) {
  return (
    <div className="fr-card fr-card--quiet px-4 py-3">
      <dl className="m-0 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <dt className="fr-text-t3 text-[10px] font-mono uppercase tracking-[0.14em]">{row.label}</dt>
        <dd className="m-0 flex min-w-0 items-start gap-2 text-left sm:max-w-[65%] sm:text-right">
          <CheckCircle2
            size={14}
            className="mt-0.5 shrink-0 text-[hsl(var(--fr-success))]"
            aria-hidden
          />
          <span className="fr-text-t2 text-sm font-semibold text-[hsl(var(--fr-success))]">
            {row.value}
          </span>
        </dd>
      </dl>
      {row.detail ? (
        <p className="fr-text-t3 mt-1 text-xs leading-relaxed">{row.detail}</p>
      ) : null}
      {row.examples && row.examples.length > 0 ? (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {row.examples.map((example) => (
            <span
              key={example}
              className="fr-pill--verified inline-flex max-w-full break-words px-2 py-0.5 text-[10px] font-mono"
            >
              {example}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function WarningAlertCard({ row }: { row: CodeComplianceProofRow }) {
  return (
    <article className="fr-card fr-card--warning fr-accent-l--warning overflow-hidden">
      <div className="space-y-2 p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-2 gap-y-1">
          <AlertCircle
            size={16}
            className="mt-0.5 shrink-0 text-[hsl(var(--fr-caution))]"
            aria-hidden
          />
          <h3 className="min-w-0 flex-1 text-sm font-bold text-[hsl(var(--fr-caution))] sm:text-base">
            {row.label}
          </h3>
          <span className={`${PILL_BASE} fr-pill--warning ml-auto`} role="status">
            {statusBadgeLabel(row.status)}
          </span>
        </div>
        <p className="fr-text-t2 text-sm font-semibold">{row.value}</p>
        {row.detail ? (
          <p className="fr-text-t3 text-xs leading-relaxed sm:text-sm">
            <MoneyEmphasis
              text={row.detail}
              moneyClass="fr-num font-bold text-[hsl(var(--fr-caution))]"
            />
          </p>
        ) : null}
        {row.examples && row.examples.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {row.examples.map((example) => (
              <span
                key={example}
                className="inline-flex max-w-full break-words rounded-md border border-[hsl(var(--fr-caution)/0.35)] bg-[hsl(var(--fr-caution)/0.08)] px-2 py-0.5 text-[10px] font-mono text-[hsl(var(--fr-caution))]"
              >
                {example}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function CriticalAlertCard({ row }: { row: CodeComplianceProofRow }) {
  return (
    <article className="fr-card fr-card--critical fr-accent-l--critical fr-glow--critical overflow-hidden">
      <div className="space-y-2 p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-2 gap-y-1">
          <AlertTriangle
            size={16}
            className="mt-0.5 shrink-0 text-[hsl(var(--fr-danger))]"
            aria-hidden
          />
          <h3 className="fr-text-t1 min-w-0 flex-1 text-sm font-bold sm:text-base">
            {row.label}
          </h3>
          <span className={`${PILL_BASE} fr-pill--critical ml-auto`} role="status">
            {statusBadgeLabel(row.status)}
          </span>
        </div>
        <p className="fr-text-t1 text-sm font-semibold">{row.value}</p>
        {row.detail ? (
          <p className="fr-text-t3 text-xs leading-relaxed sm:text-sm">
            <MoneyEmphasis
              text={row.detail}
              moneyClass="fr-num font-bold text-[hsl(var(--fr-danger))]"
            />
          </p>
        ) : null}
        {row.examples && row.examples.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {row.examples.map((example) => (
              <span
                key={example}
                className="inline-flex max-w-full break-words rounded-md border border-[hsl(var(--fr-danger)/0.35)] bg-[hsl(var(--fr-danger)/0.08)] px-2 py-0.5 text-[10px] font-mono text-[hsl(var(--fr-danger))]"
              >
                {example}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function QuietRow({ row }: { row: CodeComplianceProofRow }) {
  return (
    <div className="fr-card fr-card--quiet px-4 py-3">
      <dl className="m-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <dt className="fr-text-t3 text-[10px] font-mono uppercase tracking-[0.14em]">{row.label}</dt>
          <dd className="m-0">
            <span className={`${PILL_BASE} fr-pill--unknown`}>{statusBadgeLabel(row.status)}</span>
          </dd>
        </div>
        <dd className="fr-text-t2 m-0 mt-1 text-sm font-semibold">{row.value}</dd>
      </dl>
      {row.detail ? (
        <p className="fr-text-t3 mt-2 text-xs leading-relaxed">{row.detail}</p>
      ) : null}
      {row.examples && row.examples.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {row.examples.map((example) => (
            <span
              key={example}
              className="inline-flex max-w-full break-words rounded-md border border-[hsl(var(--fr-border))] bg-slate-900/70 px-2 py-0.5 text-[10px] font-mono text-[hsl(var(--fr-text-muted))]"
            >
              {example}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function isRenderable(
  props: CodeComplianceProofSectionProps | null | undefined,
): props is CodeComplianceProofSectionProps {
  if (!props) return false;
  return (
    Boolean(props.title || props.subtitle) ||
    props.rows.length > 0 ||
    Boolean(props.missingStateMessage)
  );
}

export default function CodeComplianceProofSection(
  props: CodeComplianceProofSectionProps | null | undefined,
) {
  if (!isRenderable(props)) return null;

  const title = props.title ?? DEFAULT_TITLE;
  const subtitle = props.subtitle ?? DEFAULT_SUBTITLE;
  const whyItMatters = props.whyItMatters ?? DEFAULT_WHY;
  const sectionVisual = mapCodeComplianceStatusToVisual(props.status);
  const { proofRows, warningRows, criticalRows, quietRows } = partitionComplianceRows(props.rows);

  return (
    <section
      className={`${sectionVisual.cardClass} relative overflow-hidden p-5 sm:p-7`}
      style={{ borderColor: "hsl(var(--fr-cyan) / 0.35)", fontFamily: FONT_STACK }}
      aria-labelledby="ccps-title"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(90% 70% at 0% 0%, hsl(var(--fr-cyan) / 0.10), transparent 55%), radial-gradient(60% 50% at 100% 100%, hsl(var(--fr-danger) / 0.05), transparent 60%)",
        }}
      />

      <div className="relative space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <header className="min-w-0 space-y-2">
            <p className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-[hsl(var(--fr-cyan))]">
              <Scale size={12} className={toneIconClass("info")} aria-hidden />
              CODE & COMPLIANCE PROOF
            </p>
            <h2 id="ccps-title" className="fr-text-t1 text-xl font-bold sm:text-2xl">
              {title}
            </h2>
            <p className="fr-text-t3 max-w-3xl text-sm leading-relaxed">{subtitle}</p>
          </header>
          <span className={`${PILL_BASE} ${sectionVisual.pillClass}`}>{props.statusLabel}</span>
        </div>

        {props.missingStateMessage ? (
          <div className="fr-card fr-card--warning fr-accent-l--warning px-4 py-3 text-sm leading-relaxed">
            <p className="fr-text-t3">{props.missingStateMessage}</p>
          </div>
        ) : null}

        {props.rows.length > 0 ? (
          <div className="space-y-4">
            {proofRows.length > 0 ? (
              <div className="space-y-2">
                {proofRows.map((row) => (
                  <ProofRow key={row.id} row={row} />
                ))}
              </div>
            ) : null}

            {warningRows.length > 0 ? (
              <div className="space-y-3">
                {warningRows.map((row) => (
                  <WarningAlertCard key={row.id} row={row} />
                ))}
              </div>
            ) : null}

            {criticalRows.length > 0 ? (
              <div className="space-y-3">
                {criticalRows.map((row) => (
                  <CriticalAlertCard key={row.id} row={row} />
                ))}
              </div>
            ) : null}

            {quietRows.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {quietRows.map((row) => (
                  <QuietRow key={row.id} row={row} />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <p className="fr-text-t3 border-l-2 border-[hsl(var(--fr-border))] pl-3 text-xs leading-relaxed">
          <span className="font-semibold text-[hsl(var(--fr-text-muted))]">Why it matters:</span>{" "}
          {whyItMatters}
        </p>

        {props.footerBadges && props.footerBadges.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {props.footerBadges.map((badge) => (
              <span
                key={badge}
                className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--fr-border))] bg-slate-900/60 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wide text-[hsl(var(--fr-text-dim))]"
              >
                <Scale size={10} aria-hidden />
                {badge}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
