import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-card text-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-[1.35fr_1fr_1fr] md:px-8">
        <div>
          <div className="mb-3 text-lg font-semibold tracking-tight">
            <span className="text-foreground">WINDOW</span>
            <span style={{ color: "#448df7" }}>MAN</span>
            <span className="text-foreground">.PRO</span>
          </div>
          <p className="max-w-md text-sm leading-6 text-foreground/65">
            Forensic Quote Analysis for homeowners who want clarity before they sign.
          </p>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Company</h3>
          <nav className="space-y-2 text-sm">
            <Link to="/about" className="block text-foreground/75 transition hover:text-foreground">
              About
            </Link>
            <Link to="/contact" className="block text-foreground/75 transition hover:text-foreground">
              Contact
            </Link>
            <Link to="/faq" className="block text-foreground/75 transition hover:text-foreground">
              FAQ
            </Link>
          </nav>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Legal</h3>
          <nav className="space-y-2 text-sm">
            <Link to="/privacy" className="block text-foreground/75 transition hover:text-foreground">
              Privacy Policy
            </Link>
            <Link to="/terms" className="block text-foreground/75 transition hover:text-foreground">
              Terms of Service
            </Link>
            <Link to="/disclaimer" className="block text-foreground/75 transition hover:text-foreground">
              Disclaimer
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
