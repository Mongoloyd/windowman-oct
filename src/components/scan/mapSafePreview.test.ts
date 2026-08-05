import { describe, expect, it } from "vitest";
import { containsFullJsonKey, mapSafePreview } from "./mapSafePreview";
import type { RawPreviewRow } from "@/types/serviceResults";

const baseRow: RawPreviewRow = {
  analysis_id: "11111111-1111-4111-8111-111111111111",
  grade: "C",
  flag_count: 2,
  flag_red_count: 1,
  flag_amber_count: 1,
  proof_of_read: {
    contractor_name: "Sample Co",
    document_type: "Window Estimate",
    opening_count: 9,
  },
  preview_json: {
    opening_count_bucket: "8–12 openings",
    top_warning: "Permit fees are unclear.",
    summary_teaser: "Permit responsibility should be confirmed before signing.",
    missing_items_count: 1,
  },
  confidence_score: 0.82,
  document_type: "Window Estimate",
  rubric_version: "1.0",
};

describe("containsFullJsonKey", () => {
  it("detects top-level full_json", () => {
    expect(containsFullJsonKey({ full_json: {} })).toBe(true);
  });

  it("detects nested full_json", () => {
    expect(containsFullJsonKey({ data: { nested: { full_json: { a: 1 } } } })).toBe(true);
  });

  it("returns false for safe preview rows", () => {
    expect(containsFullJsonKey(baseRow)).toBe(false);
  });
});

describe("mapSafePreview", () => {
  it("maps allowlisted preview fields with live_preview source", () => {
    const result = mapSafePreview(baseRow);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preview.source).toBe("live_preview");
    expect(result.preview.contractorName).toBe("Sample Co");
    expect(result.preview.documentType).toBe("Window Estimate");
    expect(result.preview.openingCountBucket).toBe("8–12 openings");
    expect(result.preview.warningCount).toBe(2);
    expect(result.preview.missingDetailCount).toBe(1);
    expect(result.preview.gradeBand).toBe("C");
    expect(result.preview.findings.length).toBeGreaterThan(0);
  });

  it("caps findings at three", () => {
    const row: RawPreviewRow = {
      ...baseRow,
      preview_json: {
        top_warning: "One",
        top_missing_item: "Two",
        summary_teaser: "Three",
        missing_items_count: 5,
      },
    };
    const result = mapSafePreview(row);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preview.findings.length).toBeLessThanOrEqual(3);
  });

  it("rejects payloads containing full_json", () => {
    expect(mapSafePreview({ ...baseRow, full_json: { x: 1 } }).ok).toBe(false);
    expect(
      mapSafePreview({ envelope: { data: { full_json: {} }, grade: "B" } }).ok,
    ).toBe(false);
  });

  it("uses null for unavailable proof fields", () => {
    const result = mapSafePreview({
      ...baseRow,
      proof_of_read: null,
      preview_json: null,
      document_type: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preview.contractorName).toBeNull();
    expect(result.preview.documentType).toBeNull();
    expect(result.preview.openingCountBucket).toBeNull();
  });

  it("does not map exact quoted totals", () => {
    const result = mapSafePreview({
      ...baseRow,
      preview_json: {
        ...(baseRow.preview_json as object),
        quoted_total: 28750,
        total_price: 28750,
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.stringify(result.preview)).not.toMatch(/28750/);
  });
});
