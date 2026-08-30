import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ScopeOverviewCard from "./ScopeOverviewCard";

describe("ScopeOverviewCard preview", () => {
  it("renders a categorical price band and documentation-scoped signals", () => {
    render(
      <ScopeOverviewCard
        accessLevel="preview"
        totalOpenings={14}
        pricePerOpeningBand="market"
        pricePerOpening={null}
        totalContractPrice={null}
        hasWarranty
        hasPermits={false}
      />,
    );

    expect(screen.getByText("QUOTE CONTEXT")).toBeInTheDocument();
    expect(screen.getByText("Typical Price Band")).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("Lower Price Band")).not.toHaveAttribute("aria-current");
    expect(screen.getByText("Elevated Price Band")).not.toHaveAttribute("aria-current");
    expect(screen.getByText("Warranty terms").parentElement).toHaveTextContent(
      "Warranty termsMentioned in quote",
    );
    expect(screen.getByText("Permit language").parentElement).toHaveTextContent(
      "Permit languageNot documented in quote",
    );
    expect(screen.queryByText("Locked")).not.toBeInTheDocument();
    expect(screen.queryByText("Installed Price Per Opening")).not.toBeInTheDocument();
    expect(screen.queryByText("Contract Total")).not.toBeInTheDocument();
    expect(screen.queryByText("14")).not.toBeInTheDocument();
  });

  it("collapses missing preview values without inventing placeholders", () => {
    const { rerender } = render(
      <ScopeOverviewCard
        accessLevel="preview"
        totalOpenings={0}
        pricePerOpeningBand="high"
        hasWarranty={null}
        hasPermits={null}
      />,
    );

    expect(screen.getByText("Elevated Price Band")).toHaveAttribute("aria-current", "true");
    expect(screen.queryByText("Documentation Signals")).not.toBeInTheDocument();

    rerender(
      <ScopeOverviewCard
        accessLevel="preview"
        totalOpenings={null}
        pricePerOpeningBand={null}
        hasWarranty={null}
        hasPermits={null}
      />,
    );

    expect(screen.queryByText("QUOTE CONTEXT")).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/unknown|undefined|nan/i);
  });

  it("omits unavailable documentation rows without coercing them to negative", () => {
    render(
      <ScopeOverviewCard
        accessLevel="preview"
        pricePerOpeningBand={null}
        hasWarranty
        hasPermits={null}
      />,
    );

    expect(screen.getByText("Documentation Signals")).toBeInTheDocument();
    expect(screen.getByText("Warranty terms")).toBeInTheDocument();
    expect(screen.queryByText("Permit language")).not.toBeInTheDocument();
    expect(screen.queryByText(/not available|unknown/i)).not.toBeInTheDocument();
  });

  it("preserves the full-report three-metric presentation", () => {
    render(
      <ScopeOverviewCard
        accessLevel="full"
        totalOpenings={14}
        pricePerOpening={1851}
        pricePerOpeningBand="market"
        totalContractPrice={25914}
      />,
    );

    expect(screen.getByText("Total Openings")).toBeInTheDocument();
    expect(screen.getByText("Installed Price Per Opening")).toBeInTheDocument();
    expect(screen.getByText("Total Contract Price")).toBeInTheDocument();
  });
});
