/**
 * PostScanReportSwitcher — In-page post-scan report orchestrator.
 *
 * CANONICAL: Always renders TruthReportClassic (findings-first removed).
 * Owns the real Twilio OTP pipeline for the in-page scan flow.
 * Owns CTA logic: generate-contractor-brief + voice-followup edge functions.
 *
 * STATE OWNERSHIP (Phase 3):
 *   - This component is the SINGLE place that decides which render state
 *     the reveal path displays (locked / full_loading / full_stalled / full_ready).
 *   - It derives a canonical RevealPhase from hook outputs once per render.
 *   - TruthReportClassic is presentational — it receives accessLevel and
 *     gateProps but does not independently reason about access.
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { trackEvent } from "@/lib/trackEvent";
import { trackGtmEvent } from "@/lib/trackConversion";
import { resolveEffectiveSeverity } from "@/utils/resolveEffectiveSeverity";
import { useScanFunnelSafe } from "@/state/scanFunnel";
import { usePhonePipeline } from "@/hooks/usePhonePipeline";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { deriveRevealPhase, phaseToAccessLevel } from "@/lib/deriveRevealPhase";
import TruthReportClassic from "../TruthReportClassic";
import type { SuggestedMatch } from "../TruthReportClassic";
import type { GateMode, LockedOverlayProps } from "@/components/LockedOverlay";
import type { AnalysisFlag, PillarScore } from "@/hooks/useAnalysisData";
import { CTA_LABEL } from "./ctaConstants";

export { CTA_LABEL };

type Props = {
  grade: string;
  flags: AnalysisFlag[];
  pillarScores: PillarScore[];
  contractorName: string | null;
  county: string;
  confidenceScore: number | null;
  documentType: string | null;
  qualityBand?: "good" | "fair" | "poor" | null;
  hasWarranty?: boolean | null;
  hasPermits?: boolean | null;
  pageCount?: number | null;
  lineItemCount?: number | null;
  flagCount?: number;
  flagRedCount?: number;
  flagAmberCount?: number;
  priceFairness?: string | null;
  markupEstimate?: string | null;
  negotiationLeverage?: string | null;
  onSecondScan: () => void;
  scanSessionId?: string | null;
  /** Called after real OTP verification succeeds. Parent should call fetchFull(). */
  onVerified?: (phoneE164: string) => void;
  /** True when gated full data has been loaded */
  isFullLoaded?: boolean;
  /** True when full data fetch is in-flight */
  isLoadingFull?: boolean;
  /** Error message from fetchFull — surfaces immediately instead of waiting for stall timer */
  fullFetchError?: string | null;
};

function maskPhone(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  const last4 = digits.slice(-4);
  return `(***) ***-${last4}`;
}

