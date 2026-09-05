import { ShieldCheck, Clock3, BadgeCheck } from "lucide-react";
import type { ProphecyVariant } from "../prophecyVariants";
import { PROPHECY_INTENT_OPTIONS } from "../prophecyIntentOptions";
import ProphecyIntentCard from "../ProphecyIntentCard";
import type { IntakeIntentChoice } from "@/components/intake/universal/intakeTypes";

interface ProphecyHeroProps {
  variant: ProphecyVariant;
  /** Opens the intake with the fork already answered. */
  onChooseIntent: (intent: IntakeIntentChoice) => void;
}

const TRUST_POINTS = [
  { icon: ShieldCheck, label: "Independent — we don't sell windows" },
  { icon: Clock3, label: "About 60 seconds" },
  { icon: BadgeCheck, label: "Free · no obligation" },
];

/**
 * The fork is the hero.
 *
 * The two cards sit above the fold rather than behind a CTA, because the
 * campaign's whole promise is that we already know which of two people you are.
 * Tapping a card opens the intake with that answer recorded, so the choice is
 * never made twice.
 */
export default function ProphecyHero({
  variant,
  onChooseIntent,
}: ProphecyHeroProps) {
  return (
    <section className="relative overflow-hidden px-5 pb-14 pt-10 sm:px-8 sm:pb-20 sm:pt-16">
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14">
        <div>
          <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-amber-200/80">
            {variant.eyebrow}
          </p>

          <h1 className="mt-4 text-[34px] font-extrabold leading-[1.08] tracking-tight text-white sm:text-[46px] lg:text-[52px]">
            {variant.headline}{" "}
            {variant.headlineAccent && (
              <span className="text-[#F0A868] [text-shadow:0_0_38px_rgba(240,168,104,0.35)]">
                {variant.headlineAccent}
              </span>
            )}
          </h1>

          <p className="mt-5 max-w-[54ch] text-[16px] leading-relaxed text-slate-300/90 sm:text-[17.5px]">
            {variant.subheadline}
          </p>

          <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2.5">
            {TRUST_POINTS.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-2 text-[13px] text-slate-400"
              >
                <Icon
                  className="h-4 w-4 text-cyan-300/80"
                  aria-hidden="true"
                  strokeWidth={2.2}
                />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p
            className="mb-3.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80"
            id="prophecy-fork-label"
          >
            Start here — pick the one that's true
          </p>
          <div
            role="group"
            aria-labelledby="prophecy-fork-label"
            className="grid gap-3.5 sm:grid-cols-2"
          >
            {PROPHECY_INTENT_OPTIONS.map((option) => (
              <ProphecyIntentCard
                key={option.value}
                option={option}
                selected={false}
                onSelect={onChooseIntent}
                priority
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
