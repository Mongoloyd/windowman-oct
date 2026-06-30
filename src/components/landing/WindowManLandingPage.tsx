import { useCallback, useEffect, useState } from "react";
import type { LandingIntent } from "./landingTypes";
import LandingHeader from "./LandingHeader";
import HeroSection from "./HeroSection";
import FounderIntro from "./FounderIntro";
import MarketAsymmetrySection from "./MarketAsymmetrySection";
import SystemExplainerSection from "./SystemExplainerSection";
import VisitorIdentityRouter from "./VisitorIdentityRouter";
import ProductEducationEngine from "./ProductEducationEngine";
import IntelligenceDatabaseSection from "./IntelligenceDatabaseSection";
import TruthReportShowcase from "./TruthReportShowcase";
import TrustCredibilitySection from "./TrustCredibilitySection";
import LandingFAQSection from "./LandingFAQSection";
import FinalCTASection from "./FinalCTASection";
import LandingFooter from "./LandingFooter";
import LandingStickyCta from "./LandingStickyCta";

export default function WindowManLandingPage() {
  const [selectedIntent, setSelectedIntent] = useState<LandingIntent>(null);
  const [expandedEducationModules, setExpandedEducationModules] = useState<string[]>([]);
  const [expandedFaqItems, setExpandedFaqItems] = useState<string[]>([]);
  const [stickyCtaVisible, setStickyCtaVisible] = useState(false);

  const toggleEducationModule = useCallback((moduleId: string) => {
    setExpandedEducationModules((prev) =>
      prev.includes(moduleId) ? prev.filter((id) => id !== moduleId) : [...prev, moduleId],
    );
  }, []);

  const toggleFaqItem = useCallback((itemId: string) => {
    setExpandedFaqItems((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId],
    );
  }, []);

  useEffect(() => {
    const hero = document.getElementById("hero");
    const finalCta = document.getElementById("final-cta");
    const footer = document.getElementById("landing-footer");
    if (!hero) return;

    let heroInView = true;
    let finalInView = false;
    let footerInView = false;

    const syncSticky = () => {
      setStickyCtaVisible(!heroInView && !finalInView && !footerInView);
    };

    const heroObserver = new IntersectionObserver(
      ([entry]) => {
        heroInView = entry.isIntersecting;
        syncSticky();
      },
      { threshold: 0, rootMargin: "-72px 0px 0px 0px" },
    );

    const bottomObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.target.id === "final-cta") finalInView = entry.isIntersecting;
        if (entry.target.id === "landing-footer") footerInView = entry.isIntersecting;
        syncSticky();
      },
      { threshold: 0.08 },
    );

    heroObserver.observe(hero);
    if (finalCta) bottomObserver.observe(finalCta);
    if (footer) bottomObserver.observe(footer);

    return () => {
      heroObserver.disconnect();
      bottomObserver.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:pb-0 [&_section]:scroll-mt-20">
      <LandingHeader />
      <main id="landing-main">
        <HeroSection />
        <FounderIntro />
        <MarketAsymmetrySection />
        <SystemExplainerSection />
        <VisitorIdentityRouter
          selectedIntent={selectedIntent}
          onSelectIntent={setSelectedIntent}
        />
        <ProductEducationEngine
          expandedModules={expandedEducationModules}
          onToggleModule={toggleEducationModule}
        />
        <IntelligenceDatabaseSection />
        <TruthReportShowcase />
        <TrustCredibilitySection />
        <LandingFAQSection expandedItems={expandedFaqItems} onToggleItem={toggleFaqItem} />
        <FinalCTASection />
      </main>
      <LandingFooter />
      <LandingStickyCta visible={stickyCtaVisible} />
    </div>
  );
}
