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
import { generateConditionalStatement } from '../constants/branchChips';
import type { DiagnosisCode, DiagnosticContext, StepId } from '../types';

/**
 * Hydration status for the diagnosis intake.
 *  - pending: initial check / async lookup in flight
 *  - ready: real lead context is loaded (router state OR durable fallback)
 *  - failed: no usable context — UI must render the safe empty state
 */
export type HydrationStatus = 'pending' | 'ready' | 'failed';

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

  // Counter-offer state (Step 3)
  const [counterOfferTerms, setCounterOfferTerms] = useState<string[]>([]);
  const [counterOfferFreeText, setCounterOfferFreeText] = useState('');

  const [context, setContext] = useState<DiagnosticContext>(EMPTY_CONTEXT);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [hydrationStatus, setHydrationStatus] = useState<HydrationStatus>('pending');
  // returnTo is preserved separately so it survives refresh-driven recovery.
  const [returnTo, setReturnTo] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const pageTopRef = useRef<HTMLDivElement>(null);

  // ── Hydration: router state preferred, scan_session_id fallback ──────────
  useEffect(() => {
    // 1. Router state (preferred — immediate, full context)
    if (isUsableDiagnosisState(incomingState)) {
      const ctx = buildContextFromHandoff(incomingState);
      setContext(ctx);
      setAnalysisId(incomingState.analysis_id ?? null);
      setReturnTo(incomingState.returnTo ?? (ctx.scan_session_id ? `/report/classic/${ctx.scan_session_id}` : null));
      saveReportDiagnosisHandoff({
        lead_id: ctx.lead_id,
        scan_session_id: ctx.scan_session_id,
        analysis_id: incomingState.analysis_id ?? null,
        report_grade: ctx.report_grade,
        first_name: ctx.first_name || null,
        phone: ctx.phone || null,
        email: ctx.email || null,
        top_insights: ctx.top_insights,
        returnTo: incomingState.returnTo ?? `/report/classic/${ctx.scan_session_id}`,
        saved_at: new Date().toISOString(),
      });
      trackGtmEvent('diagnosis_hydrated_from_router_state', {
        scan_session_id: ctx.scan_session_id,
        grade: ctx.report_grade,
        top_insight_count: ctx.top_insights.length,
      });
      setHydrationStatus('ready');
      return;
    }

    // 2. Durable fallback: session handoff survives refresh and dropped router state.
    const savedHandoff = readReportDiagnosisHandoff();
    if (savedHandoff) {
      const ctx = buildContextFromHandoff(savedHandoff);
      setContext(ctx);
      setAnalysisId(savedHandoff.analysis_id ?? null);
      setReturnTo(savedHandoff.returnTo ?? `/report/classic/${ctx.scan_session_id}`);
      trackGtmEvent('diagnosis_hydrated_from_session', {
        scan_session_id: ctx.scan_session_id,
        grade: ctx.report_grade,
        top_insight_count: ctx.top_insights.length,
      });
      setHydrationStatus('ready');
      return;
    }

    setHydrationStatus('failed');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once on mount
  }, []);

  const scrollToTop = useCallback(() => {
    pageTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const activeConfig = primaryDiagnosis ? DIAGNOSTIC_MAP[primaryDiagnosis] : null;

  const confidence = Math.min(
    0.95,
    0.6 +
      secondaryClarifiers.length * 0.05 +
      windowStyles.length * 0.02 +
      windowConcerns.length * 0.02 +
      (frameMaterial ? 0.05 : 0) +
      (otherFreeText.length > 20 ? 0.15 : 0)
  );

  const stepNumber = step === 'intake' ? 1 : step === 'diagnosis' ? 2 : 3;

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
    } else if (step === 'prescription') {
      setStep('diagnosis');
    }
    scrollToTop();
  };

  const handleContactEdit = () => {
    // TODO(arc-5): deep-link to the lead record edit view or account settings
    console.log('[UX] User wants to edit pre-existing contact info', {
      lead_id: context.lead_id,
    });
    alert('In production, this opens your account settings to update contact info.');
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
    if (!primaryDiagnosis || !hasCounterOffer) return;
    if (!context.scan_session_id || !context.lead_id) {
      const msg = 'Missing report context — please return to your report and try again.';
      console.warn('[Diagnosis] Submit blocked: missing lead_id or scan_session_id.');
      setSubmitError(msg);
      toast.error(msg);
      return;
    }

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
    setSubmitError(null);

    const conditionalStatement = generateConditionalStatement(
      DIAGNOSTIC_MAP[primaryDiagnosis].label,
      counterOfferTerms
    );

    // Submission keeps the SAME lead_id + scan_session_id from the report
    // handoff. Do NOT mint a new synthetic lead thread here.
    const payload = {
      lead_id: context.lead_id,
      scan_session_id: context.scan_session_id,
      analysis_id: analysisId,
      report_grade: context.report_grade || 'unknown',
      primary_diagnosis: primaryDiagnosis,
      secondary_clarifiers: {
        codes: secondaryClarifiers,
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
    stepNumber,

    // Refs
    pageTopRef,

    // Setters
    setSecondaryClarifiers,
    setOtherFreeText,
    setWindowStyles,
    setWindowConcerns,
    setFrameMaterial,
    setCounterOfferTerms,
    setCounterOfferFreeText,

    // Handlers
    toggleInArray,
    selectPrimaryDiagnosis,
    advanceToPrescription,
    handleBack,
    handleContactEdit,
    handleSubmit,
    handleReturnToReport,
    scrollToTop,
  };
}
