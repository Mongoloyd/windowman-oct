import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ProcessSteps from "./ProcessSteps";

describe("ProcessSteps", () => {
  it("describes the contact-first quote check flow", () => {
    render(<ProcessSteps />);

    expect(screen.getByText("Start your free quote check")).toBeInTheDocument();
    expect(screen.getByText("Upload your quote")).toBeInTheDocument();
    expect(screen.getByText("AI scans every line")).toBeInTheDocument();
    expect(screen.getByText("Your grade is calculated")).toBeInTheDocument();
    expect(screen.getByText("Decide your next move")).toBeInTheDocument();
  });

  it("does not render stale county-first or four-question copy", () => {
    render(<ProcessSteps />);

    expect(screen.queryByText(/Answer 4 Quick Questions/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/County, Scope, Project Type/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/your county and scope/i)).not.toBeInTheDocument();
  });
});
