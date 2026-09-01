import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { INTERNAL_INTELLIGENCE_FIXTURE } from "./fixtures";
import { IntelligenceConsoleSurface } from "./IntelligenceConsoleSurface";

describe("IntelligenceConsoleSurface", () => {
  it("renders the synthetic evidence hierarchy and all six product sections", () => {
    render(<IntelligenceConsoleSurface data={INTERNAL_INTELLIGENCE_FIXTURE} />);

    expect(screen.getAllByText(/Synthetic Preview/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Quoted vs Bought", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Governed estimates")).toBeInTheDocument();
    expect(screen.getAllByText("Verified accepted").length).toBeGreaterThan(0);

    for (const label of ["Pulse", "Quoted vs Bought", "Products & Price", "Scope & Terms", "Contractors & Bids", "Outcomes & Data Quality"]) {
      expect(screen.getAllByRole("button", { name: label }).length).toBeGreaterThan(0);
    }

    expect(screen.queryByText("−6.8%")).not.toBeInTheDocument();
    expect(screen.queryByText("29%")).not.toBeInTheDocument();
    expect(screen.getAllByText("Unverified metric").length).toBeGreaterThanOrEqual(2);
  });

  it("switches to the products view without reading live data", () => {
    render(<IntelligenceConsoleSurface data={INTERNAL_INTELLIGENCE_FIXTURE} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Products & Price" })[0]);

    expect(screen.getByRole("heading", { name: "Products & Price" })).toBeInTheDocument();
    expect(screen.getByText("Product tier migration")).toBeInTheDocument();
    expect(screen.getByText("Glass and package premium")).toBeInTheDocument();
  });

  it("opens the sales brief with approved and prohibited language", () => {
    render(<IntelligenceConsoleSurface data={INTERNAL_INTELLIGENCE_FIXTURE} />);
    fireEvent.click(screen.getByRole("button", { name: "Sales brief" }));

    expect(screen.getByRole("heading", { name: "Call brief" })).toBeInTheDocument();
    expect(screen.getByText("Approved language")).toBeInTheDocument();
    expect(screen.getByText("Do not claim")).toBeInTheDocument();
    expect(screen.getByText("Do not call an unknown outcome a loss.")).toBeInTheDocument();
  });

  it("renders an explicit insufficient-data state", () => {
    render(<IntelligenceConsoleSurface data={INTERNAL_INTELLIGENCE_FIXTURE} state="INSUFFICIENT_DATA" />);
    expect(screen.getByRole("heading", { name: "Insufficient evidence for this view" })).toBeInTheDocument();
  });
});
