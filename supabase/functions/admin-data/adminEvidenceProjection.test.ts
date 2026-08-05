import {
  buildAdminAnalysisEvidenceProjection,
  extractPillarScoresFromPreview,
} from "./adminEvidenceProjection.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { findForbiddenBrowserKey } from "./adminReadModel.ts";

Deno.test("extractPillarScoresFromPreview reads preview pillar_scores", () => {
  const scores = extractPillarScoresFromPreview({
    pillar_scores: {
      safety: 80,
      install: { score: 70 },
      fine_print: 55,
    },
  });
  assertEquals(scores?.find((p) => p.key === "safety")?.score, 80);
  assertEquals(scores?.find((p) => p.key === "install")?.score, 70);
  assertEquals(scores?.find((p) => p.key === "finePrint")?.score, 55);
});

Deno.test("buildAdminAnalysisEvidenceProjection never includes full_json", () => {
  const projection = buildAdminAnalysisEvidenceProjection({
    id: "a1",
    scan_session_id: "s1",
    analysis_status: "complete",
    grade: "B",
    confidence_score: 0.88,
    dollar_delta: 1200,
    flags: [{ severity: "High", flag: "x" }],
    preview_json: { pillar_scores: { price: 60 } },
    proof_of_read: { document_read: true },
    document_type: "quote_pdf",
    rubric_version: "2",
  });
  assertEquals(projection.pillar_detail_available, true);
  assertEquals(projection.grade, "B");
  assertEquals(
    findForbiddenBrowserKey({ evidence_projection: projection }),
    null,
  );
});

Deno.test("forbidden guard fails on array-contained full_json", () => {
  assertEquals(findForbiddenBrowserKey({ items: [{ ok: 1 }, { full_json: {} }] }), "full_json");
});
