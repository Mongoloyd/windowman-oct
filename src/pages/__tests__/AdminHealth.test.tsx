import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminHealth from "@/pages/AdminHealth";

vi.mock("react-helmet-async", () => ({
  Helmet: () => null,
}));

describe("AdminHealth standalone page", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => "text/html" },
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders one heading and a keyboard-operable back link to Lead Inbox", () => {
    render(
      <MemoryRouter>
        <AdminHealth />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const back = screen.getByRole("link", { name: /Back to Lead Inbox/i });
    expect(back).toHaveAttribute("href", "/admin/leads");
  });

  it("does not import AdminShell", () => {
    const sourcePath = path.join(process.cwd(), "src/pages/AdminHealth.tsx");
    expect(readFileSync(sourcePath, "utf8")).not.toMatch(/from ["']@\/components\/admin\/shell\/AdminShell["']/);
  });

  it("does not render AdminShell chrome", () => {
    render(
      <MemoryRouter>
        <AdminHealth />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: "WindowMan Lead Inbox" })).not.toBeInTheDocument();
    expect(document.querySelector(".wm-admin-chrome")).toBeNull();
    expect(document.querySelector(".wm-admin-canvas")).toBeNull();
  });

  it("keeps existing route-check labels", () => {
    render(
      <MemoryRouter>
        <AdminHealth />
      </MemoryRouter>,
    );

    expect(screen.getByText("Admin login (public)")).toBeInTheDocument();
    expect(screen.getByText("Lead inbox (gated)")).toBeInTheDocument();
  });
});
