/**
 * BlindReverseAuctionSection — Sprint 2 local prototype explanation.
 *
 * Presentation only. Contractor-network submission is not connected.
 */

import { RefreshCw } from "lucide-react";

const LOOP_STEPS = [
  {
    number: "1",
    title: "Upload a real estimate",
    body: "Measurements give competing contractors a common job to price.",
  },
  {
    number: "2",
    title: "Remove identifying details",
    body: "The shared scope excludes the homeowner, address, and original contractor.",
  },
  {
    number: "3",
    title: "Let contractors compete blind",
    body: "The network evaluates the same measured job and decides whether it can beat the quote.",
  },
  {
    number: "4",
    title: "Run the better estimate again",
    body: "Every legitimate better quote can become the next number to beat.",
  },
] as const;

export default function BlindReverseAuctionSection() {
  return (
    <section
      aria-labelledby="scan-auction-heading"
      className="border-b border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f5f9fd_100%)] px-4 py-12 sm:px-6 sm:py-14"
    >
      <div className="mx-auto w-full max-w-6xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1878F0]">
          THE WINDOWMAN ADVANTAGE
        </p>
        <h2
          id="scan-auction-heading"
          className="mt-3 max-w-3xl text-2xl font-black uppercase leading-[1.1] tracking-tight text-[#0B2545] sm:text-3xl lg:text-4xl"
        >
          THE ESTIMATE YOU ALREADY HAVE IS YOUR NEGOTIATING WEAPON.
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-600 sm:text-lg">
          Before a measured scope is shared with the contractor network, WindowMan removes the
          homeowner&apos;s identifying details, property address, and original contractor.
          Participating contractors see the job—not the sales history—and decide whether they can
          beat the number.
        </p>

        {/* Continuous loop track — not four disconnected cards */}
        <div className="relative mt-10">
          <div
            className="pointer-events-none absolute left-4 right-4 top-[1.65rem] hidden h-px bg-gradient-to-r from-[#1878F0]/20 via-[#1878F0]/55 to-[#1878F0]/20 lg:block"
            aria-hidden="true"
          />
          <ol className="relative grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
            {LOOP_STEPS.map((step, index) => (
              <li key={step.number} className="relative min-w-0">
                <div className="flex items-start gap-3 lg:flex-col lg:items-center lg:text-center">
                  <span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-[#1878F0] bg-white text-sm font-black text-[#1878F0] shadow-[0_8px_20px_-12px_rgba(24,120,240,0.7)]">
                    {step.number}
                  </span>
                  <div className="min-w-0 flex-1 lg:mt-4">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-[#0B2545]">
                      {step.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.body}</p>
                  </div>
                </div>
                {index < LOOP_STEPS.length - 1 && (
                  <span className="sr-only">then</span>
                )}
              </li>
            ))}
          </ol>

          <div className="mt-8 flex items-center justify-center gap-2 text-[#1878F0]">
            <RefreshCw
              className="h-4 w-4 motion-safe:animate-[spin_8s_linear_infinite] motion-reduce:animate-none"
              aria-hidden="true"
            />
            <p className="text-sm font-semibold text-[#0B2545]">
              The process does not stop at one quote. Keep uploading better estimates and keep the
              competition moving.
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Contractor-network submission is not connected in this local prototype.
        </p>
      </div>
    </section>
  );
}
