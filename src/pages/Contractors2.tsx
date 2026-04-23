import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageWrapper from "@/components/layout/PageWrapper";
import StickyCTAFooter from "@/components/StickyCTAFooter";
import HeroSection from "@/components/sections/HeroSection";
import MarketTruthSection from "@/components/sections/MarketTruthSection";
import CinematicDivider from "@/components/sections/CinematicDivider";
import CompetitorQuoteSection from "@/components/sections/CompetitorQuoteSection";
import BuyerReadinessSection from "@/components/sections/BuyerReadinessSection";
import HowItWorksSection from "@/components/sections/HowItWorksSection";
import ArbitrageModelSection from "@/components/sections/ArbitrageModelSection";
import EconomicsSection from "@/components/sections/EconomicsSection";
import FlywheelSection from "@/components/sections/FlywheelSection";
import DifferentiationSection from "@/components/sections/DifferentiationSection";
import ExclusivitySection from "@/components/sections/ExclusivitySection";
import VideoSection from "@/components/sections/VideoSection";
import BookingSection from "@/components/sections/BookingSection";
import QualificationStripSection from "@/components/sections/QualificationStripSection";
import FAQSection from "@/components/sections/FAQSection";
import QualificationFlow from "@/components/qualification/QualificationFlow";

const Contractors2 = () => {
  const [qualOpen, setQualOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <PageWrapper>
      <HeroSection onOpenQualification={() => setQualOpen(true)} />
      <MarketTruthSection />
      <CinematicDivider />
      <CompetitorQuoteSection onOpenQualification={() => setQualOpen(true)} />
      <BuyerReadinessSection />
      <HowItWorksSection />
      <ArbitrageModelSection onOpenQualification={() => setQualOpen(true)} />
      <EconomicsSection />
      <FlywheelSection onOpenQualification={() => setQualOpen(true)} />
      <DifferentiationSection />
      <ExclusivitySection onOpenQualification={() => setQualOpen(true)} />
      <VideoSection />
      <BookingSection />

      {/* AI Training infographic – lazy-loaded, blended with background */}
      <div className="relative w-full overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background pointer-events-none z-10" />
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent pointer-events-none z-10" />
        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent pointer-events-none z-10" />
        <img
          src="/images/ai-training-learning.avif"
          alt="WindowMan AI infrastructure — setup, learning, and growth stages"
          width={1920}
          height={1071}
          loading="lazy"
          decoding="async"
          className="w-full max-w-5xl mx-auto object-contain opacity-80"
          style={{ aspectRatio: "1920 / 1071" }}
        />
      </div>

      <QualificationStripSection onOpenQualification={() => setQualOpen(true)} />
      <FAQSection />
      <QualificationFlow isOpen={qualOpen} onClose={() => setQualOpen(false)} />

      <StickyCTAFooter
        onScanClick={() => navigate('/')}
        onDemoClick={() => navigate('/')}
        onPostConversionClick={() => { window.location.href = 'tel:+15614685571'; }}
        isVisible={true}
        conversionType={null}
      />
    </PageWrapper>
  );
};

export default Contractors2;
