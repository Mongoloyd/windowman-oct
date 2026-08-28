import React, { useState, useEffect, useRef, useCallback } from "react";
import LinearHeader from "@/components/LinearHeader";
import AuditHero from "@/components/AuditHero";
import StickyRecoveryBar from "@/components/StickyRecoveryBar";
import StickyCTAFooter from "@/components/StickyCTAFooter";
import HomepageBackdrop from "@/components/HomepageBackdrop";
import { LazySection } from "@/components/LazySection";
import TruthGateFlow from "@/components/TruthGateFlow";
import { hasTrustedContactIdentity } from "@/lib/leadSession";
import PostCaptureRouter, { type PostCapturePath } from "@/components/PostCaptureRouter";
import UploadZone from "@/components/UploadZone";
import ScanTheatrics from "@/components/ScanTheatrics";
import { PostScanReportSwitcher } from "@/components/post-scan/PostScanReportSwitcher";

const ExitIntentPhoneModal = React.lazy(() => import("@/components/ExitIntentPhoneModal"));

// ── Below-fold: lazy-loaded to cut initial bundle ~50% ──
const SocialProofStrip = React.lazy(() => import("@/components/SocialProofStrip"));
const IndustryTruth = React.lazy(() => import("@/components/IndustryTruth"));
const ProcessSteps = React.lazy(() => import("@/components/ProcessSteps"));
const NarrativeProof = React.lazy(() => import("@/components/NarrativeProof"));
const ClosingManifesto = React.lazy(() => import("@/components/ClosingManifesto"));
const Testimonials = React.lazy(() => import("@/components/Testimonials"));
const MarketMakerManifesto = React.lazy(() => import("@/components/MarketMakerManifesto"));
const OrangeScanner = React.lazy(() => import("@/components/OrangeScanner"));
const ScamConcernImage = React.lazy(() => import("@/components/ScamConcernImage"));
const QuoteSpreadShowcase = React.lazy(() => import("@/components/QuoteSpreadShowcase"));
const Footer = React.lazy(() => import("@/components/Footer"));
import { useAnalysisData } from "@/hooks/useAnalysisData";
import { useHomepageVariant } from "@/hooks/useHomepageVariant";
import { useScanFunnel, readPersistedFunnelSnapshot } from "@/state/scanFunnel";
import { getVerifiedAccess, clearVerifiedAccess } from "@/lib/verifiedAccess";
import {
  consumeHomepageDarkV2ReportReturn,
  clearHomepageDarkV2ReportReturn,
} from "@/lib/reportDiagnosisHandoff";
import { trackEvent } from "@/lib/trackEvent";
import { useClientSlug } from "@/lib/useClientSlug";
import HomepageMicroConversionTracker from "@/components/tracking/HomepageMicroConversionTracker";

import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, RotateCcw, FileX } from "lucide-react";
import type { AnalysisData } from "@/hooks/useAnalysisData";

type DevPreviewState =
  | "none"
  | "grade_a_full"
  | "grade_c_preview"
  | "grade_d_full"
  | "grade_d_preview"
  | "grade_f_full"
  | "grade_f_preview"
  | "otp_gate"
  | "invalid_document"
  | "needs_better_upload";

type DevPreviewConfig = {
  analysisData: AnalysisData | null;
  specialState?: "invalid_document" | "needs_better_upload";
};

type DevPreviewPanelComponent = React.ComponentType<{
  currentState: DevPreviewState;
  onChange: (state: DevPreviewState) => void;
  sessionId: string | null;
  onScanStart: (fileName: string, scanId: string) => void;
}>;


const SectionReserve = ({ className = "min-h-[420px]" }: { className?: string }) => (
  <div className={`w-full bg-background ${className}`} aria-hidden="true" />
);

/**
 * UI-only resume hint: restore upload-ready homepage state after refresh when
 * ScanFunnelProvider already hydrated a trusted contact identity pair.
 * Never treats localStorage as backend authorization.
 */
export function shouldRehydrateContactUpload(input: {
  leadId: string | null | undefined;
  sessionId: string | null | undefined;
  persistedScanSessionId: string | null | undefined;
  inProductPhase: boolean;
}): boolean {
  if (input.inProductPhase) return false;
  if (input.persistedScanSessionId) return false;
  return hasTrustedContactIdentity(input.leadId, input.sessionId);
}

