import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PillarScore } from "@/hooks/useAnalysisData";
import QuoteAnalysisBento from "./QuoteAnalysisBento";

const completeScores = (
  statuses: Record<PillarScore["key"], PillarScore["status"]>,
): PillarScore[] => [
  { key: "safety_code", label: "Safety", score: 11, status: statuses.safety_code },
  { key: "install_scope", label: "Install", score: 22, status: statuses.install_scope },
  { key: "price_fairness", label: "Price", score: 33, status: statuses.price_fairness },
  { key: "fine_print", label: "Fine", score: 44, status: statuses.fine_print },
  { key: "warranty", label: "Warranty", score: 55, status: statuses.warranty },
];

describe("QuoteAnalysisBento", () => {
  it("shows at most two highest-priority categories in canonical order", () => {
    render(
      <QuoteAnalysisBento
        contractorName="BrightView Window"
        pillarScores={completeScores({
          safety_code: "fail",
          install_scope: "warn",
          price_fairness: "warn",
          fine_print: "fail",
          warranty: "fail",
        })}
        pricePerOpeningBand="market"
        hasWarranty
        hasPermits
        flagRedCount={3}
        flagAmberCount={2}
      />,
    );

    const snapshot = screen.getByLabelText("Quote analysis snapshot");
    const priorityRows = within(snapshot).getAllByText("Material concern");
    expect(priorityRows).toHaveLength(2);
    expect(priorityRows[0].parentElement).toHaveTextContent("Safety & Code");
    expect(priorityRows[1].parentElement).toHaveTextContent("Fine Print");
    expect(snapshot).not.toHaveTextContent("Installation Scope");
    expect(snapshot).not.toHaveTextContent("Price Clarity");
    expect(snapshot).not.toHaveTextContent("Warranty Coverage");
    expect(snapshot).not.toHaveTextContent(/11|22|33|44|55/);
  });

  it("renders a distinct all-clear state only when all five canonical pillars pass", () => {
    render(
      <QuoteAnalysisBento
        contractorName="BrightView Window"
        pillarScores={completeScores({
          safety_code: "pass",
          install_scope: "pass",
          price_fairness: "pass",
          fine_print: "pass",
          warranty: "pass",
        })}
        pricePerOpeningBand="low"
        flagRedCount={0}
        flagAmberCount={0}
      />,
    );

    expect(
      screen.getByText("All five documented quote categories appear clear in this preview."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/material concern|clarification needed/i)).not.toBeInTheDocument();
  });

  it("does not announce an all-clear state when aggregate review counts are nonzero", () => {
    render(
      <QuoteAnalysisBento
        contractorName="BrightView Window"
        pillarScores={completeScores({
          safety_code: "pass",
          install_scope: "pass",
          price_fairness: "pass",
          fine_print: "pass",
          warranty: "pass",
        })}
        flagRedCount={1}
        flagAmberCount={1}
      />,
    );

    expect(screen.queryByText(/All five documented quote categories appear clear/i)).not.toBeInTheDocument();
    expect(screen.getByText("Review items were identified.")).toBeInTheDocument();
    expect(
      screen.getByText("Category-level details are available in the full analysis."),
    ).toBeInTheDocument();
  });

  it("fails closed for missing, duplicated, malformed, or partial pillar data", () => {
    const malformed = [
      { key: "safety_code", label: "Safety", score: 1, status: "pass" },
      { key: "safety_code", label: "Safety duplicate", score: 99, status: "fail" },
      { key: "install_scope", label: "Install", score: 2, status: "invalid" },
      { key: "hostile", label: "Hostile category", score: 3, status: "fail" },
    ] as unknown as PillarScore[];

    render(<QuoteAnalysisBento pillarScores={malformed} flagRedCount={0} flagAmberCount={0} />);

    expect(
      screen.getByText("Category-level review is not available in this preview."),
    ).toBeInTheDocument();
    expect(screen.getByText(/no missing category is treated as clear/i)).toBeInTheDocument();
    expect(screen.queryByText("Hostile category")).not.toBeInTheDocument();
    expect(screen.queryByText(/all five/i)).not.toBeInTheDocument();
  });

  it("maps the price band to a categorical rail without exact prices", () => {
    render(<QuoteAnalysisBento pricePerOpeningBand="extreme" />);

    expect(screen.getByRole("img", { name: "Quote price band: Elevated" })).toBeInTheDocument();
    expect(screen.getByText("Elevated", { selector: ".fr-mono" })).toBeInTheDocument();
    expect(
      screen.getByText("Broad quoted-price category, not a localized market appraisal."),
    ).toHaveClass("text-sm", "text-[#aab3c0]");
    expect(document.body).not.toHaveTextContent(/\$|county|per opening/i);
  });

  it("keeps supporting disclaimers legible without changing their content", () => {
    render(<QuoteAnalysisBento />);

    expect(
      screen.getByText(
        "This snapshot evaluates what is documented in the quote, not the contractor’s workmanship or professional quality.",
      ),
    ).toHaveClass("text-[#aab3c0]");
  });

  it("preserves tri-state documentation semantics and collapses null context", () => {
    const { rerender } = render(
      <QuoteAnalysisBento hasWarranty hasPermits={false} pricePerOpeningBand={null} />,
    );

    expect(screen.getByText("Warranty terms").parentElement).toHaveTextContent(
      "Warranty termsMentioned in quote",
    );
    expect(screen.getByText("Permit language").parentElement).toHaveTextContent(
      "Permit languageNot documented in quote",
    );

    rerender(
      <QuoteAnalysisBento hasWarranty={null} hasPermits={null} pricePerOpeningBand={null} />,
    );

    expect(screen.queryByText("Warranty terms")).not.toBeInTheDocument();
    expect(screen.queryByText("Permit language")).not.toBeInTheDocument();
    expect(screen.queryByText("Quote price band")).not.toBeInTheDocument();
    expect(
      screen.getByLabelText("Quote analysis snapshot").querySelector(".grid"),
    ).toBeInTheDocument();
  });

  it("wraps a long contractor name and rejects unrelated hostile payload leaves", () => {
    const hostileProps = {
      contractorName:
        "Southeast Florida Architectural Impact Window and Coastal Door Specialists Incorporated",
      pillarScores: completeScores({
        safety_code: "fail",
        install_scope: "pass",
        price_fairness: "pass",
        fine_print: "pass",
        warranty: "pass",
      }),
      flagRedCount: 1,
      flagAmberCount: 0,
      full_json: "FULL_JSON_SENTINEL",
      raw_line_items: "RAW_LINE_ITEMS_SENTINEL",
      exact_total: "$14,500",
      phone: "561-123-4567",
    };

    render(<QuoteAnalysisBento {...hostileProps} />);

    const personalized = screen.getByText(/Southeast Florida Architectural Impact/);
    expect(personalized).toHaveClass("break-words");
    expect(document.body).not.toHaveTextContent(
      /FULL_JSON_SENTINEL|RAW_LINE_ITEMS_SENTINEL|\$14,500|561-123-4567/,
    );
  });
});
