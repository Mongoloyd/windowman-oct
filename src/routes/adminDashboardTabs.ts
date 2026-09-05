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

/**
 * Canonical admin destination metadata.
 *
 * Owns global placement, aliases, and active-route matching so shell/nav
 * presentation can consume one owner. Does not change rendering by itself.
 *
 * `mission-control` remains the internal Command Center overview panel id.
 * Its visible label is Overview.
 */
export type AdminNavPlacement = "primary" | "more";

export type AdminGlobalDestinationId =
  | "lead-inbox"
  | "command-center"
  | "pipeline"
  | "routing"
  | "needs-review"
  | "contractors"
  | "attribution"
  | "otp-ops"
  | "evidence"
  | "partners"
  | "settings"
  | "health"
  | "meta-intake-lab";

export interface AdminGlobalDestination {
  id: AdminGlobalDestinationId;
  label: string;
  href: string;
  placement: AdminNavPlacement;
  matchPaths: readonly string[];
  aliases?: readonly string[];
  localPanelId?: AdminDashboardTab;
  localPanelCategory?: AdminSurfaceLabel;
  verified: true;
  /** Utility that is linked from More but rendered outside AdminShell. */
  standalone?: boolean;
}

/** Internal Command Center panel id. Visible label is Overview. */
export const ADMIN_COMMAND_CENTER_OVERVIEW_PANEL_ID = "mission-control" as const;

/**
 * Verified against `src/routes/AdminRoutes.tsx` (`path="meta-intake-lab"`).
 * Include Meta Intake Lab in More only while this remains true.
 */
export const ADMIN_META_INTAKE_LAB_ROUTE = "/admin/meta-intake-lab";
export const ADMIN_META_INTAKE_LAB_ROUTE_VERIFIED = true;

const GLOBALLY_OWNED_DASHBOARD_TABS = new Set<AdminDashboardTab>([
  "pipeline",
  "routing",
  "needs-review",
  "contractors",
  "attribution",
  "otp-ops",
]);

export function normalizeAdminPathname(path: string): string {
  const withoutHash = path.split("#")[0] ?? path;
  return withoutHash.split("?")[0] ?? withoutHash;
}

function adminPathMatches(pathname: string, candidate: string): boolean {
  return pathname === candidate || pathname.startsWith(`${candidate}/`);
}

function collectCommandCenterAliases(): string[] {
  const aliases = new Set<string>(["/admin/mission-control", "/admin/command"]);

  for (const [route, tab] of Object.entries(ADMIN_ROUTE_TO_TAB)) {
    if (route === "/admin/command-center") continue;
    if (!GLOBALLY_OWNED_DASHBOARD_TABS.has(tab)) {
      aliases.add(route);
    }
  }

  for (const tab of ADMIN_DASHBOARD_TABS) {
    if (GLOBALLY_OWNED_DASHBOARD_TABS.has(tab)) continue;
    aliases.add(`/admin/${tab}`);
  }

  return [...aliases];
}

const COMMAND_CENTER_ALIASES = collectCommandCenterAliases();

const ADMIN_MORE_DESTINATIONS: AdminGlobalDestination[] = [
  {
    id: "contractors",
    label: "Contractors",
    href: "/admin/contractors",
    placement: "more",
    matchPaths: ["/admin/contractors"],
    localPanelId: "contractors",
    localPanelCategory: ADMIN_SURFACE_LABELS.contractors,
    verified: true,
  },
  {
    id: "attribution",
    label: "Attribution",
    href: "/admin/attribution",
    placement: "more",
    matchPaths: ["/admin/attribution"],
    localPanelId: "attribution",
    localPanelCategory: ADMIN_SURFACE_LABELS.attribution,
    verified: true,
  },
  {
    id: "otp-ops",
    label: "OTP Ops",
    href: "/admin/otp-ops",
    placement: "more",
    matchPaths: ["/admin/otp-ops"],
    localPanelId: "otp-ops",
    localPanelCategory: ADMIN_SURFACE_LABELS["otp-ops"],
    verified: true,
  },
  {
    id: "evidence",
    label: "Evidence",
    href: "/admin/lead-evidence",
    placement: "more",
    matchPaths: ["/admin/lead-evidence"],
    verified: true,
  },
  {
    id: "partners",
    label: "Partners",
    href: "/admin/partners",
    placement: "more",
    matchPaths: ["/admin/partners"],
    verified: true,
  },
  {
    id: "settings",
    label: "Settings",
    href: "/admin/settings",
    placement: "more",
    matchPaths: ["/admin/settings"],
    verified: true,
  },
  {
    id: "health",
    label: "Health",
    href: "/admin/health",
    placement: "more",
    matchPaths: ["/admin/health"],
    verified: true,
    standalone: true,
  },
];

if (ADMIN_META_INTAKE_LAB_ROUTE_VERIFIED) {
  ADMIN_MORE_DESTINATIONS.push({
    id: "meta-intake-lab",
    label: "Meta Intake Lab",
    href: ADMIN_META_INTAKE_LAB_ROUTE,
    placement: "more",
    matchPaths: [ADMIN_META_INTAKE_LAB_ROUTE],
    verified: true,
  });
}

