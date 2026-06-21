import { ArrowRight, FileSearch } from "lucide-react";
import { nextdoorEyebrowClass } from "./nextdoorUi";

const BEFORE_ITEMS = [
  "“Install 10 impact windows”",
  "Unclear scope",
  "Unclear permit responsibility",
  "Unclear product/spec proof",
  "Hard to compare against another bid",
] as const;

const AFTER_ITEMS = [
  "Ask what is included.",
  "Ask who handles permits and failed inspections.",
  "Ask which product approvals and DP ratings apply.",
  "Ask what triggers each payment.",
] as const;

export function NextdoorBeforeAfterStrip() {
  return (
    <section
      id="before-after"
      className="scroll-mt-24"
      aria-labelledby="before-after-heading"
    >
      <div className="border-l-4 border-amber-500/50 pl-4 md:pl-5">
        <p className={nextdoorEyebrowClass}>The aha moment</p>
        <h2
          id="before-after-heading"
          className="mt-2 max-w-2xl font-display text-2xl font-extrabold leading-tight text-slate-900 md:text-3xl"
        >
          Before WindowMan, every quote looks like a different language.
        </h2>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
        <div
          className="rounded-2xl border border-red-300/40 bg-gradient-to-br from-red-50/80 via-amber-50/60 to-white p-5 shadow-[0_16px_44px_-20px_rgba(239,68,68,0.28)] md:p-6"
        >
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-red-700/80">
            Before WindowMan
          </p>
          <ul className="mt-4 space-y-2.5" role="list">
            {BEFORE_ITEMS.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 text-sm leading-relaxed text-slate-700"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="hidden items-center justify-center md:flex" aria-hidden="true">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#06b6d4]/40 bg-[#06b6d4]/10 text-[#0e7490]">
            <ArrowRight className="h-5 w-5" />
          </span>
        </div>

        <div
          className="rounded-2xl border border-[#06b6d4]/30 bg-gradient-to-br from-slate-950 via-slate-900 to-[#0b2436] p-5 shadow-[0_20px_50px_-20px_rgba(8,47,73,0.5),0_0_32px_-10px_rgba(6,182,212,0.3)] md:p-6"
        >
          <div className="flex items-center gap-2">
            <FileSearch className="h-4 w-4 text-[#5fd6ec]" aria-hidden="true" />
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5fd6ec]">
              After WindowMan
            </p>
          </div>
          <ul className="mt-4 space-y-2.5" role="list">
            {AFTER_ITEMS.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 text-sm leading-relaxed text-slate-200"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#06b6d4] shadow-[0_0_6px_rgba(6,182,212,0.8)]" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mx-auto mt-5 max-w-2xl text-center text-sm leading-relaxed text-slate-600">
        The preview does not argue with the contractor. It gives you better questions before you
        reply.
      </p>
    </section>
  );
}
