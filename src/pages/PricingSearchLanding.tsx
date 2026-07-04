// src/pages/PricingSearchLanding.tsx
//
// Google Search landing page — high-intent pricing queries.
// Message match: "impact window cost", "window quote too high",
// "hurricane window prices [county]".
//
// Capture path (Sprint: dual-landing-page infra)
//   submitTruthGateLead() -> capture-truth-gate-lead (attribution merged
//   server-side, gclid/utm captured by the existing service).
//
// Handoff path
//   On success we write { sessionId, leadId } into ScanFunnel state (which
//   persists to wm_funnel_* localStorage) and navigate to
//   /?post_capture=upload&source=quote-check. Index.tsx rehydrates the
//   trusted contact identity and mounts UploadZone behind the existing
//   hasTrustedContactIdentity guard. This page never touches upload/scan
//   backends directly.

import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { submitTruthGateLead } from "@/services/truthGateLeadCapture";
import { useScanFunnelSafe } from "@/state/scanFunnel";

const POST_CAPTURE_URL = "/?post_capture=upload&source=quote-check";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

type SubmitState = "idle" | "submitting" | "error";

interface FormErrors {
  firstName?: string;
  email?: string;
}

const PILLARS = [
  { code: "P1", label: "Price", desc: "Line items, unit pricing, and totals reviewed for unclear or missing detail." },
  { code: "P2", label: "Fine Print", desc: "Contract language worth reviewing before you sign anything." },
  { code: "P3", label: "Install", desc: "Scope, permits, and installation specifics your quote may omit." },
  { code: "P4", label: "Safety", desc: "HVHZ and impact-rating specifications checked against what's written." },
  { code: "P5", label: "Warranty", desc: "What's actually covered, for how long, and by whom." },
] as const;

const STEPS = [
  { n: "1", title: "Tell us who you are", desc: "First name and email. That's the whole form." },
  { n: "2", title: "Upload your quote", desc: "Photo or PDF of any window or door estimate. 60 seconds." },
  { n: "3", title: "Read your Truth Report", desc: "A graded, line-by-line breakdown — possible issues, missing details, and the questions to ask." },
] as const;

const FAQS = [
  {
    q: "Is this really free?",
    a: "Yes. The Truth Report costs homeowners nothing. If you later want help getting additional quotes, we can connect you with licensed local contractors — that's how we keep the report free.",
  },
  {
    q: "Are you a window company?",
    a: "No. WindowMan is not a contractor, installer, law firm, insurance company, building department, or government agency. We're an independent quote-intelligence service that works for the homeowner.",
  },
  {
    q: "What does the report check?",
    a: "Five areas: pricing clarity, fine print, installation scope, safety specifications, and warranty terms. It flags possible issues and missing details worth checking — it doesn't accuse anyone of anything.",
  },
  {
    q: "I don't have a quote yet. Can you still help?",
    a: "Yes. Enter your name and email and we'll send you the questions to ask before you get quotes — then upload each estimate as it comes in and compare grades.",
  },
  {
    q: "Will contractors spam me?",
    a: "No. Your information is never sold to a list of contractors. Nothing goes anywhere without you asking for it.",
  },
] as const;

