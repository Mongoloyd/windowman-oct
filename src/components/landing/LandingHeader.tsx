import BrandLogo from "@/components/BrandLogo";
import { handoffToCanonicalUpload, handoffToSystemExplainer } from "./landingHandoff";

export default function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 flex h-16 w-full items-center border-b border-border/80 bg-card/95 shadow-sm backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 md:px-8">
        <BrandLogo to="/windowman" useRouterLink size="responsive" ariaLabel="WindowMan home" />

        <nav className="hidden items-center gap-6 md:flex" aria-label="Landing page navigation">
          <button
            type="button"
            onClick={() => handoffToSystemExplainer()}
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            How it works
          </button>
          <button
            type="button"
            onClick={() => handoffToCanonicalUpload()}
            className="btn-depth-primary"
            style={{ padding: "10px 20px", fontSize: 14 }}
          >
            Analyze My Quote
          </button>
        </nav>

        <button
          type="button"
          onClick={() => handoffToCanonicalUpload()}
          className="btn-depth-primary shrink-0 md:hidden"
          style={{ padding: "8px 16px", fontSize: 13 }}
        >
          Analyze My Quote
        </button>
      </div>
    </header>
  );
}
