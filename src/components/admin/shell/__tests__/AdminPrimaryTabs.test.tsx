import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminPrimaryTabs } from "@/components/admin/shell/AdminPrimaryTabs";
import { ADMIN_DASHBOARD_TABS } from "@/routes/adminDashboardTabs";

describe("AdminPrimaryTabs — local Command Center navigation", () => {
  it("maps mission-control to Overview without renaming the panel id", () => {
    render(<AdminPrimaryTabs activePanel="mission-control" />);
    const select = screen.getByRole("combobox", { name: "Command Center panels" });
    expect(select).toHaveValue("mission-control");
    expect(screen.getByRole("option", { name: "Overview" })).toHaveValue("mission-control");
  });

  it("keeps existing aliases available as local panels", () => {
    render(<AdminPrimaryTabs activePanel="command" />);
    expect(screen.getByRole("option", { name: "Command" })).toHaveValue("command");
    expect(screen.getByRole("option", { name: "Dialer" })).toHaveValue("engine");
    expect(screen.getByRole("option", { name: "Ghosts" })).toHaveValue("ghosts");
    expect(screen.getByRole("option", { name: "Launch" })).toHaveValue("launch");
  });

  it("preserves every verified dashboard panel id", () => {
    render(<AdminPrimaryTabs />);
    const values = screen.getAllByRole("option").map((option) => (option as HTMLOptionElement).value);
    expect(values).toEqual(expect.arrayContaining([...ADMIN_DASHBOARD_TABS]));
    expect(values).toHaveLength(ADMIN_DASHBOARD_TABS.length);
  });

  it("contains no global destination links", () => {
    render(<AdminPrimaryTabs />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /lead inbox/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /settings/i })).not.toBeInTheDocument();
  });

  it("changes the local panel through the quieter select control", () => {
    const onPanelChange = vi.fn();
    render(<AdminPrimaryTabs activePanel="mission-control" onPanelChange={onPanelChange} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Command Center panels" }), {
      target: { value: "ghosts" },
    });
    expect(onPanelChange).toHaveBeenCalledWith("ghosts");
  });
});
