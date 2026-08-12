import { useCallback, useRef, useState, type FormEvent } from "react";
import { Helmet } from "react-helmet-async";
import { ExplainerVideoSection } from "@/components/landing/ExplainerVideoFacade";
import UniversalIntakeHost from "@/components/intake/universal/UniversalIntakeHost";
import type {
  IntakeEntryPoint,
  IntakeOpenRequest,
  IntakeStepId,
} from "@/components/intake/universal/intakeTypes";
import nqLandingCss from "./nq-landing.css?raw";
import FAQ from "./FAQ";
import FinalCTA from "./FinalCTA";
import Footer from "./Footer";
import HeroSection from "./HeroSection";
import HowItWorks from "./HowItWorks";
import Nq3IntakeSkin from "./Nq3IntakeSkin";
import Navigation from "./Navigation";
import ReviewCriteria from "./ReviewCriteria";
import SampleFindings from "./SampleFindings";
import { createCampaignNq3LeadSubmitter } from "./campaignNq3LeadCapture";
import { nq3FloridaProjectLocation, nq3IntakeConfig } from "./nq3IntakeConfig";
import { scopeNq3Css } from "./scopeNq3Css";
import type { OnSubmitLead } from "./types";

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
  const [openRequest, setOpenRequest] = useState<IntakeOpenRequest | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const openIntake = useCallback((
    entryPoint: IntakeEntryPoint,
    startingStep: IntakeStepId,
    zipPrefill = "",
  ) => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpenRequest({
      requestId: crypto.randomUUID(),
      entryPoint,
      startingStep,
      zipPrefill: zipPrefill || undefined,
    });
  }, []);

  const closeIntake = useCallback(() => {
    setOpenRequest(null);
    window.requestAnimationFrame(() => openerRef.current?.focus());
  }, []);

  const submitZip = (
    event: FormEvent<HTMLFormElement>,
    zip: string,
    setError: (message: string) => void,
    entryPoint: Extract<IntakeEntryPoint, "hero_zip" | "footer_zip">,
  ) => {
    event.preventDefault();
    if (!nq3FloridaProjectLocation.isEligibleZip(zip)) {
      setError(nq3FloridaProjectLocation.invalidMessage);
      event.currentTarget.querySelector("input")?.focus();
      return;
    }
    setError("");
    openIntake(entryPoint, "product", zip.trim());
  };

  return (
    <>
      <Helmet>
        <title>WindowMan — Get a Florida Window Estimate, Then Check It</title>
        <meta name="description" content="Get a Florida window or door estimate, then have WindowMan independently check the price, scope, fees, warranty, and fine print." />
      </Helmet>
      <style data-nq3-landing-styles>{scopedNqLandingCss}</style>
      <div data-page="campaign-nq3">
        <Navigation
          onGetStarted={() =>
            openIntake("navigation_primary", "location")
          }
        />
        <main>
          <HeroSection
            zip={heroZip}
            zipError={heroZipError}
            onZipChange={(value) => { setHeroZip(value); setHeroZipError(""); }}
            onCheckArea={(event) =>
              submitZip(event, heroZip, setHeroZipError, "hero_zip")
            }
          />
          <ExplainerVideoSection zipInputId="nq3-hero-zip" />
          <HowItWorks />
          <ReviewCriteria />
          <SampleFindings />
          <FAQ />
          <FinalCTA
            zip={finalZip}
            zipError={finalZipError}
            onZipChange={(value) => { setFinalZip(value); setFinalZipError(""); }}
            onCheckArea={(event) =>
              submitZip(event, finalZip, setFinalZipError, "footer_zip")
            }
          />
        </main>
        <Footer />
        <UniversalIntakeHost
          config={nq3IntakeConfig}
          openRequest={openRequest}
          submitter={onSubmitLead ?? persistLead}
          skin={Nq3IntakeSkin}
          onClose={closeIntake}
        />
      </div>
    </>
  );
}
