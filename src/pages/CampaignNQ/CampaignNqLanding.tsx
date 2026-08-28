import { useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  FileText,
  MapPin,
  Scale,
  Send,
  ShieldCheck,
} from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { handoffToCanonicalUpload } from "@/components/landing/landingHandoff";
import windowManGuide from "@/assets/wm-pointing-tall.avif";
import CampaignNqCaptureDialog from "./CampaignNqCaptureDialog";
import CampaignNqQuoteMockup from "./CampaignNqQuoteMockup";
import {
  CAMPAIGN_NQ_CONFIG,
  CAMPAIGN_NQ_FAQS,
} from "./campaignNqContent";
import {
  NQ_COBALT_BLOOM_STYLE,
  NQ_CTA_PRESSABLE,
  NQ_CTA_SECONDARY_LIGHT,
  NQ_FIGURE_CONTACT_SHADOW_STYLE,
  NQ_MULLION_GRID_STYLE,
  NQ_PANE_DARK,
  NQ_PANE_LIGHT,
  NQ_WELL_LIGHT,
} from "./campaignNqSurfaces";

/**
 * Mullion placement is declared per cell rather than derived from the index,
 * because the grid reflows from two columns to four and the correct dividers
 * differ at each breakpoint.
 */
const TRUST_ITEMS = [
  {
    icon: ShieldCheck,
    label: "Independent",
    detail: "Not an installing contractor",
    mullion: "border-r border-b lg:border-b-0",
  },
  {
    icon: FileText,
    label: "No quote is created",
    detail: "This form only starts a request",
    mullion: "border-b lg:border-b-0 lg:border-r",
  },
  {
    icon: MapPin,
    label: "Florida homeowners",
    detail: "Built for Florida projects",
    mullion: "border-r",
  },
  {
    icon: BadgeCheck,
    label: "No obligation",
    detail: "Decide at your own pace",
    mullion: "",
  },
] as const;

const JOURNEY_STEPS = [
  {
    number: "01",
    icon: Send,
    title: "Request Your Quote",
    copy: "Tell WindowMan where to reach you. We’ll follow up about the next step toward obtaining a contractor quote.",
  },
  {
    number: "02",
    icon: ShieldCheck,
    title: "Let WindowMan Check It",
    copy: "Once a contractor quote exists, WindowMan can independently review the price, project scope, fees, warranty, and fine print.",
  },
  {
    number: "03",
    icon: Scale,
    title: "Compare With More Confidence",
    copy: "Use clearer information to ask better questions before you decide. Final pricing remains subject to contractor field verification.",
  },
] as const;

const PULL_QUOTE =
  "You should be able to get that first quote without sitting through a sales pitch — and understand exactly what it says before you sign anything.";

/** Weighted bottom edge between bands. Replaces hard 1px hairlines. */
function Sill({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <div
      aria-hidden="true"
      className={
        tone === "dark"
          ? "h-1 w-full bg-gradient-to-b from-black/50 to-transparent shadow-[0_8px_18px_-8px_rgba(2,6,23,0.85)]"
          : "h-1 w-full bg-gradient-to-b from-slate-300/85 via-slate-200/45 to-transparent shadow-[0_7px_16px_-7px_rgba(10,25,55,0.4)]"
      }
    />
  );
}

