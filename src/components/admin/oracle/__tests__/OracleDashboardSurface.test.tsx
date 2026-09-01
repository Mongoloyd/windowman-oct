import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { OracleDashboardSurface } from "../OracleDashboardSurface";

describe("OracleDashboardSurface", () => {
  it("renders the consolidated fixture cockpit and controlled query dock", () => {
    render(<OracleDashboardSurface />);

    expect(screen.getByTestId("operator-cockpit-header")).toHaveTextContent(
      "Interrogate a synthetic cohort before the homeowner call.",
    );
    expect(screen.getByTestId("operator-cockpit-header")).toHaveTextContent(
      "no Supabase, network, or production market connection",
    );
    expect(screen.getByTestId("oracle-dashboard")).toBeInTheDocument();
    expect(screen.getByTestId("oracle-search-filters")).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")).toHaveLength(8);
    expect(screen.getByRole("group", { name: "Cohort scope" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Product package" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Evidence comparison" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.getByTestId("oracle-query-action")).toHaveTextContent(
      "Run synthetic query",
    );
    expect(screen.getByTestId("oracle-confidence-card")).toBeInTheDocument();
    expect(screen.getByTestId("oracle-distribution-band")).toBeInTheDocument();
    expect(screen.getByTestId("oracle-call-summary")).toBeInTheDocument();
  });

  it("keeps synthetic geography and product choices internally consistent", () => {
    render(<OracleDashboardSurface />);

    fireEvent.change(screen.getByRole("combobox", { name: "Synthetic region" }), {
      target: { value: "Synthetic Region B" },
    });
    expect(screen.getByRole("combobox", { name: "Synthetic ZIP" })).toHaveValue(
      "00011",
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Brand fixture" }), {
      target: { value: "ES" },
    });
    expect(screen.getByRole("combobox", { name: "Series fixture" })).toHaveValue(
      "Series 500",
    );
  });

  it("withholds thin results without removing the recovery controls", () => {
    render(<OracleDashboardSurface />);

    fireEvent.change(screen.getByRole("combobox", { name: "Synthetic region" }), {
      target: { value: "Synthetic Region B" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Brand fixture" }), {
      target: { value: "ES" },
    });
    fireEvent.click(screen.getByTestId("oracle-query-action"));

    expect(screen.getByRole("status")).toHaveTextContent("INSUFFICIENT_DATA");
    expect(screen.getByTestId("oracle-search-filters")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Synthetic region" }), {
      target: { value: "Synthetic Region A" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Brand fixture" }), {
      target: { value: "PGT" },
    });
    fireEvent.click(screen.getByTestId("oracle-query-action"));

    expect(screen.getByTestId("oracle-confidence-card")).toBeInTheDocument();
  });

  it("switches tabs without mounting production routes", () => {
    render(<OracleDashboardSurface />);

    const contractorsTab = screen.getByRole("tab", { name: "Contractors" });
    fireEvent.click(contractorsTab);
    expect(contractorsTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("oracle-contractor-table")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Quoted vs sold" }));
    expect(screen.getByTestId("oracle-quoted-vs-sold")).toBeInTheDocument();
    expect(screen.getByTestId("oracle-quoted-vs-sold")).toHaveTextContent(
      "INSUFFICIENT_DATA",
    );
  });

  it("keeps the price-distribution tab focused on distribution evidence", () => {
    render(<OracleDashboardSurface />);

    fireEvent.click(screen.getByRole("tab", { name: "Price distribution" }));

    expect(screen.getByTestId("oracle-distribution-band")).toBeInTheDocument();
    expect(screen.getByTestId("oracle-confidence-card")).toBeInTheDocument();
    expect(screen.queryByTestId("oracle-call-summary")).not.toBeInTheDocument();
  });
});
