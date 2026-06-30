import BrandLogo from "@/components/BrandLogo";
import { cn } from "@/lib/utils";
import { handoffToCanonicalUpload, handoffToSystemExplainer } from "./landingHandoff";
import { landingContainerWide, landingCtaMinH, landingFocusRing } from "./landingTypes";

export default function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 flex h-16 w-full items-center border-b border-border/80 bg-card/95 shadow-sm backdrop-blur-sm">
      <div
        className={cn(
          landingContainerWide,
          "flex w-full items-center justify-between gap-4 px-4 md:px-8",
        )}
      >
        <BrandLogo to="/windowman" useRouterLink size="responsive" ariaLabel="WindowMan home" />

        <nav className="hidden items-center gap-6 md:flex" aria-label="Landing page navigation">
          <button
            type="button"
            onClick={() => handoffToSystemExplainer()}
            className={cn(
              "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
              landingFocusRing,
            )}
          >
            How it works
          </button>
          <button
            type="button"
            onClick={() => handoffToCanonicalUpload()}
            className={cn("btn-depth-primary px-5 py-2.5 text-sm", landingCtaMinH, landingFocusRing)}
          >
            Analyze My Quote
          </button>
        </nav>

        <button
          type="button"
          onClick={() => handoffToCanonicalUpload()}
          className={cn(
            "btn-depth-primary shrink-0 px-4 py-2 text-sm md:hidden",
            landingCtaMinH,
            landingFocusRing,
          )}
        >
          Analyze My Quote
        </button>
      </div>
    </header>
  );
}
