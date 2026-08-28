import { useState, useEffect } from "react";
import BrandLogo from "@/components/BrandLogo";

interface LinearHeaderProps {
  ctaText?: string;
  onCtaClick?: () => void;
}

const LinearHeader = ({ ctaText = "Get Started Free", onCtaClick }: LinearHeaderProps) => {
  const [scrolled, setScrolled] = useState(() => typeof window !== "undefined" && window.scrollY > 20);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
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
        <BrandLogo href="/" size="responsive" ariaLabel="WindowMan.app home" />

        <div className="hidden md:flex items-center gap-3">
          <button
            className="btn-depth-primary"
            style={{ padding: "10px 20px", fontSize: 14 }}
            onClick={onCtaClick}
            data-wm-primary-cta="true"
            data-wm-cta-id="header_primary_desktop"
            data-wm-cta-location="header"
          >
            {ctaText}
          </button>
        </div>

        <button
          className="btn-depth-primary md:hidden"
          style={{ padding: "6px 14px", fontSize: 13 }}
          onClick={onCtaClick}
          data-wm-primary-cta="true"
          data-wm-cta-id="header_primary_mobile"
          data-wm-cta-location="header"
        >
          {ctaText}
        </button>
      </div>

      <div className="wm-header-status-bar absolute bottom-0 left-0 h-[1px] bg-primary/30" />
    </header>
  );
};

export default LinearHeader;
