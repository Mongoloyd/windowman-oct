import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildSummarySourceFromAnalysisRow } from "./buildSummarySourceFromAnalysis.ts";
import { buildFixtureMixedSource } from "./reportSummary.fixtures.ts";

Deno.test("buildSummarySourceFromAnalysisRow maps established analysis fields", () => {
  const fixture = buildFixtureMixedSource();
  const source = buildSummarySourceFromAnalysisRow({
    id: fixture.analysis_id,
    grade: fixture.grade,
    rubric_version: fixture.rubric_version,
    flags: fixture.flags,
    proof_of_read: { contractor_name: "Acme Windows LLC" },
    full_json: {
      missing_items: fixture.missing_items,
      warnings: fixture.warnings,
      summary: fixture.summary,
      has_warranty: true,
      has_permits: false,
    },
  });

  assertEquals(source?.analysis_id, fixture.analysis_id);
  assertEquals(source?.missing_items, fixture.missing_items);
  assertEquals(source?.contractor_name_present, true);
  assertEquals(source?.has_warranty, true);
});

Deno.test("buildSummarySourceFromAnalysisRow returns null without full_json", () => {
  const source = buildSummarySourceFromAnalysisRow({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    grade: "C",
    rubric_version: "rubric_v2",
    flags: [],
    proof_of_read: null,
    full_json: null,
  });
  assertEquals(source, null);
});
