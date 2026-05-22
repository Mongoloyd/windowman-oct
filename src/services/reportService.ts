/**
 * reportService — Supabase transport for the analysis/report pipeline.
 *
 * Owns transport, response parsing, and error normalization.
 * Hooks call these functions instead of touching supabase directly.
 *
 * Preview and full report fetches route through the `report-access` Edge Function
 * (service-role proxy) because get_analysis_preview and get_analysis_full are
 * SECURITY DEFINER RPCs executable only by service_role.
 * Direct browser supabase.rpc() calls to those RPCs will always fail.
 *
 * Scan status uses supabase.rpc() directly (not service_role-restricted).
 * Dev bypass uses the dev-report-unlock Edge Function (dev/staging only).
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  ServiceResult,
  RawPreviewRow,
  RawFullRow,
  ScanStatusRow,
} from "@/types/serviceResults";
import { parseV2SourceProjection, parseV2SourceVersion } from "@/types/v2ReportTransport";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapRawFullRow(row: Record<string, unknown>): RawFullRow {
  return {
    analysis_id:
      typeof row.analysis_id === "string"
        ? row.analysis_id
        : null,
    grade: typeof row.grade === "string" ? row.grade : "",
    flags: row.flags,
    full_json: isRecord(row.full_json) ? row.full_json : null,
    proof_of_read: isRecord(row.proof_of_read) ? row.proof_of_read : null,
    preview_json: isRecord(row.preview_json) ? row.preview_json : null,
    confidence_score:
      typeof row.confidence_score === "number" ? row.confidence_score : null,
    document_type: typeof row.document_type === "string" ? row.document_type : null,
    rubric_version: typeof row.rubric_version === "string" ? row.rubric_version : null,
    v2_source_version: parseV2SourceVersion(row.v2_source_version),
    v2_source: parseV2SourceProjection(row.v2_source),
  };
}

// ── Scan status ─────────────────────────────────────────────────────────────

export async function fetchScanStatus(
  scanSessionId: string
): Promise<ServiceResult<ScanStatusRow | null>> {
  try {
    const { data, error } = await supabase.rpc("get_scan_status", {
      p_scan_session_id: scanSessionId,
    });
    if (error) {
      return { ok: false, code: "rpc_error", message: error.message };
    }
    const row = Array.isArray(data) ? data[0] : (data as any);
    return { ok: true, data: row ?? null };
  } catch (err) {
    return { ok: false, code: "network", message: String(err) };
  }
}

// ── Preview fetch ───────────────────────────────────────────────────────────

export async function fetchAnalysisPreview(
  scanSessionId: string
): Promise<ServiceResult<RawPreviewRow | null>> {
  try {
    const { data: fnData, error: fnErr } = await supabase.functions.invoke(
      "report-access",
      { body: { mode: "preview", scan_session_id: scanSessionId } }
    );
    if (fnErr) {
      return { ok: false, code: "rpc_error", message: String(fnErr) };
    }
    // Unwrap Edge Function envelope: { ok: true, mode: "preview", data: <row> }
    // A not-yet-ready analysis returns { ok: false, error: "..." } — treat as
    // null so useAnalysisData retries (same behavior as the previous RPC path).
    const envelope = isRecord(fnData) ? fnData : null;
    const row =
      envelope?.ok === true && envelope.mode === "preview" && isRecord(envelope.data)
        ? envelope.data
        : null;
    if (!row || typeof row.grade !== "string" || !row.grade) {
      return { ok: true, data: null };
    }
    // Preview whitelist: never preserve v2_source / v2_source_version (belt-and-suspenders).
    return {
      ok: true,
      data: {
        analysis_id:
      typeof row.analysis_id === "string"
        ? row.analysis_id
        : null,
        grade: row.grade,
        flag_count: typeof row.flag_count === "number" ? row.flag_count : 0,
        flag_red_count: typeof row.flag_red_count === "number" ? row.flag_red_count : 0,
        flag_amber_count: typeof row.flag_amber_count === "number" ? row.flag_amber_count : 0,
        proof_of_read: isRecord(row.proof_of_read) ? row.proof_of_read : null,
        preview_json: isRecord(row.preview_json) ? row.preview_json : null,
        confidence_score:
          typeof row.confidence_score === "number" ? row.confidence_score : null,
        document_type: typeof row.document_type === "string" ? row.document_type : null,
        rubric_version: typeof row.rubric_version === "string" ? row.rubric_version : null,
      },
    };
  } catch (err) {
    return { ok: false, code: "network", message: String(err) };
  }
}

// ── Full gated fetch ────────────────────────────────────────────────────────

export async function fetchAnalysisFull(
  scanSessionId: string,
  phoneE164: string
): Promise<ServiceResult<RawFullRow | null>> {
  try {
    const { data: fnData, error: fnErr } = await supabase.functions.invoke(
      "report-access",
      { body: { mode: "full", scan_session_id: scanSessionId, phone_e164: phoneE164 } }
    );
    if (fnErr) {
      return { ok: false, code: "rpc_error", message: String(fnErr) };
    }
    // Unauthorized sentinel: the Edge Function normalizes the __UNAUTHORIZED__ grade
    // into this explicit shape (HTTP 200). It cannot be detected via fnErr.
    if (isRecord(fnData) && fnData.ok === true && fnData.authorized === false) {
      return {
        ok: false,
        code: "unauthorized",
        message: "Verification failed. Please re-verify your phone number.",
      };
    }
    // Unwrap authorized full envelope: { ok: true, mode: "full", authorized: true, data: <row> }
    const envelope = isRecord(fnData) ? fnData : null;
    const row =
      envelope?.ok === true &&
      envelope.authorized === true &&
      isRecord(envelope.data)
        ? envelope.data
        : null;
    if (!row || typeof row.grade !== "string" || !row.grade) {
      return { ok: true, data: null };
    }
    return {
      ok: true,
      data: mapRawFullRow(row),
    };
  } catch (err) {
    return { ok: false, code: "network", message: String(err) };
  }
}

// ── Dev bypass fetch ────────────────────────────────────────────────────────

export async function fetchFullViaDevBypass(
  scanSessionId: string,
  devSecret: string
): Promise<ServiceResult<RawFullRow>> {
  try {
    const { data: fnData, error: fnErr } = await supabase.functions.invoke(
      "dev-report-unlock",
      { body: { scan_session_id: scanSessionId, dev_secret: devSecret } }
    );
    if (fnErr) {
      return { ok: false, code: "dev_bypass_error", message: String(fnErr) };
    }
    if (!isRecord(fnData) || typeof fnData.grade !== "string" || !fnData.grade) {
      return { ok: false, code: "empty", message: "Dev bypass returned no data." };
    }
    return {
      ok: true,
      data: mapRawFullRow(fnData),
    };
  } catch (err) {
    return { ok: false, code: "network", message: String(err) };
  }
}
