import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import UploadZone from "@/components/UploadZone";
import SyntheticDemoLauncher from "@/components/synthetic-demo/SyntheticDemoLauncher";
import {
  prepareQuoteEducationHandoff,
  selectQuoteEducationHandoffSubmitter,
} from "@/components/synthetic-demo/quoteEducationHandoff";
import type { SyntheticDemoHandoffContext } from "@/components/synthetic-demo/types";
import { ExplainerVideoSection } from "@/components/landing/ExplainerVideoFacade";
import UniversalIntakeHost from "@/components/intake/universal/UniversalIntakeHost";
import { useScanFunnelSafe } from "@/state/scanFunnel";
import type {
  IntakeEntryPoint,
  IntakeOpenRequest,
  IntakePersistedSuccess,
  IntakeStepId,
  IntakeSubmitter,
  IntakeValues,
} from "@/components/intake/universal/intakeTypes";
import { useCampaignNqIllumination } from "../CampaignNQ/useCampaignNqIllumination";
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
import {
  clearNq3UploadResume,
  readNq3UploadResume,
  writeNq3UploadResume,
} from "./nq3UploadResume";
import { scopeNq3Css } from "./scopeNq3Css";
import type { OnSubmitLead } from "./types";

interface NoQuoteLandingProps {
  onSubmitLead?: OnSubmitLead;
}

const scopedNqLandingCss = scopeNq3Css(nqLandingCss);

/**
 * Every top-level block on the page, including the shared explainer section, so the
 * active-section light tracks the reader continuously rather than skipping blocks.
 */
const LIT_SECTION_SELECTOR = ":scope > section";

