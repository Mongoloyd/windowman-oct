import {
  useEffect,
  useRef,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { cn } from "@/lib/utils";
import {
  quickSelectFieldForStep,
  type IntakeQuickSelectField,
  type IntakeSkinProps,
  type IntakeViewStep,
} from "@/components/intake/universal/intakeTypes";
import { OPENINGS_BUCKET_OPTIONS } from "@/components/landing/firstQuoteIntakeTypes";
import { formatTruthGatePhoneDisplay } from "@/lib/validation/truthGateContact";
import ProphecyIntentCard from "./ProphecyIntentCard";
import { PROPHECY_INTENT_OPTIONS } from "./prophecyIntentOptions";
import { PROPHECY_PRIORITY_OPTIONS } from "./prophecyIntakeConfig";

const STEP_NAMES: Record<IntakeViewStep, string> = {
  intent: "Where you are",
  location: "Project location",
  project: "Project details",
  product: "Product",
  openings: "Openings",
  timing: "Timing",
  priority: "What matters most",
  contact: "Contact details",
  success: "Request received",
};

const FIELD_BASE =
  "w-full rounded-lg border border-white/15 bg-[#0b1626]/80 px-3.5 py-3 text-[15px] text-white " +
  "placeholder:text-slate-500 shadow-[inset_0_2px_5px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.05)] " +
  "focus:border-cyan-300/60 focus:outline-none focus:ring-2 focus:ring-cyan-400/30 " +
  "motion-safe:transition-[border-color,box-shadow] motion-safe:duration-150";

const PRIMARY_BUTTON =
  "inline-flex w-full items-center justify-center rounded-xl px-5 py-3.5 text-[15px] font-semibold text-white " +
  "bg-gradient-to-b from-[#3B82F6] via-[#2563EB] to-[#1E40AF] " +
  "shadow-[0_14px_32px_-10px_rgba(59,130,246,0.7),inset_0_1px_0_rgba(255,255,255,0.32),inset_0_-1px_0_rgba(0,0,0,0.45)] " +
  "hover:from-[#60A5FA] hover:via-[#3B82F6] hover:to-[#1D4ED8] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1628] " +
  "disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none " +
  "motion-safe:transition-all motion-safe:duration-150 active:translate-y-px";

interface ChoiceGroupProps {
  field: IntakeQuickSelectField;
  options: readonly string[];
  groupLabel: string;
  selected: string;
  hasError: boolean;
  onSelect: (field: IntakeQuickSelectField, value: string) => void;
}

function ChoiceGroup({
  field,
  options,
  groupLabel,
  selected,
  hasError,
  onSelect,
}: ChoiceGroupProps) {
  const groupRef = useRef<HTMLDivElement>(null);

  // Arrows move focus only. Selecting stays an explicit activation so keyboard
  // browsing can never trip an unintended step advance.
  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
    const backward = event.key === "ArrowUp" || event.key === "ArrowLeft";
    if (!forward && !backward) return;

    const items = Array.from(
      groupRef.current?.querySelectorAll<HTMLButtonElement>(
        `[data-intake-field="${field}"]`,
      ) ?? [],
    );
    if (items.length === 0) return;

    event.preventDefault();
    const currentIndex = items.findIndex((item) => item === document.activeElement);
    const nextIndex =
      currentIndex < 0
        ? 0
        : (currentIndex + (forward ? 1 : -1) + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={groupLabel}
      aria-describedby={hasError ? "prophecy-modal-error" : undefined}
      ref={groupRef}
      onKeyDown={moveFocus}
      className="grid gap-2.5"
    >
      {options.map((option) => {
        const isSelected = selected === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={isSelected}
            data-intake-field={field}
            onClick={() => onSelect(field, option)}
            className={cn(
              "flex min-h-[3.25rem] w-full items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1628]",
              "motion-safe:transition-[transform,box-shadow,border-color] motion-safe:duration-150",
              "active:translate-y-px",
              isSelected
                ? "border-cyan-300/60 bg-gradient-to-b from-[#16304d] to-[#0d1c2e] shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_0_0_1px_rgba(103,232,249,0.35),0_12px_30px_-16px_rgba(34,211,238,0.5)]"
                : "border-white/12 bg-gradient-to-b from-white/[0.06] to-white/[0.01] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_8px_20px_-14px_rgba(0,0,0,0.8)] motion-safe:hover:-translate-y-0.5 hover:border-white/25",
            )}
          >
            <span
              className={cn(
                "text-[15px] font-semibold",
                isSelected ? "text-white" : "text-slate-200",
              )}
            >
              {option}
            </span>
            <span
              aria-hidden="true"
              className={cn(
                "h-2.5 w-2.5 shrink-0 rounded-full",
                isSelected
                  ? "bg-cyan-300 shadow-[0_0_12px_1px_rgba(103,232,249,0.85)]"
                  : "bg-white/20",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

export default function ProphecyIntakeSkin({
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

  const hasQuote = values.intent === "has_quote";

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
      validationError?.field === "intent" ||
      validationError?.field === "openings" ||
      validationError?.field === "priority"
    ) {
      modalRef.current
        ?.querySelector<HTMLElement>(
          `[data-intake-field="${validationError.field}"]`,
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

  const fieldError = validationError?.message ?? "";
  const quickSelectField = quickSelectFieldForStep(step);
  const progressLabel = `Step ${stepNumber} of ${totalSteps}: ${STEP_NAMES[step]}`;

  const errorBlock = fieldError ? (
    <p
      className="mt-3 rounded-lg border border-red-400/35 bg-red-500/10 px-3 py-2 text-[13px] text-red-200"
      id="prophecy-modal-error"
      role="alert"
    >
      {fieldError}
    </p>
  ) : null;

  const backButton = (
    <button
      type="button"
      onClick={onBack}
      className="mt-3 w-full rounded-lg px-3 py-2 text-[13px] font-medium text-slate-400 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
    >
      ← Back
    </button>
  );

  const kicker = (
    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">
      {`Step ${stepNumber} of ${totalSteps}`}
    </p>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-[#03070e]/85 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="prophecy-modal-title"
        aria-describedby="prophecy-modal-description"
        ref={modalRef}
        onKeyDown={handleDialogKeyDown}
        className={cn(
          "relative my-auto w-full max-w-xl overflow-hidden rounded-t-2xl border border-white/12 sm:rounded-2xl",
          "bg-gradient-to-b from-[#132741] via-[#0d1c2e] to-[#070e18]",
          "shadow-[0_40px_90px_-30px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(0,0,0,0.6)]",
          step === "intent" && "max-w-3xl",
        )}
      >
        {/* Warm key light, upper right. Ambient only — never on a control. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#F4A261]/20 blur-[90px]"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 top-1/3 h-56 w-56 rounded-full bg-[#60A5FA]/16 blur-[90px]"
        />

        {step !== "success" && (
          <div className="relative flex items-center justify-between gap-4 border-b border-white/8 px-5 py-3.5 sm:px-7">
            <div
              role="progressbar"
              aria-label={progressLabel}
              aria-valuemin={0}
              aria-valuemax={totalSteps}
              aria-valuenow={stepNumber}
              aria-valuetext={progressLabel}
              aria-busy={isSubmitting}
              data-testid="prophecy-intake-progress"
              className="flex items-center gap-1.5"
            >
              {Array.from({ length: totalSteps }, (_, index) => index + 1).map(
                (position) => (
                  <i
                    key={position}
                    aria-hidden="true"
                    className={cn(
                      "h-1 w-7 rounded-full",
                      position <= stepNumber
                        ? "bg-cyan-300/85 shadow-[0_0_10px_-1px_rgba(103,232,249,0.8)]"
                        : "bg-white/12",
                    )}
                  />
                ),
              )}
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="-mr-1 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
            >
              <span aria-hidden="true" className="text-lg leading-none">
                ×
              </span>
            </button>
          </div>
        )}

        <div className="relative px-5 py-6 sm:px-7 sm:py-7">
          {step === "intent" && (
            <div>
              {kicker}
              <h3
                id="prophecy-modal-title"
                ref={headingRef}
                tabIndex={-1}
                className="mt-2 text-[22px] font-bold leading-tight text-white sm:text-[26px]"
              >
                Which one is you?
              </h3>
              <p
                id="prophecy-modal-description"
                className="mt-2 text-[14px] leading-relaxed text-slate-400"
              >
                Both paths are free, and both end with someone independent
                reading your numbers. Pick the one that's true today.
              </p>

              <div
                role="group"
                aria-label="Do you already have an estimate?"
                aria-describedby={
                  fieldError ? "prophecy-modal-error" : undefined
                }
                className="mt-5 grid gap-3.5 sm:grid-cols-2"
              >
                {PROPHECY_INTENT_OPTIONS.map((option) => (
                  <ProphecyIntentCard
                    key={option.value}
                    option={option}
                    selected={values.intent === option.value}
                    onSelect={(value) => onSelectAndNext("intent", value)}
                  />
                ))}
              </div>
              {errorBlock}
            </div>
          )}

          {step === "location" && (
            <form
              noValidate
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                onNext();
              }}
            >
              {kicker}
              <h3
                id="prophecy-modal-title"
                ref={headingRef}
                tabIndex={-1}
                className="mt-2 text-[22px] font-bold leading-tight text-white sm:text-[26px]"
              >
                Where's the project?
              </h3>
              <p
                id="prophecy-modal-description"
                className="mt-2 text-[14px] leading-relaxed text-slate-400"
              >
                {location.helperText}
              </p>
              <div className="mt-5">
                <label
                  htmlFor="prophecy-zip"
                  className="mb-1.5 block text-[13px] font-medium text-slate-300"
                >
                  {location.inputLabel}
                </label>
                <input
                  id="prophecy-zip"
                  ref={zipRef}
                  inputMode="numeric"
                  maxLength={5}
                  placeholder={location.placeholder}
                  autoComplete="postal-code"
                  aria-invalid={validationError?.field === "zip"}
                  aria-describedby={
                    fieldError ? "prophecy-modal-error" : undefined
                  }
                  value={values.zip}
                  onChange={(event) =>
                    onFieldChange(
                      "zip",
                      event.target.value.replace(/\D/g, "").slice(0, 5),
                    )
                  }
                  className={FIELD_BASE}
                />
              </div>
              {errorBlock}
              <button type="submit" className={cn(PRIMARY_BUTTON, "mt-5")}>
                Continue
              </button>
              {backButton}
            </form>
          )}

          {quickSelectField &&
            (step === "openings" || step === "priority") && (
              <div>
                {kicker}
                <h3
                  id="prophecy-modal-title"
                  ref={headingRef}
                  tabIndex={-1}
                  className="mt-2 text-[22px] font-bold leading-tight text-white sm:text-[26px]"
                >
                  {step === "openings"
                    ? "Roughly how many openings?"
                    : "What matters most to you?"}
                </h3>
                <p
                  id="prophecy-modal-description"
                  className="mt-2 text-[14px] leading-relaxed text-slate-400"
                >
                  {step === "openings"
                    ? "Count each window or door once. A rough number is fine."
                    : "This tells us what to look hardest at when your estimate arrives."}
                </p>
                <div className="mt-5">
                  <ChoiceGroup
                    field={quickSelectField}
                    options={
                      step === "openings"
                        ? OPENINGS_BUCKET_OPTIONS
                        : PROPHECY_PRIORITY_OPTIONS
                    }
                    groupLabel={
                      step === "openings"
                        ? "Approximate openings"
                        : "Your top priority"
                    }
                    selected={
                      step === "openings"
                        ? values.openings
                        : (values.priority ?? "")
                    }
                    hasError={Boolean(fieldError)}
                    onSelect={onSelectAndNext}
                  />
                </div>
                {errorBlock}
                {backButton}
              </div>
            )}

          {step === "contact" && (
            <form
              noValidate
              aria-busy={isSubmitting}
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                onSubmit();
              }}
            >
              {kicker}
              <h3
                id="prophecy-modal-title"
                ref={headingRef}
                tabIndex={-1}
                className="mt-2 text-[22px] font-bold leading-tight text-white sm:text-[26px]"
              >
                {hasQuote ? "Last step before we read it." : "Where should we send it?"}
              </h3>
              <p
                id="prophecy-modal-description"
                className="mt-2 text-[14px] leading-relaxed text-slate-400"
              >
                {hasQuote
                  ? "We'll text your results the moment the read is done. Then you'll upload the estimate on the next screen."
                  : `We'll text you the next step for your project in ${values.zip || "your area"}.`}
              </p>

              <div className="mt-5 grid gap-3.5">
                <div>
                  <label
                    htmlFor="prophecy-first-name"
                    className="mb-1.5 block text-[13px] font-medium text-slate-300"
                  >
                    First name
                  </label>
                  <input
                    id="prophecy-first-name"
                    ref={nameRef}
                    placeholder="Your first name"
                    autoComplete="given-name"
                    aria-invalid={validationError?.field === "name"}
                    aria-describedby={
                      validationError?.field === "name"
                        ? "prophecy-modal-error"
                        : undefined
                    }
                    value={values.name}
                    onChange={(event) => onFieldChange("name", event.target.value)}
                    className={FIELD_BASE}
                  />
                </div>
                <div>
                  <label
                    htmlFor="prophecy-phone"
                    className="mb-1.5 block text-[13px] font-medium text-slate-300"
                  >
                    Mobile number
                  </label>
                  <input
                    id="prophecy-phone"
                    ref={phoneRef}
                    inputMode="tel"
                    placeholder="(305) 555-0142"
                    autoComplete="tel"
                    aria-invalid={validationError?.field === "phone"}
                    aria-describedby={
                      validationError?.field === "phone"
                        ? "prophecy-modal-error"
                        : undefined
                    }
                    value={values.phone}
                    onChange={(event) =>
                      onFieldChange(
                        "phone",
                        formatTruthGatePhoneDisplay(event.target.value),
                      )
                    }
                    className={FIELD_BASE}
                  />
                </div>
                <div>
                  <label
                    htmlFor="prophecy-email"
                    className="mb-1.5 block text-[13px] font-medium text-slate-300"
                  >
                    Email address
                  </label>
                  <input
                    id="prophecy-email"
                    ref={emailRef}
                    type="email"
                    inputMode="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    aria-invalid={validationError?.field === "email"}
                    aria-describedby={
                      validationError?.field === "email"
                        ? "prophecy-modal-error"
                        : undefined
                    }
                    value={values.email}
                    onChange={(event) => onFieldChange("email", event.target.value)}
                    className={FIELD_BASE}
                  />
                </div>
              </div>

              {errorBlock}

              <div
                role="alert"
                aria-live="assertive"
                aria-atomic="true"
                data-testid="prophecy-intake-submit-error"
                className="mt-3 empty:mt-0 text-[13px] text-red-300"
              >
                {submitError ? submitError : null}
              </div>
              <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                data-testid="prophecy-intake-status"
                className="mt-2 empty:mt-0 text-[13px] text-slate-400"
              >
                {isSubmitting ? "Saving your request." : null}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                aria-disabled={isSubmitting}
                data-testid="prophecy-intake-submit"
                className={cn(PRIMARY_BUTTON, "mt-5")}
              >
                {isSubmitting
                  ? "Submitting…"
                  : hasQuote
                    ? "Continue To Upload"
                    : "Start My Free Check"}
              </button>
              {backButton}

              <p className="mt-4 text-[11.5px] leading-relaxed text-slate-500">
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
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-400/15 text-emerald-300 shadow-[0_0_28px_-6px_rgba(52,211,153,0.7)]">
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
                id="prophecy-modal-title"
                ref={headingRef}
                tabIndex={-1}
                className="mt-4 text-[22px] font-bold leading-tight text-white sm:text-[26px]"
              >
                {hasQuote ? "You're in. Now the estimate." : "You're in."}
              </h3>
              <p
                id="prophecy-modal-description"
                className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-slate-400"
              >
                {hasQuote
                  ? "Close this and the upload box is waiting right below. PDF or a photo of the pages both work."
                  : `Your request for ZIP ${values.zip} was saved. A WindowMan team member will text you shortly about the next step toward your estimate.`}
              </p>
              <button
                type="button"
                onClick={onClose}
                className={cn(PRIMARY_BUTTON, "mt-6")}
              >
                {hasQuote ? "Upload My Estimate" : "Close"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
