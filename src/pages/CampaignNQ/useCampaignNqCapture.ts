import { useCallback, useRef, useState, type FormEvent } from "react";
import { createUuid } from "@/lib/createUuid";
import { formatTruthGatePhoneDisplay } from "@/lib/validation/truthGateContact";
import {
  submitCampaignNqLead,
  type SubmitCampaignNqLeadInput,
} from "./campaignNqLeadCapture";
import { campaignNqSchema } from "./campaignNqSchema";
import type {
  CampaignNqField,
  CampaignNqFormValues,
  CampaignNqSubmitState,
} from "./campaignNqTypes";

const INITIAL_VALUES: CampaignNqFormValues = {
  firstName: "",
  phone: "",
  email: "",
};

type CampaignNqErrors = Partial<Record<CampaignNqField, string>>;

export function useCampaignNqCapture() {
  const [values, setValues] = useState<CampaignNqFormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<CampaignNqErrors>({});
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [submitState, setSubmitState] =
    useState<CampaignNqSubmitState>("idle");
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [sessionId] = useState(createUuid);
  const submissionIdRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  if (!submissionIdRef.current) {
    submissionIdRef.current = createUuid();
  }

  const updateField = useCallback(
    (field: CampaignNqField, value: string) => {
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
    setMarketingConsent(checked);
    submissionIdRef.current = createUuid();
    setSubmitState((current) =>
      current === "submitting" || current === "success" ? current : "editing",
    );
  }, []);

  const submit = useCallback(
    async (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      if (inFlightRef.current || submitState === "success") return;

      const parsed = campaignNqSchema.safeParse(values);
      if (!parsed.success) {
        const nextErrors: CampaignNqErrors = {};
        for (const issue of parsed.error.issues) {
          const field = issue.path[0] as CampaignNqField | undefined;
          if (field && !nextErrors[field]) {
            nextErrors[field] = issue.message;
          }
        }
        setErrors(nextErrors);
        setSubmitState("editing");
        return;
      }

      inFlightRef.current = true;
      setErrors({});
      setServerMessage(null);
      setSubmitState("submitting");

      const input: SubmitCampaignNqLeadInput = {
        sessionId,
        submissionId: submissionIdRef.current as string,
        ...parsed.data,
        marketingCommunicationsGranted: marketingConsent,
      };

      try {
        const result = await submitCampaignNqLead(input);
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
    [marketingConsent, sessionId, submitState, values],
  );

  return {
    values,
    errors,
    marketingConsent,
    submitState,
    serverMessage,
    updateField,
    updateMarketingConsent,
    submit,
  };
}
