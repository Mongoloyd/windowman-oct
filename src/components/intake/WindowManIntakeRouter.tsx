import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { ArrowLeft, Check, HelpCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPhoneDisplay, isValidUSPhone } from "@/utils/formatPhone";
import { ConciergeAvatar } from "./ConciergeAvatar";
import { DiagnosticInterstitial } from "./DiagnosticInterstitial";
import { HelperSheet } from "./HelperSheet";
import { IntakeOptionCard } from "./IntakeOptionCard";
import {
  BUCKET_ACK,
  CALL_INTENT_SUBCOPY,
  CONCIERGE_LEADS,
  CONCIERGE_NAME,
  CONCIERGE_STATUS_BADGES,
  CONCIERGE_TAGLINE,
  CONSENT_LABEL,
  FAST_PASS,
  getIntentLabel,
  getProjectSizeLabel,
  getThreatLabel,
  getTimelineLabel,
  HANDOFF_VARIANTS,
  HELPER_TRIGGER_LABEL,
  INTENT_OPTIONS,
  PROJECT_SIZE_OPTIONS,
  RETURNING,
  STEP_HEADLINES,
  STEP_LABELS,
  THREAT_OPTIONS,
  TIMELINE_OPTIONS,
  WANTS_CALL_HANDOFF,
} from "./intakeCopy";
import {
  canAdvanceFromStep,
  getHumanProgress,
  getNextStep,
  getPreviousStep,
  getProgressPercent,
} from "./intakeFlow";
import {
  clearIntakeProgress,
  markIntakeSeen,
  readIntakeProgress,
  writeIntakeProgress,
  type IntakeProgressHint,
} from "./intakeHelpers";
import { getStepMood } from "./intakeStepMood";
import { useIntakeCapture } from "./useIntakeCapture";
import type {
  CallIntentChoice,
  IntakeBucket,
  IntakeFormState,
  IntakeStep,
  IntakeValidationErrors,
  ProjectSize,
  ThreatConcern,
} from "./intakeTypes";
import { INITIAL_INTAKE_FORM_STATE as initialForm } from "./intakeTypes";

type WindowManIntakeRouterProps = {
  /** When false, the scaffold hides locally without routing. Default true. */
  defaultOpen?: boolean;
  className?: string;
  /**
   * "preview" (default) = pure local visual lab, no backend calls.
   * "live" = submit each step to the hardened progressive capture service.
   */
  mode?: "preview" | "live";
};

const inputClass =
  "w-full rounded-xl border border-slate-500/40 bg-slate-950/50 px-4 py-3.5 text-base text-slate-100 placeholder:text-slate-500 shadow-[inset_0_2px_5px_rgba(0,0,0,0.28),0_1px_0_rgba(255,255,255,0.03)] transition-[border-color,box-shadow] focus-visible:border-cyan-400/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/35 min-h-[3.25rem]";

const inputErrorClass = "border-amber-400/55 ring-2 ring-amber-400/15";

function stripNonDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function isValidZip(zip: string): boolean {
  return /^\d{5}$/.test(stripNonDigits(zip));
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isValidFirstName(name: string): boolean {
  const cleaned = name.trim();
  return cleaned.length >= 2 && cleaned.length <= 100 && !/<[^>]*>/g.test(cleaned);
}

function validateContact(form: IntakeFormState): IntakeValidationErrors {
  const errors: IntakeValidationErrors = {};
  if (!isValidZip(form.contact.zip)) {
    errors.zip = "Enter a valid 5-digit ZIP code.";
  }
  if (!isValidUSPhone(form.contact.phone)) {
    errors.phone = "Enter a valid 10-digit US phone number.";
  }
  if (!form.contact.consent) {
    errors.consent = "Consent is required to continue.";
  }
  return errors;
}

function validateIdentity(form: IntakeFormState): IntakeValidationErrors {
  const errors: IntakeValidationErrors = {};
  if (!isValidFirstName(form.identity.firstName)) {
    errors.firstName = "Enter your first name (at least 2 characters).";
  }
  if (!isValidEmail(form.identity.email)) {
    errors.email = "Enter a valid email address.";
  }
  return errors;
}

function hasErrors(errors: IntakeValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function WindowManIntakeRouter({
  defaultOpen = true,
  className,
  mode = "preview",
}: WindowManIntakeRouterProps) {
  const live = mode === "live";
  const capture = useIntakeCapture();
  const formId = useId();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [step, setStep] = useState<IntakeStep>("intent");
  const [form, setForm] = useState<IntakeFormState>(initialForm);
  const [contactErrors, setContactErrors] = useState<IntakeValidationErrors>({});
  const [identityErrors, setIdentityErrors] = useState<IntakeValidationErrors>({});
  const [contactTouched, setContactTouched] = useState(false);
  const [identityTouched, setIdentityTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Concierge-local presentation state (no backend, no routing)
  const [helperOpen, setHelperOpen] = useState(false);
  const [helperTopic, setHelperTopic] = useState<string | null>(null);
  const [fastPassActive, setFastPassActive] = useState(false);
  const [resumeHint, setResumeHint] = useState<IntakeProgressHint | null>(null);
  const [showResume, setShowResume] = useState(false);

  // Returning-visitor hint (local, non-PII). Read once on mount.
  useEffect(() => {
    const hint = readIntakeProgress();
    if (hint) {
      setResumeHint(hint);
      setShowResume(true);
    }
    markIntakeSeen();
  }, []);

  // Persist a NON-PII resume hint as the user moves through the flow.
  useEffect(() => {
    if (showResume) return;
    writeIntakeProgress({
      step,
      bucket: form.bucket,
      threat: form.threat,
      projectSize: form.projectSize,
      callIntent: form.callIntent,
      wantsCall: form.wantsCall,
      timeline: form.timeline,
      ts: Date.now(),
    });
  }, [
    step,
    form.bucket,
    form.threat,
    form.projectSize,
    form.callIntent,
    form.wantsCall,
    form.timeline,
    showResume,
  ]);

  const progressPercent = getProgressPercent(step);
  const humanProgress = getHumanProgress(step);
  const isFirstStep = step === "intent";
  const showBack = (!isFirstStep && step !== "interstitial") || fastPassActive;

  const contactValid = useMemo(() => !hasErrors(validateContact(form)), [form]);
  const identityValid = useMemo(() => !hasErrors(validateIdentity(form)), [form]);
  const displayContactErrors = useMemo(
    () => (contactTouched ? validateContact(form) : contactErrors),
    [contactTouched, contactErrors, form],
  );
  const displayIdentityErrors = useMemo(
    () => (identityTouched ? validateIdentity(form) : identityErrors),
    [identityTouched, identityErrors, form],
  );

  const openHelper = useCallback((topicId?: string) => {
    setHelperTopic(topicId ?? null);
    setHelperOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleBack = useCallback(() => {
    setSubmitError(null);
    if (fastPassActive) {
      setFastPassActive(false);
      return;
    }
    const prev = getPreviousStep(step);
    if (!prev) {
      handleClose();
      return;
    }
    setStep(prev);
  }, [step, fastPassActive, handleClose]);

  /** Live-mode capture session expired/invalid → send the user back to contact. */
  const applyRestart = useCallback((message: string) => {
    setSubmitError(message);
    setContactTouched(false);
    setIdentityTouched(false);
    setStep("contact");
    setFastPassActive(false);
  }, []);

  const handleAdvance = useCallback(() => {
    // Quote-holder Fast-Pass: intercept the intent → threat transition with a
    // local-only offer. Never navigates, never touches scanner/upload.
    if (step === "intent" && form.bucket === "quote_ready" && !fastPassActive) {
      setFastPassActive(true);
      return;
    }
    const next = getNextStep(step);
    if (next) setStep(next);
  }, [step, form.bucket, fastPassActive]);

  const handleFastPassContinueSetup = useCallback(() => {
    setFastPassActive(false);
    const next = getNextStep("intent");
    if (next) setStep(next);
  }, []);

  const handleFastPassCheckNow = useCallback(() => {
    // Local placeholder only — assembles the file and lands on the handoff
    // screen with the quote_ready next-step CTA. No navigation in this sprint.
    setFastPassActive(false);
    setStep("handoff");
  }, []);

  const handleResume = useCallback(() => {
    setSubmitError(null);
    if (resumeHint) {
      setForm((f) => ({
        ...f,
        bucket: resumeHint.bucket,
        threat: (resumeHint.threat as ThreatConcern | null) ?? null,
        projectSize: (resumeHint.projectSize as ProjectSize | null) ?? null,
        callIntent: resumeHint.callIntent,
        wantsCall: resumeHint.wantsCall,
        timeline: resumeHint.timeline,
      }));
      // Live mode has no server session yet on resume; a non-PII local hint
      // cannot recreate the HMAC token, so restart the capture flow at contact.
      setStep(live && resumeHint.step !== "intent" ? "contact" : resumeHint.step);
    }
    setShowResume(false);
  }, [resumeHint, live]);

  const handleStartFresh = useCallback(() => {
    clearIntakeProgress();
    capture.reset();
    setSubmitError(null);
    setForm(initialForm);
    setStep("intent");
    setFastPassActive(false);
    setShowResume(false);
  }, [capture]);

  const handleContactSubmit = useCallback(async () => {
    setContactTouched(true);
    const errors = validateContact(form);
    setContactErrors(errors);
    if (hasErrors(errors)) return;

    if (!live) {
      handleAdvance();
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    const result = await capture.submitContact(form);
    setIsSubmitting(false);
    if (result.ok) {
      handleAdvance();
      return;
    }
    // Contact is already the current step; a restart just re-shows the message.
    setSubmitError(result.message);
  }, [form, live, capture, handleAdvance]);

  const handleIdentitySubmit = useCallback(async () => {
    setIdentityTouched(true);
    const errors = validateIdentity(form);
    setIdentityErrors(errors);
    if (hasErrors(errors)) return;

    if (!live) {
      handleAdvance();
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    const result = await capture.submitIdentity(form);
    setIsSubmitting(false);
    if (result.ok) {
      handleAdvance();
      return;
    }
    if (result.restart) {
      applyRestart(result.message);
      return;
    }
    setSubmitError(result.message);
  }, [form, live, capture, handleAdvance, applyRestart]);

  /**
   * Primary "Continue" advance for option steps. In live mode, the callIntent
   * and timeline steps trigger backend updates; all other steps advance
   * locally. Preview mode always advances locally.
   */
  const handlePrimaryAdvance = useCallback(async () => {
    if (!live) {
      handleAdvance();
      return;
    }

    if (step === "callIntent") {
      if (form.callIntent) capture.submitCallIntent(form.callIntent);
      handleAdvance();
      return;
    }

    if (step === "timeline") {
      if (!form.timeline) return;
      setIsSubmitting(true);
      setSubmitError(null);
      const result = await capture.submitTimeline(form.timeline);
      setIsSubmitting(false);
      if (result.ok) {
        setStep("handoff");
        return;
      }
      if (result.restart) {
        applyRestart(result.message);
        return;
      }
      setSubmitError(result.message);
      return;
    }

    handleAdvance();
  }, [live, step, form.callIntent, form.timeline, capture, handleAdvance, applyRestart]);

  if (!isOpen) {
    return null;
  }

  const showContinue =
    !fastPassActive &&
    step !== "interstitial" &&
    step !== "contact" &&
    step !== "identity" &&
    step !== "handoff" &&
    canAdvanceFromStep(step, form);

  const handoffBucket = form.bucket ?? "researching";
  const handoffContent = form.wantsCall
    ? WANTS_CALL_HANDOFF
    : HANDOFF_VARIANTS[handoffBucket];

  const mood = getStepMood(step);
  const stepHelper =
    step === "callIntent" ? CALL_INTENT_SUBCOPY : mood.helper;

  // Concierge lead-in: at the threat step, acknowledge the chosen bucket so the
  // experience feels responsive (covers the quote_not_handy reminder framing).
  const conciergeLead =
    step === "threat" && form.bucket
      ? BUCKET_ACK[form.bucket]
      : CONCIERGE_LEADS[step];

  const isQuestionStep =
    step !== "interstitial" && step !== "handoff" && !fastPassActive;

  return (
    <div
      className={cn(
        "relative flex w-full flex-col overflow-hidden rounded-2xl border border-slate-400/25",
        "bg-gradient-to-b from-[#132238] to-[#0a1422]",
        "shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_0_48px_-12px_rgba(34,211,238,0.22),0_28px_56px_-20px_rgba(0,0,0,0.75)]",
        "backdrop-blur-xl",
        "max-sm:min-h-[100dvh] max-sm:rounded-none max-sm:border-x-0",
        className,
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${formId}-title`}
      aria-describedby={`${formId}-subtitle`}
    >
      {/* Top light-catch rim */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
        aria-hidden
      />
      {/* Subtle cyan rim glow */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-cyan-400/10 max-sm:rounded-none"
        aria-hidden
      />

      <div className="relative flex flex-1 flex-col p-5 sm:p-6">
        {/* Concierge identity header */}
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <ConciergeAvatar active={isQuestionStep} className="mt-0.5" />
            <div className="min-w-0">
              <h1
                id={`${formId}-title`}
                className="font-display text-lg font-extrabold tracking-tight text-white sm:text-xl"
              >
                {CONCIERGE_NAME}
              </h1>
              <p id={`${formId}-subtitle`} className="mt-0.5 text-sm text-slate-400">
                {CONCIERGE_TAGLINE}
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Setup assurances">
                {CONCIERGE_STATUS_BADGES.map((badge) => (
                  <li
                    key={badge}
                    className="rounded-full border border-slate-600/45 bg-slate-900/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-300"
                  >
                    {badge}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-500/40 bg-slate-900/70 text-slate-300 transition-colors hover:border-slate-400/60 hover:bg-slate-800/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
            aria-label="Close setup"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Progress */}
        <div className="mb-3">
          <p className="mb-2 text-xs font-semibold text-slate-300">
            {step === "handoff" ? (
              <span className="text-cyan-200">{STEP_LABELS.handoff}</span>
            ) : (
              <>
                <span className="text-slate-400">
                  Step {humanProgress.current} of {humanProgress.total}
                </span>
                <span className="mx-2 text-slate-600" aria-hidden>
                  ·
                </span>
                <span className={cn(mood.accentText)}>
                  {STEP_LABELS[humanProgress.labelKey]}
                </span>
              </>
            )}
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-800/90" aria-hidden>
            <div
              className={cn(
                "h-full rounded-full bg-gradient-to-r transition-[width] duration-500 ease-out motion-reduce:transition-none",
                mood.progressFrom,
                mood.progressVia,
                mood.progressTo,
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Compact answer pills — confirmation trail, not a chat transcript */}
        <AnswerPills form={form} currentStep={step} />

        {/* Returning-visitor banner (local, non-PII) */}
        {showResume && (
          <ResumeBanner onResume={handleResume} onStartFresh={handleStartFresh} />
        )}

        {/* Inner diagnostic panel — lighter than outer shell for depth */}
        <div
          className={cn(
            "flex flex-1 flex-col rounded-xl border border-slate-400/20 bg-[#152536]/90 backdrop-blur-sm",
            mood.panelGlow,
          )}
        >
          <div className="flex flex-1 flex-col p-4 sm:p-5">
            {fastPassActive ? (
              <FastPassCard
                onCheckNow={handleFastPassCheckNow}
                onContinueSetup={handleFastPassContinueSetup}
                onAskHow={() => openHelper("how-it-works")}
              />
            ) : step === "interstitial" ? (
              <DiagnosticInterstitial onComplete={handleAdvance} delayMs={2000} />
            ) : step === "handoff" ? (
              <HandoffScreen
                form={form}
                headline={handoffContent.headline}
                body={handoffContent.body}
                primaryCta={handoffContent.primaryCta}
                bucket={handoffBucket}
                wantsCall={form.wantsCall}
              />
            ) : (
              <div className="flex flex-1 flex-col">
                {/* Single-bubble Concierge message — cross-fades per step */}
                <div
                  key={step}
                  className="mb-4 flex items-start gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300"
                >
                  <ConciergeAvatar className="mt-0.5 h-9 w-9" />
                  <div className="min-w-0 flex-1">
                    <div className="relative rounded-2xl rounded-tl-sm border border-slate-500/30 bg-slate-900/55 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                      {conciergeLead && (
                        <p className={cn("text-[13px] font-medium", mood.accentText)}>
                          {conciergeLead}
                        </p>
                      )}
                      <h2
                        className={cn(
                          "text-base font-bold leading-snug text-white sm:text-lg",
                          conciergeLead && "mt-1",
                        )}
                      >
                        {STEP_HEADLINES[step]}
                      </h2>
                      {stepHelper && (
                        <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
                          {stepHelper}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => openHelper()}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-cyan-300/80 transition-colors hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 rounded"
                    >
                      <HelpCircle className="h-3.5 w-3.5" aria-hidden />
                      {HELPER_TRIGGER_LABEL}
                    </button>
                  </div>
                </div>

                {/* Responses */}
                <div
                  key={`responses-${step}`}
                  className="flex flex-col gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
                >
                  {step === "intent" && (
                    <OptionStep
                      selectedRingClass={mood.accentRing}
                      options={INTENT_OPTIONS.map((o) => ({
                        label: o.label,
                        value: o.bucket,
                        selected: form.bucket === o.bucket,
                        onSelect: () => setForm((f) => ({ ...f, bucket: o.bucket })),
                      }))}
                    />
                  )}

                  {step === "threat" && (
                    <OptionStep
                      selectedRingClass={mood.accentRing}
                      options={THREAT_OPTIONS.map((o) => ({
                        label: o.label,
                        value: o.value,
                        selected: form.threat === o.value,
                        onSelect: () => setForm((f) => ({ ...f, threat: o.value })),
                      }))}
                    />
                  )}

                  {step === "projectSize" && (
                    <OptionStep
                      selectedRingClass={mood.accentRing}
                      options={PROJECT_SIZE_OPTIONS.map((o) => ({
                        label: o.label,
                        value: o.value,
                        selected: form.projectSize === o.value,
                        onSelect: () => setForm((f) => ({ ...f, projectSize: o.value })),
                      }))}
                    />
                  )}

                  {step === "contact" && (
                    <ContactStep
                      form={form}
                      errors={displayContactErrors}
                      touched={contactTouched}
                      onBlur={() => setContactTouched(true)}
                      onZipChange={(zip) =>
                        setForm((f) => ({
                          ...f,
                          contact: { ...f.contact, zip: stripNonDigits(zip).slice(0, 5) },
                        }))
                      }
                      onPhoneChange={(phone) =>
                        setForm((f) => ({
                          ...f,
                          contact: { ...f.contact, phone: formatPhoneDisplay(phone) },
                        }))
                      }
                      onConsentChange={(consent) =>
                        setForm((f) => ({
                          ...f,
                          contact: { ...f.contact, consent },
                        }))
                      }
                    />
                  )}

                  {step === "identity" && (
                    <IdentityStep
                      form={form}
                      errors={displayIdentityErrors}
                      touched={identityTouched}
                      onBlur={() => setIdentityTouched(true)}
                      onFirstNameChange={(firstName) =>
                        setForm((f) => ({
                          ...f,
                          identity: { ...f.identity, firstName },
                        }))
                      }
                      onEmailChange={(email) =>
                        setForm((f) => ({
                          ...f,
                          identity: { ...f.identity, email },
                        }))
                      }
                    />
                  )}

                  {step === "callIntent" && (
                    <OptionStep
                      selectedRingClass={mood.accentRing}
                      options={[
                        {
                          label: "Yes, walk me through it",
                          value: "yes" as CallIntentChoice,
                          selected: form.callIntent === "yes",
                          onSelect: () =>
                            setForm((f) => ({ ...f, callIntent: "yes", wantsCall: true })),
                        },
                        {
                          label: "No, send me the next step",
                          value: "no" as CallIntentChoice,
                          selected: form.callIntent === "no",
                          onSelect: () =>
                            setForm((f) => ({ ...f, callIntent: "no", wantsCall: false })),
                        },
                      ]}
                    />
                  )}

                  {step === "timeline" && (
                    <OptionStep
                      selectedRingClass={mood.accentRing}
                      options={TIMELINE_OPTIONS.map((o) => ({
                        label: o.label,
                        value: o.value,
                        selected: form.timeline === o.value,
                        onSelect: () => setForm((f) => ({ ...f, timeline: o.value })),
                      }))}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Recoverable submit error (live mode) */}
            {submitError && step !== "interstitial" && (
              <p
                role="alert"
                aria-live="assertive"
                className="mt-4 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3.5 py-2.5 text-sm font-medium text-amber-200"
              >
                {submitError}
              </p>
            )}

            {/* Footer actions */}
            {step !== "interstitial" && (
              <footer className="mt-5 flex items-center gap-3 border-t border-slate-600/35 pt-4 max-sm:mt-auto max-sm:pb-[env(safe-area-inset-bottom)]">
                {showBack && (
                  <button
                    type="button"
                    onClick={handleBack}
                    disabled={isSubmitting}
                    className="inline-flex min-h-[2.875rem] items-center gap-1.5 rounded-xl border border-slate-500/45 bg-slate-900/55 px-4 text-sm font-semibold text-slate-300 transition-colors hover:border-slate-400/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                    Back
                  </button>
                )}

                {step === "contact" && !fastPassActive && (
                  <button
                    type="button"
                    onClick={handleContactSubmit}
                    disabled={!contactValid || isSubmitting}
                    className={cn(
                      "inline-flex min-h-[2.875rem] flex-1 items-center justify-center rounded-xl px-5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50",
                      !showBack && "w-full",
                      showBack && "ml-auto",
                      contactValid && !isSubmitting
                        ? "bg-cyan-500 text-slate-950 shadow-[0_4px_18px_-8px_rgba(34,211,238,0.65)] hover:bg-cyan-400"
                        : "cursor-not-allowed bg-slate-700/80 text-slate-500",
                    )}
                  >
                    {isSubmitting ? "Please wait…" : "Continue"}
                  </button>
                )}

                {step === "identity" && !fastPassActive && (
                  <button
                    type="button"
                    onClick={handleIdentitySubmit}
                    disabled={!identityValid || isSubmitting}
                    className={cn(
                      "inline-flex min-h-[2.875rem] flex-1 items-center justify-center rounded-xl px-5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50",
                      !showBack && "w-full",
                      showBack && "ml-auto",
                      identityValid && !isSubmitting
                        ? "bg-cyan-500 text-slate-950 shadow-[0_4px_18px_-8px_rgba(34,211,238,0.65)] hover:bg-cyan-400"
                        : "cursor-not-allowed bg-slate-700/80 text-slate-500",
                    )}
                  >
                    {isSubmitting ? "Please wait…" : "Continue"}
                  </button>
                )}

                {showContinue && (
                  <button
                    type="button"
                    onClick={handlePrimaryAdvance}
                    disabled={isSubmitting}
                    className={cn(
                      "inline-flex min-h-[2.875rem] flex-1 items-center justify-center rounded-xl bg-cyan-500 px-5 text-sm font-bold text-slate-950 shadow-[0_4px_18px_-8px_rgba(34,211,238,0.65)] transition-colors hover:bg-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 disabled:cursor-not-allowed disabled:bg-slate-700/80 disabled:text-slate-500",
                      !showBack ? "w-full" : "ml-auto",
                    )}
                  >
                    {isSubmitting ? "Please wait…" : "Continue"}
                  </button>
                )}

                {step === "handoff" && (
                  <button
                    type="button"
                    onClick={handleClose}
                    className="ml-auto inline-flex min-h-[2.875rem] w-full flex-1 items-center justify-center rounded-xl border border-slate-500/45 bg-slate-800/65 px-5 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-400/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
                  >
                    Close file
                  </button>
                )}
              </footer>
            )}
          </div>
        </div>
      </div>

      <HelperSheet
        open={helperOpen}
        onClose={() => setHelperOpen(false)}
        initialTopicId={helperTopic}
      />
    </div>
  );
}

/* ─── Answer confirmation pills (compact, not a transcript) ─────────────── */

function AnswerPills({
  form,
  currentStep,
}: {
  form: IntakeFormState;
  currentStep: IntakeStep;
}) {
  const pills: Array<{ key: string; label: string }> = [];
  if (form.bucket && currentStep !== "intent") {
    pills.push({ key: "bucket", label: getIntentLabel(form.bucket) });
  }
  if (form.threat && currentStep !== "threat") {
    pills.push({ key: "threat", label: getThreatLabel(form.threat) });
  }
  if (form.projectSize && currentStep !== "projectSize") {
    pills.push({ key: "size", label: getProjectSizeLabel(form.projectSize) });
  }
  if (form.callIntent && currentStep !== "callIntent") {
    pills.push({
      key: "call",
      label: form.callIntent === "yes" ? "Walkthrough" : "Send next step",
    });
  }
  if (form.timeline && currentStep !== "timeline") {
    pills.push({ key: "timeline", label: getTimelineLabel(form.timeline) });
  }

  if (pills.length === 0) return null;

  return (
    <ul className="mb-3 flex flex-wrap gap-1.5" aria-label="Your answers so far">
      {pills.map((pill) => (
        <li
          key={pill.key}
          className="inline-flex items-center gap-1 rounded-full border border-cyan-400/25 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100"
        >
          <Check className="h-3 w-3 text-cyan-300" strokeWidth={3} aria-hidden />
          <span className="max-w-[10rem] truncate">{pill.label}</span>
        </li>
      ))}
    </ul>
  );
}

/* ─── Returning-visitor banner ──────────────────────────────────────────── */

function ResumeBanner({
  onResume,
  onStartFresh,
}: {
  onResume: () => void;
  onStartFresh: () => void;
}) {
  return (
    <div className="mb-3 rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-3.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300/90">
        {RETURNING.eyebrow}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-slate-200">{RETURNING.body}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onResume}
          className="inline-flex min-h-[2.5rem] items-center justify-center rounded-xl bg-cyan-500 px-4 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
        >
          {RETURNING.resumeCta}
        </button>
        <button
          type="button"
          onClick={onStartFresh}
          className="inline-flex min-h-[2.5rem] items-center justify-center rounded-xl border border-slate-500/45 bg-slate-900/55 px-4 text-sm font-semibold text-slate-300 transition-colors hover:border-slate-400/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
        >
          {RETURNING.freshCta}
        </button>
      </div>
    </div>
  );
}

/* ─── Quote-holder Fast-Pass card (local-only placeholder) ──────────────── */

function FastPassCard({
  onCheckNow,
  onContinueSetup,
  onAskHow,
}: {
  onCheckNow: () => void;
  onContinueSetup: () => void;
  onAskHow: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300">
      <div className="flex items-start gap-3">
        <ConciergeAvatar className="mt-0.5 h-9 w-9" />
        <div className="min-w-0 flex-1">
          <div className="rounded-2xl rounded-tl-sm border border-cyan-400/30 bg-gradient-to-b from-cyan-500/12 to-slate-900/40 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300/90">
              {FAST_PASS.eyebrow}
            </p>
            <h2 className="mt-1 text-base font-bold leading-snug text-white sm:text-lg">
              {FAST_PASS.headline}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{FAST_PASS.body}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        <button
          type="button"
          onClick={onCheckNow}
          className="w-full rounded-xl border border-cyan-400/45 bg-gradient-to-b from-cyan-500/20 to-cyan-950/25 px-4 py-4 text-sm font-bold text-cyan-50 shadow-[0_6px_20px_-14px_rgba(34,211,238,0.55)] transition-all hover:from-cyan-500/28 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 active:scale-[0.99]"
        >
          {FAST_PASS.primaryCta}
        </button>
        <button
          type="button"
          onClick={onContinueSetup}
          className="w-full rounded-xl border border-slate-500/40 bg-slate-900/50 px-4 py-3.5 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-400/50 hover:bg-slate-800/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
        >
          {FAST_PASS.secondaryCta}
        </button>
        <button
          type="button"
          onClick={onAskHow}
          className="inline-flex items-center justify-center gap-1 rounded-xl px-4 py-2 text-xs font-semibold text-cyan-300/80 transition-colors hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
        >
          <HelpCircle className="h-3.5 w-3.5" aria-hidden />
          {FAST_PASS.helperCta}
        </button>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">{FAST_PASS.note}</p>
    </div>
  );
}

type OptionStepItem = {
  label: string;
  value: string;
  selected: boolean;
  onSelect: () => void;
};

function OptionStep({
  options,
  selectedRingClass,
}: {
  options: OptionStepItem[];
  selectedRingClass?: string;
}) {
  return (
    <div className="flex flex-col gap-3" role="group">
      {options.map((opt) => (
        <IntakeOptionCard
          key={opt.value}
          label={opt.label}
          selected={opt.selected}
          onSelect={opt.onSelect}
          selectedRingClass={selectedRingClass}
        />
      ))}
    </div>
  );
}

type ContactStepProps = {
  form: IntakeFormState;
  errors: IntakeValidationErrors;
  touched: boolean;
  onBlur: () => void;
  onZipChange: (zip: string) => void;
  onPhoneChange: (phone: string) => void;
  onConsentChange: (consent: boolean) => void;
};

function ContactStep({
  form,
  errors,
  touched,
  onBlur,
  onZipChange,
  onPhoneChange,
  onConsentChange,
}: ContactStepProps) {
  const zipId = useId();
  const phoneId = useId();
  const consentId = useId();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor={zipId} className="mb-1.5 block text-sm font-semibold text-slate-200">
          ZIP code
        </label>
        <input
          id={zipId}
          type="text"
          inputMode="numeric"
          autoComplete="postal-code"
          value={form.contact.zip}
          onChange={(e) => onZipChange(e.target.value)}
          onBlur={onBlur}
          className={cn(inputClass, touched && errors.zip && inputErrorClass)}
          placeholder="33101"
          aria-invalid={touched && !!errors.zip}
          aria-describedby={touched && errors.zip ? `${zipId}-error` : undefined}
        />
        {touched && errors.zip && (
          <p id={`${zipId}-error`} className="mt-1.5 text-sm text-amber-300" role="alert">
            {errors.zip}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={phoneId} className="mb-1.5 block text-sm font-semibold text-slate-200">
          Phone
        </label>
        <input
          id={phoneId}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={form.contact.phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          onBlur={onBlur}
          className={cn(inputClass, touched && errors.phone && inputErrorClass)}
          placeholder="(555) 555-5555"
          aria-invalid={touched && !!errors.phone}
          aria-describedby={touched && errors.phone ? `${phoneId}-error` : undefined}
        />
        {touched && errors.phone && (
          <p id={`${phoneId}-error`} className="mt-1.5 text-sm text-amber-300" role="alert">
            {errors.phone}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-slate-600/35 bg-slate-950/35 p-3.5">
        <label htmlFor={consentId} className="flex cursor-pointer items-start gap-3">
          <input
            id={consentId}
            type="checkbox"
            checked={form.contact.consent}
            onChange={(e) => onConsentChange(e.target.checked)}
            onBlur={onBlur}
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-500 bg-slate-900 text-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-400/50"
            aria-invalid={touched && !!errors.consent}
            aria-describedby={touched && errors.consent ? `${consentId}-error` : undefined}
          />
          <span className="text-sm leading-snug text-slate-300">{CONSENT_LABEL}</span>
        </label>
        {touched && errors.consent && (
          <p id={`${consentId}-error`} className="mt-2 text-sm text-amber-300" role="alert">
            {errors.consent}
          </p>
        )}
      </div>

      <div aria-live="polite" className="sr-only">
        {touched && hasErrors(errors) ? "Please fix the highlighted fields." : ""}
      </div>
    </div>
  );
}

type IdentityStepProps = {
  form: IntakeFormState;
  errors: IntakeValidationErrors;
  touched: boolean;
  onBlur: () => void;
  onFirstNameChange: (name: string) => void;
  onEmailChange: (email: string) => void;
};

function IdentityStep({
  form,
  errors,
  touched,
  onBlur,
  onFirstNameChange,
  onEmailChange,
}: IdentityStepProps) {
  const firstNameId = useId();
  const emailId = useId();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor={firstNameId} className="mb-1.5 block text-sm font-semibold text-slate-200">
          First name
        </label>
        <input
          id={firstNameId}
          type="text"
          autoComplete="given-name"
          value={form.identity.firstName}
          onChange={(e) => onFirstNameChange(e.target.value)}
          onBlur={onBlur}
          className={cn(inputClass, touched && errors.firstName && inputErrorClass)}
          placeholder="Alex"
          aria-invalid={touched && !!errors.firstName}
          aria-describedby={touched && errors.firstName ? `${firstNameId}-error` : undefined}
        />
        {touched && errors.firstName && (
          <p id={`${firstNameId}-error`} className="mt-1.5 text-sm text-amber-300" role="alert">
            {errors.firstName}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={emailId} className="mb-1.5 block text-sm font-semibold text-slate-200">
          Email
        </label>
        <input
          id={emailId}
          type="email"
          autoComplete="email"
          value={form.identity.email}
          onChange={(e) => onEmailChange(e.target.value)}
          onBlur={onBlur}
          className={cn(inputClass, touched && errors.email && inputErrorClass)}
          placeholder="you@example.com"
          aria-invalid={touched && !!errors.email}
          aria-describedby={touched && errors.email ? `${emailId}-error` : undefined}
        />
        {touched && errors.email && (
          <p id={`${emailId}-error`} className="mt-1.5 text-sm text-amber-300" role="alert">
            {errors.email}
          </p>
        )}
      </div>

      <div aria-live="polite" className="sr-only">
        {touched && hasErrors(errors) ? "Please fix the highlighted fields." : ""}
      </div>
    </div>
  );
}

type HandoffScreenProps = {
  form: IntakeFormState;
  headline: string;
  body: string;
  primaryCta: string;
  bucket: IntakeBucket;
  wantsCall: boolean;
};

function HandoffScreen({
  form,
  headline,
  body,
  primaryCta,
  wantsCall,
}: HandoffScreenProps) {
  const summaryItems = [
    { label: "Quote status", value: form.bucket ? getIntentLabel(form.bucket) : "—" },
    { label: "Main concern", value: form.threat ? getThreatLabel(form.threat) : "—" },
    {
      label: "Project size",
      value: form.projectSize ? getProjectSizeLabel(form.projectSize) : "—",
    },
    { label: "Timeline", value: form.timeline ? getTimelineLabel(form.timeline) : "—" },
    {
      label: "Walkthrough",
      value:
        form.callIntent === "yes"
          ? "Yes, walk me through it"
          : form.callIntent === "no"
            ? "Send next step by text/email"
            : "—",
    },
  ];

  return (
    <div className="flex flex-col gap-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <div className="flex items-start gap-3">
        <ConciergeAvatar className="mt-0.5 h-9 w-9" />
        <div
          className={cn(
            "min-w-0 flex-1 rounded-2xl rounded-tl-sm border bg-gradient-to-b p-4 sm:p-5",
            "border-cyan-400/25 from-cyan-500/14 to-teal-950/20",
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
          )}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300/90">
            Next move · Protection file assembled
          </p>
          <h2 className="mt-2 text-lg font-bold leading-snug text-white sm:text-xl">{headline}</h2>
          <p className="mt-2.5 text-sm leading-relaxed text-slate-300">{body}</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-400/25 bg-[#0f1a28]/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
          Your setup summary
        </p>
        <dl className="mt-3 divide-y divide-slate-700/40">
          {summaryItems.map((item) => (
            <div
              key={item.label}
              className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
            >
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {item.label}
              </dt>
              <dd className="text-sm font-medium text-slate-100">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          className="w-full rounded-xl border border-cyan-400/45 bg-gradient-to-b from-cyan-500/18 to-cyan-950/25 px-4 py-4 text-left text-sm font-bold text-cyan-50 shadow-[0_6px_20px_-14px_rgba(34,211,238,0.55)] transition-all hover:from-cyan-500/26 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 active:scale-[0.99]"
          onClick={() => {
            /* TODO Sprint D: wire primary handoff CTA to captureArbitrageLead + upload/reminder flow */
          }}
        >
          {primaryCta}
        </button>

        {!wantsCall && (
          <button
            type="button"
            className="w-full rounded-xl border border-slate-500/40 bg-slate-900/50 px-4 py-3.5 text-sm font-semibold text-slate-300 transition-colors hover:border-slate-400/50 hover:bg-slate-800/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
            onClick={() => {
              /* TODO Sprint D: secondary channel handoff (text/email reminder) */
            }}
          >
            Send my next step by text or email
          </button>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-slate-500">
        Visual lab only — buttons are placeholders with no navigation or backend action yet.
      </p>
    </div>
  );
}
