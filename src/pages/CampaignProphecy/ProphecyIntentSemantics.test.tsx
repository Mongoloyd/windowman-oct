import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
  });

  it("renders footer intent cards as a button group, not a radio group", () => {
    render(<ProphecyFinalCTA onChooseIntent={vi.fn()} />);

    expect(
      screen.getByRole("group", { name: /do you already have an estimate\?/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});
