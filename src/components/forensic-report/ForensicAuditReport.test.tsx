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

  it("orders supported project facts and financial exposure before WindowMan", () => {
    render(
      <ForensicAuditReport
        {...commonProps}
        accessLevel="full"
        flags={[]}
        totalOpenings={14}
        pricePerOpening={1800}
        pricePerOpeningBand="low"
        totalContractPrice={25200}
        overpaymentLow={3400}
        overpaymentHigh={4200}
        revealBridgeSlot={<div>Get a better quote</div>}
      />,
    );

    const verdict = screen.getByText("▦ VERDICT AT A GLANCE");
    const scope = screen.getByText("SCOPE OVERVIEW");
    const signing = screen.getByText("Your 3 Biggest Signing Risks");
    const priceRisk = screen.getByText("Price vs. Quote Safety");
    const money = screen.getByText("Money at Risk");
    const windowMan = screen.getByText("Get a better quote");
    const evidence = screen.getByText("Evidence Behind the Grade");

    expect(verdict.compareDocumentPosition(scope) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(scope.compareDocumentPosition(signing) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(signing.compareDocumentPosition(priceRisk) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(priceRisk.compareDocumentPosition(money) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(money.compareDocumentPosition(windowMan) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(windowMan.compareDocumentPosition(evidence) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Upper-Bound Exposure")).toBeInTheDocument();
    expect(screen.getByText("~17% of quote")).toBeInTheDocument();
  });

  it.each([
    { label: "missing", overpaymentLow: null, overpaymentHigh: null },
    { label: "non-positive", overpaymentLow: 0, overpaymentHigh: 0 },
  ])("keeps Money at Risk absent when supported overpayment is $label", ({ overpaymentLow, overpaymentHigh }) => {
    render(
      <ForensicAuditReport
        {...commonProps}
        accessLevel="full"
        flags={[]}
        totalOpenings={14}
        pricePerOpening={1800}
        pricePerOpeningBand="low"
        totalContractPrice={25200}
        overpaymentLow={overpaymentLow}
        overpaymentHigh={overpaymentHigh}
        revealBridgeSlot={<div>Get a better quote</div>}
      />,
    );

    const signing = screen.getByText("Your 3 Biggest Signing Risks");
    const priceRisk = screen.getByText("Price vs. Quote Safety");
    const windowMan = screen.getByText("Get a better quote");
    const evidence = screen.getByText("Evidence Behind the Grade");

    expect(signing.compareDocumentPosition(priceRisk) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(priceRisk.compareDocumentPosition(windowMan) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(windowMan.compareDocumentPosition(evidence) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText("Money at Risk")).not.toBeInTheDocument();
  });

  it("drops full-only content even when it is accidentally supplied in preview mode", () => {
    render(
      <ForensicAuditReport
        {...commonProps}
        accessLevel="preview"
        flags={[
          {
            id: 99,
            severity: "red",
            label: "Private full-report finding",
            detail: "Private full-report detail",
            tip: null,
            pillar: "fine_print",
          },
        ]}
        overpaymentLow={3400}
        overpaymentHigh={4200}
        totalContractPrice={25200}
        revealBridgeSlot={<div>Private WindowMan bridge</div>}
        fullEvidenceStack={<div>Private full evidence</div>}
      />,
    );

    expect(screen.queryByText("Private full-report finding")).not.toBeInTheDocument();
    expect(screen.queryByText("Private full-report detail")).not.toBeInTheDocument();
    expect(screen.queryByText("Private WindowMan bridge")).not.toBeInTheDocument();
    expect(screen.queryByText("Private full evidence")).not.toBeInTheDocument();
    expect(screen.queryByText("Money at Risk")).not.toBeInTheDocument();
  });
});
