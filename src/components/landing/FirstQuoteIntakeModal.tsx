import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  IntakeIntentChoice,
  IntakePersistedSuccess,
  IntakePersistedSuccessHandler,
  IntakeValues,
} from "@/components/intake/universal/intakeTypes";
import { isUuid } from "@/lib/routeIdGuards";
import { cn } from "@/lib/utils";
import { formatPhoneDisplay, isValidEmail, toE164, isValidUSPhone } from "@/utils/formatPhone";
import { trackAndHandoffToCanonicalUpload } from "./landingTracking";
import {
  EMPTY_FIRST_QUOTE_INTAKE,
  FIRST_QUOTE_SAFE_ERROR,
  HELP_NEEDED_OPTIONS,
  isValidZipCode,
  normalizeZipCode,
  ZIP_CODE_ERROR,
  HOMEOWNER_ROLE_OPTIONS,
  OPENINGS_BUCKET_OPTIONS,
  PREFERRED_CONTACT_OPTIONS,
  PRODUCT_SCOPE_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  TIMING_OPTIONS,
  type FirstQuoteIntakeFormState,
  type FirstQuoteProjectBasics,
  type HelpNeeded,
  type HomeownerRole,
  type OpeningsBucket,
  type PreferredContact,
  type ProductScope,
  type PropertyType,
  type Timing,
} from "./firstQuoteIntakeTypes";
import {
  getOrCreateFirstQuoteSessionId,
  rotateFirstQuoteSessionId,
  submitWindowmanFirstQuoteLead,
} from "@/services/windowmanFirstQuoteLeadCapture";
import { MarketingConsentCheckbox } from "@/components/consent/MarketingConsentCheckbox";
import { ServiceAuthorizationDisclosure } from "@/components/consent/ServiceAuthorizationDisclosure";
import { createUuid } from "@/lib/createUuid";
import { landingCtaMinH, landingFocusRing } from "./landingTypes";

type FirstQuoteIntakeModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  intent?: IntakeIntentChoice;
  onPersistedSuccess?: IntakePersistedSuccessHandler;
};

type Step = 1 | 2 | 3;
type View = "wizard" | "success";

