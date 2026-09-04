import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/admin/shell/AdminIdentityBar", () => ({
  AdminIdentityBar: () => <div>Operator identity</div>,
}));

import { AdminShell } from "@/components/admin/shell/AdminShell";

describe("AdminShell lead-inbox variant", () => {
  it("uses the canonical homepage BrandLogo in the operator chrome", () => {
    render(
      <MemoryRouter>
        <AdminShell
          title="Lead Inbox"
          variant="lead-inbox"
          nav={<nav aria-label="Admin sections">Inbox navigation</nav>}
        >
          <h1>Lead Inbox</h1>
        </AdminShell>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("link", { name: "WindowMan home" }),
    ).toHaveAttribute("href", "/");
    expect(
      screen.getByRole("navigation", { name: "Admin sections" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Operator identity")).toBeInTheDocument();
  });
});
