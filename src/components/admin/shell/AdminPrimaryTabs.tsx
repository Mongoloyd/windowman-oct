/**
 * AdminPrimaryTabs — Curated tab strip for the admin dashboard.
 *
 * Mixes two kinds of entries:
 *   1. **Panel tabs** — Radix <TabsTrigger> values that switch the in-page panel.
 *   2. **Route tabs** — react-router <Link>s styled identically to TabsTrigger
 *      that navigate to a sibling /admin/* route. Active state is derived from
 *      useLocation() so the highlight persists on dynamic sub-routes
 *      (e.g. "Lead Inbox" stays active on /admin/leads/:id).
 */

import { Link, useLocation } from "react-router-dom";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  type AdminDashboardTab,
  type AdminSurfaceLabel,
  ADMIN_SURFACE_LABELS,
  ADMIN_EXTRA_ROUTE_LABELS,
  adminSurfaceLabelBadgeClass,
} from "@/routes/adminDashboardTabs";

export interface AdminPrimaryTabsProps {
  ghostCount?: number;
  needsReviewCount?: number;
}

interface PanelTabDef {
  kind: "panel";
  value: string;
  tabKey: AdminDashboardTab;
  label: string;
  count?: number;
  variant?: "destructive" | "default";
  /** Optional pathname that should also highlight this panel tab when active. */
  routeAlias?: string;
}

interface RouteTabDef {
  kind: "route";
  to: string;
  /** Routes (including dynamic children) that should keep this tab highlighted. */
  matchPrefixes: string[];
  tabKey?: AdminDashboardTab;
  /** For routes outside AdminDashboardTab (e.g. Lead Inbox). */
  surfaceLabel?: AdminSurfaceLabel;
  label: string;
  count?: number;
  variant?: "destructive" | "default";
}

type TabDef = PanelTabDef | RouteTabDef;

// Shared className so route-tabs are visually indistinguishable from panel-tabs.
const TAB_TRIGGER_CLASSES = [
  "shrink-0 min-w-fit",
  "data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:border-slate-400 data-[state=active]:shadow-sm data-[state=active]:font-black",
  "bg-slate-50 text-slate-800 hover:text-slate-950 hover:bg-white hover:border-slate-400 hover:shadow-sm",
  "text-sm font-bold",
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:ring-offset-2",
  "transition-all border border-slate-300",
  // Match Radix TabsTrigger sizing so route-tabs line up identically with panel-tabs
  "inline-flex h-11 items-center justify-center whitespace-nowrap rounded-lg px-3.5 py-2 sm:px-4",
].join(" ");

function resolveSurfaceLabel(t: TabDef): AdminSurfaceLabel | null {
  if (t.kind === "route" && t.surfaceLabel) return t.surfaceLabel;
  const tabKey = t.tabKey;
  if (!tabKey) return null;
  return ADMIN_SURFACE_LABELS[tabKey] ?? null;
}

