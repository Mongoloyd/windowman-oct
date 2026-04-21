import "@fontsource/dm-sans/800.css";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

interface PublicNavbarProps {
  ctaText?: string;
  onCtaClick?: () => void;
}

/**
 * PublicNavbar — reusable public marketing header.
 *
 * Extracted from LinearHeader (homepage). Visual design is identical.
 *
 * Homepage-specific behaviour note:
 * - On `/`, Index.tsx continues to use `LinearHeader` directly, passing
 *   `onCtaClick={() => triggerTruthGate('header_cta')}` which scrolls the
 *   visitor into the scan funnel. That handler cannot safely be shared
 *   across routes.
 * - On all other public routes this component is used via `PublicLayout`.
 *   When no `onCtaClick` prop is supplied the button navigates to `/?scroll=upload`
 *   so the visitor is taken back to the homepage upload flow.
 */
const PublicNavbar = ({ ctaText = "Get Started Free", onCtaClick }: PublicNavbarProps) => {
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleCta = () => {
    if (onCtaClick) {
      onCtaClick();
    } else {
      navigate("/?scroll=upload");
    }
  };

  return (
    <header
      className="sticky top-0 z-50 w-full border-b border-border bg-card"
      style={{
        boxShadow: "var(--shadow-shelf)",
        transition: "padding 0.15s ease",
        padding: scrolled ? "6px 0" : "14px 0",
      }}
    >
      <div className="flex items-center justify-between px-4 md:px-8">
        {/* Logo */}
        <Link
          to="/"
          className="select-none group relative inline-flex items-center gap-2"
          aria-label="WindowMan.app home"
        >
          <span className="relative overflow-hidden inline-flex">
            <span
              role="img"
              aria-label="shield"
              className="text-[20px] transition-all duration-300 group-hover:drop-shadow-[0_0_6px_rgba(37,99,235,0.7)]"
            >
              🛡️
            </span>
          </span>
          <span className="font-display" style={{ fontWeight: 800, fontSize: 20, letterSpacing: "0.02em" }}>
            <span className="text-foreground">WINDOW</span>
            <span style={{ color: "#3e8fda" }}>MAN</span>
          </span>
        </Link>

        {/* Desktop nav — compact CTA */}
        <div className="hidden md:flex items-center gap-3">
          <button className="btn-depth-primary" style={{ padding: "10px 20px", fontSize: 14 }} onClick={handleCta}>
            {ctaText}
          </button>
        </div>

        {/* Mobile CTA — compact */}
        <button
          className="btn-depth-primary md:hidden"
          style={{ padding: "6px 14px", fontSize: 13 }}
          onClick={handleCta}
        >
          {ctaText}
        </button>
      </div>

      {/* Animated status bar */}
      <motion.div
        className="absolute bottom-0 left-0 h-[1px] bg-primary/30"
        initial={{ width: "0%" }}
        animate={{ width: "100%" }}
        transition={{ duration: 1.8, ease: "easeOut" }}
      />
    </header>
  );
};

export default PublicNavbar;
