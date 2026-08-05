import { describe, it, expect } from "vitest";
import {
  buildAdminLeadReportEvidenceView,
  type AdminLeadAnalysisResponse,
} from "../adminLeadReportEvidence";

describe("AdminLeadReport evidence view", () => {
  it("builds view from evidence_projection without full_json", () => {
    const analysis: AdminLeadAnalysisResponse = {
      grade: "B",
      dollar_delta: 500,
      confidence_score: 0.91,
      flags: [{ flag: "High markup", severity: "High" }],
      evidence_projection: {
        analysis_id: "a1",
        scan_session_id: "s1",
        status: "complete",
        grade: "B",
        confidence_score: 0.91,
        dollar_delta: 500,
        missing_detail_count: 1,
        pillar_scores: [{ key: "price", score: 62 }],
        pillar_detail_available: true,
        document_type: "quote_pdf",
        rubric_version: "2",
        proof_of_read: { document_read: true },
        operator_summary: {
          contractor_name: "Acme Windows",
          total_quoted_price: 12000,
          opening_count: 8,
          document_type: "quote_pdf",
        },
      },
    };

    const view = buildAdminLeadReportEvidenceView("a1", analysis);
    expect(view.pillarScores).toEqual({ price: 62 });
    expect(view.flags).toHaveLength(1);
    expect(view.pillarDetailUnavailable).toBe(false);
    expect(Object.keys(view)).not.toContain("full_json");
  });

  it("marks pillar detail unavailable when projection lacks scores", () => {
    const view = buildAdminLeadReportEvidenceView("a2", {
      grade: "C",
      dollar_delta: null,
      confidence_score: 0.5,
      flags: [],
      evidence_projection: {
        analysis_id: "a2",
        scan_session_id: null,
        status: "complete",
        grade: "C",
        confidence_score: 0.5,
        dollar_delta: null,
        missing_detail_count: null,
        pillar_scores: null,
        pillar_detail_available: false,
        document_type: null,
        rubric_version: null,
        proof_of_read: null,
        operator_summary: null,
      },
    });
    expect(view.pillarDetailUnavailable).toBe(true);
    expect(view.pillarScores).toBeNull();
  });
});