const Index = () => {
  // ═══ DEV MODE: Uses Vite's built-in dev/prod flag ═══
  const IS_DEV_MODE = import.meta.env.DEV;

  const variant = useHomepageVariant();

  const [devState, setDevState] = useState<DevPreviewState>("none");
  const [devPreviewPanel, setDevPreviewPanel] = useState<DevPreviewPanelComponent | null>(null);
  const [devPreviewConfigs, setDevPreviewConfigs] = useState<Record<DevPreviewState, DevPreviewConfig> | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [scanSessionId, setScanSessionId] = useState<string | null>(null);
  const [leadCaptured, setLeadCaptured] = useState(false);
  // Sprint 2F-C: after a trusted contact-owned capture, the homepage shows a
  // post-capture intent router first. Only the "upload" path mounts a usable
  // UploadZone; "upload_later"/"no_quote" are frontend-only placeholders that
  // never touch the scan/upload backend. Default "router" = show the chooser.
  const [postCapturePath, setPostCapturePath] = useState<PostCapturePath>("router");
  const [contactResumedFromFunnel, setContactResumedFromFunnel] = useState(false);
  const contactRehydrateCheckedRef = useRef(false);
  const paidLpHandoffScrollPendingRef = useRef(false);
  const [truthGateHighlight, setTruthGateHighlight] = useState(false);
  const [fileUploaded, setFileUploaded] = useState(false);
  const [gradeRevealed, setGradeRevealed] = useState(false);
  // contractorMatchVisible removed — CTAs now native in TruthReportClassic
  const [powerToolTriggered, setPowerToolTriggered] = useState(false);
  const [selectedCounty] = useState("your county");
  const [recoveryBarDismissed, setRecoveryBarDismissed] = useState(
    () => localStorage.getItem("wm_recovery_bar_dismissed") === "true",
  );
  const [scrolledPast70, setScrolledPast70] = useState(false);
  const [timeOnPage, setTimeOnPage] = useState(false);
  const [intakeResetKey, setIntakeResetKey] = useState(0);

  const funnel = useScanFunnel();

  useEffect(() => {
    if (!IS_DEV_MODE) return;

    let cancelled = false;
    Promise.all([import("@/dev/DevPreviewPanel"), import("@/dev/fixtures")]).then(([panelModule, fixtureModule]) => {
      if (cancelled) return;
      setDevPreviewPanel(() => panelModule.default);
      setDevPreviewConfigs(fixtureModule.DEV_PREVIEW_CONFIGS);
    });

    return () => {
      cancelled = true;
    };
  }, [IS_DEV_MODE]);

  // Dev preview overrides
  const isDevPreview = IS_DEV_MODE && devState !== "none";
  const devConfig = isDevPreview ? devPreviewConfigs?.[devState] ?? null : null;
  const showReportFromDev = isDevPreview && devConfig?.analysisData != null && !devConfig?.specialState;
  const {
    data: analysisData,
    v2ReportSource,
    isLoading: analysisLoading,
    error: analysisError,
    fullFetchError,
    fetchFull,
    isFullLoaded,
    isLoadingFull,
    tryResume,
    isResuming,
  } = useAnalysisData(scanSessionId, fileUploaded || !!scanSessionId);

  // ── Refresh / Return restore (homepage hijack fix) ────────────────────
  // RULE: Bare "/" must always show the marketing homepage.
  // Persisted scan/report state may be DETECTED on mount, but it must
  // never auto-take-over the homepage. Restore happens only when:
  //   - URL has ?resume=1, OR
  //   - the user clicks the "Continue previous scan" recovery CTA.
  //
  // No full report data is preloaded; useAnalysisData fetches preview only
  // until tryResume()/fetchFull() is called against the verified backend gate.
  const resumeCheckedRef = useRef(false);
  const shouldAutoResumeFullRef = useRef(false);
  const [pendingResume, setPendingResume] = useState<{
    scanSessionId: string;
    sessionId: string | null;
    phoneE164: string | null;
    hasVerified: boolean;
  } | null>(null);

  const runRestore = useCallback((opts?: { explicit?: boolean; scanSessionIdOverride?: string }) => {
    // When scanSessionIdOverride is provided (e.g., from Dark V2 return marker),
    // use it directly instead of relying on the persisted funnel snapshot.
    // This ensures we restore the exact session the user was viewing, even if
    // the snapshot is stale or from a different tab.
    const targetScanSessionId = opts?.scanSessionIdOverride ?? null;
    const snapshot = readPersistedFunnelSnapshot();
    const verified = targetScanSessionId
      ? getVerifiedAccess(targetScanSessionId)
      : getVerifiedAccess(snapshot?.scanSessionId ?? null);

    // Verified record present → restore as already-revealed
    if (verified && (opts?.scanSessionIdOverride || snapshot?.scanSessionId === verified.scan_session_id || opts?.explicit)) {
      setScanSessionId(verified.scan_session_id);
      setFileUploaded(true);
      setGradeRevealed(true);
      setLeadCaptured(true);
      shouldAutoResumeFullRef.current = true;
      setPendingResume(null);
      return true;
    }

    // In-flight scan (preview / OTP) → restore preview only.
    // Full report stays gated behind backend OTP verification.
    // Only use snapshot if no explicit override was provided.
    if (!opts?.scanSessionIdOverride && snapshot?.scanSessionId) {
      setScanSessionId(snapshot.scanSessionId);
      setFileUploaded(true);
      setGradeRevealed(true); // show report shell with locked-preview state
      if (snapshot.sessionId) setSessionId(snapshot.sessionId);
      if (snapshot.phoneE164) setLeadCaptured(true);
      setPendingResume(null);
      return true;
    }

    return false;
  }, []);

  const resetHomepageToFreshIntake = useCallback(() => {
    clearVerifiedAccess();
    clearHomepageDarkV2ReportReturn();
    funnel.clearFunnel();
    shouldAutoResumeFullRef.current = false;

    setLeadCaptured(false);
    setSessionId(null);
    setFileUploaded(false);
    setGradeRevealed(false);
    setScanSessionId(null);
    setPendingResume(null);
    setPostCapturePath("router");
    setContactResumedFromFunnel(false);
    setTruthGateHighlight(false);
    setIntakeResetKey((k) => k + 1);

    // Strip ?resume=1 from URL so a refresh stays on the hero.
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has("resume")) {
        url.searchParams.delete("resume");
        window.history.replaceState({}, "", url.toString());
      }
    } catch { /* noop */ }
  }, [funnel]);

  const handleStartOver = useCallback(() => {
    resetHomepageToFreshIntake();
  }, [resetHomepageToFreshIntake]);

  useEffect(() => {
    if (resumeCheckedRef.current) return;
    resumeCheckedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const explicitResume = params.get("resume") === "1";

    const darkV2ReturnSessionId =
      import.meta.env.VITE_ENABLE_DARK_V2_HOMEPAGE === "true"
        ? consumeHomepageDarkV2ReportReturn()
        : null;
    if (darkV2ReturnSessionId && getVerifiedAccess(darkV2ReturnSessionId)) {
      runRestore({ explicit: true, scanSessionIdOverride: darkV2ReturnSessionId });
      return;
    }

    if (explicitResume) {
      const restored = runRestore({ explicit: true });
      if (!restored) {
        // Stale ?resume=1 with no valid record → clear and fall through.
        clearVerifiedAccess();
      }
      return;
    }

    // Bare "/": only DETECT persisted state, do not auto-restore.
    const snapshot = readPersistedFunnelSnapshot();
    const verified = getVerifiedAccess(snapshot?.scanSessionId ?? null);
    if (snapshot?.scanSessionId) {
      setPendingResume({
        scanSessionId: snapshot.scanSessionId,
        sessionId: snapshot.sessionId,
        phoneE164: snapshot.phoneE164,
        hasVerified: !!verified,
      });
    }
  }, [runRestore]);

  // After scanSessionId is restored from a verified record, auto-fetch full data.
  useEffect(() => {
    if (!shouldAutoResumeFullRef.current) return;
    if (!scanSessionId || isFullLoaded || isResuming || analysisLoading) return;
    const record = getVerifiedAccess(scanSessionId);
    if (!record) {
      shouldAutoResumeFullRef.current = false;
      return;
    }
    shouldAutoResumeFullRef.current = false;
    tryResume();
  }, [scanSessionId, isFullLoaded, isResuming, analysisLoading, tryResume]);

  useEffect(() => {
    const timer = setTimeout(() => setTimeOnPage(true), 30000);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    const handleScroll = () => {
      const scrollPercent = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
      if (scrollPercent >= 0.7) setScrolledPast70(true);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const conversionType: "scan" | "account" | null =
    leadCaptured ? "account" : gradeRevealed ? "scan" : null;
  const showRecoveryBar = IS_DEV_MODE
    ? false
    : scrolledPast70 && !leadCaptured && timeOnPage && !recoveryBarDismissed && !gradeRevealed;

  const scrollToTruthGate = useCallback(() => {
    requestAnimationFrame(() => {
      const el = document.getElementById("truth-gate");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const scrollToPostCaptureRouter = () => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const anchor = document.getElementById("post-capture-router-anchor");
        if (anchor && typeof anchor.scrollIntoView === "function") {
          anchor.scrollIntoView({
            behavior: prefersReducedMotion ? "auto" : "smooth",
            block: "start",
          });
        }
      });
    });
  };

  const triggerTruthGate = (source: string) => {
    trackEvent({ event_name: "cta_scan_funnel", session_id: sessionId, metadata: { source } });
    // Destructive reset: clear previous scan state so a fresh scan starts clean
    if (gradeRevealed) {
      setGradeRevealed(false);
      setFileUploaded(false);
      setScanSessionId(null);
      clearVerifiedAccess();
    }
    scrollToTruthGate();
    setTruthGateHighlight(true);
  };

  // Auto-scroll removed — CTA auto-scroll is now handled natively in TruthReportClassic

  // Resolve active data: dev fixtures override real backend data
  const activeData = showReportFromDev ? devConfig!.analysisData : analysisData;

  // Pass real grade through; downstream components handle null/missing without inventing one.
  const reportGrade = activeData?.grade ?? "";
  const reportFlags = activeData?.flags || [];
  const shouldShowReport = showReportFromDev || gradeRevealed;

  // Discovery vs. Product boundary:
  // The homepage sticky CTA is useful while the visitor is browsing or entering the funnel.
  // Once a file is uploaded or the report shell is visible, the scanner/report experience
  // owns the screen and should not compete with a persistent sales footer.
  const isProductExperiencePhase = fileUploaded || shouldShowReport;
  const showStickyCtaFooter =
    !showRecoveryBar && !isProductExperiencePhase && !powerToolTriggered;

  // Homepage acquisition telemetry must only measure the discovery phase.
  // Once the scanner/report product experience (or a dev-preview state) owns
  // the screen, stop emitting engaged_session / scroll_depth / quality_page_view
  // so post-upload time is not counted as acquisition-page engagement.
  const shouldTrackHomepageAcquisition =
    !isProductExperiencePhase && !isDevPreview;

  const { slug: queryClientSlug, ready: clientSlugReady } = useClientSlug();

  // ── Homepage public upload mount guard (Sprint 2B-3B) ─────────────────
  // The public upload area may become usable ONLY when the homepage holds a
  // trusted contact-owned identity pair (valid leadId + sessionId). This is a
  // UI guard only — backend `start-upload-scan-session` remains the authority.
  // localStorage/funnel state is a UI resume hint, never authorization.
  const trustedContactIdentity = hasTrustedContactIdentity(
    funnel.leadId,
    sessionId ?? funnel.sessionId,
  );
  // Scan/report resume (pendingResume / ?resume=1) takes precedence over the
  // contact-upload paths below, so it is excluded from both branches.
  const inUploadIntentPhase =
    leadCaptured &&
    !fileUploaded &&
    !gradeRevealed &&
    !shouldShowReport &&
    pendingResume == null;
  // Sprint 2F-C: with a trusted pair, the intent router owns the next screen.
  // UploadZone is usable ONLY on the explicit "upload" path; the router shell
  // (chooser + upload_later/no_quote placeholders) owns every other path.
  const canMountUsableUpload =
    inUploadIntentPhase && trustedContactIdentity && postCapturePath === "upload";
  const showPostCaptureRouter =
    inUploadIntentPhase && trustedContactIdentity && postCapturePath !== "upload";
  const showContactUploadLock = inUploadIntentPhase && !trustedContactIdentity;

  // Contact-only resume + paid-LP upload handoff.
  // The paid search landing page may redirect to /?post_capture=upload&source=quote-check
  // after saving a trusted contact identity. Strip the one-time params before any
  // early return so failed/untrusted handoffs cannot loop on refresh.
  // This is a UI path hint only; UploadZone still requires trusted identity and
  // backend upload/session APIs remain authoritative.
  useEffect(() => {
    if (contactRehydrateCheckedRef.current) return;
    contactRehydrateCheckedRef.current = true;

    let handoffToUpload = false;

    try {
      const params = new URLSearchParams(window.location.search);
      handoffToUpload = params.get("post_capture") === "upload";

      if (params.has("post_capture") || params.get("source") === "quote-check") {
        params.delete("post_capture");

        if (params.get("source") === "quote-check") {
          params.delete("source");
        }

        const qs = params.toString();
        window.history.replaceState(
          window.history.state,
          "",
          `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`,
        );
      }
    } catch {
      // URL/history unavailable — fall through to normal resume behavior.
    }

    const snapshot = readPersistedFunnelSnapshot();
    const inProductPhase = handoffToUpload
      ? fileUploaded || gradeRevealed
      : fileUploaded || gradeRevealed || scanSessionId != null;
    const persistedScanSessionIdForContactResume = handoffToUpload
      ? null
      : snapshot?.scanSessionId ?? null;

    if (
      !shouldRehydrateContactUpload({
        leadId: funnel.leadId,
        sessionId: funnel.sessionId,
        persistedScanSessionId: persistedScanSessionIdForContactResume,
        inProductPhase,
      })
    ) {
      return;
    }

    setLeadCaptured(true);
    setSessionId(funnel.sessionId);

    if (handoffToUpload) {
      setPendingResume(null);
      setPostCapturePath("upload");
      paidLpHandoffScrollPendingRef.current = true;
    } else {
      setContactResumedFromFunnel(true);
      setPostCapturePath("router");
    }
  }, [funnel.leadId, funnel.sessionId, fileUploaded, gradeRevealed, scanSessionId]);

  // Paid-LP handoff lands on the homepage hero; scroll upload into view once guards pass.
  useEffect(() => {
    if (!paidLpHandoffScrollPendingRef.current || !canMountUsableUpload) return;
    paidLpHandoffScrollPendingRef.current = false;
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const uploadEl = document.querySelector('[data-testid="upload-zone"]');
        uploadEl?.scrollIntoView?.({
          behavior: prefersReducedMotion ? "auto" : "smooth",
          block: "start",
        });
      });
    });
  }, [canMountUsableUpload]);

  useEffect(() => {
    if (!clientSlugReady || !queryClientSlug || funnel.clientSlug === queryClientSlug) return;
    funnel.setClientSlug(queryClientSlug);
  }, [clientSlugReady, queryClientSlug, funnel]);

  useEffect(() => {
    const handlePowerToolHeroOpen = (event: MouseEvent) => {
      const button = (event.target as Element | null)?.closest("button");
      if (!button?.textContent?.includes("No Quote Yet? Start Here")) return;
      setPowerToolTriggered(true);
    };

    document.addEventListener("click", handlePowerToolHeroOpen, true);
    return () => document.removeEventListener("click", handlePowerToolHeroOpen, true);
  }, []);

  const otpActivePhoneStatuses = ["screened_valid", "sending_otp", "otp_sent"] as const;
  const suppressExitIntent =
    fileUploaded ||
    gradeRevealed ||
    analysisLoading ||
    isLoadingFull ||
    isResuming ||
    shouldShowReport ||
    showReportFromDev ||
    isDevPreview ||
    powerToolTriggered ||
    truthGateHighlight ||
    pendingResume != null ||
    otpActivePhoneStatuses.includes(
      funnel.phoneStatus as (typeof otpActivePhoneStatuses)[number],
    );

  return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        {shouldTrackHomepageAcquisition ? (
          <HomepageMicroConversionTracker />
        ) : null}
        <HomepageBackdrop />
        <div className="relative z-10">
          <LinearHeader onCtaClick={() => triggerTruthGate("header_cta")} />

          {/* ─── DEV: Special states (invalid doc, bad upload) ─── */}
          {isDevPreview && devConfig?.specialState === "invalid_document" && (
            <div className="max-w-2xl mx-auto py-20 px-4 text-center">
              <div
                style={{
                  background: "white",
                  border: "1.5px solid #FECACA",
                  borderRadius: 14,
                  padding: "40px 32px",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    background: "#FEF2F2",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px",
                  }}
                >
                  <FileX size={28} style={{ color: "#DC2626" }} />
                </div>
                <p
                  style={{
                    fontFamily: "'Jost', sans-serif",
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#0F1F35",
                    marginBottom: 8,
                  }}
                >
                  This Doesn't Appear to Be a Window Quote
                </p>
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 15,
                    color: "#6B7280",
                    lineHeight: 1.7,
                    marginBottom: 24,
                  }}
                >
                  Our Scanner Analyzed Your Document But Couldn't Identify It As A Window or Door Quote. This Might Be A
                  General Invoice, Contract, or Unrelated Document.
                </p>
                <button
                  onClick={() => setDevState("none")}
                  style={{
                    background: "#0F1F35",
                    color: "white",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 15,
                    fontWeight: 700,
                    padding: "14px 32px",
                    borderRadius: 10,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <span className="flex items-center gap-2 justify-center">
                    <RotateCcw size={16} /> Upload a Different Document
                  </span>
                </button>
              </div>
            </div>
          )}

          {isDevPreview && devConfig?.specialState === "needs_better_upload" && (
            <div className="max-w-2xl mx-auto py-20 px-4 text-center">
              <div
                style={{
                  background: "white",
                  border: "1.5px solid #FDE68A",
                  borderRadius: 14,
                  padding: "40px 32px",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    background: "#FFFBEB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px",
                  }}
                >
                  <AlertTriangle size={28} style={{ color: "#D97706" }} />
                </div>
                <p
                  style={{
                    fontFamily: "'Jost', sans-serif",
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#0F1F35",
                    marginBottom: 8,
                  }}
                >
                  We Need a Clearer Image
                </p>
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 15,
                    color: "#6B7280",
                    lineHeight: 1.7,
                    marginBottom: 16,
                  }}
                >
                  The uploaded File is Too Blurry or Low-Resolution For Our Scanner To Read Accurately. For best
                  Results:
                </p>
                <ul
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 14,
                    color: "#374151",
                    textAlign: "left",
                    maxWidth: 360,
                    margin: "0 auto 24px",
                    lineHeight: 2,
                  }}
                >
                  <li>📄 Use the original PDF if you have one</li>
                  <li>📸 Take a photo in good lighting, flat on a table</li>
                  <li>🔍 Make sure all text is legible and not cut off</li>
                </ul>
                <button
                  onClick={() => setDevState("none")}
                  style={{
                    background: "#0F1F35",
                    color: "white",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 15,
                    fontWeight: 700,
                    padding: "14px 32px",
                    borderRadius: 10,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <span className="flex items-center gap-2 justify-center">
                    <RotateCcw size={16} /> Try Again
                  </span>
                </button>
              </div>
            </div>
          )}

          {!shouldShowReport && !isDevPreview && pendingResume && (
            <div className="max-w-3xl mx-auto px-4 pt-4">
              <div
                role="region"
                aria-label="Unfinished scan"
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm px-4 py-3 shadow-sm"
              >
                <div className="text-sm text-foreground">
                  <span className="font-semibold">You have an unfinished scan.</span>{" "}
                  <span className="text-muted-foreground">
                    {pendingResume.hasVerified
                      ? "Continue to your verified report?"
                      : "Continue where you left off?"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => runRestore({ explicit: true })}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    Continue scan
                  </button>
                  <button
                    onClick={handleStartOver}
                    className="px-4 py-2 rounded-lg border border-border/60 bg-background text-muted-foreground text-sm font-medium hover:text-foreground hover:border-border transition-colors"
                  >
                    Start over
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── Normal acquisition flow (hidden when dev preview active) ─── */}
          {!shouldShowReport && !isDevPreview && (
            <>
              <div className="min-h-[80vh]">
                <div key="flow-a-hero">
                  <AuditHero
                    onUploadQuote={() => triggerTruthGate("hero_scan_cta")}
                    triggerPowerTool={powerToolTriggered}
                    onPowerToolClose={() => setPowerToolTriggered(false)}
                    variantHeadline={variant.headline}
                    variantSubheadline={variant.subheadline}
                    variantBadgeText={variant.badgeText}
                  />
                </div>
              </div>

              <>
                <LazySection height="760px" rootMargin="0px" skeleton={true}>
                  <ScamConcernImage />
                  <OrangeScanner
                    onScanClick={() => triggerTruthGate("demo_scan")}
                    onDemoClick={() => {
                      setPowerToolTriggered(true);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  />
                </LazySection>
                <div className="scroll-mt-24">
                  <TruthGateFlow
                    key={intakeResetKey}
                    onLeadCaptured={(sid) => {
                      setLeadCaptured(true);
                      setSessionId(sid);
                      // Fresh capture lands on the intent router, not UploadZone.
                      setPostCapturePath("router");
                      setPendingResume(null);
                      scrollToPostCaptureRouter();
                    }}
                    highlight={truthGateHighlight}
                    onHighlightDone={() => setTruthGateHighlight(false)}
                  />
                </div>
                {showPostCaptureRouter ? (
                  <PostCaptureRouter
                    selectedPath={postCapturePath}
                    onSelectPath={setPostCapturePath}
                    onUploadNow={() => setPostCapturePath("upload")}
                  />
                ) : null}
                {canMountUsableUpload && contactResumedFromFunnel ? (
                  <div
                    className="mx-auto mt-6 max-w-2xl rounded-lg border border-border/60 bg-card/80 px-4 py-3 text-center shadow-sm"
                    role="status"
                  >
                    <p className="font-body text-sm font-medium text-foreground">
                      You&apos;re ready to upload your quote.
                    </p>
                    <p className="mt-1 font-body text-xs text-muted-foreground">
                      We saved your place from your last step.
                    </p>
                  </div>
                ) : null}
                {showContactUploadLock ? (
                  <div
                    className="mx-auto mt-6 max-w-2xl rounded-2xl border border-border/60 bg-card/80 px-6 py-8 text-center shadow-sm"
                    role="status"
                  >
                    <h3 className="font-display text-xl font-extrabold tracking-[0.01em] text-foreground sm:text-2xl">
                      Don&rsquo;t let a window quote sit unchecked
                    </h3>
                    <p className="mx-auto mt-3 max-w-xl font-body text-sm leading-relaxed text-muted-foreground">
                      Start a free quote check in under a minute. We&rsquo;ll save your place,
                      then you can upload your estimate when it&rsquo;s ready.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        scrollToTruthGate();
                        setTruthGateHighlight(true);
                      }}
                      className="mt-5 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 font-body text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      Start Free
                    </button>
                  </div>
                ) : null}
                <UploadZone
                  isVisible={canMountUsableUpload}
                  sessionId={sessionId ?? funnel.sessionId ?? undefined}
                  leadId={funnel.leadId}
                  onUploadReset={() => {
                    setScanSessionId(null);
                    setFileUploaded(false);
                  }}
                  onScanStart={(_fileName, ssId) => {
                    trackEvent({ event_name: "scan_started", session_id: ssId, metadata: { file_name: _fileName } });
                    setScanSessionId(ssId);
                    setFileUploaded(true);
                  }}
                />
                <LazySection height="640px" rootMargin="0px" skeleton={true}>
                  <ProcessSteps
                    onScanClick={() => triggerTruthGate("process_steps")}
                    onDemoClick={() => {
                      setPowerToolTriggered(true);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  />
                  <div className="mt-24">
                    <SocialProofStrip />
                  </div>
                </LazySection>
              </>
            </>
          )}

          {fileUploaded && !gradeRevealed && !isDevPreview && (
            <ScanTheatrics
              isActive={true}
              selectedCounty={selectedCounty}
              scanSessionId={scanSessionId}
              grade={analysisData?.grade}
              analysisData={analysisData}
              onRevealComplete={() => {
                setGradeRevealed(true);
                setTimeout(() => {
                  document.getElementById("truth-report-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 100);
              }}
              onInvalidDocument={() => {
                setFileUploaded(false);
                setScanSessionId(null);
              }}
              onNeedsBetterUpload={() => {
                setFileUploaded(false);
                setScanSessionId(null);
              }}
            />
          )}

          {/* ─── Report view (real or dev fixture) ─── */}
          {shouldShowReport && (
            <>
              <div id="truth-report-top" className="max-w-4xl mx-auto px-4 pt-4 flex justify-end">
                <button
                  onClick={resetHomepageToFreshIntake}
                  className="group flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border/60 bg-card/80 backdrop-blur-sm text-muted-foreground text-sm font-medium transition-all duration-200 hover:border-primary/40 hover:text-primary hover:shadow-[0_0_12px_hsl(var(--primary)/0.15)]"
                >
                  <RotateCcw size={14} className="transition-transform duration-300 group-hover:-rotate-180" />
                  Start New Scan
                </button>
              </div>
            </>
          )}
          {shouldShowReport && (
            <>
              {!showReportFromDev && analysisLoading ? (
                <div className="max-w-4xl mx-auto py-16 px-4 space-y-6">
                  <div className="flex flex-col items-center gap-4">
                    <Skeleton className="w-[120px] h-[120px] rounded-full" />
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-72" />
                  </div>
                  <Skeleton className="h-32 w-full rounded-xl" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                </div>
              ) : !showReportFromDev && !analysisData ? (
                <div className="max-w-2xl mx-auto py-20 px-4 text-center">
                  <div className="rounded-xl border border-border bg-card p-8">
                    <p className="text-lg font-semibold text-foreground mb-2">Analysis Not Found</p>
                    <p className="text-sm text-muted-foreground mb-6">
                      {analysisError ||
                        "We couldn't locate the analysis for this scan. The scan may still be processing."}
                    </p>
                    <button
                      onClick={() => triggerTruthGate("retry_after_error")}
                      className="px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
                    >
                      Try Scanning Again
                    </button>
                  </div>
                </div>
              ) : activeData ? (
                <PostScanReportSwitcher
                  grade={reportGrade}
                  flags={reportFlags}
                  pillarScores={activeData.pillarScores}
                  contractorName={activeData.contractorName}
                  county={selectedCounty}
                  confidenceScore={activeData.confidenceScore}
                  documentType={activeData.documentType}
                  analysisId={activeData?.analysisId ?? null}
                  qualityBand={activeData.qualityBand}
                  hasWarranty={activeData.hasWarranty}
                  hasPermits={activeData.hasPermits}
                  pageCount={activeData.pageCount}
                  lineItemCount={activeData.lineItemCount}
                  onSecondScan={() => triggerTruthGate("second_opinion_scan")}
                  scanSessionId={scanSessionId}
                  flagCount={activeData?.flagCount}
                  flagRedCount={activeData?.flagRedCount}
                  flagAmberCount={activeData?.flagAmberCount}
                  isFullLoaded={isFullLoaded}
                  isLoadingFull={isLoadingFull}
                  fullFetchError={fullFetchError}
                  priceFairness={activeData?.priceFairness}
                  markupEstimate={activeData?.markupEstimate}
                  negotiationLeverage={activeData?.negotiationLeverage}
                  derivedMetrics={activeData.derivedMetrics as any}
                  warnings={activeData.warnings}
                  missingItems={activeData.missingItems}
                  summary={activeData.summary}
                  topWarning={activeData.topWarning}
                  topMissingItem={activeData.topMissingItem}
                  pricePerOpening={activeData.pricePerOpening}
                  pricePerOpeningBand={activeData.pricePerOpeningBand}
                  paymentRiskDetected={activeData.paymentRiskDetected}
                  scopeGapDetected={activeData.scopeGapDetected}
                  summaryTeaser={activeData.summaryTeaser}
                  missingItemsCount={activeData.missingItemsCount}
                  analysisData={activeData}
                  v2ReportSource={v2ReportSource}
                  isResuming={isResuming}
                  onVerified={(phoneE164: string) => {
                    fetchFull(phoneE164);
                  }}
                />
              ) : null}
            </>
          )}

          {!shouldShowReport && !isDevPreview && (
            <>
              <LazySection height="760px" rootMargin="900px 0px" skeleton={true}>
                <QuoteSpreadShowcase
                  onScanClick={() => triggerTruthGate("quote_spread")}
                  onDemoClick={() => {
                    setPowerToolTriggered(true);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              </LazySection>
              <LazySection height="980px" rootMargin="900px 0px" skeleton={true}>
                <IndustryTruth
                  onScanClick={() => triggerTruthGate("industry_truth")}
                  onDemoClick={() => {
                    setPowerToolTriggered(true);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              </LazySection>
              <LazySection height="760px" rootMargin="900px 0px" skeleton={true}>
                <MarketMakerManifesto
                  onDemoClick={() => {
                    setPowerToolTriggered(true);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              </LazySection>
              <LazySection height="760px" rootMargin="900px 0px" skeleton={true}>
                <NarrativeProof
                  onScanClick={() => triggerTruthGate("narrative_proof")}
                  onDemoClick={() => {
                    setPowerToolTriggered(true);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              </LazySection>
              <LazySection height="560px" rootMargin="900px 0px" skeleton={true}>
                <ClosingManifesto
                  onScanClick={() => triggerTruthGate("closing_manifesto")}
                  onDemoClick={() => {
                    setPowerToolTriggered(true);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              </LazySection>
              <LazySection height="620px" rootMargin="900px 0px" skeleton={true}>
                <Testimonials onScanClick={() => triggerTruthGate("testimonials")} />
              </LazySection>
            </>
          )}

          {(timeOnPage || scrolledPast70) && !suppressExitIntent && (
            <React.Suspense fallback={null}>
              <ExitIntentPhoneModal
              suppressExitIntent={suppressExitIntent}
              stepsCompleted={0}
              flowMode="A"
              leadCaptured={leadCaptured}
              flowBLeadCaptured={false}
              county={selectedCounty}
              answers={{
                windowCount: null,
                projectType: null,
                county: selectedCounty !== "your county" ? selectedCounty : null,
                quoteStage: null,
                firstName: null,
                email: null,
                phone: null,
              }}
              onClose={() => {}}
              onCTAClick={() => {
                setPowerToolTriggered(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              />
            </React.Suspense>
          )}

          <StickyRecoveryBar
            stepsCompleted={0}
            county={selectedCounty}
            isVisible={showRecoveryBar}
            onDismiss={() => setRecoveryBarDismissed(true)}
            onDemoCTAClick={() => {
              setPowerToolTriggered(true);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            leadCaptured={leadCaptured}
            isDevMode={IS_DEV_MODE}
            gradeRevealed={gradeRevealed}
            onContractorMatchClick={() => {
              document.getElementById("cta-section")?.scrollIntoView({ behavior: "smooth" });
            }}
          />

          <StickyCTAFooter
            onScanClick={() => triggerTruthGate("sticky_footer")}
            onDemoClick={() => {
              setPowerToolTriggered(true);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onPostConversionClick={() => {
              window.location.href = "tel:+15614685571";
            }}
            isVisible={showStickyCtaFooter}
            conversionType={conversionType}
          />

          {/* Dev-only preview panel */}
          {IS_DEV_MODE && devPreviewPanel && (
            React.createElement(devPreviewPanel, {
              currentState: devState,
              onChange: setDevState,
              sessionId,
              onScanStart: (fileName: string, scanId: string) => {
                if (devState !== "none") setDevState("none");
                setScanSessionId(scanId);
                setFileUploaded(true);
                requestAnimationFrame(() => {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                });
              },
            })
          )}
          <div className="bg-card pb-[240px] sm:pb-[180px] lg:pb-32">
            <React.Suspense fallback={null}>
              <LazySection height="280px" rootMargin="600px 0px" skeleton={false}>
                <Footer />
              </LazySection>
            </React.Suspense>
          </div>
        </div>
      </div>
  );
};

export default Index;
