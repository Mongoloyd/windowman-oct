import type { AdminAnalysisEvidenceProjection } from "./types";

/** Map admin evidence projection pillar list to dossier card keys. */
export function pillarScoresRecordFromProjection(
  projection: AdminAnalysisEvidenceProjection | null | undefined,
): Record<string, number> | null {
  if (!projection?.pillar_scores?.length) return null;
  const out: Record<string, number> = {};
  for (const p of projection.pillar_scores) {
    if (p.score != null) out[p.key] = p.score;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function operatorExtractionFromProjection(
  projection: AdminAnalysisEvidenceProjection | null | undefined,
): Record<string, unknown> | null {
  const summary = projection?.operator_summary;
  if (!summary) return null;
  return {
    contractor_name: summary.contractor_name,
    total_quoted_price: summary.total_quoted_price,
    opening_count: summary.opening_count,
    document_type: summary.document_type,
  };
}
