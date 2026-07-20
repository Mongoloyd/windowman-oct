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
      screen.getByText("Contractor Observations (WindowMan-observed)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Recent Observations")).toBeInTheDocument();
  });
});
