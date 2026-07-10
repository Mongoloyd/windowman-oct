// src/pages/WindowPricesLanding.tsx
//
// Lightweight capture page for the /window-prices route.
// Single job: name + email + phone + ZIP above the fold, one CTA,
// inline success confirmation. No upload handoff — this is the
// top-of-funnel "pricing report" offer for Google/Nextdoor cold traffic.
//
// Source resolution
//   ?v=nextdoor (or utm_source=nextdoor)  -> "nextdoor_truth_report"
//   everything else                       -> "google_window_prices"
//
// Capture path: submitWindowPricesLead() -> capture-truth-gate-lead with
// source override + zip folded into query_params. No schema/Edge changes.

import { useCallback, useMemo, useRef, useState, type FormEvent } from "react";
import { usePhoneInput } from "@/hooks/usePhoneInput";
import {
  PaidSearchLandingFooter,
  PaidSearchLandingHeader,
  PaidSearchLandingShell,
  paidSearchEyebrowClass,
  paidSearchInputClass,
  paidSearchLabelClass,
  paidSearchPrimaryButtonClass,
  paidSearchTrustPillClass,
} from "@/components/paid-search/PaidSearchLandingShell";
import {
  submitWindowPricesLead,
  type WindowPricesSource,
} from "@/services/windowPricesLeadCapture";
import { TcpaPhoneConsentCheckbox } from "@/components/paid-search/TcpaPhoneConsentCheckbox";
import { LeadMagnetSuccessPanel } from "@/components/paid-search/LeadMagnetSuccessPanel";
import MarketSignals from "@/components/marketing/MarketSignals";

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const ZIP_RE = /^\d{5}$/;
const PHONE_MIN_DIGITS = 10;

type SubmitState = "idle" | "submitting" | "success" | "error";

interface FormErrors {
  firstName?: string;
  email?: string;
  phone?: string;
  zip?: string;
  smsConsent?: string;
}

function resolveSource(): WindowPricesSource {
  if (typeof window === "undefined") return "google_window_prices";
  const params = new URLSearchParams(window.location.search);
  const v = (params.get("v") ?? "").toLowerCase();
  const utmSource = (params.get("utm_source") ?? "").toLowerCase();
  return v === "nextdoor" || utmSource === "nextdoor"
    ? "nextdoor_truth_report"
    : "google_window_prices";
}

