/**
 * ScopeGapChecklist — Install-Day Coverage Map (lab-only, fixture-driven).
 */
import type {
  ScopeGapChecklistProps,
  ScopeGapItem,
  ScopeGapPhase,
  ScopeGapState,
  ScopeGapSummaryCounts,
} from "./ScopeGapChecklist.types";
import { FR } from "./tokens";

const DEFAULT_TITLE = "What may not be included when install day arrives";
const DEFAULT_SUBTITLE =
  "WindowMan checked the parsed quote for install-day responsibilities that often create surprise costs after signing.";
const DEFAULT_OCR_DISCLAIMER =
  "This reflects what WindowMan detected in the parsed quote. Supporting documents or later contractor revisions may contain additional details.";

const CONFIRMATION_STATES: ScopeGapState[] = ["excluded", "unclear", "not_detected"];
const MAX_VISIBLE_QUESTIONS = 8;

const STATE_PRIORITY: Record<ScopeGapState, number> = {
  excluded: 0,
  unclear: 1,
  not_detected: 2,
  included: 3,
  not_applicable: 4,
};

function isNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function resolvePhases(phases: ScopeGapChecklistProps["phases"]): ScopeGapPhase[] {
  return Array.isArray(phases) ? phases : [];
}

function computeSummaryFromPhases(phases: ScopeGapPhase[]): ScopeGapSummaryCounts {
  const items = phases.flatMap((phase) => phase.items);
  const included = items.filter((item) => item.state === "included").length;
  const unclear = items.filter((item) => item.state === "unclear").length;
  const notDetected = items.filter((item) => item.state === "not_detected").length;
  const excluded = items.filter((item) => item.state === "excluded").length;
  const notApplicable = items.filter((item) => item.state === "not_applicable").length;
  return {
    included,
    unclear,
    notDetected,
    excluded,
    notApplicable,
    needsConfirmation: unclear + notDetected + excluded,
  };
}

function stateBadgeClass(state: ScopeGapState): string {
  const base = "inline-flex shrink-0 rounded-md px-2 py-0.5 text-xs font-medium border";
  switch (state) {
    case "included":
      return `${base} border-emerald-500/40 text-emerald-300 bg-emerald-950/30`;
    case "not_detected":
      return `${base} border-neutral-700 text-neutral-400 bg-neutral-900/40`;
    case "excluded":
      return `${base} border-amber-600/40 text-amber-300 bg-amber-950/20`;
    case "unclear":
      return `${base} border-cyan-500/40 text-cyan-300 bg-cyan-950/20`;
    case "not_applicable":
    default:
      return `${base} border-neutral-800 text-neutral-600 bg-transparent`;
  }
}

function showContractorQuestion(state: ScopeGapState): boolean {
  return state === "not_detected" || state === "unclear" || state === "excluded";
}

