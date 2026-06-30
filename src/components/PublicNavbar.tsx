import "@fontsource/dm-sans/800.css";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import BrandLogo from "@/components/BrandLogo";

interface PublicNavbarProps {
  ctaText?: string;
  onCtaClick?: () => void;
}

/**
 * PublicNavbar — reusable public marketing header.
 *
 * Uses the canonical homepage BrandLogo.
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
        <BrandLogo to="/" useRouterLink size="md" ariaLabel="WindowMan.app home" />

        <div className="hidden md:flex items-center gap-3">
          <button className="btn-depth-primary" style={{ padding: "10px 20px", fontSize: 14 }} onClick={handleCta}>
            {ctaText}
          </button>
        </div>

        <button
          className="btn-depth-primary md:hidden"
          style={{ padding: "6px 14px", fontSize: 13 }}
          onClick={handleCta}
        >
          {ctaText}
        </button>
      </div>

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
