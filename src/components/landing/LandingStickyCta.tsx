import { cn } from "@/lib/utils";
import { handoffToCanonicalUpload, handoffToFirstQuoteEducation } from "./landingHandoff";
import { landingCtaMinH, landingFocusRing } from "./landingTypes";

type LandingStickyCtaProps = {
  visible: boolean;
};

export default function LandingStickyCta({ visible }: LandingStickyCtaProps) {
  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 p-3 backdrop-blur-sm md:hidden",
        "pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shadow-[var(--shadow-shelf-up)]",
        "transition-transform duration-300 motion-reduce:transition-none",
        visible ? "translate-y-0" : "pointer-events-none translate-y-full",
      )}
      role="region"
      aria-label="Quick actions"
      aria-hidden={!visible}
    >
      <div className="mx-auto flex max-w-lg items-center gap-2">
        <button
          type="button"
          onClick={() => handoffToCanonicalUpload()}
          className={cn("btn-depth-primary flex-1 px-4 py-3 text-sm", landingCtaMinH, landingFocusRing)}
        >
          Analyze My Quote
        </button>
        <button
          type="button"
          onClick={() => handoffToFirstQuoteEducation()}
          className={cn(
            "btn-secondary-tactile shrink-0 px-3 py-3 text-sm",
            landingCtaMinH,
            landingFocusRing,
          )}
        >
          Need a quote?
        </button>
      </div>
    </div>
  );
}