export function AdminPrimaryTabs({
  ghostCount = 0,
  needsReviewCount = 0,
}: AdminPrimaryTabsProps) {
  const location = useLocation();

  const tabs: TabDef[] = [
    {
      kind: "route",
      to: "/admin/leads",
      matchPrefixes: ["/admin/leads"],
      surfaceLabel: ADMIN_EXTRA_ROUTE_LABELS["/admin/leads"],
      label: "Lead Inbox",
    },
    {
      kind: "route",
      to: "/admin/command-center",
      matchPrefixes: ["/admin/command-center"],
      tabKey: "mission-control",
      label: "Mission",
    },
    { kind: "route", to: "/admin/launch", matchPrefixes: ["/admin/launch"], tabKey: "launch", label: "Launch" },
    { kind: "route", to: "/admin/command", matchPrefixes: ["/admin/command"], tabKey: "command", label: "Command" },
    { kind: "route", to: "/admin/pipeline", matchPrefixes: ["/admin/pipeline"], tabKey: "pipeline", label: "Pipeline" },
    { kind: "route", to: "/admin/routing", matchPrefixes: ["/admin/routing"], tabKey: "routing", label: "Routing" },
    {
      kind: "route",
      to: "/admin/lead-assignments",
      matchPrefixes: ["/admin/lead-assignments"],
      tabKey: "lead-assignments",
      label: "Lead Assignments",
    },
    {
      kind: "route",
      to: "/admin/lead-release",
      matchPrefixes: ["/admin/lead-release"],
      tabKey: "lead-release",
      label: "Lead Release",
    },
    {
      kind: "route",
      to: "/admin/syndicate-health",
      matchPrefixes: ["/admin/syndicate-health"],
      tabKey: "syndicate-health",
      label: "Syndicate Health",
    },
    {
      kind: "route",
      to: "/admin/contractor-performance",
      matchPrefixes: ["/admin/contractor-performance"],
      tabKey: "contractor-performance",
      label: "Contractor Performance",
    },
    {
      kind: "route",
      to: "/admin/ghosts",
      matchPrefixes: ["/admin/ghosts"],
      tabKey: "ghosts",
      label: "Ghosts",
      count: ghostCount,
      variant: "destructive",
    },
    {
      kind: "route",
      to: "/admin/needs-review",
      matchPrefixes: ["/admin/needs-review"],
      tabKey: "needs-review",
      label: "Review",
      count: needsReviewCount,
      variant: "destructive",
    },
    { kind: "route", to: "/admin/dialer", matchPrefixes: ["/admin/dialer"], tabKey: "engine", label: "Dialer" },
    {
      kind: "route",
      to: "/admin/contractors",
      matchPrefixes: ["/admin/contractors"],
      tabKey: "contractors",
      label: "Contractors",
    },
    { kind: "route", to: "/admin/outcomes", matchPrefixes: ["/admin/outcomes"], tabKey: "outcomes", label: "Outcomes" },
    {
      kind: "route",
      to: "/admin/attribution",
      matchPrefixes: ["/admin/attribution"],
      tabKey: "attribution",
      label: "Attribution",
    },
    {
      kind: "route",
      to: "/admin/signal-dispatch",
      matchPrefixes: ["/admin/signal-dispatch"],
      tabKey: "signal-dispatch",
      label: "Signals",
    },
    { kind: "panel", value: "revenue-dispatch-readiness", tabKey: "revenue-dispatch-readiness", label: "Revenue Dispatch" },
    { kind: "panel", value: "revenue-dry-run", tabKey: "revenue-dry-run", label: "Dry-Run Audit" },
    { kind: "panel", value: "client-platform-configs", tabKey: "client-platform-configs", label: "Platform Configs" },
    { kind: "panel", value: "dispatch-dry-run", tabKey: "dispatch-dry-run", label: "Dry-Run Queue" },
    { kind: "panel", value: "dispatch-outbox", tabKey: "dispatch-outbox", label: "Dispatch Outbox" },
    { kind: "panel", value: "dispatch-attempts", tabKey: "dispatch-attempts", label: "Attempt Reconciliation" },
    { kind: "panel", value: "dispatch-governance", tabKey: "dispatch-governance", label: "Dispatch Governance" },
    { kind: "panel", value: "delivery-inspector", tabKey: "delivery-inspector", label: "Delivery" },
    { kind: "route", to: "/admin/otp-ops", matchPrefixes: ["/admin/otp-ops"], tabKey: "otp-ops", label: "OTP Ops" },
    {
      kind: "route",
      to: "/admin/outcome-inspector",
      matchPrefixes: ["/admin/outcome-inspector"],
      tabKey: "outcome-inspector",
      label: "Outcome Inspector",
    },
    { kind: "panel", value: "session-diag", tabKey: "session-diag", label: "Sessions" },
  ];

  function renderCount(count?: number, variant?: "destructive" | "default") {
    if (count == null || count <= 0) return null;
    return (
      <Badge
        variant={variant ?? "default"}
        className="ml-1.5 min-h-6 min-w-[24px] border border-slate-400 bg-white px-2 text-sm font-extrabold text-slate-950 shadow-sm"
      >
        {count > 99 ? "99+" : count}
      </Badge>
    );
  }

  function renderSurfaceLabel(label: AdminSurfaceLabel | null) {
    if (!label) return null;
    return (
      <Badge
        variant="outline"
        className={`ml-1.5 px-1.5 py-0 text-[10px] font-extrabold uppercase tracking-wide ${adminSurfaceLabelBadgeClass(label)}`}
      >
        {label}
      </Badge>
    );
  }

  return (
    <TabsList className="wm-slim-scrollbar flex h-auto w-full flex-nowrap justify-start gap-2 overflow-x-auto overscroll-x-contain rounded-2xl border border-slate-300 bg-white p-2 shadow-sm [scrollbar-gutter:stable]">
      {tabs.map((t) => {
        const surfaceLabel = resolveSurfaceLabel(t);

        if (t.kind === "panel") {
          return (
            <TabsTrigger
              key={`panel:${t.value}`}
              value={t.value}
              aria-label={t.label}
              className={TAB_TRIGGER_CLASSES}
            >
              <span>{t.label}</span>
              {renderSurfaceLabel(surfaceLabel)}
              {renderCount(t.count, t.variant)}
            </TabsTrigger>
          );
        }

        const isActive = t.matchPrefixes.some(
          (prefix) =>
            location.pathname === prefix ||
            location.pathname.startsWith(`${prefix}/`),
        );

        return (
          <Link
            key={`route:${t.to}`}
            to={t.to}
            data-state={isActive ? "active" : "inactive"}
            aria-current={isActive ? "page" : undefined}
            className={TAB_TRIGGER_CLASSES}
          >
            <span>{t.label}</span>
            {renderSurfaceLabel(surfaceLabel)}
            {renderCount(t.count, t.variant)}
          </Link>
        );
      })}
    </TabsList>
  );
}
