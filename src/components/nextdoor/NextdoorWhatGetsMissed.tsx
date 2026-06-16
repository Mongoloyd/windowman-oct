import { FileQuestion, FileWarning, ScrollText, Wallet } from "lucide-react";
import { nextdoorCardRiskInteractiveClass, nextdoorEyebrowClass } from "./nextdoorUi";

/**
 * NextdoorWhatGetsMissed — illustrative forensic "what often gets missed"
 * section. Presentational only. Makes no claim about the visitor's own
 * quote; every row is framed as a general example.
 */

const MISSED_ITEMS = [
  {
    icon: FileQuestion,
    title: "Vague line items",
    body: "“Install windows” without scope, removals, trim, or finish details leaves room for surprises.",
  },
  {
    icon: FileWarning,
    title: "Missing product / spec references",
    body: "No model, approval number, or DP rating can make it hard to know what you're getting.",
  },
  {
    icon: ScrollText,
    title: "Unclear permit responsibility",
    body: "Who pulls permits and handles inspection issues is often left unsaid.",
  },
  {
    icon: Wallet,
    title: "Payment timing surprises",
    body: "Large deposits or draw schedules can shift risk before work is finished.",
  },
] as const;

export function NextdoorWhatGetsMissed() {
  return (
    <section id="what-gets-missed" className="scroll-mt-24" aria-labelledby="what-gets-missed-heading">
      <div className="border-l-4 border-[#06b6d4]/40 pl-4 md:pl-5">
        <p className={nextdoorEyebrowClass}>Why details matter</p>
        <h2
          id="what-gets-missed-heading"
          className="mt-2 max-w-2xl font-display text-2xl font-extrabold leading-tight text-slate-900 md:text-3xl"
        >
          Small quote details can change what you are really agreeing to.
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          These are common areas worth a second look before signing — shown as examples, not findings.
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {MISSED_ITEMS.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className={[nextdoorCardRiskInteractiveClass, "flex items-start gap-3.5 p-5"].join(" ")}
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/10 text-amber-700"
              aria-hidden="true"
            >
              <Icon className="h-5 w-5 stroke-[1.7]" />
            </span>
            <div className="min-w-0">
              <h3 className="font-display text-base font-bold text-slate-900">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{body}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
        <FileWarning className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        Example only — your estimate is reviewed after upload.
      </p>
    </section>
  );
}
