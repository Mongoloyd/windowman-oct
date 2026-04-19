import React from "react";
import { Link } from "react-router-dom";
import { Facebook, Instagram } from "lucide-react";

type SiteFooterProps = {
  className?: string;
};

const footerLinks = {
  company: [
    { label: "Home", to: "/" },
    { label: "About", to: "/about" },
    { label: "Contact", to: "/contact" },
    { label: "Contractors", to: "/contractors" },
  ],
  resources: [
    { label: "FAQ", to: "/faq" },
    { label: "How We Beat Window Estimates", to: "/how-we-beat-window-estimates" },
  ],
  legal: [
    { label: "Terms", to: "/terms" },
    { label: "Privacy", to: "/privacy" },
  ],
};

export default function SiteFooter({ className = "" }: SiteFooterProps) {
  return (
    <footer
      className={`mt-20 border-t border-slate-200 bg-slate-100/90 text-slate-700 ${className}`}
      aria-label="Site footer"
    >
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-lg font-extrabold tracking-tight text-slate-900"
              aria-label="WindowMan home"
            >
              <span className="rounded-md px-2 py-1 font-bold uppercase tracking-[0.14em] text-white bg-white/0 text-xl">
                🛡️
              </span>
              <span>WINDOWMAN</span>
            </Link>

            <p className="mt-4 max-w-xs text-sm leading-6 text-slate-600">
              Quote Intelligence For Home Improvement Contracts.
            </p>

            <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
              Helping Homeowners Compare Scope, Pricing, and Risk Before They Sign.
            </p>
          </div>

          {/* Company */}
          <nav aria-label="Company links">
            <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-900">Company</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.company.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="text-sm text-slate-600 transition-colors hover:text-slate-900">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Resources */}
          <nav aria-label="Resource links">
            <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-900">Resources</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.resources.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="text-sm text-slate-600 transition-colors hover:text-slate-900">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Legal + Social */}
          <div>
            <nav aria-label="Legal links">
              <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-900">Legal</h3>
              <ul className="mt-4 space-y-3">
                {footerLinks.legal.map((item) => (
                  <li key={item.to}>
                    <Link to={item.to} className="text-sm text-slate-600 transition-colors hover:text-slate-900">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="mt-8">
              <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-900">Follow</h3>

              <div className="mt-4 flex items-center gap-3">
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="WindowMan on Facebook"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:text-slate-900"
                >
                  <Facebook size={18} />
                </a>

                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="WindowMan on Instagram"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:text-slate-900"
                >
                  <Instagram size={18} />
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-200 pt-6">
          <p className="text-xs text-slate-500"></p>
        </div>
      </div>
    </footer>
  );
}