export default function NoQuoteLanding({ onSubmitLead }: NoQuoteLandingProps) {
  /**
   * Mounted on <main>, not the page wrapper. <main> is the closest common ancestor of
   * every layer that reads the illumination properties, so writing them here keeps
   * per-frame style invalidation off the nav, the footer, and the intake host.
   */
  const litPlaneRef = useCampaignNqIllumination<HTMLElement>({
    driver: "pointer",
    sectionSelector: LIT_SECTION_SELECTOR,
  });
  const [persistLead] = useState(createCampaignNq3LeadSubmitter);
  const [heroZip, setHeroZip] = useState("");
  const [finalZip, setFinalZip] = useState("");
  const [heroZipError, setHeroZipError] = useState("");
  const [finalZipError, setFinalZipError] = useState("");
  const [openRequest, setOpenRequest] = useState<IntakeOpenRequest | null>(null);
  const [uploadHandoff, setUploadHandoff] = useState(readNq3UploadResume);
  const [showUpload, setShowUpload] = useState(uploadHandoff !== null);
  const navigate = useNavigate();
  const funnel = useScanFunnelSafe();
  const intakeOpenRef = useRef(false);
  const uploadPendingRef = useRef(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const focusFrameRef = useRef<number | null>(null);
  const demoHandoffSubmitterRef = useRef<IntakeSubmitter | null>(null);

  useEffect(() => () => {
    if (focusFrameRef.current !== null) {
      window.cancelAnimationFrame(focusFrameRef.current);
    }
  }, []);

  const openIntake = useCallback((
    entryPoint: IntakeEntryPoint,
    startingStep: IntakeStepId,
    zipPrefill = "",
    presetValues?: IntakeOpenRequest["presetValues"],
    demoContext?: SyntheticDemoHandoffContext,
  ) => {
    if (intakeOpenRef.current) return;
    const prepared = demoContext
      ? prepareQuoteEducationHandoff(demoContext, "/nq3")
      : null;
    demoHandoffSubmitterRef.current = prepared?.submitter ?? null;
    intakeOpenRef.current = true;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpenRequest({
      requestId: crypto.randomUUID(),
      entryPoint,
      startingStep,
      zipPrefill: zipPrefill || undefined,
      presetValues: prepared
        ? { ...presetValues, ...prepared.presetValues }
        : presetValues,
    });
  }, []);

  const handlePersistedSuccess = useCallback((
    values: IntakeValues,
    persisted: IntakePersistedSuccess,
  ) => {
    if (values.intent !== "has_quote") {
      clearNq3UploadResume();
      uploadPendingRef.current = false;
      setShowUpload(false);
      setUploadHandoff(null);
      return;
    }

    const resume = writeNq3UploadResume({
      leadId: persisted.leadId,
      sessionId: persisted.sessionId,
    });

    if (!resume) {
      clearNq3UploadResume();
      uploadPendingRef.current = false;
      setShowUpload(false);
      setUploadHandoff(null);
      return;
    }

    funnel?.setLeadId(persisted.leadId);
    funnel?.setSessionId(persisted.sessionId);
    funnel?.setScanSessionId(null);
    funnel?.setQuoteFileId(null);
    funnel?.setPhone(values.phone, "screened_valid");
    setUploadHandoff(resume);
    setShowUpload(false);
    uploadPendingRef.current = true;
  }, [funnel]);

  const closeIntake = useCallback(() => {
    const shouldRevealUpload = uploadPendingRef.current;
    intakeOpenRef.current = false;
    demoHandoffSubmitterRef.current = null;
    setOpenRequest(null);
    uploadPendingRef.current = false;
    focusFrameRef.current = window.requestAnimationFrame(() => {
      focusFrameRef.current = null;
      openerRef.current?.focus({ preventScroll: true });
      if (shouldRevealUpload) setShowUpload(true);
    });
  }, []);

  const submitIntake = useCallback<IntakeSubmitter>((values, context) => {
    const selected = selectQuoteEducationHandoffSubmitter(
      demoHandoffSubmitterRef.current,
      onSubmitLead,
      persistLead,
    );
    return selected(values, context);
  }, [onSubmitLead, persistLead]);

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
        <main ref={litPlaneRef}>
          <HeroSection
            demoSlot={<SyntheticDemoLauncher variant="lens"
              attribution={{ sourcePath: "/nq3", entryPoint: "nq3_hero_quote_lens" }}
              onHasQuote={(context) => openIntake("hero_primary", "location", "", { intent: "has_quote" }, context)}
              onNoQuote={(context) => openIntake("hero_primary", "location", "", { intent: "no_quote" }, context)}
              renderTrigger={(trigger) => <div style={{ marginTop: 20 }}>
                <button {...trigger} type="button" className="btn" style={{ minHeight: 44, border: "1px solid #478aab", color: "#9adcf2", background: "#0b2536" }}>Try the 25-second Quote Lens</button>
                <p style={{ marginTop: 8, fontSize: 12, color: "#a8bbcb" }}>See three details a written estimate should make clear.</p>
              </div>} />}
            zip={heroZip}
            zipError={heroZipError}
            onZipChange={(value) => { setHeroZip(value); setHeroZipError(""); }}
            onCheckArea={(event) =>
              submitZip(event, heroZip, setHeroZipError, "hero_zip")
            }
            onHaveWrittenEstimate={() =>
              openIntake("hero_primary", "location", "", {
                intent: "has_quote",
              })
            }
          />
          <ExplainerVideoSection
            zipInputId="nq3-hero-zip"
            headline="See what WindowMan will check when your first estimate arrives."
          />
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
          <section
            className="relative px-5 pb-16 sm:px-8"
            data-campaign-shared-ui
            hidden={!showUpload}
          >
            <div className="mx-auto max-w-3xl">
              <UploadZone
                isVisible={showUpload}
                sessionId={uploadHandoff?.sessionId}
                leadId={uploadHandoff?.leadId ?? null}
                onScanStart={(_fileName, scanSessionId) => {
                  clearNq3UploadResume();
                  navigate(`/report/classic/${scanSessionId}`, {
                    state: { freshScan: true },
                  });
                }}
              />
            </div>
          </section>
        </main>
        <Footer />
        <UniversalIntakeHost
          config={nq3IntakeConfig}
          openRequest={openRequest}
          submitter={submitIntake}
          skin={Nq3IntakeSkin}
          onClose={closeIntake}
          onPersistedSuccess={handlePersistedSuccess}
        />
      </div>
    </>
  );
}
