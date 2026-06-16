export const ADMIN_DASHBOARD_TABS = [
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

export type AdminDashboardTab = (typeof ADMIN_DASHBOARD_TABS)[number];

/** Operator-facing surface taxonomy (ADMIN-QA-02). Labels only — no behavior change. */
export type AdminSurfaceLabel =
  | "Live"
  | "Diagnostic"
  | "Playbook"
  | "Needs Runtime"
  | "Static";

/**
 * Source-confirmed surface labels. Upgrade to Live only after signed-in runtime 200.
 * Conservative defaults: wired paths → Needs Runtime; SOP/readiness → Playbook/Static.
 */
export const ADMIN_SURFACE_LABELS: Partial<Record<AdminDashboardTab, AdminSurfaceLabel>> = {
  "mission-control": "Live",
  "surface-map": "Static",
  prioritization: "Static",
  launch: "Playbook",
  command: "Live",
  routing: "Needs Runtime",
  "lead-assignments": "Needs Runtime",
  "lead-release": "Needs Runtime",
  "syndicate-health": "Needs Runtime",
  "contractor-performance": "Needs Runtime",
  pipeline: "Live",
  ghosts: "Live",
  "needs-review": "Live",
  engine: "Live",
  contractors: "Needs Runtime",
  onboarding: "Needs Runtime",
  outcomes: "Needs Runtime",
  reporting: "Needs Runtime",
  lifecycle: "Needs Runtime",
  feedback: "Needs Runtime",
  "shared-market": "Needs Runtime",
  "report-prep": "Needs Runtime",
  audit: "Needs Runtime",
  readiness: "Needs Runtime",
  training: "Playbook",
  rollout: "Playbook",
  "data-quality": "Needs Runtime",
  exceptions: "Needs Runtime",
  docs: "Playbook",
  learnings: "Playbook",
  "change-mgmt": "Playbook",
  governance: "Playbook",
  drills: "Playbook",
  expansion: "Playbook",
  "tech-debt": "Playbook",
  consistency: "Playbook",
  attribution: "Diagnostic",
  "signal-dispatch": "Diagnostic",
  "revenue-dispatch-readiness": "Diagnostic",
  "revenue-dry-run": "Diagnostic",
  "client-platform-configs": "Diagnostic",
  "dispatch-dry-run": "Diagnostic",
  "dispatch-outbox": "Diagnostic",
  "dispatch-attempts": "Diagnostic",
  "dispatch-governance": "Diagnostic",
  pilot: "Playbook",
  "delivery-inspector": "Diagnostic",
  "outcome-inspector": "Diagnostic",
  "session-diag": "Diagnostic",
  "otp-ops": "Diagnostic",
};

/** Primary nav routes not represented as AdminDashboardTab keys. */
export const ADMIN_EXTRA_ROUTE_LABELS: Record<string, AdminSurfaceLabel> = {
  "/admin/leads": "Live",
};

/** Map /admin/* paths to dashboard tab keys for label lookup. */
export const ADMIN_ROUTE_TO_TAB: Record<string, AdminDashboardTab> = {
  "/admin/command-center": "mission-control",
  "/admin/launch": "launch",
  "/admin/command": "command",
  "/admin/pipeline": "pipeline",
  "/admin/routing": "routing",
  "/admin/lead-assignments": "lead-assignments",
  "/admin/lead-release": "lead-release",
  "/admin/syndicate-health": "syndicate-health",
  "/admin/contractor-performance": "contractor-performance",
  "/admin/ghosts": "ghosts",
  "/admin/needs-review": "needs-review",
  "/admin/dialer": "engine",
  "/admin/contractors": "contractors",
  "/admin/outcomes": "outcomes",
  "/admin/attribution": "attribution",
  "/admin/signal-dispatch": "signal-dispatch",
  "/admin/otp-ops": "otp-ops",
  "/admin/outcome-inspector": "outcome-inspector",
  "/admin/delivery-inspector": "delivery-inspector",
  "/admin/session-diag": "session-diag",
};

export function getAdminSurfaceLabel(tab: string): AdminSurfaceLabel | null {
  if (isAdminDashboardTab(tab)) {
    return ADMIN_SURFACE_LABELS[tab] ?? null;
  }
  return null;
}

export function getAdminSurfaceLabelByRoute(pathname: string): AdminSurfaceLabel | null {
  const exact = ADMIN_EXTRA_ROUTE_LABELS[pathname];
  if (exact) return exact;

  const tab = ADMIN_ROUTE_TO_TAB[pathname];
  if (tab) return ADMIN_SURFACE_LABELS[tab] ?? null;

  return null;
}

export function adminSurfaceLabelBadgeClass(label: AdminSurfaceLabel): string {
  switch (label) {
    case "Live":
      return "border-emerald-300 bg-emerald-50 text-emerald-950";
    case "Diagnostic":
      return "border-blue-300 bg-blue-50 text-blue-950";
    case "Playbook":
      return "border-amber-300 bg-amber-50 text-amber-950";
    case "Needs Runtime":
      return "border-slate-400 bg-slate-100 text-slate-800";
    case "Static":
      return "border-slate-300 bg-white text-slate-700";
  }
}

const ADMIN_DASHBOARD_TAB_SET = new Set<string>(ADMIN_DASHBOARD_TABS);

export const PUBLIC_ROOT_ROUTE_DENYLIST = new Set([
  "about",
  "contact",
  "faq",
  "privacy",
  "terms",
  "disclaimer",
  "how-we-beat-window-quotes",
  "contractors",
  "contractors2",
  "contractors3",
  "estimate",
  "diagnosis",
  "lp",
  "partner",
  "report",
  "admin",
  "demo-classic",
  "dev",
  "devtesting",
]);

export function isAdminDashboardTab(value: string): value is AdminDashboardTab {
  return ADMIN_DASHBOARD_TAB_SET.has(value);
}