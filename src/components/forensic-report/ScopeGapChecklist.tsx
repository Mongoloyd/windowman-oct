/**
 * ScopeGapChecklist — Install-Day Coverage Map (lab-only, fixture-driven).
 */
import { AlertCircle, CheckCircle2, ClipboardList, HelpCircle } from "lucide-react";
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

const PILL_BASE =
  "inline-flex shrink-0 items-center px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider";

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

function stateVisual(state: ScopeGapState) {
  switch (state) {
    case "included":
      return {
        cardClass: "fr-card fr-card--verified fr-accent-l--verified",
        pillClass: "fr-pill--verified",
        titleClass: "fr-text-t2",
        icon: CheckCircle2,
        iconClass: "text-[hsl(var(--fr-success))]",
      };
    case "excluded":
      return {
        cardClass: "fr-card fr-card--warning fr-accent-l--warning",
        pillClass: "fr-pill--warning",
        titleClass: "fr-text-t2 text-[hsl(var(--fr-caution))]",
        icon: AlertCircle,
        iconClass: "text-[hsl(var(--fr-caution))]",
      };
    case "unclear":
      return {
        cardClass: "fr-card fr-card--warning fr-accent-l--warning",
        pillClass: "fr-pill--info",
        titleClass: "fr-text-t2",
        icon: HelpCircle,
        iconClass: "text-[hsl(var(--fr-cyan))]",
      };
    case "not_detected":
      return {
        cardClass: "fr-card fr-card--quiet",
        pillClass: "fr-pill--unknown",
        titleClass: "fr-text-t2",
        icon: HelpCircle,
        iconClass: "text-[hsl(var(--fr-text-muted))]",
      };
    case "not_applicable":
    default:
      return {
        cardClass: "fr-card fr-card--quiet",
        pillClass: "fr-pill--unknown",
        titleClass: "fr-text-t3",
        icon: HelpCircle,
        iconClass: "text-[hsl(var(--fr-text-dim))]",
      };
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
    <header className="min-w-0 space-y-2">
      <p className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-[hsl(var(--fr-cyan))]">
        <ClipboardList size={12} className="text-[hsl(var(--fr-cyan))]" aria-hidden />
        SCOPE GAP CHECKLIST
      </p>
      <h2 id="sgc-title" className="fr-text-t1 text-xl font-bold sm:text-2xl">
        {title}
      </h2>
      <p className="fr-text-t3 max-w-3xl text-sm leading-relaxed">{subtitle}</p>
      <p className="fr-text-t3 border-l-2 border-[hsl(var(--fr-border))] pl-3 text-xs leading-relaxed">
        {ocrDisclaimer}
      </p>
      <p className="fr-text-t3 text-xs leading-relaxed">
        <span className="font-semibold text-[hsl(var(--fr-text-muted))]">
          Install-Day Coverage Map:
        </span>{" "}
        WindowMan checked which install-day responsibilities were clearly written into the parsed
        quote — and which ones still need written confirmation before signing.
      </p>
    </header>
  );
}

function SummaryRail({ summary }: { summary: ScopeGapSummaryCounts }) {
  const tiles: {
    label: string;
    value: number;
    tileClass: string;
    valueClass: string;
  }[] = [
    {
      label: "Written coverage",
      value: summary.included,
      tileClass: "fr-tile fr-tile--success",
      valueClass: "text-[hsl(var(--fr-success))]",
    },
    {
      label: "Needs clarity",
      value: summary.unclear,
      tileClass: "fr-tile fr-tile--info",
      valueClass: "text-[hsl(var(--fr-cyan))]",
    },
    {
      label: "Not detected",
      value: summary.notDetected,
      tileClass: "fr-tile",
      valueClass: "text-[hsl(var(--fr-text))]",
    },
    {
      label: "Explicitly excluded",
      value: summary.excluded,
      tileClass: "fr-tile fr-tile--warning",
      valueClass: "text-[hsl(var(--fr-caution))]",
    },
    {
      label: "Not applicable",
      value: summary.notApplicable,
      tileClass: "fr-tile",
      valueClass: "text-[hsl(var(--fr-text-dim))]",
    },
  ];

  return (
    <aside
      className="fr-card fr-card-elevated min-w-0 space-y-3 p-4 sm:p-5 lg:sticky lg:top-6 lg:h-fit lg:self-start"
      aria-label="Install-day coverage summary"
    >
      <h3 className="fr-text-t3 text-[10px] font-mono uppercase tracking-[0.15em]">
        Coverage summary
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {tiles.map((tile) => (
          <div key={tile.label} className={`${tile.tileClass} min-w-0 px-3 py-2.5`}>
            <span className="fr-text-t3 block text-[10px] uppercase tracking-wide">
              {tile.label}
            </span>
            <span className={`fr-num mt-0.5 block text-xl font-black ${tile.valueClass}`}>
              {tile.value}
            </span>
          </div>
        ))}
      </div>
      {summary.needsConfirmation > 0 ? (
        <div className="fr-card fr-card--warning fr-accent-l--warning px-3 py-2.5">
          <span className="fr-text-t3 block text-[10px] uppercase tracking-wide text-[hsl(var(--fr-caution))]">
            Needs written confirmation
          </span>
          <span className="fr-num mt-0.5 block text-2xl font-black text-[hsl(var(--fr-caution))]">
            {summary.needsConfirmation}
          </span>
        </div>
      ) : null}
      <p className="fr-text-t3 text-xs leading-relaxed">
        Responsibility exposure from parsed quote language — not a cost estimate.
      </p>
    </aside>
  );
}

