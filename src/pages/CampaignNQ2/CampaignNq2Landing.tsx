import { useState } from "react";
import "@fontsource/barlow-condensed/800.css";
import "@fontsource/barlow-condensed/900.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import {
  ArrowRight,
  BadgeDollarSign,
  BrainCircuit,
  FileSearch,
  ListChecks,
  Scale,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BUSINESS_EVENTS } from "@/lib/tracking/events";
import { pushLowIntentEvent } from "@/lib/tracking/dataLayer";
import windowManGuide from "@/assets/wm-pointing.avif";
import CampaignNq2CaptureDialog from "./CampaignNq2CaptureDialog";
import DirectQuoteUploader from "./DirectQuoteUploader";
import {
  CAMPAIGN_NQ2_AUDIT_ROWS,
  CAMPAIGN_NQ2_CONFIG,
  CAMPAIGN_NQ2_FAQS,
  CAMPAIGN_NQ2_REASSURANCE,
  CAMPAIGN_NQ2_STEPS,
} from "./campaignNq2Content";

const REASSURANCE_ICONS = [ShieldCheck, UserRoundCheck, BrainCircuit] as const;
const AUDIT_ICONS = [FileSearch, Scale, ListChecks, BadgeDollarSign, ShieldCheck] as const;

export default function CampaignNq2Landing() {
  const [captureOpen, setCaptureOpen] = useState(false);

  const openCapture = (ctaSource: "hero" | "footer") => {
    pushLowIntentEvent(BUSINESS_EVENTS.first_quote_modal_opened, {
      page_path: CAMPAIGN_NQ2_CONFIG.route,
      campaign_variant: CAMPAIGN_NQ2_CONFIG.variant,
      cta_source: ctaSource,
    });
    setCaptureOpen(true);
  };

  return (
    <main
      className="min-h-screen bg-white font-['DM_Sans'] text-[#06143f] antialiased"
      data-campaign-variant={CAMPAIGN_NQ2_CONFIG.variant}
      data-telemetry-view="campaign_nq2_page_viewed"
    >
      <Helmet>
        <title>Get a Free Window Quote | WindowMan</title>
        <meta
          name="description"
          content="Get help obtaining a window estimate, then use WindowMan to independently review the quote before you sign."
        />
      </Helmet>

      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-5 sm:px-7">
          <Link
            to="/"
            className="rounded-sm font-['Barlow_Condensed'] text-2xl font-black tracking-[0.04em] text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-4"
            aria-label="WindowMan home"
          >
            WINDOWMAN
          </Link>
        </div>
      </header>

      <section className="overflow-hidden bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 pb-0 pt-10 sm:px-7 sm:pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-end lg:gap-10 lg:pt-16">
          <div className="relative z-10 max-w-2xl pb-2 text-center sm:text-left lg:pb-20">
            <h1 className="font-['Barlow_Condensed'] text-[3.25rem] font-black leading-[0.91] tracking-[-0.025em] text-[#06143f] sm:text-6xl lg:text-[5.25rem]">
              Get a Free Window Quote —{" "}
              <span className="text-blue-600">Then Let AI Audit It.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-[17px] leading-7 text-slate-600 sm:mx-0 sm:text-lg">
              {CAMPAIGN_NQ2_CONFIG.supportingCopy}
            </p>
            <div className="mt-7 flex flex-col items-stretch gap-2 sm:items-start">
              <button
                type="button"
                onClick={() => openCapture("hero")}
                className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 text-base font-extrabold text-white shadow-[0_12px_30px_rgba(37,99,235,0.24)] transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:w-auto sm:min-w-64"
                data-telemetry-event="campaign_nq2_primary_cta_clicked"
              >
                {CAMPAIGN_NQ2_CONFIG.primaryCta}
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </button>
              <DirectQuoteUploader />
            </div>
          </div>

          <div className="relative mx-auto h-[390px] w-full max-w-sm self-end sm:h-[470px] lg:h-[560px] lg:max-w-md">
            <div
              className="absolute inset-x-10 bottom-2 h-40 rounded-full bg-blue-100 blur-3xl"
              aria-hidden="true"
            />
            <img
              src={windowManGuide}
              alt="WindowMan guide pointing toward the free quote request"
              className="relative mx-auto h-full w-auto object-contain object-bottom"
              width="1024"
              height="1024"
              loading="eager"
            />
          </div>
        </div>
      </section>

      <section
        className="border-y border-blue-100 bg-slate-50"
        aria-label="Why homeowners use WindowMan"
      >
        <div className="mx-auto grid max-w-6xl divide-y divide-blue-100 px-5 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-7">
          {CAMPAIGN_NQ2_REASSURANCE.map((item, index) => {
            const Icon = REASSURANCE_ICONS[index];
            return (
              <div
                key={item}
                className="flex min-h-24 items-center justify-center gap-3 py-5 text-center text-sm font-bold text-[#06143f]"
              >
                <Icon className="h-6 w-6 text-blue-600" aria-hidden="true" />
                {item}
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-7 sm:py-24">
        <h2 className="font-['Barlow_Condensed'] text-5xl font-black leading-none tracking-tight text-[#06143f] sm:text-6xl">
          How <span className="text-blue-600">WindowMan</span> Works
        </h2>

        <ol className="relative mt-10 space-y-8 before:absolute before:bottom-10 before:left-[4.6rem] before:top-10 before:w-px before:bg-blue-200 sm:space-y-10 sm:before:left-[6.35rem]">
          {CAMPAIGN_NQ2_STEPS.map((step) => (
            <li
              key={step.number}
              className="relative grid grid-cols-[4rem_1rem_1fr] items-start gap-3 sm:grid-cols-[5.5rem_1.25rem_1fr] sm:gap-5"
            >
              <span className="font-['Barlow_Condensed'] text-6xl font-black leading-none text-blue-600 sm:text-7xl">
                {step.number}
              </span>
              <span className="relative z-10 mt-3 h-4 w-4 rounded-full border-4 border-white bg-blue-600 ring-2 ring-blue-600 sm:mt-4" />
              <div className="pt-1 sm:grid sm:grid-cols-[0.8fr_1.2fr] sm:gap-8">
                <h3 className="font-['Barlow_Condensed'] text-3xl font-extrabold leading-none text-[#06143f]">
                  {step.title}
                </h3>
                <p className="mt-2 text-[15px] leading-6 text-slate-600 sm:mt-0 sm:text-base">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-blue-100 bg-slate-50">
        <div className="mx-auto max-w-5xl px-5 py-16 sm:px-7 sm:py-24">
          <div className="rounded-xl border border-blue-200 bg-white p-5 shadow-[0_20px_55px_rgba(30,64,175,0.08)] sm:p-9">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-600">
              Illustrative example
            </p>
            <h2 className="mt-3 font-['Barlow_Condensed'] text-5xl font-black leading-[0.95] tracking-tight text-[#06143f] sm:text-6xl">
              See what deserves <span className="text-blue-600">a closer look</span>
            </h2>
            <div className="mt-8 divide-y divide-blue-100 overflow-hidden rounded-xl border border-slate-200">
              {CAMPAIGN_NQ2_AUDIT_ROWS.map((row, index) => {
                const Icon = AUDIT_ICONS[index];
                return (
                  <div
                    key={row.label}
                    className="grid gap-3 px-4 py-5 sm:grid-cols-[2.75rem_0.8fr_1.2fr] sm:items-center sm:gap-5 sm:px-6"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-blue-50 text-blue-600">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="font-['Barlow_Condensed'] text-2xl font-extrabold leading-none text-[#06143f]">
                      {row.label}
                    </h3>
                    <p className="text-sm leading-6 text-slate-600">{row.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-16 sm:px-7 sm:py-24">
        <h2 className="font-['Barlow_Condensed'] text-5xl font-black leading-none tracking-tight text-[#06143f] sm:text-6xl">
          Questions, <span className="text-blue-600">answered.</span>
        </h2>
        <Accordion type="single" collapsible className="mt-9 space-y-4">
          {CAMPAIGN_NQ2_FAQS.map((faq, index) => (
            <AccordionItem
              key={faq.question}
              value={`campaign-nq2-faq-${index}`}
              className="rounded-xl border border-blue-100 px-5 data-[state=open]:border-blue-200 data-[state=open]:shadow-sm sm:px-7"
            >
              <AccordionTrigger className="min-h-20 font-['Barlow_Condensed'] text-left text-2xl font-extrabold leading-tight text-[#06143f] hover:no-underline sm:text-3xl">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="pb-6 text-[15px] leading-7 text-slate-600 sm:text-base">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="bg-[#06143f] px-5 py-16 text-center text-white sm:px-7 sm:py-20">
        <h2 className="mx-auto max-w-3xl font-['Barlow_Condensed'] text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl">
          Get the estimate. <span className="text-blue-400">Know what you’re signing.</span>
        </h2>
        <button
          type="button"
          onClick={() => openCapture("footer")}
          className="mt-8 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-7 text-base font-extrabold text-white shadow-[0_12px_30px_rgba(37,99,235,0.3)] transition hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06143f] sm:w-auto sm:min-w-64"
          data-telemetry-event="campaign_nq2_primary_cta_clicked"
        >
          {CAMPAIGN_NQ2_CONFIG.primaryCta}
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </section>

      <footer className="border-t border-slate-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 py-8 text-sm text-slate-500 sm:flex-row sm:justify-between sm:px-7">
          <Link
            to="/"
            className="font-['Barlow_Condensed'] text-2xl font-black tracking-[0.04em] text-blue-600"
            aria-label="WindowMan home"
          >
            WINDOWMAN
          </Link>
          <nav className="flex gap-6" aria-label="Legal">
            <Link className="hover:text-slate-950 hover:underline" to="/privacy">
              Privacy
            </Link>
            <Link className="hover:text-slate-950 hover:underline" to="/terms">
              Terms
            </Link>
            <Link className="hover:text-slate-950 hover:underline" to="/disclaimer">
              Disclaimer
            </Link>
          </nav>
        </div>
      </footer>

      <CampaignNq2CaptureDialog
        open={captureOpen}
        onOpenChange={setCaptureOpen}
      />
    </main>
  );
}
