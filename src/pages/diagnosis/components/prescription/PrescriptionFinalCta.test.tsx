import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PrescriptionFinalCta } from "./PrescriptionFinalCta";
import type { DiagnosticContext } from "../../types";

const baseContext: DiagnosticContext = {
  lead_id: "22222222-2222-4222-8222-222222222222",
  scan_session_id: "11111111-1111-4111-8111-111111111111",
  report_grade: "C",
  top_insights: ["Missing DP rating"],
  first_name: "Jane",
  phone: "+13055551234",
  email: "jane@example.com",
};

function renderCta(
  overrides: Partial<{
    hasCounterOffer: boolean;
    isSubmitting: boolean;
    submitError: string | null;
    onSubmit: (e: React.FormEvent) => void;
  }> = {},
) {
  const onSubmit = overrides.onSubmit ?? vi.fn((e: React.FormEvent) => e.preventDefault());
  render(
    <PrescriptionFinalCta
      context={baseContext}
      hasCounterOffer={overrides.hasCounterOffer ?? true}
      isSubmitting={overrides.isSubmitting ?? false}
      submitError={overrides.submitError ?? null}
      onSubmit={onSubmit}
    />,
  );
  return { onSubmit };
}

describe("PrescriptionFinalCta — honesty copy", () => {
  it("renders the neutral request-includes heading", () => {
    renderCta();
    expect(
      screen.getByText("Your request includes your report and answers"),
    ).toBeInTheDocument();
  });

  it("renders the truthful request button copy", () => {
    renderCta();
    expect(
      screen.getByRole("button", { name: /Request a Call From WindowMan/i }),
    ).toBeInTheDocument();
  });

  it("renders sending state while submitting", () => {
    renderCta({ isSubmitting: true });
    expect(screen.getByText("Sending your request...")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Request a Call From WindowMan/i }),
    ).toBeNull();
  });

  it("does not render old callback-time, notification, or CTA strings", () => {
    renderCta();
    expect(screen.queryByText(/Your advisor is calling/i)).toBeNull();
    expect(screen.queryByText(/Notifying your advisor/i)).toBeNull();
    expect(screen.queryByText(/Have a WindowMan Advisor Call Me/i)).toBeNull();
    expect(screen.queryByText(/by \d/i)).toBeNull();
  });

  it("does not render the fake Edit control", () => {
    renderCta();
    expect(screen.queryByRole("button", { name: /^Edit$/i })).toBeNull();
  });

  it("renders supplied submitError in an accessible alert region", () => {
    renderCta({ submitError: "We could not save your diagnosis." });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(alert).toHaveTextContent("We could not save your diagnosis.");
  });

  it("wires the submit callback to the form", () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    renderCta({ onSubmit });
    fireEvent.submit(screen.getByRole("button", { name: /Request a Call From WindowMan/i }).closest("form")!);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
