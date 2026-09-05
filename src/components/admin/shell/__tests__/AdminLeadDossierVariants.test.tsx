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
    expect(
      screen.getByText("Content").closest(".wm-admin-canvas"),
    ).not.toHaveClass("wm-lead-dossier");

    rerender(
      <MemoryRouter>
        <AdminShell title="Dossier" variant="lead-dossier">
          Content
        </AdminShell>
      </MemoryRouter>,
    );
    expect(screen.getByText("Content").closest(".wm-admin-canvas")).toHaveClass(
      "wm-lead-dossier",
    );
  });

  it("keeps the unified five-primary navigation for default and dossier variants", () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={["/admin/leads"]}>
        <AdminGlobalNav />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("admin-desktop-nav").className).not.toMatch(/overflow-x-auto/);
    expect(screen.getByRole("button", { name: /More admin destinations/i })).toBeInTheDocument();

    rerender(
      <MemoryRouter initialEntries={["/admin/leads"]}>
        <AdminGlobalNav variant="lead-dossier" />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("admin-desktop-nav").className).not.toMatch(/overflow-x-auto/);
    expect(screen.getByRole("button", { name: /More admin destinations/i })).toBeInTheDocument();
  });

  it("renders dossier page content inside the shared shell title and main", () => {
    render(
      <MemoryRouter>
        <AdminShell title="Dossier" variant="lead-dossier">
          Dossier body
        </AdminShell>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Dossier");
    expect(screen.getByRole("main")).toHaveTextContent("Dossier body");
    expect(screen.getByRole("link", { name: "WindowMan Lead Inbox" })).toHaveAttribute(
      "href",
      "/admin/leads",
    );
  });
});
