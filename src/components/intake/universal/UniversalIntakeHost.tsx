import { useCallback, useEffect, useRef, useState } from "react";
import { TIMING_OPTIONS } from "@/components/landing/firstQuoteIntakeTypes";
import {
  isValidTruthGatePhone,
  normalizeTruthGatePhoneToE164,
} from "@/lib/validation/truthGateContact";
import { isValidEmail, isValidName } from "@/utils/formatPhone";
import type {
  IntakeFieldName,
  IntakeOpenRequest,
  IntakePersistedSuccessHandler,
  IntakeSkin,
  IntakeStepConfig,
  IntakeSubmitter,
  IntakeValidationError,
  IntakeValues,
  UniversalIntakeConfig,
} from "./intakeTypes";

const SAFE_SUBMIT_ERROR =
  "We couldn't submit your request. Please try again.";

const EMPTY_VALUES: IntakeValues = {
  zip: "",
  projectType: "",
  openings: "",
  name: "",
  email: "",
  phone: "",
};

interface ActiveAttempt {
  request: IntakeOpenRequest;
  captureAttemptId: string;
  stepIndex: number;
  values: IntakeValues;
  succeeded: boolean;
}

interface UniversalIntakeHostProps {
  config: UniversalIntakeConfig;
  openRequest: IntakeOpenRequest | null;
  submitter: IntakeSubmitter;
  skin: IntakeSkin;
  onClose: () => void;
  onPersistedSuccess?: IntakePersistedSuccessHandler;
}

function validateStep(
  step: IntakeStepConfig,
  values: IntakeValues,
): IntakeValidationError | null {
  switch (step.validation) {
    case "florida_zip":
      return /^3[2-4]\d{3}$/.test(values.zip.trim())
        ? null
        : {
            field: "zip",
            message: "Enter a valid 5-digit Florida ZIP code.",
          };
    case "project_scope":
      return values.projectType && values.openings
        ? null
        : {
            message:
              "Choose a project type and approximate number of openings.",
          };
    case "product_scope":
      return values.projectType
        ? null
        : {
            field: "projectType",
            message: "Choose what you are replacing.",
          };
    case "openings_scope":
      return values.openings
        ? null
        : {
            field: "openings",
            message: "Choose the approximate number of openings.",
          };
    case "timing_scope":
      return TIMING_OPTIONS.some((option) => option === values.timing)
        ? null
        : {
            field: "timing",
            message: "Choose when you are hoping to start.",
          };
    case "contact":
      if (!isValidName(values.name)) {
        return { field: "name", message: "Enter your first name." };
      }
      if (!isValidEmail(values.email)) {
        return {
          field: "email",
          message: "Enter a valid email address.",
        };
      }
      if (!values.phone.trim() || !isValidTruthGatePhone(values.phone)) {
        return {
          field: "phone",
          message: "Enter a valid 10-digit mobile number.",
        };
      }
      return null;
  }
}

function normalizedSubmissionValues(values: IntakeValues): IntakeValues | null {
  const phone = normalizeTruthGatePhoneToE164(values.phone);
  if (!phone) return null;
  return {
    ...values,
    zip: values.zip.trim(),
    name: values.name.trim(),
    email: values.email.trim().toLowerCase(),
    phone,
  };
}

