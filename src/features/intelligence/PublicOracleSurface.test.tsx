import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { PUBLIC_ORACLE_VIEW_MODEL } from "./fixtures";
import { PublicOracleSurface } from "./PublicOracleSurface";
import type { PublicOracleViewModel } from "./publicOracleAdapter";

function renderOracle(state: "SUCCESS" | "SUPPRESSED" = "SUCCESS") {
  return render(
    <MemoryRouter>
      <PublicOracleSurface viewModel={PUBLIC_ORACLE_VIEW_MODEL} state={state} />
    </MemoryRouter>,
  );
}

describe("PublicOracleSurface", () => {
  it("renders the mobile-first public narrative and protected upload handoff", () => {
    renderOracle();
    expect(
      screen.getByRole("heading", { name: /See what homeowners are quoted/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Market Pulse" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Does the lowest quote usually win?" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Quote evidence, not surveys")).toBeInTheDocument();
    expect(screen.getByText("Sample size")).toBeInTheDocument();
    expect(screen.getByText("Date range")).toBeInTheDocument();
    expect(screen.getByText("Outcome coverage")).toBeInTheDocument();
    expect(screen.getByText("Cohort")).toBeInTheDocument();
    expect(screen.getByLabelText("Quoted and verified accepted price distributions")).toBeInTheDocument();

    const ctas = screen.getAllByRole("link", { name: /Check My Estimate/i });
    expect(ctas.length).toBeGreaterThanOrEqual(2);
    for (const cta of ctas) expect(cta).toHaveAttribute("href", "/?scroll=upload");
  });

  it("updates the visible synthetic cohort without changing the fixture", () => {
    renderOracle();
    fireEvent.change(screen.getByLabelText("Location"), {
      target: { value: "Metro preview" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update view" }));
    expect(
      screen.getByText("Metro preview · All demo projects · All product classes"),
    ).toBeInTheDocument();
  });

  it("does not render unsupported individual scenario prices", () => {
    renderOracle();
    expect(screen.getByText(/No individual price or outcome percentage is displayed/i)).toBeInTheDocument();
    expect(screen.queryByText("$20,800")).not.toBeInTheDocument();
  });

  it("fails closed when either public distribution is suppressed", () => {
    const viewModel: PublicOracleViewModel = {
      ...PUBLIC_ORACLE_VIEW_MODEL,
      prices: {
        ...PUBLIC_ORACLE_VIEW_MODEL.prices,
        acceptedDistribution: {
          ...PUBLIC_ORACLE_VIEW_MODEL.prices.acceptedDistribution,
          suppressionState: true,
          suppressionReason: "FORCED",
        },
      },
    };

    render(
      <MemoryRouter>
        <PublicOracleSurface viewModel={viewModel} />
      </MemoryRouter>,
    );

    expect(screen.queryByLabelText("Quoted and verified accepted price distributions")).not.toBeInTheDocument();
    expect(screen.getAllByText("Unverified metric").length).toBeGreaterThanOrEqual(2);
  });

  it("withholds the entire public result when the view is suppressed", () => {
    renderOracle("SUPPRESSED");
    expect(screen.getByRole("heading", { name: "Distribution withheld" })).toBeInTheDocument();
    expect(screen.queryByText("Market Pulse")).not.toBeInTheDocument();
  });
});
