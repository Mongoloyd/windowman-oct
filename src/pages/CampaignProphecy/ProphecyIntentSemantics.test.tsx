import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProphecyIntakeSkin from "./ProphecyIntakeSkin";
import ProphecyFinalCTA from "./sections/ProphecyFinalCTA";
import ProphecyHero from "./sections/ProphecyHero";

const variant = {
  id: "variant-a",
  eyebrow: "Eyebrow",
  headline: "Headline",
  headlineAccent: "",
  subheadline: "Subheadline",
  ctaLabel: "CTA",
  weight: 1,
};

describe("Prophecy intent fork semantics", () => {
  it("renders hero intent cards as a button group, not a radio group", () => {
    render(<ProphecyHero variant={variant} onChooseIntent={vi.fn()} />);

    expect(
      screen.getByRole("group", { name: /start here — pick the one that's true/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: /printed window proposal and estimate/i,
      }),
    ).toHaveAttribute("loading", "eager");
    expect(
      screen.getByRole("img", {
        name: /window frame sample beside a tablet/i,
      }),
    ).toHaveAttribute("fetchpriority", "high");
    expect(document.querySelectorAll('source[type="image/avif"]')).toHaveLength(
      2,
    );
    expect(document.querySelectorAll('source[type="image/webp"]')).toHaveLength(
      2,
    );
  });

  it("renders footer intent cards as a button group, not a radio group", () => {
    render(<ProphecyFinalCTA onChooseIntent={vi.fn()} />);

    expect(
      screen.getByRole("group", { name: /do you already have an estimate\?/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: /printed window proposal and estimate/i,
      }),
    ).toHaveAttribute("loading", "lazy");
    expect(
      screen.getByRole("img", {
        name: /printed window proposal and estimate/i,
      }),
    ).not.toHaveAttribute("fetchpriority");
  });

  it("exposes the modal intent choice through pressed button semantics", () => {
    render(
      <ProphecyIntakeSkin
        step="intent"
        stepNumber={1}
        totalSteps={3}
        location={{
          marketId: "test",
          inputLabel: "Project ZIP code",
          helperText: "Enter a ZIP code.",
          placeholder: "e.g. 33139",
          invalidMessage: "Enter a valid ZIP code.",
          isEligibleZip: () => true,
        }}
        values={{
          intent: "has_quote",
          zip: "",
          projectType: "",
          openings: "",
          name: "",
          email: "",
          phone: "",
        }}
        validationError={null}
        submitError={null}
        isSubmitting={false}
        onFieldChange={vi.fn()}
        onSelectAndNext={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const group = screen.getByRole("group", {
      name: /do you already have an estimate\?/i,
    });
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(
      within(group).getByRole("button", {
        name: /i've got an estimate in hand/i,
        pressed: true,
      }),
    ).toBeInTheDocument();
    expect(
      within(group).getByRole("button", {
        name: /i don't have an estimate yet/i,
        pressed: false,
      }),
    ).toBeInTheDocument();
  });
});
