import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { buildComparisonRows } from "./QuoteComparisonBlock";
import { AdvisorBriefCard } from "./AdvisorBriefCard";
import { DIAGNOSTIC_MAP } from "../../constants/diagnosticMap";

describe("buildComparisonRows", () => {
  it("renders rows from top_insights when present", () => {
    const rows = buildComparisonRows({
      topInsights: ["Missing NOA documentation", "Vague warranty terms"],
      primaryDiagnosis: "financial",
      mainConcernLabel: "I can't afford that price structure",
      secondaryClarifiers: [],
      desiredNextMove: [],
    });

    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows[0].problem).toBe("Missing NOA documentation");
    expect(rows[0].requirement).toMatch(/NOA|writing/i);
    expect(rows[1].problem).toBe("Vague warranty terms");
    expect(rows[1].requirement).toMatch(/warranty/i);
  });

  it("renders branch fallback rows when top_insights is empty", () => {
    const rows = buildComparisonRows({
      topInsights: [],
      primaryDiagnosis: "financial",
      mainConcernLabel: "I can't afford that price structure",
      secondaryClarifiers: [],
      desiredNextMove: [],
    });

    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.some((r) => r.problem.toLowerCase().includes("down payment"))).toBe(true);
  });

  it("does not return an empty block", () => {
    const rows = buildComparisonRows({
      topInsights: [],
      primaryDiagnosis: "other",
      mainConcernLabel: "",
      secondaryClarifiers: [],
      desiredNextMove: [],
    });

    expect(rows.length).toBeGreaterThanOrEqual(2);
  });
});

describe("AdvisorBriefCard", () => {
  it("uses decision-language labels, not Window Styles or Frame Material", () => {
    render(
      <AdvisorBriefCard
        activeConfig={DIAGNOSTIC_MAP.financial}
        secondaryClarifiers={["Down payment too big"]}
        otherFreeText=""
        windowConcerns={["Noise"]}
        windowStyles={["This month"]}
        frameMaterial="Just me"
        contractorContext={["Price felt high"]}
        desiredNextMove={["Get a better competing quote"]}
        onEdit={() => {}}
      />,
    );

    expect(screen.getByText("Main Concern")).toBeInTheDocument();
    expect(screen.getByText("Timeline")).toBeInTheDocument();
    expect(screen.getByText("Decision Authority")).toBeInTheDocument();
    expect(screen.queryByText("Window Styles")).not.toBeInTheDocument();
    expect(screen.queryByText("Frame Material")).not.toBeInTheDocument();
  });
});
