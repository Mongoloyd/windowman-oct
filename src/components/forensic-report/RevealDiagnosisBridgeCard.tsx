import { ArrowRight, FileCheck2 } from 'lucide-react';
import { PostUploadProgressRail } from '@/pages/diagnosis/components/PostUploadProgressRail';

const PRESCRIBED_HERO_SRC = '/images/wm-prescribed-for-you.avif';

export const FALLBACK_BRIDGE_EXPLANATION =
  'WindowMan found the risks in your current estimate. Answer a few quick questions so we can shape the next quote around your budget, timeline, and what needs to be fixed before you sign.';

export const WINDOWMAN_BRIDGE_TRANSITION =
  'WindowMan can help you get a quote that fixes these issues.';

interface RevealDiagnosisBridgeCardProps {
  onPrimaryClick?: () => void;
  ctaEnabled?: boolean;
  summaryBody?: string | null;
}

function resolveSummaryBody(summaryBody?: string | null): string | null {
  if (typeof summaryBody !== 'string') return null;
  const trimmed = summaryBody.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export default function RevealDiagnosisBridgeCard({
  onPrimaryClick,
  ctaEnabled = true,
  summaryBody = null,
}: RevealDiagnosisBridgeCardProps) {
  const explanation = resolveSummaryBody(summaryBody) ?? FALLBACK_BRIDGE_EXPLANATION;
  return (
    <section
      className="fr-card fr-card--hero fr-glow--info relative overflow-hidden rounded-3xl p-6 md:p-8"
      aria-label="Get a better quote"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(80% 60% at 100% 0%, hsl(var(--fr-cyan) / 0.12), transparent 60%)',
        }}
      />

      <div className="relative">
        <div className="-mx-2 mb-5 overflow-hidden rounded-2xl border border-[hsl(var(--fr-border))] bg-[hsl(var(--fr-surface-2)/0.85)]">
          <PostUploadProgressRail activeStep={3} compact />
        </div>

        <div className="mb-4 inline-flex items-center gap-2 fr-pill--info px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em]">
          <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
          Truth Report Complete · Next: Better Quote Plan
        </div>

        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2 md:items-start md:gap-8">
          <div className="order-1 min-w-0 md:order-none md:col-start-1 md:row-start-1">
            <h2 className="font-display fr-text-t1 text-2xl font-black leading-tight tracking-tight md:text-3xl">
              Your quote has problems.
            </h2>
            <p className="mt-2 font-display fr-text-t2 text-xl font-black leading-tight tracking-tight md:text-2xl">
              Now let&apos;s help you get a better one.
            </p>
          </div>

          <div className="order-2 flex justify-center md:order-none md:col-start-2 md:row-start-1 md:row-span-2 md:items-start md:justify-end">
            <img
              src={PRESCRIBED_HERO_SRC}
              alt="WindowMan prescription: we handle the contractor conversation so you don't waste time on estimates"
              loading="lazy"
              decoding="async"
              className="aspect-[4/3] w-full rounded-xl border border-[hsl(var(--fr-border))] object-cover"
            />
          </div>

          <div className="order-3 min-w-0 md:order-none md:col-start-1 md:row-start-2">
            <p className="max-w-2xl break-words fr-text-t3 text-sm font-medium leading-relaxed md:text-base">
              {explanation}
            </p>
            <p className="mt-3 max-w-2xl fr-text-t2 text-sm font-semibold leading-relaxed md:text-base">
              {WINDOWMAN_BRIDGE_TRANSITION}
            </p>
          </div>
        </div>

        {ctaEnabled && onPrimaryClick ? (
          <div className="mt-6">
            <button
              type="button"
              onClick={onPrimaryClick}
              className="fr-cta-primary inline-flex w-full items-center justify-center gap-2 px-6 py-4 text-base sm:w-auto"
            >
              A Better Quote is Moments Away
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </button>
            <p className="mt-3 text-xs font-medium text-[hsl(var(--fr-text-dim))]">
              Takes about 2 minutes · timeline, budget, decision-maker, and quote goals
            </p>
          </div>
        ) : (
          <p className="mt-6 rounded-xl border border-[hsl(var(--fr-border))] bg-[hsl(var(--fr-surface-2)/0.6)] px-4 py-3 text-sm font-medium fr-text-t3">
            Return to your homepage report flow to continue and get a better quote plan.
          </p>
        )}
      </div>
    </section>
  );
}
