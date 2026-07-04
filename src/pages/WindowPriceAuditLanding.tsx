// src/pages/WindowPriceAuditLanding.tsx
//
// Paid-search lead magnet: "South Florida Window Price Audit" PDF/guide.
// Full capture (name/email/phone/ZIP) -> submitWindowPricesLead, source
// "window_price_audit". Inline success state (no upload redirect). Secondary
// CTA links to /quote-check for homeowners who already hold a quote.
//
// Reuse only: no new backend, no email/SMS, no tracking edits.
// The PDF itself is delivered by existing downstream lead handling — this
// page captures + confirms; it does not send email.

import { useCallback, useMemo, useRef, useState } from "react";
import {
  PaidSearchLandingFooter,
  PaidSearchLandingHeader,
  PaidSearchLandingShell,
  paidSearchInputClass,
  paidSearchLabelClass,
  paidSearchPrimaryButtonClass,
  paidSearchTrustPillClass,
} from "@/components/paid-search/PaidSearchLandingShell";
import {
  PaidSearchCheckItem,
  PaidSearchFeatureCard,
  PaidSearchSection,
} from "@/components/paid-search/PaidSearchContent";
import { submitWindowPricesLead } from "@/services/windowPricesLeadCapture";

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

const HIDDEN_DRIVERS = [
  { code: "01", title: "Scope, not sticker", body: "Two quotes at the same price can cover wildly different work. The audit shows what to line up before comparing." },
  { code: "02", title: "Geography & code", body: "HVHZ zones dictate ratings and cost. A quote priced for one county may be wrong for yours." },
  { code: "03", title: "Omitted line items", body: "Permits, disposal, stucco repair, and finish work often live off the quote — until the change order." },
  { code: "04", title: "Warranty gaps", body: "Labor vs product vs manufacturer coverage rarely match. The audit shows what to confirm in writing." },
] as const;

