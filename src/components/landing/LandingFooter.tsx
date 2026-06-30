import { Link } from "react-router-dom";
import BrandLogo from "@/components/BrandLogo";
import { handoffToCanonicalUpload } from "./landingHandoff";

const legalLinks = [
  { label: "Privacy", to: "/privacy" },
  { label: "Terms", to: "/terms" },
  { label: "Disclaimer", to: "/disclaimer" },
  { label: "Contact", to: "/contact" },
  { label: "FAQ", to: "/faq" },
] as const;

export default function LandingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-8 border-t border-border bg-card" aria-label="Landing page footer">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <BrandLogo to="/windowman" useRouterLink size="sm" ariaLabel="WindowMan landing home" />

        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          WindowMan helps Florida homeowners review impact-window quotes before signing. Not a
          contractor marketplace.
        </p>

        <nav className="mt-6" aria-label="Legal and support links">
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
            {legalLinks.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="text-foreground/75 transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <button
          type="button"
          onClick={() => handoffToCanonicalUpload()}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Analyze My Quote
        </button>

        <p className="mt-8 text-xs text-muted-foreground">
          &copy; {currentYear} WindowMan. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
