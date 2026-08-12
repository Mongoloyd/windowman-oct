import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { trackGtmEvent } from '@/lib/trackConversion';
import { trackEvent } from '@/lib/trackEvent';
import { supabase } from '@/integrations/supabase/client';
import {
  readReportDiagnosisHandoff,
  saveReportDiagnosisHandoff,
  type ReportDiagnosisHandoff,
} from '@/lib/reportDiagnosisHandoff';

import { DIAGNOSTIC_MAP } from '../constants/diagnosticMap';
import { CLARIFIER_PREFIX } from '../constants/preSalesQuestions';
import { generateConditionalStatement } from '../constants/branchChips';
import type { DiagnosisCode, DiagnosticContext, StepId } from '../types';

/**
 * Hydration status for the diagnosis intake.
 *  - pending: initial synchronous seed check (transient)
 *  - ready: a usable Truth Report handoff seed (scan_session_id + report_grade)
 *           was found. Router state + session storage are display/navigation
 *           seeds ONLY — never authorization. The canonical lead_id is resolved
 *           privately server-side by submit-diagnosis-intake, so the browser
 *           renders the questionnaire even when the cached lead_id is empty.
 *  - failed: no usable seed at all — render the "start from your report" state
 *  - error:  reserved safe operational-failure UI (retained for the render
 *            path; not emitted by the current synchronous seed hydration)
 *  - invalid: reserved safe invalid-context UI for genuinely malformed handoffs
 *             (retained for the render path)
 */
export type HydrationStatus = 'pending' | 'ready' | 'failed' | 'error' | 'invalid';

interface DiagnosisRouterState {
  lead_id?: string | null;
  scan_session_id?: string | null;
  report_grade?: string | null;
  first_name?: string | null;
  phone?: string | null;
  email?: string | null;
  top_insights?: string[] | null;
  returnTo?: string | null;
  /** Optional: passed when caller already knows the analysis id */
  analysis_id?: string | null;
}

function isUsableDiagnosisState(value: DiagnosisRouterState | ReportDiagnosisHandoff | null): value is DiagnosisRouterState | ReportDiagnosisHandoff {
  return !!value?.scan_session_id && !!value?.report_grade;
}

function buildContextFromHandoff(value: DiagnosisRouterState | ReportDiagnosisHandoff): DiagnosticContext {
  return {
    lead_id: value.lead_id ?? '',
    scan_session_id: value.scan_session_id ?? '',
    report_grade: value.report_grade ?? '',
    top_insights: Array.isArray(value.top_insights) ? value.top_insights.slice(0, 3) : [],
    first_name: value.first_name ?? '',
    phone: value.phone ?? '',
    email: value.email ?? '',
  };
}

const EMPTY_CONTEXT: DiagnosticContext = {
  lead_id: '',
  scan_session_id: '',
  report_grade: '',
  top_insights: [],
  first_name: '',
  phone: '',
  email: '',
};

/**
 * Pull a cookie value by name (browser-only). Returns null when not present
 * or when running outside a browser context.
 */
function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
}

/**
 * Build a minimal attribution snapshot from values that ALREADY exist in the
 * browser. We do NOT introduce a new attribution architecture here — this
 * just packages whatever the page already has so the diagnosis row can be
 * joined back to a campaign later.
 */
function buildAttributionSnapshot(): Record<string, string> {
  const snap: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const utmKeys = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
    ];
    for (const k of utmKeys) {
      const v = params.get(k);
      if (v) snap[k] = v;
    }
    const clickIds = ['gclid', 'gbraid', 'wbraid', 'msclkid'];
    for (const k of clickIds) {
      const v = params.get(k);
      if (v) snap[k] = v;
    }
  }
  const fbp = readCookie('_fbp');
  if (fbp) snap.fbp = fbp;
  const fbc = readCookie('_fbc');
  if (fbc) snap.fbc = fbc;
  return snap;
}

