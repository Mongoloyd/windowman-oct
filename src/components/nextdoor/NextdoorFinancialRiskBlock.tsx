import { AlertTriangle, ClipboardList, DollarSign, Scale } from "lucide-react";
import {
  nextdoorEyebrowClass,
  nextdoorLeverageTileClass,
  nextdoorRiskTileClass,
} from "./nextdoorUi";

const TILES = [
  {
    icon: DollarSign,
    title: "Price",
    body: "Line-item math, allowances, and per-opening assumptions.",
    mode: "risk" as const,
  },
  {
    icon: ClipboardList,
    title: "Scope",
    body: "What work is actually included, excluded, or left vague.",
    mode: "risk" as const,
  },
  {
    icon: AlertTriangle,
    title: "Risk",
    body: "Who handles permits, inspection issues, and corrections.",
    mode: "risk" as const,
  },
  {
    icon: Scale,
    title: "Leverage",
    body: "What to ask before you reply, sign, or send a deposit.",
    mode: "leverage" as const,
  },
] as const;

export function NextdoorFinancialRiskBlock() {
  return (
    <section
      id="financial-risk"
      className="scroll-mt-24"
      aria-labelledby="financial-risk-heading"
    >
      <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-b from-amber-50/40 via-white to-slate-50/80 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_22px_56px_-28px_rgba(245,158,11,0.2)] md:p-8">
        <div className="border-l-4 border-red-400/60 pl-4 md:pl-5">
          <p className={nextdoorEyebrowClass}>Money on the line</p>
          <h2
            id="financial-risk-heading"
            className="mt-2 max-w-2xl font-display text-2xl font-extrabold leading-tight text-slate-900 md:text-3xl"
          >
            The cheapest quote can become expensive if the missing details show up later.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Price is only one part of the deal. Scope, permit responsibility, warranty terms, and
            payment timing can change what you are really buying.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {TILES.map(({ icon: Icon, title, body, mode }) => (
            <div
              key={title}
              className={mode === "risk" ? nextdoorRiskTileClass : nextdoorLeverageTileClass}
            >
              <div className="flex items-start gap-3">
                <span
                  className={[
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
                    mode === "risk"
                      ? "border-amber-500/30 bg-amber-500/15 text-amber-700"
                      : "border-[#06b6d4]/30 bg-[#06b6d4]/10 text-[#0e7490]",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-display text-base font-bold text-slate-900">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
