import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { MapPin, Shield, Smartphone } from "lucide-react";
import WindowManMark from "@/components/forensic-report/WindowManMark";
import { NextdoorBeforeAfterStrip } from "@/components/nextdoor/NextdoorBeforeAfterStrip";
import { NextdoorChecksGrid } from "@/components/nextdoor/NextdoorChecksGrid";
import { NextdoorContractorQuestionCard } from "@/components/nextdoor/NextdoorContractorQuestionCard";
import { NextdoorFinancialRiskBlock } from "@/components/nextdoor/NextdoorFinancialRiskBlock";
import { NextdoorHeroGradeCard } from "@/components/nextdoor/NextdoorHeroGradeCard";
import { NextdoorIdentityForm } from "@/components/nextdoor/NextdoorIdentityForm";
import { NextdoorNotMarketplacePanel } from "@/components/nextdoor/NextdoorNotMarketplacePanel";
import { NextdoorQuoteLeverageLoop } from "@/components/nextdoor/NextdoorQuoteLeverageLoop";
import { NextdoorReveal } from "@/components/nextdoor/NextdoorReveal";
import { NextdoorWhatGetsMissed } from "@/components/nextdoor/NextdoorWhatGetsMissed";
import { NextdoorJourneyTimeline } from "@/components/nextdoor/NextdoorJourneyTimeline";
import { NextdoorTrustStrip } from "@/components/nextdoor/NextdoorTrustStrip";
import {
  NEXTDOOR_GRID_TEXTURE,
  NEXTDOOR_PAGE_BG,
  NEXTDOOR_VIGNETTE,
  nextdoorPrimaryCtaClass,
  nextdoorSecondaryCtaClass,
  scrollToElementAfterDelay,
} from "@/components/nextdoor/nextdoorUi";
import { NextdoorProtectionLedger } from "@/components/nextdoor/NextdoorProtectionLedger";
import {
  NextdoorPrepPanel,
  NextdoorQuoteReadyPanel,
} from "@/components/nextdoor/NextdoorPrepPanel";
import { NextdoorReadinessCards } from "@/components/nextdoor/NextdoorReadinessCards";
import type {
  NextdoorIdentityFields,
  NextdoorLeadPayload,
  NextdoorPrefilledFields,
  NextdoorTrafficMode,
  QuoteReadiness,
} from "@/components/nextdoor/types";
import {
  buildAttributionHandoffUrl,
  buildLocalNextdoorPayload,
  captureNextdoorAttributionOnMount,
  deriveNextdoorTrafficMode,
  logLocalPayloadDevSummary,
  parseNextdoorUrlPrefill,
} from "@/lib/nextdoor/attributionHelpers";
import {
  deriveAreaContext,
  heroEyebrowLabel,
  HERO_HEADLINE,
  HERO_SUBHEAD,
  mockCardAreaSubtitle,
  PAGE_META_DESCRIPTION,
  PAGE_TITLE,
  TRUST_PILL_LABELS,
} from "@/lib/nextdoor/areaContext";
import { getUtmData } from "@/lib/useUtmCapture";

const PAGE_BG = NEXTDOOR_PAGE_BG;

const GRID_TEXTURE = NEXTDOOR_GRID_TEXTURE;

const HERO_PILLS = [
  { label: TRUST_PILL_LABELS.freePreviewFirst, icon: Smartphone },
  { label: TRUST_PILL_LABELS.privateQuoteCheck, icon: MapPin },
  { label: TRUST_PILL_LABELS.noContractorPressure, icon: Shield },
  { label: TRUST_PILL_LABELS.southFloridaReady, icon: Shield },
] as const;

const EMPTY_IDENTITY: NextdoorIdentityFields = {
  firstName: "",
  email: "",
  zip: "",
};

const EMPTY_PREFILLED: NextdoorPrefilledFields = {
  firstName: false,
  email: false,
  zip: false,
};

