import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InternalIntelligenceConsole } from "../InternalIntelligenceConsole";

describe("InternalIntelligenceConsole", () => {
  it("renders the healthy synthetic view model", () => {
    render(<InternalIntelligenceConsole />);

    expect(
      screen.getByRole("heading", { name: "Internal Intelligence Console" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Observed estimates")).toBeInTheDocument();
    expect(screen.getByText("Unknown is not lost")).toBeInTheDocument();
    expect(
      screen.getByText("Three prices, never one “sold price”"),
    ).toBeInTheDocument();
    expect(screen.getByText("Trust before intelligence")).toBeInTheDocument();
    expect(screen.getByTestId("foundation-audit-header")).toHaveTextContent("Synthetic · fixture only");
    expect(screen.getByRole("radiogroup", { name: "Fixture scenarios" })).toBeInTheDocument();
    expect(screen.getByTestId("withheld-stage-relationship")).toHaveTextContent("INSUFFICIENT_DATA");
    expect(screen.getByTestId("supported-stage-relationship")).toHaveTextContent("$0 · 0%");
  });

  it("renders recoverable loading, error, and empty states", () => {
    render(<InternalIntelligenceConsole />);

    fireEvent.click(screen.getByRole("radio", { name: "Loading" }));
    expect(
      screen.getByRole("status", {
        name: "Loading synthetic intelligence console",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Error" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Fixture adapter unavailable",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry fixture" }));
    expect(screen.getByText("Observed estimates")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Empty" }));
    expect(screen.getByText("INSUFFICIENT_DATA")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Restore healthy fixture" }),
    );
    expect(screen.getByText("Observed estimates")).toBeInTheDocument();
  });

  it("does not reinterpret unknown outcomes as verified losses", () => {
    render(<InternalIntelligenceConsole />);

    fireEvent.click(screen.getByRole("radio", { name: "No outcomes" }));

    expect(screen.getByText("INSUFFICIENT_DATA.")).toBeInTheDocument();
    expect(screen.getAllByText("INSUFFICIENT_DATA").length).toBeGreaterThan(0);
    expect(screen.getByText("Verified not sold")).toBeInTheDocument();
  });
});
