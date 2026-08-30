import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GoldenRegressionStudio } from "./GoldenRegressionStudio";

const canonicalWeights = {
  safety: 25,
  install: 20,
  price: 20,
  finePrint: 20,
  warranty: 15,
};

describe("GoldenRegressionStudio", () => {
  it("shows fourteen intact goldens, twelve scored passes, and two safe terminal cases", () => {
    render(<GoldenRegressionStudio weights={canonicalWeights} />);

    expect(
      screen.getByRole("heading", { name: "Golden Fixture Regression Studio" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("golden-regression-summary")).toHaveClass(
      "bg-[#11161e]",
      "text-slate-100",
    );
    expect(screen.getByText("Hypothetical local simulation — not production scoring")).toBeInTheDocument();
    expect(screen.getByText("14/14", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("12/12", { selector: "p" })).toBeInTheDocument();
    expect(screen.getAllByText("Pass")).toHaveLength(12);
    expect(screen.getAllByText("Unavailable")).toHaveLength(3);
    expect(screen.getAllByText("Terminal gate")).toHaveLength(2);
    expect(screen.getByText("Diff Inspector · Grade A Control")).toBeInTheDocument();
  });

  it("drills into a fixture and exposes grade, score, and cleared-cap deltas", () => {
    render(<GoldenRegressionStudio weights={canonicalWeights} />);

    fireEvent.click(screen.getByTestId("golden-fixture-missing-warranty"));
    expect(screen.getByText("Diff Inspector · Missing Warranty")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("switch", {
        name: "Include no_warranty_section in hypothetical simulation",
      }),
    );

    const fixture = screen.getByTestId("golden-fixture-missing-warranty");
    expect(within(fixture).getByText("Regression")).toBeInTheDocument();
    expect(within(fixture).getByText("A")).toBeInTheDocument();
    expect(screen.getByText("Cleared by local toggle")).toBeInTheDocument();
    expect(screen.getAllByText("no_warranty_section").length).toBeGreaterThan(0);
  });

  it("suppresses all fixture experiments when weights are invalid", () => {
    render(
      <GoldenRegressionStudio
        weights={{ ...canonicalWeights, warranty: 10 }}
      />,
    );

    expect(screen.getAllByText("Unavailable")).toHaveLength(15);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});
