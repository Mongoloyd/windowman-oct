import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import NoQuoteDiagnostic from "@/components/postcapture/NoQuoteDiagnostic";
import { NO_QUOTE_DIAGNOSTIC } from "@/components/postcapture/postCaptureCopy";

function setup() {
  const onUploadNow = vi.fn();
  const onSelectPath = vi.fn();
  const utils = render(
    <NoQuoteDiagnostic onUploadNow={onUploadNow} onSelectPath={onSelectPath} />,
  );
  return { onUploadNow, onSelectPath, ...utils };
}

function answerAll() {
  for (const question of NO_QUOTE_DIAGNOSTIC.questions) {
    fireEvent.click(screen.getByRole("button", { name: question.options[0] }));
  }
}

describe("NoQuoteDiagnostic", () => {
  it("asks 2-4 questions max", () => {
    expect(NO_QUOTE_DIAGNOSTIC.questions.length).toBeGreaterThanOrEqual(2);
    expect(NO_QUOTE_DIAGNOSTIC.questions.length).toBeLessThanOrEqual(4);
  });

  it("renders the first question inside the no-quote branch", () => {
    setup();
    expect(screen.getByTestId("post-capture-no-quote")).toBeInTheDocument();
    expect(
      screen.getByText(NO_QUOTE_DIAGNOSTIC.questions[0].prompt),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("no-quote-quote-ready")).not.toBeInTheDocument();
  });

  it("advances through each question as answers are selected", () => {
    setup();
    fireEvent.click(
      screen.getByRole("button", {
        name: NO_QUOTE_DIAGNOSTIC.questions[0].options[0],
      }),
    );
    expect(
      screen.getByText(NO_QUOTE_DIAGNOSTIC.questions[1].prompt),
    ).toBeInTheDocument();
  });

  it("shows the quote-ready final screen after the last question", () => {
    setup();
    answerAll();
    expect(screen.getByTestId("no-quote-quote-ready")).toBeInTheDocument();
    expect(screen.getByText("You're quote-ready.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "I got my quote — scan it now" }),
    ).toBeInTheDocument();
  });

  it("primary CTA pivots to the upload path via onUploadNow", () => {
    const { onUploadNow } = setup();
    answerAll();
    fireEvent.click(
      screen.getByRole("button", { name: "I got my quote — scan it now" }),
    );
    expect(onUploadNow).toHaveBeenCalledTimes(1);
  });

  it("secondary CTA reveals the what-to-ask checklist (local only)", () => {
    setup();
    answerAll();
    expect(screen.queryByText(NO_QUOTE_DIAGNOSTIC.final.checklist[0])).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Review what to ask before I sign" }),
    );
    expect(
      screen.getByText(NO_QUOTE_DIAGNOSTIC.final.checklist[0]),
    ).toBeInTheDocument();
  });

  it("first-step back returns to the router options", () => {
    const { onSelectPath } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Back to options" }));
    expect(onSelectPath).toHaveBeenCalledWith("router");
  });

  it("does not reference ArbitrageEngine or any scan/upload backend", () => {
    const { container } = setup();
    expect(container.innerHTML).not.toMatch(/arbitrage/i);
  });
});
