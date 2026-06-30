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
  const [sampleReportExpanded, setSampleReportExpanded] = useState(false);
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
    if (!hero) return;

    const heroObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStickyCtaVisible(false);
        }
      },
      { threshold: 0.1 },
    );

    const scrollObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
          setStickyCtaVisible(true);
        }
      },
      { threshold: 0 },
    );

    heroObserver.observe(hero);
    scrollObserver.observe(hero);

    let finalCtaObserver: IntersectionObserver | null = null;
    if (finalCta) {
      finalCtaObserver = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setStickyCtaVisible(false);
        },
        { threshold: 0.2 },
      );
      finalCtaObserver.observe(finalCta);
    }

    return () => {
      heroObserver.disconnect();
      scrollObserver.disconnect();
      finalCtaObserver?.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 [&_section]:scroll-mt-20">
      <LandingHeader />
      <main>
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
        <TruthReportShowcase
          expanded={sampleReportExpanded}
          onToggle={() => setSampleReportExpanded((prev) => !prev)}
        />
        <TrustCredibilitySection />
        <LandingFAQSection expandedItems={expandedFaqItems} onToggleItem={toggleFaqItem} />
        <FinalCTASection />
      </main>
      <LandingFooter />
      <LandingStickyCta visible={stickyCtaVisible} />
    </div>
  );
}