export function useDiagnosticIntake() {
  const location = useLocation();
  const navigate = useNavigate();
  const incomingState = (location.state ?? null) as DiagnosisRouterState | null;

  const [step, setStep] = useState<StepId>('intake');
  const [primaryDiagnosis, setPrimaryDiagnosis] = useState<DiagnosisCode | null>(null);
  const [secondaryClarifiers, setSecondaryClarifiers] = useState<string[]>([]);
  const [otherFreeText, setOtherFreeText] = useState('');
  const [windowStyles, setWindowStyles] = useState<string[]>([]);
  const [windowConcerns, setWindowConcerns] = useState<string[]>([]);
  const [frameMaterial, setFrameMaterial] = useState('');
  const [contractorContext, setContractorContext] = useState<string[]>([]);
  const [desiredNextMove, setDesiredNextMove] = useState<string[]>([]);

  // Counter-offer state (Step 3)
  const [counterOfferTerms, setCounterOfferTerms] = useState<string[]>([]);
  const [counterOfferFreeText, setCounterOfferFreeText] = useState('');

  const [context, setContext] = useState<DiagnosticContext>(EMPTY_CONTEXT);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [hydrationStatus, setHydrationStatus] = useState<HydrationStatus>('pending');
  // returnTo is preserved separately so it survives refresh-driven recovery.
  const [returnTo, setReturnTo] = useState<string | null>(null);
  // Bumped by "Try Again" to re-run canonical recovery for the same session.
  const [retryToken, setRetryToken] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const pageTopRef = useRef<HTMLDivElement>(null);

  // Hard synchronous double-submit lock (React state is async and does not
  // block two fast clicks before the first re-render).
  const submitLockRef = useRef(false);
  const diagnosisSubmissionIdRef = useRef<string>(crypto.randomUUID());

  // ── Hydration ────────────────────────────────────────────────────────────
  // Router state + session storage are display/navigation SEEDS ONLY — never
  // authorization. The browser must NOT fetch the canonical lead_id: that value
  // lives behind a service-role-only RPC (get_lead_context_for_session) and is
  // resolved privately inside submit-diagnosis-intake from the scan_session_id.
  // A valid Truth Report handoff (scan_session_id + report_grade) therefore
  // renders the questionnaire immediately, even when the cached lead_id is empty
  // (ReportClassic emits lead_id="").
  useEffect(() => {
    // 1. Choose a seed: router state (preferred) → durable session handoff.
    let seed: DiagnosisRouterState | ReportDiagnosisHandoff | null = null;
    let seedFrom: 'router' | 'session' | null = null;

    if (isUsableDiagnosisState(incomingState)) {
      seed = incomingState;
      seedFrom = 'router';
    } else {
      const savedHandoff = readReportDiagnosisHandoff();
      if (savedHandoff) {
        seed = savedHandoff;
        seedFrom = 'session';
      }
    }

    // 2. No usable seed at all → safe "start from your report" state.
    //    (report_grade is required by isUsableDiagnosisState / the handoff
    //    validator, so malformed handoffs also land here rather than rendering.)
    if (!seed || !seed.scan_session_id || !seed.report_grade) {
      setHydrationStatus('failed');
      return;
    }

    const seedCtx = buildContextFromHandoff(seed);
    const scanSessionId = seedCtx.scan_session_id;
    const seedAnalysisId =
      'analysis_id' in seed ? seed.analysis_id ?? null : null;
    const resolvedReturnTo = seed.returnTo || `/report/classic/${scanSessionId}`;

    setContext(seedCtx);
    setAnalysisId(seedAnalysisId);
    setReturnTo(resolvedReturnTo);

    // Re-persist the seed so a refresh recovers display/navigation context.
    // lead_id is intentionally left as the (possibly empty) seed value — the
    // browser never resolves the canonical lead_id; the Edge Function does.
    saveReportDiagnosisHandoff({
      lead_id: seedCtx.lead_id || null,
      scan_session_id: seedCtx.scan_session_id,
      analysis_id: seedAnalysisId,
      report_grade: seedCtx.report_grade,
      first_name: seedCtx.first_name || null,
      phone: seedCtx.phone || null,
      email: seedCtx.email || null,
      top_insights: seedCtx.top_insights,
      returnTo: resolvedReturnTo,
      saved_at: new Date().toISOString(),
    });

    trackGtmEvent(
      seedFrom === 'router'
        ? 'diagnosis_hydrated_from_router_state'
        : 'diagnosis_hydrated_from_session',
      {
        scan_session_id: seedCtx.scan_session_id,
        grade: seedCtx.report_grade,
        top_insight_count: seedCtx.top_insights.length,
      },
    );

    setHydrationStatus('ready');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate on mount + explicit retry
  }, [retryToken]);

  /** Re-run canonical recovery for the same session (transient-error retry). */
  const retryHydration = useCallback(() => {
    setHydrationStatus('pending');
    setRetryToken((n) => n + 1);
  }, []);

  const scrollToTop = useCallback(() => {
    pageTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const activeConfig = primaryDiagnosis ? DIAGNOSTIC_MAP[primaryDiagnosis] : null;

  const confidence = Math.min(
    0.95,
    0.6 +
      secondaryClarifiers.length * 0.05 +
      windowConcerns.length * 0.02 +
      (windowStyles.length > 0 ? 0.05 : 0) +
      (frameMaterial ? 0.05 : 0) +
      contractorContext.length * 0.02 +
      desiredNextMove.length * 0.02 +
      (otherFreeText.length > 20 ? 0.15 : 0)
  );

  const progressRailStep =
    step === 'intake' || step === 'diagnosis'
      ? 3
      : step === 'prescription'
        ? 4
        : step === 'success'
          ? 5
          : 3;

  const toggleInArray = (
    arr: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    value: string
  ) => {
    setter(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  };

  const selectPrimaryDiagnosis = (code: DiagnosisCode) => {
    setPrimaryDiagnosis(code);
    setSecondaryClarifiers([]);
    setOtherFreeText('');
    setWindowStyles([]);
    setWindowConcerns([]);
    setFrameMaterial('');
    setContractorContext([]);
    setDesiredNextMove([]);

    // Internal step-level event (browser only — not an ad-platform conversion).
    trackGtmEvent('diagnosis_primary_selected', {
      lead_id: context.lead_id,
      scan_session_id: context.scan_session_id,
      diagnosis: code,
    });

    trackGtmEvent('diagnosis_root_option_selected', {
      selected_code: code,
      grade: context.report_grade,
    });

    setStep('diagnosis');
    scrollToTop();
  };

  const advanceToPrescription = () => {
    if (!primaryDiagnosis) return;

    trackGtmEvent('diagnosis_step_1_completed', {
      lead_id: context.lead_id,
      scan_session_id: context.scan_session_id,
      diagnosis: primaryDiagnosis,
      secondary_clarifiers: secondaryClarifiers,
      window_styles: windowStyles,
      window_concerns: windowConcerns,
      frame_material: frameMaterial || null,
      other_text_length: otherFreeText.length,
      confidence,
      prescription_path: DIAGNOSTIC_MAP[primaryDiagnosis].prescriptionPath,
    });

    setStep('prescription');
    scrollToTop();
  };

  const handleBack = () => {
    if (step === 'diagnosis') {
      setStep('intake');
      setPrimaryDiagnosis(null);
      setSecondaryClarifiers([]);
      setOtherFreeText('');
      setWindowStyles([]);
      setWindowConcerns([]);
      setFrameMaterial('');
      setContractorContext([]);
      setDesiredNextMove([]);
    } else if (step === 'prescription') {
      setStep('diagnosis');
    }
    scrollToTop();
  };

  /**
   * Back-to-Report navigation.
   * Order:
   *   1. returnTo (router-state-supplied)
   *   2. /report/classic/:scan_session_id (canonical reconstruction)
   *   3. "/" (final fallback)
   * Browser history is intentionally NOT used — users may have navigated
   * around other pages first.
   */
  const handleReturnToReport = useCallback(() => {
    if (returnTo) {
      navigate(returnTo);
      return;
    }
    if (context.scan_session_id) {
      navigate(`/report/classic/${context.scan_session_id}`);
      return;
    }
    navigate('/');
  }, [navigate, returnTo, context.scan_session_id]);

  // Counter-offer readiness — CTA gates on at least one amber chip
  const hasCounterOffer = counterOfferTerms.length > 0;

  const canAdvanceFromDiagnosis =
    primaryDiagnosis === 'other'
      ? otherFreeText.trim().length >= 10
      : secondaryClarifiers.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Hard synchronous double-submit lock: two fast clicks before the first
    // re-render must produce exactly ONE edge-function call.
    if (submitLockRef.current) return;
    if (!primaryDiagnosis || !hasCounterOffer) return;

    // A new deliberate submit begins — clear any prior inline error.
    setSubmitError(null);

    // Final client guard: a valid scan_session_id is required. The canonical
    // lead_id is NOT required in the browser — submit-diagnosis-intake derives
    // it authoritatively from scan_session_id using its service-role client.
    if (!context.scan_session_id) {
      const msg = 'Missing report context — please return to your report and try again.';
      console.warn('[Diagnosis] Submit blocked: missing scan_session_id.');
      setSubmitError(msg);
      toast.error(msg);
      return;
    }

    // Acquire the lock only once we are actually going to hit the network.
    submitLockRef.current = true;

    // Internal step-level event — fires only when final pre-submit validation
    // passes and a valid submit is actually being attempted. Browser-only;
    // not routed to ad platforms.
    trackGtmEvent('diagnosis_step_2_completed', {
      lead_id: context.lead_id,
      scan_session_id: context.scan_session_id,
      diagnosis: primaryDiagnosis,
      counter_offer_terms_count: counterOfferTerms.length,
      prescription_path: DIAGNOSTIC_MAP[primaryDiagnosis].prescriptionPath,
    });

    setIsSubmitting(true);

    const conditionalStatement = generateConditionalStatement(
      DIAGNOSTIC_MAP[primaryDiagnosis].label,
      counterOfferTerms
    );

    // Phase 1 semantic remap — payload keys unchanged; admin JSON labels may drift until Phase 2.
    // window_intelligence.concerns      → urgency / motivation (not product concerns)
    // window_intelligence.styles        → timeline (not window types)
    // window_intelligence.frame_material → decision authority (not frame material)
    // secondary_clarifiers.codes        → branch chips + Contractor: / Goal: prefixed items
    const remappedSecondaryCodes = [
      ...secondaryClarifiers,
      ...contractorContext.map((c) => `${CLARIFIER_PREFIX.contractor}${c}`),
      ...desiredNextMove.map((g) => `${CLARIFIER_PREFIX.goal}${g}`),
    ];

    // NOTE: lead_id is intentionally omitted from the browser request. The
    // Edge Function derives the canonical lead_id server-side from
    // scan_session_id; the browser must never send or rely on it.
    const payload = {
      scan_session_id: context.scan_session_id,
      diagnosis_submission_id: diagnosisSubmissionIdRef.current,
      analysis_id: analysisId,
      report_grade: context.report_grade || 'unknown',
      primary_diagnosis: primaryDiagnosis,
      secondary_clarifiers: {
        codes: remappedSecondaryCodes,
      },
      other_text: otherFreeText.trim() || null,
      window_intelligence: {
        styles: windowStyles,
        concerns: windowConcerns,
        frame_material: frameMaterial || null,
      },
      counter_offer: {
        terms_selected: counterOfferTerms,
        terms_free_text: counterOfferFreeText.trim() || null,
        conditional_close_statement: conditionalStatement,
      },
      top_insights_snapshot: { items: context.top_insights ?? [] },
      confidence: confidence.toFixed(2),
      prescription_path: DIAGNOSTIC_MAP[primaryDiagnosis].prescriptionPath,
      attribution_snapshot: buildAttributionSnapshot(),
    };

    try {
      const { data, error } = await supabase.functions.invoke('submit-diagnosis-intake', {
        body: payload,
      });

      const body = data && typeof data === 'object'
        ? (data as Record<string, unknown>)
        : null;
      const bodyError =
        body && typeof body.error === 'string' ? body.error : null;
      const eventId =
        body && typeof body.event_id === 'string' && body.event_id.trim().length > 0
          ? body.event_id.trim()
          : null;
      const voiceFollowupId =
        body && typeof body.voice_followup_id === 'string'
          ? body.voice_followup_id
          : null;
      const metaDispatchStatus =
        body &&
        (body.meta_dispatch_status === 'pending' ||
          body.meta_dispatch_status === 'suppressed')
          ? body.meta_dispatch_status
          : null;
      const voiceFollowupOk =
        !!voiceFollowupId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          voiceFollowupId,
        );

      if (error || !body?.success || !eventId || !voiceFollowupOk || !metaDispatchStatus) {
        const msg =
          bodyError ||
          'We could not save your diagnosis. Please try again.';
        console.error('[Diagnosis] submit failed:', error || data);
        setSubmitError(msg);
        toast.error(msg);
        setIsSubmitting(false);
        // Recoverable failure — release the lock so the user can retry with
        // all answers + their note preserved. diagnosis_submission_id is kept.
        submitLockRef.current = false;
        return;
      }

      // Paid-media conversion — only after the durable server boundary.
      trackGtmEvent('callback_requested', {
        event_id: eventId,
        scan_session_id: context.scan_session_id,
      });

      // Operational telemetry — questionnaire completion, not the conversion.
      trackEvent({
        event_name: 'diagnosis_completed',
        session_id: context.scan_session_id,
        metadata: {
          diagnosis_intake_id: body.diagnosis_intake_id ?? null,
          voice_followup_id: voiceFollowupId,
          event_id: eventId,
          meta_dispatch_status: metaDispatchStatus,
          primary_diagnosis: primaryDiagnosis,
        },
      });

      setIsSubmitting(false);
      setStep('success');
      scrollToTop();

      // Internal-only success-view event.
      trackGtmEvent('diagnosis_success_viewed', {
        lead_id: context.lead_id,
        scan_session_id: context.scan_session_id,
        diagnosis: primaryDiagnosis,
      });
    } catch (err) {
      console.error('[Diagnosis] submit threw:', err);
      const msg = 'Connection error. Please try again.';
      setSubmitError(msg);
      toast.error(msg);
      setIsSubmitting(false);
      // Recoverable failure — release the lock so the user can retry.
      submitLockRef.current = false;
    }
  };

  return {
    // State
    step,
    primaryDiagnosis,
    secondaryClarifiers,
    otherFreeText,
    windowStyles,
    windowConcerns,
    frameMaterial,
    contractorContext,
    desiredNextMove,
    counterOfferTerms,
    counterOfferFreeText,
    context,
    isSubmitting,
    submitError,
    hydrationStatus,
    returnTo,

    // Derived
    activeConfig,
    confidence,
    hasCounterOffer,
    canAdvanceFromDiagnosis,
    progressRailStep,

    // Refs
    pageTopRef,

    // Setters
    setSecondaryClarifiers,
    setOtherFreeText,
    setWindowStyles,
    setWindowConcerns,
    setFrameMaterial,
    setContractorContext,
    setDesiredNextMove,
    setCounterOfferTerms,
    setCounterOfferFreeText,

    // Handlers
    toggleInArray,
    selectPrimaryDiagnosis,
    advanceToPrescription,
    handleBack,
    handleSubmit,
    handleReturnToReport,
    retryHydration,
    scrollToTop,
  };
}
