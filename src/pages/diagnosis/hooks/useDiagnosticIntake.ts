import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { trackGtmEvent } from '@/lib/trackConversion';
import { trackEvent } from '@/lib/trackEvent';
import { supabase } from '@/integrations/supabase/client';
import {
  clearReportDiagnosisHandoff,
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
 *  - pending: initial check / server RPC lookup in flight
 *  - ready: canonical lead context confirmed by the server RPC for the active
 *           scan_session_id (router state + session storage are seeds only)
 *  - failed: no usable seed at all — render the "start from your report" state
 *  - error:  transient/operational RPC failure — questionnaire stays hidden,
 *            seed handoff preserved, user can retry or return to the report
 *  - invalid: RPC resolved but no lead is bound to the session — stale handoff
 *             cleared, durable invalid-context state, no questionnaire/submit
 */
export type HydrationStatus = 'pending' | 'ready' | 'failed' | 'error' | 'invalid';

/** Row shape returned by the get_lead_context_for_session security-definer RPC. */
interface LeadContextForSessionRow {
  lead_id: string | null;
  first_name: string | null;
  county: string | null;
  phone_e164: string | null;
}

/** Normalize an RPC return that may be an array (SETOF) or a single row. */
function firstRpcRow<T>(data: T[] | T | null | undefined): T | null {
  if (Array.isArray(data)) return data[0] ?? null;
  return data ?? null;
}

/**
 * Server-authoritative value wins when it is a non-empty string; otherwise the
 * existing seed value is preserved (never overwrite good seed data with null).
 */
function preferServer(serverValue: string | null | undefined, seedValue: string): string {
  const s = typeof serverValue === 'string' ? serverValue.trim() : '';
  return s || seedValue;
}

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
  // Async safety: the scan_session_id whose recovery is currently authoritative.
  // A stale/superseded/unmounted RPC response must not mutate active state.
  const activeRecoverySessionRef = useRef<string | null>(null);

  // Direct-await RPC accessor (mirrors the pattern used by PostScanReportSwitcher).
  const rpc = supabase.rpc as unknown as (
    fnName: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>;

  // ── Hydration ────────────────────────────────────────────────────────────
  // Router state + session storage are SEEDS ONLY. hydrationStatus becomes
  // 'ready' only after the server RPC resolves a non-empty canonical lead_id
  // bound to the active scan_session_id. This repairs the empty-lead_id case
  // (ReportClassic emits lead_id="") that previously reached the final CTA and
  // failed with "Missing report context".
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

    // 2. No usable seed at all → safe empty state (no session to recover from).
    if (!seed || !seed.scan_session_id) {
      setHydrationStatus('failed');
      return;
    }

    const seedCtx = buildContextFromHandoff(seed);
    const scanSessionId = seedCtx.scan_session_id;
    const seedAnalysisId =
      'analysis_id' in seed ? seed.analysis_id ?? null : null;
    const resolvedReturnTo = seed.returnTo || `/report/classic/${scanSessionId}`;

    // Seed context + returnTo immediately so error/invalid states can offer a
    // safe "Return to Report" path — but stay 'pending' (questionnaire hidden)
    // until the server confirms the canonical lead_id.
    setContext(seedCtx);
    setAnalysisId(seedAnalysisId);
    setReturnTo(resolvedReturnTo);
    setHydrationStatus('pending');

    activeRecoverySessionRef.current = scanSessionId;
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await rpc('get_lead_context_for_session', {
          p_scan_session_id: scanSessionId,
        });

        // Ignore stale/superseded/unmounted responses.
        if (cancelled || activeRecoverySessionRef.current !== scanSessionId) return;

        if (error) {
          // Transient/operational failure — keep the seed handoff, offer retry.
          console.warn('[Diagnosis] lead context RPC error (retryable):', error);
          setHydrationStatus('error');
          return;
        }

        const row = firstRpcRow<LeadContextForSessionRow>(
          data as LeadContextForSessionRow[] | LeadContextForSessionRow | null | undefined,
        );
        const serverLeadId =
          typeof row?.lead_id === 'string' ? row.lead_id.trim() : '';

        if (!row || !serverLeadId) {
          // No lead bound to this session → durable invalid-context state.
          clearReportDiagnosisHandoff();
          setHydrationStatus('invalid');
          return;
        }

        // Server lead_id is authoritative (repairs empty/mismatched seeds).
        // Merge display fields without overwriting good seed data with null.
        const canonicalCtx: DiagnosticContext = {
          ...seedCtx,
          lead_id: serverLeadId,
          first_name: preferServer(row.first_name, seedCtx.first_name),
          phone: preferServer(row.phone_e164, seedCtx.phone),
        };

        setContext(canonicalCtx);

        // Rewrite the corrected handoff back to session storage so a refresh
        // recovers the canonical lead_id (report grade/insights/analysis/email/
        // return path are all preserved from the seed).
        saveReportDiagnosisHandoff({
          lead_id: canonicalCtx.lead_id,
          scan_session_id: canonicalCtx.scan_session_id,
          analysis_id: seedAnalysisId,
          report_grade: canonicalCtx.report_grade,
          first_name: canonicalCtx.first_name || null,
          phone: canonicalCtx.phone || null,
          email: canonicalCtx.email || null,
          top_insights: canonicalCtx.top_insights,
          returnTo: resolvedReturnTo,
          saved_at: new Date().toISOString(),
        });

        trackGtmEvent(
          seedFrom === 'router'
            ? 'diagnosis_hydrated_from_router_state'
            : 'diagnosis_hydrated_from_session',
          {
            scan_session_id: canonicalCtx.scan_session_id,
            grade: canonicalCtx.report_grade,
            top_insight_count: canonicalCtx.top_insights.length,
          },
        );

        setHydrationStatus('ready');
      } catch (err) {
        if (cancelled || activeRecoverySessionRef.current !== scanSessionId) return;
        console.error('[Diagnosis] lead context recovery threw:', err);
        setHydrationStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
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

    if (!context.scan_session_id || !context.lead_id) {
      const msg = 'Missing report context — please return to your report and try again.';
      console.warn('[Diagnosis] Submit blocked: missing lead_id or scan_session_id.');
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

    const payload = {
      lead_id: context.lead_id,
      scan_session_id: context.scan_session_id,
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

      if (error || !data?.success) {
        const msg =
          (data && typeof data.error === 'string' && data.error) ||
          'We could not save your diagnosis. Please try again.';
        console.error('[Diagnosis] submit failed:', error || data);
        setSubmitError(msg);
        toast.error(msg);
        setIsSubmitting(false);
        // Recoverable failure — release the lock so the user can retry with
        // all answers + their note preserved.
        submitLockRef.current = false;
        return;
      }

      const eventId: string | undefined = data.event_id ?? undefined;

      // Canonical browser conversion event — replaces the old `Schedule` push.
      trackGtmEvent('diagnosis_completed', {
        event_id: eventId,
        lead_id: context.lead_id,
        scan_session_id: context.scan_session_id,
        analysis_id: analysisId ?? undefined,
        diagnosis: primaryDiagnosis,
        prescription_path: DIAGNOSTIC_MAP[primaryDiagnosis].prescriptionPath,
        counter_offer_terms_count: counterOfferTerms.length,
      });

      // Operational telemetry mirror.
      trackEvent({
        event_name: 'diagnosis_completed',
        session_id: context.scan_session_id,
        metadata: {
          lead_id: context.lead_id,
          diagnosis_intake_id: data.diagnosis_intake_id ?? null,
          event_id: eventId ?? null,
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
