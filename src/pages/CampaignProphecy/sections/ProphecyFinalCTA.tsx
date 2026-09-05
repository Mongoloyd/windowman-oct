import { PROPHECY_INTENT_OPTIONS } from "../prophecyIntentOptions";
import ProphecyIntentCard from "../ProphecyIntentCard";
import type { IntakeIntentChoice } from "@/components/intake/universal/intakeTypes";

interface ProphecyFinalCTAProps {
  onChooseIntent: (intent: IntakeIntentChoice) => void;
}

/**
 * The closing fork. Deliberately the same control as the hero rather than a
 * different-looking CTA — a reader who scrolled the whole page should land on
 * a decision they already recognise, not a new one.
 */
export default function ProphecyFinalCTA({
  onChooseIntent,
}: ProphecyFinalCTAProps) {
  return (
    <section className="relative px-5 py-16 [content-visibility:auto] [contain-intrinsic-size:auto_680px] sm:px-8 sm:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-[28px] font-bold leading-[1.15] text-white sm:text-[36px]">
          Find out what your estimate doesn&apos;t say.
        </h2>
        <p className="mx-auto mt-4 max-w-[52ch] text-[15.5px] leading-relaxed text-slate-400">
          Free, independent, and about a minute of your time. Pick the one
          that&apos;s true today.
        </p>

        <div
          role="group"
          aria-label="Do you already have an estimate?"
          className="mx-auto mt-9 grid max-w-2xl gap-3.5 text-left sm:grid-cols-2"
        >
          {PROPHECY_INTENT_OPTIONS.map((option) => (
            <ProphecyIntentCard
              key={option.value}
              option={option}
              selected={false}
              onSelect={onChooseIntent}
            />
          ))}
        </div>

        <p className="mt-7 text-[13px] text-slate-500">
          Florida projects only · Free · No obligation · Independent — not a
          contractor
        </p>
      </div>
    </section>
  );
}