export const ADMIN_GLOBAL_DESTINATIONS: readonly AdminGlobalDestination[] = [
  {
    id: "lead-inbox",
    label: "Lead Inbox",
    href: "/admin/leads",
    placement: "primary",
    matchPaths: ["/admin/leads"],
    localPanelCategory: ADMIN_EXTRA_ROUTE_LABELS["/admin/leads"],
    verified: true,
  },
  {
    id: "command-center",
    label: "Command Center",
    href: "/admin/command-center",
    placement: "primary",
    matchPaths: ["/admin/command-center"],
    aliases: COMMAND_CENTER_ALIASES,
    localPanelId: ADMIN_COMMAND_CENTER_OVERVIEW_PANEL_ID,
    localPanelCategory: ADMIN_SURFACE_LABELS["mission-control"],
    verified: true,
  },
  {
    id: "pipeline",
    label: "Pipeline",
    href: "/admin/pipeline",
    placement: "primary",
    matchPaths: ["/admin/pipeline"],
    localPanelId: "pipeline",
    localPanelCategory: ADMIN_SURFACE_LABELS.pipeline,
    verified: true,
  },
  {
    id: "routing",
    label: "Routing",
    href: "/admin/routing",
    placement: "primary",
    matchPaths: ["/admin/routing"],
    localPanelId: "routing",
    localPanelCategory: ADMIN_SURFACE_LABELS.routing,
    verified: true,
  },
  {
    id: "needs-review",
    label: "Needs Review",
    href: "/admin/needs-review",
    placement: "primary",
    matchPaths: ["/admin/needs-review"],
    localPanelId: "needs-review",
    localPanelCategory: ADMIN_SURFACE_LABELS["needs-review"],
    verified: true,
  },
  ...ADMIN_MORE_DESTINATIONS,
];

export function getAdminPrimaryDestinations(): AdminGlobalDestination[] {
  return ADMIN_GLOBAL_DESTINATIONS.filter((destination) => destination.placement === "primary");
}

export function getAdminMoreDestinations(): AdminGlobalDestination[] {
  return ADMIN_GLOBAL_DESTINATIONS.filter((destination) => destination.placement === "more");
}

export function resolveAdminLocalPanel(pathname: string): AdminDashboardTab | null {
  const path = normalizeAdminPathname(pathname);
  const mapped = ADMIN_ROUTE_TO_TAB[path];
  if (mapped) return mapped;

  const segments = path.split("/").filter(Boolean);
  if (segments.length === 2 && segments[0] === "admin" && isAdminDashboardTab(segments[1])) {
    return segments[1];
  }

  return null;
}

export const ADMIN_LOCAL_PANEL_LABELS: Record<AdminDashboardTab, string> = {
  "mission-control": "Overview",
  "surface-map": "Surface Map",
  prioritization: "Prioritization",
  launch: "Launch",
  command: "Command",
  routing: "Routing",
  "lead-assignments": "Lead Assignments",
  "lead-release": "Lead Release",
  "syndicate-health": "Syndicate Health",
  "contractor-performance": "Contractor Performance",
  pipeline: "Pipeline",
  ghosts: "Ghosts",
  "needs-review": "Review",
  engine: "Dialer",
  contractors: "Contractors",
  onboarding: "Onboarding",
  outcomes: "Outcomes",
  reporting: "Reporting",
  lifecycle: "Lifecycle",
  feedback: "Feedback",
  "shared-market": "Shared Market",
  "report-prep": "Report Prep",
  audit: "Audit",
  readiness: "Readiness",
  training: "Training",
  rollout: "Rollout",
  "data-quality": "Data Quality",
  exceptions: "Exceptions",
  docs: "Docs",
  learnings: "Learnings",
  "change-mgmt": "Change Mgmt",
  governance: "Governance",
  drills: "Drills",
  expansion: "Expansion",
  "tech-debt": "Tech Debt",
  consistency: "Consistency",
  attribution: "Attribution",
  "signal-dispatch": "Signals",
  "revenue-dispatch-readiness": "Revenue Dispatch",
  "revenue-dry-run": "Dry-Run Audit",
  "client-platform-configs": "Platform Configs",
  "dispatch-dry-run": "Dry-Run Queue",
  "dispatch-outbox": "Dispatch Outbox",
  "dispatch-attempts": "Attempt Reconciliation",
  "dispatch-governance": "Dispatch Governance",
  pilot: "Pilot",
  "delivery-inspector": "Delivery",
  "outcome-inspector": "Outcome Inspector",
  "session-diag": "Sessions",
  "otp-ops": "OTP Ops",
};

export function getAdminLocalPanelDisplayLabel(tab: AdminDashboardTab): string {
  return ADMIN_LOCAL_PANEL_LABELS[tab];
}

export function getAdminPageTitle(pathname: string): string {
  return resolveAdminGlobalDestination(pathname)?.label ?? "Command Center";
}

function destinationMatchesPath(destination: AdminGlobalDestination, pathname: string): boolean {
  if (destination.matchPaths.some((candidate) => adminPathMatches(pathname, candidate))) {
    return true;
  }
  return destination.aliases?.some((candidate) => adminPathMatches(pathname, candidate)) ?? false;
}

export function resolveAdminGlobalDestination(pathname: string): AdminGlobalDestination | null {
  const path = normalizeAdminPathname(pathname);
  const ownedDestinations = ADMIN_GLOBAL_DESTINATIONS.filter(
    (destination) => destination.id !== "command-center",
  );
  const ownedMatch = ownedDestinations.find((destination) => destinationMatchesPath(destination, path));
  if (ownedMatch) return ownedMatch;

  const commandCenter = ADMIN_GLOBAL_DESTINATIONS.find((destination) => destination.id === "command-center");
  if (!commandCenter) return null;
  if (destinationMatchesPath(commandCenter, path)) return commandCenter;

  const panel = resolveAdminLocalPanel(path);
  if (panel && !GLOBALLY_OWNED_DASHBOARD_TABS.has(panel)) {
    return commandCenter;
  }

  return null;
}

export function isAdminMoreTriggerActive(pathname: string): boolean {
  return resolveAdminGlobalDestination(pathname)?.placement === "more";
}