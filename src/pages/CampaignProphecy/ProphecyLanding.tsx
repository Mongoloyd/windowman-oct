import { useCallback, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import UniversalIntakeHost from "@/components/intake/universal/UniversalIntakeHost";
import type {
  IntakeIntentChoice,
  IntakeOpenRequest,
  IntakePersistedSuccess,
  IntakeSubmitter,
  IntakeValues,
} from "@/components/intake/universal/intakeTypes";
import UploadZone from "@/components/UploadZone";
import { pushProphecyLowIntentEvent } from "@/lib/tracking/prophecyEvents";
import { getOrCreateFirstQuoteSessionId } from "@/services/windowmanFirstQuoteLeadCapture";
import { useCampaignNqIllumination } from "../CampaignNQ/useCampaignNqIllumination";
import ProphecyIntakeSkin from "./ProphecyIntakeSkin";
import { createCampaignProphecyLeadSubmitter } from "./campaignProphecyLeadCapture";
import { prophecyIntakeConfig } from "./prophecyIntakeConfig";
import {
  clearProphecyUploadResume,
  readProphecyUploadResume,
  writeProphecyUploadResume,
} from "./prophecyUploadResume";
import { useProphecyVariant } from "./useProphecyVariant";
import ProphecyExplainer from "./sections/ProphecyExplainer";
import ProphecyFAQ from "./sections/ProphecyFAQ";
import ProphecyFinalCTA from "./sections/ProphecyFinalCTA";
import ProphecyHero from "./sections/ProphecyHero";
import ProphecyPredictions from "./sections/ProphecyPredictions";
import { ProphecyFooter, ProphecyNavigation } from "./sections/ProphecyChrome";

const LIT_SECTION_SELECTOR = ":scope > section";

/**
 * /prophecy — dual-intent campaign landing.
 *
 * One page, two audiences, one lead record either way. The visitor taps the
 * card that describes them, and the intake opens with that answer already
 * recorded. Whichever branch they take, name, mobile and email are captured
 * before the page hands off.
 *
 * Estimate in hand → on success the upload zone opens below the fold and
 * scrolls itself into view, joining the canonical scan path from there. The
 * page never fetches analysis data itself; the OTP gate and the preview/full
 * boundary are untouched by this route.
 */
export default function ProphecyLanding() {
  const litPlaneRef = useCampaignNqIllumination<HTMLElement>({
    driver: "pointer",
    sectionSelector: LIT_SECTION_SELECTOR,
  });

  const variant = useProphecyVariant();
  const [basePersistLead] = useState(createCampaignProphecyLeadSubmitter);
  const [sessionId] = useState(getOrCreateFirstQuoteSessionId);

  const navigate = useNavigate();
  const [openRequest, setOpenRequest] = useState<IntakeOpenRequest | null>(
    null,
  );
  const [initialUploadResume] = useState(readProphecyUploadResume);
  const [showUpload, setShowUpload] = useState(
    initialUploadResume !== null,
  );
  const [uploadLeadId, setUploadLeadId] = useState<string | null>(
    initialUploadResume?.leadId ?? null,
  );
  const [uploadSessionId, setUploadSessionId] = useState<string | null>(
    initialUploadResume?.sessionId ?? null,
  );
  const uploadPendingRef = useRef(false);
  const intakeOpenRef = useRef(false);
  const openerRef = useRef<HTMLElement | null>(null);

  const persistLead = useCallback<IntakeSubmitter>(
    async (values, context) => {
      const result = await basePersistLead(values, context);
      if (!result.ok) {
        pushProphecyLowIntentEvent("form_error", {
          flow_variant: variant.id,
          wm_intent:
            values.intent === "has_quote" || values.intent === "no_quote"
              ? values.intent
              : null,
          step_name: "submission",
        });
      }
      return result;
    },
    [basePersistLead, variant.id],
  );

  /**
   * Opens the intake with the fork already answered.
   *
   * `startingStep: "location"` rather than "intent": the visitor just made the
   * choice on the page, and re-presenting it inside the modal would read as the
   * tap not registering. The host still validates the intent step on submit —
   * it is recorded, just not asked twice.
   */
  const chooseIntent = useCallback(
    (
      intent: IntakeIntentChoice,
      entryPoint: "hero_primary" | "footer_primary",
    ) => {
      if (intakeOpenRef.current) return;
      intakeOpenRef.current = true;

      openerRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;

      const measurement = {
        flow_variant: variant.id,
        wm_intent: intent,
        cta_location: entryPoint,
        step_name: "intent" as const,
      };
      pushProphecyLowIntentEvent("path_selected", measurement);
      pushProphecyLowIntentEvent("form_start", measurement);

      setOpenRequest({
        requestId: crypto.randomUUID(),
        entryPoint,
        startingStep: "location",
        presetValues: { intent },
      });
    },
    [variant.id],
  );

  const handlePersistedSuccess = useCallback(
    (values: IntakeValues, persisted: IntakePersistedSuccess) => {
      const intent = values.intent === "has_quote" ? "has_quote" : "no_quote";

      if (intent === "no_quote") {
        clearProphecyUploadResume();
        uploadPendingRef.current = false;
        setShowUpload(false);
        setUploadLeadId(null);
        setUploadSessionId(null);
        return;
      }

      const resume = writeProphecyUploadResume({
        leadId: persisted.leadId,
        sessionId: persisted.sessionId,
      });

      // Reveal the upload zone only once the modal is dismissed — UploadZone
      // scrolls itself into view when it becomes visible, which would otherwise
      // happen behind the dialog.
      //
      // When the resume hint cannot be persisted (e.g. malformed callback IDs),
      // still expose UploadZone using the page sessionId fallback — skipping
      // the resume hint is not a reason to break the has-quote handoff.
      if (resume) {
        setUploadLeadId(resume.leadId);
        setUploadSessionId(resume.sessionId);
      } else {
        clearProphecyUploadResume();
        setUploadLeadId(
          typeof persisted.leadId === "string" ? persisted.leadId : null,
        );
        setUploadSessionId(null);
      }
      uploadPendingRef.current = true;
    },
    [],
  );

  const closeIntake = useCallback(() => {
    intakeOpenRef.current = false;
    setOpenRequest(null);
    if (uploadPendingRef.current) {
      uploadPendingRef.current = false;
      setShowUpload(true);
    }
    window.requestAnimationFrame(() => openerRef.current?.focus());
  }, []);

  return (
    <>
      <Helmet>
        <title>
          WindowMan — We Can Tell You What&apos;s On Your Window Estimate
        </title>
        <meta
          name="description"
          content="Free, independent review of a Florida window or door estimate — price, scope, fees, warranty and fine print. No estimate yet? We'll help you get a first one worth comparing."
        />
      </Helmet>

      <div
        data-page="campaign-prophecy"
        className="min-h-screen bg-[#070e18] text-slate-100 antialiased"
      >
        {/* Ambient plane: warm key upper-right, cool fill upper-left, vignette
            to keep the edges from glowing. Purely decorative. */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_20%,rgba(59,130,246,0.16),transparent_58%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_88%_12%,rgba(244,162,97,0.20),transparent_55%)]" />
          {/* Largest fixed blur orbs: desktop-only. Mobile keeps lightweight gradients. */}
          <div className="absolute -top-48 right-[12%] hidden h-[620px] w-[620px] rounded-full bg-[#F4A261]/[0.13] blur-[150px] lg:block" />
          <div className="absolute top-[38%] -left-40 hidden h-[560px] w-[560px] rounded-full bg-[#60A5FA]/[0.11] blur-[140px] lg:block" />
          <div
            className="absolute inset-0 opacity-[0.045] mix-blend-overlay"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)",
              backgroundSize: "32px 32px",
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_58%,rgba(0,0,0,0.5)_100%)]" />
        </div>

        <div className="relative">
          <ProphecyNavigation />

          <main ref={litPlaneRef}>
            <ProphecyHero
              variant={variant}
              onChooseIntent={(intent) => chooseIntent(intent, "hero_primary")}
            />
            <ProphecyPredictions />
            <ProphecyExplainer
              onPlay={() =>
                pushProphecyLowIntentEvent("video_play", {
                  flow_variant: variant.id,
                  step_name: "explainer",
                })
              }
            />
            <ProphecyFAQ />
            <ProphecyFinalCTA
              onChooseIntent={(intent) =>
                chooseIntent(intent, "footer_primary")
              }
            />

            <section className="relative px-5 pb-16 sm:px-8">
              <div className="mx-auto max-w-3xl">
                <UploadZone
                  isVisible={showUpload}
                  sessionId={uploadSessionId ?? sessionId}
                  leadId={uploadLeadId}
                  onUploadAttempt={(fileType) =>
                    pushProphecyLowIntentEvent("upload_start", {
                      flow_variant: variant.id,
                      wm_intent: "has_quote",
                      step_name: "upload",
                      file_type: fileType,
                    })
                  }
                  onUploadFailure={(fileType) =>
                    pushProphecyLowIntentEvent("upload_error", {
                      flow_variant: variant.id,
                      wm_intent: "has_quote",
                      step_name: "upload",
                      file_type: fileType,
                    })
                  }
                  onScanStart={(_fileName, scanId) => {
                    clearProphecyUploadResume();
                    // Hand off to the canonical report route rather than
                    // re-implementing scan theatrics, preview polling and the
                    // OTP gate on a campaign page. That route owns the
                    // preview/full boundary; this page never sees analysis data.
                    navigate(`/report/classic/${scanId}`);
                  }}
                />
              </div>
            </section>
          </main>

          <ProphecyFooter />

          <UniversalIntakeHost
            config={prophecyIntakeConfig}
            openRequest={openRequest}
            submitter={persistLead}
            skin={ProphecyIntakeSkin}
            onClose={closeIntake}
            onPersistedSuccess={handlePersistedSuccess}
          />
        </div>
      </div>
    </>
  );
}
