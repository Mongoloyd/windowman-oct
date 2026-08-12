import {
  useEffect,
  useRef,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import type { IntakeSkinProps } from "@/components/intake/universal/intakeTypes";
import {
  OPENINGS_BUCKET_OPTIONS,
  PRODUCT_SCOPE_OPTIONS,
  TIMING_OPTIONS,
} from "@/components/landing/firstQuoteIntakeTypes";
import { formatTruthGatePhoneDisplay } from "@/lib/validation/truthGateContact";

export default function Nq4IntakeSkin({
  step,
  stepNumber,
  totalSteps,
  location,
  values,
  validationError,
  submitError,
  isSubmitting,
  onFieldChange,
  onNext,
  onBack,
  onSubmit,
  onClose,
}: IntakeSkinProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
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
    const focusTarget =
      step === "location"
        ? zipRef.current
        : step === "product"
          ? dialogRef.current?.querySelector<HTMLElement>(
              '[data-intake-field="projectType"]',
            )
          : step === "openings"
            ? dialogRef.current?.querySelector<HTMLElement>(
                '[data-intake-field="openings"]',
              )
            : step === "timing"
              ? dialogRef.current?.querySelector<HTMLElement>(
                  '[data-intake-field="timing"]',
                )
              : step === "contact"
                ? nameRef.current
                : dialogRef.current?.querySelector<HTMLElement>("button");
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
      dialogRef.current
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
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
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

  return (
    <div
      className="nq4-intake-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="nq4-intake-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nq4-intake-title"
        aria-describedby="nq4-intake-description"
        ref={dialogRef}
        onKeyDown={handleDialogKeyDown}
      >
        {step !== "success" ? (
          <div className="nq4-intake-top">
            <div className="nq4-intake-progress-group">
              <p className="nq4-intake-progress-copy" aria-hidden="true">
                {"Step " + stepNumber + " of " + totalSteps}
              </p>
              <div
                className="nq4-intake-progress"
                role="progressbar"
                aria-label={"Step " + stepNumber + " of " + totalSteps}
                aria-valuemin={0}
                aria-valuemax={totalSteps}
                aria-valuenow={stepNumber}
                aria-valuetext={
                  "Step " + stepNumber + " of " + totalSteps + ", current step"
                }
                aria-busy={isSubmitting}
                data-testid="nq4-intake-progress"
                style={{
                  gridTemplateColumns: `repeat(${totalSteps}, minmax(0, 1fr))`,
                }}
              >
                {Array.from(
                  { length: totalSteps },
                  (_, index) => index + 1,
                ).map((position) => (
                  <span
                    aria-hidden="true"
                    className={position <= stepNumber ? "is-active" : undefined}
                    key={position}
                  />
                ))}
              </div>
            </div>
            <button
              aria-label="Close intake"
              className="nq4-intake-close"
              type="button"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        ) : null}

        <div className="nq4-intake-body">
          {step === "location" ? (
            <form onSubmit={continueToNextStep} noValidate>
              <p className="nq4-intake-kicker">Step 1</p>
              <h2 id="nq4-intake-title">Where is the project?</h2>
              <p id="nq4-intake-description">{location.helperText}</p>
              <div className="nq4-intake-field">
                <label htmlFor="nq4-intake-zip">{location.inputLabel}</label>
                <input
                  id="nq4-intake-zip"
                  ref={zipRef}
                  inputMode="numeric"
                  maxLength={5}
                  placeholder={location.placeholder}
                  autoComplete="postal-code"
                  aria-invalid={validationError?.field === "zip"}
                  aria-describedby={
                    validationError?.field === "zip"
                      ? "nq4-intake-error"
                      : undefined
                  }
                  value={values.zip}
                  onChange={(event) =>
                    onFieldChange(
                      "zip",
                      event.target.value.replace(/\D/g, "").slice(0, 5),
                    )
                  }
                />
              </div>
              {fieldError ? (
                <p
                  className="nq4-intake-error"
                  id="nq4-intake-error"
                  role="alert"
                >
                  {fieldError}
                </p>
              ) : null}
              <button className="nq4-intake-primary" type="submit">
                Continue
              </button>
            </form>
          ) : null}

          {step === "product" ? (
            <form onSubmit={continueToNextStep} noValidate>
              <p className="nq4-intake-kicker">Step 2</p>
              <h2 id="nq4-intake-title">What are you replacing?</h2>
              <p id="nq4-intake-description">
                Choose the closest match for this project.
              </p>
              <div
                className="nq4-intake-options"
                role="radiogroup"
                aria-label="Product"
                aria-describedby={
                  validationError?.field === "projectType"
                    ? "nq4-intake-error"
                    : undefined
                }
              >
                {PRODUCT_SCOPE_OPTIONS.map((option) => (
                  <button
                    className={
                      values.projectType === option
                        ? "nq4-intake-option is-selected"
                        : "nq4-intake-option"
                    }
                    type="button"
                    role="radio"
                    aria-checked={values.projectType === option}
                    data-intake-field="projectType"
                    key={option}
                    onClick={() => onFieldChange("projectType", option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
              {fieldError ? (
                <p
                  className="nq4-intake-error"
                  id="nq4-intake-error"
                  role="alert"
                >
                  {fieldError}
                </p>
              ) : null}
              <button className="nq4-intake-primary" type="submit">
                Continue
              </button>
              <button
                className="nq4-intake-back"
                type="button"
                onClick={onBack}
              >
                ← Back
              </button>
            </form>
          ) : null}

          {step === "openings" ? (
            <form onSubmit={continueToNextStep} noValidate>
              <p className="nq4-intake-kicker">Step 3</p>
              <h2 id="nq4-intake-title">Roughly how many openings?</h2>
              <p id="nq4-intake-description">
                Count each window or door opening once.
              </p>
              <div
                className="nq4-intake-options"
                role="radiogroup"
                aria-label="Openings"
                aria-describedby={
                  validationError?.field === "openings"
                    ? "nq4-intake-error"
                    : undefined
                }
              >
                {OPENINGS_BUCKET_OPTIONS.map((option) => (
                  <button
                    className={
                      values.openings === option
                        ? "nq4-intake-option is-selected"
                        : "nq4-intake-option"
                    }
                    type="button"
                    role="radio"
                    aria-checked={values.openings === option}
                    data-intake-field="openings"
                    key={option}
                    onClick={() => onFieldChange("openings", option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
              {fieldError ? (
                <p
                  className="nq4-intake-error"
                  id="nq4-intake-error"
                  role="alert"
                >
                  {fieldError}
                </p>
              ) : null}
              <button className="nq4-intake-primary" type="submit">
                Continue
              </button>
              <button
                className="nq4-intake-back"
                type="button"
                onClick={onBack}
              >
                ← Back
              </button>
            </form>
          ) : null}

          {step === "timing" ? (
            <form onSubmit={continueToNextStep} noValidate>
              <p className="nq4-intake-kicker">Step 4</p>
              <h2 id="nq4-intake-title">
                When are you hoping to start?
              </h2>
              <p id="nq4-intake-description">
                A rough answer is enough. You can change it later.
              </p>
              <div
                className="nq4-intake-options"
                role="radiogroup"
                aria-label="Project timing"
                aria-describedby={
                  validationError?.field === "timing"
                    ? "nq4-intake-error"
                    : undefined
                }
              >
                {TIMING_OPTIONS.map((option) => (
                  <button
                    className={
                      values.timing === option
                        ? "nq4-intake-option is-selected"
                        : "nq4-intake-option"
                    }
                    type="button"
                    role="radio"
                    aria-checked={values.timing === option}
                    data-intake-field="timing"
                    key={option}
                    onClick={() => onFieldChange("timing", option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
              {fieldError ? (
                <p
                  className="nq4-intake-error"
                  id="nq4-intake-error"
                  role="alert"
                >
                  {fieldError}
                </p>
              ) : null}
              <button className="nq4-intake-primary" type="submit">
                Continue
              </button>
              <button
                className="nq4-intake-back"
                type="button"
                onClick={onBack}
              >
                ← Back
              </button>
            </form>
          ) : null}

          {step === "contact" ? (
            <form onSubmit={submitLead} noValidate>
              <p className="nq4-intake-kicker">Step 5</p>
              <h2 id="nq4-intake-title">Save your project request</h2>
              <p id="nq4-intake-description">
                Add your details so WindowMan can follow up about this request.
              </p>
              <ul
                className="nq4-intake-trust"
                aria-label="How your contact details are used"
              >
                <li>
                  WindowMan won&rsquo;t share your details with contractors
                  unless you later ask for an introduction.
                </li>
                <li>No contractor list. No marketing consent.</li>
              </ul>
              <div className="nq4-intake-field">
                <label htmlFor="nq4-intake-name">First name</label>
                <input
                  id="nq4-intake-name"
                  ref={nameRef}
                  placeholder="Your first name"
                  autoComplete="given-name"
                  required
                  aria-invalid={validationError?.field === "name"}
                  aria-describedby={
                    validationError?.field === "name"
                      ? "nq4-intake-error"
                      : undefined
                  }
                  value={values.name}
                  onChange={(event) =>
                    onFieldChange("name", event.target.value)
                  }
                />
              </div>
              <div className="nq4-intake-field">
                <label htmlFor="nq4-intake-email">Email address</label>
                <input
                  id="nq4-intake-email"
                  ref={emailRef}
                  type="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  aria-invalid={validationError?.field === "email"}
                  aria-describedby={
                    validationError?.field === "email"
                      ? "nq4-intake-error"
                      : undefined
                  }
                  value={values.email}
                  onChange={(event) =>
                    onFieldChange("email", event.target.value)
                  }
                />
              </div>
              <div className="nq4-intake-field">
                <label htmlFor="nq4-intake-phone">Mobile number</label>
                <input
                  id="nq4-intake-phone"
                  ref={phoneRef}
                  inputMode="tel"
                  placeholder="(305) 555-0142"
                  autoComplete="tel"
                  required
                  aria-invalid={validationError?.field === "phone"}
                  aria-describedby={
                    validationError?.field === "phone"
                      ? "nq4-intake-error"
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
              {fieldError ? (
                <p
                  className="nq4-intake-error"
                  id="nq4-intake-error"
                  role="alert"
                >
                  {fieldError}
                </p>
              ) : null}
              {submitError ? (
                <p className="nq4-intake-error" role="alert">
                  {submitError}
                </p>
              ) : null}
              <button
                className="nq4-intake-primary"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving…" : "Save My Project Request"}
              </button>
              <button
                className="nq4-intake-back"
                type="button"
                onClick={onBack}
                disabled={isSubmitting}
              >
                ← Back
              </button>
              <p className="nq4-intake-legal">
                By continuing, you authorize WindowMan to contact you regarding
                this estimate request via call, email, or text (msg/data rates
                apply, reply STOP to opt out). We do not sell your data to
                contractor lists.
              </p>
            </form>
          ) : null}

          {step === "success" ? (
            <div className="nq4-intake-fallback-success">
              <div className="nq4-intake-check" aria-hidden="true">
                ✓
              </div>
              <h2 id="nq4-intake-title">Project request received</h2>
              <p id="nq4-intake-description">
                Your request was saved for WindowMan follow-up.
              </p>
              <button
                className="nq4-intake-primary"
                type="button"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
