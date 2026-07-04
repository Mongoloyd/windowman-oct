// src/pages/TruthReportLanding.tsx
//
// Product explainer for the WindowMan Truth Report. Name+email capture
// (submitWindowPricesLead, source "truth_report_demo") + primary "upload
// my quote" CTA -> /quote-check. Static/demo content ONLY — never renders
// a real full report or raw JSON, never calls scanner/report APIs.

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

type SubmitState = "idle" | "submitting" | "success" | "error";

interface FormErrors {
  firstName?: string;
  email?: string;
}

const PILLARS = [
  { code: "P1", title: "Price", body: "Line items, unit pricing, and totals reviewed for unclear or missing detail." },
  { code: "P2", title: "Fine Print", body: "Contract language worth reviewing before you sign anything." },
  { code: "P3", title: "Install", body: "Scope, permits, and installation specifics your quote may omit." },
  { code: "P4", title: "Safety", body: "HVHZ and impact-rating specifications checked against what's written." },
  { code: "P5", title: "Warranty", body: "What's actually covered, for how long, and by whom." },
] as const;

// Static, illustrative preview rows — NOT a real report, no live data.
const DEMO_SIGNALS = [
  { pill: "Worth checking", tone: "amber", text: "Disposal & permit fees not itemized on the quote." },
  { pill: "Missing detail", tone: "cyan", text: "Impact rating / NOA number not listed for 3 openings." },
  { pill: "Contract language", tone: "amber", text: "Auto-renewing financing clause worth reviewing." },
] as const;

