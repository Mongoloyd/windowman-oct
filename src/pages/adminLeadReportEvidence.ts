import type {
  AdminAnalysisEvidenceProjection,
  AnalysisFlag,
} from "@/components/admin/types";
import {
  operatorExtractionFromProjection,
  pillarScoresRecordFromProjection,
} from "@/components/admin/adminAnalysisEvidence";

/** Admin `fetch_lead_analysis` payload (browser-safe; no full_json). */
export type AdminLeadAnalysisResponse = {
  grade: string | null;
  dollar_delta: number | null;
  confidence_score: number | null;
  flags: AnalysisFlag[];
  evidence_projection: AdminAnalysisEvidenceProjection | null;
};

export type AdminLeadReportEvidenceView = {
  analysisId: string;
  grade: string | null;
  confidenceScore: number | null;
  dollarDelta: number | null;
  flags: AnalysisFlag[];
  evidenceProjection: AdminAnalysisEvidenceProjection | null;
  pillarScores: Record<string, number> | null;
  pillarDetailUnavailable: boolean;
  proofOfRead: Record<string, unknown> | null;
  operatorExtraction: Record<string, unknown> | null;
};

export function buildAdminLeadReportEvidenceView(
  analysisId: string,
  analysis: AdminLeadAnalysisResponse,
): AdminLeadReportEvidenceView {
  const evidenceProjection = analysis.evidence_projection ?? null;
  return {
    analysisId,
    grade: analysis.grade ?? evidenceProjection?.grade ?? null,
    confidenceScore: analysis.confidence_score ?? evidenceProjection?.confidence_score ?? null,
    dollarDelta: analysis.dollar_delta ?? evidenceProjection?.dollar_delta ?? null,
    flags: Array.isArray(analysis.flags) ? analysis.flags : [],
    evidenceProjection,
    pillarScores: pillarScoresRecordFromProjection(evidenceProjection),
    pillarDetailUnavailable: !!analysis && !evidenceProjection?.pillar_detail_available,
    proofOfRead: evidenceProjection?.proof_of_read ?? null,
    operatorExtraction: operatorExtractionFromProjection(evidenceProjection),
  };
}
