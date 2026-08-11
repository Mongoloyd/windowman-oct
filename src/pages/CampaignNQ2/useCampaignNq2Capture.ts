import { useCallback, useRef, useState, type FormEvent } from "react";
import { createUuid } from "@/lib/createUuid";
import { formatTruthGatePhoneDisplay } from "@/lib/validation/truthGateContact";
import {
  submitCampaignNq2Lead,
  type SubmitCampaignNq2LeadInput,
} from "./campaignNq2LeadCapture";
import { campaignNq2Schema } from "./campaignNq2Schema";
import type {
  CampaignNq2Field,
  CampaignNq2FormValues,
  CampaignNq2SubmitState,
} from "./campaignNq2Types";

const INITIAL_VALUES: CampaignNq2FormValues = {
  firstName: "",
  phone: "",
  email: "",
};

type CampaignNq2Errors = Partial<Record<CampaignNq2Field, string>>;

export function useCampaignNq2Capture() {
  const [values, setValues] = useState<CampaignNq2FormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<CampaignNq2Errors>({});
  const [submitState, setSubmitState] =
    useState<CampaignNq2SubmitState>("idle");
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [marketingCommunicationsGranted, setMarketingCommunicationsGranted] =
    useState(false);
  const [sessionId] = useState(createUuid);
  const submissionIdRef = useRef<string>(createUuid());
  const inFlightRef = useRef(false);

  const updateField = useCallback(
    (field: CampaignNq2Field, value: string) => {
      const nextValue =
        field === "phone" ? formatTruthGatePhoneDisplay(value) : value;
      setValues((current) => ({ ...current, [field]: nextValue }));
      setErrors((current) => ({ ...current, [field]: undefined }));
      setServerMessage(null);
      setSubmitState((current) =>
        current === "submitting" || current === "success"
          ? current
          : "editing",
      );
    },
    [],
  );

  const updateMarketingConsent = useCallback((checked: boolean) => {
    if (inFlightRef.current) return;

    setMarketingCommunicationsGranted(checked);
    // One submission ID represents one immutable consent decision. A changed
    // choice starts a new transaction; byte-equivalent retries keep the ID.
    submissionIdRef.current = createUuid();
    setServerMessage(null);
  }, []);

  const submit = useCallback(
    async (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      if (inFlightRef.current || submitState === "success") return;

      const parsed = campaignNq2Schema.safeParse(values);
      if (!parsed.success) {
        const nextErrors: CampaignNq2Errors = {};
        for (const issue of parsed.error.issues) {
          const field = issue.path[0] as CampaignNq2Field | undefined;
          if (field && !nextErrors[field]) nextErrors[field] = issue.message;
        }
        setErrors(nextErrors);
        setSubmitState("editing");
        return;
      }

      inFlightRef.current = true;
      setErrors({});
      setServerMessage(null);
      setSubmitState("submitting");

      const input: SubmitCampaignNq2LeadInput = {
        sessionId,
        submissionId: submissionIdRef.current,
        marketingCommunicationsGranted,
        ...parsed.data,
      };

      try {
        const result = await submitCampaignNq2Lead(input);
        if (result.ok) {
          setSubmitState("success");
        } else {
          setServerMessage(result.message);
          setSubmitState("error");
        }
      } catch {
        setServerMessage(
          "We couldn't save your request yet. Check your connection and try again.",
        );
        setSubmitState("error");
      } finally {
        inFlightRef.current = false;
      }
    },
    [marketingCommunicationsGranted, sessionId, submitState, values],
  );

  return {
    values,
    errors,
    submitState,
    serverMessage,
    marketingCommunicationsGranted,
    updateMarketingConsent,
    updateField,
    submit,
  };
}