export function PostScanReportSwitcher(props: Props) {
  const navigate = useNavigate();
  const funnel = useScanFunnelSafe();
  const [otpValue, setOtpValue] = useState("");
  const [isSendInFlight, setIsSendInFlight] = useState(false);
  const [tcpaConsent, setTcpaConsent] = useState(false);
  const [localGateOverride, setLocalGateOverride] = useState<GateMode | null>(null);
  const [capturedPhone, setCapturedPhone] = useState<string | null>(null);
  const [fetchStallTimerFired, setFetchStallTimerFired] = useState(false);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  // Canonical lead identity hydrated once per scan_session.
  // Used for identity continuity on dual-routed business events
  // (`report_revealed`, `contractor_match_requested`).
  const [leadId, setLeadId] = useState<string | null>(null);
  // Hydrated lead context used for the diagnosis handoff (router state).
  const [leadFirstName, setLeadFirstName] = useState<string | null>(null);
  const [leadEmail, setLeadEmail] = useState<string | null>(null);
  const [leadGrade, setLeadGrade] = useState<string | null>(null);

  // ── CTA state ──
  const [introRequested, setIntroRequested] = useState(false);
  const [reportCallRequested, setReportCallRequested] = useState(false);
  const [isCtaLoading, setIsCtaLoading] = useState(false);
  const [suggestedMatch, setSuggestedMatch] = useState<SuggestedMatch | null>(null);

  // ── compare-quotes state ──
  const [availableComparisons, setAvailableComparisons] = useState<string[]>([]);
  const [comparisonResult, setComparisonResult] = useState<Record<string, unknown> | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  // ═══ CANONICAL BUSINESS EVENT: report_revealed ═══
  // Fires ONCE when full report data loads after OTP verification.
  // Does NOT fire on resume (resume is a returning-user operational event, not a conversion).
  // event_id is supplied by verify-otp and reused here so browser dataLayer +
  // server canonical persistence share one id (cross-lane dedup-safe).
  const reportRevealedRef = useRef(false);
  const reportRevealedEventIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (reportRevealedRef.current) return;
    if (props.isFullLoaded && capturedPhone) {
      reportRevealedRef.current = true;
      trackGtmEvent("report_revealed", {
        event_id: reportRevealedEventIdRef.current ?? undefined,
        scan_session_id: props.scanSessionId || undefined,
        lead_id: leadId ?? undefined,
        grade: props.grade,
      });
    }
  }, [props.isFullLoaded, capturedPhone, props.scanSessionId, props.grade, leadId]);

  // ── Hydrate CTA state from DB on mount (prevents duplicates after refresh) ──
  useEffect(() => {
    if (!props.scanSessionId || !props.isFullLoaded) return;
    let cancelled = false;
    supabase
      .from("contractor_opportunities")
      .select("id, status, suggested_match_snapshot")
      .eq("scan_session_id", props.scanSessionId)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setIntroRequested(true);
        if (data.suggested_match_snapshot) {
          setSuggestedMatch(data.suggested_match_snapshot as unknown as SuggestedMatch);
        }
      });
    return () => { cancelled = true; };
  }, [props.scanSessionId, props.isFullLoaded]);

  // ── Hydrate/validate phone from leads table on mount ──
  const phoneValidatedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!props.scanSessionId || phoneValidatedRef.current === props.scanSessionId) return;
    let cancelled = false;

    (async () => {
      try {
        const { data: session } = await supabase
          .from("scan_sessions")
          .select("lead_id")
          .eq("id", props.scanSessionId)
          .maybeSingle();

        if (cancelled || !session?.lead_id) return;

        // Cache canonical lead identity for measurement parity on
        // dual-routed business events.
        setLeadId(session.lead_id);

        const { data: lead } = await supabase
          .from("leads")
          .select("phone_e164, first_name, email, grade")
          .eq("id", session.lead_id)
          .maybeSingle();

        if (!cancelled && lead) {
          setLeadFirstName(lead.first_name ?? null);
          setLeadEmail(lead.email ?? null);
          setLeadGrade(lead.grade ?? null);
        }

        if (cancelled || !funnel) return;

        phoneValidatedRef.current = props.scanSessionId;

        if (lead?.phone_e164) {
          if (!funnel.phoneE164) {
            funnel.setPhone(lead.phone_e164, "none");
          }
        } else if (funnel.phoneE164) {
          console.log("[PostScanReportSwitcher] Clearing stale funnel phone (lead has no phone)");
          funnel.setPhone("", "none");
        }
      } catch (err) {
        console.warn("[PostScanReportSwitcher] phone hydration failed:", err);
      }
    })();

    return () => { cancelled = true; };
  }, [props.scanSessionId, funnel]);

  const pipeline = usePhonePipeline("validate_and_send_otp", {
    scanSessionId: props.scanSessionId,
    externalPhoneE164: funnel?.phoneE164 ?? null,
    onVerified: () => {
      funnel?.setPhoneStatus("verified");
    },
  });

  // ── Snapshot Receipt email — fire ONCE on first true full unlock ──
  // Server is the authority on idempotency (leads.snapshot_email_status).
  // The frontend-side ref is just a per-tab guard against double-invoke
  // during a single session. Provider failure must NOT block reveal.
  const snapshotEmailFiredRef = useRef(false);
  useEffect(() => {
    if (snapshotEmailFiredRef.current) return;
    if (!props.scanSessionId) return;
    if (!props.isFullLoaded) return;
    if (!capturedPhone) return; // proves OTP success in this tab

    snapshotEmailFiredRef.current = true;
    supabase.functions
      .invoke("send-report-email", {
        body: {
          scan_session_id: props.scanSessionId,
          email_type: "full",
        },
      })
      .then(({ data, error }) => {
        if (error) {
          console.warn("[PostScanReportSwitcher] snapshot email failed:", error);
        } else if (data?.already_sent) {
          console.log("[PostScanReportSwitcher] snapshot email already sent");
        } else if (data?.skipped) {
          console.log("[PostScanReportSwitcher] snapshot email skipped:", data.reason);
        } else if (data?.success) {
          console.log("[PostScanReportSwitcher] snapshot email sent");
        }
      })
      .catch((err) => {
        // Never let email delivery interfere with reveal.
        console.warn("[PostScanReportSwitcher] snapshot email invoke threw:", err);
      });
  }, [props.scanSessionId, props.isFullLoaded, capturedPhone]);

  // Resolve phone for CTA calls
  const phoneE164 = capturedPhone || funnel?.phoneE164 || pipeline.e164 || null;

  // ── Stall detection timer ──
  // Sets fetchStallTimerFired=true when verified but full not loaded after 5s.
  // This is an INPUT to the canonical RevealPhase derivation, not a render decision.
  useEffect(() => {
    // If fetchFull already failed, surface immediately — no need to wait 5s
    if (props.fullFetchError && !props.isFullLoaded) {
      setFetchStallTimerFired(true);
      return;
    }
    if (funnel?.phoneStatus === "verified" && !props.isFullLoaded) {
      stallTimerRef.current = setTimeout(() => setFetchStallTimerFired(true), 5000);
      return () => { if (stallTimerRef.current) clearTimeout(stallTimerRef.current); };
    }
    if (props.isFullLoaded && fetchStallTimerFired) setFetchStallTimerFired(false);
    if (stallTimerRef.current) { clearTimeout(stallTimerRef.current); stallTimerRef.current = null; }
  }, [funnel?.phoneStatus, props.isFullLoaded, props.fullFetchError, fetchStallTimerFired]);

  // ═══ CANONICAL PHASE DERIVATION ═══
  // This is the SINGLE source of truth for render decisions.
  // All downstream rendering branches from this value.
  const revealPhase = useMemo(() => deriveRevealPhase({
    isFullLoaded: !!props.isFullLoaded,
    isLoadingFull: !!props.isLoadingFull,
    fullFetchError: props.fullFetchError ?? null,
    funnelPhoneStatus: funnel?.phoneStatus,
    funnelPhoneE164: funnel?.phoneE164,
    localGateOverride,
    fetchStallTimerFired,
  }), [
    props.isFullLoaded,
    props.isLoadingFull,
    props.fullFetchError,
    funnel?.phoneStatus,
    funnel?.phoneE164,
    localGateOverride,
    fetchStallTimerFired,
  ]);

  // Derived values from canonical phase
  const accessLevel = phaseToAccessLevel(revealPhase);
  const currentGateMode: GateMode = revealPhase.phase === "locked" ? revealPhase.gateMode : "enter_code";
  const isStalled = revealPhase.phase === "full_stalled";

  // ── Scroll-to-top on preview → full transition (post-OTP unlock) ──
  // Lands the viewport on the verdict so the first mobile screen shows
  // grade + start of Top Risks, not whichever section the user had scrolled to.
  const reportTopRef = useRef<HTMLDivElement>(null);
  const prevAccessRef = useRef(accessLevel);
  useEffect(() => {
    if (prevAccessRef.current !== "full" && accessLevel === "full") {
      requestAnimationFrame(() => {
        reportTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    prevAccessRef.current = accessLevel;
  }, [accessLevel]);

  // ── Pre-OTP scroll-to-gate on send_code → enter_code transition ──
  // When OTP is dispatched (often auto-fired with a pre-hydrated phone), bring
  // the viewport to the OTP entry UI so users aren't stranded at the top of
  // the preview with no visible code-entry surface.
  const prevGateModeRef = useRef<GateMode>(currentGateMode);
  useEffect(() => {
    if (accessLevel === "full") {
      prevGateModeRef.current = currentGateMode;
      return;
    }
    if (prevGateModeRef.current !== "enter_code" && currentGateMode === "enter_code") {
      requestAnimationFrame(() => {
        document.getElementById("otp-gate")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    prevGateModeRef.current = currentGateMode;
  }, [currentGateMode, accessLevel]);

  const handleRetryFetchFull = useCallback(() => {
    const phone = capturedPhone || funnel?.phoneE164 || pipeline.e164;
    if (!phone) {
      toast.error("Unable to retry. Please resend your verification code.");
      return;
    }
    if (!props.onVerified) {
      toast.error("Unable to retry. Please refresh the page and try again.");
      return;
    }
    trackEvent({ event_name: "fetch_stall_retry", session_id: props.scanSessionId, metadata: { phone_last4: phone.slice(-4) } });
    setFetchStallTimerFired(false);
    props.onVerified(phone);
    // Restart the stall timer so the retry button reappears if the fetch stalls again
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    stallTimerRef.current = setTimeout(() => setFetchStallTimerFired(true), 5000);
  }, [capturedPhone, funnel?.phoneE164, pipeline.e164, props]);

  const verifyLockRef = useRef(false);

  const handleOtpSubmit = useCallback(async () => {
    if (otpValue.length < 6 || verifyLockRef.current) return;
    verifyLockRef.current = true;
    setIsVerifyingOtp(true);
    try {
      const result = await pipeline.submitOtp(otpValue);
      if (result.status === "verified" && result.e164) {
        setCapturedPhone(result.e164);
        // Stash the server-issued report_revealed event_id so the
        // report_revealed effect uses the SAME id as the server canonical event.
        reportRevealedEventIdRef.current = result.reportRevealedEventId ?? null;
        // ═══ CANONICAL BUSINESS EVENT: phone_verified ═══
        // Single fire location. event_id is supplied by verify-otp so the
        // browser dataLayer push and the server canonical event share one id.
        trackGtmEvent("phone_verified", {
          event_id: result.phoneVerifiedEventId ?? undefined,
          scan_session_id: props.scanSessionId || undefined,
          phone_e164_last4: result.e164.slice(-4),
        });
        // Canonical phone handoff: use server-returned phone to trigger fetchFull
        props.onVerified?.(result.e164);
      }
    } finally {
      setIsVerifyingOtp(false);
      verifyLockRef.current = false;
    }
  }, [otpValue, pipeline, props]);

  const handleSendCode = useCallback(async () => {
    if (!funnel?.phoneE164 || isSendInFlight) return;
    funnel.setPhoneStatus("sending_otp");
    setIsSendInFlight(true);
    try {
      const result = await pipeline.submitPhone();
      if (result.status === "otp_sent") {
        funnel.setPhoneStatus("otp_sent");
        setCapturedPhone(funnel.phoneE164);
        setLocalGateOverride("enter_code");
      } else {
        funnel.setPhoneStatus("send_failed");
      }
    } catch {
      funnel.setPhoneStatus("send_failed");
    } finally {
      setIsSendInFlight(false);
    }
  }, [funnel, pipeline, isSendInFlight]);

  // Auto-send OTP when phone is pre-filled (e.g. hydrated from leads table)
  const autoSendFiredRef = useRef(false);
  useEffect(() => {
    if (autoSendFiredRef.current) return;
    if (currentGateMode === "send_code" && funnel?.phoneE164 && !isSendInFlight) {
      autoSendFiredRef.current = true;
      handleSendCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally fire only once
  }, [currentGateMode, funnel?.phoneE164]);

  const handlePhoneSubmit = useCallback(async () => {
    if (isSendInFlight) return;
    funnel?.setPhoneStatus("sending_otp");
    setIsSendInFlight(true);
    trackEvent({ event_name: "phone_submitted", session_id: props.scanSessionId, metadata: {} });
    try {
      const result = await pipeline.submitPhone();
      if (result.status === "otp_sent" && result.e164) {
        funnel?.setPhone(result.e164, "otp_sent");
        setCapturedPhone(result.e164);
        setLocalGateOverride("enter_code");
      } else {
        funnel?.setPhoneStatus("send_failed");
      }
    } catch {
      funnel?.setPhoneStatus("send_failed");
    } finally {
      setIsSendInFlight(false);
    }
  }, [pipeline, funnel, isSendInFlight, props.scanSessionId]);

  const handleChangePhone = useCallback(() => {
    pipeline.reset();
    setOtpValue("");
    setCapturedPhone(null);
    setLocalGateOverride("enter_phone");
    funnel?.setPhone("", "none");
  }, [pipeline, funnel]);

  const handleResend = useCallback(async () => {
    if (!funnel?.phoneE164) return;
    funnel.setPhoneStatus("sending_otp");
    const result = await pipeline.resend();
    if (result.status === "otp_sent") {
      funnel.setPhoneStatus("otp_sent");
      return;
    }
    if (result.status === "blocked") {
      funnel.setPhoneStatus("otp_sent");
      return;
    }
    funnel.setPhoneStatus("send_failed");
  }, [pipeline, funnel]);

  // ── Detect 2+ completed analyses for this lead via SECURITY DEFINER RPC ──
  useEffect(() => {
    if (!props.scanSessionId || !props.isFullLoaded) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await (supabase.rpc as (fn: string, args: Record<string, unknown>) => ReturnType<typeof supabase.rpc>)(
        "get_comparable_sessions",
        { p_scan_session_id: props.scanSessionId }
      );

      if (cancelled || error || !data) return;
      const sessionIds = (data as unknown as { scan_session_id: string }[]).map((r) => r.scan_session_id);
      if (sessionIds.length >= 2) {
        setAvailableComparisons(sessionIds);
      }
    })();

    return () => { cancelled = true; };
  }, [props.scanSessionId, props.isFullLoaded]);

  // ── CTA C: Compare My Quotes ──
  const handleCompareQuotes = useCallback(async () => {
    if (availableComparisons.length < 2 || !phoneE164) return;
    setComparisonLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("compare-quotes", {
        body: {
          scan_session_ids: availableComparisons,
          phone_e164: phoneE164,
        },
      });
      if (error || !data?.success) {
        console.error("[compare-quotes] failed:", error || data);
        toast.error("Comparison failed. Please try again.");
      } else {
        setComparisonResult(data.comparison);
      }
    } catch (err) {
      console.error("[compare-quotes] error:", err);
      toast.error("Connection error. Please try again.");
    } finally {
      setComparisonLoading(false);
    }
  }, [availableComparisons, phoneE164]);

  // Primary unlocked-report CTA → Diagnosis Intake.
  // Router-state handoff only (no public URL contract change in this pass).
  // The contractor-brief / voice-followup edge functions are intentionally
  // NOT invoked here — diagnosis owns the next-step lead conversation.
  const handleContractorMatchClick = useCallback(() => {
    if (!props.scanSessionId) {
      toast.error("Unable to continue. Please refresh and try again.");
      return;
    }

    // Derive top_insights from the actual report flags (top 3 by effective severity).
    const topInsights = [...props.flags]
      .sort((a, b) => {
        const sev = { red: 0, amber: 1, green: 2 } as const;
        const aSev = resolveEffectiveSeverity(a);
        const bSev = resolveEffectiveSeverity(b);
        return (sev[aSev] ?? 3) - (sev[bSev] ?? 3);
      })
      .slice(0, 3)
      .map((f) => f.label)
      .filter(Boolean);

    const returnTo = `/report/classic/${props.scanSessionId}`;

    // Preserve analytics: use the existing dataLayer event family but signal
    // the diagnosis intent. Keeps measurement continuity without re-using the
    // contractor-match canonical event id (no server brief/voice-followup fired).
    trackGtmEvent("diagnosis_started", {
      scan_session_id: props.scanSessionId,
      lead_id: leadId ?? undefined,
      grade: props.grade,
      county: props.county,
    });
    trackEvent({
      event_name: "diagnosis_started",
      session_id: props.scanSessionId,
      metadata: { source: "unlocked_report_primary_cta", lead_id: leadId ?? null },
    });

    // Non-blocking server-side persistence of diagnosis_started.
    // Stamps lead.funnel_stage + diagnosis_started_at and writes a canonical
    // lead_events row. Fire-and-forget — must NEVER block navigation.
    if (leadId) {
      void (async () => {
        try {
          await supabase
            .from("leads")
            .update({
              funnel_stage: "diagnosis_started",
              diagnosis_started_at: new Date().toISOString(),
            })
            .eq("id", leadId);
          await supabase.from("lead_events").insert({
            lead_id: leadId,
            scan_session_id: props.scanSessionId,
            event_name: "diagnosis_started",
            event_source: "unlocked_report_primary_cta",
            status: "started",
            metadata: { grade: props.grade, county: props.county },
          });
        } catch (err) {
          console.warn("[PostScanReportSwitcher] diagnosis_started persistence failed:", err);
        }
      })();
    }

    navigate("/diagnosis", {
      state: {
        lead_id: leadId,
        scan_session_id: props.scanSessionId,
        report_grade: leadGrade ?? props.grade,
        first_name: leadFirstName,
        phone: phoneE164,
        email: leadEmail,
        top_insights: topInsights,
        returnTo,
      },
    });
  }, [
    navigate,
    props.scanSessionId,
    props.flags,
    props.grade,
    props.county,
    leadId,
    leadGrade,
    leadFirstName,
    leadEmail,
    phoneE164,
  ]);

  // ── CTA B: Call WindowMan About My Report ──
  const handleReportHelpCall = useCallback(async () => {
    if (!props.scanSessionId || !phoneE164) {
      toast.error("Unable to process request. Please verify your phone number first.");
      return;
    }
    setIsCtaLoading(true);
    try {
      await supabase.functions.invoke("voice-followup", {
        body: {
          scan_session_id: props.scanSessionId,
          phone_e164: phoneE164,
          call_intent: "report_explainer",
          cta_source: "report_help",
        },
      });
      setReportCallRequested(true);
    } catch (err) {
      console.error("[PostScanReportSwitcher] report help call failed", err);
      toast.error("Connection error. Please try again.");
    } finally {
      setIsCtaLoading(false);
    }
  }, [props.scanSessionId, phoneE164]);

  const maskedPhone = capturedPhone ? maskPhone(capturedPhone) : funnel?.phoneE164 ? maskPhone(funnel.phoneE164) : undefined;
  const sharedSendFailed = funnel?.phoneStatus === "send_failed";
  const effectiveErrorMsg =
    pipeline.errorMsg || (sharedSendFailed ? "Send or confirm your number to receive a code." : "");

  // ── Build gate props (only used when phase is locked or stalled) ──
  const gateProps: Omit<LockedOverlayProps, "grade" | "flagCount"> = {
    gateMode: currentGateMode,
    otpValue,
    onOtpChange: setOtpValue,
    onOtpSubmit: handleOtpSubmit,
    onSendCode: handleSendCode,
    phoneDisplayValue: pipeline.displayValue,
    phoneIsValid: pipeline.inputComplete,
    phoneDigitCount: pipeline.rawDigits.length,
    onPhoneChange: pipeline.handlePhoneChange,
    onPhoneSubmit: handlePhoneSubmit,
    tcpaConsent,
    onTcpaChange: setTcpaConsent,
    maskedPhone,
    onChangePhone: handleChangePhone,
    flagRedCount: props.flagRedCount,
    isLoading:
      isSendInFlight ||
      funnel?.phoneStatus === "sending_otp" ||
      isVerifyingOtp,
    errorMsg: effectiveErrorMsg,
    errorType: pipeline.errorType ?? (sharedSendFailed ? "generic" : undefined),
    resendCooldown: pipeline.resendCooldown,
    onResend: handleResend,
    fetchStalled: isStalled,
    onRetryFetchFull: handleRetryFetchFull,
  };

  return (
    <>
      <div ref={reportTopRef} id="report-top" className="scroll-mt-20" />
      <TruthReportClassic
        {...props}
        accessLevel={accessLevel}
        gateProps={accessLevel === "preview" ? gateProps : undefined}
        onContractorMatchClick={handleContractorMatchClick}
        onReportHelpCall={handleReportHelpCall}
        introRequested={introRequested}
        reportCallRequested={reportCallRequested}
        isCtaLoading={isCtaLoading}
        suggestedMatch={suggestedMatch}
        ctaLabel={CTA_LABEL}
      />
      {availableComparisons.length >= 2 && !comparisonResult && (
        <div className="px-4 pb-6 pt-2">
          <button
            onClick={handleCompareQuotes}
            disabled={comparisonLoading}
            className="btn-depth-primary w-full"
            style={{ height: 54, fontSize: 16 }}
          >
            {comparisonLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={18} className="animate-spin" /> Comparing Quotes...
              </span>
            ) : (
              `Compare My ${availableComparisons.length} Quotes Side-by-Side →`
            )}
          </button>
        </div>
      )}
      {comparisonResult && (
        <div className="glass-card-strong mx-4 mb-6 p-4 rounded-xl">
          <p className="text-sm font-semibold text-white mb-1">Quote Comparison Ready</p>
          <p className="text-xs text-white/60">
            {typeof comparisonResult.summary === "string"
              ? comparisonResult.summary
              : "Your quotes have been compared. Contact your advisor for details."}
          </p>
        </div>
      )}
    </>
  );
}
