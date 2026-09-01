import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { PUBLIC_ORACLE_FIXTURE } from "./fixtures";
import { WindowOracleSurface } from "./WindowOracleSurface";

function renderOracle(state: "SUCCESS" | "SUPPRESSED" = "SUCCESS") {
  return render(
    <MemoryRouter>
      <WindowOracleSurface data={PUBLIC_ORACLE_FIXTURE} state={state} />
    </MemoryRouter>,
  );
}

describe("WindowOracleSurface", () => {
  it("renders the public acquisition narrative and protected upload handoff", () => {
    renderOracle();

    expect(screen.getByRole("heading", { name: /See what homeowners are quoted/i })).toBeInTheDocument();
    expect(screen.getByText("Quote evidence, not surveys")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Market Pulse" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Does the lowest quote usually win?" })).toBeInTheDocument();

    const ctas = screen.getAllByRole("link", { name: /Check My Estimate/i });
    expect(ctas.length).toBeGreaterThanOrEqual(2);
    for (const cta of ctas) expect(cta).toHaveAttribute("href", "/?scroll=upload");
  });

  it("keeps synthetic and provenance language visible", () => {
    renderOracle();
    expect(screen.getAllByText(/Synthetic Preview/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Quoted and accepted stay separate")).toBeInTheDocument();
    expect(screen.getByText("Thin data withheld")).toBeInTheDocument();
  });

  it("updates the visible synthetic cohort after an explicit action", () => {
    renderOracle();
    const location = screen.getByLabelText("Location");
    fireEvent.change(location, { target: { value: "Synthetic region" } });
    fireEvent.click(screen.getByRole("button", { name: "Update view" }));
    expect(screen.getAllByText(/Synthetic region/).length).toBeGreaterThan(0);
  });

  it("withholds the entire public result when the distribution is suppressed", () => {
    renderOracle("SUPPRESSED");
    expect(screen.getByRole("heading", { name: "Distribution withheld" })).toBeInTheDocument();
    expect(screen.queryByText("Market Pulse")).not.toBeInTheDocument();
  });
});
