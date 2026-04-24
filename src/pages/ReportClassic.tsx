/**
 * ReportClassic — Smart Container for the Classic Truth Report route.
 * Route: /report/classic/:sessionId
 *
 * This is the ONLY layer that touches Twilio / usePhonePipeline for the Classic flow.
 * TruthReportClassic remains pure UI — zero Twilio/Supabase knowledge.
 *
 * Data source: useAnalysisData (existing hook, fetches via get_analysis_preview RPC)
 * County:      fetched from leads table via narrow RPC (get_county_by_scan_session)
 * Gate:        LockedOverlay props built from usePhonePipeline + funnel context
 * CTAs:        generate-contractor-brief + voice-followup edge functions
 */

import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAnalysisData } from "@/hooks/useAnalysisData";
import { usePhonePipeline } from "@/hooks/usePhonePipeline";
import { useReportAccess } from "@/hooks/useReportAccess";
import { useScanFunnelSafe } from "@/state/scanFunnel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import TruthReportClassic from "@/components/TruthReportClassic";
import type { SuggestedMatch } from "@/components/TruthReportClassic";
import type { GateMode, LockedOverlayProps } from "@/components/LockedOverlay";
import type { OtpVerifyOutcome } from "@/types/report-v2";

// ── PipelineVerifyResult → OtpVerifyOutcome mapping ──────────────────────────
const PIPELINE_TO_OUTCOME: Record<string, OtpVerifyOutcome> = {
  verified: "verified",
  invalid_code: "invalid",
  expired: "expired",
  error: "error",
};

// ── GateMode derivation ─────────────────────────────────────────────────────
function deriveGateMode(funnelPhoneStatus: string | undefined, funnelPhoneE164: string | null | undefined): GateMode {
  if (funnelPhoneStatus === "otp_sent" || funnelPhoneStatus === "verified") {
    return "enter_code";
  }
  if (funnelPhoneE164) {
    return "send_code";
  }
  return "enter_phone";
}

