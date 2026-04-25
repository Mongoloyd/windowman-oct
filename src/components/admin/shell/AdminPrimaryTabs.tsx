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

export interface AdminPrimaryTabsProps {
  ghostCount?: number;
  needsReviewCount?: number;
}

interface PanelTabDef {
  kind: "panel";
  value: string;
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
  label: string;
  count?: number;
  variant?: "destructive" | "default";
}

type TabDef = PanelTabDef | RouteTabDef;

// Shared className so route-tabs are visually indistinguishable from panel-tabs.
const TAB_TRIGGER_CLASSES = [
  "flex-1 min-w-[110px]",
  "data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:border-slate-300 data-[state=active]:shadow-sm",
  "text-slate-700 hover:text-slate-950 hover:bg-white hover:border-slate-300 hover:shadow-sm",
  "text-sm font-semibold",
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:ring-offset-2",
  "transition-all border border-transparent",
  // Match Radix TabsTrigger sizing so route-tabs line up identically with panel-tabs
  "inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-md px-3 py-2",
].join(" ");

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
      label: "Lead Inbox",
    },
    {
      kind: "route",
      to: "/admin/command-center",
      matchPrefixes: ["/admin/command-center"],
      label: "Mission Control",
    },
    { kind: "route", to: "/admin/launch", matchPrefixes: ["/admin/launch"], label: "Launch Control" },
    { kind: "route", to: "/admin/command", matchPrefixes: ["/admin/command"], label: "Command Center" },
    { kind: "route", to: "/admin/pipeline", matchPrefixes: ["/admin/pipeline"], label: "Active Pipeline" },
    { kind: "route", to: "/admin/routing", matchPrefixes: ["/admin/routing"], label: "Routing" },
    { kind: "route", to: "/admin/ghosts", matchPrefixes: ["/admin/ghosts"], label: "Ghost Recovery", count: ghostCount, variant: "destructive" },
    { kind: "route", to: "/admin/needs-review", matchPrefixes: ["/admin/needs-review"], label: "Needs Review", count: needsReviewCount, variant: "destructive" },
    { kind: "route", to: "/admin/dialer", matchPrefixes: ["/admin/dialer"], label: "Dialer Desk" },
    { kind: "route", to: "/admin/contractors", matchPrefixes: ["/admin/contractors"], label: "Contractors" },
    { kind: "panel", value: "onboarding", label: "Onboarding" },
    { kind: "route", to: "/admin/outcomes", matchPrefixes: ["/admin/outcomes"], label: "Outcomes" },
    { kind: "route", to: "/admin/attribution", matchPrefixes: ["/admin/attribution"], label: "Attribution" },
    { kind: "panel", value: "delivery-inspector", label: "Delivery Inspector" },
    { kind: "panel", value: "session-diag", label: "Session Diag" },
  ];

  function renderCount(count?: number, variant?: "destructive" | "default") {
    if (count == null || count <= 0) return null;
    return (
      <Badge
        variant={variant ?? "default"}
        className="ml-1.5 h-5 min-w-[22px] border border-slate-300 px-1.5 text-[11px] font-extrabold"
      >
        {count > 99 ? "99+" : count}
      </Badge>
    );
  }

  return (
    <TabsList className="flex w-full flex-wrap h-auto gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      {tabs.map((t) => {
        if (t.kind === "panel") {
          return (
            <TabsTrigger
              key={`panel:${t.value}`}
              value={t.value}
              className={TAB_TRIGGER_CLASSES}
            >
              <span className="truncate">{t.label}</span>
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
            <span className="truncate">{t.label}</span>
            {renderCount(t.count, t.variant)}
          </Link>
        );
      })}
    </TabsList>
  );
}