export default function CampaignNqLanding() {
  const [captureOpen, setCaptureOpen] = useState(false);
  const openCapture = () => setCaptureOpen(true);

  return (
    <>
      <Helmet>
        <title>Need a Window Quote? Start Here | WindowMan</title>
        <meta
          name="description"
          content="Request help taking the next step toward a contractor window quote. Once a quote exists, WindowMan can independently review it before you sign."
        />
      </Helmet>

      <header className="bg-gradient-to-b from-white to-slate-50">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            to="/"
            className="rounded-sm text-xl font-black tracking-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-4"
            aria-label="WindowMan home"
          >
            WINDOW<span className="text-sky-700">MAN</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs font-semibold uppercase tracking-[0.14em] text-slate-600 sm:inline">
              Independent · Not a contractor
            </span>
            <button
              type="button"
              onClick={openCapture}
              className={NQ_CTA_SECONDARY_LIGHT}
            >
              Get started
            </button>
          </div>
        </div>
      </header>
      <Sill />

      <main
        className="min-h-screen bg-[hsl(var(--background))] text-slate-950 antialiased"
        data-campaign-variant={CAMPAIGN_NQ_CONFIG.variant}
      >

      {/* ── HERO — glass wall ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div
          className="pointer-events-none absolute inset-0"
          style={NQ_COBALT_BLOOM_STYLE}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={NQ_MULLION_GRID_STYLE}
          aria-hidden="true"
        />

        <div className="relative mx-auto grid max-w-6xl gap-6 px-4 pb-12 pt-12 sm:gap-8 sm:px-6 sm:pb-16 sm:pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:pb-0 lg:pt-20">
          <div className="relative z-10 max-w-2xl pb-2 lg:pb-20">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-sky-300/25 border-t-sky-200/40 bg-gradient-to-b from-sky-300/[0.18] to-sky-300/[0.06] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-sky-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_-2px_rgba(2,6,23,0.6)]">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Florida homeowner first-quote help
            </div>
            <h1 className="text-4xl font-black leading-[1.05] tracking-tight [text-shadow:0_2px_10px_rgba(2,6,23,0.5)] sm:text-5xl lg:text-6xl">
              {CAMPAIGN_NQ_CONFIG.headline}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-[1.7] text-slate-300 sm:text-lg">
              {CAMPAIGN_NQ_CONFIG.supportingCopy}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={openCapture}
                className={`${NQ_CTA_PRESSABLE} focus-visible:ring-white focus-visible:ring-offset-slate-950`}
              >
                {CAMPAIGN_NQ_CONFIG.primaryCta}
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={handoffToCanonicalUpload}
                className="min-h-12 rounded-[var(--radius-btn)] px-4 text-sm font-bold text-slate-200 underline decoration-slate-500 underline-offset-4 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                Already Have a Quote? Check It Here
              </button>
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-400">
              WindowMan is independent software—not an installing contractor,
              government agency, or law firm.
            </p>
          </div>

          <div className="relative mx-auto h-52 w-full max-w-[240px] self-end sm:h-[430px] sm:max-w-sm lg:h-[520px]">
            <div
              className="absolute inset-x-2 bottom-0 h-8 sm:inset-x-6 sm:h-12"
              style={NQ_FIGURE_CONTACT_SHADOW_STYLE}
              aria-hidden="true"
            />
            <img
              src={windowManGuide}
              alt="WindowMan guide pointing toward the first-quote request"
              className="relative mx-auto h-full w-auto object-contain object-bottom"
              width="533"
              height="1023"
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
          </div>
        </div>
      </section>
      <Sill tone="dark" />

      {/* ── TRUST BAR — beveled cells, mullion dividers ─────────────────── */}
      <section
        className="bg-gradient-to-b from-white to-slate-50"
        aria-label="How WindowMan works with homeowners"
      >
        <div className="mx-auto grid max-w-6xl grid-cols-2 px-4 sm:px-6 lg:grid-cols-4">
          {TRUST_ITEMS.map((item) => (
            <div
              key={item.label}
              className={`flex min-h-24 flex-col items-center justify-center gap-1.5 border-slate-200 px-3 py-5 text-center ${item.mullion}`}
            >
              <span className={`${NQ_WELL_LIGHT} mb-1 inline-flex h-9 w-9 items-center justify-center`}>
                <item.icon
                  className="h-[18px] w-[18px] text-sky-700"
                  aria-hidden="true"
                />
              </span>
              <span className="text-sm font-bold text-slate-900">
                {item.label}
              </span>
              <span className="text-xs leading-5 text-slate-600">
                {item.detail}
              </span>
            </div>
          ))}
        </div>
      </section>
      <Sill />

      {/* ── STEPS — raised cards with recessed instrument plates ────────── */}
      <section className="section-recessed bg-[hsl(var(--background))]">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="max-w-2xl">
            <p className="wm-eyebrow uppercase text-sky-800">
              A clear path forward
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              From no quote to a more informed decision
            </h2>
          </div>

          <div className="relative mt-12">
            {/* Hairline binding the three plates into one sequence. Sits at the
                vertical centre of the icon plates and shows only in the gaps
                between the opaque cards. */}
            <div
              className="absolute inset-x-0 top-14 hidden h-px bg-[linear-gradient(90deg,transparent_0%,#cbd5e1_9%,#cbd5e1_91%,transparent_100%)] lg:block"
              aria-hidden="true"
            />
            <div className="relative grid gap-6 lg:grid-cols-3">
              {JOURNEY_STEPS.map((step) => (
                <article
                  key={step.number}
                  className={`${NQ_PANE_LIGHT} p-6 sm:p-7`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`${NQ_WELL_LIGHT} inline-flex h-14 w-14 shrink-0 items-center justify-center`}
                    >
                      <step.icon
                        className="h-6 w-6 text-sky-700"
                        aria-hidden="true"
                      />
                    </span>
                    <span className="font-mono text-sm font-bold tracking-[0.1em] text-sky-800">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="mt-5 text-xl font-extrabold text-slate-950">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-[1.7] text-slate-600">
                    {step.copy}
                  </p>
                </article>
              ))}
            </div>
          </div>

          {/* ── BENEFIT PULL-QUOTE ─────────────────────────────────────── */}
          <figure
            className={`${NQ_PANE_LIGHT} relative mt-14 overflow-hidden border-l-4 border-l-sky-600 p-7 sm:mt-16 sm:p-9`}
          >
            <span
              className="pointer-events-none absolute -top-6 right-3 select-none text-[9rem] font-black leading-none text-sky-600/[0.07]"
              aria-hidden="true"
            >
              &ldquo;
            </span>
            <blockquote className="relative max-w-3xl text-lg font-bold leading-[1.6] text-slate-900 sm:text-xl">
              {PULL_QUOTE}
            </blockquote>
          </figure>
        </div>
      </section>
      <Sill />

      {/* ── REVIEW EXAMPLE — the paper mockup ──────────────────────────── */}
      <section className="bg-gradient-to-b from-white to-slate-50">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1fr_0.95fr] lg:items-center">
          <div>
            <p className="wm-eyebrow uppercase text-sky-800">
              Independent review after a quote exists
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              Know what deserves a closer look.
            </h2>
            <p className="mt-5 max-w-xl leading-[1.7] text-slate-600">
              A contractor still needs to measure, verify site conditions, and
              provide the final construction agreement. WindowMan helps you
              understand the written quote before you sign.
            </p>
            <p className="mt-6 text-sm font-semibold text-slate-500">
              The illustration shows the categories WindowMan reviews. It is not
              a real quote and not a real analysis.
            </p>
          </div>
          <CampaignNqQuoteMockup />
        </div>
      </section>
      <Sill />

      {/* ── FAQ — individually raised panes ────────────────────────────── */}
      <section className="section-recessed bg-[hsl(var(--background))]">
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-28">
          <p className="wm-eyebrow text-center uppercase text-sky-800">
            Straight answers
          </p>
          <h2 className="mt-3 text-center text-3xl font-black tracking-tight sm:text-4xl">
            First-quote request FAQ
          </h2>
          <Accordion type="single" collapsible className="mt-10 space-y-3">
            {CAMPAIGN_NQ_FAQS.map((faq, index) => (
              <AccordionItem
                key={faq.question}
                value={`faq-${index}`}
                className={`${NQ_PANE_LIGHT} overflow-hidden border-b px-5 transition-shadow duration-200 data-[state=open]:bg-slate-50 data-[state=open]:shadow-[var(--shadow-sunken)]`}
              >
                <AccordionTrigger className="min-h-14 text-left text-base font-bold hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-sm leading-[1.7] text-slate-600">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
      <Sill />

      {/* ── CLOSING CTA ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-slate-900 px-4 py-20 text-center text-white sm:px-6 sm:py-24">
        <div
          className="pointer-events-none absolute inset-0"
          style={NQ_COBALT_BLOOM_STYLE}
          aria-hidden="true"
        />
        <div className={`${NQ_PANE_DARK} relative mx-auto max-w-3xl px-6 py-10 sm:px-10 sm:py-12`}>
          <h2 className="mx-auto max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
            Start with a contractor quote. Decide with clearer information.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-[1.7] text-slate-300">
            Send a first-quote request now. A WindowMan team member will follow
            up about your project and the next step.
          </p>
          <button
            type="button"
            onClick={openCapture}
            className={`${NQ_CTA_PRESSABLE} mt-8 focus-visible:ring-white focus-visible:ring-offset-slate-900`}
          >
            {CAMPAIGN_NQ_CONFIG.primaryCta}
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </section>
      <Sill tone="dark" />
      </main>

      <footer className="bg-gradient-to-b from-white to-slate-50">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} WindowMan. Independent quote intelligence.</p>
          <nav className="flex gap-5" aria-label="Legal">
            <Link className="hover:text-slate-950 hover:underline" to="/privacy">
              Privacy
            </Link>
            <Link className="hover:text-slate-950 hover:underline" to="/terms">
              Terms
            </Link>
            <Link
              className="hover:text-slate-950 hover:underline"
              to="/disclaimer"
            >
              Disclaimer
            </Link>
          </nav>
        </div>
      </footer>

      <CampaignNqCaptureDialog
        open={captureOpen}
        onOpenChange={setCaptureOpen}
      />
    </>
  );
}
