import { useCallback, useEffect, useRef, useState } from "react";
import { TIMING_OPTIONS } from "@/components/landing/firstQuoteIntakeTypes";
import {
  isValidTruthGatePhone,
  normalizeTruthGatePhoneToE164,
} from "@/lib/validation/truthGateContact";
import { isValidEmail, isValidName } from "@/utils/formatPhone";
import {
  activeSteps,
  isStepActive,
  quickSelectFieldForStep,
} from "./intakeTypes";
import type {
  IntakeFieldName,
  IntakeLocationConfig,
  IntakeOpenRequest,
  IntakePersistedSuccessHandler,
  IntakeQuickSelectField,
  IntakeSkin,
  IntakeStepConfig,
  IntakeSubmitter,
  IntakeValidationError,
  IntakeValues,
  UniversalIntakeConfig,
} from "./intakeTypes";

const SAFE_SUBMIT_ERROR =
  "We couldn't submit your request. Please try again.";

/**
 * `intent` and `priority` are deliberately absent rather than empty strings.
 * They are optional on `IntakeValues`, and a linear config that never asks for
 * them should hand its submitter exactly the shape it always has — adding empty
 * keys would push meaningless values across every existing persistence
 * boundary. Branching configs populate them via `presetValues` or a field
 * change; validation treats absent and empty identically.
 */
const EMPTY_VALUES: IntakeValues = {
  zip: "",
  projectType: "",
  openings: "",
  name: "",
  email: "",
  phone: "",
};

/**
 * Step navigation is skip-aware so a branching config never lands on, counts,
 * or validates a step that does not apply to the answers given so far. Indices
 * stay anchored to `config.steps` (the full list) rather than to a filtered
 * view, so a value change that reshapes the branch cannot silently remap the
 * visitor to a different step.
 */
function nextActiveIndex(
  steps: readonly IntakeStepConfig[],
  values: IntakeValues,
  from: number,
): number {
  for (let index = from + 1; index < steps.length; index += 1) {
    if (isStepActive(steps[index], values)) return index;
  }
  return from;
}

function previousActiveIndex(
  steps: readonly IntakeStepConfig[],
  values: IntakeValues,
  from: number,
): number {
  for (let index = from - 1; index >= 0; index -= 1) {
    if (isStepActive(steps[index], values)) return index;
  }
  return from;
}

/**
 * Resolve to the nearest applicable step. Going back and changing the branch
 * can make the step a visitor is standing on inactive; prefer moving forward so
 * a corrected answer never reads as losing progress.
 */
