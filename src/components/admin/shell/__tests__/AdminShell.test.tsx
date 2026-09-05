import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/admin/shell/AdminIdentityBar", () => ({
  AdminIdentityBar: () => <div>Operator identity</div>,
}));

import { AdminShell } from "@/components/admin/shell/AdminShell";

function renderShell(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("AdminShell unified chrome", () => {
  it("links the admin BrandLogo to Lead Inbox", () => {
    renderShell(
      <AdminShell title="Lead Inbox" nav={<nav aria-label="Admin sections">Nav</nav>}>
        Directory
      </AdminShell>,
    );

    expect(screen.getByRole("link", { name: "WindowMan Lead Inbox" })).toHaveAttribute(
      "href",
      "/admin/leads",
    );
  });

  it("renders header, navigation, and main landmarks", () => {
    renderShell(
      <AdminShell title="Pipeline" nav={<nav aria-label="Admin sections">Nav</nav>}>
        Pipeline body
      </AdminShell>,
    );

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Admin sections" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("Pipeline body");
    expect(screen.getByText("Operator identity")).toBeInTheDocument();
  });

  it("renders exactly one page title from the shared header", () => {
    renderShell(<AdminShell title="Needs Review">Review body</AdminShell>);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Needs Review");
  });

  it("renders default page content inside the shared shell", () => {
    renderShell(<AdminShell title="Dashboard">Default content</AdminShell>);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Dashboard");
    expect(screen.getByRole("main")).toHaveTextContent("Default content");
    expect(screen.getByRole("main").closest(".wm-admin-canvas")).not.toHaveClass("wm-lead-dossier");
  });

  it("renders inbox content inside the shared shell without inbox-only command tools", () => {
    renderShell(
      <AdminShell
        title="Lead Inbox"
        variant="lead-inbox"
        nav={<nav aria-label="Admin sections">Inbox navigation</nav>}
        leadInboxHeaderTools={
          <label>
            Command search
            <input />
          </label>
        }
      >
        Inbox directory
      </AdminShell>,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Lead Inbox");
    expect(screen.getByRole("main")).toHaveTextContent("Inbox directory");
    expect(screen.getByRole("navigation", { name: "Admin sections" })).toBeInTheDocument();
    expect(screen.queryByText("Command search")).not.toBeInTheDocument();
    expect(document.querySelector(".wm-admin-inbox-commandbar")).toBeNull();
    expect(document.querySelector(".wm-admin-inbox-nav")).toBeNull();
  });

  it("renders dossier content inside the shared shell", () => {
    renderShell(
      <AdminShell title="Lead dossier" variant="lead-dossier">
        Dossier workspace
      </AdminShell>,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Lead dossier");
    expect(screen.getByRole("main")).toHaveTextContent("Dossier workspace");
    expect(screen.getByRole("main").closest(".wm-admin-canvas")).toHaveClass("wm-lead-dossier");
  });

  it("keeps static chrome visible for loading and error children", () => {
    const { rerender } = renderShell(
      <AdminShell title="Lead Inbox" nav={<nav aria-label="Admin sections">Nav</nav>}>
        <p>Loading leads</p>
      </AdminShell>,
    );

    expect(screen.getByRole("link", { name: "WindowMan Lead Inbox" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Lead Inbox");
    expect(screen.getByRole("navigation", { name: "Admin sections" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("Loading leads");

    rerender(
      <MemoryRouter>
        <AdminShell title="Lead Inbox" nav={<nav aria-label="Admin sections">Nav</nav>}>
          <p role="alert">Couldn't load leads</p>
        </AdminShell>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "WindowMan Lead Inbox" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Lead Inbox");
    expect(screen.getByRole("navigation", { name: "Admin sections" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load leads");
  });

  it("preserves visible focus treatment on chrome links", () => {
    renderShell(
      <AdminShell title="Settings" backTo="/admin/leads" backLabel="Back to inbox">
        Settings body
      </AdminShell>,
    );

    const logo = screen.getByRole("link", { name: "WindowMan Lead Inbox" });
    const back = screen.getByRole("link", { name: /Back to inbox/i });
    expect(logo.className).toMatch(/focus-visible:ring/);
    expect(back.className).toMatch(/focus-visible:ring/);
  });

  it("does not render ignored Inbox command tools on the default shell", () => {
    renderShell(
      <AdminShell title="Dashboard" leadInboxHeaderTools={<span>Inbox-only search</span>}>
        Dashboard content
      </AdminShell>,
    );

    expect(screen.queryByText("Inbox-only search")).not.toBeInTheDocument();
  });
});
