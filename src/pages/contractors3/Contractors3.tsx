import React, { useState } from "react";
import PageWrapper from "./components/layout/PageWrapper.jsx";
import HeroSection from "./components/sections/HeroSection.jsx";
import MarketTruthSection from "./components/sections/MarketTruthSection.jsx";
import CompetitorQuoteSection from "./components/sections/CompetitorQuoteSection.jsx";
import BuyerReadinessSection from "./components/sections/BuyerReadinessSection.jsx";
import HowItWorksSection from "./components/sections/HowItWorksSection.jsx";
import EconomicsSection from "./components/sections/EconomicsSection.jsx";
import DifferentiationSection from "./components/sections/DifferentiationSection.jsx";
import ExclusivitySection from "./components/sections/ExclusivitySection.jsx";
import VideoSection from "./components/sections/VideoSection.jsx";
import BookingSection from "./components/sections/BookingSection.jsx";
import QualificationStripSection from "./components/sections/QualificationStripSection.jsx";
import FAQSection from "./components/sections/FAQSection.jsx";
import NativeBookingForm from "./components/sections/NativeBookingForm.jsx";
import QualificationFlow from "@/components/qualification/QualificationFlow";
import CTAFloatPill from "@/components/contractors/CTAFloatPill";
import { WarmIntentProvider } from "@/hooks/useWarmIntent";

const Contractors3 = () => {
  const [qualOpen, setQualOpen] = useState(false);
  const openQual = () => setQualOpen(true);

  return (
    <WarmIntentProvider>
      <div className="contractors3-page">
        <PageWrapper>
          <HeroSection onOpenQualification={openQual} />
          <MarketTruthSection />
          <CompetitorQuoteSection onOpenQualification={openQual} />
          <BuyerReadinessSection />
          <HowItWorksSection />
          <EconomicsSection onOpenQualification={openQual} />
          <DifferentiationSection onOpenQualification={openQual} />
          <ExclusivitySection onOpenQualification={openQual} />
          <VideoSection />
          <BookingSection />
          <QualificationStripSection onOpenQualification={openQual} />
          <FAQSection />
          <NativeBookingForm />
        </PageWrapper>

        <QualificationFlow isOpen={qualOpen} onClose={() => setQualOpen(false)} />

        <div className="fixed bottom-0 left-0 right-0 z-40 mb-4 px-4 flex justify-center md:hidden">
          <button
            onClick={openQual}
            className="w-full max-w-[340px] rounded-full bg-white px-6 py-3.5 text-center text-sm font-bold text-black shadow-[0_4px_20px_rgba(255,255,255,0.15)] transition-transform active:scale-95"
          >
            Check Your Territory
          </button>
        </div>

        <CTAFloatPill onRequestAccess={openQual} />
      </div>
    </WarmIntentProvider>
  );
};

export default Contractors3;
