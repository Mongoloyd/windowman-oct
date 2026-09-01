import { ArrowDown, CircleSlash2, Minus, TrendingDown, TrendingUp } from "lucide-react";
import {
  formatBasisPoints,
  formatCents,
  type InternalIntelligenceViewModel,
  type MoneyStageViewModel,
} from "../adapter";

function StageWell({
  stage,
  provenance,
  tone,
}: {
  stage: MoneyStageViewModel;
  provenance: string;
  tone: "quoted" | "verified";
}) {
  const toneClasses = tone === "quoted"
    ? "border-[#4A92F9]/35 bg-[#102B50] text-[#DCEBFF]"
    : "border-[#35D399]/30 bg-[#0C3240] text-[#D8FFF0]";

  return (
    <article className={`rounded-xl border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${toneClasses}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.12em] opacity-80">{provenance}</p>
          <h3 className="mt-1 text-sm font-black text-white">{stage.label}</h3>
        </div>
        <p className="font-mono text-xl font-black tabular-nums tracking-[-0.04em] text-white">{formatCents(stage.medianCents)}</p>
      </div>
      <p className="mt-3 border-t border-white/10 pt-2 font-mono text-[11px] font-bold tabular-nums opacity-85">Eligible sample n={stage.sampleCount}</p>
    </article>
  );
}

function Relationship({
  label,
  cents,
  basisPoints,
  supported,
}: {
  label: string;
  cents: number | null;
  basisPoints: number | null;
  supported: boolean;
}) {
  const isIncrease = supported && (cents ?? 0) > 0;
  const isDecrease = supported && (cents ?? 0) < 0;
  const Icon = !supported ? CircleSlash2 : isIncrease ? TrendingUp : isDecrease ? TrendingDown : Minus;

  return (
    <div
      className={supported ? "rounded-xl border border-[#35D399]/30 bg-[#0C3240] p-3.5" : "rounded-xl border border-dashed border-slate-400/40 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.035)_0,rgba(255,255,255,0.035)_8px,transparent_8px,transparent_16px)] p-3.5"}
      data-testid={supported ? "supported-stage-relationship" : "withheld-stage-relationship"}
    >
      <div className="flex items-start gap-3">
        <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${supported ? "border-[#35D399]/35 bg-[#35D399]/10 text-[#8FF0C9]" : "border-slate-400/35 bg-slate-400/10 text-slate-300"}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.12em] text-slate-300">{label}</p>
          <p className="mt-1 font-mono text-sm font-black tabular-nums text-white">{supported ? `${formatCents(cents)} · ${formatBasisPoints(basisPoints)}` : "INSUFFICIENT_DATA"}</p>
          <p className="mt-1 text-xs font-medium leading-5 text-slate-300">{supported ? "Same verified-sold population across accepted and final stages." : "Population pairing is not established; no movement is calculated."}</p>
        </div>
      </div>
    </div>
  );
}
export function QuotePurchaseJourney({
  viewModel,
}: {
  viewModel: InternalIntelligenceViewModel;
}) {
  const [initialStage, acceptedStage, finalStage] = viewModel.moneyStages;
  const initialToAcceptedSupported =
    viewModel.initialToAcceptedDeltaCents !== null &&
    viewModel.initialToAcceptedDeltaBasisPoints !== null;
  const acceptedToFinalSupported =
    viewModel.acceptedToFinalDeltaCents !== null &&
    viewModel.acceptedToFinalDeltaBasisPoints !== null;

  return (
    <section className="rounded-2xl border border-white/15 bg-[#0D2444] p-4 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.09)] sm:p-5">
      <p className="font-mono text-[10px] font-black uppercase tracking-[0.13em] text-[#A7C7F5]">
        Quote-to-purchase evidence
      </p>
      <h2 className="mt-2 text-xl font-black tracking-tight text-white">
        Three prices, never one “sold price”
      </h2>
      <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-300">
        Initial quote evidence stays separate from the verified purchase chain. Only supported stage relationships receive a calculated movement.
      </p>

      <div className="mt-5 grid gap-3">
        <div>
          <p className="mb-2 font-mono text-[10px] font-black uppercase tracking-[0.12em] text-slate-300">Observed baseline</p>
          <StageWell stage={initialStage} provenance="Quoted population" tone="quoted" />
        </div>

        <div className="flex justify-center text-slate-400" aria-hidden>
          <ArrowDown className="h-5 w-5" />
        </div>

        <Relationship
          label="Initial → accepted"
          cents={viewModel.initialToAcceptedDeltaCents}
          basisPoints={viewModel.initialToAcceptedDeltaBasisPoints}
          supported={initialToAcceptedSupported}
        />

        <div className="mt-1 rounded-2xl border border-[#35D399]/25 bg-[#071C3E] p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.12em] text-[#8FF0C9]">Verified purchase chain</p>
            <p className="font-mono text-[10px] font-bold tabular-nums text-slate-300">Matched population n={Math.min(acceptedStage.sampleCount, finalStage.sampleCount)}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <StageWell stage={acceptedStage} provenance="Verified accepted" tone="verified" />
            <StageWell stage={finalStage} provenance="Verified final" tone="verified" />
          </div>
          <div className="mt-2">
            <Relationship
              label="Accepted → final"
              cents={viewModel.acceptedToFinalDeltaCents}
              basisPoints={viewModel.acceptedToFinalDeltaBasisPoints}
              supported={acceptedToFinalSupported}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-white/10 pt-4 text-sm font-medium leading-6 text-slate-300">
        <p>{viewModel.insight}</p>
      </div>
    </section>
  );
}
