import type { QuoteReadiness } from "./types";
import { pathSummaryCopy } from "@/lib/nextdoor/pathRouter";

type Props = {
  readiness: QuoteReadiness;
};

export function NextdoorPathSummary({ readiness }: Props) {
  const { pathLabel, nextHint } = pathSummaryCopy(readiness);

  return (
    <div
      className="rounded-xl border border-[#06b6d4]/25 bg-gradient-to-r from-[#06b6d4]/5 via-white to-white px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_24px_-16px_rgba(6,182,212,0.25)] md:px-5"
      aria-live="polite"
      aria-atomic="true"
    >
      <p className="text-sm leading-relaxed text-slate-800">
        <span className="font-semibold text-slate-900">Path selected:</span>{" "}
        {pathLabel}
        <span className="mx-1.5 text-slate-400" aria-hidden="true">
          ·
        </span>
        <span className="font-semibold text-slate-900">Next:</span> {nextHint}.
      </p>
    </div>
  );
}
