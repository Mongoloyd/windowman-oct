import { useState, useRef, useCallback, useEffect, useMemo, type DragEvent, type RefObject } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  FileCheck2,
  RefreshCcw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/trackEvent";
import { trackGtmEvent } from "@/lib/trackConversion";
import { useScanPolling } from "@/hooks/useScanPolling";
import { useScanFunnelSafe } from "@/state/scanFunnel";
// Forever rule: event_id is an opaque UUID v4. Never descriptive, never
// concatenated with metadata, never allowed to block a scan. Metadata
// (event_name, lead_id, scan_session_id, …) rides in separate fields.
// See: requestSchema.ts (backend tolerance layer).
function makeTransportEventId(): string {
  const id = crypto.randomUUID();
  // Boundary guard — defensive against future regressions / polyfills.
  if (typeof id !== "string" || id.length === 0 || id.length > 128) {
    return crypto.randomUUID();
  }
  return id;
}
import { toast } from "sonner";
import {
  buildDeterministicStoragePath,
} from "@/components/uploadZone/storagePath";
import { getAttributionPayload } from "@/lib/useUtmCapture";

// Map real backend scan_sessions.status → user-facing progress percentage.
// Percentages are tied to real lifecycle states only — no fake animation.
const STATUS_PROGRESS: Record<string, { pct: number; label: string }> = {
  uploading: { pct: 15, label: "Uploading your quote..." },
  processing: { pct: 55, label: "Scanning the document..." },
  preview_ready: { pct: 100, label: "Scan ready" },
  complete: { pct: 100, label: "Scan complete" },
  invalid_document: { pct: 100, label: "Document not recognized" },
  needs_better_upload: { pct: 100, label: "We need a clearer image" },
  error: { pct: 0, label: "Something went wrong" },
  idle: { pct: 0, label: "" },
};

interface UploadZoneProps {
  isVisible: boolean;
  onScanStart?: (fileName: string, scanSessionId: string) => void;
  onUploadReset?: () => void;
  sessionId?: string;
  /**
   * Contact-owned lead id (Sprint 2A). When a valid UUID is supplied it is
   * forwarded to start-upload-scan-session as `lead_id` so the Sprint 1
   * contact-owned upload enforcer can authorize the upload. Optional: when
   * absent/invalid the key is omitted entirely, preserving legacy flag-off
   * behavior. Never sent as null/"".
   */
  leadId?: string | null;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];

const SCAN_QUOTE_TERMINAL_STATUSES = new Set([
  "invalid_document",
  "needs_better_upload",
  "failed",
  "error",
  "unreadable",
]);

const SCAN_QUOTE_TERMINAL_USER_MESSAGES: Record<string, string> = {
  invalid_document:
    "This does not appear to be a valid window estimate or quote.",
  needs_better_upload:
    "We could not read enough quote details from this file. Please upload a clearer window estimate, proposal, PDF, screenshot, or photo.",
  failed: "Scan encountered an issue. Tap retry to try again.",
  error: "Scan encountered an issue. Tap retry to try again.",
  unreadable:
    "We could not read enough quote details from this file. Please upload a clearer window estimate, proposal, PDF, screenshot, or photo.",
};

type ScanQuoteResponseKind = "valid" | "terminal" | "incomplete";

function resolveScanQuoteTerminalStatus(fnData: unknown): string | null {
  if (!fnData || typeof fnData !== "object") return null;
  const obj = fnData as Record<string, unknown>;
  const analysisStatus =
    typeof obj.analysis_status === "string" ? obj.analysis_status : null;
  const sessionStatus =
    typeof obj.scan_session_status === "string" ? obj.scan_session_status : null;
  if (analysisStatus && SCAN_QUOTE_TERMINAL_STATUSES.has(analysisStatus)) {
    return analysisStatus;
  }
  if (sessionStatus && SCAN_QUOTE_TERMINAL_STATUSES.has(sessionStatus)) {
    return sessionStatus;
  }
  return null;
}

function classifyScanQuoteResponse(fnData: unknown): ScanQuoteResponseKind {
  const terminalStatus = resolveScanQuoteTerminalStatus(fnData);
  if (terminalStatus) return "terminal";

  if (!fnData || typeof fnData !== "object") return "valid";

  const obj = fnData as Record<string, unknown>;
  const analysisStatus =
    typeof obj.analysis_status === "string" ? obj.analysis_status : null;
  const sessionStatus =
    typeof obj.scan_session_status === "string" ? obj.scan_session_status : null;

  if (
    analysisStatus === "complete" ||
    sessionStatus === "preview_ready" ||
    sessionStatus === "complete"
  ) {
    return "valid";
  }

  if (analysisStatus || sessionStatus) return "incomplete";
  return "valid";
}

const formatSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// UUID v4 format guard — must be verified before any RPC-derived ID is
// forwarded to scan-quote.  Using `?? ""` or `|| ""` as a fallback is
// explicitly forbidden; callers must validate or bail out.
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isValidUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_V4_RE.test(value);
function firstRpcRow<T>(data: T[] | T | null | undefined): T | null {
  if (Array.isArray(data)) return data[0] ?? null;
  return data ?? null;
}

type ProgressState = { pct: number; label: string };

function UploadDropSurface({
  file,
  isDragOver,
  inputRef,
  onDropzoneClick,
  onDrop,
  onDragOver,
  onDragLeave,
  onFileChange,
  onReset,
  formatSize,
  canChangeFile,
}: {
  file: File | null;
  isDragOver: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onDropzoneClick: () => void;
  onDrop: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: () => void;
  onFileChange: (f: File) => void;
  onReset: () => void;
  formatSize: (bytes: number) => string;
  canChangeFile: boolean;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={file ? `Selected file ${file.name}` : "Upload your quote file"}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onDropzoneClick();
        }
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onDropzoneClick}
      className={`group relative mt-6 cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
        isDragOver
          ? "border-primary bg-primary/10 shadow-[0_0_0_4px_rgba(37,99,235,0.12),0_22px_60px_-38px_rgba(37,99,235,0.75)] scale-[1.01]"
          : "border-primary/30 bg-gradient-to-b from-white to-primary/[0.04] shadow-[var(--shadow-sunken)] hover:border-primary/55 hover:shadow-[0_22px_60px_-42px_rgba(37,99,235,0.55)]"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,image/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFileChange(f);
          // Reset the input value so the browser fires onChange again if the
          // same file is selected in a subsequent pick (native browser dedup
          // suppresses the event when value is unchanged between opens).
          e.target.value = "";
        }}
        style={{ display: "none" }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-primary/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:opacity-0"
      />
      {!file ? (
        <>
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/25 bg-gradient-to-b from-primary/15 to-blue-50 text-primary shadow-[0_14px_38px_-24px_rgba(37,99,235,0.7)] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-[1.02] motion-reduce:transform-none"
          >
            <Upload size={34} aria-hidden="true" />
          </div>
          <p className="font-body text-[16px] font-bold text-foreground">
            Drag your quote here
          </p>
          <p className="mt-1.5 font-body text-[13px] text-muted-foreground">
            or click to browse — PDF, photo, or screenshot
          </p>
        </>
      ) : (
        <div onClick={(e) => e.stopPropagation()}>
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/25 bg-gradient-to-b from-primary/15 to-blue-50 text-primary shadow-[0_14px_38px_-24px_rgba(37,99,235,0.7)]"
          >
            <FileCheck2 size={34} aria-hidden="true" />
          </div>
          <p className="font-body text-[13px] font-bold uppercase tracking-[0.16em] text-primary">
            Quote received
          </p>
          <p className="mt-1 font-body text-[13px] text-muted-foreground">
            Ready to scan.
          </p>
          <p className="mx-auto mt-2 max-w-md truncate font-body text-[15px] font-semibold text-foreground">
            {file.name}
          </p>
          <p className="mt-0.5 font-body text-xs text-muted-foreground">
            {formatSize(file.size)}
          </p>
          <button
            type="button"
            disabled={!canChangeFile}
            onClick={(e) => {
              e.stopPropagation();
              if (!canChangeFile) return;
              onReset();
            }}
            className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-full border border-primary/20 bg-white px-3 py-1.5 font-body text-xs font-semibold text-primary shadow-sm transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Change file
          </button>
        </div>
      )}
    </div>
  );
}

function UploadProgressPanel({ progress }: { progress: ProgressState }) {
  return (
    <div className="mt-5 rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/8 to-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 font-body text-[13px] font-semibold text-foreground">
          <span className="relative flex h-2.5 w-2.5 motion-reduce:hidden">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-30" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
          {progress.label}
        </span>
        <span className="font-mono text-[12px] tabular-nums text-primary">
          {progress.pct}%
        </span>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white shadow-inner">
        <motion.div
          className="h-full rounded-full"
          style={{ background: "linear-gradient(90deg, #4DA3FF, #2563EB)" }}
          animate={{ width: `${progress.pct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
      <div className="mt-3 grid gap-1.5 text-[12px] text-muted-foreground sm:grid-cols-3">
        <span>Securing document</span>
        <span>Reading line items</span>
        <span>Checking quote structure</span>
      </div>
    </div>
  );
}

