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

import { useCallback, useMemo, useRef, useState } from "react";
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

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const ZIP_RE = /^\d{5}$/;
const PHONE_MIN_DIGITS = 10;

type SubmitState = "idle" | "submitting" | "success" | "error";

interface FormErrors {
  firstName?: string;
  email?: string;
  phone?: string;
  zip?: string;
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
  const [phone, setPhone] = useState("");
  const [zip, setZip] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [serverMessage, setServerMessage] = useState<string | null>(null);

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
    const digits = phone.replace(/\D/g, "");
    if (digits.length < PHONE_MIN_DIGITS) {
      next.phone = "Enter a valid 10-digit phone number.";
    }
    if (!ZIP_RE.test(zip.trim())) {
      next.zip = "Enter a valid 5-digit ZIP.";
    }
    return next;
  }, [firstName, email, phone, zip]);

  const handleSubmit = useCallback(async () => {
    if (inFlightRef.current || submitState === "success") return;

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    inFlightRef.current = true;
    setSubmitState("submitting");
    setServerMessage(null);

    try {
      const result = await submitWindowPricesLead({
        sessionId: sessionIdRef.current,
        firstName: firstName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        zip: zip.trim(),
        source: sourceRef.current,
      });

      if (result.ok) {
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
  }, [firstName, email, phone, zip, submitState, validate]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleSubmit();
    },
    [handleSubmit],
  );

  const year = useMemo(() => new Date().getFullYear(), []);
  const submitting = submitState === "submitting";
  const succeeded = submitState === "success";

  return (
    <PaidSearchLandingShell>
      <PaidSearchLandingHeader />

      {/* ── Hero + form, centered above the fold ────────────── */}
      <section className="relative flex flex-1 items-start justify-center overflow-hidden">
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
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-[0_8px_40px_rgba(0,0,0,0.45)] backdrop-blur-md sm:p-7">
            {succeeded ? (
              <div className="text-center" role="status">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#49A5FF]/40 bg-[#49A5FF]/10">
                  <span aria-hidden="true" className="text-2xl text-[#49A5FF]">
                    ✓
                  </span>
                </div>
                <h2 className="mt-4 text-2xl font-bold text-white">
                  You're in, {firstName.trim() || "neighbor"}.
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-white/80">
                  Your pricing report is on its way to{" "}
                  <span className="font-semibold text-[#49A5FF]">
                    {email.trim()}
                  </span>
                  . Got a quote already? Upload it any time for a free graded
                  Truth Report.
                </p>
                <a
                  href="/quote-check"
                  className={`mt-6 inline-block px-8 py-3 ${paidSearchPrimaryButtonClass}`}
                >
                  Grade my quote free →
                </a>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-white">
                  Send me the pricing report
                </h2>
                <p className="mt-1 text-sm text-white/70">
                  Free. Takes 20 seconds. No sales calls unless you ask.
                </p>

                <div className="mt-5 space-y-4">
                  <div>
                    <label htmlFor="wp-first-name" className={paidSearchLabelClass}>
                      First name
                    </label>
                    <input
                      id="wp-first-name"
                      type="text"
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      onKeyDown={onKeyDown}
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
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={onKeyDown}
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
                        inputMode="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        onKeyDown={onKeyDown}
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
                        maxLength={5}
                        value={zip}
                        onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
                        onKeyDown={onKeyDown}
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

                  {submitState === "error" && serverMessage && (
                    <div
                      role="alert"
                      className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
                    >
                      {serverMessage}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className={`w-full ${paidSearchPrimaryButtonClass}`}
                  >
                    {submitting ? "Saving…" : "Get my free pricing report →"}
                  </button>

                  <p className="text-center text-[11px] leading-relaxed text-white/55">
                    Free for homeowners. Your info is never sold. We contact
                    you only about your report and quotes you ask about.
                  </p>
                </div>
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
