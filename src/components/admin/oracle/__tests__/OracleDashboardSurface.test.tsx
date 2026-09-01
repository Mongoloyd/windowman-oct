import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { OracleDashboardSurface } from "../OracleDashboardSurface";
import { SYNTHETIC_DATA_BANNER } from "@/lib/windowOracle";

describe("OracleDashboardSurface", () => {
  it("renders fixture cockpit with synthetic banner and confidence before price", () => {
    render(<OracleDashboardSurface />);

    expect(screen.getByTestId("oracle-synthetic-banner")).toHaveTextContent(
      SYNTHETIC_DATA_BANNER,
    );
    expect(screen.getByTestId("oracle-dashboard")).toBeInTheDocument();
    expect(screen.getByTestId("oracle-search-filters")).toBeInTheDocument();
    expect(screen.getByTestId("oracle-confidence-card")).toBeInTheDocument();
    expect(screen.getByTestId("oracle-distribution-band")).toBeInTheDocument();
    expect(screen.getByTestId("oracle-call-summary")).toBeInTheDocument();
  });

  it("switches tabs without mounting production routes", () => {
    render(<OracleDashboardSurface />);

    fireEvent.click(screen.getByRole("tab", { name: "Contractors" }));
    expect(screen.getByTestId("oracle-contractor-table")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Quoted vs sold" }));
    expect(screen.getByTestId("oracle-quoted-vs-sold")).toBeInTheDocument();
  });
});
