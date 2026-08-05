import { describe, it, expect } from "vitest";
import {
  operatorExtractionFromProjection,
  pillarScoresRecordFromProjection,
} from "../adminAnalysisEvidence";
import type { AdminAnalysisEvidenceProjection } from "../types";

describe("adminAnalysisEvidence helpers", () => {
  it("maps evidence projection pillar scores for dossier cards", () => {
    const projection: AdminAnalysisEvidenceProjection = {
      analysis_id: "a1",
      scan_session_id: null,
      status: "complete",
      grade: "B",
      confidence_score: 0.9,
      dollar_delta: null,
      missing_detail_count: 0,
      pillar_scores: [
        { key: "safety", score: 82 },
        { key: "price", score: 44 },
      ],
      pillar_detail_available: true,
      document_type: null,
      rubric_version: null,
      proof_of_read: null,
      operator_summary: null,
    };
    expect(pillarScoresRecordFromProjection(projection)).toEqual({
      safety: 82,
      price: 44,
    });
  });

  it("returns null extraction when operator summary absent", () => {
    expect(operatorExtractionFromProjection(null)).toBeNull();
  });

  it("does not reference full_json in projection shape", () => {
    const projection = {
      analysis_id: "a1",
      scan_session_id: null,
      status: null,
      grade: null,
      confidence_score: null,
      dollar_delta: null,
      missing_detail_count: null,
      pillar_scores: null,
      pillar_detail_available: false,
      document_type: null,
      rubric_version: null,
      proof_of_read: null,
      operator_summary: null,
    } satisfies AdminAnalysisEvidenceProjection;
    expect(Object.keys(projection)).not.toContain("full_json");
  });
});