function clampToActiveIndex(
  steps: readonly IntakeStepConfig[],
  values: IntakeValues,
  index: number,
): number {
  if (steps[index] && isStepActive(steps[index], values)) return index;
  for (let forward = index + 1; forward < steps.length; forward += 1) {
    if (isStepActive(steps[forward], values)) return forward;
  }
  for (let back = index - 1; back >= 0; back -= 1) {
    if (isStepActive(steps[back], values)) return back;
  }
  return index;
}

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
  location: IntakeLocationConfig,
): IntakeValidationError | null {
  switch (step.validation) {
    case "intent_selected":
      return values.intent === "has_quote" || values.intent === "no_quote"
        ? null
        : {
            field: "intent",
            message: "Choose the option that describes where you are.",
          };
    case "priority_scope":
      return values.priority?.trim()
        ? null
        : {
            field: "priority",
            message: "Choose what matters most to you.",
          };
    case "service_area_zip":
      return location.isEligibleZip(values.zip)
        ? null
        : {
            field: "zip",
            message: location.invalidMessage,
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

    const values: IntakeValues = {
      ...EMPTY_VALUES,
      ...openRequest.presetValues,
      zip: openRequest.zipPrefill?.trim() ?? "",
    };

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
      // Seeded values can make the requested step inactive, so resolve against
      // them rather than trusting the index the caller asked for.
      stepIndex: clampToActiveIndex(
        config.steps,
        values,
        requestedIndex >= 0 ? requestedIndex : 0,
      ),
      values,
      succeeded: false,
    });
  }, [config.steps, openRequest]);

  const handleFieldChange = useCallback(
    (field: IntakeFieldName, value: string) => {
      setAttempt((current) => {
        if (!current || current.values[field] === value) return current;
        const values = { ...current.values, [field]: value };
        return {
          ...current,
          values,
          stepIndex: clampToActiveIndex(
            config.steps,
            values,
            current.stepIndex,
          ),
        };
      });
      setValidationError(null);
      setSubmitError(null);
    },
    [config.steps],
  );

  const handleSelectAndNext = useCallback(
    (field: IntakeQuickSelectField, value: string) => {
      if (isSubmitting || submissionInFlightAttemptId.current) return;

      setAttempt((current) => {
        if (!current || current.succeeded) return current;
        if (activeAttemptId.current !== current.captureAttemptId) return current;

        const currentIndex = clampToActiveIndex(
          config.steps,
          current.values,
          current.stepIndex,
        );
        const step = config.steps[currentIndex];
        if (quickSelectFieldForStep(step.id) !== field) return current;
        if (!step.fields.includes(field)) return current;

        const values = { ...current.values, [field]: value };
        const error = validateStep(step, values, config.location);
        if (error) {
          setValidationError(error);
          return { ...current, values };
        }

        setValidationError(null);
        setSubmitError(null);
        return {
          ...current,
          values,
          // Evaluated against the NEW values so the choice just made — an
          // intent fork in particular — immediately reshapes what comes next.
          stepIndex: nextActiveIndex(config.steps, values, currentIndex),
        };
      });
    },
    [config.location, config.steps, isSubmitting],
  );

  const handleNext = useCallback(() => {
    setAttempt((current) => {
      if (!current) return current;
      const currentIndex = clampToActiveIndex(
        config.steps,
        current.values,
        current.stepIndex,
      );
      const error = validateStep(
        config.steps[currentIndex],
        current.values,
        config.location,
      );
      if (error) {
        setValidationError(error);
        return current;
      }
      setValidationError(null);
      return {
        ...current,
        stepIndex: nextActiveIndex(
          config.steps,
          current.values,
          currentIndex,
        ),
      };
    });
  }, [config.location, config.steps]);

  const handleBack = useCallback(() => {
    setValidationError(null);
    setSubmitError(null);
    setAttempt((current) => {
      if (!current) return current;
      const currentIndex = clampToActiveIndex(
        config.steps,
        current.values,
        current.stepIndex,
      );
      return {
        ...current,
        stepIndex: previousActiveIndex(
          config.steps,
          current.values,
          currentIndex,
        ),
      };
    });
  }, [config.steps]);

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
      // A skipped step was never shown, so it must never block submission.
      if (!isStepActive(config.steps[index], attempt.values)) continue;
      const error = validateStep(config.steps[index], attempt.values, config.location);
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
        onPersistedSuccess?.(values, result);
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
    config,
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

  // Progress reflects the path this visitor is actually walking, so a branch
  // that drops steps reads as "Step 3 of 4", never "Step 3 of 7".
  const walkedSteps = activeSteps(config.steps, attempt.values);
  const currentIndex = clampToActiveIndex(
    config.steps,
    attempt.values,
    attempt.stepIndex,
  );
  const currentStep = config.steps[currentIndex];
  const positionInWalk = walkedSteps.findIndex(
    (walked) => walked.id === currentStep.id,
  );

  const step = attempt.succeeded ? "success" : currentStep.id;

  return (
    <Skin
      step={step}
      stepNumber={
        attempt.succeeded
          ? walkedSteps.length
          : (positionInWalk >= 0 ? positionInWalk : 0) + 1
      }
      totalSteps={walkedSteps.length}
      location={config.location}
      values={attempt.values}
      validationError={validationError}
      submitError={submitError}
      isSubmitting={isSubmitting}
      onFieldChange={handleFieldChange}
      onSelectAndNext={handleSelectAndNext}
      onNext={handleNext}
      onBack={handleBack}
      onSubmit={handleSubmit}
      onClose={handleClose}
    />
  );
}
