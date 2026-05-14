import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useScanPolling, ScanStatus } from "@/hooks/useScanPolling";
import { toast } from "sonner";
import type { AnalysisData, PillarScore } from "@/hooks/useAnalysisData";
import { usePhonePipeline } from "@/hooks/usePhonePipeline";
import type { PipelineStartResult } from "@/hooks/usePhonePipeline";
import { useScanFunnelSafe } from "@/state/scanFunnel";

// ── Grade palette ─────────────────────────────────────────────────────────────

const GRADE_COLORS: Record<string, string> = {
  A: "#059669",
  B: "#84CC16",
  C: "#FB923C",
  D: "#F87171",
  F: "#991B1B",
};

const GRADE_MESSAGES: Record<string, string> = {
  A: "Your quote scored an A.",
  B: "Your quote scored a B.",
  C: "Your quote scored a C.",
  D: "Your quote scored a D.",
  F: "Your quote scored an F.",
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface ScanTheatricsProps {
  isActive: boolean;
  selectedCounty?: string;
  scanSessionId?: string | null;
  grade?: string;
  analysisData?: AnalysisData | null;
  onRevealComplete?: () => void;
  onInvalidDocument?: () => void;
  onNeedsBetterUpload?: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

function buildTerminalSteps(data: AnalysisData | null | undefined, county: string) {
  const items = data?.lineItemCount ?? null;
  const pages = data?.pageCount ?? 1;
  const brand = data?.contractorName ?? null;
  const countyLabel = county && county !== "your" ? county : "{county}";
  const flagCount = data?.flagCount ?? null;

  const itemStr = items != null ? `${items} line_items from ${pages}-page document` : "line_items from page_1";
  const brandStr = brand ? `brand: ${brand}` : "brand_specs in document";
  const flagStr = flagCount != null ? `${flagCount} flags compiled` : "flag_report";

  return [
    { cmd: `> EXTRACT ${itemStr}`, done: `> EXTRACT ${itemStr}... [OK]` },
    { cmd: `> ID ${brandStr}`, done: `> ID ${brandStr}... [OK]` },
    { cmd: `> LOAD market_data/${countyLabel}`, done: `> LOAD market_data/${countyLabel}... [OK]` },
    { cmd: "> SCAN warranty_blocks + permit_lang", done: "> SCAN warranty_blocks + permit_lang... [OK]" },
    { cmd: "> CALC market_delta", done: "> CALC market_delta... [OK]" },
    { cmd: `> COMPILE ${flagStr}`, done: `> COMPILE ${flagStr}... [OK]` },
    { cmd: "> GENERATE grade_score", done: "> GENERATE grade_score... [OK]" },
  ];
}

// Forensic bounding box markers revealed on the document silhouette as each step completes
const FORENSIC_MARKERS: { x: number; y: number; w: number; h: number; label: string; color: string }[] = [
  { x: 8, y: 31, w: 54, h: 11, label: "LINE_ITEMS", color: "#FB923C" },
  { x: 8, y: 13, w: 40, h: 10, label: "BRAND_SPEC", color: "#60A5FA" },
  { x: 56, y: 48, w: 36, h: 15, label: "PRICING", color: "#FB923C" },
  { x: 8, y: 61, w: 55, h: 11, label: "WARRANTY", color: "#60A5FA" },
  { x: 56, y: 13, w: 36, h: 10, label: "TOTAL_COST", color: "#FB923C" },
  { x: 8, y: 48, w: 42, h: 10, label: "RED_FLAGS", color: "#F87171" },
  { x: 8, y: 77, w: 50, h: 10, label: "GRADE_CALC", color: "#059669" },
];

/** Milliseconds between each typed character in the forensic terminal. */
const TYPEWRITER_CHAR_DELAY_MS = 30;

// Pulsar hotspot positions on the document silhouette (% of container)
const PULSAR_POSITIONS = [
  { x: 62, y: 36, label: "⚑ FLAG DETECTED" },
  { x: 28, y: 62, label: "⚠ REVIEW NEEDED" },
  { x: 74, y: 66, label: "⚑ FLAG DETECTED" },
];

// Canonical 5-pillar definitions — order and keys are authoritative
const CANONICAL_PILLAR_DEFS = [
  {
    key: "safety_code",
    label: "SAFETY & CODE MATCH",
    text: "Verifying NOA/DP rating compliance for {county}...",
    accentColor: "#60A5FA",
    delay: 0.3,
  },
  {
    key: "install_scope",
    label: "INSTALL & SCOPE CLARITY",
    text: "Checking installation scope and opening details...",
    accentColor: "#FB923C",
    delay: 0.8,
  },
  {
    key: "price_fairness",
    label: "PRICE FAIRNESS",
    text: "Benchmarking against {county} county market data...",
    accentColor: "#60A5FA",
    delay: 1.4,
  },
  {
    key: "fine_print",
    label: "FINE PRINT & TRANSPARENCY",
    text: "Reviewing permit inclusion and payment schedule...",
    accentColor: "#FB923C",
    delay: 2.0,
  },
  {
    key: "warranty",
    label: "WARRANTY VALUE",
    text: "Reviewing labor and manufacturer warranty language...",
    accentColor: "#60A5FA",
    delay: 2.6,
  },
];

// ── Phase type ────────────────────────────────────────────────────────────────

type Phase = "scanning" | "cliffhanger" | "pillars" | "reveal";

// ── Pillar helpers ────────────────────────────────────────────────────────────

function pillarStatusColor(status: PillarScore["status"]): string {
  switch (status) {
    case "pass":
      return "#059669";
    case "warn":
      return "#FB923C";
    case "fail":
      return "#F87171";
    default:
      return "#D1D5DB";
  }
}

function pillarStatusBadge(status: PillarScore["status"]): string {
  switch (status) {
    case "pass":
      return "✓ PASS";
    case "warn":
      return "⚠ WARN";
    case "fail":
      return "✗ FAIL";
    default:
      return "··· PENDING";
  }
}

// ── Main component ────────────────────────────────────────────────────────────

const ScanTheatrics = ({
  isActive,
  selectedCounty = "your",
  scanSessionId = null,
  grade: gradeProp = "C",
  analysisData = null,
  onRevealComplete,
  onInvalidDocument,
  onNeedsBetterUpload,
}: ScanTheatricsProps) => {
  const funnel = useScanFunnelSafe();
  const resolvedScanSessionId = scanSessionId ?? funnel?.scanSessionId ?? null;
  const pipeline = usePhonePipeline("validate_and_send_otp", {
    scanSessionId: resolvedScanSessionId,
    externalPhoneE164: funnel?.phoneE164 ?? null,
  });

  const autoSendGuardRef = useRef<Set<string>>(new Set());
  const activeGuardKeyRef = useRef<string | null>(null);
  const submitPhoneRef = useRef<(() => Promise<PipelineStartResult>) | null>(null);

  const [phase, setPhase] = useState<Phase>("scanning");
  const [activeLogIndex, setActiveLogIndex] = useState(0);
  const [progressWidth, setProgressWidth] = useState(0);
  const [pillarsDone, setPillarsDone] = useState<boolean[]>([false, false, false, false, false]);
  const [showGrade, setShowGrade] = useState(false);
  const [scanningMinDone, setScanningMinDone] = useState(false);

  const timersRef = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);

  // Stable reduced-motion check — evaluated once on first render
  const prefersReducedMotion = useRef(
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  ).current;

  const { status: scanStatus, error: pollError } = useScanPolling({
    scanSessionId: isActive ? resolvedScanSessionId : null,
  });

  // Keep submitPhone ref stable
  useEffect(() => {
    submitPhoneRef.current = pipeline.submitPhone;
  }, [pipeline.submitPhone]);

  /**
   * OTP auto-send — fires once per (scanSessionId, phoneE164) while active.
   * Relevance guard prevents stale writes after unmount/handoff.
   */
  useEffect(() => {
    if (!isActive) return;
    if (!funnel?.phoneE164 || !resolvedScanSessionId) return;
    const isValidQuote = scanStatus === "preview_ready" || scanStatus === "complete";
    if (!isValidQuote) return;
    if (funnel.phoneStatus !== "screened_valid") return;

    const guardKey = `${resolvedScanSessionId}|${funnel.phoneE164}`;
    if (autoSendGuardRef.current.has(guardKey)) return;
    autoSendGuardRef.current.add(guardKey);
    activeGuardKeyRef.current = guardKey;
    funnel.setPhoneStatus("sending_otp");

    (async () => {
      try {
        const result = await submitPhoneRef.current?.();
        if (!result) return;
        if (activeGuardKeyRef.current !== guardKey) return;
        if (result.status === "otp_sent") {
          funnel.setPhoneStatus("otp_sent");
        } else {
          funnel.setPhoneStatus("send_failed");
        }
      } catch (err) {
        console.error("[ScanTheatrics] auto-send failed:", err);
        if (activeGuardKeyRef.current === guardKey) {
          funnel.setPhoneStatus("send_failed");
        }
      }
    })();

    // Intentionally no cleanup that suppresses terminal state writes.
  }, [isActive, resolvedScanSessionId, scanStatus, funnel?.phoneE164, funnel?.setPhoneStatus]);

  // ── Timer / RAF cleanup helpers ──────────────────────────────────────────

  const cancelRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const clearAll = useCallback(() => {
    clearTimers();
    cancelRaf();
  }, [clearTimers, cancelRaf]);

  const addTimer = (fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  };

  // ── isActive reset + start ───────────────────────────────────────────────

  useEffect(() => {
    if (!isActive) {
      clearAll();
      setPhase("scanning");
      setActiveLogIndex(0);
      setProgressWidth(0);
      setPillarsDone([false, false, false, false, false]);
      setShowGrade(false);
      setScanningMinDone(false);
      return;
    }
    startScanning();
    return clearAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // ── Scan status gate ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!isActive) return;
    if (scanStatus === "invalid_document") {
      toast.error("This doesn't appear to be an impact window or door quote. Please upload a contractor quote.");
      clearAll();
      onInvalidDocument?.();
      return;
    }
    if (scanStatus === "needs_better_upload") {
      toast.error("We couldn't read this file clearly enough. Please upload a higher quality scan or photo.");
      clearAll();
      onNeedsBetterUpload?.();
      return;
    }
    if (scanStatus === "error") {
      toast.error("Something went wrong with the scan. Please try again.");
      clearAll();
      onNeedsBetterUpload?.();
      return;
    }
    if ((scanStatus === "preview_ready" || scanStatus === "complete") && scanningMinDone && phase === "scanning") {
      setActiveLogIndex(6);
      setProgressWidth(100);
      setPhase("cliffhanger");
      addTimer(() => startPillars(), 2000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanStatus, scanningMinDone, phase, isActive]);

  useEffect(() => {
    if (pollError) toast.error(pollError);
  }, [pollError]);

  // ── Scanning phase ───────────────────────────────────────────────────────

  const startScanning = () => {
    setPhase("scanning");
    setActiveLogIndex(0);
    setProgressWidth(0);
    setScanningMinDone(false);

    if (!prefersReducedMotion) {
      const startTime = performance.now();
      const animateProgress = () => {
        const elapsed = performance.now() - startTime;
        const pct = Math.min((elapsed / 8000) * 99, 99);
        setProgressWidth(pct);
        if (pct < 99) {
          rafRef.current = requestAnimationFrame(animateProgress);
        } else {
          rafRef.current = null;
        }
      };
      rafRef.current = requestAnimationFrame(animateProgress);
    } else {
      // Reduced-motion: skip to near-full immediately
      setProgressWidth(99);
    }

    for (let i = 1; i <= 6; i++) {
      addTimer(() => setActiveLogIndex(i), i * 1200);
    }
    addTimer(() => setScanningMinDone(true), 8000);
  };

  // ── Pillars + reveal phase ───────────────────────────────────────────────

  const startPillars = () => {
    setPhase("pillars");
    setPillarsDone([false, false, false, false, false]);
    setShowGrade(false);

    CANONICAL_PILLAR_DEFS.forEach((def, i) => {
      addTimer(
        () => {
          setPillarsDone((prev) => {
            const next = [...prev];
            next[i] = true;
            return next;
          });
        },
        (def.delay + 1.2) * 1000,
      );
    });

    // Transition to reveal phase
    addTimer(() => {
      setShowGrade(true);
      setPhase("reveal");
    }, 5000);

    addTimer(() => {
      console.log({ event: "wm_grade_revealed" });
      onRevealComplete?.();
    }, 7000);
  };

  // ── Render guards ────────────────────────────────────────────────────────

  const county = selectedCounty;
  if (!isActive) return null;

  const gradeColor = GRADE_COLORS[gradeProp] || GRADE_COLORS.C;

  // Pulsar count — derived from real aggregate flag counts only
  const pulsarCount = Math.min(3, Math.max(0, (analysisData?.flagRedCount ?? 0) + (analysisData?.flagAmberCount ?? 0)));

  // Issue count for cliffhanger counter (capped to prevent overflow)
  const issueCount = Math.min((analysisData?.flagRedCount ?? 0) + (analysisData?.flagAmberCount ?? 0), 99);

  // Build resolved pillar slices from live analysisData with canonical fallback
  const scoreMap = new Map<string, PillarScore>();
  if (analysisData?.pillarScores) {
    for (const ps of analysisData.pillarScores) {
      if (ps?.key) scoreMap.set(ps.key, ps);
    }
  }
  const resolvedPillarSlices = CANONICAL_PILLAR_DEFS.map((def) => {
    const live = scoreMap.get(def.key);
    return {
      ...def,
      score: live?.score ?? null,
      pillarStatus: live?.status ?? ("pending" as const),
    };
  });

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "#0A0A0A",
        zIndex: 9000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      <AnimatePresence mode="wait">
        {/* ── Scanning / Cliffhanger ─────────────────────────────────── */}
        {(phase === "scanning" || phase === "cliffhanger") && (
          <motion.div
            key="scanning"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ maxWidth: 720, width: "100%" }}
          >
            <div style={{ marginBottom: 18, textAlign: "center" }}>
              <p
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#93C5FD",
                  letterSpacing: "0.28em",
                  marginBottom: 6,
                  textTransform: "uppercase",
                }}
              >
                WindowMan AI
              </p>
              <p
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#F3F4F6",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  textShadow: "0 0 24px rgba(96,165,250,0.25)",
                }}
              >
                Forensic Document Analysis
              </p>
            </div>

            {/* Two-panel: doc silhouette (left) + forensic terminal (right) */}
            <div className="flex flex-col md:flex-row" style={{ gap: 10, width: "100%" }}>
              <div className="flex justify-center md:block md:flex-shrink-0">
                <DocumentSilhouette
                  markerCount={phase === "scanning" ? activeLogIndex : FORENSIC_MARKERS.length}
                  showPulsars={phase === "cliffhanger"}
                  pulsarCount={pulsarCount}
                  dimmed={phase === "cliffhanger"}
                  isScanning={phase === "scanning"}
                  reducedMotion={prefersReducedMotion}
                />
              </div>
              <ForensicTerminal
                steps={buildTerminalSteps(analysisData, county)}
                activeIndex={activeLogIndex}
                county={county}
                progressWidth={progressWidth}
                isCliffhanger={phase === "cliffhanger"}
                reducedMotion={prefersReducedMotion}
              />
            </div>

            {/* Cliffhanger: proof-of-read chips + findings counter */}
            {phase === "cliffhanger" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.3 }}
                style={{ marginTop: 12 }}
              >
                {/* Proof-of-read — truthful, evidence-based signals only */}
                {analysisData && (
                  <div
                    style={{
                      background: "#111111",
                      border: "1px solid #1A1A1A",
                      padding: "12px 16px",
                      marginBottom: 10,
                    }}
                  >
                    <div className="flex flex-wrap gap-3 mb-2">
                      {analysisData.documentType && (
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#9CA3AF" }}>
                          Detected:{" "}
                          {analysisData.documentType.charAt(0).toUpperCase() + analysisData.documentType.slice(1)}
                        </span>
                      )}
                      {analysisData.contractorName && (
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#9CA3AF" }}>
                          Contractor: {analysisData.contractorName}
                        </span>
                      )}
                      {analysisData.lineItemCount != null && analysisData.lineItemCount > 0 && (
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#9CA3AF" }}>
                          {analysisData.lineItemCount} line item{analysisData.lineItemCount === 1 ? "" : "s"}
                        </span>
                      )}
                      {analysisData.openingCount != null && analysisData.openingCount > 0 && (
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#9CA3AF" }}>
                          {analysisData.openingCount} opening{analysisData.openingCount === 1 ? "" : "s"}
                        </span>
                      )}
                      {analysisData.pageCount != null && analysisData.pageCount > 1 && (
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#9CA3AF" }}>
                          {analysisData.pageCount}-page document
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <OcrQualityBadge confidenceScore={analysisData.confidenceScore} data={analysisData} />
                      {issueCount > 0 && <FindingsCounter issues={issueCount} />}
                    </div>
                  </div>
                )}
                <p
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 13,
                    color: "#FB923C",
                    letterSpacing: "0.06em",
                    textAlign: "center",
                  }}
                >
                  Data extracted successfully. Analysis ready to compile.
                </p>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ── Pillars / Grade reveal ────────────────────────────────── */}
        {(phase === "pillars" || phase === "reveal") && (
          <motion.div
            key="pillars"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
            style={{ maxWidth: 520, width: "100%", textAlign: "center" }}
          >
            <AnimatePresence mode="wait">
              {!showGrade ? (
                <motion.div key="pillar-slices" exit={{ opacity: 0, transition: { duration: 0.2 } }}>
                  <p
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#93C5FD",
                      letterSpacing: "0.18em",
                      marginBottom: 18,
                    }}
                  >
                    DECONSTRUCTING DOCUMENT · 5 PILLARS
                  </p>
                  {resolvedPillarSlices.map((pillar, i) => (
                    <PillarSlice
                      key={pillar.key}
                      index={i}
                      label={pillar.label}
                      text={pillar.text}
                      accentColor={pillar.accentColor}
                      delay={pillar.delay}
                      score={pillar.score}
                      pillarStatus={pillar.pillarStatus}
                      isDone={pillarsDone[i]}
                      county={county}
                      reducedMotion={prefersReducedMotion}
                    />
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="grade-reveal"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-col items-center"
                >
                  {/* Grade box — glitch flicker materialisation */}
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: [0, 1.08, 1], opacity: [0, 1, 0.4, 1, 0.7, 1] }}
                    transition={{
                      duration: prefersReducedMotion ? 0.15 : 0.45,
                      times: [0, 0.5, 0.6, 0.7, 0.85, 1],
                    }}
                    style={{ position: "relative" }}
                  >
                    {/* Radial glow pulse */}
                    {!prefersReducedMotion && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: [0, 0.35, 0], scale: [0.5, 2.2, 2.8] }}
                        transition={{ duration: 0.9, delay: 0.25 }}
                        style={{
                          position: "absolute",
                          inset: -40,
                          borderRadius: "50%",
                          background: `radial-gradient(circle, ${gradeColor}50, transparent 70%)`,
                          pointerEvents: "none",
                        }}
                      />
                    )}
                    <motion.div
                      animate={
                        prefersReducedMotion
                          ? {}
                          : {
                              boxShadow: [
                                `0 0 20px ${gradeColor}3D`,
                                `0 0 60px ${gradeColor}70`,
                                `0 0 30px ${gradeColor}4D`,
                              ],
                            }
                      }
                      transition={{ duration: 0.8, delay: 0.3 }}
                      style={{
                        width: 120,
                        height: 120,
                        borderRadius: 0,
                        background: `${gradeColor}14`,
                        border: `3px solid ${gradeColor}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                        zIndex: 1,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "'Barlow Condensed', sans-serif",
                          fontSize: 64,
                          fontWeight: 900,
                          color: gradeColor,
                        }}
                      >
                        {gradeProp}
                      </span>
                    </motion.div>
                  </motion.div>

                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.2 }}
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 13,
                      color: "#FB923C",
                      letterSpacing: "0.12em",
                      marginTop: 20,
                    }}
                  >
                    ANALYSIS COMPLETE — GRADE ASSIGNED
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── DocumentSilhouette ────────────────────────────────────────────────────────

const DocumentSilhouette = ({
  markerCount,
  showPulsars,
  pulsarCount,
  dimmed,
  isScanning,
  reducedMotion,
}: {
  markerCount: number;
  showPulsars: boolean;
  pulsarCount: number;
  dimmed: boolean;
  isScanning: boolean;
  reducedMotion: boolean;
}) => (
  <div style={{ width: 232 }}>
    <div
      style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: 11,
        fontWeight: 600,
        color: "#93C5FD",
        letterSpacing: "0.22em",
        marginBottom: 8,
        textAlign: "center",
        textTransform: "uppercase",
      }}
    >
      Document X-Ray
    </div>
    <motion.div
      animate={{ opacity: dimmed ? 0.35 : 1 }}
      transition={{ duration: 0.3 }}
      style={{
        background: "#0F0F0F",
        border: "1px solid #1E1E1E",
        position: "relative",
        height: 295,
        overflow: "hidden",
        padding: "12px 11px",
      }}
    >
      {/* Doc header skeleton */}
      <div style={{ marginBottom: 8, paddingBottom: 7, borderBottom: "1px solid #1A1A1A" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ height: 5, background: "#232323", width: "45%" }} />
          <div style={{ height: 5, background: "#1A1A1A", width: "20%" }} />
        </div>
        <div style={{ height: 3, background: "#1A1A1A", width: "30%", marginBottom: 3 }} />
        <div style={{ height: 3, background: "#1A1A1A", width: "22%" }} />
      </div>

      {/* Body text skeleton lines */}
      {[88, 75, 92, 68, 80, 72, 85, 60].map((w, i) => (
        <div key={i} style={{ height: 3, background: "#1A1A1A", width: `${w}%`, marginBottom: 5 }} />
      ))}

      {/* Table-like section */}
      <div style={{ marginTop: 6, border: "1px solid #1E1E1E" }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ display: "flex", borderBottom: i < 3 ? "1px solid #1A1A1A" : "none", height: 13 }}>
            <div
              style={{ flex: 2, borderRight: "1px solid #1A1A1A", background: i % 2 === 0 ? "#111" : "transparent" }}
            />
            <div style={{ flex: 1, background: i % 2 === 0 ? "#111" : "transparent" }} />
          </div>
        ))}
      </div>

      {/* Footer lines */}
      <div style={{ marginTop: 8 }}>
        <div style={{ height: 3, background: "#1A1A1A", width: "40%", marginBottom: 5 }} />
        <div style={{ height: 4, background: "#222", width: "55%", marginBottom: 3 }} />
        <div style={{ height: 3, background: "#1A1A1A", width: "28%" }} />
      </div>

      {/* Sweeping scan line — GPU-friendly transform, hidden when reducedMotion */}
      {isScanning && !reducedMotion && (
        <motion.div
          initial={{ y: -2 }}
          animate={{ y: 297 }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: "linear-gradient(90deg, transparent, #60A5FA 30%, #FB923C 70%, transparent)",
            boxShadow: "0 0 10px 3px rgba(37,99,235,0.35)",
            zIndex: 10,
          }}
        />
      )}
      {isScanning && reducedMotion && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            height: 1,
            background: "linear-gradient(90deg, transparent, #60A5FA 50%, transparent)",
            zIndex: 10,
          }}
        />
      )}

      {/* Forensic marker bounding boxes — synced to scan step index */}
      {FORENSIC_MARKERS.slice(0, markerCount).map((marker, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
          style={{
            position: "absolute",
            left: `${marker.x}%`,
            top: `${marker.y}%`,
            width: `${marker.w}%`,
            height: `${marker.h}%`,
            border: `1px dashed ${marker.color}60`,
            zIndex: 6,
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: -7,
              left: 1,
              fontFamily: "'DM Mono', monospace",
              fontSize: 6,
              color: marker.color,
              letterSpacing: "0.05em",
              background: "#0F0F0F",
              padding: "0 2px",
              lineHeight: 1,
            }}
          >
            {marker.label}
          </span>
        </motion.div>
      ))}

      {/* Flag pulsars — cliffhanger phase, count from real aggregate flags */}
      {showPulsars &&
        PULSAR_POSITIONS.slice(0, pulsarCount).map((pos, i) => (
          <FlagPulsar key={i} x={pos.x} y={pos.y} label={pos.label} reducedMotion={reducedMotion} />
        ))}
    </motion.div>
  </div>
);

// ── ForensicTerminal ──────────────────────────────────────────────────────────

const ForensicTerminal = ({
  steps,
  activeIndex,
  county,
  progressWidth,
  isCliffhanger,
  reducedMotion,
}: {
  steps: { cmd: string; done: string }[];
  activeIndex: number;
  county: string;
  progressWidth: number;
  isCliffhanger: boolean;
  reducedMotion: boolean;
}) => {
  const [typedText, setTypedText] = useState("");
  const intervalRef = useRef<number | null>(null);
  const prevStateRef = useRef<{ index: number; county: string } | null>(null);

  useEffect(() => {
    if (prevStateRef.current && prevStateRef.current.index === activeIndex && prevStateRef.current.county === county) {
      return;
    }
    prevStateRef.current = { index: activeIndex, county };

    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setTypedText("");

    if (activeIndex >= steps.length) return;

    const fullText = steps[activeIndex].cmd.replace("{county}", county);

    // Reduced-motion: show full text immediately
    if (reducedMotion) {
      setTypedText(fullText);
      return;
    }

    let charIndex = 0;
    intervalRef.current = window.setInterval(() => {
      charIndex++;
      setTypedText(fullText.slice(0, charIndex));
      if (charIndex >= fullText.length && intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, TYPEWRITER_CHAR_DELAY_MS);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [activeIndex, county, steps, reducedMotion]);

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
      {/* Terminal panel */}
      <div
        style={{
          background: "#0B0B0B",
          border: "1px solid #2A2A2A",
          borderRadius: 4,
          padding: "14px 18px",
          fontFamily: "'DM Mono', monospace",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 220,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 0 32px rgba(96,165,250,0.06)",
        }}
      >
        {/* macOS-style terminal titlebar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 14,
            paddingBottom: 10,
            borderBottom: "1px solid #242424",
          }}
        >
          {(["#FF5F57", "#FFBD2E", "#28C840"] as const).map((c, i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: c }} />
          ))}
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#D1D5DB",
              marginLeft: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            WindowMan-AI · Forensic Engine
          </span>
        </div>

        {/* Log lines */}
        <div style={{ flex: 1 }}>
          {steps.map((step, i) => {
            const effectiveIndex = isCliffhanger ? steps.length : activeIndex;
            if (i > effectiveIndex) return null;
            const isComplete = i < effectiveIndex;
            const isActiveStep = i === effectiveIndex;

            if (isComplete) {
              const doneText = step.done.replace("{county}", county);
              const okIdx = doneText.lastIndexOf("[OK]");
              const head = okIdx >= 0 ? doneText.slice(0, okIdx) : doneText;
              const ok = okIdx >= 0 ? "[OK]" : "";
              return (
                <div
                  key={i}
                  style={{
                    fontSize: 14,
                    color: "#E5E7EB",
                    marginBottom: 7,
                    letterSpacing: "0.01em",
                    lineHeight: 1.55,
                    fontWeight: 500,
                  }}
                >
                  <span>{head}</span>
                  {ok && (
                    <span
                      style={{
                        color: "#34D399",
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                      }}
                    >
                      {ok}
                    </span>
                  )}
                </div>
              );
            }

            if (isActiveStep) {
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: 7,
                    padding: "4px 8px",
                    marginLeft: -8,
                    marginRight: -8,
                    borderLeft: "2px solid #FB923C",
                    background: "linear-gradient(90deg, rgba(251,146,60,0.08), transparent 70%)",
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      letterSpacing: "0.01em",
                      lineHeight: 1.55,
                      color: "#FDBA74",
                      fontWeight: 700,
                      textShadow: "0 0 12px rgba(251,146,60,0.35)",
                    }}
                  >
                    {typedText}
                  </span>
                  <motion.span
                    animate={reducedMotion ? {} : { opacity: [1, 0, 1] }}
                    transition={{ duration: 0.7, repeat: Infinity }}
                    style={{ fontSize: 14, color: "#FB923C", marginLeft: 2, fontWeight: 700 }}
                  >
                    ▋
                  </motion.span>
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          marginTop: 10,
          background: "#161616",
          height: 8,
          overflow: "hidden",
          borderRadius: 2,
          border: "1px solid #2A2A2A",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.6)",
        }}
      >
        <motion.div
          style={{
            height: "100%",
            background: "linear-gradient(90deg, #60A5FA 0%, #93C5FD 45%, #FDBA74 100%)",
            width: `${progressWidth}%`,
            boxShadow: "0 0 12px rgba(96,165,250,0.5)",
          }}
          animate={isCliffhanger && !reducedMotion ? { opacity: [0.7, 1, 0.7] } : {}}
          transition={isCliffhanger && !reducedMotion ? { duration: 1.2, repeat: Infinity } : {}}
        />
      </div>
    </div>
  );
};

// ── FlagPulsar ────────────────────────────────────────────────────────────────

const FlagPulsar = ({
  x,
  y,
  label,
  reducedMotion,
}: {
  x: number;
  y: number;
  label: string;
  reducedMotion: boolean;
}) => {
  const ringBase: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 16,
    height: 16,
    marginTop: -8,
    marginLeft: -8,
    borderRadius: "50%",
    border: "1px solid #F87171",
  };

  return (
    <div
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        transform: "translate(-50%, -50%)",
        zIndex: 20,
        width: 16,
        height: 16,
      }}
    >
      {!reducedMotion && (
        <>
          <motion.div
            animate={{ scale: [1, 2.5], opacity: [0.6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
            style={ringBase}
          />
          <motion.div
            animate={{ scale: [1, 2.5], opacity: [0.4, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.6 }}
            style={ringBase}
          />
        </>
      )}
      {reducedMotion && <div style={{ ...ringBase, opacity: 0.6 }} />}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 5,
          height: 5,
          marginTop: -2.5,
          marginLeft: -2.5,
          borderRadius: "50%",
          backgroundColor: "#F87171",
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "100%",
          left: "50%",
          transform: "translateX(-50%)",
          marginTop: 8,
          fontFamily: "'DM Mono', monospace",
          fontSize: 6,
          color: "#F87171",
          letterSpacing: "0.05em",
          whiteSpace: "nowrap",
          background: "rgba(10,10,10,0.9)",
          padding: "1px 3px",
          zIndex: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
};

// ── PillarSlice ───────────────────────────────────────────────────────────────

const PillarSlice = ({
  index,
  label,
  text,
  accentColor,
  delay,
  score,
  pillarStatus,
  isDone,
  county,
  reducedMotion,
}: {
  index: number;
  label: string;
  text: string;
  accentColor: string;
  delay: number;
  score: number | null;
  pillarStatus: PillarScore["status"];
  isDone: boolean;
  county: string;
  reducedMotion: boolean;
}) => {
  // Resolved border/accent color: status-derived once done, accentColor while loading
  const resolvedColor = isDone ? pillarStatusColor(pillarStatus) : accentColor;

  return (
    <motion.div
      layoutId={`pillar-slice-${index}`}
      initial={{ opacity: 0, y: -24 + index * 6, scaleY: 0.85 }}
      animate={{ opacity: 1, y: 0, scaleY: 1 }}
      exit={{ opacity: 0, scaleX: 0 }}
      transition={{ duration: reducedMotion ? 0.05 : 0.2, delay: reducedMotion ? 0 : delay }}
      style={{
        background: "#111111",
        border: "1px solid #1A1A1A",
        borderLeft: `3px solid ${resolvedColor}`,
        borderRadius: 0,
        padding: "12px 16px",
        marginBottom: 8,
        textAlign: "left",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Slice highlight strip */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background: `linear-gradient(90deg, ${resolvedColor}40, transparent)`,
        }}
      />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
        <p
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 8,
            color: "#4B5563",
            letterSpacing: "0.1em",
          }}
        >
          PILLAR {index + 1} / 5
        </p>
        {isDone && (
          <motion.span
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: reducedMotion ? 0.05 : 0.15 }}
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 8,
              color: resolvedColor,
              background: `${resolvedColor}1A`,
              padding: "1px 7px",
              letterSpacing: "0.08em",
            }}
          >
            {pillarStatusBadge(pillarStatus)}
          </motion.span>
        )}
      </div>

      <p
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 9,
          color: "#E5E7EB",
          letterSpacing: "0.1em",
          marginBottom: 5,
        }}
      >
        {label}
      </p>

      <p
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 12,
          color: isDone ? "#4B5563" : "#9CA3AF",
          marginBottom: 7,
        }}
      >
        {isDone ? "Analysis complete" : text.replace("{county}", county)}
      </p>

      {/* Score bar — no fake numeric values */}
      <div style={{ background: "#1A1A1A", height: 3, overflow: "hidden" }}>
        {isDone ? (
          <motion.div
            initial={{ width: "0%" }}
            animate={{ width: score != null ? `${Math.max(0, Math.min(100, score))}%` : "5%" }}
            transition={{ duration: reducedMotion ? 0.05 : 0.3, ease: "easeOut" }}
            style={{ height: 3, backgroundColor: resolvedColor }}
          />
        ) : (
          // Indeterminate shimmer — does not imply a specific value
          <motion.div
            animate={reducedMotion ? {} : { opacity: [0.35, 0.7, 0.35] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            style={{ height: 3, backgroundColor: accentColor, width: "28%" }}
          />
        )}
      </div>

      {/* Score label — only rendered when a real numeric score is available */}
      {isDone && score != null && (
        <p
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 8,
            color: resolvedColor,
            letterSpacing: "0.08em",
            marginTop: 3,
            textAlign: "right",
          }}
        >
          {Math.round(score)}/100
        </p>
      )}
    </motion.div>
  );
};

// ── FindingsCounter ───────────────────────────────────────────────────────────

/**
 * Displays a count-up of real flagRed + flagAmber aggregate counts.
 * Never uses hardcoded signal totals — derived from live analysisData only.
 */
const FindingsCounter = ({ issues }: { issues: number }) => {
  const [displayIssues, setDisplayIssues] = useState(0);

  useEffect(() => {
    if (issues === 0) {
      setDisplayIssues(0);
      return;
    }
    const totalSteps = 24;
    let step = 0;
    const id = window.setInterval(() => {
      step++;
      setDisplayIssues(Math.round((step / totalSteps) * issues));
      if (step >= totalSteps) clearInterval(id);
    }, 35);
    return () => clearInterval(id);
  }, [issues]);

  return (
    <span
      style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: 12,
        color: "#6B7280",
        letterSpacing: "0.04em",
      }}
    >
      <span style={{ color: "#F87171", fontWeight: 700 }}>{displayIssues}</span>
      {" potential issue"}
      {displayIssues !== 1 ? "s" : ""}
      {" detected"}
    </span>
  );
};

// ── OcrQualityBadge ───────────────────────────────────────────────────────────

/** OCR Read Quality Badge — reflects actual read fidelity from live data only */
function OcrQualityBadge({ confidenceScore, data }: { confidenceScore: number | null; data: AnalysisData }) {
  let anchorCount = 0;
  if (data.documentType) anchorCount++;
  if (data.contractorName) anchorCount++;
  if (data.lineItemCount != null && data.lineItemCount > 0) anchorCount++;
  if (data.pageCount != null) anchorCount++;

  let label = "Good";
  let color = "#059669";
  if (confidenceScore != null) {
    if (confidenceScore >= 90 || (confidenceScore >= 85 && anchorCount >= 3)) {
      label = "Excellent";
      color = "#059669";
    } else if (confidenceScore >= 70) {
      label = "Great";
      color = "#059669";
    } else if (confidenceScore >= 55) {
      label = "Good";
      color = "#60A5FA";
    } else {
      label = "Fair";
      color = "#D97706";
    }
  } else if (anchorCount >= 3) {
    label = "Excellent";
    color = "#059669";
  }

  return (
    <div className="flex items-center gap-2">
      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#9CA3AF", letterSpacing: "0.08em" }}>
        READ QUALITY
      </span>
      <span
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 12,
          fontWeight: 700,
          color,
          background: `${color}1A`,
          padding: "2px 10px",
          letterSpacing: "0.06em",
        }}
      >
        {label.toUpperCase()}
      </span>
    </div>
  );
}

export default ScanTheatrics;
