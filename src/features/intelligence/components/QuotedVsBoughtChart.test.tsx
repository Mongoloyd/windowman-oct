import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { INTERNAL_INTELLIGENCE_FIXTURE, PUBLIC_ORACLE_FIXTURE } from "../fixtures";
import { QuotedVsBoughtChart } from "./QuotedVsBoughtChart";

describe("QuotedVsBoughtChart", () => {
  it("renders the governed public variant with direct population labels", () => {
    render(
      <QuotedVsBoughtChart
        quoted={PUBLIC_ORACLE_FIXTURE.quoted}
        accepted={PUBLIC_ORACLE_FIXTURE.verifiedAccepted}
        compact
        variant="public-stage-1a"
      />,
    );

    const chart = screen.getByLabelText("Quoted and verified accepted price distributions");
    expect(within(chart).getByText("Quoted · offered")).toBeInTheDocument();
    expect(within(chart).getByText("Verified accepted")).toBeInTheDocument();
    expect(within(chart).getByText(/No causal or market-wide claim is made/i)).toBeInTheDocument();
    expect(within(screen.getByTestId("public-oracle-mobile-axis")).getAllByText(/\$/)).toHaveLength(3);
    expect(within(screen.getByTestId("public-oracle-desktop-axis")).getAllByText(/\$/)).toHaveLength(5);
  });

  it("preserves the default shared-chart variant", () => {
    render(
      <QuotedVsBoughtChart
        quoted={PUBLIC_ORACLE_FIXTURE.quoted}
        accepted={PUBLIC_ORACLE_FIXTURE.verifiedAccepted}
      />,
    );

    expect(screen.getByText("Quoted · offered")).toBeInTheDocument();
    expect(screen.getByText("Verified accepted")).toBeInTheDocument();
    expect(screen.queryByTestId("public-oracle-mobile-axis")).not.toBeInTheDocument();
  });

  it("keeps all three Observatory populations named and removes terracotta from accepted evidence", () => {
    render(
      <QuotedVsBoughtChart
        quoted={PUBLIC_ORACLE_FIXTURE.quoted}
        accepted={PUBLIC_ORACLE_FIXTURE.verifiedAccepted}
        final={INTERNAL_INTELLIGENCE_FIXTURE.verifiedFinal}
        variant="observatory-stage-2"
      />,
    );

    const chart = screen.getByLabelText("Quoted, verified accepted, and verified final price distributions");
    expect(within(chart).getByText("Quoted · offered")).toHaveStyle({ color: "#215EA8" });
    expect(within(chart).getByText("Verified accepted")).toHaveStyle({ color: "#315F9F" });
    expect(within(chart).getByText("Verified final")).toHaveStyle({ color: "#087A55" });
  });
});
