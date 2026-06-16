import { MessageSquareQuote } from "lucide-react";

const EXAMPLE_QUESTION =
  "“Can you confirm whether trim, disposal, permit fees, inspection corrections, product approvals, and final balance triggers are included in this price?”";

export function NextdoorContractorQuestionCard() {
  return (
    <section
      id="contractor-callback"
      className="scroll-mt-24"
      aria-labelledby="contractor-callback-heading"
    >
      <div className="overflow-hidden rounded-2xl border border-slate-300/80 bg-white shadow-[0_20px_50px_-24px_rgba(15,40,90,0.35)]">
        <div className="border-b border-slate-800/10 bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-4 md:px-6">
          <div className="flex items-center gap-2">
            <MessageSquareQuote className="h-4 w-4 text-[#5fd6ec]" aria-hidden="true" />
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Callback script tease
            </p>
          </div>
          <h2
            id="contractor-callback-heading"
            className="mt-2 font-display text-xl font-extrabold text-white md:text-2xl"
          >
            Know what to ask back without sounding confrontational.
          </h2>
        </div>

        <div className="bg-gradient-to-b from-slate-50 to-white p-5 md:p-6">
          <blockquote className="rounded-xl border border-slate-200/90 bg-white px-4 py-4 shadow-[inset_0_2px_6px_rgba(15,40,90,0.04)]">
            <p className="font-display text-sm font-medium italic leading-relaxed text-slate-800 md:text-base">
              {EXAMPLE_QUESTION}
            </p>
          </blockquote>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            The goal is not to fight the contractor. The goal is to make the quote clear enough to
            compare.
          </p>
        </div>
      </div>
    </section>
  );
}
