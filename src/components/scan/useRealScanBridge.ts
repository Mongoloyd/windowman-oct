/**
 * TEMPORARY /scan SCANNER BRIDGE
 *
 * This module reuses the current homepage upload and scanner transport under
 * explicit Sprint 3A authority. It does not implement reveal authorization,
 * lead persistence, or the long-term server-minted intake capability.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { buildDeterministicStoragePath } from "@/components/uploadZone/storagePath";
import { supabase } from "@/integrations/supabase/client";
import { createUuid } from "@/lib/createUuid";
import { getAttributionPayload } from "@/lib/useUtmCapture";
import { useScanPolling, type ScanStatus } from "@/hooks/useScanPolling";
import { fetchAnalysisPreview } from "@/services/reportService";
import { mapSafePreview } from "./mapSafePreview";
import {
  BOOTSTRAP_GENERIC_FAILURE,
  classifyScanQuoteResponse,
  CONTACT_REQUIRED_USER_MESSAGE,
  isValidScanUuid,
  makeTransportEventId,
  PREVIEW_GENERIC_FAILURE,
  REAL_SCAN_QUOTES_BUCKET,
  resolveScanQuoteTerminalStatus,
  SCAN_PROGRESS_LABELS,
  SCAN_QUOTE_TERMINAL_USER_MESSAGES,
  UPLOAD_GENERIC_FAILURE,
} from "./realScanConstants";
import type { QuotePreviewViewModel } from "./scanPrototypeModel";

export type RealScanPhase =
  | "idle"
  | "selected"
  | "uploading"
  | "bootstrapping"
  | "processing"
  | "preview_loading"
  | "preview_ready"
  | "lead_capture"
  | "summary"
  | "invalid_document"
  | "needs_better_upload"
  | "retryable_failure";

export type RealScanBridgeState = {
  phase: RealScanPhase;
  progressLabel: string | null;
  error: string | null;
  livePreview: QuotePreviewViewModel | null;
  scanSessionId: string | null;
  busy: boolean;
  canRetryScan: boolean;
  canChooseAnother: boolean;
};

export type RealScanBridgeActions = {
  holdSelectedFile: (file: File) => void;
  releaseSelectedFile: () => void;
  beginScan: () => Promise<void>;
  retryScan: () => Promise<void>;
  resetAll: () => void;
  openSummaryFromLead: () => void;
  closeLeadModal: () => void;
  closeSummaryModal: () => void;
};

export type UseRealScanBridgeResult = RealScanBridgeState & RealScanBridgeActions;

type BootstrapSuccess = {
  success: true;
  scan_session_id: string;
  quote_file_id: string;
  lead_id?: string;
};

function buildStrictAttributionBody() {
  const attributionPayload = getAttributionPayload();
  const queryParams =
    (attributionPayload.query_params as Record<string, string | string[]>) ?? {};
  const {
    query_params: _queryParams,
    latest_touch_page: _latestTouchPage,
    latest_touch_page_url: _latestTouchPageUrl,
    ...attributionBody
  } = attributionPayload;

  const bootstrapClientSlug =
    typeof attributionBody.client_slug === "string" &&
    attributionBody.client_slug !== "direct"
      ? attributionBody.client_slug
      : null;

  return { attributionBody, queryParams, bootstrapClientSlug };
}

function terminalPhaseForStatus(status: ScanStatus): RealScanPhase | null {
  if (status === "invalid_document") return "invalid_document";
  if (status === "needs_better_upload") return "needs_better_upload";
  if (status === "failed" || status === "error" || status === "unreadable") {
    return "retryable_failure";
  }
  return null;
}

function progressLabelForPhase(phase: RealScanPhase): string | null {
  if (phase === "uploading") return SCAN_PROGRESS_LABELS.uploading;
  if (phase === "bootstrapping") return SCAN_PROGRESS_LABELS.bootstrapping;
  if (phase === "preview_loading") return SCAN_PROGRESS_LABELS.preview_loading;
  if (phase === "processing") return SCAN_PROGRESS_LABELS.processing;
  return null;
}

export function useRealScanBridge(): UseRealScanBridgeResult {
  const fileRef = useRef<File | null>(null);
  const sessionScopeRef = useRef<string>(createUuid());
  const inFlightRef = useRef(false);
  const uploadedOnceRef = useRef(false);
  const activeScanSessionIdRef = useRef<string | null>(null);
  const previewFetchStartedRef = useRef<string | null>(null);
  const unmountedRef = useRef(false);

  const [phase, setPhase] = useState<RealScanPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [livePreview, setLivePreview] = useState<QuotePreviewViewModel | null>(null);
  const [scanSessionId, setScanSessionId] = useState<string | null>(null);

  const { status: pollStatus, error: pollError, fatalPollError } = useScanPolling({
    scanSessionId,
  });

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  const releaseSelectedFile = useCallback(() => {
    fileRef.current = null;
  }, []);

  const resetTransientScan = useCallback(() => {
    inFlightRef.current = false;
    uploadedOnceRef.current = false;
    activeScanSessionIdRef.current = null;
    previewFetchStartedRef.current = null;
    setScanSessionId(null);
    setLivePreview(null);
    setError(null);
  }, []);

  const resetAll = useCallback(() => {
    resetTransientScan();
    releaseSelectedFile();
    sessionScopeRef.current = createUuid();
    setPhase("idle");
  }, [releaseSelectedFile, resetTransientScan]);

  const holdSelectedFile = useCallback((file: File) => {
    fileRef.current = file;
    resetTransientScan();
    setPhase("selected");
  }, [resetTransientScan]);

  const fail = useCallback((nextPhase: RealScanPhase, message: string) => {
    setError(message);
    setPhase(nextPhase);
    inFlightRef.current = false;
  }, []);

  const runPipeline = useCallback(async () => {
    const file = fileRef.current;
    if (!file) return;
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    setError(null);
    setLivePreview(null);
    setPhase("uploading");

    const sessionScope = sessionScopeRef.current;
    const filePath = buildDeterministicStoragePath(sessionScope, file);

    const { error: storageErr } = await supabase.storage
      .from(REAL_SCAN_QUOTES_BUCKET)
      .upload(filePath, file, { upsert: false, contentType: file.type || undefined });

    if (unmountedRef.current) return;

    if (storageErr) {
      fail("retryable_failure", UPLOAD_GENERIC_FAILURE);
      return;
    }

    fileRef.current = null;
    setPhase("bootstrapping");

    const { attributionBody, queryParams, bootstrapClientSlug } = buildStrictAttributionBody();

    const { data: bootstrapData, error: bootstrapError } = await supabase.functions.invoke(
      "start-upload-scan-session",
      {
        body: {
          session_id: sessionScope,
          storage_path: filePath,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type || null,
          client_slug: bootstrapClientSlug,
          attribution: attributionBody,
          query_params: queryParams,
        },
      },
    );

    if (unmountedRef.current) return;

    if (bootstrapError || !bootstrapData?.success) {
      const code =
        bootstrapData && typeof bootstrapData === "object" && "code" in bootstrapData
          ? String((bootstrapData as { code?: string }).code)
          : null;
      if (code === "contact_required_before_upload") {
        fail("retryable_failure", CONTACT_REQUIRED_USER_MESSAGE);
        return;
      }
      fail("retryable_failure", BOOTSTRAP_GENERIC_FAILURE);
      return;
    }

    const success = bootstrapData as BootstrapSuccess;
    if (
      !isValidScanUuid(success.scan_session_id) ||
      !isValidScanUuid(success.quote_file_id)
    ) {
      fail("retryable_failure", BOOTSTRAP_GENERIC_FAILURE);
      return;
    }

    uploadedOnceRef.current = true;
    activeScanSessionIdRef.current = success.scan_session_id;
    setScanSessionId(success.scan_session_id);
    setPhase("processing");

    const eventId = makeTransportEventId();
    const { data: fnData, error: fnError } = await supabase.functions.invoke("scan-quote", {
      body: { scan_session_id: success.scan_session_id, event_id: eventId },
    });

    if (unmountedRef.current) return;

    if (fnError) {
      const rateLimited =
        fnData && typeof fnData === "object" && (fnData as { error?: string }).error === "rate_limit_exceeded";
      fail(
        "retryable_failure",
        rateLimited
          ? "You've reached the limit for free scans this hour. Please try again in a bit."
          : "Scan encountered an issue. Tap retry to try again.",
      );
      return;
    }

    const responseKind = classifyScanQuoteResponse(fnData);
    if (responseKind === "terminal") {
      const terminalStatus = resolveScanQuoteTerminalStatus(fnData) ?? "error";
      const message =
        SCAN_QUOTE_TERMINAL_USER_MESSAGES[terminalStatus] ??
        "This does not appear to be a valid window estimate or quote.";
      const terminalPhase = terminalPhaseForStatus(terminalStatus as ScanStatus) ?? "retryable_failure";
      fail(terminalPhase, message);
      return;
    }

    inFlightRef.current = false;
  }, [fail]);

  const beginScan = useCallback(async () => {
    if (!fileRef.current) return;
    if (uploadedOnceRef.current && activeScanSessionIdRef.current) return;
    if (inFlightRef.current) return;
    await runPipeline();
  }, [runPipeline]);

  const retryScan = useCallback(async () => {
    if (!fileRef.current && !uploadedOnceRef.current) {
      fail("retryable_failure", "Choose your estimate file again, then retry.");
      return;
    }
    resetTransientScan();
    if (!fileRef.current) {
      fail("retryable_failure", "Choose your estimate file again, then retry.");
      setPhase("selected");
      return;
    }
    await runPipeline();
  }, [fail, resetTransientScan, runPipeline]);

  const fetchSafePreview = useCallback(async (sessionId: string) => {
    if (previewFetchStartedRef.current === sessionId) return;
    previewFetchStartedRef.current = sessionId;
    setPhase("preview_loading");

    const result = await fetchAnalysisPreview(sessionId);
    if (unmountedRef.current) return;

    if (!result.ok) {
      fail("retryable_failure", PREVIEW_GENERIC_FAILURE);
      return;
    }

    if (!result.data) {
      fail("retryable_failure", PREVIEW_GENERIC_FAILURE);
      return;
    }

    const mapped = mapSafePreview(result.data);
    if (!mapped.ok) {
      fail("retryable_failure", PREVIEW_GENERIC_FAILURE);
      return;
    }

    setLivePreview(mapped.preview);
    setPhase("lead_capture");
  }, [fail]);

  useEffect(() => {
    if (!scanSessionId) return;

    const terminal = terminalPhaseForStatus(pollStatus);
    if (terminal) {
      const message =
        pollError ||
        fatalPollError?.message ||
        SCAN_QUOTE_TERMINAL_USER_MESSAGES[pollStatus] ||
        "Scan encountered an issue. Tap retry to try again.";
      fail(terminal, message);
      return;
    }

    if (pollStatus === "preview_ready" || pollStatus === "complete") {
      void fetchSafePreview(scanSessionId);
    }
  }, [pollStatus, pollError, fatalPollError, scanSessionId, fail, fetchSafePreview]);

  const openSummaryFromLead = useCallback(() => {
    if (!livePreview) return;
    setPhase("summary");
  }, [livePreview]);

  const closeLeadModal = useCallback(() => {
    if (phase === "lead_capture") {
      setPhase("preview_ready");
    }
  }, [phase]);

  const closeSummaryModal = useCallback(() => {
    if (phase === "summary") {
      setPhase("preview_ready");
    }
  }, [phase]);

  const busy =
    phase === "uploading" ||
    phase === "bootstrapping" ||
    phase === "processing" ||
    phase === "preview_loading" ||
    inFlightRef.current;

  const progressLabel = progressLabelForPhase(phase);

  return {
    phase,
    progressLabel,
    error,
    livePreview,
    scanSessionId,
    busy,
    canRetryScan: phase === "retryable_failure" || phase === "invalid_document" || phase === "needs_better_upload",
    canChooseAnother: phase !== "idle",
    holdSelectedFile,
    releaseSelectedFile,
    beginScan,
    retryScan,
    resetAll,
    openSummaryFromLead,
    closeLeadModal,
    closeSummaryModal,
  };
}
