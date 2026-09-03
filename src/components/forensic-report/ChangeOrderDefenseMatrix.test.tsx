import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ChangeOrderDefenseMatrix from "./ChangeOrderDefenseMatrix";
import { FIX_CHANGE_ORDER_HIGH_RISK } from "./ChangeOrderDefenseMatrix.fixtures";

function renderMatrix() {
  return render(
    <ChangeOrderDefenseMatrix
      {...FIX_CHANGE_ORDER_HIGH_RISK}
      suppressFooterChecklist
    />,
  );
}

function rowTrigger(label: string) {
  return screen.getByRole("button", { name: new RegExp(label, "i") });
}

describe("ChangeOrderDefenseMatrix risk-row accordions", () => {
  it("opens every critical red row by default and condenses every non-red row", () => {
    renderMatrix();

    for (const row of FIX_CHANGE_ORDER_HIGH_RISK.risks) {
      expect(rowTrigger(row.displayLabel)).toHaveAttribute(
        "aria-expanded",
        row.severity === "fail" ? "true" : "false",
      );
    }
  });

  it("keeps rows independently open until the homeowner closes them", () => {
    renderMatrix();

    const criticalRows = FIX_CHANGE_ORDER_HIGH_RISK.risks.filter(
      (row) => row.severity === "fail",
    );
    const firstNonCriticalRow = FIX_CHANGE_ORDER_HIGH_RISK.risks.find(
      (row) => row.severity !== "fail",
    );

    expect(criticalRows.length).toBeGreaterThan(1);
    expect(firstNonCriticalRow).toBeDefined();

    const firstCriticalTrigger = rowTrigger(criticalRows[0].displayLabel);
    const secondCriticalTrigger = rowTrigger(criticalRows[1].displayLabel);
    const nonCriticalTrigger = rowTrigger(firstNonCriticalRow!.displayLabel);

    fireEvent.click(nonCriticalTrigger);
    expect(nonCriticalTrigger).toHaveAttribute("aria-expanded", "true");
    expect(firstCriticalTrigger).toHaveAttribute("aria-expanded", "true");
    expect(secondCriticalTrigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(firstCriticalTrigger);
    expect(firstCriticalTrigger).toHaveAttribute("aria-expanded", "false");
    expect(secondCriticalTrigger).toHaveAttribute("aria-expanded", "true");
    expect(nonCriticalTrigger).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps the matrix title, summary, policy language, and condensed row context visible", () => {
    renderMatrix();

    expect(
      screen.getByRole("heading", { name: "Change-Order Defense Matrix" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Protected")).toBeInTheDocument();
    expect(screen.getByText("Exposure")).toBeInTheDocument();
    expect(screen.getByText("Needs Review")).toBeInTheDocument();
    expect(screen.getByText("Parsed policy language")).toBeInTheDocument();

    const condensedRow = FIX_CHANGE_ORDER_HIGH_RISK.risks.find(
      (row) => row.severity !== "fail",
    );
    expect(condensedRow).toBeDefined();
    expect(screen.getByText(condensedRow!.homeownerRiskCopy)).toBeInTheDocument();
  });
});
