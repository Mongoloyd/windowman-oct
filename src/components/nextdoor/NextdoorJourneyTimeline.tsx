import { nextdoorEyebrowClass } from "./nextdoorUi";

/**
 * NextdoorJourneyTimeline — compact "what happens next" timeline.
 * Presentational only.
 */

const STEPS = [
  { n: 1, label: "Choose where you are", note: "Pick your stage in the quote process." },
  { n: 2, label: "Save your place", note: "Optional details stay on this device for now." },
  { n: 3, label: "Upload when ready", note: "A real estimate starts the private review path." },
  { n: 4, label: "See a safe preview", note: "Get useful quote insight before you sign anything." },
] as const;

export function NextdoorJourneyTimeline() {
  return (
    <section id="what-happens-next" className="scroll-mt-24" aria-labelledby="journey-heading">
      <div className="border-l-4 border-primary/40 pl-4 md:pl-5">
        <p className={nextdoorEyebrowClass}>What happens next</p>
        <h2
          id="journey-heading"
          className="mt-2 font-display text-2xl font-extrabold leading-tight text-slate-900 md:text-3xl"
        >
          A clear path — four easy steps to your free preview.
        </h2>
      </div>

      <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="list">
        {STEPS.map(({ n, label, note }) => (
          <li
            key={n}
            className={[
              "relative rounded-2xl border border-white/80 bg-gradient-to-b from-white to-slate-50/80 p-4",
              "shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_28px_-18px_rgba(15,40,90,0.3)]",
            ].join(" ")}
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[#06b6d4]/35 bg-[#06b6d4]/10 font-mono text-xs font-bold text-[#0e7490]"
              aria-hidden="true"
            >
              {n}
            </span>
            <p className="mt-3 font-display text-sm font-bold text-slate-900">{label}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{note}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