export default function WindowPriceAuditLanding() {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [zip, setZip] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [serverMessage, setServerMessage] = useState<string | null>(null);

  const sessionIdRef = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-fallback`,
  );
  const inFlightRef = useRef(false);

  const validate = useCallback((): FormErrors => {
    const next: FormErrors = {};
    if (!firstName.trim() || firstName.trim().length < 2) next.firstName = "Enter your first name.";
    if (!EMAIL_RE.test(email.trim())) next.email = "Enter a valid email address.";
    const digits = phone.replace(/\D/g, "");
    if (digits.length < PHONE_MIN_DIGITS) next.phone = "Enter a valid 10-digit phone number.";
    if (!ZIP_RE.test(zip.trim())) next.zip = "Enter a valid 5-digit ZIP.";
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
        source: "window_price_audit",
      });
      if (result.ok) setSubmitState("success");
      else {
        setSubmitState("error");
        setServerMessage(result.message);
      }
    } catch {
      setSubmitState("error");
      setServerMessage("Something went wrong on our end. Check your connection and try again.");
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

      {/* ── Hero + capture ─────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(73,165,255,0.12),transparent_60%)]"
        />
        <div className="relative mx-auto grid max-w-5xl gap-10 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20">
          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-[#49A5FF]">
              South Florida impact windows &amp; doors
            </p>
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Download the South Florida
              <span className="block text-[#49A5FF]">Window Price Audit</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
              Before you sign a five-figure impact window contract, know what
              you're really paying for. The audit breaks down scope vs price,
              South Florida benchmarks, the four hidden cost drivers, and the
              fine-print clauses worth checking before you commit.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2" aria-label="Why homeowners trust WindowMan">
              {["100% free for homeowners", "We work for you, not the contractor", "Built on public permit records", "No spam. Ever."].map((t) => (
                <li key={t} className={paidSearchTrustPillClass}>{t}</li>
              ))}
            </ul>
          </div>

          {/* Capture card */}
          <div className="lg:pt-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-[0_8px_40px_rgba(0,0,0,0.45)] backdrop-blur-md sm:p-7">
              {succeeded ? (
                <div className="text-center" role="status">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#49A5FF]/40 bg-[#49A5FF]/10">
                    <span aria-hidden="true" className="text-2xl text-[#49A5FF]">✓</span>
                  </div>
                  <h2 className="mt-4 text-2xl font-extrabold text-white">
                    You're in, {firstName.trim() || "neighbor"}.
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-white/80">
                    Your Window Price Audit is on its way to{" "}
                    <span className="font-semibold text-[#49A5FF]">{email.trim()}</span>.
                    Already holding a quote? Upload it now for a free graded Truth Report.
                  </p>
                  <a
                    href="/quote-check"
                    className={`mt-6 inline-block ${paidSearchPrimaryButtonClass}`}
                  >
                    Upload my quote free →
                  </a>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-extrabold text-white">Send me the audit</h2>
                  <p className="mt-1 text-sm text-white/60">
                    Free. Takes 20 seconds. No sales calls unless you ask.
                  </p>
                  <div className="mt-5 space-y-4">
                    <div>
                      <label htmlFor="wpa-first" className={paidSearchLabelClass}>First name</label>
                      <input
                        id="wpa-first" type="text" autoComplete="given-name" value={firstName}
                        onChange={(e) => setFirstName(e.target.value)} onKeyDown={onKeyDown}
                        aria-invalid={Boolean(errors.firstName)}
                        aria-describedby={errors.firstName ? "wpa-first-err" : undefined}
                        className={paidSearchInputClass} placeholder="Maria"
                      />
                      {errors.firstName && <p id="wpa-first-err" role="alert" className="mt-1.5 text-xs text-red-400">{errors.firstName}</p>}
                    </div>
                    <div>
                      <label htmlFor="wpa-email" className={paidSearchLabelClass}>Email</label>
                      <input
                        id="wpa-email" type="email" autoComplete="email" inputMode="email" value={email}
                        onChange={(e) => setEmail(e.target.value)} onKeyDown={onKeyDown}
                        aria-invalid={Boolean(errors.email)}
                        aria-describedby={errors.email ? "wpa-email-err" : undefined}
                        className={paidSearchInputClass} placeholder="maria@example.com"
                      />
                      {errors.email && <p id="wpa-email-err" role="alert" className="mt-1.5 text-xs text-red-400">{errors.email}</p>}
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px]">
                      <div>
                        <label htmlFor="wpa-phone" className={paidSearchLabelClass}>Phone</label>
                        <input
                          id="wpa-phone" type="tel" autoComplete="tel" inputMode="tel" value={phone}
                          onChange={(e) => setPhone(e.target.value)} onKeyDown={onKeyDown}
                          aria-invalid={Boolean(errors.phone)}
                          aria-describedby={errors.phone ? "wpa-phone-err" : undefined}
                          className={paidSearchInputClass} placeholder="(954) 555-0123"
                        />
                        {errors.phone && <p id="wpa-phone-err" role="alert" className="mt-1.5 text-xs text-red-400">{errors.phone}</p>}
                      </div>
                      <div>
                        <label htmlFor="wpa-zip" className={paidSearchLabelClass}>ZIP</label>
                        <input
                          id="wpa-zip" type="text" autoComplete="postal-code" inputMode="numeric" maxLength={5} value={zip}
                          onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))} onKeyDown={onKeyDown}
                          aria-invalid={Boolean(errors.zip)}
                          aria-describedby={errors.zip ? "wpa-zip-err" : undefined}
                          className={paidSearchInputClass} placeholder="33062"
                        />
                        {errors.zip && <p id="wpa-zip-err" role="alert" className="mt-1.5 text-xs text-red-400">{errors.zip}</p>}
                      </div>
                    </div>

                    {submitState === "error" && serverMessage && (
                      <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        {serverMessage}
                      </div>
                    )}

                    <button type="button" onClick={handleSubmit} disabled={submitting} className={`w-full ${paidSearchPrimaryButtonClass}`}>
                      {submitting ? "Saving…" : "Send me the audit →"}
                    </button>
                    <a href="/quote-check" className="block text-center text-xs font-semibold text-[#49A5FF] underline-offset-4 hover:underline">
                      Or upload my quote instead →
                    </a>
                    <p className="text-center text-[11px] leading-relaxed text-white/50">
                      Free for homeowners. Your info is never sold.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── What's inside ──────────────────────────────────── */}
      <PaidSearchSection tint eyebrow="What's inside the audit" title="Never compare price without comparing scope.">
        <ul className="grid gap-3 sm:grid-cols-2">
          <PaidSearchCheckItem>South Florida planning benchmarks — what drives quote prices by area</PaidSearchCheckItem>
          <PaidSearchCheckItem>The four hidden cost drivers most homeowners miss</PaidSearchCheckItem>
          <PaidSearchCheckItem>Predatory clauses hiding in plain sight in standard contracts</PaidSearchCheckItem>
          <PaidSearchCheckItem>Why the "manager discount" is usually not a real discount</PaidSearchCheckItem>
          <PaidSearchCheckItem>The 5-pillar forensic breakdown WindowMan runs on every quote</PaidSearchCheckItem>
          <PaidSearchCheckItem>The exact questions to ask before you sign anything</PaidSearchCheckItem>
        </ul>
      </PaidSearchSection>

      {/* ── Hidden cost drivers ────────────────────────────── */}
      <PaidSearchSection eyebrow="Four hidden cost drivers" title="Geography dictates code — and cost.">
        <div className="grid gap-4 sm:grid-cols-2">
          {HIDDEN_DRIVERS.map((d) => (
            <PaidSearchFeatureCard key={d.code} code={d.code} title={d.title}>
              {d.body}
            </PaidSearchFeatureCard>
          ))}
        </div>
      </PaidSearchSection>

      {/* ── Manager discount / info asymmetry ──────────────── */}
      <PaidSearchSection tint eyebrow="The end of information asymmetry" title="The manager discount is not real.">
        <div className="grid gap-6 text-white/80 md:grid-cols-2">
          <p className="leading-relaxed">
            "Let me call my manager" is a script, not a favor. When the anchor
            price is set high on purpose, the discount that follows is worth
            checking against what the work should actually cost in your area.
          </p>
          <p className="leading-relaxed">
            The audit gives you the benchmarks and the questions that flip the
            conversation. You stay in control — and you'll know a fair number
            when you see one.
          </p>
        </div>
      </PaidSearchSection>

      {/* ── Final CTA ──────────────────────────────────────── */}
      <PaidSearchSection>
        <div className="text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Don't sign a window contract
            <span className="block text-[#49A5FF]">you haven't checked.</span>
          </h2>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className={`mt-8 ${paidSearchPrimaryButtonClass} px-10 py-4 text-lg`}
          >
            Send me the audit →
          </button>
        </div>
      </PaidSearchSection>

      <PaidSearchLandingFooter year={year}>
        WindowMan is an independent quote-intelligence and consumer-advisory
        service — not a contractor, installer, law firm, insurance company,
        building department, or government agency. Audit findings identify
        possible issues and details worth checking; they are informational and
        not legal, financial, or engineering advice. Savings are not
        guaranteed. If you request quotes, WindowMan may refer you to licensed
        local contractors and may receive compensation from those contractors.
      </PaidSearchLandingFooter>
    </PaidSearchLandingShell>
  );
}
