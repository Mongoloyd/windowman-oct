import {
  useEffect,
  useRef,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import type {
  IntakeQuickSelectField,
  IntakeSkinProps,
  IntakeViewStep,
} from "@/components/intake/universal/intakeTypes";
import { quickSelectFieldForStep } from "@/components/intake/universal/intakeTypes";
import {
  OPENINGS_BUCKET_OPTIONS,
  PRODUCT_SCOPE_OPTIONS,
  TIMING_OPTIONS,
} from "@/components/landing/firstQuoteIntakeTypes";
import { formatTruthGatePhoneDisplay } from "@/lib/validation/truthGateContact";

const NQ3_PRODUCT_OPTIONS = PRODUCT_SCOPE_OPTIONS.filter(
  (option) => option !== "Not sure yet",
);

const STEP_NAMES: Record<IntakeViewStep, string> = {
  location: "Project location",
  project: "Project details",
  product: "Product",
  openings: "Openings",
  timing: "Timing",
  contact: "Contact details",
  success: "Request received",
};

interface ChoiceStepProps {
  field: IntakeQuickSelectField;
  options: readonly string[];
  groupLabel: string;
  selected: string;
  errorMessage: string;
  onSelect: (field: IntakeQuickSelectField, value: string) => void;
}

function ChoiceOptions({
  field,
  options,
  groupLabel,
  selected,
  errorMessage,
  onSelect,
}: ChoiceStepProps) {
  const groupRef = useRef<HTMLDivElement>(null);

  // Arrows move focus only. Selection stays an explicit activation so keyboard
  // browsing can never trigger an unintended step advance.
  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
    const backward = event.key === "ArrowUp" || event.key === "ArrowLeft";
    if (!forward && !backward) return;

    const items = Array.from(
      groupRef.current?.querySelectorAll<HTMLButtonElement>(
        '[data-intake-field="' + field + '"]',
      ) ?? [],
    );
    if (items.length === 0) return;

    event.preventDefault();
    const currentIndex = items.findIndex(
      (item) => item === document.activeElement,
    );
    const nextIndex =
      currentIndex < 0
        ? 0
        : (currentIndex + (forward ? 1 : -1) + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  return (
    <div
      className="opts"
      role="radiogroup"
      aria-label={groupLabel}
      aria-describedby={errorMessage ? "nq3-modal-error" : undefined}
      ref={groupRef}
      onKeyDown={moveFocus}
    >
      {options.map((option) => {
        const isSelected = selected === option;
        return (
          <button
            className={`opt${isSelected ? " sel" : ""}`}
            type="button"
            role="radio"
            aria-checked={isSelected}
            data-intake-field={field}
            key={option}
            onClick={() => onSelect(field, option)}
          >
            <span className="opt-label">{option}</span>
            <span className="opt-mark" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

export default function Nq3IntakeSkin({
  step,
  stepNumber,
  totalSteps,
  location,
  values,
  validationError,
  submitError,
  isSubmitting,
  onFieldChange,
  onSelectAndNext,
  onNext,
  onBack,
  onSubmit,
  onClose,
}: IntakeSkinProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    // Entry steps keep their text field focused; auto-advanced choice steps and
    // the success panel hand focus to the step heading instead.
    const focusTarget =
      step === "location"
        ? zipRef.current
        : step === "contact"
          ? nameRef.current
          : headingRef.current;
    focusTarget?.focus();
  }, [step]);

  useEffect(() => {
    if (validationError?.field === "zip") zipRef.current?.focus();
    if (validationError?.field === "name") nameRef.current?.focus();
    if (validationError?.field === "email") emailRef.current?.focus();
    if (validationError?.field === "phone") phoneRef.current?.focus();
    if (
      validationError?.field === "projectType" ||
      validationError?.field === "openings" ||
      validationError?.field === "timing"
    ) {
      modalRef.current
        ?.querySelector<HTMLElement>(
          '[data-intake-field="' + validationError.field + '"]',
        )
        ?.focus();
    }
  }, [validationError]);

  useEffect(() => {
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      modalRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const continueToNextStep = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onNext();
  };

  const submitLead = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  const fieldError = validationError?.message ?? "";
  const quickSelectField = quickSelectFieldForStep(step);
  const progressLabel = `Step ${stepNumber} of ${totalSteps}: ${STEP_NAMES[step]}`;

  const errorBlock = fieldError ? (
    <p className="m-err" id="nq3-modal-error" role="alert">
      {fieldError}
    </p>
  ) : null;

  const backButton = (
    <button className="m-back" type="button" onClick={onBack}>
      ← Back
    </button>
  );

  return (
    <div
      className="overlay on"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nq3-modal-title"
        aria-describedby="nq3-modal-description"
        ref={modalRef}
        onKeyDown={handleDialogKeyDown}
      >
        {step !== "success" && (
          <div className="modal-top">
            <div className="prog-group">
              <p className="prog-copy" data-testid="nq3-intake-step-copy">
                {`Step ${stepNumber} of ${totalSteps}`}
              </p>
              <div
                className="prog"
                role="progressbar"
                aria-label={progressLabel}
                aria-valuemin={0}
                aria-valuemax={totalSteps}
                aria-valuenow={stepNumber}
                aria-valuetext={progressLabel}
                aria-busy={isSubmitting}
                data-testid="nq3-intake-progress"
              >
                {Array.from({ length: totalSteps }, (_, index) => index + 1).map(
                  (position) => (
                    <i
                      aria-hidden="true"
                      className={position <= stepNumber ? "on" : ""}
                      key={position}
                    />
                  ),
                )}
              </div>
            </div>
            <button
              aria-label="Close"
              className="m-close"
              type="button"
              onClick={onClose}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        )}

        <div className="modal-body">
          {step === "location" && (
            <form onSubmit={continueToNextStep} noValidate>
              <p className="m-kicker">{`Step ${stepNumber}`}</p>
              <h3 id="nq3-modal-title" ref={headingRef} tabIndex={-1}>
                Where&apos;s the project?
              </h3>
              <p className="m-sub" id="nq3-modal-description">
                {location.helperText}
              </p>
              <div className="field">
                <label htmlFor="nq3-modal-zip">{location.inputLabel}</label>
                <input
                  id="nq3-modal-zip"
                  ref={zipRef}
                  inputMode="numeric"
                  maxLength={5}
                  placeholder={location.placeholder}
                  autoComplete="postal-code"
                  aria-invalid={validationError?.field === "zip"}
                  aria-describedby={fieldError ? "nq3-modal-error" : undefined}
                  value={values.zip}
                  onChange={(event) =>
                    onFieldChange(
                      "zip",
                      event.target.value.replace(/\D/g, "").slice(0, 5),
                    )
                  }
                />
              </div>
              {errorBlock}
              <button className="btn btn-primary" type="submit">
                Continue
              </button>
            </form>
          )}

          {quickSelectField && (
            <div>
              <p className="m-kicker">{`Step ${stepNumber}`}</p>
              <h3 id="nq3-modal-title" ref={headingRef} tabIndex={-1}>
                {step === "product"
                  ? "What are you replacing?"
                  : step === "openings"
                    ? "Roughly how many openings?"
                    : "When are you hoping to start?"}
              </h3>
              <p className="m-sub" id="nq3-modal-description">
                {step === "product"
                  ? "Choose the closest match. Your answer moves you forward automatically."
                  : step === "openings"
                    ? "Count each window or door opening once."
                    : "A rough answer is enough. You can change it later."}
              </p>
              <ChoiceOptions
                field={quickSelectField}
                options={
                  step === "product"
                    ? NQ3_PRODUCT_OPTIONS
                    : step === "openings"
                      ? OPENINGS_BUCKET_OPTIONS
                      : TIMING_OPTIONS
                }
                groupLabel={
                  step === "product"
                    ? "Project type"
                    : step === "openings"
                      ? "Approximate openings"
                      : "Project timing"
                }
                selected={
                  step === "product"
                    ? values.projectType
                    : step === "openings"
                      ? values.openings
                      : values.timing ?? ""
                }
                errorMessage={fieldError}
                onSelect={onSelectAndNext}
              />
              {errorBlock}
              {backButton}
            </div>
          )}

          {step === "contact" && (
            <form onSubmit={submitLead} noValidate aria-busy={isSubmitting}>
              <p className="m-kicker">{`Step ${stepNumber}`}</p>
              <h3 id="nq3-modal-title" ref={headingRef} tabIndex={-1}>
                Where should we send it?
              </h3>
              <p className="m-sub" id="nq3-modal-description">
                We&apos;ll text you the next step for your project in{" "}
                {values.zip || "your area"}.
              </p>
              <div className="field">
                <label htmlFor="nq3-first-name">First name</label>
                <input
                  id="nq3-first-name"
                  ref={nameRef}
                  placeholder="Your first name"
                  autoComplete="given-name"
                  aria-invalid={validationError?.field === "name"}
                  aria-describedby={
                    validationError?.field === "name"
                      ? "nq3-modal-error"
                      : undefined
                  }
                  value={values.name}
                  onChange={(event) => onFieldChange("name", event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="nq3-email">Email address</label>
                <input
                  id="nq3-email"
                  ref={emailRef}
                  type="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  aria-invalid={validationError?.field === "email"}
                  aria-describedby={
                    validationError?.field === "email"
                      ? "nq3-modal-error"
                      : undefined
                  }
                  value={values.email}
                  onChange={(event) => onFieldChange("email", event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="nq3-phone">Mobile number</label>
                <input
                  id="nq3-phone"
                  ref={phoneRef}
                  inputMode="tel"
                  placeholder="(305) 555-0142"
                  autoComplete="tel"
                  aria-invalid={validationError?.field === "phone"}
                  aria-describedby={
                    validationError?.field === "phone"
                      ? "nq3-modal-error"
                      : undefined
                  }
                  value={values.phone}
                  onChange={(event) =>
                    onFieldChange(
                      "phone",
                      formatTruthGatePhoneDisplay(event.target.value),
                    )
                  }
                />
              </div>
              {errorBlock}
              <div
                className="m-submit-error"
                role="alert"
                aria-live="assertive"
                aria-atomic="true"
                data-testid="nq3-intake-submit-error"
              >
                {submitError ? submitError : null}
              </div>
              <div
                className="m-status"
                role="status"
                aria-live="polite"
                aria-atomic="true"
                data-testid="nq3-intake-status"
              >
                {isSubmitting ? "Saving your request." : null}
              </div>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={isSubmitting}
                aria-disabled={isSubmitting}
                data-testid="nq3-intake-submit"
              >
                {isSubmitting ? "Submitting…" : "Get My Comparison"}
              </button>
              {backButton}
              <p className="m-legal">
                By continuing, you request help with your project and authorize
                WindowMan to contact you by call, text message, or email about
                that request and related support. This authorization does not
                include marketing. Message and data rates may apply. Reply STOP
                to opt out of texts. WindowMan is independent software — not an
                installing contractor.
              </p>
            </form>
          )}

          {step === "success" && (
            <div>
              <div className="done-ic">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <h3
                id="nq3-modal-title"
                ref={headingRef}
                tabIndex={-1}
                style={{ textAlign: "center" }}
              >
                You&apos;re in.
              </h3>
              <p
                className="m-sub"
                id="nq3-modal-description"
                style={{ textAlign: "center" }}
              >
                Your request for ZIP {values.zip} was saved. A WindowMan team
                member will text you shortly about the next step toward your
                estimate.
              </p>
              <button className="btn btn-ghost" type="button" onClick={onClose}>
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
