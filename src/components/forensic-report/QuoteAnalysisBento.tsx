import {
  BadgeCheck,
  CircleDashed,
  FileSearch2,
  Gauge,
  OctagonAlert,
  TriangleAlert,
} from "lucide-react";
import type { PillarScore } from "@/hooks/useAnalysisData";
import { formatContractorName } from "./utils/formatContractorName";

type PriceBand = "low" | "market" | "high" | "extreme";
type CanonicalPillarKey =
  | "safety_code"
  | "install_scope"
  | "price_fairness"
  | "fine_print"
  | "warranty";

interface QuoteAnalysisBentoProps {
  contractorName?: string | null;
  pillarScores?: readonly PillarScore[];
  pricePerOpeningBand?: PriceBand | null;
  hasWarranty?: boolean | null;
  hasPermits?: boolean | null;
  flagRedCount?: number | null;
  flagAmberCount?: number | null;
}

const CANONICAL_PILLARS: ReadonlyArray<{
  key: CanonicalPillarKey;
  label: string;
}> = [
  { key: "safety_code", label: "Safety & Code" },
  { key: "install_scope", label: "Installation Scope" },
  { key: "price_fairness", label: "Price Clarity" },
  { key: "fine_print", label: "Fine Print" },
  { key: "warranty", label: "Warranty Coverage" },
];

const PRICE_BANDS = [
  { key: "lower", label: "Lower", position: "16.6667%" },
  { key: "typical", label: "Typical", position: "50%" },
  { key: "elevated", label: "Elevated", position: "83.3333%" },
] as const;

type PreviewPriceBand = (typeof PRICE_BANDS)[number]["key"];
type PillarStatus = PillarScore["status"];

function isPillarStatus(value: unknown): value is PillarStatus {
  return value === "pass" || value === "warn" || value === "fail" || value === "pending";
}

function isCanonicalPillarKey(value: unknown): value is CanonicalPillarKey {
  return CANONICAL_PILLARS.some(({ key }) => key === value);
}

function normalizedPillarStatuses(
  pillarScores: readonly PillarScore[] | undefined,
): Map<CanonicalPillarKey, PillarStatus> {
  const normalized = new Map<CanonicalPillarKey, PillarStatus>(
    CANONICAL_PILLARS.map(({ key }) => [key, "pending"]),
  );
  const seen = new Set<CanonicalPillarKey>();
  const duplicated = new Set<CanonicalPillarKey>();

  for (const pillar of pillarScores ?? []) {
    if (!isCanonicalPillarKey(pillar?.key) || !isPillarStatus(pillar?.status)) continue;

    if (seen.has(pillar.key)) {
      duplicated.add(pillar.key);
      normalized.set(pillar.key, "pending");
      continue;
    }

    seen.add(pillar.key);
    if (!duplicated.has(pillar.key)) normalized.set(pillar.key, pillar.status);
  }

  return normalized;
}

function previewPriceBand(value: QuoteAnalysisBentoProps["pricePerOpeningBand"]): PreviewPriceBand | null {
  if (value === "low") return "lower";
  if (value === "market") return "typical";
  if (value === "high" || value === "extreme") return "elevated";
  return null;
}

function priorityFindings(statuses: Map<CanonicalPillarKey, PillarStatus>) {
  return (["fail", "warn"] as const)
    .flatMap((status) =>
      CANONICAL_PILLARS.flatMap((pillar) =>
        statuses.get(pillar.key) === status ? [{ ...pillar, status }] : [],
      ),
    )
    .slice(0, 2);
}

function statusPresentation(status: "fail" | "warn") {
  if (status === "fail") {
    return {
      label: "Material concern",
      Icon: OctagonAlert,
      iconClass: "text-red-400",
      labelClass: "text-red-300",
      railClass: "bg-red-400/80",
    };
  }

  return {
    label: "Clarification needed",
    Icon: TriangleAlert,
    iconClass: "text-amber-300",
    labelClass: "text-amber-200",
    railClass: "bg-amber-300/80",
  };
}