function UploadErrorPanel({
  uploadError,
  uploadErrorDiag,
  busy,
  uploading,
  onRetry,
  showStartFreshUpload,
  onStartFreshUpload,
}: {
  uploadError: string;
  uploadErrorDiag: string | null;
  busy: boolean;
  uploading: boolean;
  onRetry: () => void;
  showStartFreshUpload: boolean;
  onStartFreshUpload: () => void;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
      <p className="mb-3 text-center font-body text-[13px] font-medium text-destructive">
        {uploadError}
      </p>
      {showStartFreshUpload && (
        <>
          <button
            type="button"
            onClick={onStartFreshUpload}
            disabled={busy}
            className="btn-depth-primary w-full"
            style={{
              height: 44,
              fontSize: 14,
              opacity: busy ? 0.7 : 1,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            Start Fresh Upload
          </button>
          <p className="mt-2 text-center font-body text-[12px] leading-relaxed text-muted-foreground">
            Your contact details stay saved. You&apos;ll just choose the file again.
          </p>
        </>
      )}
      <button
        type="button"
        onClick={onRetry}
        disabled={busy}
        className={showStartFreshUpload ? "mt-3 w-full rounded-xl border border-primary/25 bg-white px-4 py-2.5 font-body text-[14px] font-semibold text-primary shadow-sm transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-70" : "btn-depth-primary w-full"}
        style={
          showStartFreshUpload
            ? undefined
            : {
                height: 44,
                fontSize: 14,
                opacity: busy ? 0.7 : 1,
                cursor: busy ? "not-allowed" : "pointer",
              }
        }
      >
        {uploading ? "Retrying..." : "Retry Scan →"}
      </button>
      {uploadErrorDiag && import.meta.env.DEV && (
        <p className="mt-2 break-all text-center font-mono text-[11px] text-muted-foreground">
          {uploadErrorDiag}
        </p>
      )}
    </div>
  );
}

// Storage-path helpers extracted to ./uploadZone/storagePath for testability.
// Imported above. Determinism is locked by storagePath.test.ts.

type UploadRecoveryKind = "storage_conflict_no_context" | null;

const UploadZone = ({ isVisible, onScanStart, onUploadReset, sessionId, leadId: leadIdProp }: UploadZoneProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Dev/preview-only diagnostic: short non-PII "[code] message" rendered
  // beneath the orange retry panel. Production UI stays generic.
  const [uploadErrorDiag, setUploadErrorDiag] = useState<string | null>(null);
  const [uploadErrorKind, setUploadErrorKind] = useState<UploadRecoveryKind>(null);
  // Start-Fresh path rotation: breaks orphan 409 loops without changing sessionId.
  const [retryNonce, setRetryNonce] = useState(0);
  // Persist scanSessionId so a retry can re-invoke the edge function without
  // re-uploading the file or duplicating scan_sessions / quote_files rows.
  const [activeScanSessionId, setActiveScanSessionId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // ── Idempotency guards ───────────────────────────────────────────────
  // inFlightRef: synchronous lock that beats React's async setState. Prevents
  // double-fire from rapid clicks before `uploading` propagates.
  const inFlightRef = useRef(false);
  // uploadedOnceRef: once the fresh upload path has succeeded (storage +
  // quote_files + scan_sessions inserted), every subsequent click MUST take
  // the retry path. Guarantees no duplicate quote_files / scan_sessions
  // rows for the same user intent, even if React state is stale.
  const uploadedOnceRef = useRef(false);
  const funnel = useScanFunnelSafe();
  const rpc = supabase.rpc as unknown as (
    fnName: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>;

  // Live scan status — only polled once we have a real session id.
  const { status: liveStatus } = useScanPolling({ scanSessionId: activeScanSessionId });
  const progress = STATUS_PROGRESS[liveStatus] ?? STATUS_PROGRESS.idle;
  const showProgress = uploading || (activeScanSessionId !== null && liveStatus !== "idle" && liveStatus !== "error");

  // Unified "busy" — single source of truth for disabling the CTA. Covers:
  //   - active upload/RPC in flight
  //   - scan session exists and is mid-pipeline (no error to retry)
  // Prevents the error/retry/loading states from racing into inconsistent UI.
  const busy = useMemo(() => {
    if (uploading) return true;
    if (activeScanSessionId && !uploadError) {
      if (["uploading", "processing", "preview_ready", "complete"].includes(liveStatus)) {
        return true;
      }
    }
    return false;
  }, [uploading, activeScanSessionId, uploadError, liveStatus]);

  useEffect(() => {
    if (isVisible && containerRef.current) {
      setTimeout(() => {
        containerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 450);
    }
  }, [isVisible]);

  const handleFile = useCallback((f: File) => {
    setFileError(null);
    setUploadError(null);
    setUploadErrorKind(null);
    if (f.size > MAX_FILE_SIZE) {
      setFileError("File too large. Maximum size is 10MB.");
      return;
    }
    if (!ALLOWED_TYPES.includes(f.type)) {
      setFileError("Unsupported file type. Please upload a PDF or image (JPG, PNG, WEBP, HEIC).");
      return;
    }
    setFile(f);
    setIsDragOver(false);
  }, []);

  const handleDropzoneClick = useCallback(() => {
    if (!busy && inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.click();
    }
  }, [busy]);

  const resetUploadSelection = useCallback(() => {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
    setActiveScanSessionId(null);
    setUploadError(null);
    setUploadErrorDiag(null);
    setUploadErrorKind(null);
    setFileError(null);
    setUploading(false);
    setIsDragOver(false);
    inFlightRef.current = false;
    uploadedOnceRef.current = false;
    funnel?.setScanSessionId(null);
    funnel?.setQuoteFileId(null);
    onUploadReset?.();
  }, [funnel, onUploadReset]);

  const handleChangeFile = useCallback(() => {
    setRetryNonce(0);
    resetUploadSelection();
  }, [resetUploadSelection]);

  const notifyScanStart = useCallback(
    (fileName: string, scanSessionId: string) => {
      setRetryNonce(0);
      onScanStart?.(fileName, scanSessionId);
    },
    [onScanStart],
  );

  const handleStartFreshUpload = useCallback(() => {
    resetUploadSelection();
    uploadedOnceRef.current = false;
    inFlightRef.current = false;
    setActiveScanSessionId(null);
    setUploadError(null);
    setUploadErrorDiag(null);
    setUploadErrorKind(null);
    funnel?.setScanSessionId(null);
    funnel?.setQuoteFileId(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    setRetryNonce((n) => Math.min(n + 1, 999));
  }, [resetUploadSelection, funnel]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );
  const clearStaleRetryState = () => {
    uploadedOnceRef.current = false;
    setActiveScanSessionId(null);
  };

  /**
   * Invoke the scan-quote edge function. Used by both the initial scan and
   * the retry button. Idempotent on the backend per scan_session_id.
   */
  const invokeScan = async (
    scanSessionId: string,
    leadId: string | null,
    quoteFileId: string,
  ): Promise<boolean> => {
    const quoteUploadedEventId = makeTransportEventId();
    const { data: fnData, error: fnError } = await supabase.functions.invoke("scan-quote", {
      body: { scan_session_id: scanSessionId, event_id: quoteUploadedEventId },
    });
    if (fnError) {
      const isRateLimited = fnData?.error === "rate_limit_exceeded";
      const msg = isRateLimited
        ? fnData?.message ||
          "You've reached the limit for free scans this hour. Please try again in a bit."
        : "Scan encountered an issue. Tap retry to try again.";
      setUploadError(msg);
      toast.error(msg);
      await supabase.from("event_logs").insert({
        event_name: isRateLimited ? "scan_rate_limited" : "scan_invoke_failed",
        session_id: sessionId || null,
        metadata: {
          scan_session_id: scanSessionId,
          quote_file_id: quoteFileId,
          error_message: fnError.message || String(fnError),
          file_name: file?.name,
          file_size: file?.size,
          timestamp: new Date().toISOString(),
        },
      });
      return false;
    }

    const responseKind = classifyScanQuoteResponse(fnData);
    if (responseKind === "terminal") {
      const terminalStatus = resolveScanQuoteTerminalStatus(fnData) ?? "error";
      const msg =
        SCAN_QUOTE_TERMINAL_USER_MESSAGES[terminalStatus] ??
        "This does not appear to be a valid window estimate or quote.";
      setUploadError(msg);
      toast.error(msg);
      return false;
    }

    if (responseKind === "valid") {
      trackGtmEvent("quote_uploaded", {
        event_id: quoteUploadedEventId,
        value: 250,
        currency: "USD",
        scan_session_id: scanSessionId,
        lead_id: leadId || undefined,
        file_size: file?.size,
        file_type: file?.type,
      });
    }

    return true;
  };

  // ── Idempotency-critical path ─────────────────────────────────────────
  // `inFlightRef` + `uploadedOnceRef` + the deterministic storage key are
  // load-bearing. Behavior locked by `UploadZone.test.tsx`. Do not change
  // these guards casually.
  const handleScan = async () => {
    // ── Synchronous re-entry guard ────────────────────────────────────
    // setUploading is async; back-to-back clicks (touch double-tap, fast
    // re-render) can both pass `if (uploading)` before state propagates.
    // The ref check + set is atomic from React's perspective.
    if (!file) return;
    if (inFlightRef.current) return;
    if (uploading) return;
    inFlightRef.current = true;
    setUploading(true);
    setUploadError(null);
    setUploadErrorDiag(null);
    setUploadErrorKind(null);

    // ── Unified failure surface ─────────────────────────────────────────
    // Every failure stage funnels through this one helper so the user sees
    // exactly one message and one retry button — never a stack of toasts
    // from cascading partial failures (storage / quote_files / scan_sessions).
    const failWith = (stage: string, message: string, err?: unknown) => {
      console.error(`[UploadZone] ${stage} failed:`, err);
      setUploadErrorKind(
        stage === "storage_conflict_no_context" ? "storage_conflict_no_context" : null,
      );
      setUploadError(message);
      toast.error(message);
    };

    try {
      // ── Retry path (in-memory) ───────────────────────────────────────
      // Triggered when EITHER:
      //   (a) we already have an activeScanSessionId in state, OR
      //   (b) uploadedOnceRef says the fresh path already ran (defends
      //       against state being cleared/reset out from under us).
      // Both bind strictly to the existing scan_session_id — never a new one.
      if (activeScanSessionId || uploadedOnceRef.current) {
        const boundScanSessionId = activeScanSessionId;
        if (!boundScanSessionId) {
          clearStaleRetryState();
          failWith("retry_session_lost", "Scan session lost. Please upload again.");
          return;
        }
        type ScanSessionContextRow = { quote_file_id: string | null; lead_id: string | null };
        const { data: ssData, error: ssError } = await rpc("get_scan_session_context", {
          p_scan_session_id: boundScanSessionId,
        });
        const ss = firstRpcRow<ScanSessionContextRow>(
          ssData as ScanSessionContextRow[] | ScanSessionContextRow | null | undefined,
        );
        const retryLeadId = (ss?.lead_id as string | null) ?? null;
        // Treat absent/null/malformed quote_file_id as a stale or missing session.
        // Never forward "" or an untrusted string into invokeScan — the Edge
        // Function expects a real UUID and will 500 on anything else.
        const retryQuoteFileId = ss?.quote_file_id ?? null;
        if (ssError || !isValidUuid(retryQuoteFileId)) {
          // Reset retry state so the user can start a fresh upload rather than
          // being stuck behind a stale activeScanSessionId on every click.
          clearStaleRetryState();
          failWith(
            "retry_context_invalid",
            "Session not found or expired. Please upload again.",
          );
          return;
        }
        if (funnel) {
          funnel.setScanSessionId(boundScanSessionId);
          funnel.setQuoteFileId(retryQuoteFileId);
          if (retryLeadId) funnel.setLeadId(retryLeadId);
        }
        const ok = await invokeScan(
          boundScanSessionId,
          retryLeadId,
          retryQuoteFileId,
        );
        if (ok) {
          notifyScanStart(file.name, boundScanSessionId);
        }
        return;
      }

      // ── Fresh path ────────────────────────────────────────────────────
      // Storage path is deterministic per (sessionId, file). Means a retry
      // that has lost in-memory state but kept the same sessionId can
      // resolve back to the original Storage object + quote_files row
      // instead of duplicating either.
      const sessionScope = sessionId || crypto.randomUUID();
      const filePath = buildDeterministicStoragePath(sessionScope, file, {
        retryNonce: retryNonce > 0 ? retryNonce : undefined,
      });

      // ── Cross-component retry guard (DB-side) ─────────────────────────
      // Before doing any inserts, look for an existing scan_session bound
      // to this exact storage_path. If one exists, this is a retry of an
      // upload whose component state was lost (page refresh, route
      // change). Re-bind to it instead of duplicating rows.
      // Uses a SECURITY DEFINER RPC so no direct SELECT on quote_files or
      // scan_sessions is needed from the browser.
      let existingScanSessionId: string | null = null;
      let existingLeadId: string | null = null;
      let existingQuoteFileId: string | null = null;
      let hasPartialRetryQuoteFile = false;

      try {
        type UploadRetryContextRow = {
          quote_file_id: string;
          scan_session_id: string | null;
          lead_id: string | null;
        };
        const { data: retryData, error: retryError } = await rpc("get_upload_retry_context", {
          p_session_scope: sessionScope,
          p_storage_path: filePath,
        });
        const retryCtx = firstRpcRow<UploadRetryContextRow>(
          retryData as UploadRetryContextRow[] | UploadRetryContextRow | null | undefined,
        );
        if (retryError) {
          console.warn("[UploadZone] retry-by-path lookup failed:", retryError);
        }
        // Only trust the RPC result if both IDs are well-formed UUIDs.
        // A truthy-but-malformed value (e.g. "not-a-uuid") must not reach
        // invokeScan; fall through to the fresh upload path instead.
        if (
          isValidUuid(retryCtx?.quote_file_id) &&
          isValidUuid(retryCtx?.scan_session_id)
        ) {
          existingQuoteFileId = retryCtx!.quote_file_id;
          existingLeadId = retryCtx!.lead_id ?? null;
          existingScanSessionId = retryCtx!.scan_session_id ?? null;
        } else if (
          isValidUuid(retryCtx?.quote_file_id) &&
          retryCtx?.scan_session_id == null
        ) {
          // Partial context means quote metadata already exists but scan session
          // did not survive. Do not invoke scan directly. Continue through the
          // canonical bootstrap path so the backend can idempotently reuse
          // quote_files and (re)create/reuse scan_sessions for this storage path.
          hasPartialRetryQuoteFile = true;
          existingLeadId = retryCtx.lead_id ?? null;
          existingQuoteFileId = retryCtx.quote_file_id;
        }
      } catch (lookupErr) {
        // Lookup failure must not block fresh path — log and continue.
        // Worst case we'd attempt a fresh upload; storage upsert and the
        // client guards below still keep retry coherent.
        console.warn("[UploadZone] retry-by-path lookup failed:", lookupErr);
      }

      if (isValidUuid(existingScanSessionId) && isValidUuid(existingQuoteFileId)) {
        // Re-bind to the existing mapping — this is the canonical retry.
        uploadedOnceRef.current = true;
        setActiveScanSessionId(existingScanSessionId);
        if (funnel) {
          funnel.setScanSessionId(existingScanSessionId);
          funnel.setQuoteFileId(existingQuoteFileId);
          if (existingLeadId) funnel.setLeadId(existingLeadId);
        }
        const ok = await invokeScan(existingScanSessionId, existingLeadId, existingQuoteFileId);
        if (ok) {
          notifyScanStart(file.name, existingScanSessionId);
        }
        return;
      }

      // ── DIAGNOSTIC: pre-upload structured trace ─────────────────────
      // Instrumentation-only. No behavior change. Captures the exact
      // request shape sent to supabase.storage so we can correlate any
      // failure to the request inputs (path / MIME / upsert / retry).
      const isRetry = uploadedOnceRef.current === true;
      // Use upsert ONLY on retry. The private `quotes` bucket has no anon
      // SELECT policy, so an unconditional upsert (which performs INSERT ...
      // ON CONFLICT DO UPDATE and requires SELECT visibility on the existing
      // row) gets rejected by RLS as "new row violates row-level security
      // policy". A plain INSERT on the first attempt matches the existing
      // anon INSERT policy and succeeds. Retries reuse the deterministic path
      // and need upsert to overwrite the prior object.
      const useUpsert = isRetry || hasPartialRetryQuoteFile;
      console.info("[UploadZone] storage.upload →", {
        bucket: "quotes",
        filePath,
        upsert: useUpsert,
        contentType: file.type,
        fileName: file.name,
        fileSize: file.size,
        isRetry,
        sessionId: sessionScope,
      });

      // Storage upload — first write is a plain INSERT; retries upsert to
      // overwrite the same deterministic path idempotently.
      const { error: storageErr } = await supabase.storage
        .from("quotes")
        .upload(filePath, file, { upsert: useUpsert, contentType: file.type || undefined });
      if (storageErr) {
        // ── DIAGNOSTIC: full structured error capture ─────────────────
        // Surface every field the SDK exposes (message / name / status /
        // statusCode / nested error / cause) AND the raw object so the
        // DevTools tree shows anything we missed.
        const anyErr = storageErr as unknown as Record<string, unknown>;
        console.error("[UploadZone] storage.upload FAILED", {
          message: storageErr?.message,
          name: storageErr?.name,
          statusCode: anyErr?.statusCode,
          status: anyErr?.status,
          error: anyErr?.error,
          cause: anyErr?.cause,
          raw: storageErr,
        });

        // ── DIAGNOSTIC: server-side telemetry into event_logs ─────────
        // Fire-and-forget. trackEvent already swallows its own errors so
        // it cannot block the existing failWith() toast or retry path.
        trackEvent({
          event_name: "storage_upload_failed",
          session_id: sessionScope,
          metadata: {
            message: storageErr?.message ?? null,
            name: storageErr?.name ?? null,
            statusCode:
              (anyErr?.statusCode as number | string | undefined) ??
              (anyErr?.status as number | string | undefined) ??
              null,
            errorBody: anyErr?.error ?? null,
            bucket: "quotes",
            filePath,
            fileName: file.name,
            fileType: file.type || null,
            fileSize: file.size,
            upsert: useUpsert,
            isRetry,
          },
        });

        // ── Narrow 409 / object-exists conflict detection ──────────────
        // Only applies to a plain INSERT attempt (!useUpsert). If the SDK
        // returns statusCode "409" or an "already exists" message it means
        // a storage object is present at this deterministic path but our
        // earlier get_upload_retry_context lookup found no DB row (orphaned
        // object). Do NOT blindly upsert over an existing private quote file.
        // Instead, re-run the retry-context lookup once: a race may have
        // written the quote_files row between our first check and now.
        const statusCode = anyErr?.statusCode ?? anyErr?.status;
        const isStorageObjectConflict =
          statusCode === "409" ||
          statusCode === 409 ||
          (typeof storageErr?.message === "string" &&
            storageErr.message.toLowerCase().includes("already exists"));

        if (isStorageObjectConflict && !useUpsert) {
          type UploadRetryContextRow = {
            quote_file_id: string;
            scan_session_id: string | null;
            lead_id: string | null;
          };
          const { data: crData, error: crError } = await rpc("get_upload_retry_context", {
            p_session_scope: sessionScope,
            p_storage_path: filePath,
          });
          const crCtx = firstRpcRow<UploadRetryContextRow>(
            crData as UploadRetryContextRow[] | UploadRetryContextRow | null | undefined,
          );

          if (!crError && isValidUuid(crCtx?.quote_file_id) && isValidUuid(crCtx?.scan_session_id)) {
            // Full context found — rebind to existing session without any re-upload.
            uploadedOnceRef.current = true;
            setActiveScanSessionId(crCtx!.scan_session_id!);
            if (funnel) {
              funnel.setScanSessionId(crCtx!.scan_session_id!);
              funnel.setQuoteFileId(crCtx!.quote_file_id);
              if (crCtx!.lead_id) funnel.setLeadId(crCtx!.lead_id);
            }
            const ok = await invokeScan(crCtx!.scan_session_id!, crCtx!.lead_id ?? null, crCtx!.quote_file_id);
            if (ok) notifyScanStart(file.name, crCtx!.scan_session_id!);
            return;
          }

          if (!crError && isValidUuid(crCtx?.quote_file_id)) {
            // Partial context: storage object + quote_files row exist, no scan
            // session yet. Fall through to bootstrap — start-upload-scan-session
            // will idempotently reuse the existing quote_files row via
            // storage_path. The object is already in storage; no re-upload needed.
          } else {
            // No DB row found despite the 409 — truly orphaned storage object.
            // Cannot safely overwrite a private quote asset without proof of
            // session ownership. Instruct the user to choose the file again
            // (the e.target.value="" fix ensures onChange re-fires) or reset.
            failWith(
              "storage_conflict_no_context",
              "We found an old upload attempt for this file, but couldn't safely reconnect it.",
              storageErr,
            );
            return;
          }
        } else {
          // Non-409 storage errors (network, permissions, size, etc.) use the
          // original generic failure message unchanged.
          failWith("storage_upload", "Upload failed. Please try again.", storageErr);
          return;
        }
      }

      // ── Server-authoritative scan session bootstrap ─────────────────
      // Direct browser inserts into `leads` and `scan_sessions` are RLS-anon
      // only. When the same browser holds an admin/operator JWT (the user is
      // logged into the back-office), Postgres returns 42501 and the user
      // sees "Failed to start scan session." The edge function performs all
      // three writes (leads / quote_files / scan_sessions) with the service
      // role and is idempotent on `storage_path`, so retries don't duplicate.
      const bootstrapSessionId = sessionId || sessionScope;
      const attributionPayload = getAttributionPayload();
      const queryParams =
        (attributionPayload.query_params as Record<string, string | string[]>) ??
        {};
      const { query_params: _queryParams, ...attributionBody } =
        attributionPayload;
      const bootstrapClientSlug =
        typeof attributionBody.client_slug === "string" &&
        attributionBody.client_slug !== "direct"
          ? attributionBody.client_slug
          : null;

      const { data: bootstrapData, error: bootstrapError } =
        await supabase.functions.invoke("start-upload-scan-session", {
          body: {
            session_id: bootstrapSessionId,
            storage_path: filePath,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type || null,
            client_slug: bootstrapClientSlug,
            attribution: attributionBody,
            query_params: queryParams,
            // Sprint 2A: forward the contact-owned lead id only when it is a
            // valid UUID. Omit the key entirely otherwise — never send
            // null/""/undefined — so legacy flag-off callers are unaffected.
            ...(isValidUuid(leadIdProp) ? { lead_id: leadIdProp } : {}),
          },
        });

      if (bootstrapError || !bootstrapData?.success) {
        // Surface the original "scan_sessions_insert" failure stage so the
        // visible UX (orange retry panel) is unchanged. Diagnostic detail
        // goes to the console, never the user.
        const fnDetails = (bootstrapData ?? {}) as Record<string, unknown>;
        const diagCode =
          (fnDetails.code as string | undefined) ??
          bootstrapError?.name ??
          "scan_session_create_failed";
        const diagMsg =
          (fnDetails.message as string | undefined) ??
          bootstrapError?.message ??
          "Failed to start scan session.";
        setUploadErrorDiag(`[${diagCode}] ${diagMsg}`);
        failWith(
          "scan_sessions_insert",
          "Failed to start scan session. Please try again.",
          bootstrapError ?? fnDetails,
        );
        return;
      }

      const newScanSessionId = bootstrapData.scan_session_id as string;
      const quoteFileId = bootstrapData.quote_file_id as string;
      const leadId = (bootstrapData.lead_id as string | null) ?? null;

      // Defensive: the EF is authoritative, but guard against any unexpected
      // shape before forwarding to invokeScan.
      if (!isValidUuid(newScanSessionId) || !isValidUuid(quoteFileId)) {
        failWith(
          "scan_session_invalid_ids",
          "Failed to start scan session. Please try again.",
          { newScanSessionId, quoteFileId },
        );
        return;
      }

      if (funnel) {
        funnel.setScanSessionId(newScanSessionId);
        funnel.setQuoteFileId(quoteFileId);
        if (leadId) funnel.setLeadId(leadId);
      }

      if (import.meta.env.DEV) {
        console.info("[UploadZone] start-upload-scan-session success", {
          sessionId: bootstrapSessionId,
          leadId,
          quoteFileId,
          scanSessionId: newScanSessionId,
          phoneStatus: funnel?.phoneStatus ?? null,
          clientSlug: funnel?.clientSlug ?? null,
        });
      }

      // ── Commit identity ──────────────────────────────────────────────
      // Persist scan_session_id locally AND flip uploadedOnceRef BEFORE
      // invokeScan so any race on the same render cycle takes the retry
      // path, not a second fresh upload.
      uploadedOnceRef.current = true;
      setActiveScanSessionId(newScanSessionId);

      trackEvent({
        event_name: "upload_completed",
        session_id: sessionId,
        metadata: { scan_session_id: newScanSessionId, file_name: file.name, file_size: file.size },
      });

      // Gate the UI advance on a successful scan-quote invocation. If the
      // edge function fails, invokeScan has already surfaced uploadError +
      // toast; the user stays on UploadZone and the existing retry button
      // re-binds to this scan_session_id (uploadedOnceRef is true).
      const ok = await invokeScan(newScanSessionId, leadId, quoteFileId);
      if (ok) {
        notifyScanStart(file.name, newScanSessionId);
      }
    } catch (err) {
      failWith("unexpected", "Something went wrong. Please try again.", err);
    } finally {
      setUploading(false);
      inFlightRef.current = false;
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, height: 0, y: 20 }}
          animate={{ opacity: 1, height: "auto", y: 0 }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.15 }}
          className="mx-auto mt-6 max-w-2xl overflow-hidden"
          data-testid="upload-zone"
        >
          <div className="card-raised-hero border-t-2 border-t-primary p-7 md:p-8">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary"
              >
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Private quote scan
              </span>
              <span
                className="rounded-full border border-slate-200/80 bg-white/90 px-3 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm"
              >
                60-second first pass
              </span>
            </div>
            <h2 className="font-display text-[26px] font-extrabold leading-tight tracking-[0.01em] text-foreground md:text-[32px]">
              Drop your quote to start the scan.
            </h2>
            <p className="mt-3 max-w-xl font-body text-[15px] leading-relaxed text-muted-foreground md:text-base">
              WindowMan checks scope gaps, price traps, missing proof, and warranty
              loopholes before you sign.
            </p>

            <UploadDropSurface
              file={file}
              isDragOver={isDragOver}
              inputRef={inputRef}
              onDropzoneClick={handleDropzoneClick}
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onFileChange={handleFile}
              onReset={handleChangeFile}
              formatSize={formatSize}
              canChangeFile={!busy}
            />

            <div
              className="mt-4 flex items-start justify-center gap-2 rounded-2xl border border-primary/15 bg-gradient-to-b from-white to-primary/[0.04] px-4 py-3 text-center shadow-sm"
            >
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <p className="font-body text-[13px] leading-relaxed text-muted-foreground">
                No contractor receives your quote unless you choose to share it.
              </p>
            </div>

            {fileError && (
              <div
                className="mt-3 rounded-xl border border-orange-400/40 bg-orange-50/80 px-4 py-3 text-center"
                role="alert"
              >
                <p className="font-body text-[13px] font-medium text-orange-700">
                  {fileError}
                </p>
              </div>
            )}

            {showProgress && <UploadProgressPanel progress={progress} />}

            {uploadError && !uploading && (
              <UploadErrorPanel
                uploadError={uploadError}
                uploadErrorDiag={uploadErrorDiag}
                busy={busy}
                uploading={uploading}
                onRetry={handleScan}
                showStartFreshUpload={uploadErrorKind === "storage_conflict_no_context"}
                onStartFreshUpload={handleStartFreshUpload}
              />
            )}

            {file && !uploadError && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                onClick={handleScan}
                disabled={busy}
                className="btn-depth-primary mt-5 w-full rounded-xl"
                style={{
                  minHeight: 54,
                  padding: "14px 20px",
                  fontSize: 17,
                  lineHeight: 1.35,
                  opacity: busy ? 0.7 : 1,
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                {uploading
                  ? "Securing your quote..."
                  : activeScanSessionId !== null
                    ? "Preparing scan..."
                    : "Scan my quote →"}
              </motion.button>
            )}

            <div className="mt-5 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 text-center shadow-sm">
              <p className="font-body text-[13px] text-muted-foreground">
                No digital copy?{" "}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    trackEvent({ event_name: "photo_option_clicked" });
                    if (inputRef.current) {
                      inputRef.current.value = "";
                      inputRef.current.click();
                    }
                  }}
                  className="inline-flex items-center gap-1 font-body text-[13px] font-semibold text-primary underline-offset-4 hover:underline"
                >
                  <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                  Take a photo with your phone →
                </button>
              </p>
            </div>
            <p className="mt-4 text-center font-body text-[11px] text-muted-foreground">
              Drag it here or click to browse · PDF, JPG, PNG, WEBP, HEIC · Max 10MB
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UploadZone;
