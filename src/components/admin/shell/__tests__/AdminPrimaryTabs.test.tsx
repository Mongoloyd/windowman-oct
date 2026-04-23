/**
 * AdminPrimaryTabs — route-tab + active-state tests
 *
 * Verifies the route-aware "Lead Inbox" tab:
 *  - active on /admin/leads (exact match)
 *  - active on /admin/leads/:id (prefix match — operator drill-down)
 *  - inactive on /admin/settings or /admin
 *  - emits aria-current="page" only when active
 *
 * Also verifies the panel tabs still render as Radix TabsTrigger.
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Tabs } from "@/components/ui/tabs";
import { AdminPrimaryTabs } from "@/components/admin/shell/AdminPrimaryTabs";

function renderTabs(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Tabs value="launch" onValueChange={() => {}}>
        <AdminPrimaryTabs ghostCount={0} needsReviewCount={0} />
      </Tabs>
    </MemoryRouter>,
  );
}

describe("AdminPrimaryTabs — Lead Inbox route tab", () => {
  it("renders the Lead Inbox link first in the tab strip", () => {
    renderTabs("/admin");
    const link = screen.getByRole("link", { name: /lead inbox/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/admin/leads");
  });

  it("is active when path is exactly /admin/leads", () => {
    renderTabs("/admin/leads");
    const link = screen.getByRole("link", { name: /lead inbox/i });
    expect(link).toHaveAttribute("data-state", "active");
    expect(link).toHaveAttribute("aria-current", "page");
  });

  it("stays active on dynamic sub-route /admin/leads/:id (operator drill-down)", () => {
    renderTabs("/admin/leads/abc-123");
    const link = screen.getByRole("link", { name: /lead inbox/i });
    expect(link).toHaveAttribute("data-state", "active");
    expect(link).toHaveAttribute("aria-current", "page");
  });

  it("is inactive on /admin (dashboard root)", () => {
    renderTabs("/admin");
    const link = screen.getByRole("link", { name: /lead inbox/i });
    expect(link).toHaveAttribute("data-state", "inactive");
    expect(link).not.toHaveAttribute("aria-current");
  });

  it("is inactive on /admin/settings (sibling admin route)", () => {
    renderTabs("/admin/settings");
    const link = screen.getByRole("link", { name: /lead inbox/i });
    expect(link).toHaveAttribute("data-state", "inactive");
    expect(link).not.toHaveAttribute("aria-current");
  });

  it("does not match on /admin/leadsmith (must not greedy-match prefix)", () => {
    renderTabs("/admin/leadsmith");
    const link = screen.getByRole("link", { name: /lead inbox/i });
    expect(link).toHaveAttribute("data-state", "inactive");
  });

  it("renders panel tabs as Radix TabsTrigger (role=tab) — not links", () => {
    renderTabs("/admin/leads");
    // Panel tabs from the curated set
    const panelTabs = screen.getAllByRole("tab");
    const panelLabels = panelTabs.map((t) => t.textContent ?? "");
    expect(panelLabels).toEqual(
      expect.arrayContaining([
        "Launch Control",
        "Command Center",
        "Active Pipeline",
        "Routing",
      ]),
    );
    // Lead Inbox must NOT appear in role=tab — it's a link, not a TabsTrigger
    expect(panelLabels).not.toContain("Lead Inbox");
  });
});
