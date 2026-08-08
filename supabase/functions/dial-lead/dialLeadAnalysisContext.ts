/**
 * Canonical dial-lead analysis context from lead.latest_analysis_id.
 * Never reads grade, flag counts, or scan session from lead snapshot columns.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export const DIAL_COMPLETED_ANALYSIS_STATUS = "complete" as const;

export const DIAL_ANALYSIS_SELECT =
  "id, lead_id, scan_session_id, analysis_status, grade, flags";

export type DialLeadAnalysisRow = {
  id: string;
  lead_id: string | null;
  scan_session_id: string | null;
  analysis_status: string;
  grade: string | null;
  flags: unknown;
};

export type DialLeadAnalysisContext = {
  analysis_id: string | null;
  scan_session_id: string | null;
  grade: string | null;
  flag_count: number;
};

export const EMPTY_DIAL_LEAD_ANALYSIS_CONTEXT: DialLeadAnalysisContext = {
  analysis_id: null,
  scan_session_id: null,
  grade: null,
  flag_count: 0,
};

export type DialLeadWebhookAnalysisFields = Pick<
  DialLeadAnalysisContext,
  "scan_session_id" | "grade" | "flag_count"
>;

export type DialLeadContextFailureKind =
  | "invalid_context"
  | "lookup_failed";

export type ResolveDialLeadContextResult =
  | { ok: true; context: DialLeadAnalysisContext }
  | {
    ok: false;
    kind: DialLeadContextFailureKind;
    errorMessage: string;
  };

export const DIAL_LEAD_INVALID_CONTEXT_ERROR =
  "Lead analysis context is unavailable";

export const DIAL_LEAD_LOOKUP_FAILED_ERROR =
  "Unable to load lead analysis context";

export function httpStatusForDialLeadContextFailure(
  kind: DialLeadContextFailureKind,
): number {
  return kind === "lookup_failed" ? 500 : 400;
}

/** Lead snapshot columns dial-lead must not use as analysis authority. */
export const FORBIDDEN_LEAD_SNAPSHOT_KEYS = [
  "latest_scan_session_id",
  "grade",
  "flag_count",
] as const;

export function countDialLeadFlags(raw: unknown): number {
  if (!Array.isArray(raw)) return 0;
  let count = 0;
  for (const item of raw) {
    if (
      item !== null &&
      typeof item === "object" &&
      !Array.isArray(item)
    ) {
      count++;
    }
  }
  return count;
}

export function buildDialLeadWebhookAnalysisFields(
  context: DialLeadAnalysisContext,
): DialLeadWebhookAnalysisFields {
  return {
    scan_session_id: context.scan_session_id,
    grade: context.grade,
    flag_count: context.flag_count,
  };
}

export function resolveDialLeadAnalysisContext(
  leadId: string,
  latestAnalysisId: string | null | undefined,
  analysis: DialLeadAnalysisRow | null | undefined,
): ResolveDialLeadContextResult {
  if (!latestAnalysisId || typeof latestAnalysisId !== "string") {
    return { ok: true, context: { ...EMPTY_DIAL_LEAD_ANALYSIS_CONTEXT } };
  }
  if (!analysis) {
    return {
      ok: false,
      kind: "invalid_context",
      errorMessage: DIAL_LEAD_INVALID_CONTEXT_ERROR,
    };
  }
  if (analysis.id !== latestAnalysisId) {
    return {
      ok: false,
      kind: "invalid_context",
      errorMessage: DIAL_LEAD_INVALID_CONTEXT_ERROR,
    };
  }
  if (analysis.lead_id !== leadId) {
    return {
      ok: false,
      kind: "invalid_context",
      errorMessage: DIAL_LEAD_INVALID_CONTEXT_ERROR,
    };
  }
  if (analysis.analysis_status !== DIAL_COMPLETED_ANALYSIS_STATUS) {
    return {
      ok: false,
      kind: "invalid_context",
      errorMessage: DIAL_LEAD_INVALID_CONTEXT_ERROR,
    };
  }
  const scanSessionId = analysis.scan_session_id;
  if (!scanSessionId || typeof scanSessionId !== "string") {
    return {
      ok: false,
      kind: "invalid_context",
      errorMessage: DIAL_LEAD_INVALID_CONTEXT_ERROR,
    };
  }

  return {
    ok: true,
    context: {
      analysis_id: analysis.id,
      scan_session_id: scanSessionId,
      grade: analysis.grade,
      flag_count: countDialLeadFlags(analysis.flags),
    },
  };
}

export async function loadDialLeadAnalysisContext(
  supabase: SupabaseClient,
  leadId: string,
  latestAnalysisId: string | null,
): Promise<ResolveDialLeadContextResult> {
  if (!latestAnalysisId) {
    return { ok: true, context: { ...EMPTY_DIAL_LEAD_ANALYSIS_CONTEXT } };
  }

  const { data: analysis, error } = await supabase
    .from("analyses")
    .select(DIAL_ANALYSIS_SELECT)
    .eq("id", latestAnalysisId)
    .eq("lead_id", leadId)
    .eq("analysis_status", DIAL_COMPLETED_ANALYSIS_STATUS)
    .maybeSingle();

  if (error) {
    console.error("[dial-lead] Analysis context lookup failed", {
      stage: "analysis_context_lookup",
      lead_id: leadId,
    });
    return {
      ok: false,
      kind: "lookup_failed",
      errorMessage: DIAL_LEAD_LOOKUP_FAILED_ERROR,
    };
  }

  return resolveDialLeadAnalysisContext(
    leadId,
    latestAnalysisId,
    analysis as DialLeadAnalysisRow | null,
  );
}
