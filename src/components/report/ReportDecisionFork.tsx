import { useEffect, useRef } from "react";
import { ArrowRight, Check, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import type { AnalysisFlag } from "@/hooks/useAnalysisData";
import { trackGtmEvent } from "@/lib/trackConversion";

type PricePerOpeningBand = "low" | "market" | "high" | "extreme" | null | undefined;

interface DecisionForkCopyInput {
  grade: string;
  redCount: number;
  amberCount: number;
  flags: AnalysisFlag[];
  pricePerOpeningBand?: PricePerOpeningBand;
}

interface ReportDecisionForkProps extends DecisionForkCopyInput {
  onContractorMatchClick: () => void;
  isCtaLoading?: boolean;
  introRequested?: boolean;
}

export function getDecisionForkCopy({
  grade,
  redCount,
  amberCount,
  flags,
  pricePerOpeningBand,
}: DecisionForkCopyInput) {
  const normalizedGrade = grade.toUpperCase();
  const flagText = flags
    .map((flag) => `${flag.label} ${flag.detail ?? ""} ${flag.tip ?? ""} ${flag.pillar ?? ""}`)
    .join(" ")
    .toLowerCase();
  const hasCodeDocumentationIssue = /\b(noa|dp rating|design pressure|wind load|hvhz)\b/i.test(flagText);
  const hasWarrantyIssue = /\b(warranty|warranties|guarantee|labor coverage|manufacturer coverage)\b/i.test(flagText);
  const hasHighPrice = pricePerOpeningBand === "high" || pricePerOpeningBand === "extreme";

  if (normalizedGrade === "D" || normalizedGrade === "F") {
    return {
      riskLabel: "High-risk quote",
      subhead: "This quote is high-risk. Do not sign until you compare your options.",
      primaryReason: `Grade ${normalizedGrade} indicates elevated signing risk.`,
    };
  }

  if (redCount >= 3) {
    return {
      riskLabel: "Multiple critical findings",
      subhead: "Multiple critical findings were detected. A second quote is the safest move.",
      primaryReason: `${redCount} critical findings need a cleaner comparison path.`,
    };
  }

  if (hasHighPrice) {
    return {
      riskLabel: "Price appears above market",
      subhead: "Price appears above market. Compare before you commit.",
      primaryReason: `Price-per-opening band is ${pricePerOpeningBand}.`,
    };
  }

  if (hasCodeDocumentationIssue) {
    return {
      riskLabel: "Code documentation incomplete",
      subhead: "Code confidence is incomplete. Get another quote with clearer product documentation.",
      primaryReason: "Product approval, DP, wind-load, or HVHZ documentation needs clarification.",
    };
  }

  if (hasWarrantyIssue) {
    return {
      riskLabel: "Warranty issue detected",
      subhead: "Warranty protection is unclear. Compare before you accept the risk.",
      primaryReason: "Warranty terms need clarification before you sign.",
    };
  }

  return {
    riskLabel: amberCount > 0 ? "Quote needs clarification" : "Decision point",
    subhead: "Your quote has findings worth resolving. Choose how you want to handle them.",
    primaryReason: amberCount > 0 ? `${amberCount} review items are worth resolving first.` : "Use the report before you commit.",
  };
}

const ReportDecisionFork = ({
  grade,
  redCount,
  amberCount,
  flags,
  pricePerOpeningBand,
  onContractorMatchClick,
  isCtaLoading = false,
  introRequested = false,
}: ReportDecisionForkProps) => {
  const successTrackedRef = useRef(introRequested);
  const copy = getDecisionForkCopy({ grade, redCount, amberCount, flags, pricePerOpeningBand });

  useEffect(() => {
    if (!successTrackedRef.current && introRequested) {
      trackGtmEvent("wm_contractor_match_requested", {
        event_id: crypto.randomUUID(),
        category: "report",
        source: "full_report_decision_fork",
        conversion_type: "contractor_match_request",
        value: 500,
        currency: "USD",
        meta: {
          category: "opt",
          funnel_step: "full_report",
          grade,
          red_count: redCount,
          amber_count: amberCount,
        },
      });
    }
    successTrackedRef.current = introRequested;
  }, [amberCount, grade, introRequested, redCount]);

  const handlePrimaryClick = () => {
    trackGtmEvent("wm_local_heroes_cta_click", {
      event_id: crypto.randomUUID(),
      category: "report",
      source: "full_report_decision_fork",
      conversion_type: "local_heroes_intent",
      value: 500,
      currency: "USD",
      meta: {
        category: "opt",
        funnel_step: "full_report",
        cta_label: "Activate Local Heroes",
        grade,
        red_count: redCount,
        amber_count: amberCount,
        price_per_opening_band: pricePerOpeningBand ?? null,
      },
    });
    onContractorMatchClick();
  };

  const handleSecondaryClick = () => {
    trackGtmEvent("wm_second_quote_cta_click", {
      event_id: crypto.randomUUID(),
      category: "report",
      source: "full_report_decision_fork",
      conversion_type: "second_quote_intent",
      value: 300,
      currency: "USD",
      meta: {
        category: "opt",
        funnel_step: "full_report",
        cta_label: "Get My 2nd Quote",
        grade,
        red_count: redCount,
        amber_count: amberCount,
        price_per_opening_band: pricePerOpeningBand ?? null,
      },
    });
    onContractorMatchClick();
  };

  const isDisabled = isCtaLoading || introRequested;

  return (
    <section id="report-decision-fork" className="py-8 md:py-10 px-4 md:px-8 bg-background border-b border-border">
      <div className="max-w-4xl mx-auto">
        <div className="max-w-2xl mb-5 md:mb-6">
          <span className="wm-eyebrow text-primary">WHAT TO DO NOW</span>
          <h2 className="font-display text-foreground text-3xl md:text-4xl font-bold tracking-tight mt-2">
            Choose Your Next Move.
          </h2>
          <p className="font-body text-muted-foreground text-base md:text-lg leading-relaxed mt-3">
            {copy.subhead}
          </p>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 mt-4">
            <ShieldCheck size={15} className="text-primary" aria-hidden="true" />
            <span className="font-body text-sm font-semibold text-foreground">{copy.riskLabel}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 items-stretch">
          <article
            className="relative overflow-hidden rounded-3xl p-5 md:p-6 min-h-[320px] flex flex-col border"
            style={{
              background:
                "linear-gradient(145deg, hsl(var(--foreground)) 0%, hsl(var(--primary)) 58%, hsl(var(--color-cobalt-dim)) 100%)",
              borderColor: "hsl(var(--primary) / 0.36)",
              boxShadow: "0 22px 60px hsl(var(--primary) / 0.28), inset 0 1px 0 hsl(var(--primary-foreground) / 0.2)",
              color: "hsl(var(--primary-foreground))",
            }}
          >
            <div
              aria-hidden="true"
              className="absolute -right-16 -top-16 h-44 w-44 rounded-full"
              style={{ background: "hsl(var(--primary-foreground) / 0.12)", filter: "blur(18px)" }}
            />
            <div className="relative flex-1 flex flex-col">
              <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-foreground/15">
                <Sparkles size={21} aria-hidden="true" />
              </div>
              <h3 className="font-display text-2xl md:text-[28px] font-bold tracking-tight">Skip the Hassle</h3>
              <p className="font-body text-base font-semibold mt-2" style={{ color: "hsl(var(--primary-foreground) / 0.88)" }}>
                Save time and money by activating WindowMan’s Local Heroes.
              </p>
              <p className="font-body text-sm md:text-base leading-relaxed mt-4" style={{ color: "hsl(var(--primary-foreground) / 0.78)" }}>
                We’ll use your audit findings to help connect you with a vetted local installer who can give you a cleaner,
                safer second price.
              </p>
              <p className="font-body text-sm mt-4" style={{ color: "hsl(var(--primary-foreground) / 0.72)" }}>
                {copy.primaryReason}
              </p>
              <button
                type="button"
                onClick={handlePrimaryClick}
                disabled={isDisabled}
                className="mt-auto inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[var(--radius-btn)] bg-primary-foreground px-5 py-3 text-sm md:text-base font-bold text-primary shadow-lg transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-75"
              >
                {introRequested ? (
                  <Check size={18} aria-hidden="true" />
                ) : isCtaLoading ? (
                  <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowRight size={18} aria-hidden="true" />
                )}
                {introRequested ? "Request Received" : isCtaLoading ? "Activating Local Heroes..." : "Activate Local Heroes"}
              </button>
              {introRequested && (
                <p className="font-body text-sm font-semibold leading-relaxed mt-3" style={{ color: "hsl(var(--primary-foreground) / 0.9)" }}>
                  Local Hero request received — we’re preparing your safer quote path.
                </p>
              )}
            </div>
          </article>

          <article className="rounded-3xl border border-primary/20 bg-card/85 p-5 md:p-6 min-h-[320px] flex flex-col shadow-[var(--shadow-resting)] backdrop-blur">
            <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ShieldCheck size={21} aria-hidden="true" />
            </div>
            <h3 className="font-display text-foreground text-2xl md:text-[28px] font-bold tracking-tight">Get a 2nd Quote</h3>
            <p className="font-body text-foreground text-base font-semibold mt-2">
              Compare this quote against a cleaner local option.
            </p>
            <p className="font-body text-muted-foreground text-sm md:text-base leading-relaxed mt-4">
              Use your Truth Report as leverage. Get another price before you commit to vague scope, missing code details,
              or inflated pricing.
            </p>
            <p className="font-body text-muted-foreground text-sm mt-4">Same report intelligence. Cleaner comparison path.</p>
            <button
              type="button"
              onClick={handleSecondaryClick}
              disabled={isDisabled}
              className="mt-auto inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[var(--radius-btn)] border border-primary bg-primary px-5 py-3 text-sm md:text-base font-bold text-primary-foreground shadow-[var(--shadow-btn)] transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-75"
            >
              {isCtaLoading ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}
              Get My 2nd Quote
            </button>
          </article>
        </div>
      </div>
    </section>
  );
};

export default ReportDecisionFork;