export default function WindowPricesLanding() {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const { displayValue, rawDigits, e164, handleChange: handlePhoneChange } =
    usePhoneInput();
  const [zip, setZip] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [captureResult, setCaptureResult] = useState<{
    leadId: string;
    sessionId: string;
  } | null>(null);

  // Stable per-visit session id: retries dedupe via the edge reuse path.
  const sessionIdRef = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-fallback`,
  );
  const sourceRef = useRef<WindowPricesSource>(resolveSource());
  const inFlightRef = useRef(false);

  const validate = useCallback((): FormErrors => {
    const next: FormErrors = {};
    if (!firstName.trim() || firstName.trim().length < 2) {
      next.firstName = "Enter your first name.";
    }
    if (!EMAIL_RE.test(email.trim())) {
      next.email = "Enter a valid email address.";
    }
    if (rawDigits.length === 0) {
      next.phone = "Enter your phone number.";
    } else if (rawDigits.length !== PHONE_MIN_DIGITS || !e164) {
      next.phone = "Enter a valid 10-digit phone number.";
    } else if (!smsConsent) {
      next.smsConsent = "Please check the box to receive texts.";
    }
    if (!ZIP_RE.test(zip.trim())) {
      next.zip = "Enter a valid 5-digit ZIP.";
    }
    return next;
  }, [firstName, email, rawDigits, e164, zip, smsConsent]);

  const handleSubmit = useCallback(
    async (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      if (inFlightRef.current || submitState === "success") return;

      const nextErrors = validate();
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) return;
      if (!e164) return;

      inFlightRef.current = true;
      setSubmitState("submitting");
      setServerMessage(null);

      try {
        // Phone layers: display (XXX) XXX-XXXX → raw 10 digits → submit E.164 +1XXXXXXXXXX
        const result = await submitWindowPricesLead({
          sessionId: sessionIdRef.current,
          firstName: firstName.trim(),
          email: email.trim(),
          phone: e164,
          zip: zip.trim(),
          smsConsent,
          source: sourceRef.current,
        });

        if (result.ok) {
          setCaptureResult({
            leadId: result.leadId,
            sessionId: result.sessionId,
          });
          setSubmitState("success");
        } else {
          setSubmitState("error");
          setServerMessage(result.message);
        }
      } catch {
        setSubmitState("error");
        setServerMessage(
          "Something went wrong on our end. Check your connection and try again.",
        );
      } finally {
        inFlightRef.current = false;
        setSubmitState((s) => (s === "submitting" ? "idle" : s));
      }
    },
    [firstName, email, e164, zip, smsConsent, submitState, validate],
  );

  const year = useMemo(() => new Date().getFullYear(), []);
  const submitting = submitState === "submitting";
  const succeeded = submitState === "success";

  return (
    <PaidSearchLandingShell>
      <PaidSearchLandingHeader />

      {/* ── Hero + form, centered above the fold ────────────── */}
      <section className="relative flex items-start justify-center overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(73,165,255,0.12),transparent_60%)]"
        />
        <div className="relative mx-auto w-full max-w-xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
          <div className="text-center">
            <p className={`mb-3 ${paidSearchEyebrowClass}`}>
              Free impact window pricing report
            </p>
            <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl">
              What are impact windows really costing
              <span className="text-[#49A5FF]"> in your ZIP?</span>
            </h1>
            <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-white/80">
              Get the free WindowMan pricing report — what drives quote prices
              in your area, the questions to ask, and how to check any estimate
              before you sign.
            </p>
          </div>

          {/* Form card */}
          <div
            id="window-prices-lead-form"
            className="scroll-mt-24 mt-8 rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-[0_8px_40px_rgba(0,0,0,0.45)] backdrop-blur-md sm:p-7"
          >
            {succeeded ? (
              <LeadMagnetSuccessPanel
                variant="window_prices"
                firstName={firstName}
                email={email}
                leadId={captureResult?.leadId ?? null}
                sessionId={captureResult?.sessionId ?? null}
              />
            ) : (
              <>
                <h2 className="text-2xl font-bold text-white">
                  Send me the pricing report
                </h2>
                <p className="mt-1 text-sm text-white/70">
                  Free. Takes 20 seconds. No sales calls unless you ask.
                </p>

                <form className="mt-5 space-y-4" onSubmit={handleSubmit} noValidate={false}>
                  <div>
                    <label htmlFor="wp-first-name" className={paidSearchLabelClass}>
                      First name
                    </label>
                    <input
                      id="wp-first-name"
                      type="text"
                      autoComplete="given-name"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      aria-invalid={Boolean(errors.firstName)}
                      aria-describedby={errors.firstName ? "wp-first-name-err" : undefined}
                      className={paidSearchInputClass}
                      placeholder="Maria"
                    />
                    {errors.firstName && (
                      <p id="wp-first-name-err" role="alert" className="mt-1.5 text-xs text-red-400">
                        {errors.firstName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="wp-email" className={paidSearchLabelClass}>
                      Email
                    </label>
                    <input
                      id="wp-email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? "wp-email-err" : undefined}
                      className={paidSearchInputClass}
                      placeholder="maria@example.com"
                    />
                    {errors.email && (
                      <p id="wp-email-err" role="alert" className="mt-1.5 text-xs text-red-400">
                        {errors.email}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px]">
                    <div>
                      <label htmlFor="wp-phone" className={paidSearchLabelClass}>
                        Phone
                      </label>
                      <input
                        id="wp-phone"
                        type="tel"
                        autoComplete="tel"
                        inputMode="numeric"
                        required
                        aria-required="true"
                        value={displayValue}
                        onChange={handlePhoneChange}
                        aria-invalid={Boolean(errors.phone)}
                        aria-describedby={errors.phone ? "wp-phone-err" : undefined}
                        className={paidSearchInputClass}
                        placeholder="(954) 555-0123"
                      />
                      {errors.phone && (
                        <p id="wp-phone-err" role="alert" className="mt-1.5 text-xs text-red-400">
                          {errors.phone}
                        </p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="wp-zip" className={paidSearchLabelClass}>
                        ZIP
                      </label>
                      <input
                        id="wp-zip"
                        type="text"
                        autoComplete="postal-code"
                        inputMode="numeric"
                        required
                        maxLength={5}
                        value={zip}
                        onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
                        aria-invalid={Boolean(errors.zip)}
                        aria-describedby={errors.zip ? "wp-zip-err" : undefined}
                        className={paidSearchInputClass}
                        placeholder="33062"
                      />
                      {errors.zip && (
                        <p id="wp-zip-err" role="alert" className="mt-1.5 text-xs text-red-400">
                          {errors.zip}
                        </p>
                      )}
                    </div>
                  </div>

                  <TcpaPhoneConsentCheckbox
                    id="wp-tcpa-sms-consent"
                    checked={smsConsent}
                    onChange={setSmsConsent}
                    error={errors.smsConsent}
                  />

                  {submitState === "error" && serverMessage && (
                    <div
                      role="alert"
                      className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
                    >
                      {serverMessage}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className={`w-full ${paidSearchPrimaryButtonClass}`}
                  >
                    {submitting ? "Saving…" : "Get my free pricing report →"}
                  </button>

                  <p className="text-center text-[11px] leading-relaxed text-white/55">
                    Free for homeowners. Your info is never sold. We contact
                    you only about your report and quotes you ask about.
                  </p>
                </form>
              </>
            )}
          </div>

          {/* Trust pills */}
          <ul
            className="mt-6 flex flex-wrap justify-center gap-2"
            aria-label="Why homeowners trust WindowMan"
          >
            {[
              "Built on public permit records",
              "We work for you, not the contractor",
              "No spam. Ever.",
            ].map((t) => (
              <li key={t} className={paidSearchTrustPillClass}>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <MarketSignals
        targetFormId="window-prices-lead-form"
        ctaText="Get my baseline report ↑"
        ctaMicrocopy="Want your ZIP-level baseline? Use the form above and WindowMan will show you what to question before you compare bids."
      />

      <PaidSearchLandingFooter year={year}>
        WindowMan is an independent quote-intelligence and consumer-advisory
        service — not a contractor, installer, law firm, insurance company,
        building department, or government agency. Report findings are
        informational; savings are not guaranteed. If you request quotes,
        WindowMan may refer you to licensed local contractors and may receive
        compensation from those contractors.
      </PaidSearchLandingFooter>
    </PaidSearchLandingShell>
  );
}