function estimateLabel(contractorName: string | null): string {
  return contractorName ? `${contractorName}’s estimate` : "this estimate";
}

function safeAggregateCount(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
}

export default function QuoteAnalysisBento({
  contractorName,
  pillarScores,
  pricePerOpeningBand,
  hasWarranty,
  hasPermits,
  flagRedCount,
  flagAmberCount,
}: QuoteAnalysisBentoProps) {
  const statuses = normalizedPillarStatuses(pillarScores);
  const priorities = priorityFindings(statuses);
  const totalReviewCount = safeAggregateCount(flagRedCount) + safeAggregateCount(flagAmberCount);
  const showPriorityFindings = priorities.length > 0 && totalReviewCount > 0;
  const allPillarsPass = CANONICAL_PILLARS.every(({ key }) => statuses.get(key) === "pass");
  const allClear = allPillarsPass && totalReviewCount === 0;
  const cleanName = formatContractorName(contractorName);
  const activePriceBand = previewPriceBand(pricePerOpeningBand);
  const activeBand = PRICE_BANDS.find(({ key }) => key === activePriceBand) ?? null;
  const documentationSignals = [
    hasWarranty == null
      ? null
      : { key: "warranty", label: "Warranty terms", detected: hasWarranty },
    hasPermits == null
      ? null
      : { key: "permits", label: "Permit language", detected: hasPermits },
  ].filter(
    (signal): signal is { key: string; label: string; detected: boolean } => signal !== null,
  );
  const hasContext = activeBand != null || documentationSignals.length > 0;

  return (
    <section
      aria-label="Quote analysis snapshot"
      className="relative isolate overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950/75 shadow-[0_24px_60px_-38px_rgba(15,23,42,0.95),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md"
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-80"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(70% 120% at 0% 0%, hsl(var(--fr-cyan) / 0.10), transparent 62%), radial-gradient(45% 100% at 100% 100%, hsl(var(--fr-caution) / 0.05), transparent 70%)",
        }}
      />

      <div className="grid min-w-0 grid-cols-1 lg:grid-cols-12">
        <div
          className={`min-w-0 p-5 sm:p-6 lg:p-7 ${hasContext ? "lg:col-span-7" : "lg:col-span-12"}`}
        >
          <div className="flex items-center gap-2 text-[hsl(var(--fr-cyan))]">
            <FileSearch2 size={15} aria-hidden="true" />
            <h2 className="fr-mono text-xs font-bold uppercase tracking-[0.14em]">
              Quote Analysis Snapshot
            </h2>
          </div>

          {showPriorityFindings ? (
            <>
              <p className="mt-4 max-w-2xl break-words text-lg font-semibold leading-snug text-white [overflow-wrap:anywhere] sm:text-xl">
                We analyzed {estimateLabel(cleanName)}.
              </p>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-400">
                Focus first on the highest-priority documented areas before signing.
              </p>

              <dl className="mt-5 divide-y divide-slate-800/90 border-y border-slate-800/90">
                {priorities.map((priority) => {
                  const presentation = statusPresentation(priority.status);
                  const StatusIcon = presentation.Icon;
                  return (
                    <div
                      key={priority.key}
                      className="relative flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 pl-3.5"
                    >
                      <span
                        className={`absolute inset-y-3 left-0 w-0.5 rounded-full ${presentation.railClass}`}
                        aria-hidden="true"
                      />
                      <dt className="min-w-0 text-sm font-semibold text-slate-100">
                        {priority.label}
                      </dt>
                      <dd
                        className={`inline-flex shrink-0 items-center gap-1.5 text-right text-xs font-semibold leading-snug sm:text-sm ${presentation.labelClass}`}
                      >
                        <StatusIcon size={15} className={presentation.iconClass} aria-hidden="true" />
                        {presentation.label}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </>
          ) : allClear ? (
            <div className="mt-5 max-w-2xl">
              <div className="flex items-start gap-3">
                <BadgeCheck size={24} className="mt-0.5 shrink-0 text-emerald-300" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="break-words text-lg font-semibold leading-snug text-white [overflow-wrap:anywhere] sm:text-xl">
                    All five documented quote categories appear clear in this preview.
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    The full analysis adds supporting context and the questions worth confirming before signing.
                  </p>
                </div>
              </div>
            </div>
          ) : allPillarsPass && totalReviewCount > 0 ? (
            <div className="mt-5 max-w-2xl">
              <div className="flex items-start gap-3">
                <CircleDashed size={23} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-lg font-semibold leading-snug text-white sm:text-xl">
                    Review items were identified.
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    Category-level details are available in the full analysis.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 max-w-2xl">
              <div className="flex items-start gap-3">
                <CircleDashed size={23} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-lg font-semibold leading-snug text-white sm:text-xl">
                    Category-level review is not available in this preview.
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    Your document summary remains available above; no missing category is treated as clear.
                  </p>
                </div>
              </div>
            </div>
          )}

          <p className="mt-5 text-sm leading-relaxed text-[#aab3c0]">
            This snapshot evaluates what is documented in the quote, not the contractor’s workmanship or professional quality.
          </p>
        </div>

        {hasContext ? (
          <div className="min-w-0 border-t border-slate-800/90 bg-slate-900/25 lg:col-span-5 lg:border-l lg:border-t-0">
            {activeBand && activePriceBand ? (
              <div className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-200">
                    <Gauge size={15} className="text-[hsl(var(--fr-cyan))]" aria-hidden="true" />
                    Quote price band
                  </span>
                  <span className="fr-mono text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
                    {activeBand.label}
                  </span>
                </div>

                <div
                  className="mt-5"
                  role="img"
                  aria-label={`Quote price band: ${activeBand.label}`}
                >
                  <div className="relative h-5">
                    <div className="absolute left-0 right-0 top-2 h-1.5 overflow-hidden rounded-full bg-gradient-to-r from-cyan-400/65 via-emerald-400/55 to-amber-300/70 shadow-[inset_0_1px_2px_rgba(2,6,23,0.8)]" />
                    <span
                      className="absolute top-0 h-5 w-1.5 -translate-x-1/2 rounded-full border border-white/70 bg-white shadow-[0_0_12px_rgba(255,255,255,0.55)]"
                      style={{ left: activeBand.position }}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="mt-1.5 grid grid-cols-3 text-xs font-medium uppercase tracking-[0.06em] text-slate-400">
                    {PRICE_BANDS.map((band) => (
                      <span
                        key={band.key}
                        className={`text-center ${band.key === activePriceBand ? "font-bold text-slate-200" : ""}`}
                      >
                        {band.label}
                        {band.key === activePriceBand ? <span className="sr-only"> (current)</span> : null}
                      </span>
                    ))}
                  </div>
                </div>

                <p className="mt-4 text-sm leading-relaxed text-[#aab3c0]">
                  Broad quoted-price category, not a localized market appraisal.
                </p>
              </div>
            ) : null}

            {documentationSignals.length > 0 ? (
              <div className={`p-5 sm:p-6 ${activeBand ? "border-t border-slate-800/90" : ""}`}>
                <p className="fr-mono text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                  Document signals
                </p>
                <dl className="mt-2.5 divide-y divide-slate-800/90">
                  {documentationSignals.map((signal) => {
                    const SignalIcon = signal.detected ? BadgeCheck : CircleDashed;
                    return (
                      <div
                        key={signal.key}
                        className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5"
                      >
                        <dt className="min-w-0 text-sm font-medium text-slate-300">
                          {signal.label}
                        </dt>
                        <dd
                          className={`inline-flex shrink-0 items-center gap-1.5 text-right text-xs font-semibold leading-snug sm:text-sm ${
                            signal.detected ? "text-emerald-300" : "text-amber-200"
                          }`}
                        >
                          <SignalIcon size={14} aria-hidden="true" />
                          {signal.detected ? "Mentioned in quote" : "Not documented in quote"}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
