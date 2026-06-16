import { ArrowRight } from "lucide-react";
import { nextdoorProofEyebrowClass, nextdoorProofSectionClass } from "./nextdoorUi";

const STAGES = [
  {
    label: "Vague Quote",
    body: "Scope, specs, or payment terms are hard to compare.",
    accent: "border-amber-500/40 bg-amber-500/10 text-amber-200",
    dot: "bg-amber-500",
  },
  {
    label: "Clearer Quote",
    body: "You know what to ask before replying.",
    accent: "border-[#06b6d4]/35 bg-[#06b6d4]/10 text-[#5fd6ec]",
    dot: "bg-[#06b6d4]",
  },
  {
    label: "Comparable Quote",
    body: "Every bid gets checked against the same pressure points.",
    accent: "border-[#06b6d4]/45 bg-[#06b6d4]/15 text-[#5fd6ec]",
    dot: "bg-[#22d3ee]",
  },
  {
    label: "Harder-to-Beat Quote",
    body: "You have fewer blind spots before you sign.",
    accent: "border-emerald-500/35 bg-emerald-500/10 text-emerald-300",
    dot: "bg-emerald-400",
  },
] as const;

export function NextdoorQuoteLeverageLoop() {
  return (
    <section
      id="quote-leverage-loop"
      className="scroll-mt-24"
      aria-labelledby="leverage-loop-heading"
    >
      <div className={[nextdoorProofSectionClass, "relative p-6 md:p-8"].join(" ")}>
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#22d3ee]/60 to-transparent"
          aria-hidden="true"
        />
        <p className={nextdoorProofEyebrowClass}>Quote leverage workflow</p>
        <h2
          id="leverage-loop-heading"
          className="mt-2 max-w-2xl font-display text-2xl font-extrabold leading-tight text-white md:text-3xl"
        >
          Turn every quote into leverage before you sign.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300/90 md:text-base">
          Upload the first estimate. Use the preview to see what is vague, missing, or worth
          questioning. Got another quote later? Upload that too and keep comparing until the
          paperwork is clearer, stronger, and harder to beat.
        </p>

        <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="list">
          {STAGES.map(({ label, body, accent, dot }, index) => (
            <li key={label} className="relative">
              {index < STAGES.length - 1 ? (
                <ArrowRight
                  className="absolute -right-2 top-8 z-10 hidden h-4 w-4 text-[#5fd6ec]/50 lg:block"
                  aria-hidden="true"
                />
              ) : null}
              <div
                className={[
                  "h-full rounded-xl border p-4",
                  "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_12px_32px_-16px_rgba(0,0,0,0.45)]",
                  accent,
                ].join(" ")}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={["h-2 w-2 shrink-0 rounded-full shadow-[0_0_8px_currentColor]", dot].join(
                      " ",
                    )}
                    aria-hidden="true"
                  />
                  <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] opacity-80">
                    Stage {index + 1}
                  </span>
                </span>
                <p className="mt-3 font-display text-sm font-bold text-white">{label}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-300/85">{body}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-6 font-mono text-[9px] uppercase tracking-wide text-slate-500">
          Illustrative workflow — no real quote is analyzed until you upload.
        </p>
      </div>
    </section>
  );
}
