// src/pages/AiDemoLanding.tsx
//
// Marketing/demo page: explains how the AI turns a messy quote into
// plain-English risk signals. NO scanner API calls, NO report data —
// static illustrative content only. Name+email capture via
// submitWindowPricesLead, source "ai_demo". Primary CTA -> /quote-check.

import { useCallback, useMemo, useRef, useState } from "react";
import { createUuid } from "@/lib/createUuid";
import {
  PaidSearchLandingFooter,
  PaidSearchLandingHeader,
  PaidSearchLandingShell,
  paidSearchInputClass,
  paidSearchLabelClass,
  paidSearchPrimaryButtonClass,
  paidSearchTrustPillClass,
} from "@/components/paid-search/PaidSearchLandingShell";
import { PaidSearchSection } from "@/components/paid-search/PaidSearchContent";
import { submitWindowPricesLead } from "@/services/windowPricesLeadCapture";
import { ServiceAuthorizationDisclosure } from "@/components/consent/ServiceAuthorizationDisclosure";
import { LeadMagnetSuccessPanel } from "@/components/paid-search/LeadMagnetSuccessPanel";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

type SubmitState = "idle" | "submitting" | "success" | "error";

interface FormErrors {
  firstName?: string;
  email?: string;
}

const STEPS = [
  {
    n: "1",
    title: "Deconstruct the quote",
    body: "The AI reads your estimate — photo or PDF — and separates real line items from vague bundles, so nothing hides inside a lump sum.",
  },
  {
    n: "2",
    title: "Cross-reference scope & benchmarks",
    body: "It checks the scope against South Florida code expectations and pricing benchmarks, flagging where a number or spec looks off for your area.",
  },
  {
    n: "3",
    title: "Expose missing details & questions",
    body: "You get plain-English risk signals and the exact questions to ask — the fine print, the omissions, and the clauses worth reviewing before you sign.",
  },
] as const;

// Static, illustrative before/after — NOT live scanner output.
const DEMO_INPUT = [
  "Windows & doors package ......... $28,400",
  "Installation .................... included",
  "Misc / handling ................. $1,150",
] as const;

const DEMO_OUTPUT = [
  { tone: "cyan", label: "Missing detail", text: "No impact rating / NOA listed per opening." },
  { tone: "amber", label: "Unclear line item", text: "\"Misc / handling\" not itemized." },
  { tone: "amber", label: "Worth checking", text: "Permit & disposal not shown — confirm who pays." },
] as const;

