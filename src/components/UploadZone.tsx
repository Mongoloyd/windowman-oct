import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/trackEvent";
import { trackGtmEvent } from "@/lib/trackConversion";
import { useScanPolling } from "@/hooks/useScanPolling";
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
  sessionId?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];

const formatSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const UploadZone = ({ isVisible, onScanStart, sessionId }: UploadZoneProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Persist scanSessionId so a retry can re-invoke the edge function without
  // re-uploading the file or duplicating scan_sessions / quote_files rows.
  const [activeScanSessionId, setActiveScanSessionId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Live scan status — only polled once we have a real session id.
  const { status: liveStatus } = useScanPolling({ scanSessionId: activeScanSessionId });
  const progress = STATUS_PROGRESS[liveStatus] ?? STATUS_PROGRESS.idle;
  const showProgress = uploading || (activeScanSessionId !== null && liveStatus !== "idle" && liveStatus !== "error");

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

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  const handleScan = async () => {
    if (!file || uploading) return;
    setUploading(true);
    try {
      const filePath = `${sessionId || crypto.randomUUID()}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("quotes").upload(filePath, file);
      if (uploadError) {
        console.error("Storage upload failed:", uploadError);
        toast.error("Upload failed. Please try again.");
        setUploading(false);
        return;
      }

      let leadId: string | null = null;
      if (sessionId) {
        const { data: leads } = await supabase.rpc("get_lead_by_session", { p_session_id: sessionId });
        leadId = leads?.[0]?.id || null;
      }
      if (!leadId) {
        const fallbackLeadId = crypto.randomUUID();
        const fallbackSessionId = sessionId || crypto.randomUUID();
        const { error: leadErr } = await supabase
          .from("leads")
          .insert({ id: fallbackLeadId, session_id: fallbackSessionId, source: "direct_upload" });
        if (leadErr) {
          console.error("Failed to create fallback lead:", leadErr);
          toast.error("Failed to initialize session. Please try again.");
          setUploading(false);
          return;
        }
        leadId = fallbackLeadId;
      }

      const quoteFileId = crypto.randomUUID();
      const { error: qfError } = await supabase
        .from("quote_files")
        .insert({ id: quoteFileId, lead_id: leadId, storage_path: filePath, status: "pending" });
      if (qfError) {
        console.error("quote_files insert failed:", qfError);
        toast.error("Failed to register your file. Please try again.");
        setUploading(false);
        return;
      }
      const scanSessionId = crypto.randomUUID();
      const { error: ssError } = await supabase
        .from("scan_sessions")
        .insert({ id: scanSessionId, status: "uploading", lead_id: leadId, quote_file_id: quoteFileId });
      if (ssError) {
        console.error("scan_sessions insert failed:", ssError);
        toast.error("Failed to start scan session. Please try again.");
        setUploading(false);
        return;
      }
      trackEvent({
        event_name: "upload_completed",
        session_id: sessionId,
        metadata: { scan_session_id: scanSessionId, file_name: file.name, file_size: file.size },
      });
      onScanStart?.(file.name, scanSessionId);

      // Forever rule: opaque UUID v4 reused for the same event instance
      // (GTM browser fire + scan-quote invoke). Metadata stays in separate
      // fields. Bad ids cannot block the scan — backend tolerates and
      // substitutes. See supabase/functions/scan-quote/requestSchema.ts.
      const quoteUploadedEventId = makeTransportEventId();

      trackGtmEvent("quote_uploaded", {
        event_id: quoteUploadedEventId,
        value: 250,
        currency: "USD",
        scan_session_id: scanSessionId,
        lead_id: leadId || undefined,
        file_size: file.size,
        file_type: file.type,
      });

      const { data: fnData, error: fnError } = await supabase.functions.invoke("scan-quote", {
        body: { scan_session_id: scanSessionId, event_id: quoteUploadedEventId },
      });
      if (fnError) {
        const isRateLimited = fnData?.error === "rate_limit_exceeded";
        if (isRateLimited) {
          toast.error(
            fnData?.message ||
              "You've reached the limit for free scans this hour. Please try again in a bit or contact us for a bulk review.",
          );
        } else {
          toast.error("Scan encountered an issue. We'll retry automatically.");
        }
        await supabase.from("event_logs").insert({
          event_name: isRateLimited ? "scan_rate_limited" : "scan_invoke_failed",
          session_id: sessionId || null,
          metadata: {
            scan_session_id: scanSessionId,
            quote_file_id: quoteFileId,
            error_message: fnError.message || String(fnError),
            file_name: file.name,
            file_size: file.size,
            timestamp: new Date().toISOString(),
          },
        });
      }
    } catch (err) {
      console.error("Scan error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setUploading(false);
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
                      setFile(null);
                      if (inputRef.current) inputRef.current.value = "";
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

            {file && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                onClick={handleScan}
                disabled={uploading}
                className="btn-depth-primary w-full mt-5"
                style={{
                  height: 54,
                  fontSize: 17,
                  opacity: uploading ? 0.7 : 1,
                  cursor: uploading ? "not-allowed" : "pointer",
                }}
              >
                {uploading ? "Uploading..." : "Start My AI Scan →"}
              </motion.button>
            )}

            <p className="font-body text-[13px] text-muted-foreground text-center mt-4">
              Don't Have a Digital Copy?{" "}
              <button
                onClick={() => trackEvent({ event_name: "photo_option_clicked" })}
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