// ── County fetcher (scan_sessions → leads.county) ────────────────────────────
function useCountyForSession(sessionId: string | undefined): string {
  const [county, setCounty] = useState("Your County");

  useEffect(() => {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!sessionId || !UUID_RE.test(sessionId)) return;
    let cancelled = false;

    async function fetchCounty() {
      try {
        // Use (supabase.rpc as any) to bypass the TypeScript "Missing Function" error
        const { data, error } = await (supabase.rpc as any)("get_county_by_scan_session", {
          p_scan_session_id: sessionId,
        });

        // Use (data as any[]) to bypass the "Property county does not exist" error
        if (cancelled || error || !data || (data as any[]).length === 0) return;

        const result = data as any[];
        setCounty(result[0].county);
      } catch (err) {
        console.warn("[ReportClassic] County fetch failed:", err);
      }
    }

    fetchCounty();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return county;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function ReportClassic() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  // ── Funnel context (safe — null when outside provider) ─────────────────
  const funnel = useScanFunnelSafe();

  // ── Render-time session gating (primary defense against stale funnel) ──
  const isSessionMatch = !!funnel?.scanSessionId && funnel.scanSessionId === sessionId;
  const gatedPhoneE164 = isSessionMatch ? funnel?.phoneE164 ?? null : null;
  const gatedPhoneStatus = isSessionMatch ? funnel?.phoneStatus : undefined;

  // ── Data loading ───────────────────────────────────────────────────────
  const {
    data: analysisData,
    isLoading,
    error,
    fetchFull,
    isLoadingFull,
    isFullLoaded,
    fullFetchError,
    tryResume,
    isResuming,
  } = useAnalysisData(sessionId ?? null, !!sessionId);

  // ── Auto-resume: dev bypass or returning verified user ─────────────
  useEffect(() => {
    if (!sessionId || isFullLoaded || isResuming || isLoading) return;
    tryResume();
  }, [sessionId, isFullLoaded, isResuming, isLoading, tryResume]);

  // ── County resolution ──────────────────────────────────────────────────
  const county = useCountyForSession(sessionId);

  // ── Access level (preview vs full) ─────────────────────────────────────
  const accessLevel = useReportAccess({ isFullLoaded });

  // ── Phone pipeline — the ONLY Twilio touchpoint ────────────────────────
  const fullFetchTriggeredRef = useRef(false);

  const pipeline = usePhonePipeline("validate_and_send_otp", {
    scanSessionId: sessionId ?? null,
    externalPhoneE164: gatedPhoneE164,
  });

  // ── OTP value state ────────────────────────────────────────────────────
  const [otpValue, setOtpValue] = useState("");

  // ── CTA post-click state ───────────────────────────────────────────────
  const [introRequested, setIntroRequested] = useState(false);
  const [reportCallRequested, setReportCallRequested] = useState(false);
  const [isCtaLoading, setIsCtaLoading] = useState(false);
  const [suggestedMatch, setSuggestedMatch] = useState<SuggestedMatch | null>(null);

  // ── Hydrate CTA state from DB on mount (prevents duplicates after refresh) ──
  useEffect(() => {
    if (!sessionId || !isFullLoaded) return;
    let cancelled = false;
    supabase
      .from("contractor_opportunities")
      .select("id, status, suggested_match_snapshot")
      .eq("scan_session_id", sessionId)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setIntroRequested(true);
        if (data.suggested_match_snapshot) {
          setSuggestedMatch(data.suggested_match_snapshot as unknown as SuggestedMatch);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, isFullLoaded]);

  // ── Gate mode derived from funnel state ────────────────────────────────
  const gateMode = deriveGateMode(gatedPhoneStatus, gatedPhoneE164);

  // ── Dev-only invariant assertion ───────────────────────────────────────
  if (import.meta.env.DEV) {
    if (gateMode === "enter_code" && !gatedPhoneE164) {
      throw new Error(
        "Invariant violation: OTP UI rendered without phone input for current session."
      );
    }
  }

  // ── Defensive cleanup effect (secondary — clears persisted stale state) ─
  useEffect(() => {
    if (funnel?.scanSessionId && funnel.scanSessionId !== sessionId) {
      console.warn("[Session Guard] Mismatch detected. Resetting stale funnel state.");
      funnel.resetFunnel();
    }
  }, [funnel?.scanSessionId, sessionId]);

  // ── Gate callbacks ─────────────────────────────────────────────────────

  const handleOtpSubmit = useCallback(async () => {
    if (otpValue.length < 6) return;
    const result = await pipeline.submitOtp(otpValue);
    const outcome = PIPELINE_TO_OUTCOME[result.status] || "error";
    if (outcome === "verified") {
      // Use server-canonical phone if available, update funnel
      if (result.e164 && funnel) {
        funnel.setPhone(result.e164, "verified");
      }
      // Trigger fetchFull directly with server-canonical phone
      if (result.e164) {
        fullFetchTriggeredRef.current = true;
        fetchFull(result.e164);
      }
      setOtpValue("");
    }
  }, [otpValue, pipeline, funnel, fetchFull]);

  const handleSendCode = useCallback(async () => {
    if (!gatedPhoneE164) return;
    const result = await pipeline.submitPhone();
    if (result.status === "otp_sent") {
      funnel?.setPhoneStatus("otp_sent");
    }
  }, [gatedPhoneE164, funnel, pipeline]);

  const handlePhoneSubmit = useCallback(async () => {
    const result = await pipeline.submitPhone();
    if (result.status === "otp_sent" && result.e164) {
      funnel?.setPhone(result.e164, "otp_sent");
    }
  }, [pipeline, funnel]);

  const handleResend = useCallback(async () => {
    await pipeline.resend({ scanSessionId: sessionId });
  }, [pipeline, sessionId]);

  // ── CTA A: Get Counter-Quote (generate-contractor-brief + voice-followup) ─
  const phoneE164 = gatedPhoneE164 || pipeline.e164 || null;

  const handleContractorMatchClick = useCallback(async () => {
    if (!sessionId || !phoneE164) {
      toast.error("Unable to process request. Please verify your phone number first.");
      return;
    }

    setIsCtaLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("generate-contractor-brief", {
        body: { scan_session_id: sessionId, phone_e164: phoneE164, cta_source: "intro_request" },
      });

      if (fnError || !data?.success) {
        console.error("[ReportClassic] brief generation failed", fnError || data);
        toast.error("Something went wrong. Please try again.");
        setIsCtaLoading(false);
        return;
      }

      if (data.suggested_match) {
        setSuggestedMatch(data.suggested_match);
      }

      // Fire public callback request (phone-verified gate, no admin auth needed)
      supabase.functions
        .invoke("request-callback", {
          body: {
            scan_session_id: sessionId,
            call_intent: "contractor_intro",
            cta_source: "intro_request",
          },
        })
        .catch((err) => console.warn("[ReportClassic] callback request failed", err));

      setIntroRequested(true);
    } catch (err) {
      console.error("[ReportClassic] unexpected error", err);
      toast.error("Connection error. Please try again.");
    } finally {
      setIsCtaLoading(false);
    }
  }, [sessionId, phoneE164]);

  // ── CTA B: Call WindowMan About My Report (voice-followup only) ────────
  const handleReportHelpCall = useCallback(async () => {
    if (!sessionId || !phoneE164) {
      toast.error("Unable to process request. Please verify your phone number first.");
      return;
    }

    setIsCtaLoading(true);
    try {
      await supabase.functions.invoke("request-callback", {
        body: {
          scan_session_id: sessionId,
          call_intent: "report_explainer",
          cta_source: "report_help",
        },
      });
      setReportCallRequested(true);
    } catch (err) {
      console.error("[ReportClassic] report help call failed", err);
      toast.error("Connection error. Please try again.");
    } finally {
      setIsCtaLoading(false);
    }
  }, [sessionId, phoneE164]);

  // ── Auto-scroll to CTA on bad grades after full load ───────────────────
  useEffect(() => {
    if (!isFullLoaded || !analysisData?.grade) return;
    const grade = analysisData.grade;
    if (["B", "C", "D", "F"].includes(grade)) {
      setTimeout(() => {
        document.getElementById("cta-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 600);
    }
  }, [isFullLoaded, analysisData?.grade]);

  const handleSecondScan = useCallback(() => {
    navigate("/");
  }, [navigate]);

  // Retry handler must be declared above early-return branches to keep
  // hook order stable across renders.
  const handleRetryFetchFull = useCallback(() => {
    if (!phoneE164) return;
    fetchFull(phoneE164);
  }, [phoneE164, fetchFull]);

  // ── Session ID guard ───────────────────────────────────────────────────
  // The Truth Report is keyed strictly by a UUID scan_session_id. If the
  // route param is missing, malformed, or not a UUID, fail loud instead of
  // spinning forever. All callers (Admin Dossier, PostScanReportSwitcher,
  // diagnosis flow) MUST pass a UUID v4 from `scan_sessions.id`.
  const SESSION_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const sessionIdValid = !!sessionId && SESSION_UUID_RE.test(sessionId);

  if (!sessionIdValid) {
    return (
      <div className="bg-background min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <h1 className="font-display text-lg font-semibold text-foreground">
            Report link is incomplete
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This Truth Report URL is missing a valid <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">session_id</code>.
            Truth Reports are keyed by a unique scan session UUID — without it,
            we can't locate the analysis.
          </p>
          {sessionId && (
            <p className="mt-2 text-xs text-muted-foreground">
              Received: <code className="break-all rounded bg-muted px-1 py-0.5 font-mono">{sessionId}</code>
            </p>
          )}
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Start a new scan
          </button>
        </div>
      </div>
    );
  }

  // ── Loading state ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="bg-background min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <p className="font-body text-sm text-muted-foreground">Loading your report...</p>
        </div>
      </div>
    );
  }

  // ── Terminal states (invalid document, failed, etc.) ─────────────────

  const TERMINAL_MESSAGES: Record<string, { title: string; body: string; cta: string }> = {
    invalid_document: {
      title: "Not a Window or Door Quote",
      body: "The document you uploaded doesn't appear to be an impact window or door contractor quote. Our scanner only analyzes quotes for impact-rated windows and doors.",
      cta: "Upload a Different Quote",
    },
    failed: {
      title: "Scan Failed",
      body: "Something went wrong while analyzing your document. This can happen with heavily formatted or image-heavy files.",
      cta: "Try Again",
    },
    error: {
      title: "Scan Error",
      body: "An unexpected error occurred during analysis. Please try uploading your quote again.",
      cta: "Try Again",
    },
    unreadable: {
      title: "Document Unreadable",
      body: "We couldn't extract enough information from this file. Try uploading a clearer photo or the original PDF.",
      cta: "Upload a Clearer Copy",
    },
  };

  const terminalStatus = analysisData?.analysisStatus;
  const terminalMsg = terminalStatus ? TERMINAL_MESSAGES[terminalStatus] : null;

  if (terminalMsg) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md px-5">
          <div className="w-16 h-16 mx-auto mb-6 rounded-none border-2 border-destructive/40 flex items-center justify-center">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="hsl(var(--destructive))"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h1 className="font-heading text-xl font-bold text-foreground uppercase tracking-wider mb-3">
            {terminalMsg.title}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-8">{terminalMsg.body}</p>
          <a
            href="/"
            className="inline-block bg-primary text-primary-foreground font-semibold text-sm px-8 py-3 rounded-none hover:bg-primary/90 transition-colors duration-150"
          >
            {terminalMsg.cta}
          </a>
        </div>
      </div>
    );
  }

  // ── Error / not-found state ────────────────────────────────────────────

  if (error || !analysisData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md px-5">
          <h1 className="font-heading text-xl font-bold text-foreground uppercase tracking-wider mb-2">
            Report Not Found
          </h1>
          <p className="text-sm text-muted-foreground mb-6">{error || "We couldn't find a report for this session."}</p>
          <a
            href="/"
            className="inline-block bg-muted border border-border text-muted-foreground text-sm font-semibold px-6 py-2.5 rounded-none hover:bg-muted/80 transition-colors duration-150"
          >
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  // ── Build gateProps for LockedOverlay ───────────────────────────────────
  // Surface fetchStalled / fullFetchError so refresh-after-OTP and any
  // post-verify RPC stall on this route get the same retry path that
  // PostScanReportSwitcher exposes on the in-page flow.

  const gateProps: Omit<LockedOverlayProps, "grade" | "flagCount"> = {
    gateMode,
    otpValue,
    onOtpChange: setOtpValue,
    onOtpSubmit: handleOtpSubmit,
    onSendCode: handleSendCode,
    phoneDisplayValue: pipeline.displayValue,
    phoneIsValid: pipeline.inputComplete,
    phoneDigitCount: pipeline.rawDigits.length,
    onPhoneChange: pipeline.handlePhoneChange,
    onPhoneSubmit: handlePhoneSubmit,
    isLoading: pipeline.phoneStatus === "sending_otp" || pipeline.phoneStatus === "verifying" || isLoadingFull,
    errorMsg: pipeline.errorMsg || fullFetchError || "",
    resendCooldown: pipeline.resendCooldown,
    onResend: handleResend,
    fetchStalled: !!fullFetchError && !isFullLoaded,
    onRetryFetchFull: handleRetryFetchFull,
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <TruthReportClassic
      grade={analysisData.grade}
      flags={analysisData.flags}
      pillarScores={analysisData.pillarScores}
      contractorName={analysisData.contractorName}
      county={county}
      confidenceScore={analysisData.confidenceScore}
      documentType={analysisData.documentType}
      accessLevel={accessLevel}
      qualityBand={analysisData.qualityBand}
      hasWarranty={analysisData.hasWarranty}
      hasPermits={analysisData.hasPermits}
      pageCount={analysisData.pageCount}
      lineItemCount={analysisData.lineItemCount}
      flagCount={analysisData.flagCount}
      flagRedCount={analysisData.flagRedCount}
      flagAmberCount={analysisData.flagAmberCount}
      onContractorMatchClick={handleContractorMatchClick}
      onReportHelpCall={handleReportHelpCall}
      onSecondScan={handleSecondScan}
      gateProps={accessLevel === "preview" ? gateProps : undefined}
      introRequested={introRequested}
      reportCallRequested={reportCallRequested}
      isCtaLoading={isCtaLoading}
      suggestedMatch={suggestedMatch}
      derivedMetrics={analysisData.derivedMetrics as any}
      warnings={analysisData.warnings}
      missingItems={analysisData.missingItems}
      summary={analysisData.summary}
      topWarning={analysisData.topWarning}
      topMissingItem={analysisData.topMissingItem}
      pricePerOpening={analysisData.pricePerOpening}
      pricePerOpeningBand={analysisData.pricePerOpeningBand}
      paymentRiskDetected={analysisData.paymentRiskDetected}
      scopeGapDetected={analysisData.scopeGapDetected}
      summaryTeaser={analysisData.summaryTeaser}
      missingItemsCount={analysisData.missingItemsCount}
    />
  );
}
