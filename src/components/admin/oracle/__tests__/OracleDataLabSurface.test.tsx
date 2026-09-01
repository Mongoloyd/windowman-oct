import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { OracleDataLabSurface } from "../OracleDataLabSurface";
import { SYNTHETIC_DATA_BANNER } from "@/lib/windowOracle";

describe("OracleDataLabSurface", () => {
  it("renders the governed synthetic banner and five differentiated lab panels", () => {
    render(<OracleDataLabSurface />);

    expect(screen.getByTestId("oracle-synthetic-banner")).toHaveTextContent(
      SYNTHETIC_DATA_BANNER,
    );
    expect(screen.getByTestId("oracle-data-lab")).toBeInTheDocument();
    expect(screen.getByText("Quote documents")).toBeInTheDocument();
    expect(screen.getByText("Analysis runs")).toBeInTheDocument();
    expect(screen.getByText("Data Intake")).toBeInTheDocument();
    expect(screen.getByText("Field Coverage")).toBeInTheDocument();
    expect(screen.getByText("Project Market (Quoted PPO)")).toBeInTheDocument();
    expect(
      screen.getByText("Contractor Observations (synthetic fixture)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Recent Synthetic Observations")).toBeInTheDocument();
    expect(screen.getAllByText("Synthetic geography").length).toBeGreaterThan(0);
    expect(screen.getByText("Synthetic contractor")).toBeInTheDocument();
    expect(screen.getByText("Synthetic observation ID")).toBeInTheDocument();
    expect(screen.getByTestId("data-intake-panel")).toBeInTheDocument();
    expect(screen.getByTestId("field-coverage-panel")).toBeInTheDocument();
    expect(screen.getByTestId("project-market-panel")).toBeInTheDocument();
    expect(screen.getByTestId("contractor-observations-panel")).toBeInTheDocument();
    expect(screen.getByTestId("recent-observations-panel")).toBeInTheDocument();
    expect(screen.getAllByText("Swipe for columns")).toHaveLength(3);
    expect(screen.getByTestId("project-market-scroll")).toHaveClass("overflow-x-auto");
    expect(screen.getByTestId("contractor-observations-scroll")).toHaveClass("overflow-x-auto");
    expect(screen.getByTestId("recent-observations-scroll")).toHaveClass("overflow-x-auto");
  });

  it("withholds below-minimum cohort and contractor outcome statistics", () => {
    render(<OracleDataLabSurface />);

    expect(
      screen.getByText("1 synthetic cohort withheld below the registered minimum sample of 5."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Synthetic Region C")).not.toBeInTheDocument();
    expect(screen.getAllByText("INSUFFICIENT_DATA").length).toBeGreaterThan(0);
    expect(screen.getByText("Synthetic Contractor A")).toBeInTheDocument();
    expect(screen.queryByText("ABC Impact")).not.toBeInTheDocument();
  });
});
