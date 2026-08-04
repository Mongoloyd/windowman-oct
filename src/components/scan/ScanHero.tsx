/**
 * ScanHero — Sprint 1 static hero for the flag-gated `/scan` landing page.
 *
 * Presentation only. No upload, scanner, Supabase, Gemini, or tracking behavior.
 * The primary CTA delegates to the parent, which owns the scroll + focus move to
 * the upload surface.
 */

import { useState } from "react";
import { ArrowRight, FileCheck2, LayoutGrid, ShieldCheck, UploadCloud } from "lucide-react";

/**
 * Homeowner mascot already served on the homepage hero (`AuditHero`) and the
 * Nextdoor hero stack. Transparent AVIF, so it sits on the light page directly.
 */
const HERO_IMAGE_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/87108037/YjBTWCdi7jZwa5GFcxbLnp/windowmanwithtruthreportonthephone_be309c26.avif";

const PAIN_POINTS = ["Hidden fees.", "Confusing terms.", "Unclear pricing."];

function FlowStep({
  icon: Icon,
  label,
}: {
  icon: typeof UploadCloud;
  label: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-white px-2 py-4 text-center">
      <Icon className="h-7 w-7 text-primary" aria-hidden="true" />
      <span className="text-[11px] font-bold uppercase leading-tight tracking-[0.08em] text-foreground sm:text-xs">
        {label}
      </span>
    </div>
  );
}

/**
 * ScanFlowCard — "Upload Estimate → Summary Report" card.
 * Lives beside the hero copy on desktop and below it on mobile.
 */
function ScanFlowCard() {
  return (
    <div className="card-raised-hero w-full overflow-hidden">
      <div className="p-5 sm:p-6">
        <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 sm:gap-3">
          <FlowStep icon={UploadCloud} label="Upload Estimate" />
          <div className="flex items-center justify-center px-1">
            <ArrowRight className="h-5 w-5 text-primary" aria-hidden="true" />
            <span className="sr-only">then</span>
          </div>
          <FlowStep icon={FileCheck2} label="Summary Report" />
        </div>

        <div className="my-5 h-px w-full bg-border" />

        <h2 className="text-xl font-extrabold uppercase leading-[1.1] tracking-tight text-foreground sm:text-2xl">
          Unbiased second opinion
          <span className="mt-1 block text-primary">Fast AI-powered quote review</span>
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          See what your estimate covers, what it leaves out, and which line items are worth
          questioning before you sign.
        </p>
      </div>

      <div className="flex items-center gap-2 bg-primary px-5 py-3.5">
        <LayoutGrid className="h-4 w-4 text-primary-foreground" aria-hidden="true" />
        <span className="text-sm font-bold text-primary-foreground">WindowMan</span>
        <span className="min-w-0 truncate text-sm text-primary-foreground/85">
          Unbiased AI Review
        </span>
      </div>
    </div>
  );
}

export default function ScanHero({ onGetReview }: { onGetReview: () => void }) {
  const [heroImageFailed, setHeroImageFailed] = useState(false);

  return (
    <section
      className="relative overflow-hidden border-b border-border/60"
      style={{
        background:
          "linear-gradient(168deg, hsl(214 35% 96%) 0%, hsl(216 40% 93%) 45%, hsl(214 33% 95%) 100%)",
      }}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12 sm:px-6 lg:min-h-[680px] lg:flex-row lg:items-center lg:gap-14 lg:py-16">
        {/* Copy + CTA — first in DOM so mobile shows headline and CTA before the flow card */}
        <div className="flex w-full min-w-0 flex-col items-start lg:flex-1">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-white/80 px-3 py-1">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/70">
              Independent quote review
            </span>
          </span>

          <h1 className="mt-5 text-4xl font-extrabold uppercase leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Tired of{" "}
            <span className="block text-primary">confusing estimates?</span>
          </h1>

          <ul className="mt-6 flex flex-col gap-2">
            {PAIN_POINTS.map((point) => (
              <li key={point} className="flex items-center gap-2.5 text-lg text-foreground/80">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>

          <p className="mt-4 text-lg font-semibold text-foreground">It&apos;s frustrating.</p>

          <button
            type="button"
            onClick={onGetReview}
            className="btn-depth-primary mt-8 w-full px-8 py-4 text-base sm:w-auto"
          >
            Get My Free Estimate Review
          </button>

          <p className="mt-3 text-sm text-muted-foreground">Free review. No obligation.</p>
        </div>

        {/* Hero visual + flow card */}
        <div className="flex w-full min-w-0 justify-center lg:flex-1">
          <div className="relative flex w-full max-w-[440px] flex-col items-center lg:max-w-[480px]">
            <div
              className="relative flex h-[180px] w-full items-end justify-center sm:h-[230px] lg:h-[280px]"
              style={{
                background:
                  "radial-gradient(60% 60% at 50% 65%, hsl(217 91% 53% / 0.14) 0%, transparent 70%)",
              }}
            >
              {!heroImageFailed && (
                <img
                  src={HERO_IMAGE_URL}
                  alt="WindowMan holding a phone showing a window quote review"
                  width={480}
                  height={640}
                  loading="eager"
                  decoding="async"
                  onError={() => setHeroImageFailed(true)}
                  className="h-full w-full object-contain object-bottom"
                />
              )}
            </div>

            <div className="relative z-10 -mt-4 w-full">
              <ScanFlowCard />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