function readInitialUrlState() {
  if (typeof window === "undefined") {
    return {
      identity: EMPTY_IDENTITY,
      lastName: "",
      prefilled: EMPTY_PREFILLED,
      hasKnownLead: false,
      trafficMode: "unknown" as NextdoorTrafficMode,
      quoteReadiness: null as QuoteReadiness | null,
    };
  }

  captureNextdoorAttributionOnMount();
  const prefill = parseNextdoorUrlPrefill();
  const utm = getUtmData();

  return {
    identity: {
      firstName: prefill.identity.firstName,
      email: prefill.identity.email,
      zip: prefill.identity.zip,
    },
    lastName: prefill.identity.lastName,
    prefilled: prefill.prefilled,
    hasKnownLead: prefill.hasKnownLead,
    trafficMode: deriveNextdoorTrafficMode(prefill.ndLeadId, utm.utm_source, utm.ndclid),
    quoteReadiness: prefill.quoteReadiness,
  };
}

function isQuoteReady(readiness: QuoteReadiness | null): boolean {
  return readiness === "has_estimate";
}

function isPrepPath(readiness: QuoteReadiness | null): boolean {
  return (
    readiness === "getting_quotes_now" ||
    readiness === "need_quote_soon" ||
    readiness === "researching"
  );
}

function trafficModeLabel(mode: NextdoorTrafficMode): string | null {
  switch (mode) {
    case "native_followup":
      return "Nextdoor native follow-up";
    case "direct_nextdoor_click":
      return "Nextdoor ad click";
    default:
      return null;
  }
}

/** Local-only adaptive label for the closing CTA — no navigation, no backend. */
function closingCtaLabel(readiness: QuoteReadiness | null): string {
  switch (readiness) {
    case "has_estimate":
      return "Start my free preview";
    case "getting_quotes_now":
      return "Save my checklist";
    case "need_quote_soon":
      return "Prep my quote questions";
    case "researching":
      return "Show me what to look for";
    default:
      return "Start my free preview";
  }
}

