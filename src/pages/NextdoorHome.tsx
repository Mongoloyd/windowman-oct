import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import WindowManMark from "@/components/forensic-report/WindowManMark";
import { NextdoorBeforeAfterStrip } from "@/components/nextdoor/NextdoorBeforeAfterStrip";
import { NextdoorChecksGrid } from "@/components/nextdoor/NextdoorChecksGrid";
import { NextdoorContractorQuestionCard } from "@/components/nextdoor/NextdoorContractorQuestionCard";
import { NextdoorFinancialRiskBlock } from "@/components/nextdoor/NextdoorFinancialRiskBlock";
import { NextdoorHeroMascotStack } from "@/components/nextdoor/NextdoorHeroMascotStack";
import { NextdoorIdentityForm } from "@/components/nextdoor/NextdoorIdentityForm";
import { NextdoorIntentRouter } from "@/components/nextdoor/NextdoorIntentRouter";
import { NextdoorNotMarketplacePanel } from "@/components/nextdoor/NextdoorNotMarketplacePanel";
import { NextdoorQuoteLeverageLoop } from "@/components/nextdoor/NextdoorQuoteLeverageLoop";
import { NextdoorReveal } from "@/components/nextdoor/NextdoorReveal";
import { NextdoorWhatGetsMissed } from "@/components/nextdoor/NextdoorWhatGetsMissed";
import { NextdoorJourneyTimeline } from "@/components/nextdoor/NextdoorJourneyTimeline";
import { NextdoorTrustStrip } from "@/components/nextdoor/NextdoorTrustStrip";
import { NextdoorScanTransition } from "@/components/nextdoor/NextdoorScanTransition";
import { QuoteScanFieldBackground } from "@/components/QuoteScanFieldBackground";
import { NextdoorPageBackground } from "@/components/nextdoor/NextdoorPageBackground";
import {
  nextdoorPrimaryCtaClass,
  prefersReducedMotion,
  scrollToElementAfterDelay,
} from "@/components/nextdoor/nextdoorUi";
import { NextdoorProtectionLedger } from "@/components/nextdoor/NextdoorProtectionLedger";
import {
  NextdoorPrepPanel,
  NextdoorQuoteReadyPanel,
} from "@/components/nextdoor/NextdoorPrepPanel";
import { NextdoorPathSummary } from "@/components/nextdoor/NextdoorPathSummary";
import type {
  NextdoorIdentityFields,
  NextdoorLeadPayload,
  NextdoorPrefilledFields,
  NextdoorTrackCContact,
  NextdoorTrackCQualification,
  NextdoorTrafficMode,
  QuoteReadiness,
} from "@/components/nextdoor/types";
import {
  buildAttributionHandoffUrl,
  buildLocalNextdoorPayload,
  captureNextdoorAttributionOnMount,
  deriveNextdoorTrafficMode,
  isValidEmail,
  isValidFirstName,
  logLocalPayloadDevSummary,
  parseNextdoorUrlPrefill,
  resolveWmIntentFromReadiness,
} from "@/lib/nextdoor/attributionHelpers";
import {
  deriveAreaContext,
  mockCardAreaSubtitle,
  PAGE_META_DESCRIPTION,
  PAGE_TITLE,
  TRUST_PILL_LABELS,
} from "@/lib/nextdoor/areaContext";
import {
  getOrCreateNextdoorSessionId,
  isValidNextdoorSessionId,
} from "@/lib/nextdoor/nextdoorSession";
import {
  leadSuccessMessage,
  resolveNextRoute,
  saveCtaLabel as resolveSaveCtaLabel,
} from "@/lib/nextdoor/pathRouter";
import { submitNextdoorLead } from "@/services/nextdoorLeadCapture";
import { getUtmData } from "@/lib/useUtmCapture";
import { useScanFunnelSafe } from "@/state/scanFunnel";
import { useScanPolling, type ScanStatus } from "@/hooks/useScanPolling";
import { toE164 } from "@/utils/formatPhone";

const INTAKE_HEADLINE = "Check your impact-window quote before you sign.";

