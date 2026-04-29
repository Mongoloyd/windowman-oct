import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Terminal statuses — stop polling when we hit one of these.
 */
const TERMINAL_STATUSES = new Set([
  "preview_ready",
  "complete",
  "invalid_document",
  "needs_better_upload",
  "error",
  "failed",
  "unreadable",
]);

export type ScanStatus =
  | "idle"
  | "uploading"
  | "processing"
  | "preview_ready"
  | "complete"
  | "invalid_document"
  | "needs_better_upload"
  | "error"
  | "failed"
  | "unreadable";

interface UseScanPollingOptions {
  /** scan_sessions.id to poll */
  scanSessionId: string | null;
  /** Polling interval in ms (default: 2500) */
  intervalMs?: number;
  /** Max polls before giving up (default: 60 → ~2.5 min at 2.5s) */
  maxPolls?: number;
}

interface UseScanPollingResult {
  status: ScanStatus;
  isPolling: boolean;
  error: string | null;
}

/**
 * Thin polling hook for scan status.
 * Uses a SECURITY DEFINER RPC (get_scan_status) that returns only id + status.
 * No direct table SELECT — scan_sessions has no anon SELECT policy.
 */
export function useScanPolling({
  scanSessionId,
  intervalMs = 2500,
  maxPolls = 60,
}: UseScanPollingOptions): UseScanPollingResult {
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollCountRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const poll = useCallback(async () => {
    if (!scanSessionId) return;

    pollCountRef.current += 1;
    if (pollCountRef.current > maxPolls) {
      setError("Scan is taking longer than expected. Please check back shortly.");
      stopPolling();
      return;
    }

    try {
      const { data, error: rpcErr } = await supabase
        .rpc("get_scan_status", { p_scan_session_id: scanSessionId });

      if (rpcErr) {
        console.error("Scan poll RPC error:", rpcErr);
        return; // transient — keep polling
      }

      // RPC returns an array of rows; take first
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return; // not found yet — keep polling

      const newStatus = (row.status as ScanStatus) || "error";
      setStatus(newStatus);

      if (TERMINAL_STATUSES.has(newStatus)) {
        stopPolling();
      }
    } catch (err) {
      console.error("Scan poll exception:", err);
    }
  }, [scanSessionId, maxPolls, stopPolling]);

  useEffect(() => {
    if (!scanSessionId) {
      stopPolling();
      setStatus("idle");
      setError(null);
      pollCountRef.current = 0;
      return;
    }

    setStatus("uploading");
    setError(null);
    setIsPolling(true);
    pollCountRef.current = 0;

    // Immediate first poll
    poll();
    intervalRef.current = setInterval(poll, intervalMs);

    return () => { stopPolling(); };
  }, [scanSessionId, intervalMs, poll, stopPolling]);

  return { status, isPolling, error };
}
