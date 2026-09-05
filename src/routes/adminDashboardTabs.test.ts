import { describe, expect, it } from "vitest";
import {
  ADMIN_COMMAND_CENTER_OVERVIEW_PANEL_ID,
  ADMIN_DASHBOARD_TABS,
  ADMIN_META_INTAKE_LAB_ROUTE,
  ADMIN_META_INTAKE_LAB_ROUTE_VERIFIED,
  getAdminLocalPanelDisplayLabel,
  getAdminMoreDestinations,
  getAdminPageTitle,
  getAdminPrimaryDestinations,
  isAdminDashboardTab,
  isAdminMoreTriggerActive,
  resolveAdminGlobalDestination,
  resolveAdminLocalPanel,
} from "./adminDashboardTabs";

const PRESERVED_DASHBOARD_TABS = [
  "mission-control",
  "surface-map",
  "prioritization",
  "launch",
  "command",
  "routing",
  "lead-assignments",
  "lead-release",
  "syndicate-health",
  "contractor-performance",
  "pipeline",
  "ghosts",
  "needs-review",
  "engine",
  "contractors",
  "onboarding",
  "outcomes",
  "reporting",
  "lifecycle",
  "feedback",
  "shared-market",
  "report-prep",
  "audit",
  "readiness",
  "training",
  "rollout",
  "data-quality",
  "exceptions",
  "docs",
  "learnings",
  "change-mgmt",
  "governance",
  "drills",
  "expansion",
  "tech-debt",
  "consistency",
  "attribution",
  "signal-dispatch",
  "revenue-dispatch-readiness",
  "revenue-dry-run",
  "client-platform-configs",
  "dispatch-dry-run",
  "dispatch-outbox",
  "dispatch-attempts",
  "dispatch-governance",
  "pilot",
  "delivery-inspector",
  "outcome-inspector",
  "session-diag",
  "otp-ops",
] as const;

describe("adminDashboardTabs — global destination metadata", () => {
  it("exposes exactly five primary destinations in approved order", () => {
    expect(getAdminPrimaryDestinations().map((destination) => destination.id)).toEqual([
      "lead-inbox",
      "command-center",
      "pipeline",
      "routing",
      "needs-review",
    ]);
  });

  it("places Contractors in More, not primary", () => {
    expect(getAdminPrimaryDestinations().some((destination) => destination.id === "contractors")).toBe(false);
    expect(getAdminMoreDestinations()[0]?.id).toBe("contractors");
  });

  it("exposes exactly eight verified More destinations in approved order", () => {
    expect(getAdminMoreDestinations().map((destination) => destination.id)).toEqual([
      "contractors",
      "attribution",
      "otp-ops",
      "evidence",
      "partners",
      "settings",
      "health",
      "meta-intake-lab",
    ]);
  });

  it("identifies Health as a standalone More destination", () => {
    const health = getAdminMoreDestinations().find((destination) => destination.id === "health");
    expect(health).toMatchObject({
      href: "/admin/health",
      placement: "more",
      standalone: true,
    });
  });

  it("includes Meta Intake Lab only when its route is verified", () => {
    const lab = getAdminMoreDestinations().find((destination) => destination.id === "meta-intake-lab");
    if (ADMIN_META_INTAKE_LAB_ROUTE_VERIFIED) {
      expect(lab).toMatchObject({
        href: ADMIN_META_INTAKE_LAB_ROUTE,
        placement: "more",
      });
    } else {
      expect(lab).toBeUndefined();
    }
    expect(ADMIN_META_INTAKE_LAB_ROUTE_VERIFIED).toBe(true);
  });
});

describe("adminDashboardTabs — active matching", () => {
  it("activates Lead Inbox for nested lead routes", () => {
    expect(resolveAdminGlobalDestination("/admin/leads")?.id).toBe("lead-inbox");
    expect(resolveAdminGlobalDestination("/admin/leads/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")?.id).toBe(
      "lead-inbox",
    );
    expect(
      resolveAdminGlobalDestination("/admin/leads/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/report")?.id,
    ).toBe("lead-inbox");
  });

  it("activates Evidence instead of Lead Inbox", () => {
    expect(resolveAdminGlobalDestination("/admin/lead-evidence")?.id).toBe("evidence");
    expect(isAdminMoreTriggerActive("/admin/lead-evidence")).toBe(true);
    expect(resolveAdminGlobalDestination("/admin/lead-assignments")?.id).toBe("command-center");
  });

  it("ignores query strings when resolving the active destination", () => {
    expect(resolveAdminGlobalDestination("/admin/leads?priority=Hot&lead_id=abc")?.id).toBe("lead-inbox");
    expect(resolveAdminGlobalDestination("/admin/lead-evidence?source=power-tool-demo")?.id).toBe("evidence");
    expect(resolveAdminGlobalDestination("/admin/command-center?panel=ghosts")?.id).toBe("command-center");
  });

  it("resolves Command Center aliases without creating a sixth primary", () => {
    expect(resolveAdminGlobalDestination("/admin/command-center")?.id).toBe("command-center");
    expect(resolveAdminGlobalDestination("/admin/mission-control")?.id).toBe("command-center");
    expect(resolveAdminGlobalDestination("/admin/command")?.id).toBe("command-center");
    expect(resolveAdminGlobalDestination("/admin/ghosts")?.id).toBe("command-center");
    expect(resolveAdminGlobalDestination("/admin/dialer")?.id).toBe("command-center");
    expect(getAdminPrimaryDestinations().some((destination) => destination.href === "/admin/command")).toBe(
      false,
    );
    expect(resolveAdminGlobalDestination("/admin/pipeline")?.id).toBe("pipeline");
  });

  it("keeps mission-control as Overview without renaming the panel id", () => {
    expect(ADMIN_COMMAND_CENTER_OVERVIEW_PANEL_ID).toBe("mission-control");
    expect(resolveAdminLocalPanel("/admin/command-center")).toBe("mission-control");
    expect(getAdminLocalPanelDisplayLabel("mission-control")).toBe("Overview");
    expect(getAdminLocalPanelDisplayLabel("pipeline")).toBe("Pipeline");
  });
});

describe("adminDashboardTabs — existing allowlist", () => {
  it("preserves all 50 verified dashboard tab ids", () => {
    expect(ADMIN_DASHBOARD_TABS).toHaveLength(50);
    expect(ADMIN_DASHBOARD_TABS).toEqual(PRESERVED_DASHBOARD_TABS);
  });

  it("resolves page titles from the global destination", () => {
    expect(getAdminPageTitle("/admin/command-center")).toBe("Command Center");
    expect(getAdminPageTitle("/admin/pipeline")).toBe("Pipeline");
    expect(getAdminPageTitle("/admin/routing")).toBe("Routing");
    expect(getAdminPageTitle("/admin/needs-review")).toBe("Needs Review");
    expect(getAdminPageTitle("/admin/ghosts")).toBe("Command Center");
  });

  it("continues to reject unknown dynamic tab values", () => {
    expect(isAdminDashboardTab("not-a-real-tab")).toBe(false);
    expect(resolveAdminGlobalDestination("/admin/not-a-real-tab")).toBeNull();
  });
});
