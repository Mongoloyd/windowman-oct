/**
 * WarrantyFinePrintSection — lab-only warranty and fine-print clarity review.
 */
import { FileText } from "lucide-react";
import type {
  ForensicRowSeverity,
  WarrantyFinePrintRow,
  WarrantyFinePrintSectionProps,
  WarrantyFinePrintStatus,
} from "./WarrantyFinePrintSection.types";

const DEFAULT_TITLE = "Warranty & Fine Print";
const DEFAULT_SUBTITLE =
  "Does the quote clearly show warranty coverage and the fine-print terms that can affect homeowner protection?";
const DEFAULT_WHY =
  "A warranty is only useful if the quote clearly states what is covered, who backs it, and how long it lasts. This is a document clarity review, not a legal opinion.";

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

function statusPillClass(status: WarrantyFinePrintStatus): string {
  const base = "inline-flex shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold border";
  switch (status) {
    case "protected":
      return `${base} border-emerald-500/40 text-emerald-300 bg-emerald-950/30`;
    case "partial":
      return `${base} border-amber-500/40 text-amber-300 bg-amber-950/30`;
    case "exposed":
      return `${base} border-red-500/40 text-red-300 bg-red-950/30`;
    case "unclear":
    default:
      return `${base} border-cyan-500/40 text-cyan-300 bg-cyan-950/20`;
  }
}

function rowStatusClass(status: WarrantyFinePrintRow["status"]): string {
  switch (status) {
    case "protected":
      return "border-emerald-500/25";
    case "partial":
      return "border-amber-500/25";
    case "exposed":
      return "border-red-500/25";
    case "unclear":
    default:
      return "border-[hsl(var(--fr-border))]";
  }
}

function rowBadgeClass(severity: ForensicRowSeverity | undefined): string {
  const base = "inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium border";
  switch (severity) {
    case "danger":
      return `${base} border-red-500/40 text-red-300 bg-red-950/30`;
    case "warning":
      return `${base} border-amber-500/40 text-amber-300 bg-amber-950/30`;
    case "info":
      return `${base} border-cyan-500/40 text-cyan-300 bg-cyan-950/20`;
    case "neutral":
    default:
      return `${base} border-neutral-500/40 text-neutral-300 bg-neutral-950/30`;
  }
}

function statusBadgeLabel(status: WarrantyFinePrintRow["status"]): string {
  switch (status) {
    case "protected":
      return "Documented";
    case "partial":
      return "Partial";
    case "exposed":
      return "Needs Verification";
    case "unclear":
    default:
      return "Unclear";
  }
}

function isRenderable(
  props: WarrantyFinePrintSectionProps | null | undefined,
): props is WarrantyFinePrintSectionProps {
  if (!props) return false;
  return (
    Boolean(props.title || props.subtitle) ||
    props.rows.length > 0 ||
    Boolean(props.missingStateMessage)
  );
}

export default function WarrantyFinePrintSection(
  props: WarrantyFinePrintSectionProps | null | undefined,
) {
  if (!isRenderable(props)) return null;

  const title = props.title ?? DEFAULT_TITLE;
  const subtitle = props.subtitle ?? DEFAULT_SUBTITLE;
  const whyItMatters = props.whyItMatters ?? DEFAULT_WHY;

  return (
    <section
      className="fr-card relative overflow-hidden p-5 sm:p-7"
      style={{ borderColor: "hsl(var(--fr-cyan) / 0.26)", fontFamily: FONT_STACK }}
      aria-labelledby="wfps-title"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(90% 70% at 0% 100%, hsl(var(--fr-cyan) / 0.08), transparent 55%), radial-gradient(60% 50% at 100% 0%, hsl(var(--fr-caution) / 0.06), transparent 60%)",
        }}
      />

      <div className="relative space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <header className="space-y-2 min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[hsl(var(--fr-cyan))]">
              WARRANTY & FINE PRINT
            </p>
            <h2 id="wfps-title" className="text-xl sm:text-2xl font-bold text-[hsl(var(--fr-text))]">
              {title}
            </h2>
            <p className="text-sm text-[hsl(var(--fr-text-muted))] leading-relaxed max-w-3xl">
              {subtitle}
            </p>
          </header>
          <span className={statusPillClass(props.status)}>{props.statusLabel}</span>
        </div>

        {props.missingStateMessage ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-950/15 px-4 py-3 text-sm text-amber-200/90 leading-relaxed">
            {props.missingStateMessage}
          </div>
        ) : null}

        {props.rows.length > 0 ? (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {props.rows.map((row) => (
              <div
                key={row.id}
                className={`rounded-lg border bg-slate-950/45 px-4 py-3 backdrop-blur-[2px] ${rowStatusClass(row.status)}`}
                style={{ boxShadow: "inset 0 1px 0 hsl(var(--fr-border) / 0.35)" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <dt className="text-[10px] font-mono uppercase tracking-[0.14em] text-[hsl(var(--fr-text-dim))]">
                    {row.label}
                  </dt>
                  <span className={rowBadgeClass(row.severity)}>{statusBadgeLabel(row.status)}</span>
                </div>
                <dd className="mt-1 text-sm font-semibold text-[hsl(var(--fr-text))]">{row.value}</dd>
                {row.detail ? (
                  <p className="mt-2 text-xs text-[hsl(var(--fr-text-muted))] leading-relaxed">
                    {row.detail}
                  </p>
                ) : null}
                {row.examples && row.examples.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {row.examples.map((example) => (
                      <span
                        key={example}
                        className="inline-flex rounded-md border border-[hsl(var(--fr-border))] bg-slate-900/70 px-2 py-0.5 text-[10px] font-mono text-[hsl(var(--fr-text-muted))]"
                      >
                        {example}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </dl>
        ) : null}

        <p className="text-xs text-[hsl(var(--fr-text-dim))] leading-relaxed border-l-2 border-[hsl(var(--fr-border))] pl-3">
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
                <FileText size={10} />
                {badge}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