export default function AiDemoLanding() {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [captureResult, setCaptureResult] = useState<{
    leadId: string;
    sessionId: string;
  } | null>(null);

  const sessionIdRef = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-fallback`,
  );
  const submissionIdRef = useRef<string>(createUuid());
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
        submissionId: submissionIdRef.current,
        firstName: firstName.trim(),
        email: email.trim(),
        source: "ai_demo",
        serviceCommunicationsGranted: true,
        marketingConsentPresented: false,
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
            The WindowMan AI · How it works
          </p>
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl">
            Watch a messy quote become
            <span className="block text-[#49A5FF]">plain-English risk signals.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
            No spreadsheets, no jargon. Upload an estimate and the AI turns it
            into a short list of what's missing, what's unclear, and what to ask
            — so you walk into the conversation informed.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="/quote-check" className={`${paidSearchPrimaryButtonClass} px-8 py-3.5 text-lg`}>
              Upload my quote free →
            </a>
            <a href="#demo-cta" className="text-sm font-semibold text-[#49A5FF] underline-offset-4 hover:underline">
              Or send me the demo →
            </a>
          </div>
          <ul className="mt-6 flex flex-wrap justify-center gap-2" aria-label="Trust signals">
            {["Free for homeowners", "Plain English, no jargon", "No spam. Ever."].map((t) => (
              <li key={t} className={paidSearchTrustPillClass}>{t}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── 3 steps ────────────────────────────────────────── */}
      <PaidSearchSection tint eyebrow="How the AI reads your quote" title="Three steps, sixty seconds.">
        <ol className="grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
              <span className="text-sm font-bold text-[#49A5FF]">STEP {s.n}</span>
              <h3 className="mt-2 text-xl font-bold text-white">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/70">{s.body}</p>
            </li>
          ))}
        </ol>
      </PaidSearchSection>

      {/* ── Static before/after demo ───────────────────────── */}
      <PaidSearchSection eyebrow="Before &amp; after" title="From vague quote to clear signals.">
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Input */}
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
            <div className="border-b border-white/10 px-5 py-3 text-sm font-bold text-white">
              What you upload
            </div>
            <div className="space-y-2 px-5 py-4">
              {DEMO_INPUT.map((line) => (
                <p key={line} className="text-sm text-white/60">{line}</p>
              ))}
            </div>
          </div>
          {/* Output */}
          <div className="overflow-hidden rounded-2xl border border-[#49A5FF]/30 bg-[#49A5FF]/[0.05]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
              <span className="text-sm font-bold text-white">What WindowMan surfaces</span>
              <span className="rounded-md border border-[#C8952A]/40 bg-[#C8952A]/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest text-[#C8952A]">
                Example
              </span>
            </div>
            <ul className="divide-y divide-white/10">
              {DEMO_OUTPUT.map((o) => (
                <li key={o.text} className="flex items-center gap-3 px-5 py-4">
                  <span
                    className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      o.tone === "amber"
                        ? "border border-[#C8952A]/40 bg-[#C8952A]/10 text-[#C8952A]"
                        : "border border-[#49A5FF]/40 bg-[#49A5FF]/10 text-[#49A5FF]"
                    }`}
                  >
                    {o.label}
                  </span>
                  <span className="text-sm text-white/80">{o.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-4 text-xs text-white/50">
          Illustrative example using sample data — not a live scan.
        </p>
      </PaidSearchSection>

      {/* ── Capture CTA ────────────────────────────────────── */}
      <PaidSearchSection id="demo-cta" eyebrow="See it on your own quote" title="Send me the demo.">
        <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-[0_8px_40px_rgba(0,0,0,0.45)] backdrop-blur-md sm:p-7">
          {succeeded ? (
            <LeadMagnetSuccessPanel
              variant="ai_demo"
              firstName={firstName}
              email={email}
              leadId={captureResult?.leadId ?? null}
              sessionId={captureResult?.sessionId ?? null}
            />
          ) : (
            <div className="space-y-4">
              <div>
                <label htmlFor="ad-first" className={paidSearchLabelClass}>First name</label>
                <input
                  id="ad-first" type="text" autoComplete="given-name" value={firstName}
                  onChange={(e) => setFirstName(e.target.value)} onKeyDown={onKeyDown}
                  aria-invalid={Boolean(errors.firstName)}
                  aria-describedby={errors.firstName ? "ad-first-err" : undefined}
                  className={paidSearchInputClass} placeholder="Maria"
                />
                {errors.firstName && <p id="ad-first-err" role="alert" className="mt-1.5 text-xs text-red-400">{errors.firstName}</p>}
              </div>
              <div>
                <label htmlFor="ad-email" className={paidSearchLabelClass}>Email</label>
                <input
                  id="ad-email" type="email" autoComplete="email" inputMode="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} onKeyDown={onKeyDown}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "ad-email-err" : undefined}
                  className={paidSearchInputClass} placeholder="maria@example.com"
                />
                {errors.email && <p id="ad-email-err" role="alert" className="mt-1.5 text-xs text-red-400">{errors.email}</p>}
              </div>
              {submitState === "error" && serverMessage && (
                <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {serverMessage}
                </div>
              )}
              <button type="button" onClick={handleSubmit} disabled={submitting} className={`w-full ${paidSearchPrimaryButtonClass}`}>
                {submitting ? "Saving…" : "Send me the demo →"}
              </button>
              <ServiceAuthorizationDisclosure
                buttonLabel="Send me the demo →"
                className="mt-2 text-center text-[11px] leading-relaxed text-white/50"
              />
              <a href="/quote-check" className="block text-center text-xs font-semibold text-[#49A5FF] underline-offset-4 hover:underline">
                Or upload my quote now →
              </a>
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
        building department, or government agency. The demo above uses example
        data for illustration only and is not a live scan. Findings identify
        possible issues and details worth checking; they are informational and
        not legal, financial, or engineering advice. Savings are not guaranteed.
        If you request quotes, WindowMan may refer you to licensed local
        contractors and may receive compensation from those contractors.
      </PaidSearchLandingFooter>
    </PaidSearchLandingShell>
  );
}