const INTAKE_SUBHEAD =
  "Already have a quote? Scan it now. Still shopping? Get prepared. Private review — not a contractor.";

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

type PendingScanTransition = {
  fileName: string;
  scanSessionId: string;
};

type NextdoorScanTerminalState = {
  status: ScanStatus;
  fileName?: string;
};

const SCAN_TRANSITION_DELAY_MS = 3200;
const SCAN_TRANSITION_REDUCED_DELAY_MS = 900;

const NEXTDOOR_NON_PREVIEW_TERMINAL_STATUSES = new Set<ScanStatus>([
  "invalid_document",
  "needs_better_upload",
  "failed",
  "error",
  "unreadable",
]);

const NEXTDOOR_TERMINAL_COPY: Record<string, { title: string; body: string }> = {
  invalid_document: {
    title: "Not a valid window quote",
    body: "This does not appear to be a valid window estimate or quote.",
  },
  needs_better_upload: {
    title: "We need a clearer file",
    body: "We could not read enough quote details from this file. Please upload a clearer window estimate, proposal, PDF, screenshot, or photo.",
  },
  failed: {
    title: "Scan failed",
    body: "Something went wrong while analyzing your file. Please try uploading again.",
  },
  error: {
    title: "Scan error",
    body: "Something went wrong while analyzing your file. Please try uploading again.",
  },
  unreadable: {
    title: "File unreadable",
    body: "We could not read enough quote details from this file. Please upload a clearer window estimate, proposal, PDF, screenshot, or photo.",
  },
};

const TRACK_B_SUCCESS_MESSAGE =
  "Your place is saved. Copy the private return link below, then upload from the device that has your quote when you're ready.";

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