function buildConfirmationQuestions(phases: ScopeGapPhase[]): {
  visible: string[];
  hasMore: boolean;
} {
  const candidates = phases
    .flatMap((phase) => phase.items)
    .filter((item) => CONFIRMATION_STATES.includes(item.state))
    .filter((item) => isNonEmptyString(item.contractorQuestion))
    .filter(
      (item) =>
        item.contractorQuestion.trim() !== "No confirmation question is required for this item.",
    )
    .sort((a, b) => STATE_PRIORITY[a.state] - STATE_PRIORITY[b.state]);

  const seen = new Set<string>();
  const uniqueQuestions: string[] = [];

  for (const item of candidates) {
    const key = `${item.fieldKey}::${item.contractorQuestion}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueQuestions.push(item.contractorQuestion);
  }

  const hasMore = uniqueQuestions.length > MAX_VISIBLE_QUESTIONS;
  return {
    visible: uniqueQuestions.slice(0, MAX_VISIBLE_QUESTIONS),
    hasMore,
  };
}

function ChecklistHeader({
  title,
  subtitle,
  ocrDisclaimer,
}: {
  title: string;
  subtitle: string;
  ocrDisclaimer: string;
}) {
  return (
    <header className="space-y-2 min-w-0">
      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[hsl(var(--fr-cyan))]">
        SCOPE GAP CHECKLIST
      </p>
      <h2 id="sgc-title" className="text-xl sm:text-2xl font-bold text-[hsl(var(--fr-text))]">
        {title}
      </h2>
      <p className="text-sm text-[hsl(var(--fr-text-muted))] leading-relaxed max-w-3xl">
        {subtitle}
      </p>
      <p className="text-xs text-neutral-400 leading-relaxed border-l-2 border-[hsl(var(--fr-border))] pl-3">
        {ocrDisclaimer}
      </p>
      <p className="text-xs text-neutral-400 leading-relaxed">
        <span className="font-semibold text-[hsl(var(--fr-text-muted))]">Install-Day Coverage Map:</span>{" "}
        WindowMan checked which install-day responsibilities were clearly written into the parsed quote
        — and which ones still need written confirmation before signing.
      </p>
    </header>
  );
}

function SummaryRail({ summary }: { summary: ScopeGapSummaryCounts }) {
  const chips = [
    { label: "Written coverage", value: summary.included },
    { label: "Needs clarity", value: summary.unclear },
    { label: "Not detected", value: summary.notDetected },
    { label: "Explicitly excluded", value: summary.excluded },
    { label: "Not applicable", value: summary.notApplicable },
  ];

  return (
    <aside
      className="min-w-0 space-y-3 lg:sticky lg:top-6 lg:h-fit lg:self-start rounded-xl border border-[hsl(var(--fr-border))] bg-slate-900/60 p-4 sm:p-5"
      aria-label="Install-day coverage summary"
    >
      <h3 className="text-[10px] font-mono uppercase tracking-[0.15em] text-[hsl(var(--fr-text-dim))]">
        Coverage summary
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {chips.map((chip) => (
          <div
            key={chip.label}
            className="min-w-0 rounded-lg border border-[hsl(var(--fr-border))] bg-slate-950/50 px-3 py-2"
          >
            <span className="block text-[10px] uppercase tracking-wide text-neutral-500">
              {chip.label}
            </span>
            <span className="mt-0.5 block text-lg font-semibold tabular-nums text-[hsl(var(--fr-text))]">
              {chip.value}
            </span>
          </div>
        ))}
      </div>
      {summary.needsConfirmation > 0 ? (
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/20 px-3 py-2">
          <span className="text-[10px] uppercase tracking-wide text-cyan-300/90">
            Needs written confirmation
          </span>
          <span className="mt-0.5 block text-sm font-semibold tabular-nums text-cyan-100">
            {summary.needsConfirmation}
          </span>
        </div>
      ) : null}
      <p className="text-xs text-neutral-500 leading-relaxed">
        Responsibility exposure from parsed quote language — not a cost estimate.
      </p>
    </aside>
  );
}

function ScopeGapMicroCard({ item }: { item: ScopeGapItem }) {
  const riskClass =
    item.state === "not_detected"
      ? "text-neutral-300"
      : item.state === "not_applicable"
        ? "text-neutral-500"
        : "text-[hsl(var(--fr-text-muted))]";

  return (
    <article className="min-w-0 break-words rounded-lg border border-[hsl(var(--fr-border))] bg-slate-900/50 p-4 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between min-w-0">
        <h4 className="text-sm font-semibold text-[hsl(var(--fr-text))]">{item.label}</h4>
        <span className={stateBadgeClass(item.state)}>{item.statusLabel}</span>
      </div>
      {isNonEmptyString(item.evidenceText) ? (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-neutral-500 mb-1">
            Parsed quote evidence
          </p>
          <p className="text-xs text-neutral-400 leading-relaxed whitespace-pre-wrap break-words">
            {item.evidenceText}
          </p>
        </div>
      ) : null}
      <div>
        <p className="text-[10px] uppercase tracking-wide text-neutral-500 mb-1">
          Homeowner read
        </p>
        <p className={`text-sm leading-relaxed break-words ${riskClass}`}>
          {item.homeownerRiskCopy}
        </p>
      </div>
      {showContractorQuestion(item.state) ? (
        <div className="border-l-2 border-[hsl(var(--fr-border))] pl-3">
          <p className="text-[10px] uppercase tracking-wide text-neutral-500 mb-1">
            Ask contractor to confirm in writing
          </p>
          <p className="text-sm text-[hsl(var(--fr-text))] leading-relaxed break-words">
            {item.contractorQuestion}
          </p>
        </div>
      ) : null}
    </article>
  );
}

function TimelineJourney({ phases }: { phases: ScopeGapPhase[] }) {
  if (phases.length === 0) {
    return (
      <div
        role="status"
        className="rounded-lg border border-[hsl(var(--fr-border))] bg-slate-900/40 p-8 text-center"
      >
        <p className="text-sm text-[hsl(var(--fr-text-muted))] leading-relaxed">
          No install-day coverage phases are available for this fixture.
        </p>
      </div>
    );
  }

  return (
    <ol role="list" className="relative min-w-0 space-y-8 border-l border-[hsl(var(--fr-border))] ml-3 pl-6 sm:ml-4 sm:pl-8">
      {phases.map((phase, index) => (
        <li key={phase.id} role="listitem" className="relative min-w-0">
          <span
            className="absolute -left-[1.6rem] sm:-left-[2.1rem] flex h-8 w-8 items-center justify-center rounded-full border border-[hsl(var(--fr-cyan))]/50 bg-slate-950 text-xs font-bold text-[hsl(var(--fr-cyan))]"
            aria-hidden
          >
            {index + 1}
          </span>
          <div className="space-y-3 min-w-0">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[hsl(var(--fr-text))]">
                {phase.title}
              </h3>
              {isNonEmptyString(phase.subtitle) ? (
                <p className="mt-1 text-sm text-neutral-400 leading-relaxed">{phase.subtitle}</p>
              ) : null}
            </div>
            {phase.items.length === 0 ? (
              <p className="text-sm text-neutral-400 leading-relaxed">
                No install-day checks in this phase for this fixture.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-1">
                {phase.items.map((item) => (
                  <ScopeGapMicroCard key={`${phase.id}-${item.fieldKey}-${item.state}`} item={item} />
                ))}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function ConfirmationPacket({
  phases,
}: {
  phases: ScopeGapPhase[];
}) {
  const { visible, hasMore } = buildConfirmationQuestions(phases);

  if (visible.length === 0) {
    return null;
  }

  return (
    <div className="min-w-0 rounded-lg border border-[hsl(var(--fr-border))] bg-slate-950/50 p-5 sm:p-6">
      <p className="text-sm text-neutral-400 leading-relaxed mb-3">
        Before signing, ask the contractor to confirm these items in writing.
      </p>
      <h3 className="text-base font-bold text-[hsl(var(--fr-text))]">
        Contractor Confirmation Packet
      </h3>
      <ul
        role="list"
        className="mt-3 space-y-3 list-none text-sm text-[hsl(var(--fr-text-muted))]"
      >
        {visible.map((question) => (
          <li
            key={question}
            className="leading-relaxed break-words border-l-2 border-cyan-500/30 pl-3 text-neutral-300"
          >
            {question}
          </li>
        ))}
      </ul>
      {hasMore ? (
        <p className="mt-3 text-xs text-neutral-500 leading-relaxed">
          Additional confirmation questions may apply based on the full scope.
        </p>
      ) : null}
    </div>
  );
}

export default function ScopeGapChecklist(
  props: ScopeGapChecklistProps & { suppressFooterChecklist?: boolean },
) {
  const phases = resolvePhases(props.phases);
  const summary = computeSummaryFromPhases(phases);
  const title = isNonEmptyString(props.title) ? props.title : DEFAULT_TITLE;
  const subtitle = isNonEmptyString(props.subtitle) ? props.subtitle : DEFAULT_SUBTITLE;
  const ocrDisclaimer = isNonEmptyString(props.ocrDisclaimer)
    ? props.ocrDisclaimer
    : DEFAULT_OCR_DISCLAIMER;

  return (
    <section
      className={`report-dark ${FR.cardPad} rounded-xl border border-[hsl(var(--fr-border))] bg-slate-950/70 ${FR.sectionGap} min-w-0`}
      aria-labelledby="sgc-title"
    >
      <ChecklistHeader title={title} subtitle={subtitle} ocrDisclaimer={ocrDisclaimer} />

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6 lg:items-start min-w-0">
        <div className="order-1 lg:order-2 min-w-0">
          <SummaryRail summary={summary} />
        </div>
        <div className="order-2 lg:order-1 min-w-0 space-y-8">
          <TimelineJourney phases={phases} />
          {props.suppressFooterChecklist ? null : <ConfirmationPacket phases={phases} />}
        </div>
      </div>
    </section>
  );
}
