/**
 * reportService — Supabase transport for the analysis/report pipeline.
 *
 * Owns all RPC calls, response parsing, and error normalization.
 * Hooks call these functions instead of touching supabase directly.
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  ServiceResult,
  RawPreviewRow,
  RawFullRow,
  ScanStatusRow,
} from "@/types/serviceResults";

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
    const { data: rows, error: rpcErr } = await supabase.rpc(
      "get_analysis_preview",
      { p_scan_session_id: scanSessionId }
    );
    if (rpcErr) {
      return { ok: false, code: "rpc_error", message: rpcErr.message };
    }
    const row = (Array.isArray(rows) ? rows[0] : rows) as any;
    if (!row || !row.grade) {
      return { ok: true, data: null };
    }
    return {
      ok: true,
      data: {
        analysis_id: row.analysis_id ?? null,
        grade: row.grade,
        flag_count: row.flag_count ?? 0,
        flag_red_count: row.flag_red_count ?? 0,
        flag_amber_count: row.flag_amber_count ?? 0,
        proof_of_read: (row.proof_of_read as Record<string, unknown>) ?? null,
        preview_json: (row.preview_json as Record<string, unknown>) ?? null,
        confidence_score: row.confidence_score ?? null,
        document_type: row.document_type ?? null,
        rubric_version: row.rubric_version ?? null,
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
    const { data: rows, error: rpcErr } = await (supabase.rpc as any)(
      "get_analysis_full",
      { p_scan_session_id: scanSessionId, p_phone_e164: phoneE164 }
    );
    if (rpcErr) {
      return { ok: false, code: "rpc_error", message: rpcErr.message };
    }
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row || !row.grade) {
      return { ok: true, data: null };
    }
    if (row.grade === "__UNAUTHORIZED__") {
      return {
        ok: false,
        code: "unauthorized",
        message: "Verification failed. Please re-verify your phone number.",
      };
    }
    return {
      ok: true,
      data: {
        analysis_id: row.analysis_id ?? null,
        grade: row.grade,
        flags: row.flags,
        full_json: (row.full_json as Record<string, unknown>) ?? null,
        proof_of_read: (row.proof_of_read as Record<string, unknown>) ?? null,
        preview_json: (row.preview_json as Record<string, unknown>) ?? null,
        confidence_score: row.confidence_score ?? null,
        document_type: row.document_type ?? null,
        rubric_version: row.rubric_version ?? null,
      },
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
    if (!fnData || !fnData.grade) {
      return { ok: false, code: "empty", message: "Dev bypass returned no data." };
    }
    return {
      ok: true,
      data: {
        analysis_id: fnData.analysis_id ?? null,
        grade: fnData.grade,
        flags: fnData.flags,
        full_json: (fnData.full_json as Record<string, unknown>) ?? null,
        proof_of_read: (fnData.proof_of_read as Record<string, unknown>) ?? null,
        preview_json: (fnData.preview_json as Record<string, unknown>) ?? null,
        confidence_score: fnData.confidence_score ?? null,
        document_type: fnData.document_type ?? null,
        rubric_version: fnData.rubric_version ?? null,
      },
    };
  } catch (err) {
    return { ok: false, code: "network", message: String(err) };
  }
}
