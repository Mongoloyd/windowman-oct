/**
 * Canonical contractor-handoff analysis context from lead.latest_analysis_id.
 * Never reads grade, flag counts, or scan session from lead snapshot columns.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export const HANDOFF_COMPLETED_ANALYSIS_STATUS = "complete" as const;

export const HANDOFF_ANALYSIS_SELECT =
  "id, lead_id, scan_session_id, analysis_status, grade, flags, full_json";

export type HandoffFlag = {
  severity?: string;
  description?: string;
  flag?: string;
  detail?: string;
};

export type HandoffAnalysisRow = {
  id: string;
  lead_id: string | null;
  scan_session_id: string | null;
  analysis_status: string;
  grade: string | null;
  flags: unknown;
  full_json: unknown;
};

export type HandoffEmailProjection = {
  pillarScores:
    | Record<
      string,
      { grade?: string; score?: number; summary?: string }
    >
    | null;
  topFlags: HandoffFlag[];
};

export type HandoffAnalysisContext = {
  analysis_id: string;
  scan_session_id: string;
  grade: string | null;
  flag_count: number;
  emailProjection: HandoffEmailProjection;
};

export type HandoffOpportunityProjection = Pick<
  HandoffAnalysisContext,
  "analysis_id" | "scan_session_id" | "grade" | "flag_count"
>;

export type ResolveHandoffContextResult =
  | { ok: true; context: HandoffAnalysisContext }
  | { ok: false; errorMessage: string };

const GENERIC_CONTEXT_ERROR = "Lead missing scan session or analysis data";

/** Lead snapshot columns handoff must not use as analysis authority. */
export const FORBIDDEN_LEAD_SNAPSHOT_KEYS = [
  "latest_scan_session_id",
  "grade",
  "flag_count",
  "critical_flag_count",
  "red_flag_count",
  "amber_flag_count",
] as const;

export function parseHandoffFlags(raw: unknown): HandoffFlag[] {
  if (!Array.isArray(raw)) return [];
  const out: HandoffFlag[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== "object") continue;
    const f = item as Record<string, unknown>;
    out.push({
      severity: typeof f.severity === "string" ? f.severity : undefined,
      description: typeof f.description === "string"
        ? f.description
        : undefined,
      flag: typeof f.flag === "string" ? f.flag : undefined,
      detail: typeof f.detail === "string" ? f.detail : undefined,
    });
  }
  return out;
}

/** Deterministic flag count: prefer analyses.flags column, else full_json.flags. */
export function countHandoffFlags(
  flagsColumn: unknown,
  fullJson: unknown,
): number {
  const fromColumn = parseHandoffFlags(flagsColumn);
  if (fromColumn.length > 0) return fromColumn.length;
  const record = fullJson && typeof fullJson === "object"
    ? fullJson as Record<string, unknown>
    : null;
  return parseHandoffFlags(record?.flags).length;
}

export function buildHandoffEmailProjection(
  fullJson: unknown,
): HandoffEmailProjection {
  const record = fullJson && typeof fullJson === "object"
    ? fullJson as Record<string, unknown>
    : null;
  const pillarScores =
    (record?.pillar_scores as HandoffEmailProjection["pillarScores"]) ?? null;
  const allFlags = parseHandoffFlags(record?.flags);
  const topFlags = allFlags
    .filter((f) => f.severity === "High" || f.severity === "Critical")
    .slice(0, 3);
  return { pillarScores, topFlags };
}

export function buildHandoffOpportunityProjection(
  context: HandoffAnalysisContext,
): HandoffOpportunityProjection {
  return {
    analysis_id: context.analysis_id,
    scan_session_id: context.scan_session_id,
    grade: context.grade,
    flag_count: context.flag_count,
  };
}

export function resolveHandoffAnalysisContext(
  leadId: string,
  latestAnalysisId: string | null | undefined,
  analysis: HandoffAnalysisRow | null | undefined,
): ResolveHandoffContextResult {
  if (!latestAnalysisId || typeof latestAnalysisId !== "string") {
    return { ok: false, errorMessage: GENERIC_CONTEXT_ERROR };
  }
  if (!analysis) {
    return { ok: false, errorMessage: GENERIC_CONTEXT_ERROR };
  }
  if (analysis.id !== latestAnalysisId) {
    return { ok: false, errorMessage: GENERIC_CONTEXT_ERROR };
  }
  if (analysis.lead_id !== leadId) {
    return { ok: false, errorMessage: GENERIC_CONTEXT_ERROR };
  }
  if (analysis.analysis_status !== HANDOFF_COMPLETED_ANALYSIS_STATUS) {
    return { ok: false, errorMessage: GENERIC_CONTEXT_ERROR };
  }
  const scanSessionId = analysis.scan_session_id;
  if (!scanSessionId || typeof scanSessionId !== "string") {
    return { ok: false, errorMessage: GENERIC_CONTEXT_ERROR };
  }

  const flag_count = countHandoffFlags(analysis.flags, analysis.full_json);
  const emailProjection = buildHandoffEmailProjection(analysis.full_json);

  return {
    ok: true,
    context: {
      analysis_id: analysis.id,
      scan_session_id: scanSessionId,
      grade: analysis.grade,
      flag_count,
      emailProjection,
    },
  };
}

export async function loadHandoffAnalysisContext(
  supabase: SupabaseClient,
  leadId: string,
  latestAnalysisId: string | null,
): Promise<ResolveHandoffContextResult> {
  if (!latestAnalysisId) {
    return { ok: false, errorMessage: GENERIC_CONTEXT_ERROR };
  }

  const { data: analysis, error } = await supabase
    .from("analyses")
    .select(HANDOFF_ANALYSIS_SELECT)
    .eq("id", latestAnalysisId)
    .eq("lead_id", leadId)
    .eq("analysis_status", HANDOFF_COMPLETED_ANALYSIS_STATUS)
    .maybeSingle();

  if (error || !analysis) {
    console.error("[send-contractor-handoff] Analysis context unavailable");
    return { ok: false, errorMessage: GENERIC_CONTEXT_ERROR };
  }

  return resolveHandoffAnalysisContext(
    leadId,
    latestAnalysisId,
    analysis as HandoffAnalysisRow,
  );
}
