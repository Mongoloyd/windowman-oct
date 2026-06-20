import { useState, useEffect } from "react";

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
      className="sticky top-0 z-50 flex h-16 w-full items-center border-b border-border bg-card"
      style={{
        boxShadow: scrolled ? "var(--shadow-shelf)" : "0 1px 2px rgba(10, 25, 55, 0.04)",
        transition: "box-shadow 0.15s ease",
      }}
    >
      <div className="flex w-full items-center justify-between px-4 md:px-8">
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

      {/* Lightweight status bar */}
      <div className="wm-header-status-bar absolute bottom-0 left-0 h-[1px] bg-primary/30" />
    </header>
  );
};

export default LinearHeader;