export default function NextdoorHome() {
  const navigate = useNavigate();
  const funnel = useScanFunnelSafe();
  const initialUrlState = useMemo(() => readInitialUrlState(), []);
  const nextdoorSessionId = useMemo(() => getOrCreateNextdoorSessionId(), []);
  const leadSubmitInFlightRef = useRef(false);
  const scanNavigationStartedRef = useRef(false);
  const readinessRef = useRef<HTMLElement>(null);
  const nextStepPanelRef = useRef<HTMLElement>(null);
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
  const [trackBLeadSaved, setTrackBLeadSaved] = useState(false);
  const [trackBSubmitting, setTrackBSubmitting] = useState(false);
  const [trackBSubmitError, setTrackBSubmitError] = useState<string | null>(null);
  const trackCContactRef = useRef<NextdoorTrackCContact | null>(null);
  const [trackCContactSaved, setTrackCContactSaved] = useState(false);
  const [trackCCompleted, setTrackCCompleted] = useState(false);
  const [trackCContactSubmitting, setTrackCContactSubmitting] = useState(false);
  const [trackCQualifying, setTrackCQualifying] = useState(false);
  const [trackCError, setTrackCError] = useState<string | null>(null);
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadSubmitError, setLeadSubmitError] = useState<string | null>(null);
  const [localPayload, setLocalPayload] = useState<NextdoorLeadPayload | null>(null);
  const [showChecklist, setShowChecklist] = useState(
    initialUrlState.quoteReadiness === "researching",
  );
  const [pendingScan, setPendingScan] = useState<PendingScanTransition | null>(null);
  const [scanTerminalState, setScanTerminalState] = useState<NextdoorScanTerminalState | null>(null);
  const [scanTransitionError, setScanTransitionError] = useState<string | null>(null);
  const [scanReducedMotion, setScanReducedMotion] = useState(false);
  const [transitionMinElapsed, setTransitionMinElapsed] = useState(false);

  const { status: polledScanStatus } = useScanPolling({
    scanSessionId: pendingScan?.scanSessionId ?? null,
  });

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
    if (trackBLeadSaved && readiness === "has_estimate") {
      overrides.utm_content = "quote_elsewhere";
    }

    return buildAttributionHandoffUrl("/nextdoor", overrides);
  }, [readiness, trackBLeadSaved]);

  const areaContext = useMemo(() => {
    const utm = getUtmData();
    return deriveAreaContext({
      zip: identity.zip,
      utmCampaign: utm.utm_campaign,
      utmSource: utm.utm_source,
    });
  }, [identity.zip]);

  const mockSubtitle = mockCardAreaSubtitle(areaContext);

  const scrollToReadiness = useCallback(() => {
    readinessRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const scrollToNextStepPanel = useCallback(() => {
    scrollToElementAfterDelay(nextStepPanelRef.current, 300);
  }, []);

  // Scroll to a conditionally-rendered element by id. Waits two frames so React
  // can commit the target section (Step 3 / upload zone) before we scroll.
  const scrollToIdSmooth = useCallback((id: string, fallback?: () => void) => {
    const run = () => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({
          behavior: prefersReducedMotion() ? "auto" : "smooth",
          block: "center",
        });
      } else {
        fallback?.();
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(run));
  }, []);

  const scrollToIdentity = useCallback(() => {
    scrollToElementAfterDelay(identityModuleRef.current, 300);
    window.setTimeout(() => {
      const firstInput = identityModuleRef.current?.querySelector<HTMLElement>(
        "input:not([type='hidden'])",
      );
      firstInput?.focus({ preventScroll: true });
    }, 350);
  }, []);

  const scrollToIdentityOrStep2 = useCallback(() => {
    if (trackBLeadSaved && readiness === "has_estimate") {
      scrollToNextStepPanel();
      return;
    }
    scrollToIdentity();
  }, [readiness, scrollToIdentity, scrollToNextStepPanel, trackBLeadSaved]);

  const handleUploadScanStart = useCallback((fileName: string, scanSessionId: string) => {
    if (scanNavigationStartedRef.current || pendingScan) return;

    if (!isValidNextdoorSessionId(scanSessionId)) {
      setScanTransitionError("We couldn't open the report preview yet. Please try again.");
      return;
    }

    setScanTransitionError(null);
    setScanTerminalState(null);
    setTransitionMinElapsed(false);
    scanNavigationStartedRef.current = false;
    setScanReducedMotion(prefersReducedMotion());
    setPendingScan({ fileName, scanSessionId });
  }, [pendingScan]);

  const handleDismissScanTerminal = useCallback(() => {
    setScanTerminalState(null);
    setPendingScan(null);
    setTransitionMinElapsed(false);
    scanNavigationStartedRef.current = false;
  }, []);

  useEffect(() => {
    if (!pendingScan) {
      setTransitionMinElapsed(false);
      return;
    }

    const delayMs = scanReducedMotion
      ? SCAN_TRANSITION_REDUCED_DELAY_MS
      : SCAN_TRANSITION_DELAY_MS;

    const timer = window.setTimeout(() => {
      setTransitionMinElapsed(true);
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [pendingScan, scanReducedMotion]);

  useEffect(() => {
    if (!pendingScan || scanNavigationStartedRef.current) return;

    if (NEXTDOOR_NON_PREVIEW_TERMINAL_STATUSES.has(polledScanStatus)) {
      setPendingScan(null);
      setTransitionMinElapsed(false);
      setScanTerminalState({
        status: polledScanStatus,
        fileName: pendingScan.fileName,
      });
      return;
    }

    if (
      !transitionMinElapsed ||
      (polledScanStatus !== "preview_ready" && polledScanStatus !== "complete")
    ) {
      return;
    }

    if (!isValidNextdoorSessionId(pendingScan.scanSessionId)) {
      setScanTransitionError("We couldn't open the report preview yet. Please try again.");
      setPendingScan(null);
      return;
    }

    scanNavigationStartedRef.current = true;
    navigate(`/report/classic/${pendingScan.scanSessionId}`);
  }, [pendingScan, polledScanStatus, transitionMinElapsed, navigate]);

  const persistLead = useCallback(
    async (params: {
      firstName: string;
      email: string;
      zip?: string | null;
      phoneE164?: string | null;
      quoteReadiness: QuoteReadiness;
      extraQueryParams?: Record<string, string>;
    }) => {
      const utm = getUtmData();
      const wmIntent = resolveWmIntentFromReadiness(params.quoteReadiness, utm.wm_intent);

      return submitNextdoorLead({
        sessionId: nextdoorSessionId,
        firstName: params.firstName,
        email: params.email,
        zip: params.zip ?? null,
        phoneE164: params.phoneE164 ?? null,
        lastName: lastName || undefined,
        quoteReadiness: params.quoteReadiness,
        nextRoute: resolveNextRoute(params.quoteReadiness),
        wmIntent,
        extraQueryParams: params.extraQueryParams,
      });
    },
    [lastName, nextdoorSessionId],
  );

  const handleReadinessSelect = useCallback(
    (value: QuoteReadiness) => {
      setReadiness(value);
      setShowChecklist(value !== "has_estimate");
      setTrackBLeadSaved(false);
      setTrackBSubmitError(null);
      setIdentitySubmitted(false);
      setLeadSubmitting(false);
      setLeadSubmitError(null);
      setLocalPayload(null);
      // Track A: one click should land the user on the identity form (Step 3),
      // not a secondary scroll lobby. Other tracks keep the next-step panel.
      if (value === "has_estimate") {
        scrollToIdSmooth("identity-module", scrollToNextStepPanel);
      } else {
        scrollToNextStepPanel();
      }
    },
    [scrollToIdSmooth, scrollToNextStepPanel],
  );

  const handleIdentityChange = useCallback(
    (field: keyof NextdoorIdentityFields, value: string) => {
      setIdentity((prev) => ({ ...prev, [field]: value }));
      setIdentitySubmitted(false);
      setLeadSubmitError(null);
      setLocalPayload(null);
    },
    [],
  );

  const handleIdentitySubmit = useCallback(async () => {
    if (!readiness || leadSubmitInFlightRef.current) return;

    const payload = buildLocalNextdoorPayload({
      firstName: identity.firstName,
      lastName,
      email: identity.email,
      zip: identity.zip,
      quoteReadiness: readiness,
      trafficMode,
    });

    leadSubmitInFlightRef.current = true;
    setLeadSubmitting(true);
    setLeadSubmitError(null);

    const result = await persistLead({
      firstName: identity.firstName,
      email: identity.email,
      zip: identity.zip,
      quoteReadiness: readiness,
    });

    leadSubmitInFlightRef.current = false;
    setLeadSubmitting(false);

    if (!result.ok) {
      setLeadSubmitError(result.message);
      return;
    }

    setLocalPayload(payload);
    logLocalPayloadDevSummary(payload);
    setIdentitySubmitted(true);

    if (readiness === "has_estimate") {
      funnel?.setSessionId(nextdoorSessionId);
      // Return to the now-unlocked upload zone (renders once identity is saved).
      scrollToIdSmooth("quote-ready-upload", scrollToNextStepPanel);
    }
  }, [
    identity,
    lastName,
    readiness,
    trafficMode,
    funnel,
    nextdoorSessionId,
    persistLead,
    scrollToIdSmooth,
    scrollToNextStepPanel,
  ]);

  const handleTrackBLeadCapture = useCallback(
    async (data: {
      firstName: string;
      email: string;
      phone: string | null;
      zip: string | null;
    }) => {
      // Track B intentionally avoids handleReadinessSelect here because that helper resets identity/lead state.
      if (leadSubmitInFlightRef.current) return;
      if (!isValidFirstName(data.firstName) || !isValidEmail(data.email)) return;

      const phoneE164 = data.phone?.trim() ? toE164(data.phone.trim()) : null;

      setIdentity({
        firstName: data.firstName,
        email: data.email,
        zip: data.zip ?? "",
      });
      setTrackBSubmitError(null);

      leadSubmitInFlightRef.current = true;
      setTrackBSubmitting(true);

      const result = await persistLead({
        firstName: data.firstName,
        email: data.email,
        zip: data.zip,
        phoneE164,
        quoteReadiness: "has_estimate",
      });

      leadSubmitInFlightRef.current = false;
      setTrackBSubmitting(false);

      if (!result.ok) {
        setTrackBSubmitError(result.message);
        return;
      }

      const payload = buildLocalNextdoorPayload({
        firstName: data.firstName,
        lastName,
        email: data.email,
        zip: data.zip ?? "",
        quoteReadiness: "has_estimate",
        trafficMode,
      });

      setLocalPayload(payload);
      logLocalPayloadDevSummary(payload);
      setTrackBLeadSaved(true);
      setReadiness("has_estimate");
      setShowChecklist(false);
      setIdentitySubmitted(true);
      funnel?.setSessionId(nextdoorSessionId);
      scrollToNextStepPanel();
    },
    [lastName, trafficMode, funnel, nextdoorSessionId, persistLead, scrollToNextStepPanel],
  );

  // Track C — Step 1: save real contact lead immediately (protects against
  // Step 1 abandonment). No onReadinessSelect → no downstream prep/identity panels.
  const handleTrackCContactSave = useCallback(
    async (contact: NextdoorTrackCContact) => {
      if (leadSubmitInFlightRef.current) return;
      if (!isValidFirstName(contact.firstName) || !isValidEmail(contact.email)) return;

      const phoneE164 = contact.phone.trim() ? toE164(contact.phone.trim()) : null;

      leadSubmitInFlightRef.current = true;
      setTrackCContactSubmitting(true);
      setTrackCError(null);

      const result = await persistLead({
        firstName: contact.firstName,
        email: contact.email,
        zip: contact.zip,
        phoneE164,
        // Safe no-quote readiness for the contact-save pass. The durable final
        // qualification lives in query_params.timeline, not in this value.
        quoteReadiness: "researching",
        extraQueryParams: { track_c_contact_saved: "true" },
      });

      leadSubmitInFlightRef.current = false;
      setTrackCContactSubmitting(false);

      if (!result.ok) {
        setTrackCError(result.message);
        return;
      }

      trackCContactRef.current = contact;
      setTrackCContactSaved(true);
    },
    [persistLead],
  );

  // Track C — Step 2: enrich the same lead/session with qualification answers.
  // These ride in query_params; the Edge merge is per-key non-destructive, so
  // distinct keys (window_type/opening_count_bucket/timeline) are ADDED, never
  // overwriting the Step 1 keys.
  const handleTrackCQualificationSave = useCallback(
    async (qualification: NextdoorTrackCQualification) => {
      if (leadSubmitInFlightRef.current) return;
      const contact = trackCContactRef.current;
      if (!contact) {
        setTrackCError("We couldn't save this yet. Check your details and try again.");
        return;
      }

      const readinessForTimeline: Record<NextdoorTrackCQualification["timeline"], QuoteReadiness> = {
        asap: "getting_quotes_now",
        "1_3_months": "need_quote_soon",
        researching: "researching",
      };

      const phoneE164 = contact.phone.trim() ? toE164(contact.phone.trim()) : null;

      leadSubmitInFlightRef.current = true;
      setTrackCQualifying(true);
      setTrackCError(null);

      const result = await persistLead({
        firstName: contact.firstName,
        email: contact.email,
        zip: contact.zip,
        phoneE164,
        quoteReadiness: readinessForTimeline[qualification.timeline],
        extraQueryParams: {
          window_type: qualification.windowType,
          opening_count_bucket: qualification.openingCountBucket,
          timeline: qualification.timeline,
          track_c_qualified: "true",
        },
      });

      leadSubmitInFlightRef.current = false;
      setTrackCQualifying(false);

      if (!result.ok) {
        setTrackCError(result.message);
        return;
      }

      if (import.meta.env.DEV && result.reused === false) {
        console.info("[nextdoor] Track C qualification stored on fresh lead", {
          session_id: nextdoorSessionId,
        });
      }

      setTrackCCompleted(true);
    },
    [persistLead, nextdoorSessionId],
  );

  const showNextStepPanel = readiness !== null;
  const showIdentityModule =
    readiness !== null && !(trackBLeadSaved && readiness === "has_estimate");
  const identitySaveLabel = resolveSaveCtaLabel(readiness);
  const identitySuccessMessage =
    readiness && identitySubmitted && !trackBLeadSaved
      ? leadSuccessMessage(readiness)
      : null;

  const trafficLabel = trafficModeLabel(trafficMode);

  return (
    <>
      <Helmet>
        <title>{PAGE_TITLE}</title>
        <meta name="description" content={PAGE_META_DESCRIPTION} />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="relative min-h-screen overflow-x-hidden bg-[hsl(214_38%_97%)] text-slate-900">
        <NextdoorPageBackground />

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

          <section
            ref={readinessRef}
            id="readiness-selector"
            className="relative mb-10 scroll-mt-28 md:mb-12"
            aria-labelledby="readiness-heading"
          >
            <QuoteScanFieldBackground variant="hero" />
            <div className="relative z-10">
            <div className="md:hidden">
              <p className="font-display text-xl font-extrabold leading-snug text-slate-900">
                {INTAKE_HEADLINE}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{INTAKE_SUBHEAD}</p>
              <div className="mt-6 flex justify-center">
                <NextdoorHeroMascotStack subtitle={mockSubtitle} />
              </div>
            </div>

            <div className="mb-8 hidden md:block">
              <h1 className="font-display text-[2rem] font-extrabold leading-[1.12] tracking-tight text-slate-900 lg:text-[2.25rem]">
                {INTAKE_HEADLINE}
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-relaxed text-slate-600 lg:text-lg">
                {INTAKE_SUBHEAD}
              </p>
            </div>

            <div className="mt-6 grid items-start gap-8 md:mt-0 md:grid-cols-[1.05fr_0.95fr] md:gap-10 lg:gap-12">
              <NextdoorReveal className="order-2 md:order-1">
                <div className="mt-0">
                  <NextdoorIntentRouter
                    selected={readiness}
                    onReadinessSelect={handleReadinessSelect}
                    onLeadCaptureSubmit={handleTrackBLeadCapture}
                    leadCaptureSubmitting={trackBSubmitting}
                    leadCaptureError={trackBSubmitError}
                    trackBLeadSaved={trackBLeadSaved}
                    prefillIdentity={identity}
                    onTrackCSaveContact={handleTrackCContactSave}
                    onTrackCSaveQualification={handleTrackCQualificationSave}
                    trackCContactSaved={trackCContactSaved}
                    trackCCompleted={trackCCompleted}
                    trackCContactSubmitting={trackCContactSubmitting}
                    trackCQualifying={trackCQualifying}
                    trackCError={trackCError}
                  />
                </div>
                {readiness ? (
                  <div className="mt-5">
                    <NextdoorPathSummary readiness={readiness} />
                  </div>
                ) : null}
              </NextdoorReveal>

              <NextdoorReveal className="order-1 hidden md:order-2 md:block" delayMs={80}>
                <NextdoorHeroMascotStack subtitle={mockSubtitle} priority />
              </NextdoorReveal>
            </div>
            </div>
          </section>

          {showNextStepPanel && readiness ? (
            <section
              ref={nextStepPanelRef}
              id="next-step-panel"
              className="mb-10 scroll-mt-28 md:mb-12"
              aria-labelledby="next-step-heading"
            >
              <p className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {readiness === "has_estimate"
                  ? identitySubmitted
                    ? "Step 2 · Upload your quote"
                    : "Step 2 · Save details first"
                  : "Step 2 · Your next step"}
                {identitySubmitted && readiness !== "has_estimate" ? " · Saved" : null}
                {identitySubmitted && readiness === "has_estimate" ? " · Details saved" : null}
              </p>
              <h2 id="next-step-heading" className="sr-only">
                Your next step
              </h2>
              {trackBLeadSaved && readiness === "has_estimate" ? (
                <p
                  className="mb-4 rounded-lg border border-emerald-500/25 bg-emerald-50/60 px-4 py-3 text-sm leading-relaxed text-emerald-900"
                  role="status"
                >
                  {TRACK_B_SUCCESS_MESSAGE}
                </p>
              ) : null}
              {isQuoteReady(readiness) ? (
                <>
                  <NextdoorQuoteReadyPanel
                    identitySubmitted={identitySubmitted}
                    sessionId={nextdoorSessionId}
                    attributionSaveUrl={attributionSaveUrl}
                    onScrollToIdentity={scrollToIdentityOrStep2}
                    onScanStart={handleUploadScanStart}
                  />
                  {scanTransitionError ? (
                    <p
                      className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950"
                      role="alert"
                    >
                      {scanTransitionError}
                    </p>
                  ) : null}
                </>
              ) : isPrepPath(readiness) ? (
                <NextdoorPrepPanel
                  readiness={readiness}
                  showChecklist={showChecklist}
                  onShowChecklist={() => setShowChecklist(true)}
                  onScrollToIdentity={scrollToIdentityOrStep2}
                  primary={isResearching}
                  attributionSaveUrl={attributionSaveUrl}
                />
              ) : null}
            </section>
          ) : null}

          <NextdoorReveal className="mb-10 md:mb-12">
            <NextdoorTrustStrip />
          </NextdoorReveal>

          <NextdoorReveal className="mb-10 md:mb-12">
            <NextdoorQuoteLeverageLoop />
          </NextdoorReveal>

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
                  ? "Step 3 · Optional save"
                  : readiness === "has_estimate"
                    ? "Step 3 · Save your details"
                    : "Step 3 · Save your checklist"}
              </p>
              <NextdoorIdentityForm
                values={identity}
                prefilled={prefilled}
                onChange={handleIdentityChange}
                onSubmit={handleIdentitySubmit}
                submitted={identitySubmitted}
                submitting={leadSubmitting}
                submitError={leadSubmitError}
                successMessage={identitySuccessMessage}
                optional={isResearching}
                readinessSelected={readiness !== null}
                areaContext={areaContext}
                saveCtaLabel={identitySaveLabel}
                variant={readiness === "has_estimate" ? "quote_ready" : "default"}
              />
            </section>
          ) : null}

          <NextdoorReveal className="mb-12 md:mb-14">
            <NextdoorWhatGetsMissed />
          </NextdoorReveal>

          <NextdoorReveal className="mb-12 md:mb-14">
            <img
              src="/images/nextdoor-scan.avif"
              alt="Before and after: a messy handwritten window quote transformed into a structured WindowMan quote check"
              loading="lazy"
              decoding="async"
              className="mx-auto block h-auto max-w-full rounded-2xl shadow-[0_28px_90px_-45px_rgba(8,47,73,0.45)]"
            />
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
                {readiness === "has_estimate"
                  ? "Back to quote options"
                  : resolveSaveCtaLabel(readiness)}
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

        {pendingScan ? (
          <NextdoorScanTransition
            fileName={pendingScan.fileName}
            reducedMotion={scanReducedMotion}
          />
        ) : null}

        {scanTerminalState ? (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-8"
            role="alertdialog"
            aria-labelledby="nextdoor-scan-terminal-title"
            aria-describedby="nextdoor-scan-terminal-body"
          >
            <div className="absolute inset-0 bg-slate-950/72 backdrop-blur-sm" aria-hidden="true" />
            <div className="relative w-full max-w-lg rounded-2xl border border-amber-500/35 bg-white p-6 shadow-xl md:p-8">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-800">
                Upload not accepted
              </p>
              <h2
                id="nextdoor-scan-terminal-title"
                className="mt-2 font-display text-xl font-extrabold text-slate-900"
              >
                {NEXTDOOR_TERMINAL_COPY[scanTerminalState.status]?.title ?? "Upload not accepted"}
              </h2>
              <p
                id="nextdoor-scan-terminal-body"
                className="mt-3 text-sm leading-relaxed text-slate-600"
              >
                {NEXTDOOR_TERMINAL_COPY[scanTerminalState.status]?.body ??
                  "This does not appear to be a valid window estimate or quote."}
              </p>
              {scanTerminalState.fileName ? (
                <p className="mt-4 truncate font-mono text-xs text-slate-500">
                  File: {scanTerminalState.fileName}
                </p>
              ) : null}
              <button
                type="button"
                onClick={handleDismissScanTerminal}
                className={[nextdoorPrimaryCtaClass, "mt-6 w-full sm:w-auto"].join(" ")}
              >
                Upload another file
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
