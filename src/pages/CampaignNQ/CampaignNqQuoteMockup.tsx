/**
 * Stylized illustration of what a contractor quote looks like when WindowMan
 * reviews it. Deliberately contains no figures, grades, scores, or percentages:
 * every value position is rendered as neutral line-art so the graphic can never
 * be mistaken for a real analysis of a real quote.
 */

const REVIEW_ROWS = [
  { label: "Price", barWidths: ["58%", "34%"] },
  { label: "Project scope", barWidths: ["72%", "46%"] },
  { label: "Fees", barWidths: ["44%", "28%"] },
  { label: "Warranty", barWidths: ["64%", "38%"] },
  { label: "Fine print", barWidths: ["78%", "52%"] },
] as const;

function LineArtBar({ width }: { width: string }) {
  return (
    <span
      className="block h-2 rounded-full bg-gradient-to-r from-slate-300 to-slate-200"
      style={{ width }}
      aria-hidden="true"
    />
  );
}

export default function CampaignNqQuoteMockup() {
  return (
    <div className="relative px-3 pb-6 pt-8 sm:px-6">
      {/* Provenance label — counter-rotated so it stays level and legible */}
      <p className="absolute left-1 top-1 rotate-[-1.5deg] rounded-[3px] border border-slate-700 bg-slate-900 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white shadow-[0_2px_6px_rgba(10,25,55,0.35)] sm:left-4 sm:text-[11px]">
        Illustrative example
      </p>

      {/* Stacked sheets beneath the top page */}
      <div
        className="absolute inset-x-6 top-12 bottom-10 rotate-[3.5deg] rounded-sm border border-slate-300/70 bg-white shadow-[0_1px_2px_rgba(10,25,55,0.1),0_10px_24px_-8px_rgba(10,25,55,0.28)]"
        aria-hidden="true"
      />
      <div
        className="absolute inset-x-5 top-11 bottom-11 rotate-[1.75deg] rounded-sm border border-slate-300/80 bg-white shadow-[0_1px_2px_rgba(10,25,55,0.1),0_10px_24px_-8px_rgba(10,25,55,0.24)]"
        aria-hidden="true"
      />

      {/* Top page */}
      <div className="relative -rotate-[1.5deg] rounded-sm border border-slate-300 bg-gradient-to-b from-white to-slate-50 p-5 shadow-[var(--shadow-elevated)] sm:p-6">
        {/* Letterhead */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2.5" aria-hidden="true">
            <span className="h-8 w-8 rounded-sm bg-gradient-to-b from-slate-300 to-slate-200 shadow-[var(--shadow-sunken)]" />
            <span className="block space-y-1.5">
              <span className="block h-2 w-24 rounded-full bg-slate-300" />
              <span className="block h-2 w-16 rounded-full bg-slate-200" />
            </span>
          </div>
          <span className="block space-y-1.5 text-right" aria-hidden="true">
            <span className="ml-auto block h-2 w-14 rounded-full bg-slate-200" />
            <span className="ml-auto block h-2 w-10 rounded-full bg-slate-200" />
          </span>
        </div>

        {/* Annotated review rows */}
        <ul
          className="mt-5 space-y-3.5"
          aria-label="Illustrative quote review summary"
        >
          {REVIEW_ROWS.map((row, index) => (
            <li key={row.label} className="flex items-center gap-3 sm:gap-4">
              <span className="relative shrink-0">
                {/* Highlighter stroke — the single gold moment on this page */}
                <span
                  className="absolute inset-x-[-5px] top-[15%] h-[70%] -rotate-1 rounded-[2px]"
                  style={{
                    background:
                      "linear-gradient(180deg, hsl(var(--color-gold-accent) / 0.16) 0%, hsl(var(--color-gold-accent) / 0.52) 30%, hsl(var(--color-gold-accent) / 0.52) 78%, hsl(var(--color-gold-accent) / 0.14) 100%)",
                  }}
                  aria-hidden="true"
                />
                <span className="relative text-[13px] font-bold text-slate-900 sm:text-sm">
                  {row.label}
                </span>
              </span>
              <span className="flex flex-1 flex-col gap-1.5">
                {row.barWidths.map((width, barIndex) => (
                  <LineArtBar key={barIndex} width={width} />
                ))}
              </span>
              {index % 2 === 0 ? (
                <span
                  className="hidden shrink-0 -rotate-2 rounded-[3px] border border-sky-300 bg-sky-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-sky-800 shadow-[0_1px_2px_rgba(10,25,55,0.12)] sm:inline-block"
                  aria-hidden="true"
                >
                  Reviewed
                </span>
              ) : null}
            </li>
          ))}
        </ul>

        {/* Footer line-art */}
        <div
          className="mt-5 flex items-center justify-between gap-4 border-t border-slate-200 pt-4"
          aria-hidden="true"
        >
          <span className="block h-2 w-28 rounded-full bg-slate-200" />
          <span className="block h-6 w-20 rounded-sm bg-gradient-to-b from-slate-200 to-slate-100 shadow-[var(--shadow-sunken)]" />
        </div>
      </div>

    </div>
  );
}
