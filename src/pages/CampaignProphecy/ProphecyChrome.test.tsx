import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ProphecyFooter, ProphecyNavigation } from "./sections/ProphecyChrome";

describe("ProphecyChrome accessibility", () => {
  it("uses compliant muted text tokens on the dark chrome surfaces", () => {
    const { container } = render(
      <MemoryRouter>
        <ProphecyNavigation />
        <ProphecyFooter />
      </MemoryRouter>,
    );

    expect(container.querySelector(".text-slate-500")).toBeNull();
    expect(container.querySelector(".text-slate-600")).toBeNull();
    expect(container.querySelectorAll(".text-slate-400").length).toBeGreaterThan(
      0,
    );
  });

  it("gives footer legal links a 44px minimum hit target", () => {
    render(
      <MemoryRouter>
        <ProphecyFooter />
      </MemoryRouter>,
    );

    const nav = screen.getByRole("navigation");
    for (const name of ["Privacy", "Terms", "Disclaimer"] as const) {
      const link = within(nav).getByRole("link", { name });
      expect(link.className).toMatch(/min-h-11/);
    }
  });
});
