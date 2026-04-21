import "@fontsource/dm-sans/800.css";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface LinearHeaderProps {
  ctaText?: string;
  onCtaClick?: () => void;
}

const LinearHeader = ({ ctaText = "Get Started Free", onCtaClick }: LinearHeaderProps) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
        <a
          href="/"
          className="select-none group relative inline-flex items-center gap-1.5 sm:gap-2 max-w-[45%] sm:max-w-none"
          aria-label="WindowMan.app home"
        >
          <span className="relative overflow-hidden inline-flex">
            <span
              role="img"
              aria-label="shield"
              className="text-[16px] sm:text-[20px] transition-all duration-300 group-hover:drop-shadow-[0_0_6px_rgba(37,99,235,0.7)]"
            >
              🛡️
            </span>
          </span>
          <span className="font-display text-sm sm:text-xl" style={{ fontWeight: 800, letterSpacing: "0.02em" }}>
            <span className="text-foreground">WINDOW</span>
            <span style={{ color: "#448df7" }}>MAN</span>
            <sup
              className="text-muted-foreground text-[7px] sm:text-[9px]"
              style={{ fontWeight: 400, letterSpacing: "0.15em", marginLeft: 2, verticalAlign: "super" }}
            >
              .PRO
            </sup>
          </span>
        </a>

        {/* Desktop nav — compact CTA */}
        <div className="hidden md:flex items-center gap-3">
          <button className="btn-depth-primary" style={{ padding: "10px 20px", fontSize: 14 }} onClick={onCtaClick}>
            {ctaText}
          </button>
        </div>

        {/* Mobile CTA — compact */}
        <button
          className="btn-depth-primary md:hidden"
          style={{ padding: "6px 14px", fontSize: 13 }}
          onClick={onCtaClick}
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

export default LinearHeader;
