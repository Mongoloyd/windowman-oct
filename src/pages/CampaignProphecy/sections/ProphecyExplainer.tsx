import {
  ExplainerVideoFacade,
  EXPLAINER_POSTER,
  EXPLAINER_POSTER_AVIF,
  EXPLAINER_VIDEO_SOURCE,
} from "@/components/landing/ExplainerVideoFacade";

/**
 * The shared 60-second explainer, with copy written for this page.
 *
 * Mounts `ExplainerVideoFacade` directly rather than `ExplainerVideoSection`,
 * whose copy points at a hero ZIP input that Prophecy does not have — the ZIP
 * is asked inside the intake, after the fork.
 *
 * The facade is poster-first: the video file is only fetched once someone
 * presses play, so this section costs one image on load.
 */
export default function ProphecyExplainer() {
  return (
    <section className="relative px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto grid max-w-5xl items-center gap-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-14">
        <div>
          <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">
            60-second overview
          </p>
          <h2 className="mt-3 text-[26px] font-bold leading-[1.18] text-white sm:text-[32px]">
            What the read actually looks like.
          </h2>
          <p className="mt-4 text-[15.5px] leading-relaxed text-slate-400">
            WindowMan turns a contractor estimate into a structured review of
            price, scope, fees, warranty language and fine print — then tells
            you which lines deserve a closer look and what to ask about each
            one.
          </p>
          <p className="mt-4 text-[15.5px] leading-relaxed text-slate-400">
            We don't manufacture, sell or install anything, and we're not a law
            firm, insurer or building department. We read the document.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_26px_60px_-34px_rgba(0,0,0,0.95)]">
          <ExplainerVideoFacade
            poster={EXPLAINER_POSTER}
            posterAvif={EXPLAINER_POSTER_AVIF}
            source={EXPLAINER_VIDEO_SOURCE}
            title="How WindowMan reviews a window estimate"
          />
        </div>
      </div>
    </section>
  );
}
