import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import UploadZone from "@/components/UploadZone";
import UniversalIntakeHost from "@/components/intake/universal/UniversalIntakeHost";
import { useScanFunnelSafe } from "@/state/scanFunnel";
import type {
  IntakeEntryPoint,
  IntakeOpenRequest,
  IntakePersistedSuccess,
  IntakePersistedSuccessHandler,
  IntakeStepId,
  IntakeSubmitter,
  IntakeValues,
} from "@/components/intake/universal/intakeTypes";
import CampaignNq4Landing, {
  type Nq4SuccessSummary,
} from "./CampaignNq4Landing";
import Nq4IntakeSkin from "./Nq4IntakeSkin";
import { createCampaignNq4LeadSubmitter } from "./campaignNq4LeadCapture";
import { nq4IntakeConfig } from "./nq4IntakeConfig";
import {
  clearNq4UploadResume,
  readNq4UploadResume,
  type Nq4UploadResume,
  writeNq4UploadResume,
} from "./nq4UploadResume";

interface CampaignNq4PageProps {
  onSubmitLead?: IntakeSubmitter;
}

export default function CampaignNq4Page({
  onSubmitLead,
}: CampaignNq4PageProps) {
  const [persistLead] = useState(createCampaignNq4LeadSubmitter);
  const [openRequest, setOpenRequest] = useState<IntakeOpenRequest | null>(null);
  const [success, setSuccess] = useState<Nq4SuccessSummary | null>(null);
  const [uploadHandoff, setUploadHandoff] = useState(readNq4UploadResume);
  const [showUpload, setShowUpload] = useState(uploadHandoff !== null);
  const navigate = useNavigate();
  const funnel = useScanFunnelSafe();
  const intakeOpenRef = useRef(false);
  const uploadPendingRef = useRef(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const focusFrameRef = useRef<number | null>(null);
  const hydratedHandoffRef = useRef<string | null>(null);

  const hydrateFunnelIdentity = useCallback((handoff: Nq4UploadResume) => {
    if (!funnel) return;

    const identityKey = `${handoff.leadId}:${handoff.sessionId}`;
    if (hydratedHandoffRef.current === identityKey) return;
    hydratedHandoffRef.current = identityKey;

    // The resume record is intentionally ID-only. Clear any phone/OTP state
    // persisted by another funnel before binding this handoff identity.
    funnel.setPhone("", "none");
    funnel.setLeadId(handoff.leadId);
    funnel.setSessionId(handoff.sessionId);
    funnel.setScanSessionId(null);
    funnel.setQuoteFileId(null);
  }, [funnel]);

  useEffect(() => {
    if (uploadHandoff) hydrateFunnelIdentity(uploadHandoff);
  }, [hydrateFunnelIdentity, uploadHandoff]);

  useEffect(() => () => {
    if (focusFrameRef.current !== null) {
      window.cancelAnimationFrame(focusFrameRef.current);
    }
  }, []);

  const openIntake = useCallback(
    (
      entryPoint: IntakeEntryPoint,
      startingStep: IntakeStepId,
      zipPrefill = "",
      presetValues?: IntakeOpenRequest["presetValues"],
    ) => {
      if (intakeOpenRef.current) return;
      intakeOpenRef.current = true;
      openerRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setOpenRequest({
        requestId: crypto.randomUUID(),
        entryPoint,
        startingStep,
        zipPrefill: zipPrefill || undefined,
        presetValues,
      });
    },
    [],
  );

  const closeIntake = useCallback(() => {
    const shouldRevealUpload = uploadPendingRef.current;
    intakeOpenRef.current = false;
    setOpenRequest(null);
    uploadPendingRef.current = false;
    if (focusFrameRef.current !== null) {
      window.cancelAnimationFrame(focusFrameRef.current);
    }
    focusFrameRef.current = window.requestAnimationFrame(() => {
      focusFrameRef.current = null;
      openerRef.current?.focus({ preventScroll: true });
      if (shouldRevealUpload) setShowUpload(true);
    });
  }, []);

  const handlePersistedSuccess = useCallback<IntakePersistedSuccessHandler>((
    values: IntakeValues,
    persisted: IntakePersistedSuccess,
  ) => {
    if (values.intent !== "has_quote") {
      clearNq4UploadResume();
      uploadPendingRef.current = false;
      setShowUpload(false);
      setUploadHandoff(null);
      setSuccess({ firstName: values.name });
      return;
    }

    const resume = writeNq4UploadResume({
      leadId: persisted.leadId,
      sessionId: persisted.sessionId,
    });

    if (!resume) {
      clearNq4UploadResume();
      uploadPendingRef.current = false;
      setShowUpload(false);
      setUploadHandoff(null);
      return;
    }

    hydrateFunnelIdentity(resume);
    funnel?.setPhone(values.phone, "screened_valid");
    setUploadHandoff(resume);
    setShowUpload(false);
    uploadPendingRef.current = true;
  }, [funnel, hydrateFunnelIdentity]);

  return (
    <>
      <CampaignNq4Landing
        onStartIntake={openIntake}
        onHaveWrittenEstimate={() =>
          openIntake("hero_primary", "location", "", {
            intent: "has_quote",
          })
        }
        success={success}
        intakeSlot={
          success ? null : (
            <UniversalIntakeHost
              config={nq4IntakeConfig}
              openRequest={openRequest}
              submitter={onSubmitLead ?? persistLead}
              skin={Nq4IntakeSkin}
              onClose={closeIntake}
              onPersistedSuccess={handlePersistedSuccess}
            />
          )
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
              clearNq4UploadResume();
              navigate(`/report/classic/${scanSessionId}`, {
                state: { freshScan: true },
              });
            }}
          />
        </div>
      </section>
    </>
  );
}
