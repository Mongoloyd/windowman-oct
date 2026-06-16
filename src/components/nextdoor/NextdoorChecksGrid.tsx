import type { AreaContext } from "@/lib/nextdoor/areaContext";
import { checksGridIntro } from "@/lib/nextdoor/areaContext";
import { nextdoorCardInteractiveClass, nextdoorEyebrowClass } from "./nextdoorUi";

const AUDIT_CARDS = [
  {
    label: "EXAMPLE REVIEW AREA",
    title: "Missing work",
    protects: "Paying for scope that was never written into the quote.",
    ask: "Ask: what removals, trim, and cleanup are included?",
    accent: "amber" as const,
  },
  {
    label: "EXAMPLE REVIEW AREA",
    title: "Permit responsibility",
    protects: "Surprise permit fees or inspection gaps after signing.",
    ask: "Ask: who pulls permits and handles failed inspections?",
    accent: "blue" as const,
  },
  {
    label: "EXAMPLE REVIEW AREA",
    title: "Warranty holes",
    protects: "Unclear labor vs. product coverage when something fails.",
    ask: "Ask: what is covered, for how long, and is it transferable?",
    accent: "amber" as const,
  },
  {
    label: "EXAMPLE REVIEW AREA",
    title: "Payment traps",
    protects: "Large deposits or draw schedules that front-load risk.",
    ask: "Ask: what triggers each payment and the final balance?",
    accent: "amber" as const,
  },
  {
    label: "EXAMPLE REVIEW AREA",
    title: "Price structure",
    protects: "Line items that hide per-opening math or allowances.",
    ask: "Ask: what is the price per opening and what are allowances?",
    accent: "blue" as const,
  },
  {
    label: "EXAMPLE REVIEW AREA",
    title: "Spec proof",
    protects: "Missing DP ratings, approvals, or model references.",
    ask: "Ask: which product approval and DP rating applies?",
    accent: "blue" as const,
  },
] as const;

const ACCENT_DOT: Record<(typeof AUDIT_CARDS)[number]["accent"], string> = {
  amber: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]",
  blue: "bg-[#06b6d4] shadow-[0_0_8px_rgba(6,182,212,0.6)]",
};

type Props = {
  areaContext: AreaContext;
};

export function NextdoorChecksGrid({ areaContext }: Props) {
  return (
    <section id="what-we-check" className="scroll-mt-24" aria-labelledby="checks-heading">
      <div className="overflow-hidden rounded-2xl border border-white/80 bg-gradient-to-b from-white to-slate-50/70 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_8px_-3px_rgba(15,40,90,0.1),0_22px_56px_-28px_rgba(8,47,73,0.35)] md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4 border-l-4 border-[#06b6d4]/45 pl-4 md:pl-5">
          <div>
            <p className={nextdoorEyebrowClass}>Quote audit breakdown</p>
            <h2
              id="checks-heading"
              className="mt-2 font-display text-2xl font-extrabold text-slate-900 md:text-3xl"
            >
              What WindowMan checks
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 md:text-base">
              {checksGridIntro(areaContext)}
            </p>
          </div>
          <span className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm">
            Illustrative · Pre-upload
          </span>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {AUDIT_CARDS.map(({ label, title, protects, ask, accent }) => (
            <div
              key={title}
              className={[
                nextdoorCardInteractiveClass,
                "flex flex-col p-5 max-sm:border-l-[3px] max-sm:border-l-[#06b6d4]/50",
              ].join(" ")}
            >
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${ACCENT_DOT[accent]}`} aria-hidden="true" />
                <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {label}
                </span>
              </div>
              <h3 className="mt-3 font-display text-base font-bold text-slate-900">{title}</h3>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-primary/80">
                Protects you from
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{protects}</p>
              <p className="mt-3 border-t border-slate-100 pt-3 text-xs font-medium leading-relaxed text-[#0e7490]">
                {ask}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
