import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AnalysisFlag } from "@/hooks/useAnalysisData";
import {
  ForensicVerdictPanel,
  resolveForensicVerdictContent,
  resolveForensicVerdictTone,
} from "./ForensicVerdictPanel";

function flag(partial: Partial<AnalysisFlag> & { label: string }): AnalysisFlag {
  return {
    id: partial.id ?? 1,
    severity: partial.severity ?? "red",
    label: partial.label,
    detail: partial.detail ?? "",
    tip: partial.tip ?? null,
    pillar: partial.pillar ?? null,
  };
}

const PRODUCT_APPROVAL_BULLET =
  "Product approval or code proof needs written confirmation before signing.";
const PAYMENT_BULLET =
  "Payment, cancellation, or contract leverage terms need written confirmation before money changes hands.";
const WARRANTY_BULLET =
  "Warranty and workmanship responsibilities need to be clear enough to enforce later.";
const PRICING_BULLET =
  "Pricing and line-item assumptions should be clarified before treating this as a safe quote.";
const GENERIC_FALLBACK =
  "Several quote areas scored below WindowMan's signing threshold. Review the Detailed Findings below before accepting or comparing this estimate.";
const GENERIC_SAFE =
  "This quote appears more complete than most, but important terms should still be confirmed in writing before signing.";

describe("resolveForensicVerdictContent", () => {
  it("danger tone + only price_fairness flag shows pricing bullet only", () => {
    const tone = resolveForensicVerdictTone("D", 1, 0);
    const { bullets } = resolveForensicVerdictContent(tone, [
      flag({ label: "Lump sum pricing", pillar: "price_fairness", severity: "red" }),
    ]);

    expect(bullets).toEqual([PRICING_BULLET]);
    expect(bullets).not.toContain(PAYMENT_BULLET);
    expect(bullets).not.toContain(WARRANTY_BULLET);
    expect(bullets).not.toContain(PRODUCT_APPROVAL_BULLET);
  });

  it("danger tone + F grade + no flags shows generic fallback only", () => {
    const tone = resolveForensicVerdictTone("F", 0, 0);
    const { bullets } = resolveForensicVerdictContent(tone, []);

    expect(bullets).toEqual([GENERIC_FALLBACK]);
    expect(bullets).not.toContain(PAYMENT_BULLET);
    expect(bullets).not.toContain(WARRANTY_BULLET);
    expect(bullets).not.toContain(PRODUCT_APPROVAL_BULLET);
  });

  it("caution tone + only warranty flag shows warranty bullet only", () => {
    const tone = resolveForensicVerdictTone("C", 0, 0);
    const { bullets } = resolveForensicVerdictContent(tone, [
      flag({ label: "No warranty section", pillar: "warranty", severity: "amber" }),
    ]);

    expect(bullets).toEqual([WARRANTY_BULLET]);
    expect(bullets).not.toContain(PAYMENT_BULLET);
    expect(bullets).not.toContain(PRODUCT_APPROVAL_BULLET);
  });

  it("safe tone + A grade + no flags shows soft confirmation copy", () => {
    const tone = resolveForensicVerdictTone("A", 0, 0);
    const { bullets } = resolveForensicVerdictContent(tone, []);

    expect(bullets).toEqual([GENERIC_SAFE]);
    expect(bullets).not.toContain(GENERIC_FALLBACK);
    expect(bullets).not.toContain(PAYMENT_BULLET);
    expect(bullets).not.toContain(WARRANTY_BULLET);
  });

  it("preview/no flags uses generic non-category language", () => {
    const tone = resolveForensicVerdictTone("F", 3, 1);
    const { bullets } = resolveForensicVerdictContent(tone, undefined);

    expect(bullets.join(" ")).not.toMatch(/deposit|warranty|product approval|payment/i);
    expect(bullets[0]).toMatch(/unlock the full report/i);
  });
});

describe("ForensicVerdictPanel", () => {
  it("renders evidence-backed bullets in full mode", () => {
    render(
      <ForensicVerdictPanel
        grade="D"
        redCount={1}
        amberCount={0}
        flags={[flag({ label: "Missing line items", pillar: "price_fairness", severity: "red" })]}
      />,
    );

    expect(screen.getByText(PRICING_BULLET)).toBeInTheDocument();
    expect(screen.queryByText(PAYMENT_BULLET)).not.toBeInTheDocument();
    expect(screen.queryByText(WARRANTY_BULLET)).not.toBeInTheDocument();
    expect(screen.queryByText(PRODUCT_APPROVAL_BULLET)).not.toBeInTheDocument();
    expect(screen.getByText("THE FORENSIC VERDICT")).toBeInTheDocument();
  });

  it("renders preview-safe generic copy when flags are omitted", () => {
    render(<ForensicVerdictPanel grade="F" redCount={2} amberCount={1} />);

    expect(
      screen.getByText(
        "We found 3 items worth reviewing in this quote before signing or comparing estimates.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/unlock the full report to see what was documented/i),
    ).toBeInTheDocument();
    expect(screen.getByText("QUOTE READINESS REVIEW")).toBeInTheDocument();
    expect(screen.queryByText("THE FORENSIC VERDICT")).not.toBeInTheDocument();
    expect(screen.queryByText(PAYMENT_BULLET)).not.toBeInTheDocument();
    expect(screen.queryByText(WARRANTY_BULLET)).not.toBeInTheDocument();
    expect(screen.queryByText(PRODUCT_APPROVAL_BULLET)).not.toBeInTheDocument();
  });

  it("pluralizes one preview item and handles a zero-count preview honestly", () => {
    const { rerender } = render(<ForensicVerdictPanel grade="F" redCount={1} amberCount={0} />);

    expect(
      screen.getByText(
        "We found 1 item worth reviewing in this quote before signing or comparing estimates.",
      ),
    ).toBeInTheDocument();

    rerender(<ForensicVerdictPanel grade="A" redCount={0} amberCount={0} />);

    expect(
      screen.getByText("No material concerns or clarifications were identified in this quote preview."),
    ).toBeInTheDocument();
  });
});
