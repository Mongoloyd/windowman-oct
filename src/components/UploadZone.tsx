import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload } from "lucide-react";
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

// Storage-path helpers extracted to ./uploadZone/storagePath for testability.
// Imported above. Determinism is locked by storagePath.test.ts.

const UploadZone = ({ isVisible, onScanStart, onUploadReset, sessionId }: UploadZoneProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Dev/preview-only diagnostic: short non-PII "[code] message" rendered
  // beneath the orange retry panel. Production UI stays generic.
  const [uploadErrorDiag, setUploadErrorDiag] = useState<string | null>(null);
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
    if (!uploading && inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.click();
    }
  }, [uploading]);

  const resetUploadSelection = useCallback(() => {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
    setActiveScanSessionId(null);
    setUploadError(null);
    setUploadErrorDiag(null);
    setFileError(null);
    setUploading(false);
    setIsDragOver(false);
    inFlightRef.current = false;
    uploadedOnceRef.current = false;
    funnel?.setScanSessionId(null);
    funnel?.setQuoteFileId(null);
    onUploadReset?.();
  }, [funnel, onUploadReset]);

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

    // ── Unified failure surface ─────────────────────────────────────────
    // Every failure stage funnels through this one helper so the user sees
    // exactly one message and one retry button — never a stack of toasts
    // from cascading partial failures (storage / quote_files / scan_sessions).
    const failWith = (stage: string, message: string, err?: unknown) => {
      console.error(`[UploadZone] ${stage} failed:`, err);
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
          onScanStart?.(file.name, boundScanSessionId);
        }
        return;
      }

      // ── Fresh path ────────────────────────────────────────────────────
      // Storage path is deterministic per (sessionId, file). Means a retry
      // that has lost in-memory state but kept the same sessionId can
      // resolve back to the original Storage object + quote_files row
      // instead of duplicating either.
      const sessionScope = sessionId || crypto.randomUUID();
      const filePath = buildDeterministicStoragePath(sessionScope, file);

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
          onScanStart?.(file.name, existingScanSessionId);
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

        failWith("storage_upload", "Upload failed. Please try again.", storageErr);
        return;
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
        onScanStart?.(file.name, newScanSessionId);
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
          className="overflow-hidden max-w-2xl mx-auto mt-6"
        >
          <div className="card-raised p-7 md:p-8">
            <span className="inline-block wm-eyebrow text-primary bg-primary/10 px-3 py-1 mb-5">UPLOAD YOUR QUOTE</span>
            <h2 className="font-display text-[26px] text-foreground font-extrabold tracking-[0.02em] uppercase mb-2">
              Drop your quote to start the scan.
            </h2>
            <p className="wm-body mb-7">
              Upload Your Quote Or Estimate and I'll Forensically Analyze it in 60 Seconds.
            </p>

            {/* ── Dropzone ── */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={handleDropzoneClick}
              className={`border-2 border-dashed text-center cursor-pointer transition-all py-12 px-8 input-well ${
                isDragOver ? "border-primary" : "border-border/60"
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
                style={{ display: "none" }}
              />

              {!file ? (
                <>
                  <Upload size={48} className="text-muted-foreground mx-auto mb-3" />
                  <p className="font-body text-[15px] text-foreground font-semibold">Drag your quote here</p>
                  <p className="font-body text-[13px] text-muted-foreground mt-1">or click to browse files</p>
                </>
              ) : (
                <div onClick={(e) => e.stopPropagation()}>
                  <div
                    className="flex items-center justify-center mx-auto w-12 h-12 bg-primary/10 mb-3"
                    style={{ borderRadius: "var(--radius-btn)" }}
                  >
                    <span className="text-primary text-2xl font-bold">✓</span>
                  </div>
                  <p className="font-body text-[15px] text-foreground font-semibold">{file.name}</p>
                  <p className="font-body text-xs text-muted-foreground mt-0.5">{formatSize(file.size)}</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      resetUploadSelection();
                    }}
                    className="font-body text-xs text-primary bg-transparent border-none underline cursor-pointer mt-2"
                  >
                    Change file
                  </button>
                </div>
              )}
            </div>

            {fileError && (
              <p className="font-body text-[13px] text-destructive text-center mt-3 font-medium">{fileError}</p>
            )}

            {/* ── Live progress (tied to real scan_sessions.status) ── */}
            {showProgress && (
              <div className="mt-5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-body text-[12px] text-muted-foreground font-medium">{progress.label}</span>
                  <span className="font-mono text-[12px] text-primary tabular-nums">{progress.pct}%</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "linear-gradient(90deg, #4DA3FF, #2563EB)" }}
                    animate={{ width: `${progress.pct}%` }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                </div>
              </div>
            )}

            {/* ── Error + retry (only after a scan was attempted) ── */}
            {uploadError && !uploading && (
              <div className="mt-4 p-3 rounded-md border border-destructive/30 bg-destructive/5">
                <p className="font-body text-[13px] text-destructive text-center font-medium mb-2">{uploadError}</p>
                <button
                  onClick={handleScan}
                  disabled={busy}
                  className="btn-depth-primary w-full"
                  style={{
                    height: 44,
                    fontSize: 14,
                    opacity: busy ? 0.7 : 1,
                    cursor: busy ? "not-allowed" : "pointer",
                  }}
                >
                  {uploading ? "Retrying..." : "Retry Scan →"}
                </button>
                {/* Dev/preview-only diagnostic. Never rendered in prod. */}
                {uploadErrorDiag && import.meta.env.DEV && (
                  <p className="font-mono text-[11px] text-muted-foreground text-center mt-2 break-all">
                    {uploadErrorDiag}
                  </p>
                )}
              </div>
            )}

            {file && !uploadError && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                onClick={handleScan}
                disabled={busy}
                className="btn-depth-primary w-full mt-5"
                style={{
                  height: 54,
                  fontSize: 17,
                  opacity: busy ? 0.7 : 1,
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                {uploading
                  ? "Uploading..."
                  : activeScanSessionId !== null
                    ? "Scanning..."
                    : "Start My AI Scan →"}
              </motion.button>
            )}

            <p className="font-body text-[13px] text-muted-foreground text-center mt-4">
              Don't Have a Digital Copy?{" "}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  trackEvent({ event_name: "photo_option_clicked" });
                  if (inputRef.current) {
                    inputRef.current.value = "";
                    inputRef.current.click();
                  }
                }}
                className="font-body text-[13px] text-primary bg-transparent border-none underline cursor-pointer"
              >
                Take a Photo With Your Phone →
              </button>
            </p>
            <p className="font-body text-[11px] text-muted-foreground text-center mt-4">
              Accepted: PDF, JPG, PNG, HEIC · Max file size: 10MB
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UploadZone;
