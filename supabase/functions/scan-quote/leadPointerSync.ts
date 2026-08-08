/**
 * scan-quote/leadPointerSync.ts
 *
 * Lead pointer synchronization for completed analyses.
 *
 * `public.set_latest_complete_analysis_pointer` is the sole authority for
 * ownership validation, completion validation, pointer repair, and monotonic
 * ordering. This helper never writes `leads` directly, so an older scan
 * finishing late can never replace a newer pointer.
 *
 * ⚠️  Logs carry controlled detail, identifiers, RPC name, and optional
 * PostgREST/SQLSTATE code only. Never log error.message, details, hint,
 * quote contents, OCR text, `full_json`, or contact PII here.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export const LEAD_POINTER_RPC_NAME =
  "set_latest_complete_analysis_pointer" as const;

export const LEAD_POINTER_SYNC_ERROR_CODE = "lead_pointer_sync_failed" as const;

/** Every outcome the merged RPC can report. All four are successful. */
export const LEAD_POINTER_RPC_OUTCOMES = [
  "updated",
  "repaired_invalid_current",
  "already_current",
  "kept_newer",
] as const;

export type LeadPointerRpcOutcome = typeof LEAD_POINTER_RPC_OUTCOMES[number];

/**
 * Lead columns this function must never write. The RPC owns
 * `latest_analysis_id`; CRM state such as funnel stage and denormalized grade
 * or flag counts is out of scope for the scanner.
 */
export const FORBIDDEN_LEAD_POINTER_KEYS = [
  "funnel_stage",
  "latest_scan_session_id",
  "grade",
  "flag_count",
  "critical_flag_count",
  "red_flag_count",
  "amber_flag_count",
] as const;

export type LeadPointerRpcArgs = {
  p_lead_id: string;
  p_analysis_id: string;
};

export type LeadPointerRpcRow = {
  updated: boolean;
  outcome: LeadPointerRpcOutcome;
  latest_analysis_id: string;
};

export type LeadPointerSyncLog = {
  detail: string;
  lead_id: string;
  analysis_id: string;
  scan_session_id: string;
  rpc: typeof LEAD_POINTER_RPC_NAME;
  outcome?: string;
  postgrest_code?: string;
};

export type LeadPointerSyncClientBody = {
  error: typeof LEAD_POINTER_SYNC_ERROR_CODE;
  scan_session_id: string;
  analysis_status: "complete";
  scan_session_status: "processing";
};

export type LeadPointerSyncPlan =
  | { kind: "skip" }
  | { kind: "missing_analysis_id"; leadId: string }
  | { kind: "sync"; leadId: string; analysisId: string };

export type LeadPointerSyncResult =
  | { ok: true; row: LeadPointerRpcRow }
  | {
    ok: false;
    log: LeadPointerSyncLog;
    clientBody: LeadPointerSyncClientBody;
  };

/**
 * Session-only scans skip synchronization. A lead-backed scan without a
 * persisted analysis ID fails closed rather than leaving the pointer stale.
 */
export function planLeadPointerSync(
  leadId: string | null | undefined,
  analysisId: string | null | undefined,
): LeadPointerSyncPlan {
  if (!leadId) {
    return { kind: "skip" };
  }
  if (!analysisId || analysisId.trim() === "") {
    return { kind: "missing_analysis_id", leadId };
  }
  return { kind: "sync", leadId, analysisId };
}

export function buildLeadPointerRpcArgs(
  leadId: string,
  analysisId: string,
): LeadPointerRpcArgs {
  return { p_lead_id: leadId, p_analysis_id: analysisId };
}

export function buildLeadPointerSyncClientBody(
  scanSessionId: string,
): LeadPointerSyncClientBody {
  return {
    error: LEAD_POINTER_SYNC_ERROR_CODE,
    scan_session_id: scanSessionId,
    analysis_status: "complete",
    scan_session_status: "processing",
  };
}

export function buildMissingAnalysisIdLog(
  leadId: string,
  scanSessionId: string,
): LeadPointerSyncLog {
  return {
    detail: "missing_analysis_id_after_upsert",
    lead_id: leadId,
    analysis_id: "",
    scan_session_id: scanSessionId,
    rpc: LEAD_POINTER_RPC_NAME,
  };
}

function isRecognizedOutcome(value: unknown): value is LeadPointerRpcOutcome {
  return typeof value === "string" &&
    (LEAD_POINTER_RPC_OUTCOMES as readonly string[]).includes(value);
}

/**
 * Accepts exactly one valid row. `kept_newer` may report a pointer other than
 * the candidate analysis, so the returned ID is never required to match.
 */
export function interpretLeadPointerRpcResult(
  data: unknown,
): { ok: true; row: LeadPointerRpcRow } | { ok: false; detail: string } {
  let rows: unknown[];
  if (Array.isArray(data)) {
    rows = data;
  } else if (data && typeof data === "object") {
    rows = [data];
  } else {
    return { ok: false, detail: "rpc_result_missing" };
  }

  if (rows.length === 0) {
    return { ok: false, detail: "rpc_result_missing" };
  }
  if (rows.length > 1) {
    return { ok: false, detail: "rpc_result_multiple_rows" };
  }

  const row = rows[0];
  if (!row || typeof row !== "object") {
    return { ok: false, detail: "rpc_result_malformed" };
  }

  const candidate = row as Record<string, unknown>;
  if (typeof candidate.updated !== "boolean") {
    return { ok: false, detail: "rpc_result_malformed" };
  }
  if (
    typeof candidate.latest_analysis_id !== "string" ||
    candidate.latest_analysis_id.trim() === ""
  ) {
    return { ok: false, detail: "rpc_result_malformed" };
  }
  if (!isRecognizedOutcome(candidate.outcome)) {
    return { ok: false, detail: "rpc_outcome_unrecognized" };
  }

  return {
    ok: true,
    row: {
      updated: candidate.updated,
      outcome: candidate.outcome,
      latest_analysis_id: candidate.latest_analysis_id,
    },
  };
}

export async function syncLeadAnalysisPointer(
  supabase: SupabaseClient,
  params: { leadId: string; analysisId: string; scanSessionId: string },
): Promise<LeadPointerSyncResult> {
  const baseLog = {
    lead_id: params.leadId,
    analysis_id: params.analysisId,
    scan_session_id: params.scanSessionId,
    rpc: LEAD_POINTER_RPC_NAME,
  } as const;

  const { data, error } = await supabase.rpc(
    LEAD_POINTER_RPC_NAME,
    buildLeadPointerRpcArgs(params.leadId, params.analysisId),
  );

  if (error) {
    return {
      ok: false,
      log: {
        ...baseLog,
        detail: "rpc_error",
        postgrest_code: typeof error.code === "string" ? error.code : undefined,
      },
      clientBody: buildLeadPointerSyncClientBody(params.scanSessionId),
    };
  }

  const interpreted = interpretLeadPointerRpcResult(data);
  if (!interpreted.ok) {
    return {
      ok: false,
      log: { ...baseLog, detail: interpreted.detail },
      clientBody: buildLeadPointerSyncClientBody(params.scanSessionId),
    };
  }

  return { ok: true, row: interpreted.row };
}
