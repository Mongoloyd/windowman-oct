import { describe, it, expect } from "vitest";
import {
  buildFullData,
  buildPreviewData,
  buildTerminalData,
} from "./useAnalysisData";
import type { RawFullRow, RawPreviewRow } from "@/types/serviceResults";

/**
 * useAnalysisData unit tests â€” pure helper coverage.
 *
 * The hook itself relies heavily on Supabase RPCs and cannot be unit-tested
 * without mocking the entire client. These tests cover the deterministic
 * mapping helpers that are exercised by the hook.
 */

// â”€â”€ mapSeverity logic (inlined for testing since it's not exported) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function mapSeverity(raw: string | undefined | null): "red" | "amber" | "green" {
  const s = (raw || "").toLowerCase();
  if (s === "critical" || s === "high") return "red";
  if (s === "medium") return "amber";
  if (s === "low" || s === "info" || s === "pass" || s === "confirmed") return "green";
  if (s === "green" || s === "ok" || s === "good") return "green";
  return "amber";
}

function pillarStatus(score: number | null): "pass" | "warn" | "fail" | "pending" {
  if (score == null) return "pending";
  if (score >= 70) return "pass";
  if (score >= 40) return "warn";
  return "fail";
}

describe("mapSeverity", () => {
  it("maps critical/high to red", () => {
    expect(mapSeverity("critical")).toBe("red");
    expect(mapSeverity("high")).toBe("red");
    expect(mapSeverity("Critical")).toBe("red");
    expect(mapSeverity("HIGH")).toBe("red");
  });

  it("maps medium to amber", () => {
    expect(mapSeverity("medium")).toBe("amber");
    expect(mapSeverity("Medium")).toBe("amber");
  });

  it("maps low/info/pass to green", () => {
    expect(mapSeverity("low")).toBe("green");
    expect(mapSeverity("info")).toBe("green");
    expect(mapSeverity("pass")).toBe("green");
    expect(mapSeverity("confirmed")).toBe("green");
  });

  it("maps explicit green variants to green", () => {
    expect(mapSeverity("green")).toBe("green");
    expect(mapSeverity("ok")).toBe("green");
    expect(mapSeverity("good")).toBe("green");
  });

  it("defaults unknown values to amber", () => {
    expect(mapSeverity("unknown")).toBe("amber");
    expect(mapSeverity("")).toBe("amber");
    expect(mapSeverity(null)).toBe("amber");
    expect(mapSeverity(undefined)).toBe("amber");
  });
});

describe("pillarStatus", () => {
  it("returns pending for null", () => {
    expect(pillarStatus(null)).toBe("pending");
  });

  it("returns pass for >= 70", () => {
    expect(pillarStatus(70)).toBe("pass");
    expect(pillarStatus(100)).toBe("pass");
  });

  it("returns warn for 40-69", () => {
    expect(pillarStatus(40)).toBe("warn");
    expect(pillarStatus(69)).toBe("warn");
  });

  it("returns fail for < 40", () => {
    expect(pillarStatus(39)).toBe("fail");
    expect(pillarStatus(0)).toBe("fail");
  });
});

const READY_SUMMARY = "WindowMan found three high-risk gaps in this estimate.";

const previewRow: RawPreviewRow = {
  analysis_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  grade: "C",
  flag_count: 2,
  flag_red_count: 1,
  flag_amber_count: 1,
  proof_of_read: null,
  preview_json: { summary_teaser: "preview teaser" },
  confidence_score: 0.8,
  document_type: "estimate",
  rubric_version: "v1",
};

function fullRow(overrides: Partial<RawFullRow> = {}): RawFullRow {
  return {
    analysis_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    grade: "C",
    flags: [],
    full_json: { summary: "deterministic full_json.summary" },
    proof_of_read: null,
    preview_json: { summary_teaser: "preview teaser" },
    confidence_score: 0.8,
    document_type: "estimate",
    rubric_version: "v1",
    ...overrides,
  };
}

describe("AnalysisData reportSummaryBody", () => {
  it("buildPreviewData always sets reportSummaryBody to null", () => {
    const data = buildPreviewData(previewRow);
    expect(data.reportSummaryBody).toBeNull();
    expect(data.summaryTeaser).toBe("preview teaser");
    expect(data.summary).toBeNull();
  });

  it("buildFullData maps authorized ready report_summary_body", () => {
    const data = buildFullData(fullRow({ report_summary_body: READY_SUMMARY }));
    expect(data.reportSummaryBody).toBe(READY_SUMMARY);
    expect(data.summary).toBe("deterministic full_json.summary");
    expect(data.summaryTeaser).toBe("deterministic full_json.summary");
  });

  it("buildFullData does not source reportSummaryBody from full_json.summary", () => {
    const data = buildFullData(fullRow({ report_summary_body: null }));
    expect(data.reportSummaryBody).toBeNull();
    expect(data.summary).toBe("deterministic full_json.summary");
  });

  it("buildFullData does not source reportSummaryBody from preview_json.summary_teaser", () => {
    const data = buildFullData(
      fullRow({
        report_summary_body: undefined,
        full_json: {},
        preview_json: { summary_teaser: "preview teaser" },
      }),
    );
    expect(data.reportSummaryBody).toBeNull();
    expect(data.summaryTeaser).toBe("preview teaser");
  });

  it("buildTerminalData sets reportSummaryBody to null", () => {
    expect(buildTerminalData("error").reportSummaryBody).toBeNull();
  });
});