export default function UniversalIntakeHost({
  config,
  openRequest,
  submitter,
  skin: Skin,
  onClose,
  onPersistedSuccess,
}: UniversalIntakeHostProps) {
  const landingVisitId = useRef(crypto.randomUUID()).current;
  const processedRequestId = useRef<string | null>(null);
  const activeAttemptId = useRef<string | null>(null);
  const submissionInFlightAttemptId = useRef<string | null>(null);
  const [attempt, setAttempt] = useState<ActiveAttempt | null>(null);
  const [validationError, setValidationError] =
    useState<IntakeValidationError | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!openRequest || processedRequestId.current === openRequest.requestId) {
      return;
    }

    processedRequestId.current = openRequest.requestId;
    const requestedIndex = openRequest.startingStep
      ? config.steps.findIndex((step) => step.id === openRequest.startingStep)
      : 0;
    const captureAttemptId = crypto.randomUUID();

    activeAttemptId.current = captureAttemptId;
    submissionInFlightAttemptId.current = null;
    setValidationError(null);
    setSubmitError(null);
    setIsSubmitting(false);
    setAttempt({
      request: openRequest,
      captureAttemptId,
      stepIndex: requestedIndex >= 0 ? requestedIndex : 0,
      values: {
        ...EMPTY_VALUES,
        zip: openRequest.zipPrefill?.trim() ?? "",
      },
      succeeded: false,
    });
  }, [config.steps, openRequest]);

  const handleFieldChange = useCallback(
    (field: IntakeFieldName, value: string) => {
      setAttempt((current) =>
        !current || current.values[field] === value
          ? current
          : {
              ...current,
              values: { ...current.values, [field]: value },
            },
      );
      setValidationError(null);
      setSubmitError(null);
    },
    [],
  );

  const handleNext = useCallback(() => {
    setAttempt((current) => {
      if (!current) return current;
      const error = validateStep(config.steps[current.stepIndex], current.values);
      if (error) {
        setValidationError(error);
        return current;
      }
      setValidationError(null);
      return {
        ...current,
        stepIndex: Math.min(current.stepIndex + 1, config.steps.length - 1),
      };
    });
  }, [config.steps]);

  const handleBack = useCallback(() => {
    setValidationError(null);
    setSubmitError(null);
    setAttempt((current) =>
      current
        ? { ...current, stepIndex: Math.max(current.stepIndex - 1, 0) }
        : current,
    );
  }, []);

  const handleSubmit = useCallback(async () => {
    if (
      !attempt ||
      attempt.succeeded ||
      isSubmitting ||
      submissionInFlightAttemptId.current === attempt.captureAttemptId
    ) {
      return;
    }

    for (let index = 0; index < config.steps.length; index += 1) {
      const error = validateStep(config.steps[index], attempt.values);
      if (error) {
        setValidationError(error);
        setAttempt((current) =>
          current ? { ...current, stepIndex: index } : current,
        );
        return;
      }
    }

    const values = normalizedSubmissionValues(attempt.values);
    if (!values) {
      setValidationError({
        field: "phone",
        message: "Enter a valid 10-digit mobile number.",
      });
      return;
    }

    setValidationError(null);
    setSubmitError(null);
    const submittedAttemptId = attempt.captureAttemptId;
    submissionInFlightAttemptId.current = submittedAttemptId;
    setIsSubmitting(true);

    try {
      const result = await submitter(values, {
        captureAttemptId: attempt.captureAttemptId,
        landingVisitId,
        entryPoint: attempt.request.entryPoint,
      });

      if (activeAttemptId.current !== submittedAttemptId) return;

      if (
        !result.ok ||
        !result.leadId?.trim() ||
        !result.sessionId?.trim()
      ) {
        setSubmitError(result.ok ? SAFE_SUBMIT_ERROR : result.message);
        return;
      }

      setAttempt((current) =>
        current?.captureAttemptId === submittedAttemptId
          ? { ...current, succeeded: true }
          : current,
      );

      try {
        onPersistedSuccess?.(values);
      } catch {
        // Presentation callbacks cannot invalidate confirmed persistence.
      }
    } catch {
      if (activeAttemptId.current === submittedAttemptId) {
        setSubmitError(SAFE_SUBMIT_ERROR);
      }
    } finally {
      if (activeAttemptId.current === submittedAttemptId) {
        if (submissionInFlightAttemptId.current === submittedAttemptId) {
          submissionInFlightAttemptId.current = null;
        }
        setIsSubmitting(false);
      }
    }
  }, [
    attempt,
    config.steps,
    isSubmitting,
    landingVisitId,
    onPersistedSuccess,
    submitter,
  ]);

  const handleClose = useCallback(() => {
    setAttempt(null);
    setValidationError(null);
    setSubmitError(null);
    activeAttemptId.current = null;
    submissionInFlightAttemptId.current = null;
    setIsSubmitting(false);
    onClose();
  }, [onClose]);

  if (!attempt) return null;

  const step = attempt.succeeded
    ? "success"
    : config.steps[attempt.stepIndex].id;

  return (
    <Skin
      step={step}
      stepNumber={
        attempt.succeeded ? config.steps.length : attempt.stepIndex + 1
      }
      totalSteps={config.steps.length}
      values={attempt.values}
      validationError={validationError}
      submitError={submitError}
      isSubmitting={isSubmitting}
      onFieldChange={handleFieldChange}
      onNext={handleNext}
      onBack={handleBack}
      onSubmit={handleSubmit}
      onClose={handleClose}
    />
  );
}
