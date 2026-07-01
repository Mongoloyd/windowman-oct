import { ArrowRight, FileCheck2 } from 'lucide-react';
import { PostUploadProgressRail } from '@/pages/diagnosis/components/PostUploadProgressRail';

const PRESCRIBED_HERO_SRC = '/images/wm-prescribed-for-you.avif';

interface RevealDiagnosisBridgeCardProps {
  onPrimaryClick?: () => void;
  ctaEnabled?: boolean;
}

export default function RevealDiagnosisBridgeCard({
  onPrimaryClick,
  ctaEnabled = true,
}: RevealDiagnosisBridgeCardProps) {
  return (
    <section
      className="rounded-3xl border-2 border-blue-300/40 bg-gradient-to-br from-white via-sky-50/70 to-white p-6 md:p-8 shadow-[0_24px_60px_-32px_rgba(15,76,129,0.35),0_10px_24px_-18px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.95)]"
      aria-label="Get a better quote"
    >
      <div className="-mx-2 mb-5 overflow-hidden rounded-2xl border border-blue-200/50 bg-white/80">
        <PostUploadProgressRail activeStep={3} compact />
      </div>

      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-blue-700 shadow-sm">
        <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
        Truth Report Complete · Next: Better Quote Plan
      </div>

      <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2 md:items-center md:gap-8">
        <div className="order-1 md:order-none md:col-start-1 md:row-start-1">
          <h2 className="font-display text-2xl font-black leading-tight tracking-tight text-slate-950 md:text-3xl">
            Your quote has problems.
          </h2>
          <p className="mt-2 font-display text-xl font-black leading-tight tracking-tight text-slate-800 md:text-2xl">
            Now let&apos;s help you get a better one.
          </p>
        </div>

        <div className="order-2 flex justify-center md:order-none md:col-start-2 md:row-start-1 md:row-span-2 md:items-center md:justify-end">
          <img
            src={PRESCRIBED_HERO_SRC}
            alt="WindowMan prescription: we handle the contractor conversation so you don't waste time on estimates"
            loading="lazy"
            decoding="async"
            className="aspect-[4/3] w-full object-cover"
          />
        </div>

        <div className="order-3 md:order-none md:col-start-1 md:row-start-2">
          <p className="max-w-2xl text-sm font-medium leading-relaxed text-slate-700 md:text-base">
            WindowMan found the risks in your current estimate. Answer a few quick questions so we
            can shape the next quote around your budget, timeline, and what needs to be fixed before
            you sign.
          </p>
        </div>
      </div>

      {ctaEnabled && onPrimaryClick ? (
        <div className="mt-6">
          <button
            type="button"
            onClick={onPrimaryClick}
            className="btn-depth-primary inline-flex w-full items-center justify-center gap-2 px-6 py-4 text-base sm:w-auto"
          >
            A Better Quote is Moments Away
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </button>
          <p className="mt-3 text-xs font-medium text-slate-500">
            Takes about 2 minutes · timeline, budget, decision-maker, and quote goals
          </p>
        </div>
      ) : (
        <p className="mt-6 rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm font-medium text-slate-600">
          Return to your homepage report flow to continue and get a better quote plan.
        </p>
      )}
    </section>
  );
}