function ContractorQuestionCallout({ question }: { question: string }) {
  return (
    <div className="fr-card fr-card--quiet border border-[hsl(var(--fr-cyan)/0.25)] bg-[hsl(var(--fr-cyan)/0.06)] px-3 py-2.5">
      <p className="fr-text-t3 mb-1 text-[10px] uppercase tracking-wide">
        Ask contractor to confirm in writing
      </p>
      <p className="fr-text-t2 text-sm font-medium leading-relaxed break-words">{question}</p>
    </div>
  );
}

function ScopeGapMicroCard({ item }: { item: ScopeGapItem }) {
  const visual = stateVisual(item.state);
  const Icon = visual.icon;
  const riskClass =
    item.state === "not_detected"
      ? "fr-text-t3"
      : item.state === "not_applicable"
        ? "fr-text-t4"
        : "fr-text-t2";

  return (
    <article className={`${visual.cardClass} min-w-0 space-y-3 break-words p-4`}>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <Icon size={15} className={`mt-0.5 shrink-0 ${visual.iconClass}`} aria-hidden />
          <h4 className={`min-w-0 text-sm font-bold sm:text-base ${visual.titleClass}`}>
            {item.label}
          </h4>
        </div>
        <span className={`${PILL_BASE} ${visual.pillClass} ml-auto`} role="status">
          {item.statusLabel}
        </span>
      </div>
      {isNonEmptyString(item.evidenceText) ? (
        <div>
          <p className="fr-text-t3 mb-1 text-[10px] uppercase tracking-wide">
            Parsed quote evidence
          </p>
          <p className="fr-text-t3 text-xs leading-relaxed whitespace-pre-wrap break-words">
            {item.evidenceText}
          </p>
        </div>
      ) : null}
      <div>
        <p className="fr-text-t3 mb-1 text-[10px] uppercase tracking-wide">Homeowner read</p>
        <p className={`text-sm leading-relaxed break-words ${riskClass}`}>
          {item.homeownerRiskCopy}
        </p>
      </div>
      {showContractorQuestion(item.state) ? (
        <ContractorQuestionCallout question={item.contractorQuestion} />
      ) : null}
    </article>
  );
}

function TimelineJourney({ phases }: { phases: ScopeGapPhase[] }) {
  if (phases.length === 0) {
    return (
      <div role="status" className="fr-card fr-card--quiet p-8 text-center">
        <p className="fr-text-t3 text-sm leading-relaxed">
          No install-day coverage phases are available for this fixture.
        </p>
      </div>
    );
  }

  return (
    <ol
      role="list"
      className="relative ml-3 min-w-0 space-y-10 border-l-2 border-[hsl(var(--fr-cyan)/0.35)] pl-6 sm:ml-4 sm:pl-8"
    >
      {phases.map((phase, index) => (
        <li key={phase.id} role="listitem" className="relative min-w-0">
          <span
            className="absolute -left-[1.85rem] flex h-9 w-9 items-center justify-center rounded-full border-2 border-[hsl(var(--fr-cyan)/0.55)] bg-slate-950 text-sm font-black text-[hsl(var(--fr-cyan))] shadow-[0_0_12px_hsl(var(--fr-cyan)/0.2)] sm:-left-[2.35rem]"
            aria-hidden
          >
            {index + 1}
          </span>
          <div className="min-w-0 space-y-3">
            <div>
              <h3 className="fr-text-t1 text-base font-bold sm:text-lg">{phase.title}</h3>
              {isNonEmptyString(phase.subtitle) ? (
                <p className="fr-text-t3 mt-1 text-sm leading-relaxed">{phase.subtitle}</p>
              ) : null}
            </div>
            {phase.items.length === 0 ? (
              <p className="fr-text-t3 text-sm leading-relaxed">
                No install-day checks in this phase for this fixture.
              </p>
            ) : (
              <div className="grid gap-3">
                {phase.items.map((item) => (
                  <ScopeGapMicroCard
                    key={`${phase.id}-${item.fieldKey}-${item.state}`}
                    item={item}
                  />
                ))}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function ConfirmationPacket({ phases }: { phases: ScopeGapPhase[] }) {
  const { visible, hasMore } = buildConfirmationQuestions(phases);

  if (visible.length === 0) {
    return null;
  }

  return (
    <div className="fr-card fr-card--quiet min-w-0 p-5 sm:p-6">
      <p className="fr-text-t3 mb-3 text-sm leading-relaxed">
        Before signing, ask the contractor to confirm these items in writing.
      </p>
      <h3 className="fr-text-t1 text-base font-bold">Contractor Confirmation Packet</h3>
      <ul role="list" className="mt-3 space-y-2">
        {visible.map((question) => (
          <li key={question}>
            <ContractorQuestionCallout question={question} />
          </li>
        ))}
      </ul>
      {hasMore ? (
        <p className="fr-text-t3 mt-3 text-xs leading-relaxed">
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
      className={`report-dark fr-card fr-card-elevated ${FR.cardPad} ${FR.sectionGap} min-w-0`}
      style={{ borderColor: "hsl(var(--fr-cyan) / 0.28)" }}
      aria-labelledby="sgc-title"
    >
      <ChecklistHeader title={title} subtitle={subtitle} ocrDisclaimer={ocrDisclaimer} />

      <div className="flex min-w-0 flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-6">
        <div className="order-1 min-w-0 lg:order-2">
          <SummaryRail summary={summary} />
        </div>
        <div className="order-2 min-w-0 space-y-8 lg:order-1">
          <TimelineJourney phases={phases} />
          {props.suppressFooterChecklist ? null : <ConfirmationPacket phases={phases} />}
        </div>
      </div>
    </section>
  );
}
