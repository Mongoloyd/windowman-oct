import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { PROTECTION_LEDGER_ITEMS } from "./nextdoorUi";

export function NextdoorProtectionLedger() {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = (id: string) => {
    setOpenId((current) => (current === id ? null : id));
  };

  return (
    <section
      className="mb-12 overflow-hidden rounded-xl border border-slate-300/80 bg-slate-900 shadow-[0_12px_40px_-16px_rgba(15,23,42,0.4)]"
      aria-label="Trust and compliance"
    >
      <div className="border-b border-slate-700/80 bg-slate-800/90 px-6 py-4 md:px-8">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          Protection ledger
        </p>
        <h2 className="mt-1 font-display text-lg font-bold text-white md:text-xl">
          What you should expect
        </h2>
        <p className="mt-2 text-xs text-slate-400">Tap a row for more detail.</p>
      </div>

      <ul className="divide-y divide-slate-700/60">
        {PROTECTION_LEDGER_ITEMS.map(({ id, title, detail }, index) => {
          const isOpen = openId === id;
          const panelId = `ledger-${id}`;

          return (
            <li key={id}>
              <button
                type="button"
                id={`${panelId}-trigger`}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(id)}
                className="flex w-full items-start gap-3 px-6 py-4 text-left transition-colors hover:bg-slate-800/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#06b6d4] md:px-8"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-600 bg-slate-800 font-mono text-[10px] font-bold text-emerald-400">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium leading-relaxed text-slate-200">
                      {title}
                    </span>
                    <ChevronDown
                      className={[
                        "mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 motion-reduce:transition-none",
                        isOpen ? "rotate-180" : "",
                      ].join(" ")}
                      aria-hidden="true"
                    />
                  </span>
                  <span
                    id={panelId}
                    role="region"
                    aria-labelledby={`${panelId}-trigger`}
                    className={[
                      "mt-0 block overflow-hidden text-sm leading-relaxed text-slate-400 transition-[max-height,opacity,margin] duration-200 motion-reduce:transition-none",
                      isOpen ? "mt-2 max-h-32 opacity-100" : "max-h-0 opacity-0",
                    ].join(" ")}
                  >
                    {detail}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