export default function PricingSearchLanding() {
  const navigate = useNavigate();
  const funnel = useScanFunnelSafe();

  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // One session id per page visit; stable across retries so the edge
  // function's reuse path dedupes instead of creating duplicate leads.
  const sessionIdRef = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-fallback`,
  );

  const inFlightRef = useRef(false); // duplicate-submit guard

  const validate = useCallback((): FormErrors => {
    const next: FormErrors = {};
    if (!firstName.trim() || firstName.trim().length < 2) {
      next.firstName = "Enter your first name.";
    }
    if (!EMAIL_RE.test(email.trim())) {
      next.email = "Enter a valid email address.";
    }
    return next;
  }, [firstName, email]);

  const handleSubmit = useCallback(async () => {
    if (inFlightRef.current) return;

    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    inFlightRef.current = true;
    setSubmitState("submitting");
    setServerMessage(null);

    try {
      const result = await submitTruthGateLead({
        sessionId: sessionIdRef.current,
        firstName: firstName.trim(),
        email: email.trim(),
        phone: "", // optional at this stage; OTP gate collects it later
      });

      if (result.ok) {
        // Hand the trusted identity pair to the homepage upload flow via
        // ScanFunnel state (persists to wm_funnel_* localStorage). If the
        // provider is somehow absent, we still navigate — the lead is saved
        // server-side and Index shows its contact-lock recovery UI.
        if (funnel) {
          funnel.setSessionId(result.sessionId);
          funnel.setLeadId(result.leadId);
        } else if (import.meta.env.DEV) {
          console.warn(
            "[PricingSearchLanding] ScanFunnelProvider missing; handoff will rely on Index recovery UI",
          );
        }
        navigate(POST_CAPTURE_URL);
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
  }, [firstName, email, funnel, navigate, validate]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleSubmit();
    },
    [handleSubmit],
  );

  const year = useMemo(() => new Date().getFullYear(), []);
  const submitting = submitState === "submitting";

  return (
    <main className="min-h-screen bg-[#0F1F35] text-slate-100 antialiased">
      {/* ── Top bar ─────────────────────────────────────────── */}
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <span className="font-['Barlow_Condensed'] text-xl font-bold tracking-wide text-white">
            WINDOW<span className="text-[#49A5FF]">MAN</span>
          </span>
          <span className="rounded-full border border-[#C8952A]/40 bg-[#C8952A]/10 px-3 py-1 font-['DM_Mono'] text-[11px] uppercase tracking-widest text-[#C8952A]">
            Independent · Not a contractor
          </span>
        </div>
      </header>

      {/* ── Hero: answers the search query ──────────────────── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(73,165,255,0.12),transparent_60%)]"
        />
        <div className="relative mx-auto grid max-w-5xl gap-10 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20">
          {/* Copy column */}
          <div>
            <p className="mb-4 font-['DM_Mono'] text-xs uppercase tracking-[0.25em] text-[#49A5FF]">
              South Florida impact windows &amp; doors
            </p>
            <h1 className="font-['Barlow_Condensed'] text-4xl font-bold leading-[1.05] text-white sm:text-5xl lg:text-6xl">
              Is your window quote fair?
              <span className="block text-[#49A5FF]">
                Find out free — in 60 seconds.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Upload any impact window or door estimate and get a free{" "}
              <strong className="text-white">Truth Report</strong>: a graded,
              line-by-line review that flags possible pricing issues, missing
              specifications, fine-print traps worth checking, and the exact
              questions to ask before you sign.
            </p>

            {/* Trust pills */}
            <ul className="mt-6 flex flex-wrap gap-2" aria-label="Why homeowners trust WindowMan">
              {[
                "100% free for homeowners",
                "We work for you, not the contractor",
                "Built on public permit records",
                "No spam. Ever.",
              ].map((t) => (
                <li
                  key={t}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-['DM_Mono'] text-[11px] text-slate-300"
                >
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Capture card */}
          <div className="lg:pt-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-[0_8px_40px_rgba(0,0,0,0.45)] backdrop-blur-md sm:p-7">
              <h2 className="font-['Barlow_Condensed'] text-2xl font-bold text-white">
                Get your free Truth Report
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Name and email — then upload your quote on the next screen.
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <label
                    htmlFor="wm-first-name"
                    className="mb-1.5 block font-['DM_Mono'] text-[11px] uppercase tracking-widest text-slate-400"
                  >
                    First name
                  </label>
                  <input
                    id="wm-first-name"
                    type="text"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    onKeyDown={onKeyDown}
                    aria-invalid={Boolean(errors.firstName)}
                    aria-describedby={errors.firstName ? "wm-first-name-err" : undefined}
                    className="w-full rounded-lg border border-white/15 bg-[#0B1728] px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:border-[#49A5FF] focus:ring-2 focus:ring-[#49A5FF]/30"
                    placeholder="Maria"
                  />
                  {errors.firstName && (
                    <p id="wm-first-name-err" role="alert" className="mt-1.5 text-xs text-red-400">
                      {errors.firstName}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="wm-email"
                    className="mb-1.5 block font-['DM_Mono'] text-[11px] uppercase tracking-widest text-slate-400"
                  >
                    Email
                  </label>
                  <input
                    id="wm-email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={onKeyDown}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? "wm-email-err" : undefined}
                    className="w-full rounded-lg border border-white/15 bg-[#0B1728] px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:border-[#49A5FF] focus:ring-2 focus:ring-[#49A5FF]/30"
                    placeholder="maria@example.com"
                  />
                  {errors.email && (
                    <p id="wm-email-err" role="alert" className="mt-1.5 text-xs text-red-400">
                      {errors.email}
                    </p>
                  )}
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
                  className="w-full rounded-lg bg-[#49A5FF] px-6 py-3.5 font-['Barlow_Condensed'] text-lg font-bold tracking-wide text-[#0F1F35] transition hover:bg-[#6BB6FF] focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Saving…" : "Analyze my quote free →"}
                </button>

                <p className="text-center text-[11px] leading-relaxed text-slate-500">
                  Free for homeowners. No obligation. Your info is never sold.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Authority strip: verifiable permit data ─────────── */}
      <section className="border-y border-white/10 bg-[#0B1728]">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <p className="text-center font-['DM_Mono'] text-sm leading-relaxed text-slate-400">
            Hundreds of impact window jobs are permitted across South Florida
            every month —{" "}
            <span className="text-[#C8952A]">public permit filings</span> we
            study so you don't overpay on yours.
          </p>
        </div>
      </section>

      {/* ── PAS: the problem with window quotes ─────────────── */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <h2 className="font-['Barlow_Condensed'] text-3xl font-bold text-white sm:text-4xl">
          Window quotes are built to be hard to compare.
        </h2>
        <div className="mt-6 grid gap-6 text-slate-300 md:grid-cols-3">
          <p className="leading-relaxed">
            One contractor quotes per opening. Another quotes a lump sum. A
            third leaves out permits, disposal, or stucco repair entirely —
            until the change order shows up.
          </p>
          <p className="leading-relaxed">
            On a $20,000–$50,000 project, an unclear line item or a missing
            specification isn't a rounding error. It's real money, and it's
            exactly the detail a rushed signing skips past.
          </p>
          <p className="leading-relaxed">
            The Truth Report puts every quote through the same five checks — so
            for the first time, you're comparing apples to apples before you
            commit.
          </p>
        </div>
      </section>

      {/* ── 5 pillars ───────────────────────────────────────── */}
      <section className="border-t border-white/10 bg-[#0B1728]">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <p className="font-['DM_Mono'] text-xs uppercase tracking-[0.25em] text-[#49A5FF]">
            The Truth Report
          </p>
          <h2 className="mt-2 font-['Barlow_Condensed'] text-3xl font-bold text-white sm:text-4xl">
            Five checks. One grade. Zero pressure.
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PILLARS.map((p) => (
              <div
                key={p.code}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-[#49A5FF]/40"
              >
                <div className="flex items-center gap-3">
                  <span className="rounded-md border border-[#49A5FF]/40 bg-[#49A5FF]/10 px-2 py-0.5 font-['DM_Mono'] text-xs text-[#49A5FF]">
                    {p.code}
                  </span>
                  <h3 className="font-['Barlow_Condensed'] text-xl font-bold text-white">
                    {p.label}
                  </h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">
                  {p.desc}
                </p>
              </div>
            ))}
            {/* CTA card completes the grid */}
            <div className="flex flex-col justify-between rounded-xl border border-[#C8952A]/40 bg-[#C8952A]/10 p-5">
              <p className="text-sm leading-relaxed text-slate-200">
                Every flag is phrased as a question to ask — not an accusation.
                You stay in control of the conversation.
              </p>
              <a
                href="#top"
                onClick={(e) => {
                  e.preventDefault();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="mt-4 inline-block font-['Barlow_Condensed'] text-lg font-bold text-[#C8952A] underline-offset-4 hover:underline"
              >
                Grade my quote →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <h2 className="font-['Barlow_Condensed'] text-3xl font-bold text-white sm:text-4xl">
          How it works
        </h2>
        <ol className="mt-8 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <li
              key={s.n}
              className="rounded-xl border border-white/10 bg-white/[0.04] p-5"
            >
              <span className="font-['DM_Mono'] text-sm text-[#49A5FF]">
                STEP {s.n}
              </span>
              <h3 className="mt-2 font-['Barlow_Condensed'] text-xl font-bold text-white">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {s.desc}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-slate-400">
          Already signed? Upload anyway — the report may still surface warranty
          and installation details worth confirming before work begins.
        </p>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────── */}
      <section className="border-t border-white/10 bg-[#0B1728]">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h2 className="font-['Barlow_Condensed'] text-3xl font-bold text-white sm:text-4xl">
            Straight answers
          </h2>
          <div className="mt-8 divide-y divide-white/10">
            {FAQS.map((f, i) => {
              const open = openFaq === i;
              return (
                <div key={f.q} className="py-4">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : i)}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between gap-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#49A5FF]/50"
                  >
                    <span className="font-['Barlow_Condensed'] text-lg font-semibold text-white">
                      {f.q}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`font-['DM_Mono'] text-[#49A5FF] transition-transform ${open ? "rotate-45" : ""}`}
                    >
                      +
                    </span>
                  </button>
                  {open && (
                    <p className="mt-3 text-sm leading-relaxed text-slate-400">
                      {f.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6">
        <h2 className="font-['Barlow_Condensed'] text-3xl font-bold text-white sm:text-4xl">
          You're about to spend five figures.
          <span className="block text-[#49A5FF]">
            Spend 60 seconds first.
          </span>
        </h2>
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="mt-8 rounded-lg bg-[#49A5FF] px-10 py-4 font-['Barlow_Condensed'] text-xl font-bold tracking-wide text-[#0F1F35] transition hover:bg-[#6BB6FF] focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Get my free Truth Report →
        </button>
      </section>

      {/* ── Footer / compliance ─────────────────────────────── */}
      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <p className="text-xs leading-relaxed text-slate-500">
            WindowMan is an independent quote-intelligence and consumer-advisory
            service. WindowMan is not a contractor, installer, law firm,
            insurance company, building department, or government agency. Truth
            Report findings identify possible issues and details worth checking;
            they are informational and not legal, financial, or engineering
            advice. Savings are not guaranteed. If you request additional
            quotes, WindowMan may refer you to licensed local contractors and
            may receive compensation from those contractors.
          </p>
          <p className="mt-4 font-['DM_Mono'] text-xs text-slate-600">
            © {year} WindowMan ·{" "}
            <a href="/privacy" className="underline-offset-2 hover:text-slate-400 hover:underline">
              Privacy
            </a>{" "}
            ·{" "}
            <a href="/terms" className="underline-offset-2 hover:text-slate-400 hover:underline">
              Terms
            </a>{" "}
            ·{" "}
            <a href="/disclaimer" className="underline-offset-2 hover:text-slate-400 hover:underline">
              Disclaimer
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}
