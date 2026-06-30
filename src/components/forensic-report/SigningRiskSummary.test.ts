import { describe, it, expect } from "vitest";
import type { AnalysisFlag } from "@/hooks/useAnalysisData";
import { selectSigningRisks } from "./utils/selectSigningRisks";

function flag(partial: Partial<AnalysisFlag> & { label: string }): AnalysisFlag {
  return {
    id: partial.id ?? Math.floor(Math.random() * 100000),
    severity: partial.severity ?? "red",
    label: partial.label,
    detail: partial.detail ?? "",
    tip: partial.tip ?? null,
    pillar: partial.pillar ?? null,
  };
}

describe("selectSigningRisks", () => {
  it("always returns exactly three risks", () => {
    expect(selectSigningRisks([])).toHaveLength(3);
    expect(selectSigningRisks(null)).toHaveLength(3);
    expect(selectSigningRisks([flag({ label: "One" })])).toHaveLength(3);
  });

  it("uses fallback cards when there are no flags", () => {
    const risks = selectSigningRisks([]);
    expect(risks.every((r) => r.isFallback)).toBe(true);
    expect(risks[0].title).toBe("Product approval not documented");
  });

  it("prioritizes red flags by pillar order", () => {
    const flags: AnalysisFlag[] = [
      flag({ label: "Install vague", severity: "red", pillar: "install_scope" }),
      flag({ label: "Missing NOA", severity: "red", pillar: "safety_code" }),
      flag({ label: "Price high", severity: "red", pillar: "price_fairness" }),
    ];
    const risks = selectSigningRisks(flags);
    expect(risks.map((r) => r.title)).toEqual(["Missing NOA", "Price high", "Install vague"]);
    expect(risks.every((r) => r.severity === "critical")).toBe(true);
  });

  it("places amber flags after red flags and backfills with fallbacks", () => {
    const flags: AnalysisFlag[] = [
      flag({ label: "Amber fee", severity: "amber", pillar: "fine_print" }),
      flag({ label: "Red NOA", severity: "red", pillar: "safety_code" }),
    ];
    const risks = selectSigningRisks(flags);
    expect(risks[0].title).toBe("Red NOA");
    expect(risks[0].severity).toBe("critical");
    expect(risks[1].title).toBe("Amber fee");
    expect(risks[1].severity).toBe("warning");
    expect(risks[2].isFallback).toBe(true);
  });

  it("prefers flag.tip for the 'what to ask' field when present", () => {
    const risks = selectSigningRisks([
      flag({ label: "Custom", severity: "red", pillar: "warranty", tip: "Ask for the labor warranty doc." }),
    ]);
    expect(risks[0].ask).toBe("Ask for the labor warranty doc.");
  });

  it("falls back to a pillar-specific ask when no tip is provided", () => {
    const risks = selectSigningRisks([
      flag({ label: "No tip", severity: "red", pillar: "install_scope", tip: null }),
    ]);
    expect(risks[0].ask).toContain("written scope");
  });
});
