import { Lock } from "lucide-react";
import { nextdoorEyebrowClass } from "./nextdoorUi";

/**
 * NextdoorJourneyTimeline — compact "what happens next" timeline that
 * reinforces the Verify-to-Reveal moat. Presentational only.
 */

const STEPS = [
  { n: 1, label: "Choose where you are", note: "Pick your stage in the quote process." },
  { n: 2, label: "Save your place", note: "Optional details stay on this device for now." },
  { n: 3, label: "Upload when ready", note: "Upload starts only after a real estimate exists." },
  { n: 4, label: "See a safe preview", note: "A limited preview — never the full report." },
  { n: 5, label: "Verify to unlock", note: "Phone verification reveals the full Truth Report." },
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
          A clear path — full report stays locked until you verify.
        </h2>
      </div>

      <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" role="list">
        {STEPS.map(({ n, label, note }) => {
          const isLock = n === 5;
          return (
            <li
              key={n}
              className={[
                "relative rounded-2xl border p-4",
                "shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_28px_-18px_rgba(15,40,90,0.3)]",
                isLock
                  ? "border-amber-500/30 bg-gradient-to-b from-amber-50/70 to-white"
                  : "border-white/80 bg-gradient-to-b from-white to-slate-50/80",
              ].join(" ")}
            >
              <span
                className={[
                  "flex h-8 w-8 items-center justify-center rounded-full font-mono text-xs font-bold",
                  isLock
                    ? "border border-amber-500/40 bg-amber-500/15 text-amber-800"
                    : "border border-[#06b6d4]/35 bg-[#06b6d4]/10 text-[#0e7490]",
                ].join(" ")}
                aria-hidden="true"
              >
                {isLock ? <Lock className="h-3.5 w-3.5" /> : n}
              </span>
              <p className="mt-3 font-display text-sm font-bold text-slate-900">{label}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{note}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