export default function NextdoorHome() {
  const initialUrlState = useMemo(() => readInitialUrlState(), []);
  const readinessRef = useRef<HTMLElement>(null);
  const identityModuleRef = useRef<HTMLElement>(null);
  const [readiness, setReadiness] = useState<QuoteReadiness | null>(
    initialUrlState.quoteReadiness,
  );
  const [identity, setIdentity] = useState<NextdoorIdentityFields>(initialUrlState.identity);
  const [lastName, setLastName] = useState(initialUrlState.lastName);
  const [prefilled, setPrefilled] = useState<NextdoorPrefilledFields>(initialUrlState.prefilled);
  const [hasKnownLead, setHasKnownLead] = useState(initialUrlState.hasKnownLead);
  const [trafficMode, setTrafficMode] = useState<NextdoorTrafficMode>(initialUrlState.trafficMode);
  const [identitySubmitted, setIdentitySubmitted] = useState(false);
  const [localPayload, setLocalPayload] = useState<NextdoorLeadPayload | null>(null);
  const [showChecklist, setShowChecklist] = useState(
    initialUrlState.quoteReadiness === "researching",
  );

  const isResearching = readiness === "researching";

  useEffect(() => {
    captureNextdoorAttributionOnMount();
  }, []);

  const attributionSaveUrl = useMemo(() => {
    const overrides: Record<string, string> = {};
    if (readiness) {
      overrides.quote_readiness = readiness;
      overrides.wm_intent = readiness === "has_estimate" ? "has_quote" : "no_quote";
    }

    return buildAttributionHandoffUrl("/nextdoor", overrides);
  }, [readiness]);

  const areaContext = useMemo(() => {
    const utm = getUtmData();
    return deriveAreaContext({
      zip: identity.zip,
      utmCampaign: utm.utm_campaign,
      utmSource: utm.utm_source,
    });
  }, [identity.zip]);

  const heroEyebrow = heroEyebrowLabel(areaContext);
  const mockSubtitle = mockCardAreaSubtitle(areaContext);

  const scrollToReadiness = useCallback(() => {
    readinessRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleReadinessSelect = useCallback((value: QuoteReadiness) => {
    setReadiness(value);
    setShowChecklist(value === "researching");
    setIdentitySubmitted(false);
    setLocalPayload(null);

    if (value === "has_estimate") {
      scrollToElementAfterDelay(identityModuleRef.current, 300);
    }
  }, []);

  const handleHeroSecondary = useCallback(() => {
    setReadiness("getting_quotes_now");
    setShowChecklist(false);
    setIdentitySubmitted(false);
    setLocalPayload(null);
    scrollToReadiness();
  }, [scrollToReadiness]);

  const handleIdentityChange = useCallback(
    (field: keyof NextdoorIdentityFields, value: string) => {
      setIdentity((prev) => ({ ...prev, [field]: value }));
      setIdentitySubmitted(false);
      setLocalPayload(null);
    },
    [],
  );

  const handleIdentitySubmit = useCallback(() => {
    if (!readiness) return;

    const payload = buildLocalNextdoorPayload({
      firstName: identity.firstName,
      lastName,
      email: identity.email,
      zip: identity.zip,
      quoteReadiness: readiness,
      trafficMode,
    });

    setLocalPayload(payload);
    logLocalPayloadDevSummary(payload);
    setIdentitySubmitted(true);
  }, [identity, lastName, readiness, trafficMode]);

  const showIdentityModule = readiness !== null;
  const showNextStepPanel =
    readiness !== null &&
    (isResearching || identitySubmitted) &&
    (isQuoteReady(readiness) || isPrepPath(readiness));

  const trafficLabel = trafficModeLabel(trafficMode);

  return (
    <>
      <Helmet>
        <title>{PAGE_TITLE}</title>
        <meta name="description" content={PAGE_META_DESCRIPTION} />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="relative min-h-screen overflow-x-hidden text-slate-900" style={{ background: PAGE_BG }}>
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={GRID_TEXTURE}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: NEXTDOOR_VIGNETTE }}
          aria-hidden="true"
        />

        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 md:px-8">
            <a
              href="/"
              className="inline-flex items-center gap-2.5 select-none"
              aria-label="WindowMan home"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                <WindowManMark size={20} opacity={1} />
              </span>
              <span className="font-display text-lg font-extrabold tracking-wide">
                <span className="text-slate-900">WINDOW</span>
                <span className="text-primary">MAN</span>
                <sup className="ml-0.5 text-[8px] font-normal text-slate-500">.PRO</sup>
              </span>
            </a>
            <div className="hidden text-right sm:block">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                {TRUST_PILL_LABELS.privateQuoteCheck}
              </p>
              <p className="text-[11px] text-slate-500">
                {trafficLabel ?? "Private review · Not a contractor"}
              </p>
            </div>
          </div>
          <div className="border-t border-slate-100 px-4 py-2 text-center sm:hidden">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
              {TRUST_PILL_LABELS.privateQuoteCheck}
            </p>
          </div>
        </header>

        <main className="relative z-10 mx-auto max-w-5xl px-4 pb-20 pt-8 md:px-8 md:pt-12">
          {hasKnownLead ? (
            <section
              className="mb-8 rounded-xl border border-emerald-500/25 bg-gradient-to-r from-emerald-50/80 to-white p-4 shadow-sm md:p-5"
              aria-label="Known lead welcome"
            >
              <p className="font-display text-lg font-bold text-slate-900 md:text-xl">
                Welcome back
                {identity.firstName.trim() ? `, ${identity.firstName.trim()}` : ""}. We found details
                from your Nextdoor request.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                You can edit anything before continuing. Pick up where you left off — preview first,
                upload when ready.
              </p>
            </section>
          ) : null}

          <section className="mb-10 md:mb-14">
            <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
              <NextdoorReveal className="text-left">
                <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                  <MapPin className="h-3 w-3" aria-hidden="true" />
                  {heroEyebrow}
                </p>
                <h1 className="mt-5 font-display text-[1.65rem] font-extrabold leading-[1.15] tracking-tight text-slate-900 sm:text-3xl md:text-[2.35rem] md:leading-[1.12]">
                  {HERO_HEADLINE}
                </h1>
                <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 md:text-lg">
                  {HERO_SUBHEAD}
                </p>

                <div className="mt-6 flex flex-wrap gap-2">
                  {HERO_PILLS.map(({ label, icon: Icon }) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/90 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_4px_12px_-8px_rgba(15,40,90,0.25)]"
                    >
                      <Icon className="h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
                      {label}
                    </span>
                  ))}
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={scrollToReadiness}
                    className={[nextdoorPrimaryCtaClass, "w-full sm:w-auto"].join(" ")}
                    style={{ padding: "16px 32px", fontSize: 16 }}
                  >
                    Start my quote check
                  </button>
                  <button
                    type="button"
                    onClick={handleHeroSecondary}
                    className={[nextdoorSecondaryCtaClass, "w-full sm:w-auto"].join(" ")}
                    style={{ padding: "15px 30px", fontSize: 14 }}
                  >
                    I&apos;m still getting quotes
                  </button>
                </div>
              </NextdoorReveal>

              <NextdoorReveal className="hidden sm:block lg:pt-2" delayMs={120}>
                <NextdoorHeroGradeCard subtitle={mockSubtitle} />
              </NextdoorReveal>
            </div>

            <div className="mt-8 sm:hidden">
              <NextdoorHeroGradeCard subtitle={mockSubtitle} />
            </div>

            <NextdoorReveal className="mt-8" delayMs={80}>
              <NextdoorTrustStrip />
            </NextdoorReveal>
          </section>

          <section
            ref={readinessRef}
            id="readiness-selector"
            className="mb-10 scroll-mt-28 md:mb-12"
            aria-labelledby="readiness-heading"
          >
            <NextdoorReveal className="rounded-2xl border border-white/80 bg-gradient-to-b from-white/85 to-slate-50/70 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_8px_-3px_rgba(15,40,90,0.1),0_22px_56px_-28px_rgba(8,47,73,0.35)] backdrop-blur-sm md:p-8">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Step 1 · Choose your next move
              </p>
              <h2
                id="readiness-heading"
                className="mt-2 font-display text-2xl font-extrabold text-slate-900 md:text-3xl"
              >
                Where are you in the quote process?
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Pick the card that matches today. Your choices and attribution keys stay on this
                device only until backend wiring ships.
              </p>
              <div className="mt-6">
                <NextdoorReadinessCards selected={readiness} onSelect={handleReadinessSelect} />
              </div>
            </NextdoorReveal>
          </section>

          <NextdoorReveal className="mb-10 md:mb-12">
            <NextdoorQuoteLeverageLoop />
          </NextdoorReveal>

          {isResearching && showNextStepPanel ? (
            <section
              id="next-step-panel"
              className="mb-10 scroll-mt-28 md:mb-12"
              aria-labelledby="research-prep-heading"
            >
              <p className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                Step 2 · Your checklist
              </p>
              <h2 id="research-prep-heading" className="sr-only">
                Quote anatomy checklist
              </h2>
              <NextdoorPrepPanel
                readiness="researching"
                showChecklist={showChecklist}
                onShowChecklist={() => setShowChecklist(true)}
                primary
                attributionSaveUrl={attributionSaveUrl}
                areaContext={areaContext}
              />
            </section>
          ) : null}

          {showIdentityModule ? (
            <section
              ref={identityModuleRef}
              id="identity-module"
              className="mb-10 scroll-mt-28 md:mb-12"
              aria-labelledby="identity-heading"
            >
              <p
                className={[
                  "mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]",
                  isResearching ? "text-slate-400" : "text-slate-500",
                ].join(" ")}
              >
                {isResearching
                  ? "Optional · save this checklist"
                  : readiness === "has_estimate"
                    ? "Step 2 · Save your place before upload"
                    : "Optional · Send yourself the checklist"}
              </p>
              <NextdoorIdentityForm
                values={identity}
                prefilled={prefilled}
                onChange={handleIdentityChange}
                onSubmit={handleIdentitySubmit}
                submitted={identitySubmitted}
                optional={isResearching}
                readinessSelected={readiness !== null}
                areaContext={areaContext}
              />
            </section>
          ) : null}

          {showNextStepPanel && readiness && !isResearching ? (
            <section
              id="next-step-panel"
              className="mb-12 scroll-mt-28 md:mb-14"
              aria-labelledby="next-step-heading"
            >
              <p className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Step 3 · Tailored next step
                {localPayload ? " · Saved locally" : null}
              </p>
              <h2 id="next-step-heading" className="sr-only">
                Your next step
              </h2>
              {isQuoteReady(readiness) ? (
                <NextdoorQuoteReadyPanel
                  identitySubmitted={identitySubmitted}
                  attributionSaveUrl={attributionSaveUrl}
                />
              ) : isPrepPath(readiness) ? (
                <NextdoorPrepPanel
                  readiness={readiness}
                  showChecklist={showChecklist}
                  onShowChecklist={() => setShowChecklist(true)}
                  attributionSaveUrl={attributionSaveUrl}
                  areaContext={areaContext}
                />
              ) : null}
            </section>
          ) : null}

          <NextdoorReveal className="mb-12 md:mb-14">
            <NextdoorWhatGetsMissed />
          </NextdoorReveal>

          <NextdoorReveal className="mb-12 md:mb-14">
            <NextdoorBeforeAfterStrip />
          </NextdoorReveal>

          <NextdoorReveal className="mb-12 md:mb-14">
            <NextdoorFinancialRiskBlock />
          </NextdoorReveal>

          <NextdoorReveal className="mb-12 md:mb-14">
            <NextdoorContractorQuestionCard />
          </NextdoorReveal>

          <NextdoorReveal className="mb-12 md:mb-14">
            <NextdoorNotMarketplacePanel />
          </NextdoorReveal>

          <NextdoorReveal className="mb-12 md:mb-14">
            <NextdoorChecksGrid areaContext={areaContext} />
          </NextdoorReveal>

          <NextdoorReveal className="mb-12 md:mb-14">
            <NextdoorJourneyTimeline />
          </NextdoorReveal>

          <NextdoorReveal className="mb-12 md:mb-14">
            <section
              className="overflow-hidden rounded-2xl border border-[#06b6d4]/25 bg-gradient-to-br from-slate-950 via-slate-900 to-[#0b2436] p-6 text-center shadow-[0_28px_70px_-30px_rgba(8,47,73,0.6)] md:p-9"
              aria-labelledby="closing-cta-heading"
            >
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5fd6ec]">
                Ready when you are
              </p>
              <h2
                id="closing-cta-heading"
                className="mx-auto mt-2 max-w-xl font-display text-2xl font-extrabold leading-tight text-white md:text-3xl"
              >
                Check your first quote before it becomes a signed contract.
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-300/90">
                Start with the free preview. Use every quote you get to make the next conversation
                clearer.
              </p>
              <button
                type="button"
                onClick={scrollToReadiness}
                className={[nextdoorPrimaryCtaClass, "mt-6 w-full sm:w-auto"].join(" ")}
                style={{ padding: "16px 36px", fontSize: 16 }}
              >
                {closingCtaLabel(readiness)}
              </button>
              <p className="mx-auto mt-4 max-w-md text-xs leading-relaxed text-slate-400">
                No contractor pressure. No marketplace handoff. Upload when ready.
              </p>
            </section>
          </NextdoorReveal>

          <NextdoorReveal>
            <NextdoorProtectionLedger />
          </NextdoorReveal>

          <footer className="border-t border-slate-200/80 pt-8">
            <p className="text-sm leading-relaxed text-slate-600">
              WindowMan is not a law firm, contractor, building department, or insurance advisor. We
              help Florida homeowners understand questions worth asking before signing an
              impact-window quote.
            </p>
            <nav
              className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-slate-800"
              aria-label="Legal"
            >
              <a href="/privacy" className="hover:text-primary hover:underline">
                Privacy Policy
              </a>
              <a href="/terms" className="hover:text-primary hover:underline">
                Terms
              </a>
              <a href="/disclaimer" className="hover:text-primary hover:underline">
                Disclaimer
              </a>
            </nav>
          </footer>
        </main>
      </div>
    </>
  );
}
