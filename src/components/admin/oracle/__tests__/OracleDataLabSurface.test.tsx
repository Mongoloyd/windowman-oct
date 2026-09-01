import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { OracleDataLabSurface } from "../OracleDataLabSurface";
import { SYNTHETIC_DATA_BANNER } from "@/lib/windowOracle";

describe("OracleDataLabSurface", () => {
  it("renders synthetic banner and five lab panels", () => {
    render(<OracleDataLabSurface />);

    expect(screen.getByTestId("oracle-synthetic-banner")).toHaveTextContent(
      SYNTHETIC_DATA_BANNER,
    );
    expect(screen.getByTestId("oracle-data-lab")).toBeInTheDocument();
    expect(screen.getByText("Data Intake")).toBeInTheDocument();
    expect(screen.getByText("Field Coverage")).toBeInTheDocument();
    expect(screen.getByText("Project Market (Quoted PPO)")).toBeInTheDocument();
    expect(
      screen.getByText("Contractor Observations (synthetic fixture)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Recent Synthetic Observations")).toBeInTheDocument();
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
