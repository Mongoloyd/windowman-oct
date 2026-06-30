import { ArrowRight, FileCheck2, ShieldCheck } from 'lucide-react';
import { PostUploadProgressRail } from '@/pages/diagnosis/components/PostUploadProgressRail';

interface RevealDiagnosisBridgeCardProps {
  onPrimaryClick?: () => void;
  onSecondaryClick?: () => void;
  ctaEnabled?: boolean;
}

export default function RevealDiagnosisBridgeCard({
  onPrimaryClick,
  onSecondaryClick,
  ctaEnabled = true,
}: RevealDiagnosisBridgeCardProps) {
  return (
    <section
      className="rounded-3xl border-2 border-blue-300/40 bg-gradient-to-br from-white via-sky-50/70 to-white p-6 md:p-8 shadow-[0_24px_60px_-32px_rgba(15,76,129,0.35),0_10px_24px_-18px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.95)]"
      aria-label="Next step after reveal"
    >
      <div className="-mx-2 mb-5 overflow-hidden rounded-2xl border border-blue-200/50 bg-white/80">
        <PostUploadProgressRail activeStep={2} compact />
      </div>

      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-blue-700 shadow-sm">
        <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
        Step 2 of 5 · Reveal
      </div>

      <h2 className="font-display text-2xl font-black leading-tight tracking-tight text-slate-950 md:text-3xl">
        Your quote is scanned. Now turn it into a plan.
      </h2>
      <p className="mt-4 max-w-2xl text-sm font-medium leading-relaxed text-slate-700 md:text-base">
        The scan can read price, scope, warranty, fees, and missing details. The next step asks only
        what the document cannot know: urgency, timeline, decision makers, and what you want WindowMan
        to help you do next.
      </p>

      {ctaEnabled && onPrimaryClick ? (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onPrimaryClick}
            className="btn-depth-primary inline-flex w-full items-center justify-center gap-2 px-6 py-4 text-base sm:w-auto"
          >
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            Build My Quote Defense Plan
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </button>
          {onSecondaryClick ? (
            <button
              type="button"
              onClick={onSecondaryClick}
              className="inline-flex w-full items-center justify-center gap-1 rounded-xl border-2 border-blue-200 bg-white px-5 py-3.5 text-sm font-bold text-blue-700 shadow-sm transition-colors hover:border-blue-400 hover:bg-blue-50/80 sm:w-auto"
            >
              Prepare My WindowMan Prescription
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : (
        <p className="mt-6 rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm font-medium text-slate-600">
          Return to your homepage report flow to continue with your personalized prescription intake.
        </p>
      )}
    </section>
  );
}
