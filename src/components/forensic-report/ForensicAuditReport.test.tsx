import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ForensicAuditReport from "./ForensicAuditReport";

const commonProps = {
  analysisId: "fixture-analysis",
  grade: "D",
  confidenceScore: 90,
  flagRedCount: 1,
  flagAmberCount: 1,
};

describe("ForensicAuditReport Bento integration", () => {
  it("renders one Bento in preview without the former separate preview bands", () => {
    render(
      <ForensicAuditReport
        {...commonProps}
        accessLevel="preview"
        pillarScores={[
          { key: "safety_code", label: "Safety", score: null, status: "fail" },
        ]}
        pricePerOpeningBand="market"
        hasWarranty
      />,
    );

    expect(screen.getAllByLabelText("Quote analysis snapshot")).toHaveLength(1);
    expect(screen.queryByText("▦ QUOTE READINESS SUMMARY")).not.toBeInTheDocument();
    expect(screen.queryByText("QUOTE CONTEXT")).not.toBeInTheDocument();
    expect(screen.getByText("Quote Review Items")).toBeInTheDocument();
    expect(screen.getAllByText("Locked Review Item")).toHaveLength(3);
    expect(screen.getByText("LOCKED · VERIFICATION REQUIRED")).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "Verify your phone number to unlock what was found, why it matters, and the exact questions to ask before signing.",
      ),
    ).toHaveLength(4);
  });

  it("renders an honest neutral preview state when aggregate review counts are zero", () => {
    render(
      <ForensicAuditReport
        {...commonProps}
        accessLevel="preview"
        flagRedCount={0}
        flagAmberCount={0}
        pillarScores={[
          { key: "safety_code", label: "Safety", score: 100, status: "pass" },
          { key: "install_scope", label: "Install", score: 100, status: "pass" },
          { key: "price_fairness", label: "Price", score: 100, status: "pass" },
          { key: "fine_print", label: "Fine", score: 100, status: "pass" },
          { key: "warranty", label: "Warranty", score: 100, status: "pass" },
        ]}
      />,
    );

    expect(screen.getByText("Quote Review Items")).toBeInTheDocument();
    expect(screen.getByText("No review items are indicated in this preview.")).toBeInTheDocument();
    expect(
      screen.getByText("Category-level details are available in the full analysis after verification."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Material concerns and clarifications were identified in this quote")).not.toBeInTheDocument();
    expect(screen.queryByText("LOCKED · VERIFICATION REQUIRED")).not.toBeInTheDocument();
    expect(screen.queryByText("Locked Review Item")).not.toBeInTheDocument();
    expect(
      screen.getByText("All five documented quote categories appear clear in this preview."),
    ).toBeInTheDocument();
  });

  it("preserves existing full-report summary and scope owners", () => {
    render(
      <ForensicAuditReport
        {...commonProps}
        accessLevel="full"
        flags={[]}
        totalOpenings={14}
        pricePerOpening={1800}
        totalContractPrice={25200}
      />,
    );

    expect(screen.queryByLabelText("Quote analysis snapshot")).not.toBeInTheDocument();
    expect(screen.getByText("▦ PLAIN-ENGLISH SUMMARY")).toBeInTheDocument();
    expect(screen.getByText("SCOPE OVERVIEW")).toBeInTheDocument();
    expect(screen.getByText("Total Openings")).toBeInTheDocument();
  });
});
