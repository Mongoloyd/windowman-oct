import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AdminGlobalNav } from "../AdminGlobalNav";
import { AdminShell } from "../AdminShell";

vi.mock("../AdminIdentityBar", () => ({
  AdminIdentityBar: () => <div>Operator identity</div>,
}));

describe("lead dossier shell variants", () => {
  it("leaves the default shell unscoped and activates dossier scope only when requested", () => {
    const { rerender } = render(
      <MemoryRouter>
        <AdminShell title="Default">Content</AdminShell>
      </MemoryRouter>,
    );
    expect(screen.getByText("Content").closest(".wm-admin-canvas")).not.toHaveClass("wm-lead-dossier");

    rerender(
      <MemoryRouter>
        <AdminShell title="Dossier" variant="lead-dossier">Content</AdminShell>
      </MemoryRouter>,
    );
    expect(screen.getByText("Content").closest(".wm-admin-canvas")).toHaveClass("wm-lead-dossier");
  });

  it("keeps default navigation geometry and applies compact geometry only by opt-in", () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={["/admin/leads"]}>
        <AdminGlobalNav />
      </MemoryRouter>,
    );
    const defaultStrip = screen.getByRole("navigation").firstElementChild;
    expect(defaultStrip).toHaveClass("rounded-2xl", "p-2");
    expect(defaultStrip).not.toHaveClass("rounded-xl", "p-1.5");

    rerender(
      <MemoryRouter initialEntries={["/admin/leads"]}>
        <AdminGlobalNav variant="lead-dossier" />
      </MemoryRouter>,
    );
    const dossierStrip = screen.getByRole("navigation").firstElementChild;
    expect(dossierStrip).toHaveClass("rounded-xl", "p-1.5");
    expect(dossierStrip).not.toHaveClass("rounded-2xl", "p-2");
  });
});
