import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AdminGlobalNav } from "@/components/admin/shell/AdminGlobalNav";

function renderNav(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AdminGlobalNav />
    </MemoryRouter>,
  );
}

function desktopNav() {
  return screen.getByTestId("admin-desktop-nav");
}

function openMore() {
  const trigger = screen.getByRole("button", { name: /More admin destinations/i });
  fireEvent.click(trigger);
  return trigger;
}

describe("AdminGlobalNav information architecture", () => {
  it("renders five primary destinations in approved order", () => {
    renderNav("/admin/leads");
    const links = within(desktopNav())
      .getAllByRole("link")
      .map((link) => link.textContent?.replace(/\s+\(current section\)/, "").trim());
    expect(links).toEqual([
      "Lead Inbox",
      "Command Center",
      "Pipeline",
      "Routing",
      "Needs Review",
    ]);
  });

  it("renders eight More destinations in approved order, with Contractors only in More", () => {
    renderNav("/admin/leads");
    expect(within(desktopNav()).queryByRole("link", { name: /^Contractors/ })).not.toBeInTheDocument();

    openMore();
    const more = screen.getByRole("menu");
    expect(within(more).getAllByRole("menuitem").map((item) => item.textContent?.trim())).toEqual([
      "Contractors",
      "Attribution",
      "OTP Ops",
      "Evidence",
      "Partners",
      "Settings",
      "Health",
      "Meta Intake Lab",
    ]);
    expect(within(more).getByRole("menuitem", { name: /^Health/ })).toHaveAttribute("href", "/admin/health");
    expect(within(more).getByRole("menuitem", { name: /^Meta Intake Lab/ })).toHaveAttribute(
      "href",
      "/admin/meta-intake-lab",
    );
  });

  it("activates Lead Inbox for nested lead routes and Evidence for lead-evidence", () => {
    const nested = renderNav("/admin/leads/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/report");
    expect(within(desktopNav()).getByRole("link", { name: /Lead Inbox/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    nested.unmount();

    renderNav("/admin/lead-evidence");
    const moreTrigger = screen.getByRole("button", { name: /More admin destinations/i });
    expect(moreTrigger.className).toMatch(/font-black/);
    openMore();
    expect(screen.getByRole("menuitem", { name: /Evidence/ })).toHaveAttribute("aria-current", "page");
    expect(within(desktopNav()).getByRole("link", { name: /Lead Inbox/ })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("ignores query strings when matching the active destination", () => {
    renderNav("/admin/leads?priority=Hot&lead_id=abc");
    expect(within(desktopNav()).getByRole("link", { name: /Lead Inbox/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("opens and closes the mobile drawer and restores focus", async () => {
    renderNav("/admin/settings");
    const trigger = screen.getByRole("button", { name: "Open admin navigation" });
    fireEvent.click(trigger);
    const drawer = screen.getByTestId("admin-mobile-drawer");
    expect(within(drawer).getByRole("link", { name: /Lead Inbox/ })).toBeInTheDocument();
    expect(within(drawer).getByRole("link", { name: /Health/ })).toHaveAttribute("href", "/admin/health");

    fireEvent.keyDown(drawer, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByTestId("admin-mobile-drawer")).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it("closes More with Escape and restores focus to the trigger", async () => {
    renderNav("/admin/leads");
    const trigger = openMore();
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it("does not render search or navigation badges", () => {
    renderNav("/admin/leads");
    expect(screen.queryByRole("search")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/99\+/)).not.toBeInTheDocument();
    expect(document.querySelector("[data-badge]")).toBeNull();
  });

  it("does not use horizontal scrolling to fit destinations", () => {
    renderNav("/admin/leads");
    expect(desktopNav().className).not.toMatch(/overflow-x-auto/);
    expect(screen.getByRole("navigation", { name: "Admin sections" }).className).not.toMatch(
      /overflow-x-auto/,
    );
  });
});
