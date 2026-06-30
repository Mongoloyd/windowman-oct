/**
 * ContractorQuestionPacket — single consolidated "questions to get a better quote"
 * artifact. Aggregates and de-duplicates the per-module contractor questions that
 * otherwise repeat across the ledger, change-order matrix, and scope-gap checklist.
 *
 * Pure presentation. Receives already-mapped module data; no fetch, no scoring.
 */
import { ClipboardList } from "lucide-react";
import { FR } from "./tokens";
import type { ChangeOrderRiskRow } from "./ChangeOrderDefenseMatrix.types";
import type { ScopeGapPhase, ScopeGapState } from "./ScopeGapChecklist.types";
import type { QuoteMathLedgerLineItem } from "./QuoteMathLedger.types";

interface Props {
  changeOrderRisks?: ChangeOrderRiskRow[] | null;
  scopeGapPhases?: ScopeGapPhase[] | null;
  quoteMathLineItems?: QuoteMathLedgerLineItem[] | null;
}

const MAX_VISIBLE = 12;
const SCOPE_CONFIRMATION_STATES: ScopeGapState[] = ["excluded", "unclear", "not_detected"];
const SCOPE_PLACEHOLDER = "No confirmation question is required for this item.";

const QUOTE_MATH_QUESTIONS = [
  "Ask contractor to confirm NOA numbers.",
  "Ask contractor to confirm DP ratings.",
  "Ask contractor to confirm glass package by opening.",
  "Ask contractor to confirm brand and series per product.",
];

function isNonEmpty(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function lineItemHasProofGap(item: QuoteMathLedgerLineItem): boolean {
  return (
    !isNonEmpty(item.noa_number) ||
    !isNonEmpty(item.dp_rating) ||
    !isNonEmpty(item.brand) ||
    !isNonEmpty(item.series) ||
    !isNonEmpty(item.glass_package_text) ||
    item.glass_spec_complete === false
  );
}

function collectQuestions(props: Props): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();

  const push = (question: string | null | undefined) => {
    if (!isNonEmpty(question)) return;
    if (question.trim() === SCOPE_PLACEHOLDER) return;
    const key = normalize(question);
    if (seen.has(key)) return;
    seen.add(key);
    ordered.push(question.trim());
  };

  // 1. Change-order rows that need attention.
  (props.changeOrderRisks ?? [])
    .filter((row) => row.severity === "warn" || row.severity === "fail" || row.severity === "unknown")
    .forEach((row) => push(row.contractorQuestion));

  // 2. Scope-gap items that need written confirmation.
  (props.scopeGapPhases ?? [])
    .flatMap((phase) => phase.items)
    .filter((item) => SCOPE_CONFIRMATION_STATES.includes(item.state))
    .forEach((item) => push(item.contractorQuestion));

  // 3. Quote-math proof gaps (NOA / DP / product / glass) → static asks.
  const lineItems = props.quoteMathLineItems ?? [];
  if (lineItems.length > 0 && lineItems.some(lineItemHasProofGap)) {
    QUOTE_MATH_QUESTIONS.forEach(push);
  }

  return ordered;
}

export default function ContractorQuestionPacket(props: Props) {
  const questions = collectQuestions(props);

  if (questions.length === 0) return null;

  const visible = questions.slice(0, MAX_VISIBLE);
  const overflow = questions.length - visible.length;

  return (
    <section
      className={`report-dark ${FR.cardPad} rounded-xl border border-[hsl(var(--fr-cyan)/0.4)] bg-slate-950/70 ${FR.sectionGap}`}
      aria-labelledby="cqp-title"
    >
      <header className="space-y-2">
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[hsl(var(--fr-cyan))] flex items-center gap-1.5">
          <ClipboardList size={12} aria-hidden /> Better Quote Toolkit
        </p>
        <h2 id="cqp-title" className="text-xl sm:text-2xl font-bold text-[hsl(var(--fr-text))]">
          Questions to Get a Better Quote
        </h2>
        <p className="text-sm text-[hsl(var(--fr-text-muted))] leading-relaxed max-w-3xl">
          Use these when asking for a revised quote or a safer second opinion.
        </p>
        <p className="text-xs text-[hsl(var(--fr-text-dim))] leading-relaxed border-l-2 border-[hsl(var(--fr-border))] pl-3 max-w-3xl">
          Before you sign, get written answers to these items. The goal is not more paperwork — it is
          a quote that clearly includes the work, materials, permits, and protections you actually need.
        </p>
      </header>

      <ol className="mt-4 space-y-2 list-none">
        {visible.map((question, idx) => (
          <li
            key={`${normalize(question)}-${idx}`}
            className="flex gap-3 rounded-lg border border-[hsl(var(--fr-border))] bg-slate-900/50 px-4 py-3"
          >
            <span className="fr-mono text-xs font-bold text-[hsl(var(--fr-cyan))] mt-0.5">
              {String(idx + 1).padStart(2, "0")}
            </span>
            <span className="text-sm text-[hsl(var(--fr-text))] leading-relaxed break-words">
              {question}
            </span>
          </li>
        ))}
      </ol>

      {overflow > 0 ? (
        <p className="mt-3 text-xs text-[hsl(var(--fr-text-dim))] leading-relaxed">
          +{overflow} more items to clarify before you accept a quote
        </p>
      ) : null}
    </section>
  );
}
