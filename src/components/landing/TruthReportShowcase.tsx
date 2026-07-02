import { cn } from "@/lib/utils";
import {
  handoffToProductEducation,
} from "./landingHandoff";
import {
  trackAndHandoffToCanonicalUpload,
  trackAndOpenFirstQuoteIntake,
} from "./landingTracking";
import { sampleReportCards, type SampleReportStatus } from "./sampleReportData";
import {
  landingContainerWide,
  landingCtaMinH,
  landingFocusRing,
  landingSectionPad,
} from "./landingTypes";

function statusTone(status: SampleReportStatus): string {
  switch (status) {
    case "Strong Next Step":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
    case "Needs Review":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
    case "Review Before Signing":
      return "bg-primary/10 text-primary";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export default function TruthReportShowcase() {
  return (
    <section
      id="sample-report"
      className={cn("border-t border-border bg-card", landingSectionPad)}
    >
      <div className={landingContainerWide}>
        <p className="wm-eyebrow mb-3 text-primary">SAMPLE TRUTH REPORT PREVIEW</p>
        <h2 className="wm-title-section mb-4 text-foreground">
          See what a Truth Report surfaces before you sign.
        </h2>
        <p className="mb-3 max-w-3xl text-base leading-relaxed text-muted-foreground">
          A Truth Report turns a confusing estimate into clear questions, scope signals, payment
          concerns, warranty clarity, and next steps. This is a sample preview — not a personalized
          finding from your quote.
        </p>
        <p className="mb-10 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          Sample report preview only. Your actual Truth Report is generated from your uploaded quote.
        </p>

        <div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          role="list"
          aria-label="Sample Truth Report sections"
        >
          {sampleReportCards.map((card) => (
            <article
              key={card.id}
              role="listitem"
              className="card-raised flex flex-col p-5 md:p-6"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-base font-bold text-foreground">{card.title}</h3>
                <span
                  className={cn(
                    "inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    statusTone(card.status),
                  )}
                >
                  <span className="sr-only">Status: </span>
                  {card.status}
                </span>
              </div>
              <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{card.copy}</p>
            </article>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-border pt-8 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => trackAndHandoffToCanonicalUpload("sample_report_analyze_quote")}
            className={cn(
              "btn-depth-primary w-full px-7 py-3.5 text-[15px] sm:w-auto",
              landingCtaMinH,
              landingFocusRing,
            )}
          >
            Analyze My Quote
          </button>
          <button
            type="button"
            onClick={() => trackAndOpenFirstQuoteIntake("sample_report_first_quote")}
            className={cn(
              "btn-secondary-tactile w-full px-7 py-3.5 text-[15px] sm:w-auto",
              landingCtaMinH,
              landingFocusRing,
            )}
          >
            Help Me Get My First Quote
          </button>
          <button
            type="button"
            onClick={() => handoffToProductEducation()}
            className={cn(
              "btn-secondary-tactile w-full px-5 py-3 text-sm sm:w-auto",
              landingCtaMinH,
              landingFocusRing,
            )}
          >
            Show Me What WindowMan Checks
          </button>
        </div>
      </div>
    </section>
  );
}
