import { Link } from "react-router-dom";

type SiteFooterProps = {
  className?: string;
};

const legalLinks = [
  { label: "Privacy", to: "/privacy" },
  { label: "Terms", to: "/terms" },
  { label: "Disclaimer", to: "/disclaimer" },
  { label: "Contact", to: "/contact" },
  { label: "FAQ", to: "/faq" },
] as const;

const trustSpine = [
  "WindowMan helps Florida homeowners review impact-window quotes before signing.",
  "WindowMan is a quote-review tool, not a contractor marketplace or lead resale page.",
  "WindowMan is not a contractor, licensed installer, law firm, building department, insurance advisor, or public adjuster.",
  "We do not send your uploaded quote back to the original contractor as part of the review.",
  "If you request contractor help, WindowMan may earn a referral fee from a contractor introduced through our network.",
] as const;

export default function SiteFooter({ className = "" }: SiteFooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className={`mt-20 border-t border-border bg-card text-foreground ${className}`}
      aria-label="Site footer"
    >
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <p className="text-lg font-semibold tracking-tight">
            <span className="text-foreground">WINDOW</span>
            <span className="text-primary">MAN</span>
          </p>

          <div className="space-y-3 text-sm leading-6 text-muted-foreground">
            {trustSpine.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>

          <nav aria-label="Legal and support links">
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

          <div>
            <Link
              to="/#truth-gate"
              className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Check My Quote Before I Sign
            </Link>
          </div>

          <p className="text-xs text-muted-foreground">
            &copy; {currentYear} WindowMan. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