export default function TruthReportLanding() {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
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
    return next;
  }, [firstName, email]);

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
        source: "truth_report_demo",
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
  }, [firstName, email, submitState, validate]);

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

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(73,165,255,0.12),transparent_60%)]"
        />
        <div className="relative mx-auto max-w-3xl px-4 pb-12 pt-14 text-center sm:px-6 sm:pt-20">
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-[#49A5FF]">
            The WindowMan Truth Report
          </p>
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl">
            See what a Truth Report checks
            <span className="block text-[#49A5FF]">before you sign.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
            Upload any impact window or door estimate and WindowMan runs it
            through a five-pillar forensic breakdown — flagging possible pricing
            issues, missing specifications, and contract language worth checking,
            in plain English.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="/quote-check" className={`${paidSearchPrimaryButtonClass} px-8 py-3.5 text-lg`}>
              Upload my quote free →
            </a>
            <a href="#save" className="text-sm font-semibold text-[#49A5FF] underline-offset-4 hover:underline">
              Or save my Truth Report guide →
            </a>
          </div>
          <ul className="mt-6 flex flex-wrap justify-center gap-2" aria-label="Trust signals">
            {["Free for homeowners", "We work for you, not the contractor", "No spam. Ever."].map((t) => (
              <li key={t} className={paidSearchTrustPillClass}>{t}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── 5 pillars ──────────────────────────────────────── */}
      <PaidSearchSection tint eyebrow="The 5-pillar forensic breakdown" title="Five checks. One grade. Zero pressure.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p) => (
            <PaidSearchFeatureCard key={p.code} code={p.code} title={p.title}>
              {p.body}
            </PaidSearchFeatureCard>
          ))}
          <div className="flex flex-col justify-between rounded-xl border border-[#C8952A]/40 bg-[#C8952A]/10 p-5">
            <p className="text-sm leading-relaxed text-white/85">
              Every flag is phrased as a question to ask — not an accusation.
              You stay in control of the conversation.
            </p>
            <a href="/quote-check" className="mt-4 inline-block text-lg font-bold text-[#C8952A] underline-offset-4 hover:underline">
              Grade my quote →
            </a>
          </div>
        </div>
      </PaidSearchSection>

      {/* ── Static demo preview (NOT a real report) ────────── */}
      <PaidSearchSection eyebrow="What the report looks like" title="Preview before verification. Full report after.">
        <p className="max-w-2xl text-white/80">
          Here's an illustrative preview of the risk signals a report surfaces.
          The full graded breakdown unlocks after a quick phone verification —
          this sample uses example data only.
        </p>
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
            <span className="text-sm font-bold text-white">Sample Truth Report · Preview</span>
            <span className="rounded-md border border-[#C8952A]/40 bg-[#C8952A]/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest text-[#C8952A]">
              Example data
            </span>
          </div>
          <ul className="divide-y divide-white/10">
            {DEMO_SIGNALS.map((s) => (
              <li key={s.text} className="flex items-center gap-3 px-5 py-4">
                <span
                  className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    s.tone === "amber"
                      ? "border border-[#C8952A]/40 bg-[#C8952A]/10 text-[#C8952A]"
                      : "border border-[#49A5FF]/40 bg-[#49A5FF]/10 text-[#49A5FF]"
                  }`}
                >
                  {s.pill}
                </span>
                <span className="text-sm text-white/80">{s.text}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-white/10 px-5 py-4">
            <a href="/quote-check" className={`inline-block ${paidSearchPrimaryButtonClass}`}>
              Run this on my quote →
            </a>
          </div>
        </div>
      </PaidSearchSection>

      {/* ── Why scope matters ──────────────────────────────── */}
      <PaidSearchSection tint eyebrow="Why scope beats sticker price" title="A lower number can cost you more.">
        <ul className="grid gap-3 sm:grid-cols-2">
          <PaidSearchCheckItem>A cheaper quote that omits permits or disposal isn't actually cheaper.</PaidSearchCheckItem>
          <PaidSearchCheckItem>Impact ratings and NOA numbers change what a fair price even is.</PaidSearchCheckItem>
          <PaidSearchCheckItem>Warranty terms decide who pays if something fails in year three.</PaidSearchCheckItem>
          <PaidSearchCheckItem>The report lines these up so you compare apples to apples.</PaidSearchCheckItem>
        </ul>
      </PaidSearchSection>

      {/* ── Save-the-guide capture ─────────────────────────── */}
      <PaidSearchSection id="save" eyebrow="No quote yet?" title="Save your Truth Report guide.">
        <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-[0_8px_40px_rgba(0,0,0,0.45)] backdrop-blur-md sm:p-7">
          {succeeded ? (
            <div className="text-center" role="status">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#49A5FF]/40 bg-[#49A5FF]/10">
                <span aria-hidden="true" className="text-2xl text-[#49A5FF]">✓</span>
              </div>
              <h3 className="mt-4 text-2xl font-extrabold text-white">Saved, {firstName.trim() || "neighbor"}.</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/80">
                Your Truth Report guide is on its way to{" "}
                <span className="font-semibold text-[#49A5FF]">{email.trim()}</span>.
                When you get a quote, upload it for a full graded report.
              </p>
              <a href="/quote-check" className={`mt-6 inline-block ${paidSearchPrimaryButtonClass}`}>
                Upload my quote free →
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label htmlFor="tr-first" className={paidSearchLabelClass}>First name</label>
                <input
                  id="tr-first" type="text" autoComplete="given-name" value={firstName}
                  onChange={(e) => setFirstName(e.target.value)} onKeyDown={onKeyDown}
                  aria-invalid={Boolean(errors.firstName)}
                  aria-describedby={errors.firstName ? "tr-first-err" : undefined}
                  className={paidSearchInputClass} placeholder="Maria"
                />
                {errors.firstName && <p id="tr-first-err" role="alert" className="mt-1.5 text-xs text-red-400">{errors.firstName}</p>}
              </div>
              <div>
                <label htmlFor="tr-email" className={paidSearchLabelClass}>Email</label>
                <input
                  id="tr-email" type="email" autoComplete="email" inputMode="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} onKeyDown={onKeyDown}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "tr-email-err" : undefined}
                  className={paidSearchInputClass} placeholder="maria@example.com"
                />
                {errors.email && <p id="tr-email-err" role="alert" className="mt-1.5 text-xs text-red-400">{errors.email}</p>}
              </div>
              {submitState === "error" && serverMessage && (
                <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {serverMessage}
                </div>
              )}
              <button type="button" onClick={handleSubmit} disabled={submitting} className={`w-full ${paidSearchPrimaryButtonClass}`}>
                {submitting ? "Saving…" : "Save my Truth Report →"}
              </button>
              <p className="text-center text-[11px] leading-relaxed text-white/50">
                Free for homeowners. Your info is never sold.
              </p>
            </div>
          )}
        </div>
      </PaidSearchSection>

      <PaidSearchLandingFooter year={year}>
        WindowMan is an independent quote-intelligence and consumer-advisory
        service — not a contractor, installer, law firm, insurance company,
        building department, or government agency. The sample above uses example
        data for illustration only. Report findings identify possible issues and
        details worth checking; they are informational and not legal, financial,
        or engineering advice. Savings are not guaranteed. If you request quotes,
        WindowMan may refer you to licensed local contractors and may receive
        compensation from those contractors.
      </PaidSearchLandingFooter>
    </PaidSearchLandingShell>
  );
}