const FIRST_NAME_RE = /^[A-Za-z][A-Za-z\s'-]{0,48}$/;

function isValidFirstQuoteName(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 2 && trimmed.length <= 50 && FIRST_NAME_RE.test(trimmed);
}

function tileButtonClass(active: boolean): string {
  return cn(
    "rounded-xl border p-3 text-left text-sm font-medium transition-colors",
    landingFocusRing,
    active
      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
      : "border-border bg-card hover:border-primary/40",
  );
}

function OptionTiles<T extends string>({
  legend,
  options,
  value,
  onChange,
  error,
  groupId,
}: {
  legend: string;
  options: readonly T[];
  value: T | "";
  onChange: (next: T) => void;
  error?: string;
  groupId: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-labelledby={groupId}>
        <span id={groupId} className="sr-only">
          {legend}
        </span>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            className={tileButtonClass(value === option)}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

export default function FirstQuoteIntakeModal({
  open,
  onOpenChange,
  intent = "no_quote",
  onPersistedSuccess,
}: FirstQuoteIntakeModalProps) {
  const hasQuote = intent === "has_quote";
  const formId = useId();
  const [step, setStep] = useState<Step>(1);
  const [view, setView] = useState<View>("wizard");
  const [form, setForm] = useState<FirstQuoteIntakeFormState>(EMPTY_FIRST_QUOTE_INTAKE);
  const [step1Errors, setStep1Errors] = useState<Partial<Record<string, string>>>({});
  const [step2Error, setStep2Error] = useState<string | null>(null);
  const [contactErrors, setContactErrors] = useState<Partial<Record<string, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  // One consent-decision transaction per submission attempt. Kept for
  // identical retries; rotated on decision change, on modal reset, and after
  // a completed submission.
  const submissionIdRef = useRef(createUuid());
  const previousIntentRef = useRef<IntakeIntentChoice>(intent);
  const [marketingCommunicationsConsent, setMarketingCommunicationsConsent] =
    useState(false);

  const handleMarketingConsentChange = useCallback((checked: boolean) => {
    setMarketingCommunicationsConsent(checked);
    // Changed consent decision → new consent submission transaction.
    submissionIdRef.current = createUuid();
  }, []);

  const resetModal = useCallback(() => {
    setStep(1);
    setView("wizard");
    setForm(EMPTY_FIRST_QUOTE_INTAKE);
    setStep1Errors({});
    setStep2Error(null);
    setContactErrors({});
    setSubmitError(null);
    setIsSubmitting(false);
    setSessionId(null);
    // A re-opened modal is a new funnel-stage submission.
    submissionIdRef.current = createUuid();
  }, []);

  useEffect(() => {
    if (open) {
      setSessionId(getOrCreateFirstQuoteSessionId());
    } else {
      resetModal();
    }
  }, [open, resetModal]);

  useEffect(() => {
    const previousIntent = previousIntentRef.current;
    previousIntentRef.current = intent;
    if (!open || previousIntent === intent) return;

    // Switching from the completed first-quote path to quote analysis keeps
    // reusable contact/location input but starts a fresh submission attempt.
    setStep(1);
    setView("wizard");
    setStep1Errors({});
    setStep2Error(null);
    setContactErrors({});
    setSubmitError(null);
    submissionIdRef.current = createUuid();
  }, [intent, open]);

  const handleOpenChange = (next: boolean) => {
    if (!next && isSubmitting) return;
    onOpenChange(next);
  };

  const validateStep1 = (): boolean => {
    const errors: Partial<Record<string, string>> = {};
    const { projectBasics } = form;

    if (!isValidZipCode(projectBasics.zipOrCity)) {
      errors.zipOrCity = ZIP_CODE_ERROR;
    }
    if (!hasQuote) {
      if (!projectBasics.propertyType) {
        errors.propertyType = "Select a property type.";
      }
      if (!projectBasics.openingsBucket) {
        errors.openingsBucket = "Select an approximate number of openings.";
      }
      if (!projectBasics.productScope) {
        errors.productScope = "Select what you are planning.";
      }
      if (!projectBasics.timing) {
        errors.timing = "Select when you are trying to start.";
      }
    }

    setStep1Errors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep2 = (): boolean => {
    if (!form.helpNeeded) {
      setStep2Error("Select what you want help with first.");
      return false;
    }
    setStep2Error(null);
    return true;
  };

  const validateContact = (): boolean => {
    const errors: Partial<Record<string, string>> = {};
    const { contact } = form;

    if (!isValidFirstQuoteName(contact.firstName)) {
      errors.firstName = "Enter your first name (2–50 characters).";
    }
    if (!isValidUSPhone(contact.phone)) {
      errors.phone = "Enter a 10-digit US mobile number so we can send your WindowMan plan.";
    }
    if (!isValidEmail(contact.email)) {
      errors.email = "Enter a valid email address.";
    }

    setContactErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleStep1Continue = () => {
    if (validateStep1()) setStep(hasQuote ? 3 : 2);
  };

  const handleStep2Continue = () => {
    if (validateStep2()) setStep(3);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setSubmitError(null);

    if (!validateStep1()) {
      setStep(1);
      return;
    }
    if (!hasQuote && !validateStep2()) {
      setStep(2);
      return;
    }
    if (!validateContact()) return;

    const phoneE164 = toE164(form.contact.phone);
    if (!phoneE164) {
      setContactErrors({
        phone: "Enter a 10-digit US mobile number so we can send your WindowMan plan.",
      });
      return;
    }

    const activeSessionId = sessionId ?? getOrCreateFirstQuoteSessionId();
    const normalizedZip = normalizeZipCode(form.projectBasics.zipOrCity);
    const projectBasics: FirstQuoteProjectBasics = hasQuote
      ? {
          zipOrCity: normalizedZip,
          homeownerRole: "",
          propertyType: "",
          openingsBucket: "",
          productScope: "",
          timing: "",
        }
      : {
          ...form.projectBasics,
          zipOrCity: normalizedZip,
        };
    const helpNeeded: HelpNeeded = hasQuote
      ? "I have a written estimate and want it reviewed."
      : (form.helpNeeded as HelpNeeded);
    setIsSubmitting(true);

    try {
      const result = await submitWindowmanFirstQuoteLead({
        sessionId: activeSessionId,
        submissionId: submissionIdRef.current,
        sourcePath: "/windowman",
        firstName: form.contact.firstName.trim(),
        email: form.contact.email.trim().toLowerCase(),
        phoneE164,
        wmIntent: intent,
        projectBasics,
        helpNeeded,
        preferredContact: form.contact.preferredContact || null,
        serviceCommunicationsGranted: true,
        marketingConsentPresented: true,
        marketingCommunicationsGranted: marketingCommunicationsConsent,
      });

      if (!result.ok) {
        setSubmitError(result.message);
        return;
      }

      if (hasQuote) {
        if (!isUuid(result.leadId) || !isUuid(activeSessionId) || !onPersistedSuccess) {
          setSubmitError(FIRST_QUOTE_SAFE_ERROR);
          return;
        }

        const values: IntakeValues = {
          intent,
          zip: normalizedZip,
          projectType: "",
          openings: "",
          timing: "",
          name: form.contact.firstName.trim(),
          email: form.contact.email.trim().toLowerCase(),
          phone: phoneE164,
        };
        const persisted: IntakePersistedSuccess = {
          ok: true,
          leadId: result.leadId,
          sessionId: activeSessionId,
          reused: result.reused === true,
        };

        try {
          onPersistedSuccess(values, persisted);
        } catch {
          setSubmitError(FIRST_QUOTE_SAFE_ERROR);
          return;
        }

        rotateFirstQuoteSessionId();
      }

      // Completed submission closes this consent transaction.
      submissionIdRef.current = createUuid();
      setView("success");
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepLabel =
    view === "success"
      ? "Complete"
      : hasQuote
        ? step === 1
          ? "Step 1 of 2 — Project location"
          : "Step 2 of 2 — Contact"
        : step === 1
          ? "Step 1 of 3 — Project basics"
          : step === 2
            ? "Step 2 of 3 — Help needed"
            : "Step 3 of 3 — Contact";
  const submitButtonLabel = hasQuote ? "Continue to Upload" : "Build My First-Quote Plan";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[min(90vh,calc(100dvh-2rem))] sm:max-w-lg"
        data-testid="first-quote-intake-modal"
        onInteractOutside={(e) => {
          if (isSubmitting) e.preventDefault();
        }}
      >
        {view === "success" ? (
          <div className="space-y-5 pt-1" role="status" aria-live="polite">
            <div className="flex flex-col items-center text-center">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"
                aria-hidden="true"
              >
                <CheckCircle2 className="h-6 w-6" />
              </span>
              <DialogHeader className="mt-4 space-y-2">
                <DialogTitle className="font-display text-xl font-bold">
                  {hasQuote ? "Your upload is ready." : "Your first-quote plan is started."}
                </DialogTitle>
                <DialogDescription className="text-sm leading-relaxed">
                  {hasQuote
                    ? "Your details are saved. Continue to upload your estimate on this page."
                    : "WindowMan has your project basics. Next, we can help you understand what a strong first estimate should include before you talk to contractors."}
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="flex flex-col gap-3">
              {hasQuote ? (
                <button
                  type="button"
                  className={cn(
                    "btn-depth-primary w-full px-6 py-3 text-sm",
                    landingCtaMinH,
                    landingFocusRing,
                  )}
                  onClick={() => handleOpenChange(false)}
                >
                  Upload My Estimate
                </button>
              ) : (
                <button
                  type="button"
                  className={cn(
                    "btn-depth-primary w-full px-6 py-3 text-sm",
                    landingCtaMinH,
                    landingFocusRing,
                  )}
                  onClick={() => trackAndHandoffToCanonicalUpload("first_quote_modal_has_quote")}
                >
                  Analyze a Quote Instead
                </button>
              )}
              <button
                type="button"
                className={cn(
                  "btn-secondary-tactile w-full px-6 py-3 text-sm",
                  landingCtaMinH,
                  landingFocusRing,
                )}
                onClick={() => handleOpenChange(false)}
              >
                Close
              </button>
            </div>

            {hasQuote ? null : (
              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                If you already receive a contractor estimate, come back and upload it for a Truth
                Report.
              </p>
            )}
          </div>
        ) : (
          <>
            <DialogHeader>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-primary">
                {stepLabel}
              </p>
              <DialogTitle className="font-display text-xl font-bold leading-snug">
                {hasQuote ? "Start your quote analysis" : "Build your first-quote plan"}
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                {hasQuote
                  ? "Tell us where the project is, then add your contact details before uploading the estimate."
                  : "Start with WindowMan before you talk to contractors. We help you understand what a strong impact-window estimate should include, what to ask, and what scope details should be clear from the beginning."}
              </DialogDescription>
            </DialogHeader>

            {step === 1 ? (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor={`${formId}-zip`}>ZIP code</Label>
                  <Input
                    id={`${formId}-zip`}
                    value={form.projectBasics.zipOrCity}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        projectBasics: {
                          ...prev.projectBasics,
                          zipOrCity: e.target.value.replace(/\D/g, "").slice(0, 5),
                        },
                      }))
                    }
                    placeholder="e.g. 33301"
                    inputMode="numeric"
                    maxLength={5}
                    autoComplete="postal-code"
                    aria-invalid={Boolean(step1Errors.zipOrCity)}
                    aria-describedby={step1Errors.zipOrCity ? `${formId}-zip-error` : undefined}
                  />
                  {step1Errors.zipOrCity ? (
                    <p id={`${formId}-zip-error`} className="text-sm text-destructive" role="alert">
                      {step1Errors.zipOrCity}
                    </p>
                  ) : null}
                </div>

                {hasQuote ? null : (
                  <>
                    <OptionTiles<HomeownerRole>
                      legend="Are you the homeowner or decision-maker? (optional)"
                      options={HOMEOWNER_ROLE_OPTIONS}
                      value={form.projectBasics.homeownerRole}
                      onChange={(homeownerRole) =>
                        setForm((prev) => ({
                          ...prev,
                          projectBasics: { ...prev.projectBasics, homeownerRole },
                        }))
                      }
                      groupId={`${formId}-homeowner`}
                    />

                    <OptionTiles<PropertyType>
                      legend="Property type"
                      options={PROPERTY_TYPE_OPTIONS}
                      value={form.projectBasics.propertyType}
                      onChange={(propertyType) =>
                        setForm((prev) => ({
                          ...prev,
                          projectBasics: { ...prev.projectBasics, propertyType },
                        }))
                      }
                      error={step1Errors.propertyType}
                      groupId={`${formId}-property`}
                    />

                    <OptionTiles<OpeningsBucket>
                      legend="Approximate number of openings"
                      options={OPENINGS_BUCKET_OPTIONS}
                      value={form.projectBasics.openingsBucket}
                      onChange={(openingsBucket) =>
                        setForm((prev) => ({
                          ...prev,
                          projectBasics: { ...prev.projectBasics, openingsBucket },
                        }))
                      }
                      error={step1Errors.openingsBucket}
                      groupId={`${formId}-openings`}
                    />

                    <OptionTiles<ProductScope>
                      legend="What are you planning?"
                      options={PRODUCT_SCOPE_OPTIONS}
                      value={form.projectBasics.productScope}
                      onChange={(productScope) =>
                        setForm((prev) => ({
                          ...prev,
                          projectBasics: { ...prev.projectBasics, productScope },
                        }))
                      }
                      error={step1Errors.productScope}
                      groupId={`${formId}-scope`}
                    />

                    <OptionTiles<Timing>
                      legend="When are you trying to start?"
                      options={TIMING_OPTIONS}
                      value={form.projectBasics.timing}
                      onChange={(timing) =>
                        setForm((prev) => ({
                          ...prev,
                          projectBasics: { ...prev.projectBasics, timing },
                        }))
                      }
                      error={step1Errors.timing}
                      groupId={`${formId}-timing`}
                    />
                  </>
                )}

                <button
                  type="button"
                  className={cn("btn-depth-primary w-full px-6 py-3 text-sm", landingCtaMinH, landingFocusRing)}
                  onClick={handleStep1Continue}
                >
                  Continue
                </button>
              </div>
            ) : null}

            {!hasQuote && step === 2 ? (
              <div className="space-y-5">
                <OptionTiles<HelpNeeded>
                  legend="What do you want WindowMan to help you with first?"
                  options={HELP_NEEDED_OPTIONS}
                  value={form.helpNeeded}
                  onChange={(helpNeeded) => {
                    setForm((prev) => ({ ...prev, helpNeeded }));
                    setStep2Error(null);
                  }}
                  error={step2Error ?? undefined}
                  groupId={`${formId}-help`}
                />

                <div className="flex gap-3">
                  <button
                    type="button"
                    className={cn(
                      "btn-secondary-tactile flex-1 px-4 py-3 text-sm",
                      landingCtaMinH,
                      landingFocusRing,
                    )}
                    onClick={() => setStep(1)}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "btn-depth-primary flex-1 px-4 py-3 text-sm",
                      landingCtaMinH,
                      landingFocusRing,
                    )}
                    onClick={handleStep2Continue}
                  >
                    Continue
                  </button>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <form className="space-y-5" onSubmit={handleSubmit} noValidate>
                <div className="space-y-2">
                  <Label htmlFor={`${formId}-first-name`}>First name</Label>
                  <Input
                    id={`${formId}-first-name`}
                    value={form.contact.firstName}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        contact: { ...prev.contact, firstName: e.target.value },
                      }))
                    }
                    autoComplete="given-name"
                    aria-invalid={Boolean(contactErrors.firstName)}
                  />
                  {contactErrors.firstName ? (
                    <p className="text-sm text-destructive" role="alert">
                      {contactErrors.firstName}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${formId}-phone`}>Phone</Label>
                  <Input
                    id={`${formId}-phone`}
                    type="tel"
                    inputMode="tel"
                    value={form.contact.phone}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        contact: {
                          ...prev.contact,
                          phone: formatPhoneDisplay(e.target.value),
                        },
                      }))
                    }
                    autoComplete="tel"
                    placeholder="(555) 555-5555"
                    aria-invalid={Boolean(contactErrors.phone)}
                  />
                  {contactErrors.phone ? (
                    <p className="text-sm text-destructive" role="alert">
                      {contactErrors.phone}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${formId}-email`}>Email</Label>
                  <Input
                    id={`${formId}-email`}
                    type="email"
                    value={form.contact.email}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        contact: { ...prev.contact, email: e.target.value },
                      }))
                    }
                    autoComplete="email"
                    aria-invalid={Boolean(contactErrors.email)}
                  />
                  {contactErrors.email ? (
                    <p className="text-sm text-destructive" role="alert">
                      {contactErrors.email}
                    </p>
                  ) : null}
                </div>

                <OptionTiles<PreferredContact>
                  legend="Preferred contact method (optional)"
                  options={PREFERRED_CONTACT_OPTIONS}
                  value={form.contact.preferredContact}
                  onChange={(preferredContact) =>
                    setForm((prev) => ({
                      ...prev,
                      contact: { ...prev.contact, preferredContact },
                    }))
                  }
                  groupId={`${formId}-preferred`}
                />

                {submitError ? (
                  <p className="text-sm text-destructive" role="alert" aria-live="assertive">
                    {submitError}
                  </p>
                ) : null}

                <p className="text-xs leading-relaxed text-muted-foreground">
                  Private by default. No contractor sees your information unless you ask for help
                  later.
                </p>

                <MarketingConsentCheckbox
                  id={`${formId}-marketing-consent`}
                  checked={marketingCommunicationsConsent}
                  onChange={handleMarketingConsentChange}
                  variant="light"
                />

                <div className="flex gap-3">
                  <button
                    type="button"
                    className={cn(
                      "btn-secondary-tactile flex-1 px-4 py-3 text-sm",
                      landingCtaMinH,
                      landingFocusRing,
                    )}
                    onClick={() => setStep(hasQuote ? 1 : 2)}
                    disabled={isSubmitting}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className={cn(
                      "btn-depth-primary flex-1 px-4 py-3 text-sm",
                      landingCtaMinH,
                      landingFocusRing,
                    )}
                    disabled={isSubmitting}
                    aria-busy={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden="true" />
                        Saving…
                      </>
                    ) : (
                      submitButtonLabel
                    )}
                  </button>
                </div>

                <ServiceAuthorizationDisclosure
                  buttonLabel={submitButtonLabel}
                  className="text-center text-xs leading-relaxed text-muted-foreground"
                />
              </form>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
