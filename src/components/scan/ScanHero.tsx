/**
 * ScanHero — Sprint 2 Quote Competition hero for the flag-gated `/scan` page.
 *
 * Presentation + local upload stage composition only. No real upload, scanner,
 * Supabase, Gemini, or tracking behavior. The primary CTA scrolls/focuses the
 * functional upload control owned by the parent.
 */

import { useState, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";

/**
 * Homeowner mascot already served on the homepage hero (`AuditHero`) and the
 * Nextdoor hero stack. Transparent AVIF, so it sits on the light page directly.
 */
const HERO_IMAGE_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/87108037/YjBTWCdi7jZwa5GFcxbLnp/windowmanwithtruthreportonthephone_be309c26.avif";

type ScanHeroProps = {
  onGetReview: () => void;
  competitionStage: ReactNode;
};

export default function ScanHero({ onGetReview, competitionStage }: ScanHeroProps) {
  const [heroImageFailed, setHeroImageFailed] = useState(false);

  return (
    <section
      className="
        relative overflow-hidden
        bg-[radial-gradient(circle_at_76%_24%,rgba(73,165,255,0.18),transparent_26%),linear-gradient(180deg,#ffffff_0%,#f8fbff_68%,#edf4fb_100%)]
        border-b border-slate-200/80
      "
    >
      {/* Subtle 3–4% dot-grid texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: "radial-gradient(#0B2545 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
      />

      <div className="relative mx-auto grid w-full max-w-6xl gap-5 px-4 py-6 sm:gap-8 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-10 lg:py-12">
        {/* Copy + CTA — first in DOM for mobile headline-first order */}
        <div className="flex min-w-0 flex-col items-start">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1878F0]">
            FREE HOMEOWNER QUOTE REVIEW
          </p>

          <h1 className="mt-2 text-[2rem] font-black uppercase leading-[0.98] tracking-[-0.02em] sm:mt-3 sm:text-5xl lg:text-[3.35rem]">
            <span className="block text-[#0B2545]">YOU GOT THE QUOTE.</span>
            <span className="mt-1 block bg-gradient-to-r from-[#1878F0] to-[#22D3EE] bg-clip-text text-transparent">
              NOW MAKE IT COMPETE.
            </span>
          </h1>

          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-slate-600 sm:mt-4 sm:text-lg">
            Upload any real window or door estimate. WindowMan shows you what the quote includes,
            what it leaves unclear, and where you have leverage—then prepares the measured scope so
            contractors can compete to beat the price.
          </p>

          <p className="mt-2 text-sm font-semibold text-[#0B2545] sm:mt-3 sm:text-base">
            One estimate can be the start of a better one.
          </p>

          <button
            type="button"
            onClick={onGetReview}
            className="
              group mt-4 inline-flex min-h-[60px] w-full sm:mt-6 sm:w-auto min-w-0 sm:min-w-[320px]
              items-center justify-center gap-3 rounded-xl px-8
              bg-gradient-to-r from-[#1878F0] to-[#1264D8]
              text-base sm:text-lg font-black tracking-[-0.01em] text-white
              border-t border-white/35 border-b-4 border-b-[#0B2545]
              shadow-[0_12px_28px_-10px_rgba(24,120,240,0.65)]
              transition-[transform,box-shadow,filter] duration-150
              hover:-translate-y-0.5 hover:brightness-105
              hover:shadow-[0_18px_34px_-12px_rgba(24,120,240,0.75)]
              active:translate-y-1 active:border-b-0
              focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300
              motion-reduce:transition-none motion-reduce:hover:translate-y-0
            "
          >
            MAKE MY QUOTE COMPETE
            <ArrowRight
              className="h-5 w-5 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </button>

          <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500">
            Free to homeowners. No obligation.
            <br />
            Upload every better estimate and keep the competition moving.
          </p>
        </div>

        {/* Quote Competition Stage: mascot + upload + report preview */}
        <div className="relative min-w-0">
          <div className="relative">
            {/* Restrained blue halo — no large blurred blob */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-2 h-28 w-40 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(73,165,255,0.28)_0%,transparent_70%)] sm:h-32 sm:w-48"
            />

            {!heroImageFailed && (
              <div className="relative z-20 mx-auto -mb-8 flex h-[110px] w-[128px] items-end justify-center sm:-mb-12 sm:h-[170px] sm:w-[190px] lg:-mb-14 lg:h-[190px] lg:w-[210px]">
                <img
                  src={HERO_IMAGE_URL}
                  alt="WindowMan reviewing a quote on a phone"
                  width={420}
                  height={560}
                  loading="eager"
                  decoding="async"
                  onError={() => setHeroImageFailed(true)}
                  className="h-full w-full object-contain object-bottom drop-shadow-[0_14px_22px_rgba(11,37,69,0.28)]"
                />
              </div>
            )}

            <div className="relative z-10 pt-1 sm:pt-2">{competitionStage}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
