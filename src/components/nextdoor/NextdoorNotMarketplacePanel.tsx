import { Eye, Lock, ShieldOff, Store } from "lucide-react";
import { nextdoorProofSectionClass, nextdoorProofEyebrowClass } from "./nextdoorUi";

const BULLETS = [
  { icon: ShieldOff, label: "No contractor pressure" },
  { icon: Store, label: "No marketplace bidding game" },
  { icon: Lock, label: "No savings guarantee" },
  { icon: Eye, label: "Private quote-check path" },
] as const;

export function NextdoorNotMarketplacePanel() {
  return (
    <section
      id="not-marketplace"
      className="scroll-mt-24"
      aria-labelledby="not-marketplace-heading"
    >
      <div
        className={[
          nextdoorProofSectionClass,
          "border-slate-700/80 bg-gradient-to-br from-slate-900 via-slate-950 to-[#0a1f2e] p-6 md:p-8",
        ].join(" ")}
      >
        <p className={nextdoorProofEyebrowClass}>Why WindowMan is different</p>
        <h2
          id="not-marketplace-heading"
          className="mt-2 font-display text-2xl font-extrabold leading-tight text-white md:text-3xl"
        >
          Not a contractor directory. Not a lead trap.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300/90 md:text-base">
          WindowMan does not sell you to five companies. We help you understand the quote in front
          of you so you can ask better questions before you choose who to hire.
        </p>

        <ul className="mt-6 grid gap-3 sm:grid-cols-2" role="list">
          {BULLETS.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex items-center gap-3 rounded-xl border border-slate-700/80 bg-slate-800/50 px-4 py-3.5"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#06b6d4]/30 bg-[#06b6d4]/10 text-[#5fd6ec]"
                aria-hidden="true"
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-slate-100">{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
