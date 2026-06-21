import { nextdoorPrimaryCtaClass } from "./nextdoorUi";

const POINTING_SRC = "/images/nextdoor-windowman-pointing.avif";

type Props = {
  readiness: string | null;
  ctaLabel: string;
  onCtaClick: () => void;
};

export function NextdoorClosingCtaSection({ readiness, ctaLabel, onCtaClick }: Props) {
  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-[#06b6d4]/25 bg-gradient-to-br from-slate-950 via-slate-900 to-[#0b2436] p-6 shadow-[0_28px_70px_-30px_rgba(8,47,73,0.6)] md:p-9"
      aria-labelledby="closing-cta-heading"
    >
      <div className="md:grid md:grid-cols-3 md:items-end md:gap-6 lg:gap-8">
        <div className="text-center md:col-span-2 md:text-left">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5fd6ec]">
            Ready when you are
          </p>
          <h2
            id="closing-cta-heading"
            className="mx-auto mt-2 max-w-xl font-display text-2xl font-extrabold leading-tight text-white md:mx-0 md:text-3xl"
          >
            Check your first quote before it becomes a signed contract.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-300/90 md:mx-0">
            Start with the free preview. Use every quote you get to make the next conversation
            clearer.
          </p>
          <div className="mt-6 flex justify-center md:justify-start">
            <button
              type="button"
              onClick={onCtaClick}
              className={[nextdoorPrimaryCtaClass, "w-full sm:w-auto"].join(" ")}
              style={{ padding: "16px 36px", fontSize: 16 }}
            >
              {readiness === "has_estimate" ? "Back to quote options" : ctaLabel}
            </button>
          </div>
          <p className="mx-auto mt-4 max-w-md text-xs leading-relaxed text-slate-400 md:mx-0">
            No contractor pressure. No marketplace handoff. Upload when ready.
          </p>
        </div>

        <div className="mt-6 flex justify-end md:col-span-1 md:mt-0 md:justify-end">
          <img
            src={POINTING_SRC}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            width={640}
            height={720}
            className="pointer-events-none h-[280px] w-auto select-none object-contain object-right-bottom drop-shadow-[0_20px_40px_rgba(0,0,0,0.45)] sm:h-[320px] md:h-[340px] lg:h-[380px]"
          />
        </div>
      </div>
    </section>
  );
}
