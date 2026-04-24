/**
 * useAnalysisData — Two-phase analysis data hook.
 *
 * Phase 1 (preview): Called on mount. Returns grade, flag counts, pillar bands,
 *   metadata. Flags array is EMPTY — not fetched from backend.
 *
 * Phase 2 (full): Called after OTP verification via fetchFull(phoneE164).
 *   Backend checks phone_verifications.status = 'verified' before returning
 *   the complete flags array and full_json.
 *
 * SECURITY: The backend is the gate. This hook enforces a two-fetch model
 *   so the frontend never has actionable findings data until the backend
 *   has confirmed verification.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { getVerifiedAccess, saveVerifiedAccess, clearVerifiedAccess } from "@/lib/verifiedAccess";
import { trackEvent } from "@/lib/trackEvent";
import type { HybridPreviewPayload, HybridFullPayload } from "@/types/reportHybrid";
import type { ServiceErr, RawPreviewRow, RawFullRow } from "@/types/serviceResults";
import {
  fetchScanStatus,
  fetchAnalysisPreview,
  fetchAnalysisFull,
  fetchFullViaDevBypass as fetchFullViaDevBypassService,
} from "@/services/reportService";
import { peekDevSecret } from "@/lib/devSecret";

// ── Public types ─────────────────────────────────────────────────────────────

export interface AnalysisFlag {
  id: number;
  severity: "red" | "amber" | "green";
  label: string;
  detail: string;
  tip: string | null;
  pillar: string | null;
}

export interface PillarScore {
  key: string;
  label: string;
  score: number | null;
  status: "pass" | "warn" | "fail" | "pending";
}

export interface AnalysisData {
  analysisId: string | null;
  grade: string;
  flags: AnalysisFlag[];
  flagCount: number;
  flagRedCount: number;
  flagAmberCount: number;
  contractorName: string | null;
  confidenceScore: number | null;
  pillarScores: PillarScore[];
  documentType: string | null;
  pageCount: number | null;
  openingCount: number | null;
  lineItemCount: number | null;
  qualityBand: "good" | "fair" | "poor" | null;
  hasWarranty: boolean | null;
  hasPermits: boolean | null;
  analysisStatus: string | null;
  derivedMetrics?: Record<string, unknown> | null;
  priceFairness?: string | null;
  markupEstimate?: string | null;
  negotiationLeverage?: string | null;
  warnings?: (string | Record<string, unknown>)[];
  missingItems?: (string | Record<string, unknown>)[];
  summary?: string | null;
  topWarning?: string | null;
  topMissingItem?: string | null;
  pricePerOpening?: number | null;
  pricePerOpeningBand?: "low" | "market" | "high" | "extreme" | null;
  paymentRiskDetected?: boolean;
  scopeGapDetected?: boolean;
  summaryTeaser?: string | null;
  missingItemsCount?: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const PILLAR_DEFS: { key: string; label: string }[] = [
  { key: "safety_code", label: "Safety & Code Match" },
  { key: "install_scope", label: "Install & Scope Clarity" },
  { key: "price_fairness", label: "Price Fairness" },
  { key: "fine_print", label: "Fine Print & Transparency" },
  { key: "warranty", label: "Warranty Value" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function mapSeverity(raw: string | undefined | null): "red" | "amber" | "green" {
  const s = (raw || "").toLowerCase();
  if (s === "critical" || s === "high") return "red";
  if (s === "medium") return "amber";
  if (s === "low" || s === "info" || s === "pass" || s === "confirmed") return "green";
  if (s === "green" || s === "ok" || s === "good") return "green";
  return "amber";
}

function pillarStatus(score: number | null): "pass" | "warn" | "fail" | "pending" {
  if (score == null) return "pending";
  if (score >= 70) return "pass";
  if (score >= 40) return "warn";
  return "fail";
}

function humanize(snake: string): string {
  return snake.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizePillarKey(raw: string | undefined | null): string | null {
  switch (raw) {
    case "safety": return "safety_code";
    case "install": return "install_scope";
    case "price": return "price_fairness";
    case "finePrint": return "fine_print";
    case "warranty": return "warranty";
    default: return raw || null;
  }
}

interface RawFlag {
  flag?: string;
  severity?: string;
  pillar?: string;
  detail?: string;
  tip?: string;
}

function mapFlags(raw: unknown): AnalysisFlag[] {
  if (!Array.isArray(raw)) return [];
  return (raw as RawFlag[]).map((f, i) => ({
    id: i + 1,
    severity: mapSeverity(f.severity),
    label: humanize(f.flag || "Unknown Issue"),
    detail: f.detail || "",
    tip: f.tip || null,
    pillar: normalizePillarKey(f.pillar),
  }));
}

interface PreviewPillarEntry {
  score?: number | null;
  status?: "pass" | "warn" | "fail" | "pending" | null;
}

const ALLOWED_PILLAR_STATUSES = new Set(["pass", "warn", "fail", "pending"]);

function normalizePreviewPillarEntry(entry: unknown): PreviewPillarEntry | undefined {
  if (typeof entry === "number") return Number.isFinite(entry) ? { score: entry } : undefined;
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return undefined;
  const candidate = entry as { score?: unknown; status?: unknown };
  const result: PreviewPillarEntry = {};
  if (typeof candidate.score === "number" && Number.isFinite(candidate.score)) result.score = candidate.score;
  if (typeof candidate.status === "string" && ALLOWED_PILLAR_STATUSES.has(candidate.status))
    result.status = candidate.status as "pass" | "warn" | "fail" | "pending";
  if (!("score" in result) && !("status" in result)) return undefined;
  return result;
}

function extractPillarScores(previewJson: unknown): PillarScore[] {
  const pillarScoresRaw = (previewJson as { pillar_scores?: unknown })?.pillar_scores;
  const raw =
    pillarScoresRaw && typeof pillarScoresRaw === "object" && !Array.isArray(pillarScoresRaw)
      ? (pillarScoresRaw as Record<string, unknown>)
      : undefined;

  return PILLAR_DEFS.map((def) => {
    const entry = raw?.[def.key];
    const norm = normalizePreviewPillarEntry(entry);
    const score = norm?.score ?? null;
    const explicitStatus = norm?.status ?? null;
    if (score == null && explicitStatus) return { ...def, score: null, status: explicitStatus };
    return { ...def, score, status: pillarStatus(score) };
  });
}

function extractPillarScoresWithFlags(previewJson: unknown, flags: AnalysisFlag[]): PillarScore[] {
  const base = extractPillarScores(previewJson);
  return base.map((def) => {
    if (def.status !== "pending") return def;
    const pillarFlags = flags.filter((f) => f.pillar === def.key);
    if (pillarFlags.length === 0) return def;
    if (pillarFlags.some((f) => f.severity === "red")) return { ...def, status: "fail" as const };
    if (pillarFlags.some((f) => f.severity === "amber")) return { ...def, status: "warn" as const };
    return { ...def, status: "pass" as const };
  });
}

// ── Data assembly helpers ───────────────────────────────────────────────────

function buildPreviewData(row: RawPreviewRow): AnalysisData {
  const proofOfRead = row.proof_of_read;
  const previewJson = row.preview_json;
  const qualityBandRaw = (previewJson as any)?.quality_band as string | undefined;
  const validBands = new Set(["good", "fair", "poor"]);
  const hybridPreview = previewJson as unknown as HybridPreviewPayload | null;

  return {
    analysisId: row.analysis_id ?? null,
    grade: row.grade,
    flags: [],
    flagCount: row.flag_count ?? 0,
    flagRedCount: row.flag_red_count ?? 0,
    flagAmberCount: row.flag_amber_count ?? 0,
    contractorName: (proofOfRead?.contractor_name as string) || null,
    confidenceScore: row.confidence_score ?? null,
    pillarScores: extractPillarScores(row.preview_json),
    documentType: row.document_type || null,
    pageCount: typeof proofOfRead?.page_count === "number" ? proofOfRead.page_count : null,
    openingCount: typeof proofOfRead?.opening_count === "number" ? proofOfRead.opening_count : null,
    lineItemCount: typeof proofOfRead?.line_item_count === "number" ? proofOfRead.line_item_count : null,
    qualityBand:
      qualityBandRaw && validBands.has(qualityBandRaw)
        ? (qualityBandRaw as "good" | "fair" | "poor")
        : null,
    hasWarranty:
      typeof (previewJson as any)?.has_warranty === "boolean"
        ? (previewJson as any).has_warranty
        : null,
    hasPermits:
      typeof (previewJson as any)?.has_permits === "boolean"
        ? (previewJson as any).has_permits
        : null,
    analysisStatus: "complete",
    warnings: [],
    missingItems: [],
    summary: null,
    topWarning: hybridPreview?.top_warning ?? null,
    topMissingItem: hybridPreview?.top_missing_item ?? null,
    pricePerOpening: null,
    pricePerOpeningBand: hybridPreview?.price_per_opening_band ?? null,
    paymentRiskDetected: Boolean(hybridPreview?.payment_risk_detected),
    scopeGapDetected: Boolean(hybridPreview?.scope_gap_detected),
    summaryTeaser: hybridPreview?.summary_teaser ?? null,
    missingItemsCount:
      typeof hybridPreview?.missing_items_count === "number" && hybridPreview.missing_items_count >= 0
        ? hybridPreview.missing_items_count
        : 0,
  };
}

export function buildFullData(row: RawFullRow): AnalysisData {
  const proofOfRead = row.proof_of_read;
  const previewJson = row.preview_json;
  const fullJsonRaw = row.full_json;
  const flags = mapFlags(row.flags);
  const qualityBandRaw = (previewJson as any)?.quality_band as string | undefined;
  const validBands = new Set(["good", "fair", "poor"]);

  const derivedMetrics = (fullJsonRaw?.derived_metrics as Record<string, unknown>) || null;
  const hybridFull = fullJsonRaw as unknown as HybridFullPayload | null;
  const fullWarnings = Array.isArray(hybridFull?.warnings) ? hybridFull.warnings : [];
  const fullMissingItems = Array.isArray(hybridFull?.missing_items) ? hybridFull.missing_items : [];

  return {
    analysisId: row.analysis_id ?? null,
    grade: row.grade,
    flags,
    flagCount: flags.length,
    flagRedCount: flags.filter((f) => f.severity === "red").length,
    flagAmberCount: flags.filter((f) => f.severity === "amber").length,
    contractorName: (proofOfRead?.contractor_name as string) || null,
    confidenceScore: row.confidence_score ?? null,
    pillarScores: extractPillarScoresWithFlags(row.preview_json, flags),
    documentType: row.document_type || null,
    pageCount: typeof proofOfRead?.page_count === "number" ? proofOfRead.page_count : null,
    openingCount: typeof proofOfRead?.opening_count === "number" ? proofOfRead.opening_count : null,
    lineItemCount: typeof proofOfRead?.line_item_count === "number" ? proofOfRead.line_item_count : null,
    qualityBand:
      qualityBandRaw && validBands.has(qualityBandRaw)
        ? (qualityBandRaw as "good" | "fair" | "poor")
        : null,
    hasWarranty:
      typeof (previewJson as any)?.has_warranty === "boolean"
        ? (previewJson as any).has_warranty
        : null,
    hasPermits:
      typeof (previewJson as any)?.has_permits === "boolean"
        ? (previewJson as any).has_permits
        : null,
    analysisStatus: "complete",
    derivedMetrics,
    priceFairness: (fullJsonRaw?.price_fairness as string) || null,
    markupEstimate: (fullJsonRaw?.markup_estimate as string) || null,
    negotiationLeverage: (fullJsonRaw?.negotiation_leverage as string) || null,
    warnings: fullWarnings,
    missingItems: fullMissingItems,
    summary: hybridFull?.summary ?? null,
    topWarning: hybridFull?.top_warning ?? null,
    topMissingItem: hybridFull?.top_missing_item ?? null,
    pricePerOpening:
      typeof hybridFull?.price_per_opening === "number" ? hybridFull.price_per_opening : null,
    pricePerOpeningBand: hybridFull?.price_per_opening_band ?? null,
    paymentRiskDetected: Boolean(hybridFull?.payment_risk_detected),
    scopeGapDetected: Boolean(hybridFull?.scope_gap_detected),
    summaryTeaser: null,
    missingItemsCount: fullMissingItems.length,
  };
}

function buildTerminalData(sessionStatus: string): AnalysisData {
  return {
    analysisId: null,
    grade: "N/A",
    flags: [],
    flagCount: 0,
    flagRedCount: 0,
    flagAmberCount: 0,
    contractorName: null,
    confidenceScore: null,
    pillarScores: PILLAR_DEFS.map((d) => ({
      ...d,
      score: null,
      status: "pending" as const,
    })),
    documentType: null,
    pageCount: null,
    openingCount: null,
    lineItemCount: null,
    qualityBand: null,
    hasWarranty: null,
    hasPermits: null,
    analysisStatus: sessionStatus,
    warnings: [],
    missingItems: [],
    summary: null,
    topWarning: null,
    topMissingItem: null,
    pricePerOpening: null,
    pricePerOpeningBand: null,
    paymentRiskDetected: false,
    scopeGapDetected: false,
    summaryTeaser: null,
    missingItemsCount: 0,
  };
}

// ── Hook return ──────────────────────────────────────────────────────────────

export interface UseAnalysisDataResult {
  data: AnalysisData | null;
  isLoading: boolean;
  error: string | null;
  fullFetchError: string | null;
  fetchFull: (phoneE164: string) => Promise<void>;
  isLoadingFull: boolean;
  isFullLoaded: boolean;
  tryResume: () => Promise<boolean>;
  isResuming: boolean;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAnalysisData(
  scanSessionId: string | null,
  enabled: boolean
): UseAnalysisDataResult {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullFetchError, setFullFetchError] = useState<string | null>(null);
  const [isLoadingFull, setIsLoadingFull] = useState(false);
  const [isFullLoaded, setIsFullLoaded] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const previewFetchedRef = useRef<string | null>(null);
  const resumeAttemptedRef = useRef<string | null>(null);
  const isFullLoadedRef = useRef(false);

  useEffect(() => {
    setData(null);
    setIsFullLoaded(false);
    isFullLoadedRef.current = false;
    setIsLoadingFull(false);
    setIsLoading(false);
    setError(null);
    setFullFetchError(null);
    setIsResuming(false);
    previewFetchedRef.current = null;
    resumeAttemptedRef.current = null;
  }, [scanSessionId]);

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const TERMINAL_STATUSES = new Set(["invalid_document", "failed", "error", "unreadable"]);

  // ── Phase 1: Preview fetch ─────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !scanSessionId || previewFetchedRef.current === scanSessionId) return;
    if (!UUID_RE.test(scanSessionId)) {
      console.warn("[useAnalysisData] invalid scanSessionId, skipping fetch:", scanSessionId);
      return;
    }

    setIsLoading(true);
    setError(null);
    let retryTimer: number | undefined;
    let cancelled = false;

    const doFetch = async (attempt: number) => {
      try {
        if (attempt > 0) {
          const statusResult = await fetchScanStatus(scanSessionId);
          if (statusResult.ok && statusResult.data) {
            const sessionStatus = statusResult.data.status;
            if (sessionStatus && TERMINAL_STATUSES.has(sessionStatus)) {
              console.warn("[useAnalysisData] terminal session status:", sessionStatus);
              setData(buildTerminalData(sessionStatus));
              setIsLoading(false);
              previewFetchedRef.current = scanSessionId;
              return;
            }
          }
        }

        const result = await fetchAnalysisPreview(scanSessionId);
        if (cancelled) return;

        if (!result.ok) {
          const err = result as ServiceErr;
          console.error("get_analysis_preview error:", err.message);
          if (attempt < 8) {
            retryTimer = window.setTimeout(() => doFetch(attempt + 1), 2500);
            return;
          }
          setError("Failed to load analysis.");
          setIsLoading(false);
          return;
        }

        if (!result.data) {
          if (attempt < 8) {
            retryTimer = window.setTimeout(() => doFetch(attempt + 1), 2500);
            return;
          }
          setError("Analysis not found.");
          setIsLoading(false);
          return;
        }

        previewFetchedRef.current = scanSessionId;
        trackEvent({
          event_name: "preview_rendered",
          session_id: scanSessionId,
          metadata: { grade: result.data.grade, flag_count: result.data.flag_count },
        });

        if (isFullLoadedRef.current) {
          setIsLoading(false);
          return;
        }

        setData(buildPreviewData(result.data));
      } catch (err) {
        if (cancelled) return;
        console.error("useAnalysisData exception:", err);
        if (attempt < 8) {
          retryTimer = window.setTimeout(() => doFetch(attempt + 1), 2500);
          return;
        }
        setError("Unexpected error loading analysis.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    doFetch(0);
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [scanSessionId, enabled]);

  // ── Dev bypass helper ────────────────────────────────────────────────
  // Reads runtime secret from localStorage (no prompt, no env). Inactive
  // in production builds and when the user has not stored a secret.
  const devBypassEnabled = import.meta.env.DEV && !!peekDevSecret();

  const doDevBypassFetch = useCallback(
    async (sessionId: string): Promise<RawFullRow | null> => {
      const devSecret = peekDevSecret();
      if (!devSecret) return null;
      const result = await fetchFullViaDevBypassService(sessionId, devSecret);
      if (!result.ok) {
        const err = result as ServiceErr;
        throw new Error(err.message);
      }
      return result.data;
    },
    []
  );

  // ── Phase 2: Full gated fetch ──────────────────────────────────────────
  const fetchFull = useCallback(
    async (phoneE164: string) => {
      if (!scanSessionId || isFullLoaded || !UUID_RE.test(scanSessionId)) {
        console.warn("[fetchFull] skipped — missing/invalid scanSessionId or already loaded", {
          scanSessionId,
          isFullLoaded,
        });
        return;
      }
      setIsLoadingFull(true);
      setFullFetchError(null);

      console.log(
        "[FETCH_FULL_FORENSIC] start",
        JSON.stringify({
          scanSessionId,
          phone_last4: phoneE164?.slice(-4) ?? "null",
          timestamp: new Date().toISOString(),
        })
      );

      try {
        let fullRow: RawFullRow | null;

        if (devBypassEnabled) {
          console.info("[fetchFull] 🔓 DEV BYPASS — skipping get_analysis_full RPC");
          fullRow = await doDevBypassFetch(scanSessionId);
        } else {
          const result = await fetchAnalysisFull(scanSessionId, phoneE164);
          if (!result.ok) {
            const err = result as ServiceErr;
            console.error(
              "[FETCH_FULL_FORENSIC] error",
              JSON.stringify({
                scanSessionId,
                phone_last4: phoneE164?.slice(-4),
                code: err.code,
                message: err.message,
              })
            );
            setFullFetchError(
              err.code === "unauthorized"
                ? err.message
                : "Failed to unlock report."
            );
            return;
          }
          fullRow = result.data;
        }

        if (!fullRow) {
          console.error(
            "[FETCH_FULL_FORENSIC] empty_result",
            JSON.stringify({ scanSessionId, phone_last4: phoneE164?.slice(-4) })
          );
          setFullFetchError("Report data not found.");
          return;
        }

        console.log(
          "[FETCH_FULL_FORENSIC] success",
          JSON.stringify({ scanSessionId, grade: fullRow.grade })
        );

        const assembled = buildFullData(fullRow);
        setData(assembled);
        setIsFullLoaded(true);
        isFullLoadedRef.current = true;
        saveVerifiedAccess(scanSessionId, phoneE164);
        trackEvent({
          event_name: "report_unlocked",
          session_id: scanSessionId,
          metadata: { grade: assembled.grade, flag_count: assembled.flags.length },
        });
      } catch (err) {
        console.error(
          "[FETCH_FULL_FORENSIC] exception",
          JSON.stringify({
            scanSessionId,
            phone_last4: phoneE164?.slice(-4),
            error: String(err),
          })
        );
        setFullFetchError("Unexpected error unlocking report.");
      } finally {
        setIsLoadingFull(false);
      }
    },
    [scanSessionId, isFullLoaded, devBypassEnabled, doDevBypassFetch]
  );

  // ── Phase 3: Auto-resume for returning verified users ─────────────────
  const tryResume = useCallback(async (): Promise<boolean> => {
    if (!scanSessionId || isFullLoaded || !UUID_RE.test(scanSessionId)) return false;
    if (resumeAttemptedRef.current === scanSessionId) return false;
    resumeAttemptedRef.current = scanSessionId;

    const record = getVerifiedAccess(scanSessionId);
    if (!record && !devBypassEnabled) {
      return false;
    }

    setIsResuming(true);
    try {
      let fullRow: RawFullRow | null;

      if (devBypassEnabled) {
        console.info("[tryResume] 🔓 DEV BYPASS — skipping get_analysis_full RPC");
        try {
          fullRow = await doDevBypassFetch(scanSessionId);
        } catch (e) {
          console.warn("[tryResume] dev bypass error", e);
          return false;
        }
      } else {
        const result = await fetchAnalysisFull(scanSessionId, record!.phone_e164);
        if (!result.ok) {
          const err = result as ServiceErr;
          console.warn("[tryResume] RPC error — clearing stale record", err.message);
          clearVerifiedAccess();
          return false;
        }
        fullRow = result.data;
      }

      if (!fullRow) {
        console.warn("[tryResume] empty result — clearing stale record");
        clearVerifiedAccess();
        return false;
      }

      const assembled = buildFullData(fullRow);
      setData(assembled);
      previewFetchedRef.current = scanSessionId;
      setIsFullLoaded(true);
      isFullLoadedRef.current = true;
      trackEvent({
        event_name: "resume_flow_triggered",
        session_id: scanSessionId,
        metadata: { grade: assembled.grade },
      });

      return true;
    } catch (err) {
      console.error("[tryResume] exception — clearing stale record", err);
      clearVerifiedAccess();
      return false;
    } finally {
      setIsResuming(false);
    }
  }, [scanSessionId, isFullLoaded, devBypassEnabled, doDevBypassFetch]);

  return {
    data,
    isLoading,
    error,
    fullFetchError,
    fetchFull,
    isLoadingFull,
    isFullLoaded,
    tryResume,
    isResuming,
  };
}
