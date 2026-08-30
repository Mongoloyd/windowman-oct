import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ExecutiveSummaryBand from "./ExecutiveSummaryBand";

describe("ExecutiveSummaryBand preview copy", () => {
  it("personalizes the preview without repeating severity counts", () => {
    render(
      <ExecutiveSummaryBand
        accessLevel="preview"
        flagRedCount={9}
        flagAmberCount={9}
        contractorName="  BrightView   Window  "
        pillarScores={[
          { key: "safety_code", label: "Unsafe label", score: 35, status: "fail" },
          { key: "install_scope", label: "Install", score: 80, status: "warn" },
          { key: "price_fairness", label: "Price", score: 100, status: "pass" },
          { key: "fine_print", label: "Fine", score: 70, status: "warn" },
          { key: "warranty", label: "Warranty", score: 60, status: "fail" },
        ]}
      />,
    );

    expect(screen.getByText("▦ QUOTE READINESS SUMMARY")).toBeInTheDocument();
    expect(screen.getByText(/We analyzed BrightView Window’s estimate/)).toBeInTheDocument();
    expect(
      screen.getByText(/closest review is concentrated in Safety & Code and Warranty Coverage/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/18|9 material|9 clarification/i)).not.toBeInTheDocument();
    expect(screen.getByText(/closest review/)).not.toHaveTextContent(/35|60|70|80|100/);
    expect(screen.queryByText("Unsafe label")).not.toBeInTheDocument();
  });

  it("falls back to this estimate when the contractor is missing", () => {
    render(
      <ExecutiveSummaryBand
        accessLevel="preview"
        flagRedCount={2}
        flagAmberCount={1}
        contractorName="   "
      />,
    );

    expect(screen.getByText(/We analyzed this estimate/)).toBeInTheDocument();
    expect(
      screen.getByText(/full report explains exactly which details appear clear/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/unknown/i)).not.toBeInTheDocument();
  });

  it("fails closed when canonical pillar entries are duplicated or unavailable", () => {
    const { rerender } = render(
      <ExecutiveSummaryBand
        accessLevel="preview"
        flagRedCount={1}
        flagAmberCount={0}
        contractorName="BrightView Window"
        pillarScores={[
          { key: "safety_code", label: "Safety", score: 20, status: "fail" },
          { key: "safety_code", label: "Safety", score: 95, status: "pass" },
          { key: "unknown", label: "Hostile category", score: 1, status: "fail" },
        ]}
      />,
    );

    expect(screen.getByText(/full report explains exactly which details appear clear/)).toBeInTheDocument();
    expect(screen.queryByText(/closest review/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hostile category/)).not.toBeInTheDocument();

    rerender(
      <ExecutiveSummaryBand
        accessLevel="preview"
        flagRedCount={0}
        flagAmberCount={0}
        contractorName="BrightView Window"
        pillarScores={[
          { key: "safety_code", label: "Safety", score: 100, status: "pass" },
          { key: "install_scope", label: "Install", score: 100, status: "pass" },
        ]}
      />,
    );

    expect(screen.getByText(/full report explains exactly which details appear clear/)).toBeInTheDocument();
  });

  it("preserves the full-report issue summary", () => {
    render(
      <ExecutiveSummaryBand
        accessLevel="full"
        flagRedCount={2}
        flagAmberCount={1}
        contractorName="BrightView Window"
        summary="Unlocked report summary."
      />,
    );

    expect(screen.getByText("▦ PLAIN-ENGLISH SUMMARY").parentElement).toHaveTextContent(
      "We found 3 issues with your estimate.",
    );
    expect(screen.getByText("Unlocked report summary.")).toBeInTheDocument();
    expect(screen.queryByText(/We analyzed BrightView Window/)).not.toBeInTheDocument();
  });
});
