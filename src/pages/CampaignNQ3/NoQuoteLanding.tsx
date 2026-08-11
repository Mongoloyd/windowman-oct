import { useCallback, useRef, useState, type FormEvent } from "react";
import { Helmet } from "react-helmet-async";
import nqLandingCss from "./nq-landing.css?raw";
import FAQ from "./FAQ";
import FinalCTA from "./FinalCTA";
import Footer from "./Footer";
import HeroSection from "./HeroSection";
import HowItWorks from "./HowItWorks";
import LeadCaptureModal from "./LeadCaptureModal";
import Navigation from "./Navigation";
import ReviewCriteria from "./ReviewCriteria";
import SampleFindings from "./SampleFindings";
import { createCampaignNq3LeadSubmitter } from "./campaignNq3LeadCapture";
import { scopeNq3Css } from "./scopeNq3Css";
import { isFloridaZip, type OnSubmitLead } from "./types";

interface NoQuoteLandingProps {
  onSubmitLead?: OnSubmitLead;
}

const scopedNqLandingCss = scopeNq3Css(nqLandingCss);

export default function NoQuoteLanding({ onSubmitLead }: NoQuoteLandingProps) {
  const [persistLead] = useState(createCampaignNq3LeadSubmitter);
  const [heroZip, setHeroZip] = useState("");
  const [finalZip, setFinalZip] = useState("");
  const [heroZipError, setHeroZipError] = useState("");
  const [finalZipError, setFinalZipError] = useState("");
  const [modalState, setModalState] = useState<{ step: 1 | 2; zip: string } | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const openModal = useCallback((step: 1 | 2, zip = "") => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setModalState({ step, zip });
  }, []);

  const closeModal = useCallback(() => {
    setModalState(null);
    window.requestAnimationFrame(() => openerRef.current?.focus());
  }, []);

  const submitZip = (
    event: FormEvent<HTMLFormElement>,
    zip: string,
    setError: (message: string) => void,
  ) => {
    event.preventDefault();
    if (!isFloridaZip(zip)) {
      setError("Enter a valid 5-digit Florida ZIP code.");
      event.currentTarget.querySelector("input")?.focus();
      return;
    }
    setError("");
    openModal(2, zip.trim());
  };

  return (
    <>
      <Helmet>
        <title>WindowMan — Get a Florida Window Estimate, Then Check It</title>
        <meta name="description" content="Get a Florida window or door estimate, then have WindowMan independently check the price, scope, fees, warranty, and fine print." />
      </Helmet>
      <style data-nq3-landing-styles>{scopedNqLandingCss}</style>
      <div data-page="campaign-nq3">
        <Navigation onGetStarted={() => openModal(1)} />
        <main>
          <HeroSection
            zip={heroZip}
            zipError={heroZipError}
            onZipChange={(value) => { setHeroZip(value); setHeroZipError(""); }}
            onCheckArea={(event) => submitZip(event, heroZip, setHeroZipError)}
          />
          <HowItWorks />
          <ReviewCriteria />
          <SampleFindings />
          <FAQ />
          <FinalCTA
            zip={finalZip}
            zipError={finalZipError}
            onZipChange={(value) => { setFinalZip(value); setFinalZipError(""); }}
            onCheckArea={(event) => submitZip(event, finalZip, setFinalZipError)}
          />
        </main>
        <Footer />
        {modalState && (
          <LeadCaptureModal
            initialStep={modalState.step}
            initialZip={modalState.zip}
            onClose={closeModal}
            onSubmitLead={onSubmitLead ?? persistLead}
          />
        )}
      </div>
    </>
  );
}
