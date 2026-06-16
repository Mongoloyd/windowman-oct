import { useState } from "react";
import { ChevronDown, Lock, PanelTop } from "lucide-react";
import { SAMPLE_PREVIEW_ROWS } from "./nextdoorUi";

type Props = {
  subtitle: string;
};

export function HeroSamplePreviewCard({ subtitle }: Props) {
  const [openRowId, setOpenRowId] = useState<string | null>(null);

  const toggleRow = (id: string) => {
    setOpenRowId((current) => (current === id ? null : id));
  };

  return (
    <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_20px_50px_-20px_rgba(15,23,42,0.35)]">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Sample preview
            </p>
            <p className="font-display text-sm font-bold text-white">WindowMan Quote Check</p>
            <p className="mt-0.5 text-[11px] text-slate-400">{subtitle}</p>
          </div>
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-600/80 bg-slate-800/80 text-slate-300"
            aria-hidden="true"
          >
            <PanelTop className="h-5 w-5 stroke-[1.5]" />
          </span>
        </div>
      </div>

      <div className="space-y-2 p-4" role="list" aria-label="Sample quote review areas">
        {SAMPLE_PREVIEW_ROWS.map(({ id, label, detail }) => {
          const isOpen = openRowId === id;
          const panelId = `sample-preview-${id}`;

          return (
            <div
              key={id}
              className="overflow-hidden rounded-lg border border-slate-100 bg-slate-50/80"
              role="listitem"
            >
              <button
                type="button"
                id={`${panelId}-trigger`}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggleRow(id)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#06b6d4] focus-visible:ring-offset-1"
              >
                <span className="text-xs font-semibold text-slate-700">{label}</span>
                <span className="flex items-center gap-1.5">
                  <span className="hidden rounded-full border border-slate-200 bg-white px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-slate-500 sm:inline">
                    Example
                  </span>
                  <ChevronDown
                    className={[
                      "h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 motion-reduce:transition-none",
                      isOpen ? "rotate-180" : "",
                    ].join(" ")}
                    aria-hidden="true"
                  />
                </span>
              </button>
              <div
                id={panelId}
                role="region"
                aria-labelledby={`${panelId}-trigger`}
                className={[
                  "grid transition-[grid-template-rows,opacity] duration-200 motion-reduce:transition-none",
                  isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-70",
                ].join(" ")}
              >
                <div className="overflow-hidden">
                  <p className="px-3 pb-3 text-[11px] leading-relaxed text-slate-600">{detail}</p>
                </div>
              </div>
            </div>
          );
        })}

        <div className="mt-1 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
          <Lock className="h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden="true" />
          <span className="text-[11px] font-medium leading-snug text-amber-950">
            Preview first · upload when ready
          </span>
        </div>
      </div>

      <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-2">
        <p className="font-mono text-[9px] uppercase tracking-wide text-slate-400">
          Illustrative only · Not a real quote review
        </p>
      </div>
    </div>
  );
}
