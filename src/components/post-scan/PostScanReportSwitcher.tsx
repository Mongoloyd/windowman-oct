/**
 * PostScanReportSwitcher — In-page post-scan report orchestrator.
 *
 * CANONICAL: Renders TruthReportClassic by default; when VITE_ENABLE_DARK_V2_HOMEPAGE=true,
 * renders ReportClassicDarkV2Partial/Full with Classic fallback.
 * Owns the real Twilio OTP pipeline for the in-page scan flow.
 * Owns CTA logic: generate-contractor-brief + request-callback for report help.
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
import { applyLeadPhoneHydration, resolveGatedFunnelPhone } from "@/lib/gatedFunnelPhone";
import { isValidScanSessionId } from "@/lib/routeIdGuards";
import {
  markHomepageDarkV2ReportReturn,
  saveReportDiagnosisHandoff,
  type ReportDiagnosisHandoff,
} from "@/lib/reportDiagnosisHandoff";
import TruthReportClassic from "../TruthReportClassic";
import ReportClassicDarkV2Partial from "@/components/forensic-report/ReportClassicDarkV2Partial";
import ReportClassicDarkV2Full from "@/components/forensic-report/ReportClassicDarkV2Full";
import type { V2ReportSource } from "@/components/forensic-report/adapters/reportAccessAdapter.types";
import type { SuggestedMatch } from "../TruthReportClassic";
import type { GateMode, LockedOverlayProps } from "@/components/LockedOverlay";
import type { AnalysisData, AnalysisFlag, PillarScore } from "@/hooks/useAnalysisData";
import { CTA_LABEL } from "./ctaConstants";

export { CTA_LABEL };

const enableDarkV2Homepage = import.meta.env.VITE_ENABLE_DARK_V2_HOMEPAGE === "true";

function DarkV2ReportRecoveryPanel({
  message = "Restoring your secured report…",
}: {
  message?: string;
}) {
  return (
    <div className="report-dark min-h-screen flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-400 mx-auto" aria-hidden />
        <p className="text-sm text-slate-300">{message}</p>
      </div>
    </div>
  );
}

const LOST_SCAN_SESSION_MESSAGE = "We lost the scan session. Please restart the scan.";
function firstRpcRow<T>(data: T[] | T | null | undefined): T | null {
  if (Array.isArray(data)) return data[0] ?? null;
  return data ?? null;
}

/** OTP-verified phone bound to the scan session that completed verify. */
type SessionCapturedPhone = { e164: string; scanSessionId: string };

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
  /** Analysis ID — passed through to diagnosis handoff when available. */
  analysisId?: string | null;
  /** Called after real OTP verification succeeds. Parent should call fetchFull(). */
  onVerified?: (phoneE164: string) => void;
  /** True when gated full data has been loaded */
  isFullLoaded?: boolean;
  /** True when full data fetch is in-flight */
  isLoadingFull?: boolean;
  /** Error message from fetchFull — surfaces immediately instead of waiting for stall timer */
  fullFetchError?: string | null;
  /** Full-mode payload fields forwarded to TruthReportClassic (parity with /report/classic route). */
  derivedMetrics?: any;
  warnings?: any[];
  missingItems?: any[];
  summary?: string | null;
  topWarning?: string | null;
  topMissingItem?: string | null;
  pricePerOpening?: number | null;
  pricePerOpeningBand?: "low" | "market" | "high" | "extreme" | null;
  paymentRiskDetected?: boolean;
  scopeGapDetected?: boolean;
  summaryTeaser?: string | null;
  missingItemsCount?: number;
  /** Live analysis payload from useAnalysisData — used by Dark V2 renderer when enabled. */
  analysisData?: AnalysisData | null;
  /** Curated V2 transport — set only after authorized full fetch; null in preview. */
  v2ReportSource?: V2ReportSource | null;
  /** True while tryResume() is re-fetching authorized full data after return/refresh. */
  isResuming?: boolean;
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
  const [capturedPhoneSession, setCapturedPhoneSession] = useState<SessionCapturedPhone | null>(null);
  const [fetchStallTimerFired, setFetchStallTimerFired] = useState(false);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stallTimerSessionRef = useRef<string | null>(null);
  const activeScanSessionIdRef = useRef(props.scanSessionId);
  const isMountedRef = useRef(true);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  // Canonical lead identity hydrated once per scan_session.
  // Used for identity continuity on dual-routed business events
  // (`report_revealed`, `contractor_match_requested`).
  const [leadId, setLeadId] = useState<string | null>(null);
  // Hydrated lead context used for the diagnosis handoff (router state).
  const [leadFirstName, setLeadFirstName] = useState<string | null>(null);
  const [leadEmail, setLeadEmail] = useState<string | null>(null);
  const [leadGrade, setLeadGrade] = useState<string | null>(null);
  const rpc = supabase.rpc as unknown as (
    fnName: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>;

  // ── CTA state ──
  const [introRequested, setIntroRequested] = useState(false);
  const [reportCallRequested, setReportCallRequested] = useState(false);
  const [isCtaLoading, setIsCtaLoading] = useState(false);
  const [suggestedMatch, setSuggestedMatch] = useState<SuggestedMatch | null>(null);

  // ── compare-quotes state ──
  const [availableComparisons, setAvailableComparisons] = useState<string[]>([]);
  const [comparisonResult, setComparisonResult] = useState<Record<string, unknown> | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.info("[PostScanReportSwitcher] mount", {
      sessionId: funnel?.sessionId ?? null,
      leadId: funnel?.leadId ?? null,
      quoteFileId: funnel?.quoteFileId ?? null,
      scanSessionId: props.scanSessionId ?? null,
      funnelScanSessionId: funnel?.scanSessionId ?? null,
      phoneStatus: funnel?.phoneStatus ?? null,
      clientSlug: funnel?.clientSlug ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount diagnostic only
  }, []);

  const reportRevealedRef = useRef(false);
  const reportRevealedEventIdRef = useRef<string | null>(null);

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

  // ── Hydrate/validate phone from scan_session via safe RPC on mount ──
  // Uses get_lead_context_for_session (SECURITY DEFINER) to avoid direct
  // browser SELECTs on scan_sessions and leads. email and grade are
  // intentionally not returned by this RPC.
  const phoneValidatedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!props.scanSessionId || phoneValidatedRef.current === props.scanSessionId) return;
    let cancelled = false;

    (async () => {
      try {
        type LeadContextForSessionRow = {
          lead_id: string;
          first_name: string | null;
          county: string | null;
          phone_e164: string | null;
        };
        const { data, error: rowError } = await rpc("get_lead_context_for_session", {
          p_scan_session_id: props.scanSessionId,
        });
        const row = firstRpcRow<LeadContextForSessionRow>(
          data as LeadContextForSessionRow[] | LeadContextForSessionRow | null | undefined,
        );

        if (cancelled) return;

        if (row?.lead_id) {
          // Cache canonical lead identity for measurement parity on
          // dual-routed business events.
          setLeadId(row.lead_id);
        }
        if (row?.first_name !== undefined) {
          setLeadFirstName(row.first_name ?? null);
        }
        // email and grade are not returned by the safe RPC;
        // leadEmail and leadGrade remain null (leadGrade falls back to props.grade).

        if (cancelled || !funnel) return;

        phoneValidatedRef.current = props.scanSessionId;

        const leadSource: { kind: "unknown" } | { kind: "loaded"; phoneE164: string | null } =
          rowError || row == null
            ? { kind: "unknown" }
            : { kind: "loaded", phoneE164: row.phone_e164 ?? null };

        applyLeadPhoneHydration({
          lead: leadSource,
          funnelPhoneE164: funnel.phoneE164,
          funnelPhoneStatus: funnel.phoneStatus,
          setPhone: funnel.setPhone,
        });
      } catch (err) {
        console.warn("[PostScanReportSwitcher] phone hydration failed (funnel phone preserved):", err);
      }
    })();

    return () => { cancelled = true; };
  }, [props.scanSessionId, funnel]);

  const gatedFunnelPhone = useMemo(
    () => resolveGatedFunnelPhone(funnel, props.scanSessionId),
    [funnel, props.scanSessionId],
  );

  const activeGatePhoneE164 = gatedFunnelPhone.phoneE164;

  const activeCapturedPhone = useMemo(() => {
    if (!capturedPhoneSession || !props.scanSessionId) return null;
    if (capturedPhoneSession.scanSessionId !== props.scanSessionId) return null;
    return capturedPhoneSession.e164;
  }, [capturedPhoneSession, props.scanSessionId]);

  const capturePhoneForSession = useCallback(
    (e164: string) => {
      if (!props.scanSessionId || !isValidScanSessionId(props.scanSessionId)) return;
      setCapturedPhoneSession({ e164, scanSessionId: props.scanSessionId });
    },
    [props.scanSessionId],
  );

  // ═══ CANONICAL BUSINESS EVENT: report_revealed ═══
  useEffect(() => {
    if (reportRevealedRef.current) return;
    if (props.isFullLoaded && activeCapturedPhone) {
      reportRevealedRef.current = true;
      trackGtmEvent("report_revealed", {
        event_id: reportRevealedEventIdRef.current ?? undefined,
        scan_session_id: props.scanSessionId || undefined,
        lead_id: leadId ?? undefined,
        grade: props.grade,
      });
    }
  }, [props.isFullLoaded, activeCapturedPhone, props.scanSessionId, props.grade, leadId]);

  const pipeline = usePhonePipeline("validate_and_send_otp", {
    scanSessionId: props.scanSessionId,
    externalPhoneE164: gatedFunnelPhone.phoneE164,
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
    if (!activeCapturedPhone) return; // proves OTP success for this scan session

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
  }, [props.scanSessionId, props.isFullLoaded, activeCapturedPhone]);

  // Post-unlock CTAs only — never fall back to pipeline.e164 (not session-gated).
  const postFullActionPhoneE164 = activeCapturedPhone || activeGatePhoneE164 || null;

  useEffect(() => {
    activeScanSessionIdRef.current = props.scanSessionId;
  }, [props.scanSessionId]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const isScanSessionStillActive = useCallback(
    (requestScanSessionId: string | null | undefined) =>
      !!requestScanSessionId &&
      activeScanSessionIdRef.current === requestScanSessionId,
    [],
  );

  const requireValidScanSession = useCallback(() => {
    if (!props.scanSessionId || !isValidScanSessionId(props.scanSessionId)) {
      toast.error(LOST_SCAN_SESSION_MESSAGE);
      return false;
    }
    return true;
  }, [props.scanSessionId]);

  // ── Stall detection timer ──
  // Sets fetchStallTimerFired=true when verified but full not loaded after 5s.
  // This is an INPUT to the canonical RevealPhase derivation, not a render decision.
  useEffect(() => {
    // If fetchFull already failed, surface immediately — no need to wait 5s
    if (props.fullFetchError && !props.isFullLoaded) {
      setFetchStallTimerFired(true);
      return;
    }
    if (gatedFunnelPhone.phoneStatus === "verified" && !props.isFullLoaded) {
      const timerSessionId = props.scanSessionId ?? null;
      stallTimerSessionRef.current = timerSessionId;
      stallTimerRef.current = setTimeout(() => {
        if (stallTimerSessionRef.current !== timerSessionId) return;
        if (!isMountedRef.current) return;
        setFetchStallTimerFired(true);
      }, 5000);
      return () => {
        if (stallTimerSessionRef.current === timerSessionId && stallTimerRef.current) {
          clearTimeout(stallTimerRef.current);
          stallTimerRef.current = null;
        }
      };
    }
    if (props.isFullLoaded && fetchStallTimerFired) setFetchStallTimerFired(false);
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
  }, [gatedFunnelPhone.phoneStatus, props.isFullLoaded, props.fullFetchError, fetchStallTimerFired, props.scanSessionId]);

  // ═══ CANONICAL PHASE DERIVATION ═══
  // This is the SINGLE source of truth for render decisions.
  // All downstream rendering branches from this value.
  const revealPhase = useMemo(() => deriveRevealPhase({
    isFullLoaded: !!props.isFullLoaded,
    isLoadingFull: !!props.isLoadingFull,
    fullFetchError: props.fullFetchError ?? null,
    funnelPhoneStatus: gatedFunnelPhone.phoneStatus,
    funnelPhoneE164: gatedFunnelPhone.phoneE164,
    localGateOverride,
    fetchStallTimerFired,
  }), [
    props.isFullLoaded,
    props.isLoadingFull,
    props.fullFetchError,
    gatedFunnelPhone.phoneStatus,
    gatedFunnelPhone.phoneE164,
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
    if (!requireValidScanSession()) return;
    const requestScanSessionId = props.scanSessionId;
    if (gatedFunnelPhone.phoneStatus !== "verified") {
      toast.error("Unable to retry. Please resend your verification code.");
      return;
    }
    const phone = activeCapturedPhone || activeGatePhoneE164;
    if (!phone) {
      toast.error("Unable to retry. Please resend your verification code.");
      return;
    }
    if (!props.onVerified) {
      toast.error("Unable to retry. Please refresh the page and try again.");
      return;
    }
    if (!isScanSessionStillActive(requestScanSessionId)) return;
    trackEvent({ event_name: "fetch_stall_retry", session_id: requestScanSessionId, metadata: { phone_last4: phone.slice(-4) } });
    if (isMountedRef.current) setFetchStallTimerFired(false);
    props.onVerified(phone);
    if (stallTimerRef.current && stallTimerSessionRef.current === requestScanSessionId) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
    stallTimerSessionRef.current = requestScanSessionId;
    stallTimerRef.current = setTimeout(() => {
      if (stallTimerSessionRef.current !== requestScanSessionId) return;
      if (!isScanSessionStillActive(requestScanSessionId)) return;
      if (!isMountedRef.current) return;
      setFetchStallTimerFired(true);
    }, 5000);
  }, [activeCapturedPhone, activeGatePhoneE164, gatedFunnelPhone.phoneStatus, props, requireValidScanSession, isScanSessionStillActive]);

  const verifyLockRef = useRef(false);

  const handleOtpSubmit = useCallback(async () => {
    if (!requireValidScanSession()) return;
    const requestScanSessionId = props.scanSessionId;
    if (otpValue.length < 6 || verifyLockRef.current) return;
    verifyLockRef.current = true;
    setIsVerifyingOtp(true);
    try {
      const result = await pipeline.submitOtp(otpValue);
      if (!isScanSessionStillActive(requestScanSessionId)) return;
      if (result.status === "verified" && result.e164) {
        funnel?.setPhone(result.e164, "verified");
        capturePhoneForSession(result.e164);
        setOtpValue("");
        if (isMountedRef.current) setFetchStallTimerFired(false);
        if (stallTimerRef.current && stallTimerSessionRef.current === requestScanSessionId) {
          clearTimeout(stallTimerRef.current);
          stallTimerRef.current = null;
          stallTimerSessionRef.current = null;
        }
        reportRevealedEventIdRef.current = result.reportRevealedEventId ?? null;
        trackGtmEvent("phone_verified", {
          event_id: result.phoneVerifiedEventId ?? undefined,
          scan_session_id: requestScanSessionId || undefined,
          phone_e164_last4: result.e164.slice(-4),
        });
        props.onVerified?.(result.e164);
      }
    } finally {
      verifyLockRef.current = false;
      if (isMountedRef.current) setIsVerifyingOtp(false);
    }
  }, [otpValue, pipeline, props, funnel, requireValidScanSession, capturePhoneForSession, isScanSessionStillActive]);

  const handleSendCode = useCallback(async () => {
    if (!requireValidScanSession()) return;
    const requestScanSessionId = props.scanSessionId;
    if (!activeGatePhoneE164 || isSendInFlight) return;
    funnel?.setPhoneStatus("sending_otp");
    setIsSendInFlight(true);
    try {
      const result = await pipeline.submitPhone();
      if (!isScanSessionStillActive(requestScanSessionId)) return;
      if (result.status === "otp_sent" && result.e164) {
        funnel?.setPhone(result.e164, "otp_sent");
        capturePhoneForSession(result.e164);
        setLocalGateOverride("enter_code");
      } else {
        funnel?.setPhoneStatus("send_failed");
      }
    } catch {
      if (isScanSessionStillActive(requestScanSessionId)) {
        funnel?.setPhoneStatus("send_failed");
      }
    } finally {
      if (isMountedRef.current) setIsSendInFlight(false);
    }
  }, [funnel, activeGatePhoneE164, pipeline, isSendInFlight, requireValidScanSession, capturePhoneForSession, props.scanSessionId, isScanSessionStillActive]);

  // Auto-send OTP when phone is pre-filled (intake) and not already sent during theatrics
  const autoSendFiredRef = useRef(false);
  useEffect(() => {
    if (autoSendFiredRef.current) return;
    if (currentGateMode !== "send_code") return;
    if (!gatedFunnelPhone.phoneE164 || isSendInFlight) return;
    if (gatedFunnelPhone.phoneStatus !== "screened_valid") return;
    autoSendFiredRef.current = true;
    handleSendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally fire only once
  }, [currentGateMode, gatedFunnelPhone.phoneE164, gatedFunnelPhone.phoneStatus, isSendInFlight]);

  const handlePhoneSubmit = useCallback(async () => {
    if (!requireValidScanSession()) return;
    const requestScanSessionId = props.scanSessionId;
    if (isSendInFlight) return;
    funnel?.setPhoneStatus("sending_otp");
    setIsSendInFlight(true);
    trackEvent({ event_name: "phone_submitted", session_id: requestScanSessionId, metadata: {} });
    try {
      const result = await pipeline.submitPhone();
      if (!isScanSessionStillActive(requestScanSessionId)) return;
      if (result.status === "otp_sent" && result.e164) {
        funnel?.setPhone(result.e164, "otp_sent");
        capturePhoneForSession(result.e164);
        setLocalGateOverride("enter_code");
      } else {
        funnel?.setPhoneStatus("send_failed");
      }
    } catch {
      if (isScanSessionStillActive(requestScanSessionId)) {
        funnel?.setPhoneStatus("send_failed");
      }
    } finally {
      if (isMountedRef.current) setIsSendInFlight(false);
    }
  }, [pipeline, funnel, isSendInFlight, props.scanSessionId, requireValidScanSession, capturePhoneForSession, isScanSessionStillActive]);

  const handleChangePhone = useCallback(() => {
    pipeline.reset();
    setOtpValue("");
    setCapturedPhoneSession(null);
    setLocalGateOverride("enter_phone");
    autoSendFiredRef.current = false;
    funnel?.setPhone("", "none");
  }, [pipeline, funnel]);

  const handleResend = useCallback(async () => {
    if (!requireValidScanSession()) return;
    const requestScanSessionId = props.scanSessionId;
    if (!activeGatePhoneE164 || isSendInFlight) return;
    setIsSendInFlight(true);
    funnel?.setPhoneStatus("sending_otp");
    try {
      const result = await pipeline.resend();
      if (!isScanSessionStillActive(requestScanSessionId)) return;
      if (result.status === "otp_sent") {
        funnel?.setPhoneStatus("otp_sent");
        return;
      }
      if (result.status === "blocked") {
        funnel?.setPhoneStatus("otp_sent");
        return;
      }
      funnel?.setPhoneStatus("send_failed");
    } finally {
      if (isMountedRef.current) setIsSendInFlight(false);
    }
  }, [pipeline, funnel, requireValidScanSession, activeGatePhoneE164, isSendInFlight, props.scanSessionId, isScanSessionStillActive]);

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
    const requestScanSessionId = props.scanSessionId;
    if (availableComparisons.length < 2 || !postFullActionPhoneE164) return;
    setComparisonLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("compare-quotes", {
        body: {
          scan_session_ids: availableComparisons,
          phone_e164: postFullActionPhoneE164,
        },
      });
      if (!isScanSessionStillActive(requestScanSessionId)) return;
      if (error || !data?.success) {
        console.error("[compare-quotes] failed:", error || data);
        toast.error("Comparison failed. Please try again.");
      } else {
        setComparisonResult(data.comparison);
      }
    } catch (err) {
      console.error("[compare-quotes] error:", err);
      if (isScanSessionStillActive(requestScanSessionId)) {
        toast.error("Connection error. Please try again.");
      }
    } finally {
      if (isMountedRef.current) setComparisonLoading(false);
    }
  }, [availableComparisons, postFullActionPhoneE164, props.scanSessionId, isScanSessionStillActive]);

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

    const returnTo = enableDarkV2Homepage
      ? "/?resume=1"
      : `/report/classic/${props.scanSessionId}`;

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
    // lead_events row via a hardened edge function (validates that
    // scan_session_id belongs to lead_id before any write).
    // Fire-and-forget — must NEVER block navigation.
    if (leadId) {
      void supabase.functions
        .invoke("persist-diagnosis-start", {
          body: {
            lead_id: leadId,
            scan_session_id: props.scanSessionId,
            // analysis_id is intentionally NOT fetched here — only passed
            // when already available in current report context (not yet
            // surfaced as a prop). See follow-ups.
            grade: props.grade,
            county: props.county,
            source: "unlocked_report_primary_cta",
          },
        })
        .then(({ error }) => {
          if (error) {
            console.warn(
              "[PostScanReportSwitcher] persist-diagnosis-start failed:",
              error,
            );
          }
        })
        .catch((err) => {
          console.warn(
            "[PostScanReportSwitcher] persist-diagnosis-start threw:",
            err,
          );
        });
    }

    const handoff: ReportDiagnosisHandoff = {
      lead_id: leadId ?? "",
      scan_session_id: props.scanSessionId,
      analysis_id: props.analysisId ?? null,
      report_grade: leadGrade ?? props.grade,
      first_name: leadFirstName,
      phone: postFullActionPhoneE164,
      email: leadEmail,
      top_insights: topInsights,
      returnTo,
      saved_at: new Date().toISOString(),
    };

    saveReportDiagnosisHandoff(handoff);
    if (enableDarkV2Homepage) {
      markHomepageDarkV2ReportReturn(props.scanSessionId);
    }

    navigate("/diagnosis", { state: handoff });
  }, [
    navigate,
    props.scanSessionId,
    props.analysisId,
    props.flags,
    props.grade,
    props.county,
    leadId,
    leadGrade,
    leadFirstName,
    leadEmail,
    postFullActionPhoneE164,
  ]);

  // ── CTA B: Call WindowMan About My Report ──
  const handleReportHelpCall = useCallback(async () => {
    const requestScanSessionId = props.scanSessionId;
    if (!requestScanSessionId || !postFullActionPhoneE164) {
      toast.error("Unable to process request. Please verify your phone number first.");
      return;
    }
    setIsCtaLoading(true);
    try {
      await supabase.functions.invoke("request-callback", {
        body: {
          scan_session_id: requestScanSessionId,
          call_intent: "report_explainer",
          cta_source: "report_help",
        },
      });
      if (!isScanSessionStillActive(requestScanSessionId)) return;
      setReportCallRequested(true);
    } catch (err) {
      console.error("[PostScanReportSwitcher] report help call failed", err);
      if (isScanSessionStillActive(requestScanSessionId)) {
        toast.error("Connection error. Please try again.");
      }
    } finally {
      if (isMountedRef.current) setIsCtaLoading(false);
    }
  }, [props.scanSessionId, postFullActionPhoneE164, isScanSessionStillActive]);

  const maskedPhone = activeCapturedPhone
    ? maskPhone(activeCapturedPhone)
    : activeGatePhoneE164
      ? maskPhone(activeGatePhoneE164)
      : undefined;
  const sharedSendFailed = gatedFunnelPhone.phoneStatus === "send_failed";
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
      gatedFunnelPhone.phoneStatus === "sending_otp" ||
      isVerifyingOtp,
    errorMsg: effectiveErrorMsg,
    errorType: pipeline.errorType ?? (sharedSendFailed ? "generic" : undefined),
    resendCooldown: pipeline.resendCooldown,
    onResend: handleResend,
    fetchStalled: isStalled,
    onRetryFetchFull: handleRetryFetchFull,
  };

  const previewSafeAnalysisData = useMemo((): AnalysisData | null => {
    if (!props.analysisData) return null;
    return { ...props.analysisData, flags: [] };
  }, [props.analysisData]);

  const showDarkV2Full =
    enableDarkV2Homepage &&
    accessLevel === "full" &&
    !!props.isFullLoaded &&
    props.v2ReportSource != null &&
    props.analysisData != null;

  const isVerifiedAwaitingFull =
    gatedFunnelPhone.phoneStatus === "verified" &&
    !props.isFullLoaded &&
    revealPhase.phase !== "full_stalled";

  // Dark V2 recovery: Show dark spinner during active resume/loading/full-authorization states.
  // Must NOT require analysisData to be present — it may be temporarily null during rehydration.
  // This prevents falling through to Classic during transient loading windows.
  const showDarkV2Recovering =
    enableDarkV2Homepage &&
    !showDarkV2Full &&
    (props.isResuming || props.isLoadingFull || isVerifiedAwaitingFull);

  const showDarkV2Partial =
    enableDarkV2Homepage &&
    !showDarkV2Recovering &&
    accessLevel === "preview" &&
    previewSafeAnalysisData != null;

  const classicReport = (
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
  );

  return (
    <>
      <div ref={reportTopRef} id="report-top" className="scroll-mt-20" />
      {showDarkV2Full ? (
        <ReportClassicDarkV2Full
          analysisData={props.analysisData}
          v2ReportSource={props.v2ReportSource ?? null}
          county={props.county}
          scanSessionId={props.scanSessionId ?? undefined}
          onDiagnosisCta={handleContractorMatchClick}
        />
      ) : showDarkV2Recovering ? (
        <DarkV2ReportRecoveryPanel />
      ) : showDarkV2Partial ? (
        <ReportClassicDarkV2Partial
          analysisData={previewSafeAnalysisData}
          county={props.county}
          gateProps={gateProps}
        />
      ) : (
        classicReport
      )}
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
