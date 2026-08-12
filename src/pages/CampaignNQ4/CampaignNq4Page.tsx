import { useCallback, useRef, useState } from "react";
import UniversalIntakeHost from "@/components/intake/universal/UniversalIntakeHost";
import type {
  IntakeOpenRequest,
  IntakePersistedSuccessHandler,
  IntakeSubmitter,
} from "@/components/intake/universal/intakeTypes";
import CampaignNq4Landing, {
  type Nq4EntryPoint,
  type Nq4StartingStep,
  type Nq4SuccessSummary,
} from "./CampaignNq4Landing";
import Nq4IntakeSkin from "./Nq4IntakeSkin";
import { createCampaignNq4LeadSubmitter } from "./campaignNq4LeadCapture";
import { nq4IntakeConfig } from "./nq4IntakeConfig";

interface CampaignNq4PageProps {
  onSubmitLead?: IntakeSubmitter;
}

export default function CampaignNq4Page({
  onSubmitLead,
}: CampaignNq4PageProps) {
  const [persistLead] = useState(createCampaignNq4LeadSubmitter);
  const [openRequest, setOpenRequest] = useState<IntakeOpenRequest | null>(null);
  const [success, setSuccess] = useState<Nq4SuccessSummary | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const openIntake = useCallback(
    (
      entryPoint: Nq4EntryPoint,
      startingStep: Nq4StartingStep,
      zipPrefill = "",
    ) => {
      openerRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setOpenRequest({
        requestId: crypto.randomUUID(),
        entryPoint,
        startingStep,
        zipPrefill: zipPrefill || undefined,
      });
    },
    [],
  );

  const closeIntake = useCallback(() => {
    setOpenRequest(null);
    window.requestAnimationFrame(() => openerRef.current?.focus());
  }, []);

  const handlePersistedSuccess =
    useCallback<IntakePersistedSuccessHandler>((values) => {
      setSuccess({ firstName: values.name });
    }, []);

  return (
    <CampaignNq4Landing
      onStartIntake={openIntake}
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
  );
}
