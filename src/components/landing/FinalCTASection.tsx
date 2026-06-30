import { cn } from "@/lib/utils";
import { handoffToCanonicalUpload, openFirstQuoteIntake } from "./landingHandoff";
import {
  landingContainerMid,
  landingCtaMinH,
  landingFocusRing,
  landingSectionPad,
} from "./landingTypes";

export default function FinalCTASection() {
  return (
    <section
      id="final-cta"
      className={cn("border-t border-border bg-background", landingSectionPad)}
    >
      <div className={landingContainerMid}>
        <p className="wm-eyebrow mb-3 text-center text-primary">READY TO TAKE CONTROL?</p>
        <h2 className="wm-title-section mb-4 text-center text-foreground">
          Choose your path to a smarter window project.
        </h2>
        <p className="mx-auto mb-10 max-w-2xl text-center text-sm leading-relaxed text-muted-foreground">
          You do not need to sign blind, compare confusing quotes alone, or start your first estimate
          without knowing what to ask.
        </p>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="card-dominant flex flex-col p-6 md:p-8">
            <h3 className="mb-2 font-display text-xl font-bold text-foreground">I have a quote.</h3>
            <p className="mb-6 flex-1 text-sm leading-relaxed text-muted-foreground">
              Upload your estimate and start with a quote review.
            </p>
            <button
              type="button"
              onClick={() => handoffToCanonicalUpload()}
              className={cn("btn-depth-primary w-full px-7 py-3.5 text-[15px]", landingCtaMinH, landingFocusRing)}
            >
              Analyze My Quote
            </button>
          </div>

          <div className="card-raised flex flex-col p-6 md:p-8">
            <h3 className="mb-2 font-display text-xl font-bold text-foreground">I need a quote.</h3>
            <p className="mb-6 flex-1 text-sm leading-relaxed text-muted-foreground">
              Start with guidance on what a strong estimate should include.
            </p>
            <button
              type="button"
              onClick={() => openFirstQuoteIntake()}
              className={cn(
                "btn-secondary-tactile w-full px-7 py-3.5 text-[15px]",
                landingCtaMinH,
                landingFocusRing,
              )}
            >
              Help Me Get My First Quote
            </button>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Educational analysis only. No guaranteed savings. No contractor pressure.
        </p>
      </div>
    </section>
  );
}
